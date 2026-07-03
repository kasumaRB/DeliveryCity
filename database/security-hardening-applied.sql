-- =====================================================================
-- DeliveryCity — Hardening de Segurança APLICADO em produção
-- Projeto Supabase: fnhjxqppcrbepgwcrqzw
-- Aplicado via MCP apply_migration em 2026-06 (auditoria, Parte 3).
--
-- Substitui o antigo database/supabase-production-security.sql, que NUNCA
-- foi aplicado e que, se aplicado como estava, QUEBRARIA o app:
--   - profiles_select_own (só o dono) quebra a leitura de todos os perfis
--     que o app faz em fetchData (driver vê cliente, cliente vê driver...).
--   - GRANT sem DELETE em profiles quebraria deleteAccount.
--
-- Abordagem adotada (mínima e sem quebrar o app):
--   1) REVOKE de todo o acesso do role anon (não logado) — fecha o vazamento
--      de PII para visitantes sem login (RLS-1/2/5).
--   2) Triggers de coluna (não policies) para impedir:
--        - escalonamento de privilégio em profiles (RLS-4)
--        - adulteração de colunas financeiras em orders (RLS-3)
--      Detecção do chamador por auth.role() (NÃO current_user — que é sempre
--      'postgres' dentro de SECURITY DEFINER). Bypass para service_role/migração
--      e para escrita confiável vinda do RPC upsert_profile (flag transacional).
--   3) upsert_profile blindado contra auto-promoção a ADMIN (RLS-6) e corrigido
--      para a coluna gerada auth.users.confirmed_at (cadastro estava quebrando).
--   4) increment_balance corrigido: coluna commission_balance (RLS-7).
--
-- IMPORTANTE: as 3 Edge Functions que gravam colunas financeiras travadas
-- (create-asaas-payment, release-payment-splits, refund-asaas-payment) foram
-- alteradas para usar um client service_role PURO nessas gravações, de modo
-- que o trigger as reconheça como backend (auth.role()='service_role').
-- =====================================================================

-- ── 1. Revogar acesso do anon ────────────────────────────────────────
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.profiles          FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.orders            FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.restaurants       FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.products          FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.support_tickets   FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.platform_settings FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_profile FROM anon;

-- ── 2. Trigger anti-escalonamento em profiles (RLS-4) ────────────────
CREATE OR REPLACE FUNCTION public.guard_profiles_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text := coalesce(auth.role(), 'service_role');
  caller_is_admin boolean;
BEGIN
  IF v_role NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF coalesce(current_setting('app.trusted_profile_write', true), '') = 'on' THEN RETURN NEW; END IF;
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN') INTO caller_is_admin;
  IF caller_is_admin THEN RETURN NEW; END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.status             IS DISTINCT FROM OLD.status
     OR NEW.commission_balance IS DISTINCT FROM OLD.commission_balance
     OR NEW.average_rating     IS DISTINCT FROM OLD.average_rating
     OR NEW.driver_score       IS DISTINCT FROM OLD.driver_score
     OR NEW.custom_fee_pct     IS DISTINCT FROM OLD.custom_fee_pct THEN
    RAISE EXCEPTION 'Alteracao nao autorizada de colunas privilegiadas do perfil.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_profiles_privileged_columns ON public.profiles;
CREATE TRIGGER trg_guard_profiles_privileged_columns
  BEFORE UPDATE ON public.profiles FOR EACH ROW
  EXECUTE FUNCTION public.guard_profiles_privileged_columns();

-- ── 3. Trigger anti-fraude em orders (RLS-3) ─────────────────────────
CREATE OR REPLACE FUNCTION public.guard_orders_financial_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text := coalesce(auth.role(), 'service_role');
BEGIN
  IF v_role NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF NEW.total IS DISTINCT FROM OLD.total
     OR NEW.subtotal              IS DISTINCT FROM OLD.subtotal
     OR NEW.service_fee           IS DISTINCT FROM OLD.service_fee
     OR NEW.delivery_fee          IS DISTINCT FROM OLD.delivery_fee
     OR NEW.driver_split_released IS DISTINCT FROM OLD.driver_split_released
     OR NEW.asaas_payment_id      IS DISTINCT FROM OLD.asaas_payment_id
     OR NEW.payment_id            IS DISTINCT FROM OLD.payment_id
     OR NEW.refunded_at           IS DISTINCT FROM OLD.refunded_at
     OR NEW.customer_id           IS DISTINCT FROM OLD.customer_id
     OR NEW.restaurant_id         IS DISTINCT FROM OLD.restaurant_id THEN
    RAISE EXCEPTION 'Alteracao nao autorizada de colunas financeiras do pedido.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_orders_financial_columns ON public.orders;
CREATE TRIGGER trg_guard_orders_financial_columns
  BEFORE UPDATE ON public.orders FOR EACH ROW
  EXECUTE FUNCTION public.guard_orders_financial_columns();

-- ── 4. Revogar EXECUTE das funções internas ──────────────────────────
REVOKE EXECUTE ON FUNCTION public.guard_orders_financial_columns()   FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.guard_profiles_privileged_columns() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.increment_balance(uuid, numeric)    FROM anon, authenticated, public;

