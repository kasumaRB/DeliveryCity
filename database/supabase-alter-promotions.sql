-- Adicionar coluna promotions na tabela restaurants (se não existir)
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS promotions JSONB DEFAULT '[]'::jsonb;

-- Habilitar RLS na tabela profiles (se ainda não estiver)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança para profiles
DROP POLICY IF EXISTS "Perfis públicos para leitura" ON public.profiles;
CREATE POLICY "Perfis públicos para leitura" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários podem atualizar próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem atualizar próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Inserir perfil próprio" ON public.profiles;
CREATE POLICY "Inserir perfil próprio" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Políticas para restaurants
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurantes públicos" ON public.restaurants;
CREATE POLICY "Restaurantes públicos" ON public.restaurants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Dono do restaurante pode editar" ON public.restaurants;
CREATE POLICY "Dono do restaurante pode editar" ON public.restaurants FOR UPDATE USING (auth.uid() = ownerId);

DROP POLICY IF EXISTS "Usuários autenticados podem criar restaurante" ON public.restaurants;
CREATE POLICY "Usuários autenticados podem criar restaurante" ON public.restaurants FOR INSERT WITH CHECK (auth.uid() = ownerId);

-- Políticas para orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pedidos públicos para leitura" ON public.orders;
CREATE POLICY "Pedidos públicos para leitura" ON public.orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Pedidos podem ser criados" ON public.orders;
CREATE POLICY "Pedidos podem ser criados" ON public.orders FOR INSERT WITH CHECK (auth.uid() = clientId);

-- Bucket para avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;
