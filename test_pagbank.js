import { createClient } from '@supabase/supabase-js';

const PAGBANK_SANDBOX_TOKEN = '97fb26b5-b258-4812-b911-779b043c934e111e6d9c4c1d8665196dac8fe4c6ab4!';

// PagBank usa sandbox.pagseguro.uol.com.br para o ambiente de testes
async function getPublicKey() {
  const endpoints = [
    'https://sandbox.pagseguro.uol.com.br/checkout/v3/public-keys',
    'https://api.pagseguro.com/public-keys',
    'https://api.sandbox.pagseguro.com/public-keys',
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAGBANK_SANDBOX_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'card' })
      });
      const text = await res.text();
      console.log(`[${url}] Status: ${res.status}`);
      console.log('Response:', text.slice(0, 500));
    } catch (e: any) {
      console.log(`[${url}] Error: ${e.message}`);
    }
  }
}

getPublicKey();