-- ── 5. increment_balance: coluna correta (RLS-7) ─────────────────────
CREATE OR REPLACE FUNCTION public.increment_balance(user_id uuid, amount numeric)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public', 'pg_catalog' AS $$
BEGIN
  UPDATE public.profiles SET commission_balance = coalesce(commission_balance, 0) + amount WHERE id = user_id;
END; $$;

-- ── 6. upsert_profile blindado (RLS-6) + fix confirmed_at gerada ─────
--   Ver função no banco; pontos-chave:
--     - rejeita role NOT IN (CLIENT, RESTAURANT, DRIVER)  → sem ADMIN
--     - cliente=APPROVED, parceiro=PENDING
--     - set_config('app.trusted_profile_write','on',true) libera o trigger
--     - NÃO escreve auth.users.confirmed_at (coluna gerada)
--   Em CONFLICT, o status é tratado assim (migration
--   fix_upsert_profile_partner_auto_approval_regression):
--     - papel INALTERADO  → preserva status (não rebaixa aprovação do admin)
--     - papel ALTERADO    → status sanitizado (CLIENT=APPROVED, parceiro=PENDING)
--   Isso corrige a regressão em que o trigger on_auth_user_created (handle_new_user)
--   cria o placeholder CLIENT/APPROVED no signup e o upsert preservava o APPROVED,
--   AUTO-APROVANDO parceiros e pulando a moderação.
-- (Definições aplicadas via migrations fix_upsert_profile_generated_confirmed_at
--  e fix_upsert_profile_partner_auto_approval_regression.)

-- ── 7. Storage: limite de tamanho e tipo no bucket 'avatars' (SEC2-4) ─
--   Bucket estava sem file_size_limit nem allowed_mime_types (DoS + upload de
--   HTML/SVG malicioso servido do dominio publico). Restringe a imagens raster
--   (SVG/HTML bloqueados) e 10 MB. Aplicado via execute_sql (nao e DDL):
--     UPDATE storage.buckets
--       SET file_size_limit = 10485760,
--           allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png',
--             'image/webp','image/gif','image/heic','image/heif']
--     WHERE id = 'avatars';
--
--   PENDENTE (exigem mudanca no app, nao so SQL):
--     - SEC2-1: bucket e publico e guarda fotos de entrega/devolucao (PII).
--       Fix = bucket privado + createSignedUrl (toca leitura de imagem no app).
--     - SEC2-2: policy de INSERT nao amarra path ao dono + upsert -> qualquer um
--       sobrescreve comprovante. Fix = caminhos {ownerId}/... + policy por pasta.

-- ── 8. PROMO-1/PROMO-2 + RLS-9 (parcial) ─────────────────────────────
--   RLS-9 (parcial): view public_profiles criada (migration create_public_profiles_view)
--     — só colunas nao-sensiveis. O FECHAMENTO da policy de profiles fica pendente
--       porque o rastreamento ao vivo do entregador depende do Realtime em profiles;
--       exige migrar location p/ tabela driver_locations antes (mini-projeto).
--
--   PROMO-1/PROMO-2 (migration promo1_guard_order_discount_on_insert):
--     Trigger BEFORE INSERT em orders valida no servidor (criacao de pedido e client-side
--     e um atacante pode inserir direto via API):
--       - conservacao: restaurant_net + driver_net + platform_fee = total
--       - desconto implicito (subtotal+entrega+servico-total) <= melhor promocao ATIVA da loja
--       - frete abaixo do minimo so com promocao FREE_DELIVERY ativa
--     Testado em rollback: legitimo aceita; 100%-sem-promo, frete-gratis-sem-promo e
--     desconto-acima-da-promo sao bloqueados.

-- ── 9. RLS-9 FECHADO (vazamento de PII para todo usuario logado) ─────
--   Antes: policy SELECT de profiles era USING(true) -> qualquer logado lia
--   CPF/PIX/cartoes/enderecos de TODOS (e o Realtime broadcastava tudo).
--   Agora (migrations rls9_*):
--     - Tabela driver_locations (sem PII) + RLS: so o entregador escreve a propria;
--       cliente/lojista/admin de um pedido ATIVO leem. Realtime habilitado.
--     - View profiles_safe: todas as colunas, mas as SENSIVEIS mascaradas (NULL)
--       para quem nao e o dono nem admin (CASE ... auth.uid()/is_admin()).
--     - Policy de profiles SELECT fechada: id = auth.uid() OR is_admin().
--     - is_admin() virou SECURITY DEFINER (evita recursao na policy).
--   App (commit 47fd473): le profiles_safe no lugar de profiles.select('*');
--     tracking do entregador via driver_locations; fee do dono via profiles_safe.
--   Testado (rollback): nao-admin le so o proprio perfil direto (1 linha), mas ve
--     todos via profiles_safe (4); admin ve todos nos dois. Deploy validado antes de fechar.
--
--   NOTA advisor: profiles_safe dispara "security_definer_view" (ERROR generico).
--   E INTENCIONAL: a view precisa bypassar RLS p/ retornar todas as linhas; a
--   protecao e o mascaramento por coluna (CASE). Sem vazamento (testado).
