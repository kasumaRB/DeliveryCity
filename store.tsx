import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Restaurant,
  Order,
  OrderStatus,
  Product,
  UserRole,
  PaymentMethod,
  UserProfile,
  UserAddress,
  OrderRating,
  OrderItem,
} from './types';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { getRealDistances, calculateHaversine } from './services/mapsService';
import {
  saveActiveOrderToOffline,
  clearOfflineActiveOrder,
  getSyncQueue,
  clearSyncQueue,
  addToSyncQueue,
  saveCartToOffline,
  getCartFromOffline,
  clearOfflineCart,
} from './services/offlineService';
import { PushNotifications } from '@capacitor/push-notifications';

const STORAGE_KEY_RESTAURANTS = 'deliverycity_cache_restaurants';
const STORAGE_KEY_ORDERS = 'deliverycity_cache_orders';
const STORAGE_KEY_PROFILES = 'deliverycity_cache_profiles';

interface AppContextType {
  restaurants: Restaurant[];
  orders: Order[];
  profiles: UserProfile[];
  currentRole: UserRole | null;
  isLoading: boolean;
  isSupabaseConnected: boolean | null;
  session: Session | null;
  currentUserProfile: UserProfile | null;
  cart: any[];
  setRole: (role: UserRole | null) => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  loginAsTestUser: (profileId: string) => Promise<void>;
  createOrder: (
    restaurantId: string,
    items: { product: Product; quantity: number }[],
    paymentMethod: PaymentMethod,
    address: string,
    customerName: string,
    paymentId?: string,
    addressCoords?: { lat: number; lng: number },
    deliveryFeeOverride?: number
  ) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  confirmPickup: (orderId: string, code: string) => Promise<boolean>;
  confirmDelivery: (orderId: string, code: string) => Promise<boolean>;
  processSyncQueue: () => Promise<void>;
  submitRating: (orderId: string, rating: OrderRating) => Promise<void>;
  assignDriver: (orderId: string, driverId: string) => Promise<void>;
  registerProfile: (profile: Partial<UserProfile>) => Promise<void>;
  updateUserProfile: (id: string, data: Partial<UserProfile>) => Promise<void>;
  deleteUserProfile: (id: string) => Promise<void>;

  updateRestaurant: (id: string, data: Partial<Restaurant>) => Promise<void>;
  updateMenu: (restaurantId: string, product: Product) => Promise<void>;
  updateProduct: (restaurantId: string, productId: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (restaurantId: string, productId: string) => Promise<void>;

  addAddress: (address: Omit<UserAddress, 'id'>) => Promise<UserAddress | void>;
  updateAddress: (address: UserAddress) => Promise<void>;
  deleteAddress: (addressId: string) => Promise<void>;
  refreshData: () => Promise<void>;
  setupNotifications: (userId?: string) => Promise<void>;

  addToCart: (item: any) => void;
  removeFromCart: (productId: string) => void;
  updateCartItemQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  requestPasswordReset: (email: string) => Promise<{ error: any }>;
  realDistances: Record<string, any>;
  recalculateDistances: (
    originAddress: string,
    originCoords: { lat: number; lng: number }
  ) => Promise<void>;
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>(() =>
    JSON.parse(localStorage.getItem(STORAGE_KEY_RESTAURANTS) || '[]')
  );
  const [orders, setOrders] = useState<Order[]>(() =>
    JSON.parse(localStorage.getItem(STORAGE_KEY_ORDERS) || '[]')
  );
  const [profiles, setProfiles] = useState<UserProfile[]>(() =>
    JSON.parse(localStorage.getItem(STORAGE_KEY_PROFILES) || '[]')
  );
  const [cart, setCart] = useState<any[]>(() => getCartFromOffline() || []);

  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean | null>(null);
  const [realDistances, setRealDistances] = useState<Record<string, any>>({});

  const currentUserProfile = session ? profiles.find(p => p.id === session.user.id) || null : null;

  useEffect(() => {
    if (currentUserProfile) setCurrentRole(currentUserProfile.role);
  }, [currentUserProfile]);

  useEffect(() => {
    saveCartToOffline(cart);
  }, [cart]);

  const mapProfile = (p: any): UserProfile => ({
    id: p.id,
    email: p.email,
    name: p.name,
    businessName: p.business_name,
    role: (p.role?.toUpperCase() as UserRole) || UserRole.CLIENT,
    status: (p.status?.toUpperCase() as any) || 'APPROVED',
    cpf: p.cpf || '',
    cnpj: p.cnpj || '',
    birthDate: p.birth_date || '',
    vehicleType: p.vehicle_type || '',
    licensePlate: p.license_plate || '',
    pixKey: p.pix_key || '',
    pagseguroRecipientId: p.pagseguro_recipient_id || '',
    phoneNumber: p.phone_number || '',
    savedAddresses: Array.isArray(p.saved_addresses) ? p.saved_addresses : [],
    commissionBalance: Number(p.balance || 0),
    averageRating: Number(p.average_rating || 0),
    ratingsCount: Number(p.ratings_count || 0),
    createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
    description: p.description || '',
    workingHours: p.working_hours || '',
    currentLocation: p.current_location || undefined,
  });

  const mapOrder = (o: any): Order => ({
    id: o.id,
    restaurantId: o.restaurant_id,
    restaurantName: o.restaurant_name,
    items: o.items || [],
    subtotal: Number(o.subtotal || 0),
    deliveryFee: Number(o.delivery_fee || 0),
    platformFee: Number(o.platform_fee || 0),
    driverNetEarnings: Number(o.driver_net_earnings || 0),
    restaurantNetEarnings: Number(o.restaurant_net_earnings || 0),
    total: Number(o.total || 0),
    paymentMethod: o.payment_method,
    status: o.status,
    customerAddress: o.customer_address,
    customerName: o.customer_name,
    customerId: o.customer_id,
    timestamp: o.timestamp ? new Date(o.timestamp).getTime() : Date.now(),
    driverId: o.driver_id,
    pickupCode: o.pickup_code,
    deliveryCode: o.delivery_code,
    rating: o.rating,
    paymentId: o.payment_id,
    coords: o.coords,
  });

  const setupNotifications = async (userId?: string) => {
    try {
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive === 'granted') {
        await PushNotifications.register();
        if (userId) {
          PushNotifications.addListener('registration', async token => {
            await supabase.from('profiles').update({ push_token: token.value }).eq('id', userId);
          });
        }
      }
    } catch (e) {
      console.warn('PushNotifications não suportadas.');
    }
  };

  let lastFetchTime = 0;
  let cachedData: { restaurants?: any[]; orders?: any[]; profiles?: any[] } = {};

  const fetchData = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchTime < 2000) return;
    lastFetchTime = now;

    try {
      const [restData, orderData, profileData] = await Promise.all([
        supabase.from('restaurants').select('*').order('rating', { ascending: false }),
        supabase.from('orders').select('*').order('timestamp', { ascending: false }).limit(100),
        supabase.from('profiles').select('*'),
      ]);

      if (restData.data) {
        const mapped = restData.data.map((r: any) => ({
          ...r,
          ownerId: r.owner_id,
          menu: r.menu || [],
          rating: Number(r.rating || 0),
          pagseguroRecipientId: r.pagseguro_recipient_id,
        }));
        setRestaurants(mapped);
        localStorage.setItem(STORAGE_KEY_RESTAURANTS, JSON.stringify(mapped));
        cachedData.restaurants = mapped;
      }

      if (orderData.data) {
        const mapped = orderData.data.map(o => mapOrder(o));
        setOrders(mapped);
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(mapped));
        cachedData.orders = mapped;
      }

      if (profileData.data) {
        const mapped = profileData.data.map(p => mapProfile(p));
        setProfiles(mapped);
        localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(mapped));
        cachedData.profiles = mapped;
      }
      setIsSupabaseConnected(true);
    } catch (err) {
      setIsSupabaseConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmPickup = async (orderId: string, code: string): Promise<boolean> => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return false;
    if (!navigator.onLine) {
      addToSyncQueue({ orderId, code, type: 'pickup', timestamp: Date.now() });
      saveActiveOrderToOffline({ ...order, status: OrderStatus.OUT_FOR_DELIVERY });
      setOrders(prev =>
        prev.map(o => (o.id === orderId ? { ...o, status: OrderStatus.OUT_FOR_DELIVERY } : o))
      );
      return true;
    }
    if (order.pickupCode === code) {
      await supabase
        .from('orders')
        .update({ status: OrderStatus.OUT_FOR_DELIVERY })
        .eq('id', orderId);
      await fetchData();
      return true;
    }
    return false;
  };

  const confirmDelivery = async (orderId: string, code: string): Promise<boolean> => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return false;
    if (!navigator.onLine) {
      addToSyncQueue({ orderId, code, type: 'delivery', timestamp: Date.now() });
      clearOfflineActiveOrder();
      setOrders(prev =>
        prev.map(o => (o.id === orderId ? { ...o, status: OrderStatus.DELIVERED } : o))
      );
      return true;
    }
    if (order.deliveryCode === code) {
      await supabase.from('orders').update({ status: OrderStatus.DELIVERED }).eq('id', orderId);
      await fetchData();
      return true;
    }
    return false;
  };

  const processSyncQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const queue = getSyncQueue();
    if (queue.length === 0) return;

    for (const item of queue) {
      try {
        if (item.type === 'pickup') await confirmPickup(item.orderId, item.code);
        else await confirmDelivery(item.orderId, item.code);
      } catch (e) {
        console.error('Erro na sincronização offline:', e);
      }
    }
    clearSyncQueue();
    await fetchData();
  }, [orders]);

  const initializeApp = async () => {
    try {
      // Pede permissão de notificação nativa (ignorado na web silenciosamente)
      await setupNotifications();
    } catch (e) {
      console.error('Erro na inicialização:', e);
    }
  };

  useEffect(() => {
    initializeApp();
  }, []);

  // Listener de autenticação englobando toda a reidratação inicial e eventos de login para evitar conflitos de Locks
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      // Quando retorna do redirect OAuth ou recarrega a janela do app
      if (['INITIAL_SESSION', 'SIGNED_IN'].includes(event)) {
        setIsLoading(true);
        setSession(newSession);

        // Timeout de segurança: desbloqueia a UI após 8s caso o fetchData trave
        const loadingTimeout = setTimeout(() => {
          setIsLoading(false);
        }, 8000);

        try {
          await fetchData();

          // Garante a existência do perfil (útil para login OAuth onde o redirect ocorre antes do App criar o registro)
          if (newSession?.user && newSession.user.app_metadata?.provider === 'google') {
            const { data: _, error } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', newSession.user.id)
              .single();
            if (error && error.code === 'PGRST116') {
              // Não encontrou o perfil
              try {
                await registerProfile({
                  id: newSession.user.id,
                  email: newSession.user.email,
                  name:
                    newSession.user.user_metadata?.full_name ||
                    newSession.user.email?.split('@')[0] ||
                    'Usuário',
                  role: UserRole.CLIENT,
                  status: 'APPROVED',
                  createdAt: Date.now(),
                  savedAddresses: [],
                });
                await fetchData();
              } catch (e) {
                console.error('Erro criador de perfil no OAuth', e);
              }
            }
          }

          if (newSession?.user) {
            setupNotifications(newSession.user.id);
          }
        } finally {
          clearTimeout(loadingTimeout);
          setIsLoading(false);
        }
      } else if (event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        fetchData(); // Silenciosamente, sem bloquear UI
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setIsLoading(false);
      }
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    window.addEventListener('online', processSyncQueue);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        fetchData(true);
      }
    });
    return () => {
      window.removeEventListener('online', processSyncQueue);
      window.removeEventListener('visibilitychange', () => {});
    };
  }, [processSyncQueue]);

  // Listener Realtime para `profiles`, `orders` e `restaurants` — tempo real para todos os usuários
  useEffect(() => {
    const profilesChannel = supabase
      .channel('profiles-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
        if (payload.eventType === 'INSERT') {
          const novo = mapProfile(payload.new);
          setProfiles(prev => (prev.find(p => p.id === novo.id) ? prev : [novo, ...prev]));
        } else if (payload.eventType === 'UPDATE') {
          const atualizado = mapProfile(payload.new);
          setProfiles(prev => prev.map(p => (p.id === atualizado.id ? atualizado : p)));
        } else if (payload.eventType === 'DELETE') {
          setProfiles(prev => prev.filter(p => p.id !== payload.old.id));
        }
      })
      .subscribe();

    const ordersChannel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        if (payload.eventType === 'INSERT') {
          const novo = mapOrder(payload.new);
          setOrders(prev => (prev.find(o => o.id === novo.id) ? prev : [novo, ...prev]));
        } else if (payload.eventType === 'UPDATE') {
          const atualizado = mapOrder(payload.new);
          setOrders(prev => prev.map(o => (o.id === atualizado.id ? atualizado : o)));
        } else if (payload.eventType === 'DELETE') {
          setOrders(prev => prev.filter(o => o.id !== payload.old.id));
        }
      })
      .subscribe();

    const restaurantsChannel = supabase
      .channel('restaurants-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, payload => {
        const mapRest = (r: any) => ({
          ...r,
          ownerId: r.owner_id,
          menu: r.menu || [],
          rating: Number(r.rating || 0),
          pagseguroRecipientId: r.pagseguro_recipient_id,
        });
        if (payload.eventType === 'INSERT') {
          const novo = mapRest(payload.new);
          setRestaurants(prev => (prev.find(r => r.id === novo.id) ? prev : [novo, ...prev]));
        } else if (payload.eventType === 'UPDATE') {
          const atualizado = mapRest(payload.new);
          setRestaurants(prev => prev.map(r => (r.id === atualizado.id ? atualizado : r)));
        } else if (payload.eventType === 'DELETE') {
          setRestaurants(prev => prev.filter(r => r.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(restaurantsChannel);
    };
  }, []);

  const registerProfile = async (profile: Partial<UserProfile>) => {
    // Atualiza localmente imediatamente para resposta visual instantânea
    const localProfile: UserProfile = {
      id: profile.id!,
      email: profile.email!,
      name: profile.name || '',
      businessName: profile.businessName || '',
      role: profile.role!,
      status: (profile.status as any) || 'APPROVED',
      cpf: profile.cpf || '',
      cnpj: profile.cnpj || '',
      birthDate: profile.birthDate || '',
      vehicleType: profile.vehicleType || '',
      licensePlate: profile.licensePlate || '',
      phoneNumber: profile.phoneNumber || '',
      pixKey: profile.pixKey || '',
      savedAddresses: profile.savedAddresses || [],
      commissionBalance: 0,
      averageRating: 0,
      ratingsCount: 0,
      createdAt: Date.now(),
      description: profile.description || '',
      workingHours: profile.workingHours || '',
    };
    setProfiles(prev =>
      prev.find(p => p.id === localProfile.id)
        ? prev.map(p => (p.id === localProfile.id ? { ...p, ...localProfile } : p))
        : [localProfile, ...prev]
    );

    const isRestaurant = profile.role === UserRole.RESTAURANT;

    // Usa RPC com SECURITY DEFINER para bypassar RLS (inclui criação de restaurante atomicamente)
    const { error: profileError } = await supabase.rpc('upsert_profile', {
      p_id: profile.id,
      p_email: profile.email || '',
      p_name: profile.name || '',
      p_business_name: profile.businessName || null,
      p_role: profile.role,
      p_status: profile.status || 'APPROVED',
      p_cpf: profile.cpf || '',
      p_cnpj: profile.cnpj || '',
      p_birth_date: profile.birthDate || '',
      p_phone_number: profile.phoneNumber || '',
      p_pix_key: profile.pixKey || '',
      p_description: profile.description || '',
      p_working_hours: profile.workingHours || '',
      p_vehicle_type: profile.vehicleType || '',
      p_license_plate: profile.licensePlate || '',
      p_saved_addresses: profile.savedAddresses || [],
      p_is_restaurant: isRestaurant,
    });
    if (profileError) throw new Error(`Erro ao salvar perfil: ${profileError.message}`);
    await fetchData();
  };

  const loginAsTestUser = async (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (profile && (profile as any).passwordPlain) {
      const { error } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: (profile as any).passwordPlain,
      });
      if (error) throw error;
      await fetchData();
    } else alert('Simulação requer senha ou configuração administrativa.');
  };

  const createOrder = async (
    restaurantId: string,
    items: { product: Product; quantity: number }[],
    paymentMethod: PaymentMethod,
    address: string,
    customerName: string,
    paymentId?: string,
    addressCoords?: { lat: number; lng: number },
    deliveryFeeOverride?: number
  ) => {
    try {
      const restaurant = restaurants.find(r => r.id === restaurantId);
      if (!restaurant) throw new Error('Restaurante não encontrado');

      const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      const platformFee = Math.round(subtotal * 0.15 * 100) / 100;
      const deliveryFee = deliveryFeeOverride !== undefined ? deliveryFeeOverride : 5.0;
      const total = subtotal + deliveryFee;
      const driverEarnings = 4.0;
      const restaurantNetEarnings = subtotal - platformFee - (deliveryFee === 0 ? 5.0 : 0);

      const newOrder = {
        id: `ORD-${Date.now().toString().slice(-6)}`,
        restaurant_id: restaurantId,
        restaurant_name: restaurant.name,
        customer_id: session?.user.id,
        customer_address: address,
        customer_name: customerName,
        status: OrderStatus.PENDING,
        items,
        subtotal,
        delivery_fee: deliveryFee,
        platform_fee: platformFee,
        driver_net_earnings: driverEarnings,
        restaurant_net_earnings: restaurantNetEarnings,
        total,
        payment_method: paymentMethod,
        payment_id: paymentId,
        coords: addressCoords,
        timestamp: new Date().toISOString(),
        pickup_code: Math.floor(1000 + Math.random() * 9000).toString(),
        delivery_code: Math.floor(1000 + Math.random() * 9000).toString(),
      };

      const { data, error } = await supabase.from('orders').insert(newOrder);
      if (error) throw new Error(`Falha ao criar pedido: ${error.message}`);
      await fetchData();
      return data;
    } catch (error) {
      throw error;
    }
  };

  const updateUserProfile = async (id: string, data: Partial<UserProfile>) => {
    const up: any = {};
    if (data.name !== undefined) up.name = data.name;
    if (data.status !== undefined) up.status = data.status;
    if (data.phoneNumber !== undefined) up.phone_number = data.phoneNumber;
    if (data.cpf !== undefined) up.cpf = data.cpf;
    if (data.cnpj !== undefined) up.cnpj = data.cnpj;
    if (data.birthDate !== undefined) up.birth_date = data.birthDate;
    if (data.pixKey !== undefined) up.pix_key = data.pixKey;
    if (data.description !== undefined) up.description = data.description;
    if (data.workingHours !== undefined) up.working_hours = data.workingHours;
    if (data.licensePlate !== undefined) up.license_plate = data.licensePlate;
    if (data.vehicleType !== undefined) up.vehicle_type = data.vehicleType;
    if (data.businessName !== undefined) up.business_name = data.businessName;
    if (data.pagseguroRecipientId !== undefined)
      up.pagseguro_recipient_id = data.pagseguroRecipientId;
    if (data.avatarUrl !== undefined) up.avatar_url = data.avatarUrl;
    // currentLocation é atualizado silenciosamente (sem fetchData) para não sobrecarregar o banco
    if (data.currentLocation !== undefined) up.current_location = data.currentLocation;

    const { error } = await supabase.from('profiles').update(up).eq('id', id);
    if (error) throw error;
    // Se a única mudança é currentLocation, não faz fetchData completo (seria chamado a cada GPS update)
    const isOnlyLocationUpdate =
      Object.keys(data).length === 1 && data.currentLocation !== undefined;
    if (!isOnlyLocationUpdate) await fetchData();
    // O Realtime vai atualizar o estado automaticamente para dados relevantes
  };

  const deleteAccount = async () => {
    if (!session?.user.id) return;
    if (window.confirm('Deseja excluir permanentemente sua conta?')) {
      const { error } = await supabase.from('profiles').delete().eq('id', session.user.id);
      if (error) throw error;
      await signOut();
    }
  };

  const addAddress = async (addrData: Omit<UserAddress, 'id'>) => {
    if (!currentUserProfile) return;
    const newAddress = { id: `addr-${Date.now()}`, ...addrData };
    const updated = [...(currentUserProfile.savedAddresses || []), newAddress];
    await supabase
      .from('profiles')
      .update({ saved_addresses: updated })
      .eq('id', currentUserProfile.id);
    await fetchData();
    return newAddress;
  };

  const signOut = async () => {
    try {
      // Limpa estado imediatamente para resposta visual instantânea
      setSession(null);
      setCurrentRole(null);
      setIsLoading(false);
      // Depois desautentica no servidor (o SIGNED_OUT event vai confirmar e limpar o resto)
      await supabase.auth.signOut();
      // Limpa caches locais
      setProfiles([]);
      setOrders([]);
      setRestaurants([]);
      setCart([]);
      clearOfflineCart();
      localStorage.removeItem(STORAGE_KEY_RESTAURANTS);
      localStorage.removeItem(STORAGE_KEY_ORDERS);
      localStorage.removeItem(STORAGE_KEY_PROFILES);
    } catch (e) {
      console.error('Erro ao sair:', e);
      // Força reset mesmo em caso de erro de rede
      setSession(null);
      setCurrentRole(null);
      setIsLoading(false);
    }
  };

  // Funções do carrinho
  const addToCart = (item: any) => {
    setCart(prev => {
      const existingItem = prev.find(i => i.id === item.id);
      if (existingItem) {
        return prev.map(i =>
          i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
        );
      }
      return [...prev, item];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateCartItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => (item.id === productId ? { ...item, quantity } : item)));
  };

  const clearCart = () => {
    setCart([]);
    clearOfflineCart();
  };

  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  };

  return (
    <AppContext.Provider
      value={{
        restaurants,
        orders,
        profiles,
        currentRole,
        isLoading,
        session,
        currentUserProfile,
        isSupabaseConnected,
        setRole: setCurrentRole,
        signOut,
        deleteAccount,
        loginAsTestUser,
        createOrder,
        updateOrderStatus: async (id, s) => {
          await supabase.from('orders').update({ status: s }).eq('id', id);
          await fetchData();
        },
        confirmPickup,
        confirmDelivery,
        processSyncQueue,
        submitRating: async (id, r) => {
          await supabase.from('orders').update({ rating: r }).eq('id', id);
          await fetchData();
        },
        assignDriver: async (oid, did) => {
          await supabase
            .from('orders')
            .update({ driver_id: did, status: OrderStatus.READY })
            .eq('id', oid);
          await fetchData();
        },
        registerProfile,
        updateUserProfile,
        setupNotifications,
        deleteUserProfile: async id => {
          await supabase.from('profiles').delete().eq('id', id);
          await fetchData();
        },
        updateRestaurant: async (id, d) => {
          const { error } = await supabase.from('restaurants').update(d).eq('id', id);
          if (error) {
            console.error('Error updating restaurant:', error);
            throw new Error(`Erro ao atualizar restaurante: ${error.message}`);
          }
          await fetchData();
        },
        updateMenu: async (rid, p) => {
          const { data } = await supabase.from('restaurants').select('menu').eq('id', rid).single();
          const currentMenu = data?.menu || [];
          const { error } = await supabase
            .from('restaurants')
            .update({ menu: [...currentMenu, p] })
            .eq('id', rid);
          if (error) {
            console.error('Error updating menu:', error);
            throw new Error(`Erro ao salvar produto: ${error.message}`);
          }
          await fetchData();
        },
        updateProduct: async (rid, pid, d) => {
          const { data } = await supabase.from('restaurants').select('menu').eq('id', rid).single();
          if (data) {
            const currentMenu = data.menu || [];
            const { error } = await supabase
              .from('restaurants')
              .update({ menu: currentMenu.map((p: any) => (p.id === pid ? { ...p, ...d } : p)) })
              .eq('id', rid);
            if (error) {
              console.error('Error updating product:', error);
              throw new Error(`Erro ao atualizar produto: ${error.message}`);
            }
          }
          await fetchData();
        },
        deleteProduct: async (rid, pid) => {
          const { data } = await supabase.from('restaurants').select('menu').eq('id', rid).single();
          if (data) {
            const currentMenu = data.menu || [];
            await supabase
              .from('restaurants')
              .update({ menu: currentMenu.filter((p: any) => p.id !== pid) })
              .eq('id', rid);
          }
          await fetchData();
        },
        addAddress,
        updateAddress: async a => {
          if (currentUserProfile)
            await supabase
              .from('profiles')
              .update({
                saved_addresses: currentUserProfile.savedAddresses.map(x =>
                  x.id === a.id ? a : x
                ),
              })
              .eq('id', currentUserProfile.id);
          await fetchData();
        },
        deleteAddress: async id => {
          if (currentUserProfile)
            await supabase
              .from('profiles')
              .update({
                saved_addresses: currentUserProfile.savedAddresses.filter(x => x.id !== id),
              })
              .eq('id', currentUserProfile.id);
          await fetchData();
        },
        refreshData: fetchData,
        requestPasswordReset: async e => await supabase.auth.resetPasswordForEmail(e),
        realDistances,
        recalculateDistances: async (addr, coords) => {
          const d = await getRealDistances(
            addr,
            restaurants.map(r => ({ id: r.id, lat: r.coords.lat, lng: r.coords.lng })),
            coords
          );
          setRealDistances(d);
        },
        calculateDistance: (lat1, lon1, lat2, lon2) => calculateHaversine(lat1, lon1, lat2, lon2),
        cart,
        addToCart,
        removeFromCart,
        updateCartItemQuantity,
        clearCart,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppStore deve ser usado dentro de AppProvider');
  return context;
};
