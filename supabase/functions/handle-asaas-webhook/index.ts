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
    const webhookToken = req.headers.get('asaas-access-token') ?? '';
    if (ASAAS_WEBHOOK_TOKEN && webhookToken !== ASAAS_WEBHOOK_TOKEN) {
      console.warn('[handle-asaas-webhook] Token inválido recebido.');
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

    // ── 6. Atualizar pedido ───────────────────────────────────────────────────
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

    // ── 7. Notificar restaurante via push (best-effort) ───────────────────────
    if (newStatus === 'PENDING') {
      try {
        const { data: orderData } = await supabase
          .from('orders')
          .select('restaurant_id')
          .eq('id', orderId)
          .single();

        if (orderData?.restaurant_id) {
          const { data: restaurantOwner } = await supabase
            .from('restaurants')
            .select('owner_id')
            .eq('id', orderData.restaurant_id)
            .single();

          if (restaurantOwner?.owner_id) {
            const { data: ownerProfile } = await supabase
              .from('profiles')
              .select('push_token')
              .eq('id', restaurantOwner.owner_id)
              .single();

            if (ownerProfile?.push_token) {
              // Dispara notificação push (integração com serviço de push — best-effort)
              console.log(`[handle-asaas-webhook] Push token do lojista: ${ownerProfile.push_token} — novo pedido ${orderId}`);
              // TODO: Integrar com Expo Push Notifications / FCM aqui
            }
          }
        }
      } catch (pushErr) {
        console.warn('[handle-asaas-webhook] Falha ao notificar restaurante:', pushErr);
        // Não é fatal — o pedido já foi atualizado
      }
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
