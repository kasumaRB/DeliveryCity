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
