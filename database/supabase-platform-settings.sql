-- =======================================================================
-- DeliveryCity — Tabela de Configurações da Plataforma
-- Execute no SQL Editor do Supabase
-- =======================================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  platform_fee_pct   NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  driver_fee_pct     NUMERIC(5,2) NOT NULL DEFAULT 8.00,
  restaurant_fee_pct NUMERIC(5,2) NOT NULL DEFAULT 8.00,
  min_delivery_fee   NUMERIC(10,2) NOT NULL DEFAULT 4.00,
  min_order_value    NUMERIC(10,2) NOT NULL DEFAULT 15.00,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Garante que só pode existir uma linha (singleton)
ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_singleton CHECK (id = 1);

-- Insere os valores padrão se não existirem
INSERT INTO platform_settings (id, platform_fee_pct, driver_fee_pct, restaurant_fee_pct, min_delivery_fee, min_order_value)
VALUES (1, 15.00, 8.00, 8.00, 4.00, 15.00)
ON CONFLICT (id) DO NOTHING;

-- RLS: só admins podem ler e escrever
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select_admin" ON platform_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "settings_upsert_admin" ON platform_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Verificar resultado
SELECT * FROM platform_settings;
