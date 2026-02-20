
import { createClient } from '@supabase/supabase-js';

// 1. As chaves agora são lidas de variáveis de ambiente seguras.
const PROJECT_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// 2. Verificação de segurança para garantir que as chaves foram configuradas.
if (!PROJECT_URL || !ANON_KEY) {
  throw new Error('Supabase URL ou Anon Key não configuradas. Verifique seu arquivo .env.local');
}

// 3. O cliente Supabase é criado com as chaves seguras.
export const supabase = createClient(PROJECT_URL, ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
