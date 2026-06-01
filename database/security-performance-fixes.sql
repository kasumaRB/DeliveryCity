-- ============================================================
-- Security & Performance Fixes
-- Addresses all Supabase advisor warnings:
--   - Function mutable search_path
--   - SECURITY DEFINER functions callable by anon
--   - RLS policies always true (orders INSERT, products ALL)
--   - Multiple permissive policies (restaurants, profiles, support_tickets, platform_settings)
--   - Auth RLS initplan (auth.uid() → (select auth.uid()))
--   - Duplicate indexes on profiles
--   - Missing index on products(restaurant_id)
--   - upsert_profile bug: working_hours column doesn't exist on restaurants
-- ============================================================

-- ── 1. Drop duplicate indexes on profiles ────────────────────
DROP INDEX IF EXISTS public.profiles_unique_cpf;
DROP INDEX IF EXISTS public.profiles_unique_phone;

-- ── 2. Add missing index on products(restaurant_id) ──────────
CREATE INDEX IF NOT EXISTS products_restaurant_id_idx
  ON public.products (restaurant_id);

-- ── 3. Fix functions ──────────────────────────────────────────

-- 3a. delete_user_by_id — admin guard + fixed search_path
CREATE OR REPLACE FUNCTION public.delete_user_by_id(user_id_to_delete uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'ADMIN'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem excluir usuários';
  END IF;
  DELETE FROM auth.users WHERE id = user_id_to_delete;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_user_by_id(uuid) FROM anon;

-- 3b. is_admin — fixed search_path
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'ADMIN'
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;

-- 3c. increment_balance — fixed search_path
CREATE OR REPLACE FUNCTION public.increment_balance(user_id uuid, amount numeric)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.profiles SET balance = balance + amount WHERE id = user_id;
END;
$$;

-- 3d. get_auth_user_role — fixed search_path
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_catalog
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = (SELECT auth.uid());
  RETURN v_role;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_auth_user_role() FROM anon;

-- 3e. handle_new_user — revoke from non-trigger roles (trigger-only function)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- 3f. upsert_profile — auth guard + fixed restaurant INSERT (removed non-existent working_hours column) + fixed search_path
CREATE OR REPLACE FUNCTION public.upsert_profile(
  p_id uuid, p_email text, p_name text, p_business_name text,
  p_role text, p_status text, p_cpf text, p_cnpj text,
  p_birth_date text, p_phone_number text, p_pix_key text,
  p_description text, p_working_hours text, p_vehicle_type text,
  p_license_plate text, p_saved_addresses jsonb, p_is_restaurant boolean
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_catalog
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR (SELECT auth.uid()) != p_id THEN
    RAISE EXCEPTION 'Acesso negado: você só pode editar seu próprio perfil';
  END IF;

  -- Auto-confirma o email para que o login funcione imediatamente após o cadastro
  UPDATE auth.users
  SET
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    confirmed_at       = COALESCE(confirmed_at, NOW()),
    updated_at         = NOW()
  WHERE id = p_id;

  INSERT INTO public.profiles (
    id, email, name, business_name, role, status,
    cpf, cnpj, birth_date, phone_number, pix_key,
    description, working_hours, vehicle_type, license_plate,
    saved_addresses
  ) VALUES (
    p_id, p_email, p_name, p_business_name, p_role, p_status,
    p_cpf, p_cnpj, p_birth_date, p_phone_number, p_pix_key,
    p_description, p_working_hours, p_vehicle_type, p_license_plate,
    p_saved_addresses
  )
  ON CONFLICT (id) DO UPDATE SET
    email           = EXCLUDED.email,
    name            = EXCLUDED.name,
    business_name   = EXCLUDED.business_name,
    role            = EXCLUDED.role,
    status          = EXCLUDED.status,
    cpf             = EXCLUDED.cpf,
    cnpj            = EXCLUDED.cnpj,
    birth_date      = EXCLUDED.birth_date,
    phone_number    = EXCLUDED.phone_number,
    pix_key         = EXCLUDED.pix_key,
    description     = EXCLUDED.description,
    working_hours   = EXCLUDED.working_hours,
    vehicle_type    = EXCLUDED.vehicle_type,
    license_plate   = EXCLUDED.license_plate,
    saved_addresses = EXCLUDED.saved_addresses;

  IF p_is_restaurant THEN
    -- restaurants table has no working_hours column (uses opening_hours jsonb with default [])
    INSERT INTO public.restaurants (
      id, owner_id, name, description, address, menu, is_active
    ) VALUES (
      'rest-' || p_id::text,
      p_id,
      COALESCE(p_business_name, p_name),
      COALESCE(p_description, ''),
      '',
      '[]'::jsonb,
      true
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.upsert_profile(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, boolean) FROM anon;

-- ── 4. Fix RLS: restaurants — replace 8 overlapping policies with 3 ──

DROP POLICY IF EXISTS "Admin pode ler tudo" ON public.restaurants;
DROP POLICY IF EXISTS "Dono do restaurante pode editar" ON public.restaurants;
DROP POLICY IF EXISTS "Restaurantes públicos" ON public.restaurants;
DROP POLICY IF EXISTS "Restaurants: owner or admin can insert/update" ON public.restaurants;
DROP POLICY IF EXISTS "Restaurants: public read" ON public.restaurants;
DROP POLICY IF EXISTS "Usuários autenticados podem criar restaurante" ON public.restaurants;
DROP POLICY IF EXISTS restaurants_insert ON public.restaurants;
DROP POLICY IF EXISTS restaurants_insert_owner ON public.restaurants;
DROP POLICY IF EXISTS restaurants_select ON public.restaurants;
DROP POLICY IF EXISTS restaurants_select_public ON public.restaurants;
DROP POLICY IF EXISTS restaurants_update ON public.restaurants;
DROP POLICY IF EXISTS restaurants_update_owner ON public.restaurants;

CREATE POLICY restaurants_select ON public.restaurants
  FOR SELECT USING (true);

CREATE POLICY restaurants_insert ON public.restaurants
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = owner_id
  );

CREATE POLICY restaurants_update ON public.restaurants
  FOR UPDATE
  USING (
    (SELECT auth.uid()) = owner_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'ADMIN'
    )
  );

-- ── 5. Fix RLS: support_tickets — replace 5 overlapping policies with 3 ──

DROP POLICY IF EXISTS "Admin pode ler tudo" ON public.support_tickets;
DROP POLICY IF EXISTS "Criar ticket de suporte" ON public.support_tickets;
DROP POLICY IF EXISTS tickets_insert ON public.support_tickets;
DROP POLICY IF EXISTS tickets_select ON public.support_tickets;
DROP POLICY IF EXISTS tickets_update_admin ON public.support_tickets;

CREATE POLICY tickets_select ON public.support_tickets
  FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'ADMIN'
    )
  );

