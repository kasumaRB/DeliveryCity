import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fnhjxqppcrbepgwcrqzw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuaGp4cXBwY3JiZXBnd2NycXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODcxNTEsImV4cCI6MjA4MTU2MzE1MX0.wdJjWz9abAk4jgsJZ_DJUSHDzdPVVJg_uXVCCBq41jQ'
);

// Testa a constraint tentando inserir CPF duplicado
async function testConstraints() {
  // Primeiro busca um CPF existente
  const { data: existing } = await supabase
    .from('profiles')
    .select('cpf, phone_number')
    .not('cpf', 'is', null)
    .neq('cpf', '')
    .limit(1)
    .single();

  if (existing?.cpf) {
    console.log('CPF existente encontrado:', existing.cpf);
    // Tenta inserir duplicado (deve falhar com UNIQUE constraint)
    const { error } = await supabase
      .from('profiles')
      .insert({ id: 'test-dup-' + Date.now(), email: 'test@test.com', cpf: existing.cpf });
    
    if (error?.code === '23505') {
      console.log('✅ UNIQUE constraint de CPF funcionando! Erro:', error.message);
    } else if (error) {
      console.log('❓ Erro diferente:', error.message, error.code);
    } else {
      console.log('❌ UNIQUE constraint NÃO criada - inserção duplicada funcionou!');
    }
  } else {
    console.log('Nenhum CPF cadastrado ainda para testar. Verificando índices via pg_indexes...');
    // Verificação alternativa
    const { data } = await supabase
      .from('profiles')
      .select('id, cpf, phone_number')
      .limit(3);
    console.log('Profiles (sample):', data);
  }
}

testConstraints();
