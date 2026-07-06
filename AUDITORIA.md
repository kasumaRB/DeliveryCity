# Auditoria Completa — DeliveryCity (fluxo de pedido → entrega → devolução)

> Investigação por 5 agentes paralelos (store, ClientView, RestaurantView+DriverView, AdminView+EdgeFunctions, transversal).
> Achados validados contra o banco de produção real (projeto `fnhjxqppcrbepgwcrqzw`).
> Falsos positivos já removidos (ver seção final).
>
> **Total catalogado: ~407 problemas validados** em 7 rodadas —
> Parte 1 (fluxo, 61) · Parte 2 (jornadas, 93) · Parte 3 (segurança/dinheiro/infra, ~50) · Parte 4 (admin/lojista/perf/a11y, ~53) · Parte 5 (cliente/auth/cálculos/resiliência, ~50) · Parte 6 (driver/edge/tipos/navegação, ~54) · Parte 7 (storage/promoções/concorrência/UX, ~46).
> **Destaques recentes:** SEC2-1/2 (fotos de entrega públicas + qualquer um sobrescreve comprovante), TYPE-1 (avaliação de loja nunca salva), PROMO-4 (horário de funcionamento é feature morta), RACE-2 (split pago + reembolso = perda dupla), UI-1 (troca de papel morta).
> **Mais urgentes:** RLS-1/2 (PII vaza pra `anon`), RLS-3/4 (fraude financeira + auto-promoção a ADMIN),
> SEC-01 (reembolso sem autorização), MONEY-01 (repasse duplicado). Causa raiz de RLS:
> `database/supabase-production-security.sql` nunca foi aplicado em produção.

---

## ✅ CORRIGIDO (rodada de fixes — segurança crítica aplicada em produção)

Aplicado e validado contra o banco (testes com `ROLLBACK` simulando usuário comum). Ver
`database/security-hardening-applied.sql` e as Edge Functions `create-asaas-payment`,
`release-payment-splits`, `refund-asaas-payment`.

| ID | Correção | Como |
|----|----------|------|
| **RLS-1/2/5** | `anon` (não logado) não acessa mais `profiles/orders/restaurants/products/...` | `REVOKE` de todo DML do role `anon` |
| **RLS-3** | Cliente não altera mais `total`/taxas/`driver_split_released`/`asaas_payment_id`/`refunded_at` do pedido | Trigger `guard_orders_financial_columns` (bypass só p/ service_role) |
| **RLS-4** | Usuário não se auto-promove a ADMIN nem muda status/saldo/nota/score | Trigger `guard_profiles_privileged_columns` |
| **RLS-6** | `upsert_profile` não aceita mais `role=ADMIN`; parceiro entra `PENDING`; em conflito preserva status | RPC sanitizado + flag transacional confiável |
| **RLS-7** | `increment_balance` agora usa `commission_balance` (antes quebrava em runtime) | coluna corrigida |
| **SEC-01** | `refund-asaas-payment` valida o chamador (admin/cliente/entregador/dono) e bloqueia reembolso de pedido `DELIVERED` | `auth.getUser()` + guard de status |
| **MONEY-01 / C1** | Repasse e reembolso com idempotência **atômica** (`UPDATE ... WHERE flag=false/refunded_at IS NULL`) | sem mais duplicação por corrida |
| **BÔNUS** | Cadastro estava quebrando: `auth.users.confirmed_at` virou coluna gerada (mudança de plataforma do Supabase) | `upsert_profile` não escreve mais `confirmed_at` |

### ✅ CORRIGIDO (lote 2)

| ID | Correção | Como |
|----|----------|------|
| **REGRESSÃO** | Parceiros estavam sendo **auto-aprovados**: `handle_new_user` cria placeholder `CLIENT/APPROVED` no signup e o `upsert_profile` (lote 1) preservava o `APPROVED` | `upsert_profile`: no conflito preserva status só se o papel **não muda**; papel muda → status sanitizado (parceiro=PENDING). Verificado em rollback |
| **TYPE-1/2** | Avaliação de loja **nunca salvava** (UPDATE gravava `ratings_count` em coluna inexistente → falha silenciosa) | Coluna `restaurants.ratings_count` criada + backfill; checagem de `error` no `submitRating` |
| **ERR-1** | Fila offline descartava confirmação de entrega válida (`clearSyncQueue` em bloco) | `processSyncQueue` mantém itens que falharam (`setSyncQueue`), teto de 8 tentativas + TTL 4h |
| **RACE-2** | Reembolso de pedido com split **já pago** = pagamento em dobro | `refund-asaas-payment` bloqueia (409) se `driver_split_released=true`, inclusive admin *(código pronto; deploy pendente de aprovação)* |
| **RLS-10** | `profiles_insert` permitia auto-inserção como ADMIN | `with_check` restringe `role IN (CLIENT,RESTAURANT,DRIVER)`. Verificado (SQLSTATE 42501) |

> **RLS-11 reclassificado como FALSO POSITIVO:** existe FK `profiles_id_fkey → auth.users ON DELETE CASCADE`, então a exclusão do auth user já remove o perfil (sem órfão). A policy `profiles_delete_own` foi adicionada mesmo assim (inofensiva, deixa o `.delete()` do client suceder em vez de falhar silencioso).

### ✅ CORRIGIDO (lote 3 — RLS-9, SEC2 storage e Médios; tudo com `tsc`+`build` OK)

| ID | Correção |
|----|----------|
| **RLS-9** | Vazamento de PII fechado: view `profiles_safe` (colunas sensíveis mascaradas p/ não-dono), tabela `driver_locations` (tracking sem PII, RLS por pedido ativo), policy de `profiles` SELECT = próprio+admin, `is_admin()` SECURITY DEFINER. App lê `profiles_safe` + `driver_locations`. |
| **SEC2-1/2** | Comprovantes de entrega/devolução → bucket **privado** `delivery-proofs` (RLS: só o entregador do pedido grava; partes+admin leem via signed URL). |
| **SEC2-4** | Bucket `avatars`: limite 10 MB + só imagens (bloqueia HTML/SVG). |
| ~~**PERF-3**~~ | Code-splitting das views: **REVERTIDO** (`import()` dinâmico não resolve no WebView do APK → tela do cliente travava). Voltou a bundle único. |
| **PERF-4** | `loading=lazy` nas imagens de lista. |
| **UI-5** | Som do lojista reutiliza 1 `AudioContext` + `resume()` + fecha no unmount (parava de alertar). |
| **CALC-2/8/9** | `assignDriver` arredonda; `createOrder` rejeita `deliveryFee`/preço não-finito (evita `total=NaN`). |
| **LOJ2-2/16** | Validação de produto (preço/nome) e promoção (desconto >0, %≤100). |
| **ENT2-4/8/10/15/16** | GPS destrava; câmera fecha no unmount; código só-dígitos; data/hora; `R$ NaN`. |
| **CLI2-8/11** | Avaliação não força "com problema" quando não respondido; teto de 99/item no carrinho. |
| **UX-2/4/5/8/10/11/12/14** | Pedidos recentes ordenados; confirmar exclusão; estados vazios do Kanban; pluralização; comentário vazio; typo; categoria; `onError` em imagens. |
| **A11Y-2/4/6/7/8/9/10** | Zoom liberado; `aria-label` em botões-ícone (todas as views); `type=tel`/`inputMode` nos formulários; moeda pt-BR (vírgula); `alt` nas imagens; `role="alert"` nos toasts. |
| **PROMO-12** | Cupom com `trim()`. |
| **APK** | CapacitorHttp `enabled:false` (login no nativo); mensagem de erro real no login. |

### 🩹 Regressões introduzidas durante a fase de fixes e já corrigidas
- **Recursão em `profiles`**: ao fechar a policy (RLS-9), as policies de UPDATE/DELETE com `EXISTS(SELECT FROM profiles)` inline passaram a recursar (42P17) → excluir/editar endereço/perfil quebrou. Fix: trocar por `is_admin()` (SECURITY DEFINER). Só banco.
- **Code-splitting no APK**: `React.lazy` travava a tela do cliente no WebView. Fix: revert para imports estáticos.
- **`fmt` fora de escopo** (AdminView): commit intermediário usou `fmt()` onde não existia → `ReferenceError`. Fix: `toLocaleString` inline. (Reforçou a regra: só commitar com `tsc`+`build` verdes.)

**Pendências conhecidas (nenhuma crítica):**
- **PERF-1** (Context sem `useMemo` → re-render geral) e **PERF-2** (`fetchData` redundante c/ Realtime): adiados — risco de stale-closure/comportamental, exigem QA rodando o app.
- **PROMO-4** (horário de funcionamento não é aplicado), **ENT2-11** (GPS perdido pós-online) e outros comportamentais: exigem teste em device.
- Resíduos: SEC2-2 (assets públicos sobrescrevíveis — defacement), SHARED-5 (chave Gemini no bundle), RLS-8 (ativar Leaked Password Protection no painel).
- Residual **SEC2-2** (bucket `avatars` público — avatar/produto/logo sobrescrevíveis; defacement, não PII).
- **SEC-03** (webhook por valor), **SHARED-5** (chave Gemini no bundle), **RLS-8** ("Leaked Password Protection" — ativar no painel Auth).

---

## 🔴 CRÍTICO — dinheiro ou corrupção de dados

### C1. Reembolso duplicado possível (`refund-asaas-payment`)
`supabase/functions/refund-asaas-payment/index.ts:75,90-93` — o reembolso na Asaas é feito ANTES de gravar `refunded_at`, e a gravação usa `.catch()` num builder que não rejeita. Se a gravação falhar, o guard `if (order.refunded_at)` nunca bloqueia → uma 2ª chamada (admin clica de novo, ou "Liberar devolução" + "Encerrar sem devolução") reembolsa o cliente 2x.
**Correção:** marcar `refunded_at` ANTES de chamar a Asaas, com update condicional `.is('refunded_at', null).select().maybeSingle()`.

### C2. Repasse de dinheiro pode ser perdido OU duplicado (`release-payment-splits`)
`supabase/functions/release-payment-splits/index.ts:108-116`
- **(a) Perda:** a flag `driver_split_released=true` é marcada ANTES das transferências PIX. Se um PIX falhar, a flag já está true → restaurante/entregador nunca recebem, sem retry.
- **(b) Duplicação:** o check (linha 108) e a marcação (linha 116) não são atômicos. Duas chamadas concorrentes podem passar ambas → repasse em dobro.
**Correção:** update atômico condicional `.eq('driver_split_released', false).select().maybeSingle()` antes de transferir; flags/timestamps separados por beneficiário, marcadas só após sucesso de cada PIX.

### C3. `release-driver-split` legada sem idempotência + sobrescreve `payment_id`
`supabase/functions/release-driver-split/index.ts:122-147` — função antiga (modelo subconta) coexiste com `release-payment-splits` (modelo PIX). Sem idempotência (retry = transferência dupla) e sobrescreve `payment_id` (quebra refund). **Confirmar se está em uso e remover.**

