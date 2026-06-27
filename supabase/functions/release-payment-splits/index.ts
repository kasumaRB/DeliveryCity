/**
 * Edge Function: release-payment-splits
 *
 * Envia PIX para restaurante e entregador somente após DELIVERED.
 * Usa a chave PIX cadastrada no perfil de cada um — sem subconta Asaas.
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

function isValidCPF(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== Number(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  return rem === Number(digits[10]);
}

function detectPixKeyType(key: string): 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP' {
  const clean = key.replace(/\D/g, '');
  if (key.includes('@')) return 'EMAIL';
  if (clean.length === 14) return 'CNPJ';
  if (clean.length === 11) return isValidCPF(clean) ? 'CPF' : 'PHONE';
  if (clean.length === 10) return 'PHONE';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return 'EVP';
  return 'EVP';
}

async function sendPix(pixKey: string, value: number, description: string, externalRef: string) {
  const keyType = detectPixKeyType(pixKey);
  const res = await fetch(`${ASAAS_BASE_URL}/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
    body: JSON.stringify({
      value: Math.round(value * 100) / 100,
      pixAddressKey: pixKey,
      pixAddressKeyType: keyType,
      description,
      externalReference: externalRef,
    }),
  });
  return { status: res.status, data: await res.json(), keyType };
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

    // Client service_role PURO: este endpoint faz repasses financeiros e grava
    // driver_split_released (coluna protegida por trigger). Não usa o JWT do usuário.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { orderId } = await req.json() as { orderId: string };
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar pedido
    const { data: order } = await supabase
      .from('orders')
      .select('id, status, restaurant_id, driver_id, restaurant_net_earnings, driver_net_earnings, driver_split_released')
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

    // Idempotência ATÔMICA (MONEY-01): só uma chamada consegue "reservar" o repasse.
    // O update condicional .eq('driver_split_released', false) é atômico no Postgres;
    // chamadas concorrentes que perderem a corrida recebem 0 linhas e abortam.
    const { data: claimed } = await supabase
      .from('orders')
      .update({ driver_split_released: true })
      .eq('id', orderId)
      .eq('driver_split_released', false)
      .select('id')
      .maybeSingle();

    if (!claimed) {
      console.log(`[splits] Pedido ${orderId} já teve repasses liberados — ignorando.`);
      return new Response(JSON.stringify({ released: true, skipped: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar owner_id do restaurante e pix_key do entregador em paralelo
    const [{ data: restaurant }, { data: driverProfile }] = await Promise.all([
      supabase.from('restaurants').select('name, owner_id').eq('id', order.restaurant_id).single(),
      order.driver_id
        ? supabase.from('profiles').select('pix_key, name').eq('id', order.driver_id).single()
        : Promise.resolve({ data: null }),
    ]);

    // Buscar pix_key do dono do restaurante
    let restaurantPixKey: string | null = null;
    let restaurantName = restaurant?.name ?? 'Restaurante';
    if (restaurant?.owner_id) {
      const { data: owner } = await supabase
        .from('profiles')
        .select('pix_key')
        .eq('id', restaurant.owner_id)
        .single();
      restaurantPixKey = owner?.pix_key ?? null;
    }

    const results: string[] = [];
    const warnings: string[] = [];

    // PIX para o restaurante
    if (restaurantPixKey && Number(order.restaurant_net_earnings) > 0) {
      const { data, status, keyType } = await sendPix(
        restaurantPixKey,
        Number(order.restaurant_net_earnings),
        `Repasse restaurante - Pedido #${orderId}`,
        `restaurant-pix-${orderId}`,
      );
      if (status >= 200 && status < 300 && data?.id) {
        results.push(`restaurant:${data.id}`);
        console.log(`[splits] ${restaurantName} R$${order.restaurant_net_earnings} → PIX(${keyType}) ✓`);
      } else {
        console.error('[splits] Erro PIX restaurante:', JSON.stringify(data));
        warnings.push(`restaurant_pix_failed`);
      }
    } else {
      const reason = !restaurantPixKey ? 'sem chave PIX cadastrada' : 'valor zero';
      console.warn(`[splits] Restaurante pulado — ${reason}. Pedido ${orderId}`);
      warnings.push(`restaurant_skipped:${reason}`);
    }

    // PIX para o entregador
    const driverPixKey = driverProfile?.pix_key ?? null;
    if (driverPixKey && Number(order.driver_net_earnings) > 0) {
      const { data, status, keyType } = await sendPix(
        driverPixKey,
        Number(order.driver_net_earnings),
        `Repasse entrega - Pedido #${orderId}`,
        `driver-pix-${orderId}`,
      );
      if (status >= 200 && status < 300 && data?.id) {
        results.push(`driver:${data.id}`);
        console.log(`[splits] ${driverProfile?.name} R$${order.driver_net_earnings} → PIX(${keyType}) ✓`);
      } else {
        console.error('[splits] Erro PIX entregador:', JSON.stringify(data));
        warnings.push(`driver_pix_failed`);
      }
    } else {
      const reason = !driverPixKey ? 'sem chave PIX cadastrada' : 'valor zero';
      console.warn(`[splits] Entregador pulado — ${reason}. Pedido ${orderId}`);
      warnings.push(`driver_skipped:${reason}`);
    }

    return new Response(JSON.stringify({ released: true, transfers: results, warnings }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[release-payment-splits] Erro inesperado:', err);
    return new Response(JSON.stringify({ error: err.message ?? 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
