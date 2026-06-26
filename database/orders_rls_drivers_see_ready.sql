-- Migration: permite entregadores aprovados verem pedidos READY sem driver atribuído
--
-- Problema: a política orders_select só permitia ver pedidos onde
-- driver_id = auth.uid(). Pedidos com driver_id = NULL (aguardando entregador)
-- eram invisíveis para todos os drivers — jamais apareciam na lista de disponíveis.
--
-- Solução: nova política permissiva que libera SELECT para DRIVER APPROVED
-- em pedidos status=READY e driver_id IS NULL.

CREATE POLICY "orders_select_available_for_drivers" ON public.orders
  FOR SELECT
  USING (
    status = 'READY'
    AND driver_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'DRIVER'
        AND p.status = 'APPROVED'
    )
  );
