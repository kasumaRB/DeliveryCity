import { Order } from '../types';

// Chaves para o localStorage
const ACTIVE_ORDER_KEY = 'deliverycity_active_order';
const SYNC_QUEUE_KEY = 'deliverycity_sync_queue';

/**
 * Salva o pedido ativo no armazenamento local do dispositivo.
 * @param order - O objeto do pedido a ser salvo.
 */
export const saveActiveOrderToOffline = (order: Order): void => {
  try {
    const orderJson = JSON.stringify(order);
    localStorage.setItem(ACTIVE_ORDER_KEY, orderJson);
  } catch (error) {
    console.error("Falha ao salvar pedido offline:", error);
  }
};

/**
 * Busca o pedido ativo do armazenamento local.
 * @returns O objeto do pedido ou null se não houver nenhum.
 */
export const getActiveOrderFromOffline = (): Order | null => {
  try {
    const orderJson = localStorage.getItem(ACTIVE_ORDER_KEY);
    return orderJson ? JSON.parse(orderJson) : null;
  } catch (error) {
    console.error("Falha ao buscar pedido offline:", error);
    return null;
  }
};

/**
 * Limpa o pedido ativo do armazenamento local.
 */
export const clearOfflineActiveOrder = (): void => {
  localStorage.removeItem(ACTIVE_ORDER_KEY);
};

/**
 * Representa uma confirmação que foi feita offline e precisa ser sincronizada.
 */
export interface OfflineConfirmation {
  orderId: string;
  code: string;
  type: 'pickup' | 'delivery';
  timestamp: number;
}

/**
 * Busca a fila de confirmações pendentes de sincronização.
 * @returns Um array de confirmações pendentes.
 */
export const getSyncQueue = (): OfflineConfirmation[] => {
  try {
    const queueJson = localStorage.getItem(SYNC_QUEUE_KEY);
    return queueJson ? JSON.parse(queueJson) : [];
  } catch (error) {
    console.error("Falha ao buscar fila de sincronização:", error);
    return [];
  }
};

/**
 * Adiciona uma nova confirmação à fila de sincronização.
 * @param confirmation - O objeto de confirmação a ser adicionado.
 */
export const addToSyncQueue = (confirmation: OfflineConfirmation): void => {
  try {
    const queue = getSyncQueue();
    queue.push(confirmation);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error("Falha ao adicionar na fila de sincronização:", error);
  }
};

/**
 * Limpa a fila de sincronização (usado após o sucesso do envio ao servidor).
 */
export const clearSyncQueue = (): void => {
  localStorage.removeItem(SYNC_QUEUE_KEY);
};