CREATE POLICY tickets_insert ON public.support_tickets
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  );

CREATE POLICY tickets_update_admin ON public.support_tickets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'ADMIN'
    )
  );

-- ── 6. Fix RLS: platform_settings — drop redundant SELECT ────
DROP POLICY IF EXISTS settings_select ON public.platform_settings;

-- ── 7. Fix RLS: orders — correct INSERT + (select auth.uid()) ─

DROP POLICY IF EXISTS orders_insert ON public.orders;
DROP POLICY IF EXISTS orders_select ON public.orders;
DROP POLICY IF EXISTS orders_update ON public.orders;

CREATE POLICY orders_insert ON public.orders
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = customer_id
  );

CREATE POLICY orders_select ON public.orders
  FOR SELECT
  USING (
    (SELECT auth.uid()) = customer_id
    OR (SELECT auth.uid()) = driver_id
    OR restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'ADMIN'
    )
  );

CREATE POLICY orders_update ON public.orders
  FOR UPDATE
  USING (
    (SELECT auth.uid()) = customer_id
    OR (SELECT auth.uid()) = driver_id
    OR restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'ADMIN'
    )
  );

-- ── 8. Fix RLS: profiles — consolidate UPDATE + fix INSERT ────

DROP POLICY IF EXISTS "Admin pode atualizar qualquer perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Inserir perfil próprio" ON public.profiles;

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE
  USING (
    (SELECT auth.uid()) = id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'ADMIN'
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'ADMIN'
    )
  );

-- ── 9. Fix RLS: products — public reads, owners/admins write ─

DROP POLICY IF EXISTS "Acesso Total para Autenticados" ON public.products;

CREATE POLICY products_select ON public.products
  FOR SELECT USING (true);

CREATE POLICY products_write ON public.products
  FOR ALL
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'ADMIN'
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'ADMIN'
    )
  );