### C4. Admin "Liberar devolução": reembolso não verificado, push/ticket de sucesso enviados mesmo em falha
`views/AdminView.tsx:1596-1637` — o resultado de `invoke('refund-asaas-payment')` não é checado; push "💚 Reembolso aprovado" e ticket "reembolso processado" são enviados independentemente de o reembolso ter ocorrido. Mesmo padrão em "Encerrar sem devolução" (`:1666-1690`).
**Correção:** checar `error`/`data.refunded`; só notificar se confirmado.

### C5. Dossiê do lojista apaga o CNPJ ao salvar
`views/AdminView.tsx:517-518,2096-2100` — o form tem só o input `name="cpf"`, mas o submit grava `cnpj: formData.get('cnpj')` que é `null` → ao editar qualquer campo de um lojista PJ, o CNPJ é zerado.
**Correção:** não sobrescrever `cnpj` quando o campo não existe no form.

### C6. Pedidos órfãos em `PENDING_PAYMENT` (cartão recusado / PIX não pago)
`views/ClientView.tsx:616-625,644-665` — quando o cartão é recusado ou o PIX não é pago, o pedido criado no banco NÃO é cancelado (só o caso de erro de rede cancela). Fica preso em PENDING_PAYMENT, e a idempotência de 2 min bloqueia nova tentativa ("Você já tem um pedido em andamento"). Não há expiração client-side do PIX.
**Correção:** cancelar o pedido no banco ao recusar/abandonar; idealmente um job/edge que expira PENDING_PAYMENT antigos.

### C7. Cancelamento pode cancelar pedido já pago (race)
`store.tsx:1240-1242` + `views/ClientView.tsx:611` — o reembolso/cancelamento decide pelo `order.status` do estado React (stale). Se o webhook confirmou o pagamento mas o estado local ainda não atualizou, o cliente cancela e o dinheiro cobrado não é reembolsado (ou um update fire-and-forget cancela pedido pago).
**Correção:** basear no status retornado pelo `.select()` do update atômico.

### C8. Desconto de cupom e frete grátis burláveis no cliente
`views/ClientView.tsx:457-498,553-563` + `store.tsx:998-1009` — o servidor (`createOrder`) só clampa o desconto a `subtotal`, mas não revalida se o cupom existe/está ativo/atende mínimo/respeita `maxUsage`. `isFreeDelivery` zera o frete client-side e o servidor aceita. Cliente pode forjar desconto até o subtotal.
**Correção:** revalidar cupom e frete grátis no servidor a partir do código, não confiar no valor enviado.

### C9. Câmera (`getUserMedia`) não é desligada ao desmontar / fechar por outro caminho
`views/DriverView.tsx:677-720,1814` — não há cleanup no unmount; se o entregador navegar com a câmera aberta, ela fica ligada (luz acesa, bateria, privacidade).
**Correção:** `useEffect(() => () => stopCamera(), [])` e parar o stream quando `activeOrder` muda.

### C10. `updateOrderStatus` sem guard atômico nem checagem de erro
`store.tsx:1479-1482` — `update({ status }).eq('id', id)` sem `.eq('status', anterior)` e sem `if (error)`. Permite regressão de status (duas abas / realtime + clique) e falha silenciosa de RLS dispara `fetchData` + notificações como se tivesse dado certo. Os botões da cozinha (`RestaurantView.tsx:730,780`) chamam isso SEM await e sem feedback de erro.
**Correção:** transição atômica + verificar linha afetada; await + estado de loading nos botões.

### C11. `assignDriver` força `status: READY` e recalcula split com fórmula divergente
`store.tsx:1596-1606` — ao aceitar, sobrescreve `status` para READY (pode regredir status mais avançado em corrida) e recalcula `driver_net_earnings`/`platform_fee` com fórmula diferente da `createOrder`, sem arredondar (`r2()`), podendo gerar `platform_fee` negativo com `customFeePct` alto.
**Correção:** não tocar em `status` no aceite; unificar a fórmula de split; arredondar.

---

## 🟠 ALTO / MÉDIO — robustez, consistência, UX

### M1. Realtime sem reconexão — eventos perdidos silenciosamente
`store.tsx:724-790` — `.subscribe()` sem callback de status (`CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`). Socket cai (background mobile, troca de rede) e o app para de receber updates sem aviso. Não há refetch ao reconectar nem no `SUBSCRIBED`.
**Correção:** tratar status, re-subscrever e `fetchData(true)` ao reconectar.

### M2. Realtime de restaurante apaga `reviews`/`ratingsCount`/`deliveryFee`
`store.tsx:760-772` vs `322-336` — o `mapRest` do Realtime mapeia menos campos que o `fetchData`. Um UPDATE em tempo real apaga reviews/contagem/taxa do estado local → média de estrelas pode virar `NaN`.
**Correção:** usar o mesmo mapeador completo nos dois lugares.

### M3. Fila offline perde confirmações e não tem limite de retry
`store.tsx:573-588` + `services/offlineService.ts` — `clearSyncQueue()` apaga a fila INTEIRA mesmo se um item falhou (perda de confirmação de entrega). Sem `maxRetries` (item venenoso reprocessa por 4h). Dois listeners `online` (store + DriverView) processam a fila em dobro.
**Correção:** remover item-a-item só após sucesso; contador de tentativas; um único listener.

### M4. Foto "obrigatória" de devolução é contornável
`views/DriverView.tsx:1061-1062` — o card DELIVERY_FAILED tem um botão "Iniciar devolução" que chama `startReturn` SEM foto, pulando o fluxo do modal que exige foto. Além disso o upload é best-effort (`:1640-1660`): a devolução inicia mesmo se o upload falhar.
**Correção:** rota única de devolução passando pela foto; tornar a foto pré-condição real.

### M5. `deleteProduct` sem confirmação, sem await, sem tratamento de erro
`views/RestaurantView.tsx:1103` + `store.tsx:1693` — um toque apaga o prato, irreversível, sem diálogo (promoções já têm confirmação inline). Erro do update engolido.
**Correção:** confirmação inline + await + feedback.

### M6. Endereço da loja sem coordenadas quebra matching de entregador
`views/RestaurantView.tsx:420,1933` — digitar o endereço manualmente zera `storeCoords`; salvar sem abrir o mapa deixa a loja sem coords → `availableOrdersWithScore` não calcula distância. Sem validação obrigando coords.
**Correção:** exigir coords (abrir o mapa) antes de salvar.

### M7. Double-submit em botões críticos (pedido, avaliação, remover cartão)
`views/ClientView.tsx:546,2296,1749` — "Finalizar Pedido" só trava por state tardio; "Finalizar Feedback" sem trava → `submitRating` duplica review e infla a média/contagem; remover cartão salvo opera sobre snapshot stale.
**Correção:** trava síncrona (ref) no início + `disabled` durante o await.

### M8. "Pular avaliação" não persiste — modal reaparece a cada reload
`views/ClientView.tsx:99,233-252,2233-2242` — `dismissedRatingIds` é um Set mutado sem setState e não persistido. Ao recarregar, o modal de avaliação do mesmo pedido reaparece para sempre.
**Correção:** persistir em localStorage ou marcar o pedido.

### M9. ETAs inconsistentes (3-4 fórmulas diferentes)
`services/mapsService.ts:125`, `views/ClientView.tsx:873-877,1168,1378` — tempo de viagem calculado com bases diferentes (≈25 km/h, ≈4 min/km+5, ≈21 km/h) → cliente vê tempos diferentes para a mesma distância. Em READY o ETA já soma viagem (deveria ser em OUT_FOR_DELIVERY).
**Correção:** uma única função de ETA; base de viagem a partir de `outForDeliveryAt`.

### M10. `submitRating` calcula média sobre estado stale (lost update)
`store.tsx:1563-1590` — `newAvg` usa `restaurant.rating`/`ratingsCount` do estado React; duas avaliações simultâneas calculam a partir do mesmo `n` → uma sobrescreve a outra. Update sem `if (error)`.
**Correção:** RPC atômico no servidor (`ratings_count = ratings_count + 1`, média incremental no SQL).

### M11. `PAYMENT_REFUNDED` do webhook nunca reflete (no-op)
`supabase/functions/handle-asaas-webhook/index.ts:102,138-142` — mapeia para CANCELLED mas o update filtra só `PENDING_PAYMENT`; reembolso ocorre em pedidos já pagos → nunca altera nada e o pedido fica divergente do gateway.
**Correção:** tratar PAYMENT_REFUNDED para o estado real e registrar.

### M12. Webhook reenvia push de "Novo Pedido" a cada retry
`supabase/functions/handle-asaas-webhook/index.ts:138-176` — o bloco de push roda mesmo quando o update afeta 0 linhas (Asaas reenvia webhooks) → restaurante recebe "🛒 Novo Pedido!" repetido.
**Correção:** checar linhas afetadas (`.select().maybeSingle()`) antes de notificar.

### M13. `send-push-notification` permite broadcast/push arbitrário por qualquer usuário logado
`supabase/functions/send-push-notification/index.ts:49,63-65` — exige JWT mas não checa role; um cliente pode disparar `notifyDrivers:true` ou push para `userId` arbitrário → abuso/spam.
**Correção:** exigir role ADMIN para `notifyDrivers` e para `userId` de terceiros.

### M14. `create-asaas-payment` cancela pedido incondicionalmente em falha
`supabase/functions/create-asaas-payment/index.ts:274,293,316` — `update({status:'CANCELLED'}).eq('id')` sem filtrar status; pode reverter pedido já pago (webhook em paralelo).
**Correção:** `.in('status', ['PENDING_PAYMENT'])`.

### M15. Falhas financeiras (`release-payment-splits`/`refund`) invocadas com `.catch(() => {})`
`store.tsx:540,1241,1290` — as operações financeiras mais críticas engolem qualquer erro sem log/retry/ticket.
**Correção:** logar + abrir ticket/reconciliação em falha.

### M16. Pedido permitido sem coordenadas de entrega
`views/ClientView.tsx:419-434,1683-1687` — finalizar com `selectedAddress.coords` undefined cria pedido sem destino (tracking/ETA/entregador sem rota). Só há um aviso, não um bloqueio.
**Correção:** exigir coords antes de finalizar.

### M17. Validação de produto incompleta (nome/preço/categoria)
`views/RestaurantView.tsx:364` — só valida a imagem; permite nome vazio e `price=NaN` (`parseFloat('')`).
**Correção:** validar nome, preço > 0 e categoria.

### M18. Erro de pagamento fica invisível se o checkout for fechado
`views/ClientView.tsx:1543,1872` — clicar fora durante o processamento fecha o modal; `paymentError` só renderiza dentro do checkout → cartão recusado some sem o cliente ver.
**Correção:** bloquear fechamento durante `isProcessing`.

