/**
 * Edge Function: create-asaas-payment
 *
 * Cria uma cobrança única no Asaas (PIX ou cartão de crédito) para um pedido.
 * Fluxo:
 *   1. Valida o pedido no banco (segurança: recalcula valores do servidor)
 *   2. Cria/recupera o customer Asaas do cliente
 *   3. Cria a cobrança sem split (repasses ocorrem somente após DELIVERED via release-payment-splits)
 *   4. Atualiza o pedido com asaas_payment_id + QR code PIX
 *   5. Retorna { asaasPaymentId, pixQrCode, pixQrCodeImage, status }
 *
 * Body esperado:
 * {
 *   orderId: string;
 *   billingType: 'PIX' | 'CREDIT_CARD';
 *   // Apenas para CREDIT_CARD:
 *   creditCard?: {
 *     holderName: string;
 *     number: string;
 *     expiryMonth: string;
 *     expiryYear: string;
 *     ccv: string;
 *   };
 *   creditCardHolderInfo?: {
 *     name: string;
 *     email: string;
 *     cpfCnpj: string;
 *     postalCode: string;
 *     addressNumber: string;
 *     phone: string;
 *   };
 *   // OU usar cartão tokenizado:
 *   creditCardToken?: string;
 * }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Fail-closed: padrão é PRODUÇÃO. Para usar sandbox, defina ASAAS_BASE_URL
// explicitamente. Isso evita que pagamentos reais caiam no sandbox em silêncio
// caso a variável de ambiente não esteja configurada em produção.
const ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL') ?? 'https://www.asaas.com/api/v3';
const ASAAS_API_KEY  = Deno.env.get('ASAAS_API_KEY')  ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper: chama a API Asaas
async function asaasPost(path: string, payload: unknown) {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
    body: JSON.stringify(payload),
  });
  return { status: res.status, data: await res.json() };
}

async function asaasGet(path: string) {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    headers: { 'access_token': ASAAS_API_KEY },
  });
  return { status: res.status, data: await res.json() };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 0. Configuração obrigatória ──────────────────────────────────────────
    if (!ASAAS_API_KEY) {
      console.error('[create-asaas-payment] ASAAS_API_KEY não configurada — abortando.');
      return new Response(JSON.stringify({ error: 'Gateway de pagamento não configurado.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 1. Autenticar ────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Ler body ──────────────────────────────────────────────────────────
    const body = await req.json() as {
      orderId: string;
      billingType: 'PIX' | 'CREDIT_CARD';
      creditCard?: {
        holderName: string;
        number: string;
        expiryMonth: string;
        expiryYear: string;
        ccv: string;
      };
      creditCardHolderInfo?: {
        name: string;
        email: string;
        cpfCnpj: string;
        postalCode: string;
        addressNumber: string;
        phone: string;
      };
      creditCardToken?: string;
    };

    const { orderId, billingType, creditCard, creditCardHolderInfo, creditCardToken } = body;
    if (!orderId || !billingType) {
      return new Response(JSON.stringify({ error: 'orderId e billingType são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Buscar pedido + restaurante do banco ───────────────────────────────
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, total, subtotal, delivery_fee, restaurant_net_earnings, customer_id, restaurant_id, asaas_payment_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Idempotência: se já tem payment_id, retorna ele
    if (order.asaas_payment_id) {
      const { data: existingPayment } = await asaasGet(`/payments/${order.asaas_payment_id}`);
      if (existingPayment?.id) {
        return new Response(JSON.stringify({
          asaasPaymentId: existingPayment.id,
          pixQrCode: existingPayment.pixQrCode?.payload,
          pixQrCodeImage: existingPayment.pixQrCode?.encodedImage,
          status: existingPayment.status,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Verifica que o pedido pertence ao usuário autenticado
    if (order.customer_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Acesso negado a este pedido' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar subconta Asaas do restaurante
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('asaas_account_id, name')
      .eq('id', order.restaurant_id)
      .single();

    // ── 4. Criar/recuperar customer Asaas do cliente ─────────────────────────
    const { data: customerProfile } = await supabase
      .from('profiles')
      .select('asaas_customer_id, name, email, cpf')
      .eq('id', user.id)
      .single();

    let asaasCustomerId = customerProfile?.asaas_customer_id;

    if (!asaasCustomerId) {
      // Buscar customer existente pelo CPF/email no Asaas
      const cpfClean = customerProfile?.cpf?.replace(/\D/g, '') ?? '';
      let foundCustomer = null;

      if (cpfClean) {
        const { data: searchData } = await asaasGet(`/customers?cpfCnpj=${cpfClean}`);
        foundCustomer = searchData?.data?.[0] ?? null;
      }

      if (!foundCustomer) {
        const { data: createdCustomer, status: csStatus } = await asaasPost('/customers', {
          name: customerProfile?.name ?? 'Cliente',
          email: customerProfile?.email ?? user.email,
          cpfCnpj: cpfClean || undefined,
        });

        if (csStatus < 200 || csStatus >= 300 || !createdCustomer?.id) {
          console.error('[create-asaas-payment] Erro criar customer:', createdCustomer);
          return new Response(JSON.stringify({ error: 'Falha ao criar customer Asaas', details: createdCustomer }), {
            status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        foundCustomer = createdCustomer;
      }

      asaasCustomerId = foundCustomer.id;

      // Salvar no perfil para próximas cobranças
      await supabase
        .from('profiles')
        .update({ asaas_customer_id: asaasCustomerId })
        .eq('id', user.id);
    }

    // ── 5. Montar payload de cobrança ─────────────────────────────────────────
    const totalCents   = Number(order.total);
    const restaurantNetEarnings = Number(order.restaurant_net_earnings ?? 0);

    // Vencimento: hoje + 1 dia (PIX expira rápido, cartão é processado imediatamente)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const dueDateStr = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const paymentPayload: Record<string, any> = {
      customer: asaasCustomerId,
      billingType,
      value: totalCents,
      dueDate: dueDateStr,
      description: `Pedido #${orderId}`,
      externalReference: orderId,
    };

    // Sem split no momento do pagamento — repasses ocorrem somente em DELIVERED
    // via release-payment-splits, garantindo reembolso total em caso de DELIVERY_FAILED

    // Dados de cartão de crédito
    if (billingType === 'CREDIT_CARD') {
      if (creditCardToken) {
        paymentPayload.creditCardToken = creditCardToken;
      } else if (creditCard && creditCardHolderInfo) {
        paymentPayload.creditCard = creditCard;
        paymentPayload.creditCardHolderInfo = creditCardHolderInfo;
      } else {
        return new Response(JSON.stringify({ error: 'Dados do cartão são obrigatórios para CREDIT_CARD' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── 6. Criar cobrança no Asaas ────────────────────────────────────────────
    const { data: payment, status: pmStatus } = await asaasPost('/payments', paymentPayload);

    if (pmStatus < 200 || pmStatus >= 300 || !payment?.id) {
      console.error('[create-asaas-payment] Erro criar pagamento:', JSON.stringify(payment));

      // Detectar cartão recusado — Asaas retorna erros com code contendo "DECLINED" ou "creditCard"
      const errs: any[] = payment?.errors ?? [];
      const isDeclined = billingType === 'CREDIT_CARD' && errs.some((e: any) =>
        String(e.code ?? '').toLowerCase().includes('declined') ||
        String(e.code ?? '').toLowerCase().includes('creditcard') ||
        String(e.description ?? '').toLowerCase().includes('recus') ||
        String(e.description ?? '').toLowerCase().includes('declined')
      );

      // Cancelar pedido para não ficar travado em PENDING_PAYMENT
      await supabase.from('orders')
        .update({ status: 'CANCELLED' })
        .eq('id', orderId)
        .catch(() => {});

      const errorMsg = isDeclined
        ? 'Cartão recusado pela operadora.'
        : 'Falha ao processar pagamento. Tente novamente.';

      return new Response(JSON.stringify({
        error: errorMsg,
        errorCode: isDeclined ? 'CARD_DECLINED' : 'PAYMENT_FAILED',
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Pagamento aceito mas status DECLINED (Asaas retornou 200 porém status = DECLINED)
    if (payment.status === 'DECLINED') {
      await supabase.from('orders')
        .update({ status: 'CANCELLED' })
        .eq('id', orderId)
        .catch(() => {});

      return new Response(JSON.stringify({
        error: 'Cartão recusado pela operadora.',
        errorCode: 'CARD_DECLINED',
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 7. Buscar QR code PIX (pode ser retornado em endpoint separado) ────────
    let pixQrCode: string | null = null;
    let pixQrCodeImage: string | null = null;

    if (billingType === 'PIX') {
      const { data: pixData } = await asaasGet(`/payments/${payment.id}/pixQrCode`);
      pixQrCode      = pixData?.payload          ?? null;
      pixQrCodeImage = pixData?.encodedImage     ?? null;
    }

    // ── 8. Atualizar pedido no banco ──────────────────────────────────────────
    const updatePayload: Record<string, any> = {
      asaas_payment_id: payment.id,
      status: 'PENDING_PAYMENT', // aguardando confirmação de pagamento
    };
    if (pixQrCode)      updatePayload.pix_qr_code       = pixQrCode;
    if (pixQrCodeImage) updatePayload.pix_qr_code_image = pixQrCodeImage;

    await supabase.from('orders').update(updatePayload).eq('id', orderId);

    // ── 9. Responder ───────────────────────────────────────────────────────────
    return new Response(JSON.stringify({
      asaasPaymentId: payment.id,
      pixQrCode,
      pixQrCodeImage,
      status: payment.status,
      creditCardToken: payment.creditCardToken ?? null,
      creditCardBrand: payment.creditCardBrand ?? null,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[create-asaas-payment] Erro inesperado:', err);
    return new Response(JSON.stringify({ error: err.message ?? 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
