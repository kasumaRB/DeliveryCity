-- ============================================================
-- DELIVERYCITY — CORREÇÃO COMPLETA DO BANCO SUPABASE
-- Execute este arquivo no SQL Editor do seu projeto Supabase
-- Acesse: https://supabase.com/dashboard → seu projeto → SQL Editor
-- ============================================================


-- ============================================================
-- PARTE 1: DIAGNÓSTICO (rode primeiro para ver o estado atual)
-- ============================================================

-- 1a. Verifica se a função upsert_profile existe
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'upsert_profile';

-- 1b. Verifica RLS e políticas da tabela profiles
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'profiles';
SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'profiles';

-- 1c. Verifica colunas da tabela profiles
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;


-- ============================================================
-- PARTE 2: GARANTIR ESTRUTURA DA TABELA PROFILES
-- ============================================================

-- Cria a tabela profiles se não existir (com schema completo)
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  business_name   TEXT,
  role            TEXT NOT NULL DEFAULT 'CLIENT'
                    CHECK (role IN ('CLIENT', 'RESTAURANT', 'DRIVER', 'ADMIN')),
  status          TEXT NOT NULL DEFAULT 'APPROVED'
                    CHECK (status IN ('PENDING', 'APPROVED', 'BLOCKED')),
  cpf             TEXT DEFAULT '',
  cnpj            TEXT DEFAULT '',
  birth_date      TEXT DEFAULT '',
  phone_number    TEXT DEFAULT '',
  pix_key         TEXT DEFAULT '',
  description     TEXT DEFAULT '',
  working_hours   TEXT DEFAULT '',
  vehicle_type    TEXT DEFAULT '',
  license_plate   TEXT DEFAULT '',
  saved_addresses JSONB DEFAULT '[]'::jsonb,
  saved_cards     JSONB DEFAULT '[]'::jsonb,
  commission_balance NUMERIC DEFAULT 0,
  average_rating  NUMERIC DEFAULT 0,
  ratings_count   INTEGER DEFAULT 0,
  push_token      TEXT,
  avatar_url      TEXT,
  pagseguro_recipient_id TEXT,
  custom_fee_pct  NUMERIC,
  current_location JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Adiciona colunas que podem estar faltando (seguro rodar mesmo se já existirem)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cnpj TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_key TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS working_hours TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS license_plate TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS saved_addresses JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS saved_cards JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS commission_balance NUMERIC DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS average_rating NUMERIC DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ratings_count INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pagseguro_recipient_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_fee_pct NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_location JSONB;


-- ============================================================
-- PARTE 3: GARANTIR ESTRUTURA DA TABELA RESTAURANTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.restaurants (
  id              TEXT PRIMARY KEY,
  owner_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT '',
  category        TEXT DEFAULT 'Restaurante',
  address         TEXT DEFAULT '',
  description     TEXT DEFAULT '',
  working_hours   TEXT DEFAULT '',
  phone_number    TEXT DEFAULT '',
  image           TEXT DEFAULT '',
  rating          NUMERIC DEFAULT 0,
  ratings_count   INTEGER DEFAULT 0,
  menu            JSONB DEFAULT '[]'::jsonb,
  coords          JSONB DEFAULT '{"lat": 0, "lng": 0}'::jsonb,
  is_active       BOOLEAN DEFAULT true,
  pagseguro_recipient_id TEXT,
  promotions      JSONB DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Restaurante';
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS image TEXT DEFAULT '';
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS phone_number TEXT DEFAULT '';
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 0;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS ratings_count INTEGER DEFAULT 0;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS coords JSONB DEFAULT '{"lat": 0, "lng": 0}'::jsonb;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS pagseguro_recipient_id TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS promotions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;


-- ============================================================
-- PARTE 4: POLÍTICAS RLS (Row Level Security)
-- ============================================================

-- Habilita RLS nas tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas que possam estar conflitando
DROP POLICY IF EXISTS "profiles_select_all"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"         ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"         ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own"         ON public.profiles;
DROP POLICY IF EXISTS "profiles_public_read"        ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all"  ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for users"     ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users"     ON public.profiles;

-- POLÍTICA 1: Qualquer usuário autenticado pode LER todos os perfis
-- (necessário para o app carregar restaurantes, entregadores, etc.)
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- POLÍTICA 2: Usuário autenticado pode INSERIR apenas o próprio perfil
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- POLÍTICA 3: Usuário autenticado pode ATUALIZAR apenas o próprio perfil
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- POLÍTICA 4: Usuário autenticado pode DELETAR apenas o próprio perfil
CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Políticas para restaurants
DROP POLICY IF EXISTS "restaurants_select_all"  ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_insert_own"  ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_update_own"  ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_delete_own"  ON public.restaurants;

CREATE POLICY "restaurants_select_all"
  ON public.restaurants FOR SELECT
  TO authenticated
  USING (true);

-- Leitura pública de restaurantes (para usuários não logados verem o cardápio)
CREATE POLICY "restaurants_select_public"
  ON public.restaurants FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "restaurants_insert_own"
  ON public.restaurants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "restaurants_update_own"
  ON public.restaurants FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "restaurants_delete_own"
  ON public.restaurants FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);