### M19. Ganhos do entregador atribuídos por `timestamp` (criação), não por `deliveredAt`
`views/DriverView.tsx:574-595,1346` — pedido criado 23:50 e entregue 00:10 conta no dia errado; "Este mês" ignora o ano (cruza jan de anos diferentes). Três definições diferentes de "semana/mês".
**Correção:** usar `deliveredAt`; unificar janelas.

### M20. `window.confirm`/`alert` nativos espalhados no AdminView
`views/AdminView.tsx:86,529,532,540,547,822,842,906,1023,1510` — bloqueantes e ruins em webview; o resto do app já migrou para toasts/modais inline.
**Correção:** substituir por toast/modal inline.

### M21. GPS sem fallback: timeout não bloqueia nem usa base cadastrada
`views/DriverView.tsx:634,750-753` — só `PERMISSION_DENIED` bloqueia; em timeout o entregador fica "disponível" sem `currentPos` e vê score 0 / distância "---". A base cadastrada nunca é usada como fallback de posição.
**Correção:** fallback para coords da base; tratar timeout.

### M22. `updateUserProfile(currentLocation)` sem `.catch` → unhandled rejection
`views/DriverView.tsx:746` + `store.tsx:1112` — fire-and-forget sem catch e o store faz `throw`. Deps do useEffect de GPS incluem `updateUserProfile` não-memoizado → watchPosition recriado repetidamente.
**Correção:** `.catch()`; memoizar ou tirar das deps.

### M23. Modal de código compartilhado não reseta `deliveryPhotoStep`
`views/DriverView.tsx:1709-1713` — cancelar o modal não reseta o passo de foto; próxima retirada (READY) pode abrir direto no passo de foto e chamar `confirmDelivery` num pedido READY → falha. Código de entrega não é validado antes de pedir a foto (`:788-791`).
**Correção:** resetar estados ao fechar; validar código antes da foto.

### M24. Aprovação de lojista usa `.single()` (lança em 0 linhas) e ignora erro
`views/AdminView.tsx:892-903` — perfil aprovado mas loja pode não ser ativada silenciosamente.
**Correção:** `.maybeSingle()` + tratar erro.

### M25. Confirmar devolução (RETURNING→RETURNED) não garante reembolso
`views/AdminView.tsx:1793-1816` — se o pedido chegou a RETURNING por um caminho que não passou pelo "Liberar devolução e reembolsar", o reembolso nunca dispara, mas o push diz "Reembolso já processado".
**Correção:** garantir reembolso no fluxo de devolução independentemente do caminho.

### M26. Destaques da home re-embaralham a cada update de Realtime
`views/ClientView.tsx:355-370` — `useMemo` com `Math.random()` e dep `[restaurants]`; qualquer UPDATE de restaurante re-embaralha os destaques na frente do usuário.
**Correção:** semente estável ou dep mais restrita.

### M27. Som de novo pedido vaza `AudioContext` e pode estar suspenso
`views/RestaurantView.tsx:119-143` — cria `AudioContext` a cada beep sem fechar; em muitos navegadores fica suspenso sem gesto do usuário → lojista não ouve e perde pedido. Sem fallback visual/vibração garantido.
**Correção:** reutilizar um AudioContext; fallback visual.

### M28. Entrega offline descarta a foto
`views/DriverView.tsx:803-810` + `store.tsx:505` — offline, `confirmDelivery` marca DELIVERED mas o upload da foto falha e cai em catch silencioso; a foto é perdida (não enfileirada).
**Correção:** enfileirar a foto para upload pós-reconexão.

---

## 🔵 BAIXO — qualidade, manutenibilidade, dados

- B1. CEP fallback hardcoded (`78580000`/`78595-000`) em cidade fixa — `ClientView.tsx:597`, AddressModal.
- B2. `loginAsTestUser` depende de `passwordPlain` nunca mapeado → função morta. `store.tsx:860-869`.
- B3. `Order.feedback` declarado no type mas nunca mapeado em `mapOrder`. `store.tsx:201-241`.
- B4. `mapRest`/`updateRestaurant` não normalizam `deliveryFee`/`minOrder` (snake→camel) → somem na UI. `store.tsx:1651-1657`.
- B5. `restaurant.isOpen` ignora `openingHours`/`isRestaurantOpenNow` → loja fora do horário aceita pedido. `ClientView.tsx:871`, `store.tsx:918`.
- B6. `maxUsage`/`usageCount` de promoção nunca verificados → cupom de uso único reutilizável. `ClientView.tsx:463-469`.
- B7. Throttle de 2s do `fetchData` descarta refetch legítimo após mutação (vários callers usam `fetchData()` sem `force`). `store.tsx:288-289`.
- B8. `fetchData` rejeita toda a `Promise.all` no timeout de 8s, perdendo dados parciais. `store.tsx:300-313`.
- B9. Logout automático por regex de string ("expired"/"token") pode disparar logout indevido. `store.tsx:414,441`.
- B10. `signOut` limpa estado antes de confirmar no servidor; cache do usuário anterior pode persistir em falha. `store.tsx:1161-1185`.
- B11. `read-modify-write` não atômico em menu/endereços (lost update entre dispositivos). `store.tsx:1665-1726`.
- B12. `returnRate` do dossiê inclui DELIVERY_FAILED/RETURNING no denominador → penaliza injustamente. `AdminView.tsx:2167-2171`.
- B13. Badge "aguardando" do PENDING usa `order.timestamp` (criação), inflando o tempo para PIX. `RestaurantView.tsx:717`.
- B14. CVV de cartão salvo é pedido na UI mas nunca enviado ao backend. `ClientView.tsx:577,1765`.
- B15. "Copiado!" do PIX é exibido mesmo se o clipboard falhar. `ClientView.tsx:1978-1979`.
- B16. `now` tick de 30s re-renderiza a ClientView inteira. `ClientView.tsx:177-181`.
- B17. Tab "system" do admin tem alertas hardcoded ("nenhum erro em 24h"). `AdminView.tsx:2006-2008`.
- B18. `badge failureCount` (sidebar) não inclui RETURNED, mas a lista inclui. `AdminView.tsx:572`.
- B19. CORS `*` nas edge functions financeiras; sem `config.toml` versionando `verify_jwt`. `supabase/functions/*`.
- B20. Push FCM com erro não limpa token morto (UNREGISTERED) → tokens inválidos acumulam. `_shared/pushNotification.ts`.
- B21. Códigos pickup/delivery são 4 dígitos mas `returnCode` é 6, e o input aceita 4-5. `DriverView.tsx:1091,1704`.
- B22. Cards `<div onClick>` em vez de `<button>` (acessibilidade). `ClientView.tsx:880,1738`.

---

---
---

# Parte 2 — Auditoria por JORNADA / PERSONA (achados novos)

> Mergulho na experiência completa de cada ator. Não repete a Parte 1.

## 👤 CLIENTE (CLI)

### Críticos
- **CLI-1** — Variações/adicionais de produto nunca exibidos nem montáveis (funcionalidade morta). `types.ts:93-105,116,150-153` define o modelo, mas `ClientView.tsx:1020-1106`/`handleAddToCart:372-402` adicionam o produto sem seletor; item com variação obrigatória é pedido errado, sem somar `variantPriceAdd`.
- **CLI-7** — Sem validação de área de entrega. `ClientView.tsx:430-434` calcula frete sem raio máximo; servidor só rejeita frete > R$100 (~192 km). Pedido a 50-150 km é aceito.
- **CLI-20** — Colisão de ID de pedido. `store.tsx:1026`: `ORD-${Date.now().slice(-6)}` repete a cada ~16 min → dois clientes simultâneos colidem PK → falha aparentemente aleatória. Usar UUID.
- **CLI-40** — Double-submit de "Finalizar Pedido". `ClientView.tsx:1895,546`: `isProcessing` só vira true depois de trabalho síncrono; dois taps disparam dois `createOrder`; o 2º cai na idempotência e mostra erro confuso para pedido que foi criado. Trava via `useRef`.

### Médios
- **CLI-2** — Descrição do produto (`Product.description`) nunca exibida. `ClientView.tsx:1052-1066`.
- **CLI-3** — Item que esgota depois de no carrinho continua cobrando; só falha (genérico) no checkout sem dizer qual item. `store.tsx:937-941`.
- **CLI-4** — Carrinho não persiste (só `useState`); recarregar/background zera tudo. `ClientView.tsx:79`.
- **CLI-8** — Endereço sem número aceito silenciosamente ("S/N"). `AddressModal.tsx:272`.
- **CLI-9** — Limite silencioso de 2 endereços trava pedido para 3º local. `ClientView.tsx:2080`.
- **CLI-13/CLI-14** — Cupom não revalida ao mudar carrinho; desconto PERCENT congelado em valor absoluto. `ClientView.tsx:457-498,490-496`.
- **CLI-15** — CVV do cartão salvo nem validado client-side (campo "obrigatório" é teatro). `ClientView.tsx:577-578,1768`.
- **CLI-16/CLI-17** — Validade de cartão sem validar mês 1-12/futuro; número sem Luhn; CPF sem 11 dígitos → pedido órfão. `ClientView.tsx:580-596`.
- **CLI-21** — Modal PIX só fecha se status virar `PENDING`; outros caminhos prendem o QR por até 15 min. `ClientView.tsx:124-136`.
- **CLI-22** — `alert()`/`confirm()` nativos no fluxo de pagamento do cliente (webview). `ClientView.tsx:134,144,514,532,542,979`.
- **CLI-25** — Sem contato com a LOJA em PENDING/PREPARING (`restaurant.phoneNumber` nunca exposto). `ClientView.tsx:1394-1406`.
- **CLI-26** — Suporte só aparece em pedido com falha; pedido ativo travado não tem suporte. `ClientView.tsx:1316-1324`.
- **CLI-28** — `submitRating` grava rating mesmo com `storeStars:0`, marcando como avaliado sem nota. `store.tsx:1563-1568`.
- **CLI-30/CLI-31** — Cards de falha/devolução afirmam "reembolso processado" mesmo sem reembolso confirmado (risco de disputa). `ClientView.tsx:1312,1314`.
- **CLI-34** — Home sem loading/empty state (tela em branco com conexão lenta ou sem lojas). `ClientView.tsx:868-941`.
- **CLI-37/CLI-38** — UI do cliente ignora `openingHours`/`isRestaurantOpenNow`; loja fora do horário aparece aberta nos destaques e aceita pedido. `ClientView.tsx:358,531,871`.
- **CLI-41/CLI-42** — Fechar checkout/voltar do Android durante processamento deixa estado órfão / PIX órfão. `ClientView.tsx:1543,195`.
- **CLI-44** — Cliente sem indicação de offline; ações falham com erro genérico. `ClientView.tsx:679`.
- **CLI-45** — Perfil "completo" não valida formato de CPF (3 dígitos passam) → Asaas recusa. `ClientView.tsx:512`.

### Baixos
- **CLI-5** carrinho detecta restaurante pelo menu (frágil) `:379`; **CLI-6** quantidade sem teto `:1086`; **CLI-10** recalc de distância com string lixo `:281`; **CLI-11** label/complemento de endereço sem input `AddressModal.tsx:33,40`; **CLI-12** label frete "GRÁTIS" vs R$0 `:1677`; **CLI-18/19** brand "CARD"/id `card-${Date.now()}` `:631-639`; **CLI-23** "aguardando localização" eterno `:1408`; **CLI-24** contador salta `:1178`; **CLI-27** "Pular" acima do form confunde `:2233`; **CLI-29** foto de entrega nunca exibida ao cliente `:2131`; **CLI-32** recibo não mostra desconto (matemática não bate) `:2175`; **CLI-33** histórico sem paginação `:1148`; **CLI-35/36** busca sem acento e sem empty state `:343,801`; **CLI-39** acessibilidade de cards `:880`; **CLI-43** modal de avaliação abre por cima do checkout `:243`; **CLI-46** não lembra último endereço usado `:254`.

## 🏪 LOJISTA (LOJ)

### Críticos
- **LOJ-1** — Lojista vê suas avaliações SEMPRE como 0 estrela. `RestaurantView.tsx:1414,1458,1536,1546,1554` lê `rating.restaurantStars||rating.stars`, mas o campo gravado é **`storeStars`** (`types.ts:200`, `store.tsx:1577`). KPI, média e estrelas ficam 0.
- **LOJ-2** — Sem toggle de disponibilidade ("esgotado") do produto na UI. Backend bloqueia `available===false` (`store.tsx:937`), type tem `Product.available`, mas não há switch no form/card. `RestaurantView.tsx:961-1130`.
- **LOJ-3** — Lojista não tem campo para definir taxa de entrega nem pedido mínimo da própria loja. `RestaurantView.tsx:1893-2109`.
- **LOJ-4** — Cardápio é read-modify-write não atômico; salvar dois produtos quase simultâneos apaga o recém-criado. `store.tsx:1665-1702`.

### Médios
- **LOJ-5** — Sem criação/edição de variações e adicionais (modelo existe, UI não). `RestaurantView.tsx:961-1081`.
- **LOJ-6** — `handleSaveItem` valida só a foto; nome vazio e `price=NaN` passam; sem trava de duplo-toque. `:364-404`.
- **LOJ-7** — Toggle Aberta/Fechada ignora `openingHours`/`isRestaurantOpenNow`; lojista não sabe qual estado vale. `:634-657`.
- **LOJ-8** — Não há botão "Recusar pedido"; pedido fica preso em PENDING. `:729-734`.
- **LOJ-9** — Sem tempo de preparo por pedido nem ajuste no aceite (usa `prepTime` global). `:730`.
- **LOJ-10** — Botões da cozinha sem await/loading/erro; duplo-toque dispara 2 pushes aos entregadores. `:730,780`.
- **LOJ-11** — Salvar perfil com endereço editado mantém coords antigas (texto novo ≠ ponto), pior que "sem coords". `:420,1933`.
- **LOJ-12** — CNPJ truncado a 14 dígitos sem validação; CNPJ incompleto quebra subconta Asaas depois. `:2042-2048`.
- **LOJ-13** — Beep de novo pedido só toca se contagem "sobe"; pode perder alerta (vários no mesmo ciclo / reload com pendentes). `:120-143`.
- **LOJ-14** — "Receita por produto" usa preço de venda; não bate com "Faturamento Líquido". `:1403,1472,1506`.
- **LOJ-15** — Ticket médio = GMV(todos) / nº entregues → inflado. `:1390-1391`.
- **LOJ-16** — GMV/contagem incluem pedidos `PENDING_PAYMENT` órfãos (carrinhos abandonados). `:1390-1392`.
- **LOJ-17** — Lojista nunca confirma recebimento da devolução (quem dispara RETURNED é o entregador); só exibe o código. `store.tsx:1343-1351`, `RestaurantView.tsx:895-910`.
- **LOJ-18** — Sem tela de saldo/repasses/histórico financeiro real; `commissionBalance` não usado. Não há reconciliação do que recebeu.
- **LOJ-19** — Promoção: aceita validade no passado, % > 100, NaN; sem trava de duplo-toque. `:474-522`.
- **LOJ-20** — Promoção sem toggle ativar/desativar (`isActive` hardcoded true). `:490,1309-1366`.
- **LOJ-21** — Editar promoção reseta `validFrom` para agora. `:481-489`.

### Baixos
- **LOJ-22** fallback `feedback` morto `:1547`; **LOJ-23** categoria `" Japonesa"` com espaço `:991`; **LOJ-24** realtime perde reviews/deliveryFee `store.tsx:760`; **LOJ-25** READY com driverId mostra "A caminho" sem distinção/tempo `:818-829`; **LOJ-26** CPF/PIX sem máscara/validação `:2069-2094`.
- **Reforço:** lojista APROVADO sem registro de restaurante fica em **spinner infinito sem mensagem** (`:464-469`); lojista `BLOCKED`/`PENDING` ainda renderiza o painel inteiro e opera a loja.

## 🏍️ ENTREGADOR (ENT)

### Críticos
- **ENT-1** — Banner "corridas suspensas" (score < 70) é só cosmético; nada bloqueia o aceite. `DriverView.tsx:907-913,1172-1193`, `store.tsx:1592`.
- **ENT-2** — Entrega confirmada OFFLINE marca DELIVERED mas o replay encontra status já DELIVERED → `release-payment-splits` nunca dispara → entregador entrega e não recebe. `store.tsx:505-512,520,540,580`.
- **ENT-3** — Devolução por código (`confirmReturnWithCode`) muda status para RETURNED e manda push "reembolso processado" sem disparar `refund-asaas-payment`. `store.tsx:1354-1397`.

### Médios
- **ENT-4** — `acceptingOrderId` desabilita a lista inteira durante o aceite; perde corrida concorrente. `DriverView.tsx:1174,1189`.
- **ENT-5** — Ganho exibido no card diverge do recalculado em `assignDriver` para quem tem `customFeePct`. `:1150-1152`, `store.tsx:1598`.
- **ENT-6** — Badge "esperando" cai para `timestamp` se `readyAt` ausente → "3h esperando" falso. `:1164-1170`.
- **ENT-7** — Entregador fica disponível sem CNH nem placa válida (só exige PIX). `:1175`, `AuthView.tsx:446`.
- **ENT-8** — Toggle disponibilidade sem trava de double-tap; estado dessincroniza do banco. `:492-523`.
- **ENT-9** — Passo de entrega não valida o código antes de pedir a foto. `:788-791,803-808`.
- **ENT-10** — Sem `currentPos`, lista vem com distância "---", score 0 e ordem arbitrária; base nunca é origem. `:634-636,668`.
- **ENT-11** — `videoRef.play().catch(()=>{})` engole erro; visor preto sem feedback. `:677-682`.
- **ENT-12** — Câmera ao vivo só na devolução; entrega usa só `<input capture>`. `:709-717,1765`.
- **ENT-13** — Histórico mostra ganho verde para CANCELLED/RETURNED (não recebido). `:1242`.
- **ENT-14** — "Notificar cliente" mostra "enviada!" mesmo se o push falhar. `:1478-1488`.

### Baixos
- **ENT-15** tick 60s re-renderiza tudo `:446`; **ENT-16** ETA 25 km/h (4ª fórmula) `:654`; **ENT-17** fallback 1.5km distorce score `:639`; **ENT-18** data da review = criação `:1306`; **ENT-19** avatar sem cache-busting `:122`; **ENT-20** três conceitos de "nota" (driverScore/averageRating/avgRating) `:235,968`; **ENT-21** fechar modal no X após reportar falha permite bypass da foto via card `:1458,1060`.

---
---

# Parte 3 — Mergulho profundo: segurança, dinheiro e infraestrutura

> 3ª rodada de auditoria (5 agentes especializados) cobrindo camadas ainda não exploradas:
> Edge Functions, RLS/banco, Auth/onboarding, componentes compartilhados, Realtime/offline.
> Achados de RLS e do `refund` **validados diretamente no banco de produção** (`pg_policies`, grants).

## 🔒 Segurança do banco (RLS) — causa raiz: `database/supabase-production-security.sql` NUNCA foi aplicado

### Críticos
- **RLS-1** — Policy `"Perfis públicos para leitura"` em `profiles` tem `qual = true` para `{public}`. **Qualquer um — inclusive `anon` (sem login) — lê CPF, CNPJ, chave PIX, `saved_cards`, `asaas_account_id`, `current_location` de TODOS os usuários.** Vazamento massivo de PII e dados financeiros. ✅ confirmado em `pg_policies`.
- **RLS-2** — Role `anon` mantém grants `SELECT,INSERT,UPDATE,DELETE` em `profiles`, `orders`, `products`, `restaurants`. A intenção (`REVOKE ... FROM anon`) nunca rodou. ✅ confirmado em `role_table_grants`.
- **RLS-3** — `orders_update` tem `with_check = null`. O cliente pode reescrever `total`, `subtotal`, `platform_fee`, `driver_net_earnings`, `status`, `driver_split_released`, `delivery_code` do próprio pedido → marcar como pago/entregue, zerar taxas, liberar split. **Fraude financeira direta.** ✅ confirmado.
- **RLS-4** — `profiles_update` valida só posse da linha (`auth.uid() = id`), não as colunas. **Qualquer usuário pode setar o próprio `role='ADMIN'`, `status='APPROVED'` ou inflar `commission_balance`.** Escalonamento de privilégio para ADMIN. ✅ confirmado.

### Altos / Médios
- **RLS-5** — `products_select` e `restaurants_select` com `qual = true` expõem `products.owner_price` (preço de custo do lojista) e `restaurants.cnpj`/`phone_number` a `anon`. Vazamento de margem comercial e CNPJ.
- **RLS-6** — RPCs `SECURITY DEFINER` (`upsert_profile`, `delete_user_by_id`) executáveis por `authenticated`; `upsert_profile` aceita `p_role`/`p_status` arbitrários → 2º caminho de auto-promoção a ADMIN mesmo que RLS-4 seja corrigido.
- **RLS-7** *(bug funcional)* — `increment_balance` faz `UPDATE profiles SET balance = ...`, mas a coluna chama `commission_balance`; `balance` não existe → função quebra em runtime.
- **RLS-8** — "Leaked Password Protection" desabilitado (advisor); policies de `orders` usam `auth.uid()` sem `(select ...)` (re-avaliação por linha); FKs `orders.driver_id`/`products.restaurant_id` sem índice.

## 💰 Edge Functions (pagamento/repasse/reembolso)

### Críticos
- **SEC-01** — `refund-asaas-payment` usa `SERVICE_ROLE_KEY` (ignora RLS) e **nunca chama `auth.getUser()`** nem valida dono/status do pedido. Qualquer usuário logado reembolsa o pedido de qualquer outro passando o `orderId` — inclusive pedidos `DELIVERED` (repasses já pagos) → plataforma paga em dobro. Único atenuante: idempotência por `refunded_at`. `refund-asaas-payment/index.ts:33-51`. ✅ confirmado lendo o código.
- **MONEY-01** — `release-payment-splits` faz idempotência ler-depois-escrever **não-atômica** (`select driver_split_released` → `update ...=true`). Duas chamadas simultâneas leem `false` e ambas pagam → **repasse duplicado** a restaurante e entregador. Deveria ser `UPDATE ... WHERE driver_split_released=false` + checar linhas afetadas. `release-payment-splits/index.ts:107-116`.

### Médios
- **MONEY-02** — `release-payment-splits` marca `driver_split_released=true` **antes** de tentar os PIX. Se o PIX falha, vira `warning` e retorna `200 released:true` → repasse **perdido pra sempre, sem retry**. `:116,149-182`.
- **RESIL-01** — Se o PIX do restaurante passa mas o do entregador falha (ou vice-versa), não há rollback nem reprocessamento parcial (flag já travada). Faltam flags separadas `restaurant_split_released`/`driver_split_released`. `:141-182`.
- **SEC-03** — `handle-asaas-webhook` confia em `externalReference` sem cruzar com o `asaas_payment_id` salvo no pedido; só amarra por valor. Se o token de webhook vazar, marca qualquer pedido como pago. `:73-82`.
- **SEC-04** — CORS `Access-Control-Allow-Origin: '*'` em todas as funções, inclusive as de dinheiro. Combinado com SEC-01, qualquer site chama do navegador da vítima. `_shared/cors.ts:2`.

### Baixos / a remover
- **SEC-02** — `release-driver-split` é **código morto** (não é mais chamado; `assignDriver` não paga no aceite). Risco real = zero hoje, mas é uma função perigosa (repasse sem idempotência) que deve ser **removida** para não ser religada por engano. Reclassificado de crítico para limpeza.
- **CORR-02** — `detectPixKeyType` pode classificar telefone de 11 díg. como CPF → PIX rejeitado (silencioso via MONEY-02). `release-payment-splits/index.ts:36-44`.
- **RESIL-02** — `create-asaas-account` não verifica erro do update em `restaurants`; se falhar, próxima chamada cria **outra** subconta Asaas órfã. `:139-148`.
- **CORR-01** — `totalCents` na verdade contém reais (valor correto, nome enganoso, convida bug ×100 futuro). `create-asaas-payment/index.ts:224`.
- **CORR-03** — `create-asaas-payment` retorna falhas de pagamento com HTTP 200; mascara erros em monitoramento.

## 🔑 Auth / Sessão / Onboarding

### Críticos
- **AUTH-2** — "Self-healing" recria qualquer sessão sem perfil como `role:CLIENT, status:APPROVED`. Um parceiro BLOCKED/PENDING que perca o perfil vira **cliente aprovado**, furando a moderação. `store.tsx:369-393`.
- **AUTH-3** — `deleteAccount` apaga `profiles` e chama `delete-auth-user` com `.catch(()=>{})` (erro engolido). Deixa órfãos: restaurante com `owner_id` morto, pedidos ativos sem contraparte, conta `auth` viva que dispara AUTH-2. `store.tsx:1140-1147`.

### Médios
- **AUTH-1** — E-mail não normalizado no `signUp`/login (profile salva lowercase, mas `auth.signUp` recebe cru); sem checagem de e-mail duplicado normalizado. `AuthView.tsx:420-424,570`.
- **AUTH-4** — Efeito `setCurrentRole(profile.role)` reverte a troca manual de papel do admin a cada update Realtime de perfil; acoplamento frágil com `App.tsx` (que confia em `currentRole`). `store.tsx:149-153`.
- **AUTH-5** — Onboarding força `COMPLETE_PROFILE` só para parceiros. Cliente via Google entra sem telefone nem endereço → pode chegar ao checkout com dados vazios. `AuthView.tsx:250-256,606-614`.
- **AUTH-6** — Senha mínima 6 chars sem complexidade; sem rate limit no client para login nem reset de senha. `AuthView.tsx:309,549,566`.
- **AUTH-7** — Erro de login genérico ("Credenciais inválidas ou e-mail não confirmado") não distingue senha errada de e-mail pendente; sem botão "reenviar confirmação". `AuthView.tsx:575`.
- **AUTH-8** — Regex de erro dispara `signOut()` automático; em falha de refresh transitória ao voltar do background, derruba a sessão em vez de retentar. `store.tsx:441-447`.

### Baixos
- **AUTH-9** PII de terceiros (CPF/PIX/cartões de todos) em `localStorage` não criptografado durante a sessão `store.tsx:396`; **AUTH-10** `birthDate` string sem validação na edição; **AUTH-11** avatar sem checagem de tamanho, UX via `alert()`; **AUTH-12** cadastro de parceiro: `restaurants.upsert` separado do RPC pode divergir.
- *(Mitigados/sem bug: race de `onAuthStateChange` protegida por refs/throttle; loading travado tem saída de emergência; logout presente em todos os estados.)*

## 🧩 Componentes / serviços compartilhados

### Críticos / Altos
- **SHARED-5** — Chave Gemini exposta no bundle client (`VITE_GEMINI_API_KEY`). Qualquer um extrai do bundle → abuso de cota/custo. Deveria ser proxiada por Edge Function. `services/geminiService.ts:4`.
- **SHARED-2** — `geocodeAddress`/`searchAddresses` retornam `{lat:NaN, lng:NaN}` sem validação se Nominatim devolve item inválido → coords inválidas salvas ou distância NaN. `services/mapsService.ts:45,162`.
- **SHARED-4** — `AddressModal.handleConfirm` salva sem validar número/CEP/rua; cai em fallbacks (rua = "lat, lng", CEP genérico da cidade) sem bloquear o botão → entregador recebe endereço inútil. `components/AddressModal.tsx:261-281`.
- **SHARED-3** — `getRealDistances` nunca consulta roteamento real (Haversine ×1.4 + estimativa) mas marca `isFallback:false`; o nome e a flag enganam — distância "real" é sempre aproximada. `services/mapsService.ts:113-143`.

### Médios / Baixos
- **SHARED-1** — Sistema de toast oficial (`components/Notification.tsx`) é **código morto**; cada view reimplementa o seu, divergente (durações e empilhamento diferentes). `RestaurantView.tsx:162`, `DriverView.tsx:56`.
- **SHARED-6** fallback de UF errado p/ estados fora do map (ex: "Distrito Federal"→"DI"); **SHARED-7** `useApi` com `immediate` entra em loop se `apiFunction` não memoizada; **SHARED-8** `throw lastError` lança string, não `Error`; **SHARED-9** auto-dismiss do toast reinicia timer a cada render do pai; **SHARED-10** AddressModal remove `<style>` global no unmount.
- *(Sem bug: `useAndroidBack`, `DriverTrackingMap`, `DeleteAccountModal`, `offlineService`, `lookupCEP` — cleanup e validação corretos.)*

## 🔄 Realtime / Offline / Sincronização

### Críticos
- **SYNC-1** — Os 3 canais (`profiles/orders/restaurants-realtime`) chamam `.subscribe()` **sem callback de status** — sem tratar `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` nem refetch ao reconectar. Socket cai (background, troca de rede) → eventos param **silenciosamente** e o estado congela sem aviso. `store.tsx:740,755,783`.
- **SYNC-2** — Handlers Realtime aplicam `payload.new` cegamente sem comparar versão/timestamp. Evento atrasado pode **reverter** estado mais novo (incl. sobrescrever update otimista offline). Não há `updated_at`/seq para resolver conflito. `store.tsx:742-755`.
- **SYNC-3** — `processSyncQueue` sem guard de reentrância (gatilho `online` + resume) → confirmação enviada 2x; `clearSyncQueue()` no fim apaga a fila inteira se um item falha. Atenuado por updates condicionais por status, mas duplicação por flapping é real. `store.tsx:573-588`.

### Médios / Baixos
- **SYNC-4** — Sem polling de fallback: se o Realtime cair de forma persistente com app em foreground, o estado nunca atualiza (lojista não vê pedidos novos). `store.tsx`.
- **SYNC-6** — `updateOrderStatus` e edição de cardápio (read-modify-write do JSON `menu`) **não-atômicos**; 2 lojistas em 2 abas → última gravação sobrescreve a outra (produto perdido). `store.tsx:1481,1666-1701`.
- **SYNC-5** stale closure parcial em `processSyncQueue` registrado em listener; **SYNC-8** camada offline usa `localStorage` (limpável pelo WebView) em vez de Capacitor Preferences; **SYNC-9** reentrância de `onResume` (protegida por ref).
- *(Sem bug: aceite de pedido `assignDriver` protegido por `.is('driver_id',null).maybeSingle()`.)*

---
---

# Parte 4 — AdminView, RestaurantView, performance e acessibilidade

> 4ª rodada (4 agentes): AdminView linha-a-linha, RestaurantView completo, performance/re-renders, a11y/responsividade/i18n. ~53 achados.

## 🛠️ AdminView (painel admin) — ADM-1..14

### Críticos
- **ADM-1** — "Liberar devolução e reembolsar" dispara push "💚 Reembolso aprovado" ao cliente/entregador/restaurante **sem checar o `error` do `invoke('refund-asaas-payment')`**. `AdminView.tsx:1591-1650`. (reforça C4)
- **ADM-2** — "Encerrar sem devolução": marca `CANCELLED` e avisa reembolso sem checar nenhum dos dois `invoke`; update sem `.eq('status',...)` (race). `:1662-1700`.
- **ADM-3** — Erros das ações destrutivas/financeiras só caem em `console.error`; admin vê "sucesso". `:1638,1691,1817,1848`.

### Médios
- **ADM-4** — `platform_settings` salvas sem validar limites: comissão pode passar de 100%, taxas negativas (o `max="100"` do HTML não é checado no submit). `:83-115,160-177`.
- **ADM-5** — Reset de taxa custom em loop; falhas só em `console.error`, sem reportar. `:89-97`.
- **ADM-6** — "Avisar cliente/entregador" e "cobrar devolução" não checam o resultado do push. `:1538,1560,1740`.
- **ADM-7** — Suspender entregador: trava por `order.id` (não por driver), permite suspensão/push duplicados quando o driver tem vários pedidos. `:1833-1859`.
- **ADM-8** — Confirmar recebimento de devolução: erro só em `console.error`, sem alerta. `:1791-1829`.

