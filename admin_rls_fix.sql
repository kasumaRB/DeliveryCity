-- ================================================================
-- CORREÇÃO RLS: Permitir que o ADMIN aprove e edite perfis
-- ================================================================

-- Cria a política para permitir que Admins editem (aprovem/bloqueiem) qualquer perfil
DROP POLICY IF EXISTS "Profiles: admins can update all" ON public.profiles;
CREATE POLICY "Profiles: admins can update all"
  ON public.profiles FOR UPDATE
  USING (
    public.get_auth_user_role() = 'ADMIN'
  )
  WITH CHECK (
    public.get_auth_user_role() = 'ADMIN'
  );

-- Cria a política para permitir que Admins deletem perfis (opcional, mas bom ter)
DROP POLICY IF EXISTS "Profiles: admins can delete all" ON public.profiles;
CREATE POLICY "Profiles: admins can delete all"
  ON public.profiles FOR DELETE
  USING (
    public.get_auth_user_role() = 'ADMIN'
  );

-- Permitir que restaurantes também editem seus PRÓPRIOS restaurantes sem problemas
DROP POLICY IF EXISTS "Restaurants: owner or admin can insert/update" ON public.restaurants;
CREATE POLICY "Restaurants: owner or admin can insert/update"
  ON public.restaurants FOR ALL
  USING (
    auth.uid() = owner_id
    OR public.get_auth_user_role() = 'ADMIN'
  );
