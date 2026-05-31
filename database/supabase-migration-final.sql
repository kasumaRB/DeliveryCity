-- ============================================================
-- DeliveryCity — Migração Final
-- Execute este script no Supabase SQL Editor
-- ============================================================

-- 1. Colunas de resolução nos tickets de suporte
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS admin_note TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Garante que existe uma linha padrão em platform_settings
INSERT INTO public.platform_settings (
  id,
  platform_fee_pct,
  driver_fee_pct,
  restaurant_fee_pct,
  min_delivery_fee,
  min_order_value
) VALUES (
  1,
  15,    -- 15% taxa plataforma
  8,     -- 8% repasse entregador
  8,     -- 8% repasse lojista
  5.00,  -- R$ 5 taxa mínima de entrega
  15.00  -- R$ 15 pedido mínimo
)
ON CONFLICT (id) DO NOTHING;

-- 3. Adiciona coluna de taxa personalizada por parceiro (se não existir)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS "customFeePct" NUMERIC(6,2) DEFAULT NULL;

-- 4. Verificação final
SELECT
  (SELECT COUNT(*) FROM public.platform_settings)         AS platform_settings_rows,
  (SELECT COUNT(*) FROM public.profiles)                  AS profile_rows,
  (SELECT COUNT(*) FROM public.support_tickets)           AS support_ticket_rows,
  (SELECT column_name FROM information_schema.columns
   WHERE table_name='support_tickets' AND column_name='admin_note'
   LIMIT 1)                                               AS admin_note_exists,
  (SELECT column_name FROM information_schema.columns
   WHERE table_name='profiles' AND column_name='customFeePct'
   LIMIT 1)                                               AS custom_fee_exists;
