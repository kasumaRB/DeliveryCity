-- ================================================================
-- DeliveryCity — FIX COMPLETO: Login do Parceiro Entregador
-- Execute este script no SQL Editor do Supabase
-- ================================================================
-- PROBLEMAS CORRIGIDOS:
--   1. Conflito de políticas RLS na tabela profiles
--   2. Função upsert_profile com nomes de colunas errados (camelCase)
--   3. Trigger inválida tentando passar argumentos incorretamente
--   4. Entregadores presos em status PENDING sem conseguir logar
-- ================================================================


-- ================================================================
-- PASSO 1: LIMPAR TODAS AS POLÍTICAS CONFLITANTES DE PROFILES
-- ================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
END $$;


-- ================================================================
-- PASSO 2: CRIAR POLÍTICAS RLS CORRETAS PARA PROFILES
-- Permite leitura pública (necessário para o App funcionar),
-- edição apenas do próprio perfil, e admin pode editar todos.
-- ================================================================
CREATE POLICY "Perfis públicos para leitura" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Usuários podem atualizar próprio perfil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Inserir perfil próprio" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin pode atualizar status de qualquer usuário
CREATE POLICY "Admin pode atualizar qualquer perfil" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );


-- ================================================================
-- PASSO 3: RECRIAR FUNÇÃO upsert_profile COM NOMES CORRETOS
-- O banco usa snake_case. Versões anteriores usavam camelCase
-- (businessName, phoneNumber, etc.) e falhavam silenciosamente.
-- ================================================================
DROP FUNCTION IF EXISTS public.upsert_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN);
DROP FUNCTION IF EXISTS public.upsert_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.upsert_profile(
  p_id              UUID,
  p_email           TEXT,
  p_name            TEXT,
  p_business_name   TEXT,
  p_role            TEXT,
  p_status          TEXT,
  p_cpf             TEXT,
  p_cnpj            TEXT,
  p_birth_date      TEXT,
  p_phone_number    TEXT,
  p_pix_key         TEXT,
  p_description     TEXT,
  p_working_hours   TEXT,
  p_vehicle_type    TEXT,
  p_license_plate   TEXT,
  p_saved_addresses JSONB,
  p_is_restaurant   BOOLEAN,
  p_avatar_url      TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Upsert no perfil usando nomes de coluna snake_case corretos
  INSERT INTO public.profiles (
    id,
    email,
    name,
    business_name,
    role,
    status,
    cpf,
    cnpj,
    birth_date,
    phone_number,
    pix_key,
    description,
    working_hours,
    vehicle_type,
    license_plate,
    saved_addresses,
    avatar_url
  )
  VALUES (
    p_id,
    p_email,
    p_name,
    p_business_name,
    p_role,
    p_status,
    p_cpf,
    p_cnpj,
    p_birth_date,
    p_phone_number,
    p_pix_key,
    p_description,
    p_working_hours,
    p_vehicle_type,
    p_license_plate,
    COALESCE(p_saved_addresses, '[]'::jsonb),
    p_avatar_url
  )
  ON CONFLICT (id) DO UPDATE SET
    email         = EXCLUDED.email,
    name          = EXCLUDED.name,
    business_name = EXCLUDED.business_name,
    role          = EXCLUDED.role,
    status        = EXCLUDED.status,
    cpf           = EXCLUDED.cpf,
    cnpj          = EXCLUDED.cnpj,
    birth_date    = EXCLUDED.birth_date,
    phone_number  = EXCLUDED.phone_number,
    pix_key       = EXCLUDED.pix_key,
    description   = EXCLUDED.description,
    working_hours = EXCLUDED.working_hours,
    vehicle_type  = EXCLUDED.vehicle_type,
    license_plate = EXCLUDED.license_plate,
    saved_addresses = EXCLUDED.saved_addresses,
    avatar_url    = EXCLUDED.avatar_url;

  -- Se for lojista, cria/atualiza o restaurante automaticamente
  IF p_is_restaurant AND p_role = 'RESTAURANT' THEN
    INSERT INTO public.restaurants (
      id, owner_id, name, category, rating, image, menu, is_open, coords, created_at
    )
    VALUES (
      'rest-' || p_id,
      p_id,
      COALESCE(NULLIF(p_business_name, ''), p_name),
      'Geral',
      5.0,
      '',
      '[]'::jsonb,
      true,
      '{"lat": 0, "lng": 0}'::jsonb,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = COALESCE(NULLIF(p_business_name, ''), p_name);
  END IF;
END;
$$;

-- Garante permissões corretas na função
REVOKE EXECUTE ON FUNCTION public.upsert_profile FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_profile TO service_role;


-- ================================================================
-- PASSO 4: RECRIAR TRIGGER DE CRIAÇÃO DE PERFIL (CORRETA)
-- A trigger NÃO pode chamar upsert_profile diretamente com argumentos.
-- Ela chama uma função handle_new_user separada.
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    name,
    role,
    status,
    saved_addresses
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    'CLIENT',    -- sempre começa como CLIENT; o app atualiza depois
    'APPROVED',  -- clientes são aprovados imediatamente
    '[]'::jsonb
  )
  ON CONFLICT (id) DO NOTHING; -- seguro: não sobrescreve perfil existente
  RETURN NEW;
END;
$$;

-- Remove triggers conflitantes e cria a correta
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_new_user ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ================================================================
-- PASSO 5: CRIAR FUNÇÃO AUXILIAR get_auth_user_role
-- Referenciada em fix_login_loop.sql mas pode não existir.
-- ================================================================
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();
  RETURN v_role;
END;
$$;


-- ================================================================
-- PASSO 6: BACKFILL — garante que todo auth.user tem um perfil
-- Corrige usuários que ficaram sem perfil por falha de trigger.
-- ================================================================
INSERT INTO public.profiles (id, email, name, role, status, saved_addresses)
SELECT
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'name',
    split_part(au.email, '@', 1)
  ),
  'CLIENT',
  'APPROVED',
  '[]'::jsonb
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;


