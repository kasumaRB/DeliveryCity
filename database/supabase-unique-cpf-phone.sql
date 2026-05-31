-- ================================================================
-- UNICIDADE DE CPF E TELEFONE — Impede duplicação de dados
-- Execute no SQL Editor do Supabase
-- ================================================================

-- 1. Limpar duplicatas existentes antes de criar os índices
--    (mantém o registro mais antigo por CPF/telefone)
WITH ranked_cpf AS (
  SELECT id, cpf,
    ROW_NUMBER() OVER (PARTITION BY cpf ORDER BY created_at ASC) as rn
  FROM public.profiles
  WHERE cpf IS NOT NULL AND cpf != ''
),
dupes_cpf AS (
  SELECT id FROM ranked_cpf WHERE rn > 1
)
UPDATE public.profiles
  SET cpf = NULL
  WHERE id IN (SELECT id FROM dupes_cpf);

WITH ranked_phone AS (
  SELECT id, phone_number,
    ROW_NUMBER() OVER (PARTITION BY phone_number ORDER BY created_at ASC) as rn
  FROM public.profiles
  WHERE phone_number IS NOT NULL AND phone_number != ''
),
dupes_phone AS (
  SELECT id FROM ranked_phone WHERE rn > 1
)
UPDATE public.profiles
  SET phone_number = NULL
  WHERE id IN (SELECT id FROM dupes_phone);

-- 2. Criar índices únicos parciais (só aplica quando o campo não é NULL/vazio)
DROP INDEX IF EXISTS profiles_unique_cpf;
DROP INDEX IF EXISTS profiles_unique_phone;

CREATE UNIQUE INDEX profiles_unique_cpf
  ON public.profiles (cpf)
  WHERE cpf IS NOT NULL AND cpf != '';

CREATE UNIQUE INDEX profiles_unique_phone
  ON public.profiles (phone_number)
  WHERE phone_number IS NOT NULL AND phone_number != '';

-- 3. Confirmar
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'profiles'
  AND indexname IN ('profiles_unique_cpf', 'profiles_unique_phone');
