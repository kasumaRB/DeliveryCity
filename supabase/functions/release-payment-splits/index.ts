/**
 * Edge Function: release-payment-splits
 *
 * Transfere para restaurante e entregador somente após DELIVERED.
 * Chamada em confirmDelivery() no store.tsx.
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

async function asaasPost(path: string, payload: unknown) {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
    body: JSON.stringify(payload),
  });
  return { status: res.status, data: await res.json() };
}

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

    // Buscar pedido + restaurante + entregador
    const { data: order } = await supabase
      .from('orders')
      .select('id, status, restaurant_id, driver_id, restaurant_net_earnings, driver_net_earnings')
      .eq('id', orderId)
      .single();

    if (!order) {
      return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (order.status !== 'DELIVERED') {
      return new Response(JSON.stringify({ error: 'Pedido não está em DELIVERED' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [{ data: restaurant }, { data: driver }] = await Promise.all([
      supabase.from('restaurants').select('asaas_account_id, name').eq('id', order.restaurant_id).single(),
      order.driver_id
        ? supabase.from('profiles').select('asaas_account_id, name').eq('id', order.driver_id).single()
        : Promise.resolve({ data: null }),
    ]);

    const results: string[] = [];

    // Transferir para restaurante
    if (restaurant?.asaas_account_id && Number(order.restaurant_net_earnings) > 0) {
      const { data: rt, status: rs } = await asaasPost('/transfers', {
        value: Math.round(Number(order.restaurant_net_earnings) * 100) / 100,
        walletId: restaurant.asaas_account_id,
        description: `Repasse restaurante - Pedido #${orderId}`,
        externalReference: `restaurant-split-${orderId}`,
      });
      if (rs >= 200 && rs < 300 && rt?.id) {
        results.push(`restaurant:${rt.id}`);
        console.log(`[release-payment-splits] Restaurante ${restaurant.name}: R$${order.restaurant_net_earnings} → ${rt.id}`);
      } else {
        console.error('[release-payment-splits] Erro transferência restaurante:', JSON.stringify(rt));
      }
    }

    // Transferir para entregador
    if (driver?.asaas_account_id && Number(order.driver_net_earnings) > 0) {
      const { data: dt, status: ds } = await asaasPost('/transfers', {
        value: Math.round(Number(order.driver_net_earnings) * 100) / 100,
        walletId: driver.asaas_account_id,
        description: `Repasse entrega - Pedido #${orderId}`,
        externalReference: `driver-split-${orderId}`,
      });
      if (ds >= 200 && ds < 300 && dt?.id) {
        results.push(`driver:${dt.id}`);
        console.log(`[release-payment-splits] Entregador ${driver.name}: R$${order.driver_net_earnings} → ${dt.id}`);
      } else {
        console.error('[release-payment-splits] Erro transferência entregador:', JSON.stringify(dt));
      }
    }

    return new Response(JSON.stringify({ released: true, transfers: results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[release-payment-splits] Erro inesperado:', err);
    return new Response(JSON.stringify({ error: err.message ?? 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
