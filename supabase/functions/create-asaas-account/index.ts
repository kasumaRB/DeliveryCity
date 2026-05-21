/**
 * Edge Function: create-asaas-account
 *
 * Cria uma subconta Asaas (White-label) para um novo parceiro (lojista ou entregador).
 * Chamada pelo frontend logo após o registro bem-sucedido de um parceiro.
 *
 * Body esperado:
 * {
 *   profileId: string;       // UUID do perfil no Supabase
 *   name: string;
 *   email: string;
 *   cpfCnpj: string;         // CPF (entregador) ou CNPJ (lojista)
 *   phoneNumber?: string;
 *   birthDate?: string;      // YYYY-MM-DD — obrigatório para pessoa física
 *   companyType?: string;    // 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION' — PJ
 *   postalCode?: string;
 * }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL') ?? 'https://sandbox.asaas.com/api/v3';
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
    // ── 1. Autenticar o caller usando o JWT do Supabase ──────────────────────
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
      profileId: string;
      name: string;
      email: string;
      cpfCnpj: string;
      phoneNumber?: string;
      birthDate?: string;
      companyType?: string;
      postalCode?: string;
    };

    const { profileId, name, email, cpfCnpj, phoneNumber, birthDate, companyType, postalCode } = body;

    if (!profileId || !name || !email || !cpfCnpj) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: profileId, name, email, cpfCnpj' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Idempotência: checar se já tem subconta ───────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('asaas_account_id')
      .eq('id', profileId)
      .single();

    if (profile?.asaas_account_id) {
      return new Response(JSON.stringify({ asaasAccountId: profile.asaas_account_id, alreadyExists: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Criar subconta no Asaas ───────────────────────────────────────────
    const isLegalPerson = cpfCnpj.replace(/\D/g, '').length > 11;

    const asaasPayload: Record<string, any> = {
      name,
      email,
      cpfCnpj: cpfCnpj.replace(/\D/g, ''),
      mobilePhone: phoneNumber?.replace(/\D/g, '') ?? '',
      incomeValue: 1000, // valor declarado mínimo (obrigatório pela Asaas)
      address: '',
      addressNumber: 's/n',
      province: '',
      postalCode: postalCode?.replace(/\D/g, '') ?? '78580000',
    };

    if (isLegalPerson && companyType) {
      asaasPayload.companyType = companyType;
    }
    if (!isLegalPerson && birthDate) {
      asaasPayload.birthDate = birthDate; // formato YYYY-MM-DD
    }

    const asaasRes = await fetch(`${ASAAS_BASE_URL}/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
      },
      body: JSON.stringify(asaasPayload),
    });

    const asaasData = await asaasRes.json();

    if (!asaasRes.ok || !asaasData.id) {
      console.error('[create-asaas-account] Erro Asaas:', JSON.stringify(asaasData));
      return new Response(JSON.stringify({ error: 'Falha ao criar subconta Asaas', details: asaasData }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 5. Salvar asaas_account_id no perfil ─────────────────────────────────
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ asaas_account_id: asaasData.id })
      .eq('id', profileId);

    if (updateError) {
      console.error('[create-asaas-account] Erro ao atualizar perfil:', updateError);
      // Não é fatal — o ID do Asaas foi criado; o front pode tentar salvar novamente
    }

    // Se for lojista, atualizar também na tabela restaurants
    await supabase
      .from('restaurants')
      .update({ asaas_account_id: asaasData.id })
      .eq('owner_id', profileId);

    return new Response(JSON.stringify({ asaasAccountId: asaasData.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[create-asaas-account] Erro inesperado:', err);
    return new Response(JSON.stringify({ error: err.message ?? 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
