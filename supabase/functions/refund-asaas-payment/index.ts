/**
 * Edge Function: refund-asaas-payment
 *
 * Emite reembolso completo via Asaas quando ocorre DELIVERY_FAILED ou cancelamento.
 * Como repasses só ocorrem em DELIVERED, o reembolso reverte o valor integral ao cliente.
 *
 * Segurança (SEC-01):
 *   - Valida o JWT do chamador (auth.getUser).
 *   - Só permite: ADMIN, ou o cliente/entregador/dono do restaurante do pedido.
 *   - Bloqueia reembolso de pedido DELIVERED para não-admin (evita pagar em dobro
 *     depois que restaurante e entregador já receberam o repasse).
 *   - Idempotência atômica: marca refunded_at ANTES de chamar a Asaas (.is null).
 *
 * Body: { orderId: string }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL') ?? 'https://www.asaas.com/api/v3';
const ASAAS_API_KEY  = Deno.env.get('ASAAS_API_KEY')  ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!ASAAS_API_KEY) {
      return json({ error: 'Gateway de pagamento não configurado.' }, 500);
    }

    // ── 1. Autenticar o chamador (client com o JWT do usuário) ────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return json({ error: 'Não autenticado.' }, 401);
    }

    // Client service_role PURO para leitura/gravação privilegiada (bypassa RLS e triggers).
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { orderId } = await req.json() as { orderId: string };
    if (!orderId) {
      return json({ error: 'orderId é obrigatório' }, 400);
    }

    // ── 2. Buscar pedido + dono do restaurante para checagem de autorização ───
    const { data: order } = await admin
      .from('orders')
      .select('id, asaas_payment_id, total, status, refunded_at, customer_id, driver_id, restaurant_id')
      .eq('id', orderId)
      .single();

    if (!order) {
      return json({ error: 'Pedido não encontrado' }, 404);
    }

    // ── 3. Autorização (SEC-01) ───────────────────────────────────────────────
    const { data: callerProfile } = await admin
      .from('profiles').select('role').eq('id', user.id).maybeSingle();
    const isAdmin = callerProfile?.role === 'ADMIN';

    let isRestaurantOwner = false;
    if (!isAdmin && order.restaurant_id) {
      const { data: rest } = await admin
        .from('restaurants').select('owner_id').eq('id', order.restaurant_id).maybeSingle();
      isRestaurantOwner = rest?.owner_id === user.id;
    }

    const isParty =
      order.customer_id === user.id ||
      order.driver_id === user.id ||
      isRestaurantOwner;

    if (!isAdmin && !isParty) {
      return json({ error: 'Sem permissão para reembolsar este pedido.' }, 403);
    }

    // Não-admin não pode reembolsar pedido já entregue (repasses já liberados).
    if (!isAdmin && order.status === 'DELIVERED') {
      return json({ error: 'Pedido já entregue — reembolso requer suporte.' }, 409);
    }

    if (!order.asaas_payment_id) {
      // Pagamento não foi via Asaas (dinheiro/débito) — sem reembolso digital
      return json({ refunded: false, reason: 'no_asaas_payment' }, 200);
    }

    // ── 4. Idempotência ATÔMICA: marca refunded_at antes de chamar a Asaas ────
    //     Se outra chamada já marcou, o update condicional não afeta linha → aborta.
    const refundedAt = new Date().toISOString();
    const { data: claimed } = await admin
      .from('orders')
      .update({ refunded_at: refundedAt })
      .eq('id', orderId)
      .is('refunded_at', null)
      .select('id')
      .maybeSingle();

    if (!claimed) {
      console.log(`[refund-asaas-payment] Pedido ${orderId} já reembolsado — ignorando.`);
      return json({ refunded: true, skipped: true }, 200);
    }

    // ── 5. Reembolso na Asaas ─────────────────────────────────────────────────
    const refundRes = await fetch(`${ASAAS_BASE_URL}/payments/${order.asaas_payment_id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify({}),
    });
    const refundData = await refundRes.json();

    if (refundRes.status < 200 || refundRes.status >= 300) {
      // Falhou: libera o flag para permitir nova tentativa.
      await admin.from('orders').update({ refunded_at: null }).eq('id', orderId);
      console.error('[refund-asaas-payment] Erro no reembolso Asaas:', JSON.stringify(refundData));
      return json({ error: 'Falha no reembolso Asaas', details: refundData }, 502);
    }

    console.log(`[refund-asaas-payment] Pedido ${orderId} reembolsado: R$${order.total}`);
    return json({ refunded: true, asaasRefundId: refundData?.id }, 200);

  } catch (err: any) {
    console.error('[refund-asaas-payment] Erro inesperado:', err);
    return json({ error: err.message ?? 'Erro interno' }, 500);
  }
});
