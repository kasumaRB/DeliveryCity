/**
 * Edge Function: handle-asaas-webhook
 *
 * Recebe webhooks do Asaas e atualiza o status dos pedidos no banco.
 *
 * Eventos tratados:
 *   PAYMENT_RECEIVED  → pedido: PENDING_PAYMENT → PENDING (loja começa a preparar)
 *   PAYMENT_CONFIRMED → mesmo tratamento (para cobranças de cartão)
 *   PAYMENT_OVERDUE   → pedido: CANCELLED (PIX expirou sem pagamento)
 *   PAYMENT_DELETED   → pedido: CANCELLED
 *
 * Segurança:
 *   - Valida o token de acesso via env ASAAS_WEBHOOK_TOKEN
 *   - Recusa eventos sem asaas_payment_id correspondente no banco
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendPushToUser } from '../_shared/pushNotification.ts';

const ASAAS_WEBHOOK_TOKEN = Deno.env.get('ASAAS_WEBHOOK_TOKEN') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Validar token do webhook (header asaas-access-token) ───────────────
    // Fail-closed: se ASAAS_WEBHOOK_TOKEN não estiver configurado, rejeita todas as requisições.
    // Isso evita que um atacante manipule pedidos em ambiente sem variável configurada.
    const webhookToken = req.headers.get('asaas-access-token') ?? '';
    if (!ASAAS_WEBHOOK_TOKEN || webhookToken !== ASAAS_WEBHOOK_TOKEN) {
      console.warn('[handle-asaas-webhook] Token inválido ou não configurado.');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Ler payload do webhook ─────────────────────────────────────────────
    const payload = await req.json() as {
      event: string;
      payment: {
        id: string;
        status: string;
        externalReference?: string; // orderId que gravamos na criação
        value?: number;
        billingType?: string;
      };
    };

    const { event, payment } = payload;
    if (!event || !payment?.id) {
      return new Response(JSON.stringify({ error: 'Payload inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[handle-asaas-webhook] Evento: ${event} | Payment: ${payment.id}`);

    // ── 3. Conectar ao Supabase com service_role ──────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── 4. Localizar o pedido pelo asaas_payment_id OU externalReference ─────
    let orderId = payment.externalReference;

    if (!orderId) {
      const { data: orderByPayment } = await supabase
        .from('orders')
        .select('id')
        .eq('asaas_payment_id', payment.id)
        .maybeSingle();
      orderId = orderByPayment?.id;
    }

    if (!orderId) {
      console.warn(`[handle-asaas-webhook] Pedido não encontrado para payment ${payment.id}`);
      // Retorna 200 para o Asaas não reenviar
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 5. Mapear evento → novo status do pedido ──────────────────────────────
    let newStatus: string | null = null;

    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        newStatus = 'PENDING'; // pago → loja começa a preparar
        break;
      case 'PAYMENT_OVERDUE':
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
        newStatus = 'CANCELLED';
        break;
      default:
        // Outros eventos (PAYMENT_CREATED, etc.) ignorados
        console.log(`[handle-asaas-webhook] Evento ${event} ignorado.`);
        return new Response(JSON.stringify({ received: true, ignored: event }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // ── 6. Para eventos de pagamento confirmado, validar o valor recebido ─────
    // Impede que um pagamento parcial/manipulado marque o pedido como pago.
    if (newStatus === 'PENDING') {
      const { data: orderToValidate } = await supabase
        .from('orders')
        .select('total')
        .eq('id', orderId)
        .single();

      const expected = Number(orderToValidate?.total ?? 0);
      const paid     = Number(payment.value ?? 0);
      // Tolerância de 1 centavo para arredondamento de ponto flutuante
      if (expected > 0 && Math.abs(paid - expected) > 0.01) {
        console.warn(
          `[handle-asaas-webhook] Valor divergente no pedido ${orderId}: ` +
          `esperado R$${expected.toFixed(2)}, recebido R$${paid.toFixed(2)} — NÃO confirmado.`
        );
        // 200 para o Asaas não reenviar; o pedido permanece PENDING_PAYMENT
        return new Response(JSON.stringify({ received: true, value_mismatch: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── 6b. Atualizar pedido ──────────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)
      .in('status', ['PENDING_PAYMENT']); // só atualiza se ainda está aguardando pagamento

    if (updateError) {
      console.error('[handle-asaas-webhook] Erro ao atualizar pedido:', updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 7. Notificar via push (best-effort) ──────────────────────────────────
    try {
      const { data: orderData } = await supabase
        .from('orders')
        .select('id, total, customer_id, restaurant_id, customer_name')
        .eq('id', orderId)
        .single();

      if (newStatus === 'PENDING' && orderData?.restaurant_id) {
        // Pagamento confirmado → notifica restaurante para começar a preparar
        // Entregadores são notificados somente quando o restaurante marcar READY
        const { data: restData } = await supabase
          .from('restaurants')
          .select('owner_id, name')
          .eq('id', orderData.restaurant_id)
          .single();

        if (restData?.owner_id) {
          const total = (orderData.total as number)?.toFixed(2) ?? '?';
          await sendPushToUser(supabase, restData.owner_id, {
            title: '🛒 Novo Pedido!',
            body: `${orderData.customer_name || 'Cliente'} fez um pedido de R$ ${total}. Confirme agora!`,
            data: { orderId, type: 'NEW_ORDER' },
          });
        }
      }

      if (newStatus === 'CANCELLED' && orderData?.customer_id) {
        // PIX expirou → notifica cliente
        await sendPushToUser(supabase, orderData.customer_id, {
          title: '❌ Pagamento expirado',
          body: 'Seu pedido foi cancelado pois o PIX não foi pago a tempo.',
          data: { orderId, type: 'ORDER_CANCELLED' },
        });
      }
    } catch (pushErr) {
      console.warn('[handle-asaas-webhook] Falha ao notificar:', pushErr);
    }

    return new Response(JSON.stringify({ received: true, orderId, newStatus }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[handle-asaas-webhook] Erro inesperado:', err);
    return new Response(JSON.stringify({ error: err.message ?? 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
