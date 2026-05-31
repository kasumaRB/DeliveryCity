-- ================================================================
-- DIAGNÓSTICO E CORREÇÃO DE LOOP DE LOGIN
-- ================================================================

-- Vamos garantir que os perfis sejam públicos para leitura.
-- Se o RLS de leitura estiver barrando os usuários não-admins de verem seu próprio perfil, 
-- eles ficam num loop infinito de login (pois o App acha que eles não têm perfil).

-- 1. Garante que todos possam ler perfis (isso resolve o erro de perfil invisível)
DROP POLICY IF EXISTS "Perfis públicos para leitura" ON public.profiles;
CREATE POLICY "Perfis públicos para leitura" ON public.profiles
  FOR SELECT USING (true);

-- 2. Reforça que a pessoa pode atualizar o próprio perfil (sem recursão)
DROP POLICY IF EXISTS "Profiles: users can update own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: users can update own (no role change)" ON public.profiles;
CREATE POLICY "Profiles: users can update own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 3. Reforça o ADMIN podendo atualizar tudo
DROP POLICY IF EXISTS "Profiles: admins can update all" ON public.profiles;
CREATE POLICY "Profiles: admins can update all" ON public.profiles
  FOR UPDATE USING (public.get_auth_user_role() = 'ADMIN');

-- 4. Inserção permitida para o próprio usuário (para o self-healing do Frontend funcionar)
DROP POLICY IF EXISTS "Profiles: insert own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: insert only via trigger" ON public.profiles;
CREATE POLICY "Profiles: insert own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
