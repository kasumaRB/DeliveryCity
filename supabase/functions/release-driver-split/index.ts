/**
 * Edge Function: release-driver-split
 *
 * Transfere a parte do entregador (taxa de entrega líquida) para a subconta Asaas dele.
 * Chamada automaticamente quando o entregador aceita uma entrega (assignDriver).
 *
 * Fluxo assíncrono:
 *   - No momento do pagamento, a taxa de entrega fica retida na conta principal
 *   - Quando o entregador aceita, este endpoint efetua a transferência via POST /v3/transfers
 *
 * Body esperado:
 * {
 *   orderId: string;
 *   driverId: string;
 * }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Fail-closed: padrão é PRODUÇÃO. Defina ASAAS_BASE_URL p/ usar sandbox.
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
      console.error('[release-driver-split] ASAAS_API_KEY não configurada — abortando.');
      return new Response(JSON.stringify({ error: 'Gateway de pagamento não configurado.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 1. Autenticar (exige role ADMIN ou service_role) ──────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Para chamar pelo frontend (entregador), valida que o caller é o próprio entregador
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Ler body ──────────────────────────────────────────────────────────
    const body = await req.json() as { orderId: string; driverId: string };
    const { orderId, driverId } = body;

    if (!orderId || !driverId) {
      return new Response(JSON.stringify({ error: 'orderId e driverId são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Garante que o caller é o próprio entregador (ou admin via service_role)
    if (user.id !== driverId) {
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (callerProfile?.role?.toUpperCase() !== 'ADMIN') {
        return new Response(JSON.stringify({ error: 'Acesso negado' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── 3. Buscar pedido ──────────────────────────────────────────────────────
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, driver_net_earnings, asaas_payment_id, status, driver_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!order.asaas_payment_id) {
      return new Response(JSON.stringify({ error: 'Pedido não possui cobrança Asaas associada' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const driverEarnings = Number(order.driver_net_earnings ?? 0);
    if (driverEarnings <= 0) {
      return new Response(JSON.stringify({ error: 'Valor de repasse inválido' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Buscar subconta Asaas do entregador ────────────────────────────────
    const { data: driverProfile } = await supabase
      .from('profiles')
      .select('asaas_account_id, name')
      .eq('id', driverId)
      .single();

    if (!driverProfile?.asaas_account_id) {
      return new Response(JSON.stringify({ error: 'Entregador não possui subconta Asaas. Crie a subconta primeiro.' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 5. Efetuar transferência para a subconta do entregador ────────────────
    const transferRes = await fetch(`${ASAAS_BASE_URL}/transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify({
        value:        Math.round(driverEarnings * 100) / 100,
        walletId:     driverProfile.asaas_account_id,
        description:  `Repasse entrega - Pedido #${orderId}`,
        externalReference: `driver-split-${orderId}`,
      }),
    });

    const transferData = await transferRes.json();

    if (!transferRes.ok || !transferData?.id) {
      console.error('[release-driver-split] Erro transferência:', JSON.stringify(transferData));
      return new Response(JSON.stringify({ error: 'Falha na transferência Asaas', details: transferData }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 6. Registrar o transfer ID no pedido (audit trail) ───────────────────
    await supabase
      .from('orders')
      .update({ payment_id: transferData.id }) // reutiliza payment_id como audit
      .eq('id', orderId);

    return new Response(JSON.stringify({
      transferId: transferData.id,
      amount: driverEarnings,
      driverName: driverProfile.name,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[release-driver-split] Erro inesperado:', err);
    return new Response(JSON.stringify({ error: err.message ?? 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
