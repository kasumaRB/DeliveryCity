import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

console.log(`Function "create-pagseguro-payment" up and running! [SANDBOX MODE]`);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { items, customer, charge } = await req.json();

    // Token do PagSeguro (variável de ambiente configurada no Supabase)
    const PAGSEGURO_TOKEN = Deno.env.get('PAGSEGURO_SANDBOX_TOKEN');
    if (!PAGSEGURO_TOKEN) {
      throw new Error('PAGSEGURO_SANDBOX_TOKEN não configurado no Supabase');
    }

    // URL do ambiente de Sandbox do PagSeguro Connect
    const PAGSEGURO_API_URL = 'https://sandbox.api.pagseguro.com/orders';

    // Monta o pedido com split embutido na cobrança
    const orderPayload = {
      customer,
      items,
      charges: [charge],
      notification_urls: [],
    };

    console.log('Enviando para PagSeguro Sandbox:', JSON.stringify(orderPayload, null, 2));

    const response = await fetch(PAGSEGURO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PAGSEGURO_TOKEN}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await response.json();
    console.log('Resposta PagSeguro:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('Erro PagSeguro:', data);
      return new Response(JSON.stringify({
        error: data?.error_messages?.[0]?.description || 'Erro no processamento do pagamento',
        details: data,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status,
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro interno na function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
