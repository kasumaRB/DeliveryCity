import { Order } from '../types';

// Chaves para o localStorage
const ACTIVE_ORDER_KEY = 'deliverycity_active_order';
const CART_KEY = 'deliverycity_cart';
const SYNC_QUEUE_KEY = 'deliverycity_sync_queue';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 horas

// Funções utilitárias de cache com expiração
const getCacheWithExpiry = <T>(key: string): T | null => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    
    const data = JSON.parse(item);
    if (Date.now() > data.expiry) {
      localStorage.removeItem(key);
      return null;
    }
    
    return data.value;
  } catch (error) {
    console.error(`Erro ao ler cache ${key}:`, error);
    return null;
  }
};

const setCacheWithExpiry = <T>(key: string, value: T): void => {
  try {
    const item = {
      value,
      expiry: Date.now() + CACHE_EXPIRY
    };
    localStorage.setItem(key, JSON.stringify(item));
  } catch (error) {
    console.error(`Erro ao salvar cache ${key}:`, error);
  }
};

/**
 * Salva o pedido ativo no armazenamento local do dispositivo.
 * @param order - O objeto do pedido a ser salvo.
 */
export const saveActiveOrderToOffline = (order: Order): void => {
  try {
    setCacheWithExpiry(ACTIVE_ORDER_KEY, order);
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
    return getCacheWithExpiry<Order>(ACTIVE_ORDER_KEY);
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
 * Salva o carrinho no armazenamento local.
 * @param cart - O objeto do carrinho a ser salvo.
 */
export const saveCartToOffline = (cart: any): void => {
  try {
    setCacheWithExpiry(CART_KEY, cart);
  } catch (error) {
    console.error("Falha ao salvar carrinho offline:", error);
  }
};

/**
 * Busca o carrinho do armazenamento local.
 * @returns O objeto do carrinho ou null se não houver nenhum.
 */
export const getCartFromOffline = (): any | null => {
  try {
    return getCacheWithExpiry<any>(CART_KEY);
  } catch (error) {
    console.error("Falha ao buscar carrinho offline:", error);
    return null;
  }
};

/**
 * Limpa o carrinho do armazenamento local.
 */
export const clearOfflineCart = (): void => {
  localStorage.removeItem(CART_KEY);
};

/**
 * Limpa todos os caches expirados do sistema.
 */
export const clearExpiredCache = (): void => {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith('deliverycity_')) {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const data = JSON.parse(item);
          if (data.expiry && Date.now() > data.expiry) {
            localStorage.removeItem(key);
          }
        }
      } catch (error) {
        console.error(`Erro ao limpar cache expirado ${key}:`, error);
      }
    }
  });
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

const SYNC_QUEUE_TTL = 4 * 60 * 60 * 1000; // 4 horas

/**
 * Busca a fila de confirmações pendentes de sincronização.
 * Itens com mais de 4 horas são descartados automaticamente.
 * @returns Um array de confirmações pendentes.
 */
export const getSyncQueue = (): OfflineConfirmation[] => {
  try {
    const queueJson = localStorage.getItem(SYNC_QUEUE_KEY);
    if (!queueJson) return [];
    const all: OfflineConfirmation[] = JSON.parse(queueJson);
    const cutoff = Date.now() - SYNC_QUEUE_TTL;
    const fresh = all.filter(item => item.timestamp > cutoff);
    if (fresh.length !== all.length) {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(fresh));
    }
    return fresh;
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
