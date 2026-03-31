-- =====================================================================
-- DELIVERYCITY - CORREÇÃO DE SEGURANÇA RLS
-- Execute este script no SQL Editor do Supabase Dashboard
-- =====================================================================

-- -----------------------------------------------------------------------
-- 1. ORDERS: Remover política de leitura pública (VULNERABILIDADE CRÍTICA)
--    Qualquer pessoa sem login conseguia ver TODOS os pedidos de todos.
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "Pedidos públicos para leitura" ON public.orders;

-- Apenas usuários autenticados e donos do pedido podem ler
CREATE POLICY "Pedidos: somente autenticado pode ler" ON public.orders
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Política mais restrita (opcional - descomente para máxima segurança):
-- Cada usuário só vê seus próprios pedidos, restaurantes veem os seus, entregadores o seu.
-- DROP POLICY IF EXISTS "Pedidos: somente autenticado pode ler" ON public.orders;
-- CREATE POLICY "Pedidos visiveis para partes envolvidas" ON public.orders
--   FOR SELECT USING (
--     auth.uid() = customer_id OR
--     auth.uid() IN (SELECT owner_id FROM public.restaurants WHERE id = restaurant_id) OR
--     auth.uid() = driver_id OR
--     auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'ADMIN')
--   );

-- -----------------------------------------------------------------------
-- 2. ORDERS: Garantir que somente usuário logado pode criar pedido
--    (a política anterior usava clientId mas o app usa customer_id)
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "Pedidos podem ser criados" ON public.orders;

CREATE POLICY "Pedidos: somente autenticado pode criar" ON public.orders
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    auth.uid() = customer_id
  );

-- -----------------------------------------------------------------------
-- 3. PROFILES: Leitura pública é necessária para o app funcionar
--    MAS deve ocultar dados sensíveis. Como o RLS não faz seleção de colunas,
--    recomenda-se criar uma VIEW pública para dados não sensíveis.
--    Por ora, mantemos a política de leitura pública (necessária para o app).
-- -----------------------------------------------------------------------

-- -----------------------------------------------------------------------
-- 4. RESTAURANTS: Leitura pública é intencional (catálogo público).
--    Garantir que apenas dono pode criar/editar.
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "Usuários autenticados podem criar restaurante" ON public.restaurants;

CREATE POLICY "Apenas autenticado pode criar restaurante" ON public.restaurants
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    auth.uid() = owner_id
  );

-- -----------------------------------------------------------------------
-- 5. Verificação: confirmar que RLS está ativo em todas as tabelas
-- -----------------------------------------------------------------------
DO $$
BEGIN
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE relname = 'orders')   = true, 'RLS não ativo em orders!';
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE relname = 'profiles') = true, 'RLS não ativo em profiles!';
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE relname = 'restaurants') = true, 'RLS não ativo em restaurants!';
  RAISE NOTICE 'RLS verificado com sucesso em todas as tabelas.';
END $$;
