-- ================================================================
-- Adicionar coluna saved_cards na tabela profiles
-- Armazena APENAS tokens do PagSeguro — nunca dados brutos do cartão
-- ================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS saved_cards JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Verificar
SELECT id, email, saved_cards FROM public.profiles LIMIT 5;
