DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE tablename IN ('orders', 'restaurants')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select_auth" ON public.orders
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "orders_insert_auth" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = customer_id);

CREATE POLICY "orders_update_auth" ON public.orders
  FOR UPDATE USING (
    auth.uid() = customer_id OR
    auth.uid() IN (SELECT owner_id FROM public.restaurants WHERE id = restaurant_id) OR
    auth.uid() = driver_id
  );

CREATE POLICY "restaurants_select_public" ON public.restaurants
  FOR SELECT USING (true);

CREATE POLICY "restaurants_insert_owner" ON public.restaurants
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = owner_id);

CREATE POLICY "restaurants_update_owner" ON public.restaurants
  FOR UPDATE USING (auth.uid() = owner_id);
