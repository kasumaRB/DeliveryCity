-- =====================================================
-- DELIVERYCITY - SCHEMA DO BANCO DE DADOS
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- =====================================================
-- TABELA: PROFILES (usuários)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  phoneNumber TEXT,
  cpf TEXT,
  cnpj TEXT,
  birthDate TEXT,
  role TEXT NOT NULL DEFAULT 'CLIENT'::text CHECK (role IN ('CLIENT', 'RESTAURANT', 'DRIVER', 'ADMIN')),
  status TEXT NOT NULL DEFAULT 'PENDING'::text CHECK (status IN ('PENDING', 'APPROVED', 'BLOCKED')),
  businessName TEXT,
  description TEXT,
  workingHours TEXT,
  pixKey TEXT,
  vehicleType TEXT,
  licensePlate TEXT,
  avatarUrl TEXT,
  averageRating REAL DEFAULT 5.0,
  commissionBalance REAL DEFAULT 0.0,
  currentLocation JSONB,
  createdAt BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updatedAt BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Índice para buscas por email
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- =====================================================
-- TABELA: RESTAURANTS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.restaurants (
  id TEXT PRIMARY KEY,
  ownerId UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  image TEXT,
  address TEXT,
  coords JSONB NOT NULL DEFAULT '{"lat": 0, "lng": 0}',
  menu JSONB DEFAULT '[]'::jsonb,
  promotions JSONB DEFAULT '[]'::jsonb,
  rating REAL DEFAULT 5.0,
  totalRatings INTEGER DEFAULT 0,
  isOpen BOOLEAN DEFAULT true,
  deliveryFee REAL DEFAULT 0,
  minOrder REAL DEFAULT 0,
  createdAt BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updatedAt BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON public.restaurants(ownerId);
CREATE INDEX IF NOT EXISTS idx_restaurants_category ON public.restaurants(category);

-- =====================================================
-- TABELA: ORDERS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  clientId UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  restaurantId TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  driverId UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  restaurantName TEXT NOT NULL,
  customerName TEXT NOT NULL,
  customerPhone TEXT NOT NULL,
  customerAddress JSONB NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal REAL NOT NULL,
  deliveryFee REAL NOT NULL,
  serviceFee REAL NOT NULL,
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'::text CHECK (status IN ('PENDING', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED')),
  pickupCode TEXT,
  driverNetEarnings REAL DEFAULT 0,
  paymentMethod TEXT DEFAULT 'PIX',
  paymentStatus TEXT DEFAULT 'PENDING'::text CHECK (paymentStatus IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  rating INTEGER,
  feedback TEXT,
  createdAt BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updatedAt BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  deliveredAt BIGINT
);

CREATE INDEX IF NOT EXISTS idx_orders_client ON public.orders(clientId);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON public.orders(restaurantId);
CREATE INDEX IF NOT EXISTS idx_orders_driver ON public.orders(driverId);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders(createdAt DESC);

-- =====================================================
-- TABELA: SUPPORT_TICKETS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  userId UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  userName TEXT,
  userRole TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'OPEN'::text CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  createdAt BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updatedAt BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_support_user ON public.support_tickets(userId);
CREATE INDEX IF NOT EXISTS idx_support_status ON public.support_tickets(status);

-- =====================================================
-- RLS POLICIES (Segurança)
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- PROFILES: Todos podem ler, apenas usuário dono pode editar
CREATE POLICY "Perfis públicos para leitura" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Usuários podem atualizar próprio perfil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Inserir perfil próprio" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RESTAURANTS: Todos leem, apenas dono edita
CREATE POLICY "Restaurantes públicos" ON public.restaurants
  FOR SELECT USING (true);

CREATE POLICY "Dono do restaurante pode editar" ON public.restaurants
  FOR UPDATE USING (auth.uid() = ownerId);

CREATE POLICY "Usuários autenticados podem criar restaurante" ON public.restaurants
  FOR INSERT WITH CHECK (auth.uid() = ownerId);

-- ORDERS: Leitura pública, edição restrita
CREATE POLICY "Pedidos públicos para leitura" ON public.orders
  FOR SELECT USING (true);

CREATE POLICY "Pedidos podem ser criados" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = clientId);

CREATE POLICY "Pedido pode ser atualizado por cliente, restaurante ou entregador" ON public.orders
  FOR UPDATE USING (
    auth.uid() = clientId OR
    auth.uid() IN (SELECT ownerId FROM public.restaurants WHERE id = restaurantId) OR
    auth.uid() = driverId
  );

-- SUPPORT_TICKETS: Apenas usuário dono e admin
CREATE POLICY "Tickets de suporte para leitura" ON public.support_tickets
  FOR SELECT USING (auth.uid() = userId OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'ADMIN'));

CREATE POLICY "Criar ticket de suporte" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = userId);

-- =====================================================
-- FUNÇÃO: upsert_profile (usada no app)
-- =====================================================
CREATE OR REPLACE FUNCTION public.upsert_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, status, createdAt, updatedAt)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'role', 'APPROVED', EXTRACT(EPOCH FROM NOW())::BIGINT, EXTRACT(EPOCH FROM NOW())::BIGINT)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    updatedAt = EXTRACT(EPOCH FROM NOW())::BIGINT;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil automaticamente no signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.upsert_profile();

-- =====================================================
-- STORAGE (avatars - bucket público)
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Política de leitura pública
DROP POLICY IF EXISTS "Avatar público para leitura" ON storage.objects;
CREATE POLICY "Avatar público para leitura" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Política de upload autenticado
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de avatar" ON storage.objects;
CREATE POLICY "Usuários autenticados podem fazer upload de avatar" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Política de update próprio
DROP POLICY IF EXISTS "Dono pode atualizar seu avatar" ON storage.objects;
CREATE POLICY "Dono pode atualizar seu avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- =====================================================
-- REALTIME (opcional - habilita updates em tempo real)
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurants;
