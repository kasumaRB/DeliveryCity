-- =====================================================
-- DELIVERYCITY - FIX ALL SUPABASE STRUCTURES
-- Execute no SQL Editor do Supabase Dashboard
-- =====================================================

-- =====================================================
-- 1. TABELA: support_tickets (criar se não existir)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  user_role TEXT,
  message TEXT,
  status TEXT DEFAULT 'OPEN',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. HABILITAR RLS EM TODAS AS TABELAS
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. POLICIES - PROFILES
-- =====================================================
DROP POLICY IF EXISTS "Allow read profiles" ON public.profiles;
CREATE POLICY "Allow read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow update own profile" ON public.profiles;
CREATE POLICY "Allow update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow insert profiles" ON public.profiles;
CREATE POLICY "Allow insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (true);

-- =====================================================
-- 4. POLICIES - RESTAURANTS
-- =====================================================
DROP POLICY IF EXISTS "Allow read restaurants" ON public.restaurants;
CREATE POLICY "Allow read restaurants" ON public.restaurants
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow update own restaurant" ON public.restaurants;
CREATE POLICY "Allow update own restaurant" ON public.restaurants
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Allow insert restaurants" ON public.restaurants;
CREATE POLICY "Allow insert restaurants" ON public.restaurants
  FOR INSERT TO authenticated WITH CHECK (true);

-- =====================================================
-- 5. POLICIES - ORDERS
-- =====================================================
DROP POLICY IF EXISTS "Allow read orders" ON public.orders;
CREATE POLICY "Allow read orders" ON public.orders
  FOR SELECT TO authenticated USING (
    customer_id = auth.uid() OR
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()) OR
    driver_id = auth.uid()
  );

DROP POLICY IF EXISTS "Allow insert orders" ON public.orders;
CREATE POLICY "Allow insert orders" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update orders" ON public.orders;
CREATE POLICY "Allow update orders" ON public.orders
  FOR UPDATE TO authenticated USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()) OR
    driver_id = auth.uid() OR
    customer_id = auth.uid()
  );

-- =====================================================
-- 6. POLICIES - SUPPORT_TICKETS
-- =====================================================
DROP POLICY IF EXISTS "Allow insert support_tickets" ON public.support_tickets;
CREATE POLICY "Allow insert support_tickets" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read support_tickets" ON public.support_tickets;
CREATE POLICY "Allow read support_tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow delete support_tickets" ON public.support_tickets;
CREATE POLICY "Allow delete support_tickets" ON public.support_tickets
  FOR DELETE TO authenticated USING (true);

-- =====================================================
-- 7. FUNÇÃO RPC: upsert_profile (com parâmetros explícitos)
-- =====================================================
CREATE OR REPLACE FUNCTION public.upsert_profile(
  p_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_business_name TEXT,
  p_role TEXT,
  p_status TEXT,
  p_cpf TEXT,
  p_cnpj TEXT,
  p_birth_date TEXT,
  p_phone_number TEXT,
  p_pix_key TEXT,
  p_description TEXT,
  p_working_hours TEXT,
  p_vehicle_type TEXT,
  p_license_plate TEXT,
  p_saved_addresses JSONB,
  p_is_restaurant BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, name, business_name, role, status,
    cpf, cnpj, birth_date, phone_number, pix_key,
    description, working_hours, vehicle_type, license_plate, saved_addresses
  )
  VALUES (
    p_id, p_email, p_name, p_business_name, p_role, p_status,
    p_cpf, p_cnpj, p_birth_date, p_phone_number, p_pix_key,
    p_description, p_working_hours, p_vehicle_type, p_license_plate, p_saved_addresses
  )
  ON CONFLICT (id) DO UPDATE SET
    email = p_email,
    name = p_name,
    business_name = p_business_name,
    role = p_role,
    status = p_status,
    cpf = p_cpf,
    cnpj = p_cnpj,
    birth_date = p_birth_date,
    phone_number = p_phone_number,
    pix_key = p_pix_key,
    description = p_description,
    working_hours = p_working_hours,
    vehicle_type = p_vehicle_type,
    license_plate = p_license_plate,
    saved_addresses = p_saved_addresses;

  IF p_is_restaurant AND p_role = 'RESTAURANT' THEN
    INSERT INTO public.restaurants (id, owner_id, name, category, rating, image, menu, is_active, created_at)
    VALUES (
      'rest-' || p_id::text,
      p_id,
      p_business_name,
      'Geral',
      0,
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
      '[]',
      true,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET name = p_business_name;
  END IF;
END;
$$;

-- =====================================================
-- 8. STORAGE: bucket avatars (público)
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policies de Storage
DROP POLICY IF EXISTS "Avatar público para leitura" ON storage.objects;
CREATE POLICY "Avatar público para leitura" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Upload de avatar autenticado" ON storage.objects;
CREATE POLICY "Upload de avatar autenticado" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Usuário atualiza próprio avatar" ON storage.objects;
CREATE POLICY "Usuário atualiza próprio avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Usuário deleta próprio avatar" ON storage.objects;
CREATE POLICY "Usuário deleta próprio avatar" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
