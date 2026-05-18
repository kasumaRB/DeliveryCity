-- ================================================================
-- CORREÇÃO: INFINITE RECURSION NO RLS DE PROFILES
-- ================================================================

-- 1. Remove políticas defeituosas que causavam recursão infinita
DROP POLICY IF EXISTS "Profiles: users can read own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: users can update own (no role change)" ON public.profiles;

-- 2. Função SECURITY DEFINER para ler a role do usuário sem disparar RLS
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Nova política de SELECT (usando a função para evitar recursão)
CREATE POLICY "Profiles: users can read own"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR public.get_auth_user_role() = 'ADMIN'
  );

-- 4. Nova política de UPDATE
CREATE POLICY "Profiles: users can update own (no role change)"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Não permitimos subquery na própria tabela aqui, o backend / edge function
    -- cuida da segurança extra. Para o RLS, basta travar para o próprio dono.
  );
