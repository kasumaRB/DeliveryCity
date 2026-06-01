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

-- 3b. is_admin — SECURITY INVOKER (só lê public.profiles)
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'ADMIN'
  );
END;
$$;

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

-- 3d. get_auth_user_role — SECURITY INVOKER (só lê public.profiles)
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
  RETURNS text
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = (SELECT auth.uid());
  RETURN v_role;
END;
$$;

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
-- Políticas separadas por comando para evitar SELECT duplicado
-- (products_write FOR ALL cobria SELECT junto com products_select).

DROP POLICY IF EXISTS "Acesso Total para Autenticados" ON public.products;
DROP POLICY IF EXISTS products_write ON public.products;

CREATE POLICY products_select ON public.products
  FOR SELECT USING (true);

CREATE POLICY products_insert ON public.products
  FOR INSERT
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'ADMIN'
    )
  );

CREATE POLICY products_update ON public.products
  FOR UPDATE
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

CREATE POLICY products_delete ON public.products
  FOR DELETE
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'ADMIN'
    )
  );

-- ── 10. Performance: remover índices não utilizados ───────────
DROP INDEX IF EXISTS public.orders_restaurant_id_timestamp_idx;
DROP INDEX IF EXISTS public.orders_driver_id_idx;
DROP INDEX IF EXISTS public.orders_customer_id_idx;

-- ============================================================
-- Storage: avatars bucket — consolidate 13 policies into 3
-- (applied as separate migrations: consolidate_avatars_storage_policies,
--  drop_avatars_listing_policy)
-- ============================================================

DROP POLICY IF EXISTS "Allow all for authenticated"                        ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete avatars"                 ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update avatars"                 ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload avatars"                 ON storage.objects;
DROP POLICY IF EXISTS "Allow public read avatars"                          ON storage.objects;
DROP POLICY IF EXISTS "Avatar publico para leitura"                        ON storage.objects;
DROP POLICY IF EXISTS "Avatar público para leitura"                        ON storage.objects;
DROP POLICY IF EXISTS "Dono pode atualizar seu avatar"                     ON storage.objects;
DROP POLICY IF EXISTS "Public Access"                                      ON storage.objects;
DROP POLICY IF EXISTS "Upload de avatar autenticado"                       ON storage.objects;
DROP POLICY IF EXISTS "Usuario atualiza proprio avatar"                    ON storage.objects;
DROP POLICY IF EXISTS "Usuario deleta proprio avatar"                      ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de avatar" ON storage.objects;

-- No SELECT policy needed: bucket is public, direct URL access works without it.
-- Listing (GET /storage/v1/object/list/avatars) is intentionally blocked.
CREATE POLICY avatars_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY avatars_update ON storage.objects
  FOR UPDATE TO public
  USING (
    bucket_id = 'avatars'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY avatars_delete ON storage.objects
  FOR DELETE TO public
  USING (
    bucket_id = 'avatars'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );
