/// <reference types="jest" />
import {
  saveActiveOrderToOffline,
  getActiveOrderFromOffline,
  clearOfflineActiveOrder,
  saveCartToOffline,
  getCartFromOffline,
  clearOfflineCart,
  clearExpiredCache,
} from '../../services/offlineService';

// Mock do localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (global as any).localStorage = localStorageMock;
});

describe('OfflineService', () => {
  const mockOrder: any = {
    id: 'test-order-123',
    restaurantId: 'test-restaurant',
    items: [{ id: 'item-1', name: 'Test Item', price: 10, quantity: 1 }],
    total: 15,
  };

  describe('saveActiveOrderToOffline', () => {
    it('deve salvar o pedido no localStorage', () => {
      saveActiveOrderToOffline(mockOrder);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'deliverycity_active_order',
        expect.stringContaining('"value"')
      );
    });

    it('deve lidar com erros do localStorage', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Erro de localStorage');
      });
      
      expect(() => saveActiveOrderToOffline(mockOrder)).not.toThrow();
    });
  });

  describe('getActiveOrderFromOffline', () => {
    it('deve recuperar o pedido do localStorage', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        value: mockOrder,
        expiry: Date.now() + 24 * 60 * 60 * 1000
      }));
      
      const result = getActiveOrderFromOffline();
      expect(result).toEqual(mockOrder);
    });

    it('deve retornar null se não houver pedido', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const result = getActiveOrderFromOffline();
      expect(result).toBeNull();
    });

    it('deve retornar null se o cache expirou', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        value: mockOrder,
        expiry: Date.now() - 1000
      }));
      
      const result = getActiveOrderFromOffline();
      expect(result).toBeNull();
    });
  });

  describe('clearOfflineActiveOrder', () => {
    it('deve remover o pedido do localStorage', () => {
      clearOfflineActiveOrder();
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('deliverycity_active_order');
    });
  });

  describe('saveCartToOffline', () => {
    it('deve salvar o carrinho no localStorage', () => {
      const mockCart = [{ id: 'item-1', name: 'Test Item', price: 10, quantity: 2 }];
      
      saveCartToOffline(mockCart);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'deliverycity_cart',
        expect.stringContaining('"value"')
      );
    });
  });

  describe('getCartFromOffline', () => {
    it('deve recuperar o carrinho do localStorage', () => {
      const mockCart = [{ id: 'item-1', name: 'Test Item', price: 10, quantity: 2 }];
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        value: mockCart,
        expiry: Date.now() + 24 * 60 * 60 * 1000
      }));
      
      const result = getCartFromOffline();
      expect(result).toEqual(mockCart);
    });
  });

  describe('clearOfflineCart', () => {
    it('deve remover o carrinho do localStorage', () => {
      clearOfflineCart();
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('deliverycity_cart');
    });
  });

  describe('clearExpiredCache', () => {
    it('deve remover caches expirados', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'deliverycity_expired') {
          return JSON.stringify({
            value: 'expired',
            expiry: Date.now() - 1000
          });
        }
        if (key === 'deliverycity_valid') {
          return JSON.stringify({
            value: 'valid',
            expiry: Date.now() + 24 * 60 * 60 * 1000
          });
        }
        return null;
      });
      
      localStorageMock.keys = () => ['deliverycity_expired', 'deliverycity_valid'];
      
      // Simular Object.keys
      (localStorageMock as any).keys = jest.fn(() => ['deliverycity_expired', 'deliverycity_valid']);
      
      clearExpiredCache();
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('deliverycity_expired');
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('deliverycity_valid');
    });
  });
});