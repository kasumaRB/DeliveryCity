-- ============================================
-- 1. CRIAR TABELA SUPPORT_TICKETS (se não existir)
-- ============================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  user_role TEXT,
  message TEXT,
  status TEXT DEFAULT 'OPEN',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. POLICIES DE RLS - SUPABASE
-- ============================================
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert support_tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Allow read support_tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Allow delete support_tickets" ON public.support_tickets;
CREATE POLICY "Allow insert support_tickets" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow read support_tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow delete support_tickets" ON public.support_tickets
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert profiles" ON public.profiles;
CREATE POLICY "Allow read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Allow insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Allow update own restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Allow insert restaurants" ON public.restaurants;
CREATE POLICY "Allow read restaurants" ON public.restaurants
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow update own restaurant" ON public.restaurants
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Allow insert restaurants" ON public.restaurants
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read orders" ON public.orders;
DROP POLICY IF EXISTS "Allow update orders" ON public.orders;
DROP POLICY IF EXISTS "Allow insert orders" ON public.orders;
CREATE POLICY "Allow read orders" ON public.orders
  FOR SELECT TO authenticated USING (
    customer_id = auth.uid() OR 
    restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()) OR
    driver_id = auth.uid()
  );
CREATE POLICY "Allow update orders" ON public.orders
  FOR UPDATE TO authenticated USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()) OR
    driver_id = auth.uid()
  );
CREATE POLICY "Allow insert orders" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- 3. FUNÇÃO RPC UPSERT_PROFILE
-- ============================================
DROP FUNCTION IF EXISTS public.upsert_profile;
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
  p_is_restaurant BOOLEAN,
  p_avatar_url TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, business_name, role, status, cpf, cnpj, birth_date, phone_number, pix_key, description, working_hours, vehicle_type, license_plate, saved_addresses, avatar_url)
  VALUES (p_id, p_email, p_name, p_business_name, p_role, p_status, p_cpf, p_cnpj, p_birth_date, p_phone_number, p_pix_key, p_description, p_working_hours, p_vehicle_type, p_license_plate, p_saved_addresses, p_avatar_url)
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
    saved_addresses = p_saved_addresses,
    avatar_url = p_avatar_url;
    
  IF p_is_restaurant AND p_role = 'RESTAURANT' THEN
    INSERT INTO public.restaurants (id, owner_id, name, category, rating, image, menu, is_active, created_at)
    VALUES ('rest-' || p_id, p_id, p_business_name, 'Geral', 0, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500', '[]', true, NOW())
    ON CONFLICT (id) DO UPDATE SET name = p_business_name;
  END IF;
END;
$$;

-- ============================================
-- 4. STORAGE - POLICIES BUCKET AVATARS
-- ============================================
DROP POLICY IF EXISTS "Allow public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete avatars" ON storage.objects;
CREATE POLICY "Allow public read avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Allow authenticated upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update avatars" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete avatars" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