-- ================================================================
-- PASSO 7: VERIFICAÇÃO E DIAGNÓSTICO
-- Mostra o estado atual de todos os usuários para ajudar a
-- identificar entregadores presos em PENDING.
-- ================================================================

-- 7a. Resumo por role e status
SELECT
  role,
  status,
  COUNT(*) AS total
FROM public.profiles
GROUP BY role, status
ORDER BY role, status;

-- 7b. Lista todos os entregadores (DRIVER) e seu status atual
SELECT
  p.id,
  p.name,
  p.email,
  p.role,
  p.status,
  p.phone_number,
  p.vehicle_type,
  p.cpf,
  au.created_at AS registered_at,
  au.email_confirmed_at
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.id
WHERE p.role = 'DRIVER'
ORDER BY au.created_at DESC;

-- 7c. Usuários auth.users sem perfil correspondente (deve ser 0)
SELECT
  au.id,
  au.email,
  au.created_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;


-- ================================================================
-- PASSO 8 (OPCIONAL): APROVAR ENTREGADORES PENDENTES
-- DESCOMENTE e substitua o email para aprovar um entregador específico:
-- ================================================================
-- UPDATE public.profiles
-- SET status = 'APPROVED'
-- WHERE role = 'DRIVER'
--   AND status = 'PENDING'
--   AND email = 'email-do-entregador@exemplo.com';

-- Para APROVAR TODOS os entregadores pendentes de uma vez:
-- UPDATE public.profiles
-- SET status = 'APPROVED'
-- WHERE role = 'DRIVER' AND status = 'PENDING';


-- ================================================================
-- PASSO 9: VERIFICAR POLÍTICAS RLS ATIVAS
-- ================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
ORDER BY policyname;
