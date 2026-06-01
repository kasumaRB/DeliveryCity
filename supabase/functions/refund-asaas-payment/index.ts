/**
 * Edge Function: refund-asaas-payment
 *
 * Emite reembolso completo via Asaas quando ocorre DELIVERY_FAILED.
 * Como repasses só ocorrem em DELIVERED, o reembolso reverte o valor integral ao cliente.
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!ASAAS_API_KEY) {
      return new Response(JSON.stringify({ error: 'Gateway de pagamento não configurado.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { orderId } = await req.json() as { orderId: string };
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: order } = await supabase
      .from('orders')
      .select('id, asaas_payment_id, total, status')
      .eq('id', orderId)
      .single();

    if (!order) {
      return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!order.asaas_payment_id) {
      // Pagamento não foi via Asaas (ex: dinheiro/débito) — sem reembolso digital necessário
      console.log(`[refund-asaas-payment] Pedido ${orderId} sem asaas_payment_id — ignorando`);
      return new Response(JSON.stringify({ refunded: false, reason: 'no_asaas_payment' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const refundRes = await fetch(`${ASAAS_BASE_URL}/payments/${order.asaas_payment_id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify({}),
    });
    const refundData = await refundRes.json();

    if (refundRes.status < 200 || refundRes.status >= 300) {
      console.error('[refund-asaas-payment] Erro no reembolso Asaas:', JSON.stringify(refundData));
      return new Response(JSON.stringify({ error: 'Falha no reembolso Asaas', details: refundData }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[refund-asaas-payment] Pedido ${orderId} reembolsado: R$${order.total}`);

    return new Response(JSON.stringify({ refunded: true, asaasRefundId: refundData?.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[refund-asaas-payment] Erro inesperado:', err);
    return new Response(JSON.stringify({ error: err.message ?? 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
