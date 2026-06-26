# Auditoria Completa — DeliveryCity (fluxo de pedido → entrega → devolução)

> Investigação por 5 agentes paralelos (store, ClientView, RestaurantView+DriverView, AdminView+EdgeFunctions, transversal).
> Achados validados contra o banco de produção real (projeto `fnhjxqppcrbepgwcrqzw`).
> Falsos positivos já removidos (ver seção final).

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