### Baixos
- **ADM-9** card "GMV" só conta `DELIVERED` mas rotula "Volume" (ignora em andamento) `:620`; **ADM-10** taxa de devolução do dossiê pune entregador com devoluções **em andamento** (denominador inclui RETURNING/DELIVERY_FAILED) `:2167-2171`; **ADM-11** listas sem paginação (`slice(0,50)` esconde o resto) `:1946`; **ADM-12** média da loja inclui pedidos sem `storeStars` como nota 0 `:1172`; **ADM-13** salvar dossiê pode **apagar CNPJ** (form sem input `cnpj` → grava `null`) `:517-518,2096`; **ADM-14** `delete-auth-user` com `.catch(()=>{})` deixa conta órfã no auth sem aviso `:1641`.

## 🏪 RestaurantView (painel lojista) — LOJ2-1..16

### Críticos
- **LOJ2-1** — Edição de cardápio é **read-modify-write não-atômico** (`updateMenu/updateProduct/deleteProduct`): duas abas → produto somem/revertem. `store.tsx:1665-1702`.
- **LOJ2-2** — `handleSaveItem` salva produto sem validar: preço `NaN`/negativo/zero e nome vazio entram no cardápio (cliente vê `R$ NaN`, repasse quebra). `RestaurantView.tsx:364-404`.
- **LOJ2-3** — `updateOrderStatus` ignora `error` do update e **notifica o cliente mesmo em falha**. `store.tsx:1477-1559`.
- **LOJ2-4** — Botões "Aceitar/Marcar pronto"/toggle aberto sem trava de double-click → pushes duplicados. `RestaurantView.tsx:729,779,639`.

### Médios
- **LOJ2-5** ticket médio = GMV-de-todos ÷ entregues (populações diferentes) `:1390`; **LOJ2-6** "Taxa plataforma" mistura GMV total com receita de entregues `:1481`; **LOJ2-7** KPI "Pedidos" ignora o filtro de período (mostra histórico total) `:1455`; **LOJ2-8** receita por produto usa preço **atual** do cardápio, não o pago `:1403`; **LOJ2-9** toggle `is_open` sem tratar erro e **sem fechar automático por `openingHours`** (loja fica aberta 24h se esquecer) `:639-658`; **LOJ2-10** imagens sem `onError`; upload sem limite de bytes `:1091,301`; **LOJ2-11** pedido em status terminal some da tela sem feedback; `refreshData` desestruturado mas **nunca usado** (sem resync se o Realtime cair) `:109`.

### Baixos
- **LOJ2-12** código de devolução pode ser exibido sem ter sido gravado (update afeta 0 linhas, sem `.select()`) `store.tsx:1343`; **LOJ2-13** cálculo de repasse com `customFeePct===0` mostra 100% `:1664`; **LOJ2-14** avaliação "0.0" indistinguível de loja sem nota `:1413`; **LOJ2-15** validade de promoção com bug de fuso (volta 1 dia) `:539`; **LOJ2-16** promoção aceita desconto `NaN`/negativo/>100% `:474-510`.

## ⚡ Performance — PERF-1..8

### Críticos
- **PERF-1** — Context Provider reprovê **objeto novo a cada render** (sem `useMemo`, ~20 funções inline). Todo evento Realtime/`setState` re-renderiza a **view ativa inteira** (nenhuma view usa `React.memo`). `store.tsx:1462-1758`.
- **PERF-2** — Cada mutation chama `fetchData()` que refaz `select('*')` de restaurants+orders+profiles (todos) — **redundante com o Realtime** que já patcha incrementalmente. `store.tsx:305-311` + ~15 call sites.

### Médios/Baixos
- **PERF-3** sem code-splitting: as 5 views (~513 KB) entram no bundle inicial; zero `React.lazy` `App.tsx:3-7`; **PERF-4** `<img>` de listas sem `loading="lazy"`/dimensões (CLS) `ClientView.tsx:845+`; **PERF-5** `localStorage.setItem(JSON.stringify(...))` de listas inteiras a cada fetch (bloqueia main thread) `store.tsx:338,345,396`; **PERF-6** `setCurrentPos` a cada amostra de GPS re-renderiza DriverView (sem throttle no estado) `DriverView.tsx:739`; **PERF-7** `setNow` por `setInterval` (30-60s) re-renderiza a view inteira `*View.tsx`; **PERF-8** `filter/sort/map` sobre orders/profiles recomputados inline sem `useMemo` `AdminView.tsx`.
- *(OK: subscriptions Realtime registradas uma vez com cleanup; GPS já evita fetchData completo.)*

## ♿ Acessibilidade / Responsividade / i18n — A11Y-1..15

### Críticos
- **A11Y-1** — **Nenhum modal** tem `role="dialog"`/`aria-modal`/ESC/trap de foco (sistêmico, ~15 modais). `AddressModal/DeleteAccountModal/TutorialModal` + modais inline.
- **A11Y-2** — Zoom desabilitado (`maximum-scale=1.0, user-scalable=no`) — viola WCAG 1.4.4. `index.html:5`.
- **A11Y-3** — `alert()`/`confirm()` nativos espalhados (~50 ocorrências) — péssimo em mobile e inconsistente com os Toasts já existentes.
- **A11Y-4** — Botões só-ícone sem `aria-label` (sistêmico; muitos usam só `title`).
- **A11Y-5** — Alvos de toque <44px (ex.: +/− de quantidade no carrinho ~21px). `ClientView.tsx:1075,1086`.

### Médios
- **A11Y-6** inputs sem `<label>` e sem `type="tel"`/`inputMode` (telefone/CPF/CNPJ) → teclado mobile errado; **A11Y-7** `type="number"` para moeda (bloqueia vírgula pt-BR) `RestaurantView.tsx:1038`; **A11Y-8** moeda formatada com ponto (`R$ 12.50`) em ~20 lugares, inconsistente com o `Intl` usado em outros; **A11Y-9** imagens sem `alt`; **A11Y-10** toasts/spinners sem `aria-live`/`role="alert"`; **A11Y-11** `Form.tsx`/`Notification.tsx` fora do design mobile; **A11Y-12** safe-area não-global (depende de classe por-view; modais full-screen sob o notch).

### Baixos
- **A11Y-13** texto `gray-300/400` em `8-10px` (contraste); **A11Y-14** `<option>` de status em inglês no admin + emoji como único indicador; **A11Y-15** `toLocaleDateString` com `hour/minute` ignorados `DriverView.tsx:1249`.

> **Total acumulado: ~257 problemas** (Parte 1: 61 · Parte 2: 93 · Parte 3: ~50 · Parte 4: ~53).

---
---

# Parte 5 — ClientView, Auth, cálculos e resiliência

> 5ª rodada (4 agentes): ClientView completo, AuthView/onboarding, cálculos numéricos, tratamento de erros/offline. ~50 achados novos (após validar contra produção e descartar overlaps).

## 🛒 ClientView (cliente) — CLI2-1..14

### Críticos
- **CLI2-1** — Total exibido no checkout pode **não bater com o cobrado**: o cliente envia `deliveryFee`/`discount`, mas o servidor recalcula `serviceFee` do banco; se `platformSettings` no React estiver stale, `cartTotal` ≠ `total` gravado. `ClientView.tsx:553-563`, `store.tsx:966,1020`.
- **CLI2-2** — `cancelOrder` decide reembolso por `order.status` **stale** do array React (ramo `store.tsx:1240`), não pelo status real → se webhook acabou de marcar PENDING (pago), refund nunca dispara. (= ERR-6)
- **CLI2-3** — Cupom **FIXED legítimo > subtotal** zera o repasse: loja entrega e recebe **R$0** (`finalProductTotal = subtotal - discount = 0`). Sem clamp ao subtotal nem limite no servidor. `ClientView.tsx:490-496`, `store.tsx:1009-1011`.

### Médios
- **CLI2-4** auto-seleção cega de `savedAddresses[0]` (pode não ter coords → frete fallback) `:254`; **CLI2-5** `handleSaveAddress` não checa erro de `updateAddress` e fecha como sucesso `:286`; **CLI2-6** `deleteAddress` read-modify-write sobre perfil stale → endereço "ressuscita" `:316`,`store.tsx:1717`; **CLI2-7** **cartão de crédito mostra "Pedido enviado!" antes do webhook confirmar** (cai em `showOrderSuccess` imediato, pedido ainda `PENDING_PAYMENT`) `:670-677`; **CLI2-8** avaliação grava `productOk/packagingOk = false` quando o cliente deixou `null` (penaliza loja/entregador) `:325-341`; **CLI2-9** pedido órfão `PENDING_PAYMENT` após recusa trava o cliente na idempotência de 2 min `:616-625`; **CLI2-10** frete base do client (R$4) ≠ piso do server.

### Baixos
- **CLI2-11** quantidade sem teto/estoque; **CLI2-12** desconto absoluto re-somado após remover itens; **CLI2-13** coords viram texto de rua em `recalculateDistances` (`"...,undefined"`); **CLI2-14** timeout de 15 min do PIX não cancela o pedido órfão.

## 🔑 Auth / Onboarding — AUTH2-1..14

### Críticos
- **AUTH2-1** — Campos de veículo condicionados a `partnerType` (não a `roleToSet`) → dados de veículo podem vazar para cadastro de cliente. `AuthView.tsx:436-447`.
- **AUTH2-2 ✅(confirmado no banco)** — Checagem de CPF/telefone duplicado é **só client-side**, ignora o `error` da query (falha sob RLS → sempre "único") e há TOCTOU. **Não existe constraint UNIQUE em `cpf`/`phone_number`/`cnpj`** (só em `email`). `AuthView.tsx:390-417`.

### Altos/Médios
- **AUTH2-4** cadastro de parceiro: `restaurants.upsert` sem checar erro → conta PENDING órfã sem restaurante `:459-485`; **AUTH2-6** check de perfil OAuth nativo usa `.single()` (ruidoso) em vez de `maybeSingle()` `:600`; **AUTH2-7** trocar de fluxo (lojista→cliente) não reseta campos → `acceptedTerms` "fantasma" persiste `:925`; **AUTH2-8** avatar sem limite de bytes, acumula órfãos no storage `:209`; **AUTH2-9** query de `platform_settings` **dentro do render** (efeito colateral, pode loopar) `:729`; **AUTH2-10** double-submit possível antes do `setLoading` `:381`; **AUTH2-11** telefone salvo sem normalizar máscara → duplicatas escapam `:386`.

### Baixos
- **AUTH2-12** código morto (`!== 'LOGIN_EMAIL'` sempre true); **AUTH2-13** campo "CPF" aceita 14 dígitos (CNPJ) como válido `:1147`; **AUTH2-14** reset de senha/confirmação usa `window.location.origin` → **quebra deep link no Capacitor nativo** `store.tsx:1733`.

## 🧮 Cálculos — CALC-1..9

