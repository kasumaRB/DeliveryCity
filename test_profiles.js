import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fnhjxqppcrbepgwcrqzw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuaGp4cXBwY3JiZXBnd2NycXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODcxNTEsImV4cCI6MjA4MTU2MzE1MX0.wdJjWz9abAk4jgsJZ_DJUSHDzdPVVJg_uXVCCBq41jQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase.from('profiles').select('saved_cards').limit(1);
  if (error) {
    console.log('❌ Coluna saved_cards NÃO existe:', error.message);
  } else {
    console.log('✅ Coluna saved_cards EXISTE. Valor:', JSON.stringify(data));
  }
}
checkColumns();

supabase.from('profiles').select('*').then(res => console.log('Anon profiles:', res.data?.length, res.error));
