-- =======================================================================
-- DeliveryCity — Script de Segurança para Produção (Supabase)
-- Execute este script no SQL Editor do seu projeto Supabase
-- =======================================================================

-- -----------------------------------------------------------------------
-- 1. DESATIVAR ACESSO ANÔNIMO A DADOS SENSÍVEIS
-- -----------------------------------------------------------------------

-- Garante que usuários não autenticados NÃO vejam dados de perfis
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Remove qualquer política permissiva existente
DROP POLICY IF EXISTS "Allow all" ON profiles;
DROP POLICY IF EXISTS "Public profiles" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;

-- Perfil: cada usuário só vê e edita o próprio perfil
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins podem ver todos os perfis
CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

-- Admins podem atualizar status de qualquer perfil
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

-- -----------------------------------------------------------------------
-- 2. PEDIDOS — ACESSO POR ROLE
-- -----------------------------------------------------------------------

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all orders" ON orders;
DROP POLICY IF EXISTS "Enable read access for all users" ON orders;

-- Cliente só vê os próprios pedidos
CREATE POLICY "orders_select_customer" ON orders
  FOR SELECT USING (customer_id = auth.uid());

-- Restaurante vê pedidos do seu restaurante
CREATE POLICY "orders_select_restaurant" ON orders
  FOR SELECT USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Entregadores veem pedidos disponíveis (READY sem driver) ou os seus
CREATE POLICY "orders_select_driver" ON orders
  FOR SELECT USING (
    driver_id = auth.uid()
    OR (status = 'READY' AND driver_id IS NULL)
  );

-- Admin vê todos
CREATE POLICY "orders_select_admin" ON orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Somente o cliente pode criar pedidos para si mesmo
CREATE POLICY "orders_insert_customer" ON orders
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- Atualização de status: restaurante, driver e admin podem atualizar
CREATE POLICY "orders_update_authorized" ON orders
  FOR UPDATE USING (
    customer_id = auth.uid()
    OR driver_id = auth.uid()
    OR restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- -----------------------------------------------------------------------
-- 3. RESTAURANTES — ACESSO POR ROLE
-- -----------------------------------------------------------------------

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all restaurants" ON restaurants;
DROP POLICY IF EXISTS "Enable read access for all users" ON restaurants;

-- Qualquer usuário autenticado pode VER restaurantes
CREATE POLICY "restaurants_select_authenticated" ON restaurants
  FOR SELECT USING (auth.role() = 'authenticated');

-- Dono pode criar e editar o próprio restaurante
CREATE POLICY "restaurants_insert_owner" ON restaurants
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "restaurants_update_owner" ON restaurants
  FOR UPDATE USING (owner_id = auth.uid());

-- Admin pode editar qualquer restaurante
CREATE POLICY "restaurants_update_admin" ON restaurants
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- -----------------------------------------------------------------------
-- 4. SUPPORT TICKETS — ACESSO POR ROLE
-- -----------------------------------------------------------------------

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all tickets" ON support_tickets;

-- Usuário vê só seus próprios tickets
CREATE POLICY "tickets_select_own" ON support_tickets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "tickets_insert_own" ON support_tickets
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admin vê e atualiza todos os tickets
CREATE POLICY "tickets_select_admin" ON support_tickets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "tickets_update_admin" ON support_tickets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- -----------------------------------------------------------------------
-- 5. REVOGAR PERMISSÕES DO ROLE ANON (usuários não autenticados)
-- -----------------------------------------------------------------------

REVOKE SELECT, INSERT, UPDATE, DELETE ON profiles FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON orders FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON restaurants FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON support_tickets FROM anon;

-- Garante que apenas authenticated pode usar as tabelas principais
GRANT SELECT ON restaurants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON orders TO authenticated;
GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT SELECT, INSERT ON support_tickets TO authenticated;

-- -----------------------------------------------------------------------
-- 6. PROTEÇÃO DA FUNÇÃO upsert_profile
-- -----------------------------------------------------------------------

-- A função já usa SECURITY DEFINER — garantir que está restrita
REVOKE EXECUTE ON FUNCTION upsert_profile FROM anon;
GRANT EXECUTE ON FUNCTION upsert_profile TO authenticated;

-- -----------------------------------------------------------------------
-- 7. VERIFICAÇÃO FINAL
-- -----------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'orders', 'restaurants', 'support_tickets');