### Altos/Médios (válidos)
- **CALC-2** — `assignDriver` grava `driver_net_earnings`/`platform_fee` **sem arredondar** → lixo de ponto flutuante no banco (ex.: `8.280000000000001`). `store.tsx:1600-1605`.
- **CALC-3** — `assignDriver` usa **fórmula de split diferente** de `createOrder` (frete cheio × `customFeePct` vs piso + excesso); o **mesmo campo `custom_fee_pct`** é taxa do lojista em `createOrder` e taxa do entregador em `assignDriver` (colisão de semântica); pode gerar `platform_fee` negativo. `:1598-1605` vs `:962-1019`.
- **CALC-5** — Frete cobrado usa Haversine **reto**; ETA/distância real do entregador usa Haversine **×1.4** → frete não cobre a distância realmente rodada. `ClientView.tsx:421` vs `mapsService.ts:124`.
- **CALC-6** — Recibo não mostra **linha de desconto** → com cupom, `subtotal+entrega+serviço ≠ Total` exibido (cliente vê soma que não fecha). `ClientView.tsx:2175-2194`.
- **CALC-7** — Cupom PERCENT congela o desconto absoluto; mudar o carrinho depois não recalcula (demo: 20% de 50 = 10 fixo; vira 80 → ainda 10). `ClientView.tsx:490-496`.

### Baixos (robustez)
- **CALC-8** — `geocode` retorna `{lat:NaN}` → `deliveryFee=NaN` **passa pelo guard** (`NaN<0||NaN>100` é false) → `total=NaN` gravado. `store.tsx:999`, `mapsService.ts:45`.
- **CALC-9** — `Number(realProduct.price)` sem checar `NaN`/vazio no subtotal → `total=NaN` sem bloqueio (tolerância de 0,01 também falha com NaN). `store.tsx:942-952`.

## 🛡️ Resiliência / Erros / Offline — ERR-1..16

### Críticos
- **ERR-1** — `processSyncQueue` chama `clearSyncQueue()` em bloco no fim; `confirmDelivery/confirmPickup` retornam `false` (sem exceção) se o pedido não está no array local (comum após restart). **Confirmação de entrega feita offline é descartada pra sempre → split nunca dispara, entregador trabalha de graça.** `store.tsx:573-588,499`.
- **ERR-2** — Confirmação offline depende de `order.deliveryCode` em cache; se o WebView limpou o cache, entregador vê "Código inválido" com o código certo, sem recuperação. `store.tsx:462,503`.

### Altos
- **ERR-3** — **Toque na push não navega pra lugar nenhum**: só há listener `registration`; não existe `pushNotificationActionPerformed`. Toda a UX de notificação acionável (`data.orderId`) está morta. `store.tsx:243-272`.
- **ERR-5** — Listener `registration` anexado **depois** de `register()` → no Android o token pode disparar antes e nunca ser salvo em `push_token`; `update` do token sem checar erro. `store.tsx:260-267`.
- **ERR-6** — `cancelOrder` decide refund por estado local stale + `.catch(()=>{})` engole falha. (= CLI2-2)
- **ERR-7** — `release-payment-splits`/`refund` invocados com `.catch(()=>{})` no cliente → se o invoke falha (cold start/timeout), **repasse/reembolso some sem log nem retry nem ticket**. `store.tsx:540,1241,1290`.

### Médios
- **ERR-4** dois listeners `online` disparam `processSyncQueue` em paralelo (sem guard de reentrância) `store.tsx:715`+`DriverView.tsx:730`; **ERR-8** `updateOrderStatus`/`submitRating` não checam erro do update e notificam mesmo em falha `:1481,1564`; **ERR-9** cache de orders/restaurants sem TTL nem checagem de dono → pedidos do usuário anterior aparecem após troca de conta `:127`; **ERR-10** `getSession()` no resume/refresh fora do timeout → `fetchInProgressRef` pode travar permanentemente `:695`; **ERR-11** resume não chama `processSyncQueue` e Android não dispara `online` ao voltar → fila offline parada `:695-713`; **ERR-12** self-healing com `catch{}` vazio cria CLIENT/APPROVED sem log `:376-391`.

### Baixos
- **ERR-13** `useAndroidBack` sem try/catch (botão voltar inerte se handler lança); **ERR-14** `AddressModal` rejeita Promise com string e com objeto (formatos mistos); **ERR-15** `setupNotifications` mascara erro real como "não suportado"; **ERR-16** `submitRating` pode propagar `NaN` da média ao banco (deriva do M2).

> **Total acumulado: ~307 problemas** (Parte 1: 61 · Parte 2: 93 · Parte 3: ~50 · Parte 4: ~53 · Parte 5: ~50).

---
---

# Parte 6 — DriverView, edge functions restantes, tipos e navegação

> 6ª rodada (4 agentes): DriverView completo, edge functions não-pagamento, types.ts/mapeamento (validado contra schema real), navegação/componentes. ~54 achados.

## 🧬 Tipos & mapeamento — TYPE-1..11 (validado contra schema de produção)

### Críticos
- **TYPE-1 ✅** — `submitRating` faz UPDATE com `ratings_count` numa coluna **que NÃO existe** em `restaurants` (só há `rating`, `reviews`). O Postgres rejeita o UPDATE **inteiro** e não há checagem de `error` → **nota, contagem E comentários da loja NUNCA são salvos**. `store.tsx:1582-1586`.
- **TYPE-2 ✅** — `Restaurant.ratingsCount` lê `r.ratings_count` (coluna inexistente) → sempre 0; exibe "(0) avaliações" e zera a base da média. `store.tsx:327`.
- **TYPE-3** — `mapProfile` faz `driver_score !== undefined ? Number(...) : 100`, mas o banco devolve `null` (não undefined) → `Number(null)=0`. Entregador com score null recebe **0 pts → app bloqueado** (<70). *(latente: 0/1 driver afetado hoje; dispara em driver novo sem score)*. `store.tsx:194`.

### Médios/Baixos
- **TYPE-4 ✅** `Restaurant.deliveryFee`/`minOrder` não têm coluna no banco → sempre `undefined` (frete/pedido mínimo por loja não existem) `types.ts:140`; **TYPE-5** `lastOrderTimestamp` existe no banco mas `mapProfile` não lê; **TYPE-6 ✅** `Order.feedback` é campo fantasma (sem coluna); **TYPE-7** `updateUserProfile` não grava `pushToken` (reforça ERR-5); **TYPE-8** default de leitura de `status` é `APPROVED` enquanto banco/criação é `PENDING` → parceiro não-aprovado pode aparecer aprovado na UI; **TYPE-9** `Order.changeFor` (troco) morto; **TYPE-10** falta um `mapRestaurant` único (Realtime vs fetchData divergem); **TYPE-11** `coords` jsonb lido sem validar `{lat,lng}` numéricos.

## 🏍️ DriverView — ENT2-1..17

### Críticos
- **ENT2-2** — Foto de entrega é **descartada em modo offline**: `confirmDelivery` offline retorna `true` sem enfileirar a foto; o upload falha no catch silencioso e nunca é reenviado. Entrega offline = sem comprovante. `DriverView.tsx:803-837`.
- **ENT2-3** — `assignDriver` só recalcula `driver_net_earnings` para quem tem `customFeePct`; no caminho padrão mantém o valor da criação → exibido (fallback com fee atual) pode divergir do gravado. `store.tsx:1596-1606`.

### Médios
- **ENT2-1** janela temporal de "7 dias" diverge entre soma de ganhos e contagem `:585,1341`; **ENT2-4** `gpsBlocked` nunca volta a `false` → entregador trava offline após liberar GPS `:752`; **ENT2-5/ENT2-6** `watchPosition` reinicia a cada toggle online/offline (bateria + grava local extra); **ENT2-7** estados de devolução/câmera não resetam ao concluir → modal reabre em estado errado `:1104`; **ENT2-8** câmera ao vivo **nunca para no unmount** (stream/LED vazando) `:684-725`; **ENT2-9** foto não corrige orientação/espelho; **ENT2-10** código de entrega sem `trim()`/normalização → "inválido" com código certo `:1701`; **ENT2-11** perde GPS depois de online e segue "Disponível" → pedidos roteados sem posição `:492`.

### Baixos
- **ENT2-12** `confirmPickup/Delivery` ignoram `error` → falha de rede vira "Código inválido"; **ENT2-13** push usa `restaurantName` stale; **ENT2-14** restaurante sem `coords` → `NaNkm`/crash na lista; **ENT2-15** `clearSyncQueue` incondicional (= ERR-1); **ENT2-16** histórico exibe `R$ NaN` sem `||0` `:1254`; **ENT2-17** `hasBase` aceita `coords:{}` sem lat/lng numéricos.

## 📡 Edge Functions (não-pagamento) — EDGE-1..10

### Altos
- **EDGE-1** — `delete-auth-user` deleta o `auth.user` mas **não faz cleanup server-side** de `profiles`/`restaurants`/`orders` (depende do front que engole erro) → órfãos. `delete-auth-user/index.ts:40`.
- **EDGE-3** — `send-push-notification` repassa `title`/`body`/`data` **arbitrários** ao FCM sem sanitização → **phishing in-app** ("Conta aprovada", "Pagamento recebido") para qualquer `userId`; `data` arbitrário pode disparar deep-links. (compõe com M13)

### Médios
- **EDGE-2** `delete-auth-user` não checa `authError` do `getUser()` (inconsistente com push); **EDGE-4** FCM falha mas a função retorna `200 {sent:true}` (falhas silenciosas de push) `_shared/pushNotification.ts:130`; **EDGE-5** sem rate limit; `notifyDrivers` faz fan-out N abusável (amplificação); **EDGE-6** `create-asaas-account` tem race/gap de idempotência no update de `profiles` → **subcontas Asaas duplicadas** `:115-142`; **EDGE-7 ✅** `release-driver-split` confirmado morto, mas se religado **não valida `order.driver_id===driverId` nem status** → desviar ganhos de pedido alheio para a própria subconta.

### Baixos
- **EDGE-8** CORS `*` em todas (inclui as de dinheiro); **EDGE-9** `create-asaas-account` retorna `details: asaasData` ao cliente e loga PII; **EDGE-10** respostas de erro do `delete-auth-user` sem `Content-Type: json`.

## 🧭 Navegação / Componentes / Infra — UI-1..16

### Críticos
- **UI-1** — `RoleSwitcher` **nunca é renderizado/importado** → troca de papel do admin é **feature morta**; `currentRole` fica sempre `null` e toda a lógica dependente em `App.tsx` é código morto. `components/RoleSwitcher.tsx`.

