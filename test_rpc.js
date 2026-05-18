import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fnhjxqppcrbepgwcrqzw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuaGp4cXBwY3JiZXBnd2NycXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODcxNTEsImV4cCI6MjA4MTU2MzE1MX0.wdJjWz9abAk4jgsJZ_DJUSHDzdPVVJg_uXVCCBq41jQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
  console.log('exec_sql:', error || data);
}
test();