-- ============================================================
-- PARTE 5: FUNÇÃO RPC upsert_profile (SECURITY DEFINER)
-- Bypassa o RLS para criar perfis durante o cadastro
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_profile(
  p_id              UUID,
  p_email           TEXT,
  p_name            TEXT,
  p_business_name   TEXT DEFAULT NULL,
  p_role            TEXT DEFAULT 'CLIENT',
  p_status          TEXT DEFAULT 'APPROVED',
  p_cpf             TEXT DEFAULT '',
  p_cnpj            TEXT DEFAULT '',
  p_birth_date      TEXT DEFAULT '',
  p_phone_number    TEXT DEFAULT '',
  p_pix_key         TEXT DEFAULT '',
  p_description     TEXT DEFAULT '',
  p_working_hours   TEXT DEFAULT '',
  p_vehicle_type    TEXT DEFAULT '',
  p_license_plate   TEXT DEFAULT '',
  p_saved_addresses JSONB DEFAULT '[]'::jsonb,
  p_is_restaurant   BOOLEAN DEFAULT FALSE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- roda como superuser, bypassa RLS
SET search_path = public
AS $$
BEGIN
  -- Insere ou atualiza o perfil
  INSERT INTO public.profiles (
    id, email, name, business_name, role, status,
    cpf, cnpj, birth_date, phone_number, pix_key,
    description, working_hours, vehicle_type, license_plate,
    saved_addresses, created_at
  ) VALUES (
    p_id, p_email, p_name, p_business_name, p_role, p_status,
    p_cpf, p_cnpj, p_birth_date, p_phone_number, p_pix_key,
    p_description, p_working_hours, p_vehicle_type, p_license_plate,
    p_saved_addresses, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email          = EXCLUDED.email,
    name           = EXCLUDED.name,
    business_name  = EXCLUDED.business_name,
    role           = EXCLUDED.role,
    status         = EXCLUDED.status,
    cpf            = EXCLUDED.cpf,
    cnpj           = EXCLUDED.cnpj,
    birth_date     = EXCLUDED.birth_date,
    phone_number   = EXCLUDED.phone_number,
    pix_key        = EXCLUDED.pix_key,
    description    = EXCLUDED.description,
    working_hours  = EXCLUDED.working_hours,
    vehicle_type   = EXCLUDED.vehicle_type,
    license_plate  = EXCLUDED.license_plate,
    saved_addresses = EXCLUDED.saved_addresses;

  -- Se for restaurante, cria também o registro na tabela restaurants
  IF p_is_restaurant THEN
    INSERT INTO public.restaurants (
      id, owner_id, name, description, working_hours, address, menu, is_active, created_at
    ) VALUES (
      'rest-' || p_id::text,
      p_id,
      COALESCE(p_business_name, p_name),
      COALESCE(p_description, ''),
      COALESCE(p_working_hours, ''),
      '',
      '[]'::jsonb,
      true,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;  -- não sobrescreve restaurante já existente
  END IF;
END;
$$;

-- Garante que qualquer usuário autenticado pode chamar a função
GRANT EXECUTE ON FUNCTION public.upsert_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_profile TO anon;


-- ============================================================
-- PARTE 6: TRIGGER — cria perfil automaticamente após signUp
-- Garante que mesmo sem chamar registerProfile, o perfil existe
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, status, saved_addresses)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'CLIENT',
    'APPROVED',
    '[]'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;  -- não sobrescreve se já existir
  RETURN NEW;
END;
$$;

-- Remove trigger antigo e recria
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- PARTE 7: CONSERTAR PERFIS DE USUÁRIOS EXISTENTES SEM PERFIL
-- (para usuários que já se cadastraram mas ficaram sem perfil)
-- ============================================================

INSERT INTO public.profiles (id, email, name, role, status, saved_addresses)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  'CLIENT',
  'APPROVED',
  '[]'::jsonb
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
  AND au.email IS NOT NULL;


-- ============================================================
-- PARTE 8: DESABILITAR CONFIRMAÇÃO DE E-MAIL (opcional)
-- Se quiser que parceiros entrem sem precisar confirmar e-mail
-- Faça isso no Dashboard: Authentication → Settings →
-- "Enable email confirmations" → desmarcar
-- (não é possível via SQL, precisa ser no dashboard)
-- ============================================================


-- ============================================================
-- PARTE 9: VERIFICAÇÃO FINAL — confira os resultados
-- ============================================================

-- Ver todos os usuários e seus perfis (para checar quem está com problema)
SELECT
  au.email,
  au.email_confirmed_at IS NOT NULL AS email_confirmado,
  au.created_at AS criado_em,
  p.role,
  p.status,
  p.name,
  CASE WHEN p.id IS NULL THEN '❌ SEM PERFIL' ELSE '✅ OK' END AS situacao
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
ORDER BY au.created_at DESC;
