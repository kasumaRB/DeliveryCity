import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

console.log(`Function "create-pagseguro-payment" up and running!`);

serve(async (req) => {
  // This is needed if you're deploying functions locally
  // and your browser makes a OPTIONS request.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Objeto recebido do seu app
    const { items, customer, charge } = await req.json();

    // Token do PagSeguro (guarde como uma variavel de ambiente no Supabase)
    const PAGSEGURO_TOKEN = Deno.env.get('PAGSEGURO_SANDBOX_TOKEN');
    // URL do ambiente de Sandbox do PagSeguro
    const PAGSEGURO_API_URL = 'https://sandbox.api.pagseguro.com/orders';

    // Monte o corpo da requisição para a API do PagSeguro
    const orderPayload = {
      customer,
      items,
      charges: [ charge ], // O split fica dentro do objeto de cobrança
      notification_urls: [], // Adicione URLs de notificação se precisar
    };

    const response = await fetch(PAGSEGURO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PAGSEGURO_TOKEN}`
      },
      body: JSON.stringify(orderPayload)
    });

    const data = await response.json();

    if (!response.ok) {
        // Retorna os detalhes do erro do PagSeguro para o app
        // para que você possa debugar ou mostrar uma mensagem ao usuário
        console.error('PagSeguro API Error:', data);
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: response.status,
        });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Internal Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