### Altos
- **UI-3** mapa de tracking não atualiza o marcador de destino quando `destCoords` muda (geocode assíncrono) `DriverTrackingMap.tsx`; **UI-4** mapa sem guard de coords `NaN`/inválidas → exceção no init; **UI-5** som de novo pedido cria `AudioContext` a cada beep e **nunca fecha** (limite ~6 → para de tocar) + `suspended` sem `resume()` → **lojista deixa de ser alertado, perde pedidos** `RestaurantView.tsx:120-143`; **UI-6** `components/ErrorBoundary.tsx` usa `window.addEventListener` e **não captura erros de render** (falsa proteção; `[object Object]`).

### Médios/Baixos
- **UI-2** `currentRole` não reseta no `signOut` (admin "preso" na última view) *(a confirmar)*; **UI-7** tiles OSM + ícones via `unpkg.com` (CDN externo, sem fallback offline); **UI-8** mapa Leaflet: `import()` async sem flag de cancelamento → vazamento se desmontar antes do await; **UI-9** `useApi` `execute`/`refetch` muda de identidade com função inline (loop); **UI-10** `getDerivedStateFromError` chama `window.location.reload()` (efeito colateral; loop de reload sem backoff) `App.tsx:20`; **UI-11** = ENT2-5 (watch GPS re-registra); **UI-12** Realtime assina tabelas **inteiras** sem filtro → todo usuário recebe mudanças de pedidos/perfis alheios (reforça vazamento de PII p/ logados); **UI-13** `GoogleAuth.initialize` no topo do módulo sem guard de plataforma; **UI-14** sem controle de StatusBar/SplashScreen; **UI-15** tutorial marca "visto" ao fechar e não há como reabrir; **UI-16** `NotificationContainer` (possível componente morto) sem safe-area.

> **Total acumulado: ~361 problemas** (P1: 61 · P2: 93 · P3: ~50 · P4: ~53 · P5: ~50 · P6: ~54).

---
---

# Parte 7 — Storage/RLS, promoções/horários, concorrência e UX

> 7ª rodada (4 agentes): Storage + RLS restante (validado por queries reais), promoções/cupons/horários, race conditions transversais, estados vazios/UX textual. ~46 achados.

## 🗄️ Storage & RLS restante — SEC2-1..6 (validado com queries reais)

### Críticos
- **SEC2-1 ✅** — Único bucket `avatars` é **público** (`public=true`) e guarda as fotos de **entrega** (`delivery/{orderId}-{ts}.jpg`) e **devolução** (`returns/...`), lidas via `getPublicUrl` (sem signed URL, ignora RLS). Comprovantes com fachada/endereço/rosto do cliente ficam acessíveis a **qualquer URL, sem login**; nome enumerável (`orderId` + `Date.now()`). `DriverView.tsx:812,1646`.
- **SEC2-2 ✅** — Policy `avatars_insert` só exige `bucket_id='avatars'` (**não amarra o path ao `auth.uid()`**) + `upsert:true` no código → **qualquer usuário logado sobrescreve a foto/comprovante de qualquer pedido** (fraude em disputa de reembolso), logo de loja, avatar alheio.

### Altos/Médios
- **SEC2-3 ✅** policies UPDATE/DELETE de storage são "mortas" (esperam UID como 1ª pasta, mas o path nunca tem UID) → órfãos nunca limpos + falsa sensação de proteção; **SEC2-4** bucket sem `file_size_limit`/`allowed_mime_types` → upload irrestrito (DoS/hospedar HTML/SVG malicioso em domínio confiável); **SEC2-5 ✅** `products_select` é `USING(true)` e expõe **`owner_price`** (margem/custo do lojista) publicamente; **SEC2-6** `support_tickets` sem policy de DELETE (impossível expurgar PII/LGPD) e `admin_note` (nota interna) visível ao dono do ticket.
- *(Verificado: nenhuma tabela `public` sem RLS; `support_tickets` NÃO vaza entre clientes; `promotions` não existe como tabela — fica no JSON de `restaurants`.)*

## 🎟️ Promoções / Cupons / Horários — PROMO-1..14

### Críticos
- **PROMO-1** — Desconto é 100% confiado do cliente: `createOrder` recebe `discountAmount` pronto, **nunca valida o cupom no servidor** (código do cupom nem é enviado). Cliente pode forjar `discountAmount = subtotal` sem cupom → loja recebe sobre `finalProductTotal = 0`. `store.tsx:881,1009`.
- **PROMO-2** — Frete grátis idem: `deliveryFeeOverride=0` aceito sem cupom `FREE_DELIVERY` validado → frete grátis universal forjável. `store.tsx:998`.

### Altos
- **PROMO-3** `maxUsage`/`usageCount` nunca verificados nem incrementados → cupom de uso único usável infinitas vezes; **PROMO-4** `isRestaurantOpenNow` **nunca é chamada** → horário de funcionamento é **feature morta** (só vale o toggle manual `is_open`; loja aceita 24h fora do horário); **PROMO-5** toda a lógica de horário usa o fuso **do dispositivo**, não `America/Cuiaba` (UTC-4); **PROMO-6** turno que cruza meia-noite (18h–02h) → `close<open` → loja considerada **sempre fechada**; sem múltiplos turnos.

### Médios/Baixos
- **PROMO-7** "válido até" vira UTC-midnight → cupom expira ~4h antes (20h do dia anterior em Apiacás); **PROMO-8** PERCENT sem teto (>100% / negativo) e `PRODUCT_SPECIFIC` aplica no subtotal inteiro ignorando `productIds`; **PROMO-9** desconto não amarrado à loja no servidor (deriva de PROMO-1); **PROMO-10** promoções/horários read-modify-write do estado local (perda concorrente); **PROMO-11** `FREE_DELIVERY` usa piso R$30 hardcoded, ignora `minOrderValue`; **PROMO-12** match de cupom sem `.trim()`; **PROMO-13** sem data fim vira 7 dias silencioso; **PROMO-14** editar promoção reseta `validFrom`/`usageCount`.

## 🔀 Concorrência / Race Conditions — RACE-1..10

### Críticos
- **RACE-2** — Admin dispara `refund` num pedido `DELIVERED` cujo split **já foi pago** (refund só bloqueia DELIVERED para não-admin e **não checa `driver_split_released`**) → **paga split E reembolsa = perda dupla**. `refund-asaas-payment` vs `release-payment-splits`.
- **RACE-1** — Cancelar pedido recém-pago decide reembolso por `order.status` **local stale** → se o webhook marcou PENDING mas o Realtime não chegou, cancela sem reembolsar → **cliente perde o dinheiro**. `store.tsx:1240`.

### Altos
- **RACE-3** `assignDriver` grava `platform_fee`/`driver_net_earnings` a partir do `order` local stale; **RACE-4** `submitRating` incrementa rating/reviews read-modify-write do estado local (perde avaliação concorrente); **RACE-5** promoções RMW (= PROMO-10); **RACE-6** patch Realtime antigo sobrescreve mutation otimista (sem coluna de versão/`updated_at`).

### Médios
- **RACE-7** `clearSyncQueue` apaga itens que falharam (= ERR-1, reforçado); **RACE-8** `fetchInProgressRef` pode travar permanentemente (frágil, sem watchdog); **RACE-9** idempotência de pedido é select-then-insert (TOCTOU entre abas → **pedido + cobrança duplicados**); **RACE-10** `updateOrderStatus` e `assignDriver` **sem guard condicional de status** → pedido CANCELLED com entregador atribuído / transições inválidas vencem.

## 💬 UX / Estados vazios / Conteúdo — UX-1..16

### Altos
- **UX-1** erros técnicos do Postgres/RLS/Asaas (em inglês) vazam crus na tela de cadastro/perfil `AuthView.tsx:487,521`; **UX-2** "Pedidos Recentes" do admin **não ordena por data** (`slice(0,6)` sem sort) → mostra antigos como recentes; **UX-3** histórico do entregador mostra ganho verde (ou `R$ NaN`) em pedidos cancelados/falhados.

### Médios
- **UX-4** excluir produto sem confirmação (inconsistente com promoção que confirma); **UX-5** colunas do Kanban da cozinha sem estado vazio (tela "quebrada" sem pedidos); **UX-6** toast fixo de 4,5s corta instruções longas + sem safe-area; **UX-7** `alert/confirm` nativos em pontos de fluxo (sair, limpar carrinho, copiar PIX); **UX-8** pluralização "1 Itens"/"item(s)"; **UX-9** remover cartão com `confirm()` nativo; **UX-10** comentário só-espaços renderiza aspas vazias.

### Baixos
- **UX-11** typo "imagem válido"; **UX-12** categoria `" Japonesa"` com espaço → fragmenta filtro; **UX-13** datas sem `timeZone` e formatos inconsistentes entre telas; **UX-14** cards de restaurante/loja sem `onError` de imagem; **UX-15** vitrine "Em destaque" re-embaralha a cada update Realtime (itens pulam sob o dedo); **UX-16** modal PIX não mostra contador de expiração.

> **Total acumulado: ~407 problemas** (P1: 61 · P2: 93 · P3: ~50 · P4: ~53 · P5: ~50 · P6: ~54 · P7: ~46).

---
---

## ❌ Falsos positivos (descartados após validar no banco de produção)

- ~~`cancelled_at`/`timestamp` gravados como número em coluna TIMESTAMPTZ~~ → as colunas são **`bigint`**; `Date.now()` está **correto**.
- ~~Idempotência anti-duplicação quebrada por comparar número com timestamp~~ → `timestamp` é `bigint`, comparação correta.
- ~~Tabela `orders` / colunas sem migration~~ → **todas existem** no banco.
- ~~CHECK de status sem os status novos~~ → o CHECK **já tem os 10 status**.
- ~~`driver_split_released` sem coluna~~ → **existe** (a lógica de idempotência ainda é bug — ver C2).
- ~~`platform_settings.service_fee` inexistente~~ → **existe**.
- ~~RLS de `platform_settings` admin-only bloqueia clientes~~ → SELECT **liberado para qualquer logado**.
- ~~Race condition de aceite de pedido~~ → **protegida** por `.is('driver_id', null).maybeSingle()`.
- ~~Cobertura de badges de status no ClientView incompleta~~ → **completa** (10 status tratados).
- ~~**CALC-1**: plataforma paga do próprio bolso em entregas curtas (piso do entregador > frete)~~ → **não dispara em produção**: `min_delivery_fee = 4.00` = base do frete do client; conservação `restaurantNet+driver+platform = total` fecha. **Latente** — só vira bug se admin subir `min_delivery_fee` acima de 4 (ver ADM-4, sem validação).
- ~~**CALC-4**: default de `driver_fee_pct` divergente (0.08 vs 0)~~ → produção tem `driver_fee_pct = 40`; só afeta se a linha `platform_settings` sumir. **Latente/baixo.**
- ~~**AUTH2-3**: `birth_date` `DD/MM/AAAA` faz insert falhar~~ → coluna é **`text`**; insert **não falha**. Sobra só inconsistência cosmética de formato.
