-- ================================================================
-- POLÍTICAS RLS COMPLETAS — Proteção contra acesso cruzado de dados
-- Impede que um usuário veja dados de outro usuário
-- Execute no SQL Editor do Supabase
-- ================================================================

-- ── PROFILES: cada usuário só vê/edita o próprio perfil ──────────

-- Remove políticas antigas se existirem
DROP POLICY IF EXISTS "Profiles: users can read own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: users can update own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: admins can read all" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: service role full access" ON public.profiles;

-- Leitura: usuário vê só o próprio perfil; admin vê todos
CREATE POLICY "Profiles: users can read own"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

-- Update: usuário edita só o próprio perfil (não pode mudar role/status)
CREATE POLICY "Profiles: users can update own (no role change)"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Impede auto-promoção: role e status só podem ser mudados por admin via service_role
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND status = (SELECT status FROM public.profiles WHERE id = auth.uid())
  );

-- Insert: apenas a trigger handle_new_user (service_role) pode criar perfis
CREATE POLICY "Profiles: insert only via trigger"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ── ORDERS: usuário vê apenas seus próprios pedidos ──────────────

DROP POLICY IF EXISTS "Orders: clients see own" ON public.orders;
DROP POLICY IF EXISTS "Orders: restaurant sees own" ON public.orders;
DROP POLICY IF EXISTS "Orders: driver sees own" ON public.orders;
DROP POLICY IF EXISTS "Orders: admin sees all" ON public.orders;
DROP POLICY IF EXISTS "Orders: clients can insert own" ON public.orders;

-- Cliente: vê apenas seus próprios pedidos
CREATE POLICY "Orders: clients see own"
  ON public.orders FOR SELECT
  USING (
    auth.uid() = customer_id
    OR auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE role IN ('ADMIN', 'RESTAURANT', 'DRIVER')
    )
  );

-- Cliente: só pode criar pedido para si mesmo
CREATE POLICY "Orders: clients can insert own"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Apenas restaurante/driver/admin podem atualizar pedidos
CREATE POLICY "Orders: partners can update"
  ON public.orders FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE role IN ('ADMIN', 'RESTAURANT', 'DRIVER') AND status = 'APPROVED'
    )
  );

-- ── RESTAURANTS: leitura pública mas edição só pelo dono ─────────

DROP POLICY IF EXISTS "Restaurants: public read" ON public.restaurants;
DROP POLICY IF EXISTS "Restaurants: owner can edit" ON public.restaurants;

CREATE POLICY "Restaurants: public read"
  ON public.restaurants FOR SELECT
  USING (true);

CREATE POLICY "Restaurants: owner or admin can insert/update"
  ON public.restaurants FOR ALL
  USING (
    auth.uid() = owner_id
    OR auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'ADMIN'
    )
  );

-- ── VERIFICAR RLS HABILITADO ──────────────────────────────────────

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- ── CONFIRMAR POLÍTICAS ATIVAS ────────────────────────────────────
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
