import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  PlatformSettings,
  DaySchedule,
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
    deliveryFeeOverride?: number,
    discountAmount?: number
  ) => Promise<{ id: any } | null>;
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
  toggleFavorite: (restaurantId: string) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;

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
  platformSettings: PlatformSettings | null;
  reportFailedDelivery: (orderId: string, reason: string) => Promise<void>;
  startReturn: (orderId: string) => Promise<void>;
  confirmReturn: (orderId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>(() =>
    JSON.parse(localStorage.getItem(STORAGE_KEY_RESTAURANTS) || '[]')
  );
  const [orders, setOrders] = useState<Order[]>(() =>
    JSON.parse(localStorage.getItem(STORAGE_KEY_ORDERS) || '[]')
  );
  // 🔒 SEGURANÇA: perfis NÃO são inicializados do localStorage
  // O role/status do usuário é sempre lido do banco após autenticação
  // Isso impede que alguém edite o localStorage para fingir ser ADMIN
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  // 🔒 SEGURANÇA: Só restaura carrinho offline se houver sessão ativa
  const [cart, setCart] = useState<any[]>([]);

  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean | null>(null);
  const [realDistances, setRealDistances] = useState<Record<string, any>>({});
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);

  // 🔒 SEGURANÇA: currentUserProfile agora tem estado próprio para evitar race condition
  // onde profiles.find() roda ANTES de setProfiles() ser commitado pelo React
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    // Role vem do perfil buscado no banco - nunca do localStorage
    if (currentUserProfile) setCurrentRole(currentUserProfile.role);
    else setCurrentRole(null);
  }, [currentUserProfile]);

  // Sync: se a sessão mudar sem fetchData (ex: logout), limpa o perfil
  useEffect(() => {
    if (!session) setCurrentUserProfile(null);
  }, [session]);

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
    asaasAccountId: p.asaas_account_id || '',
    asaasCustomerId: p.asaas_customer_id || '',
    phoneNumber: p.phone_number || '',
    savedAddresses: Array.isArray(p.saved_addresses) ? p.saved_addresses : [],
    commissionBalance: Number(p.commission_balance || 0),
    averageRating: Number(p.average_rating || 0),
    ratingsCount: Number(p.ratings_count || 0),
    createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
    description: p.description || '',
    workingHours: p.working_hours || '',
    currentLocation: p.current_location || undefined,
    customFeePct: p.custom_fee_pct ? Number(p.custom_fee_pct) : undefined,
    savedCards: Array.isArray(p.saved_cards) ? p.saved_cards : [],
    favoriteRestaurantIds: Array.isArray(p.favorite_restaurant_ids) ? p.favorite_restaurant_ids : [],
    driverTutorialSeen: p.driver_tutorial_seen === true,
    clientTutorialSeen: p.client_tutorial_seen === true,
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
    cancelledAt: o.cancelled_at ? new Date(o.cancelled_at).getTime() : undefined,
    driverId: o.driver_id,
    pickupCode: o.pickup_code,
    deliveryCode: o.delivery_code,
    deliveryPhotoUrl: o.delivery_photo_url || undefined,
    rating: o.rating,
    paymentId: o.payment_id,
    asaasPaymentId: o.asaas_payment_id,
    pixQrCode: o.pix_qr_code,
    pixQrCodeImage: o.pix_qr_code_image,
    coords: o.coords,
    customerPhone: o.customer_phone ?? undefined,
    customerAvatarUrl: o.customer_avatar_url ?? undefined,
    failureReason: o.failure_reason ?? undefined,
    driverName: o.driver_name ?? undefined,
  });

  const setupNotifications = async (userId?: string) => {
    try {
      // Remove listeners anteriores para evitar stacking entre logins
      await PushNotifications.removeAllListeners();

      // Cria o canal de notificações (obrigatório Android 8+)
      await PushNotifications.createChannel({
        id: 'deliveries',
        name: 'Pedidos e Entregas',
        description: 'Atualizações em tempo real dos seus pedidos',
        importance: 5, // IMPORTANCE_HIGH — toca som e aparece em destaque
        visibility: 1,
        sound: 'default',
        vibration: true,
        lights: true,
      });

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

  // Log auxiliar: só exibe em desenvolvimento
  const isDev = import.meta.env.DEV;
  const devLog = (...args: any[]) => { if (isDev) console.log(...args); };

  // Refs persistem entre renders (let no corpo do componente reseta a cada render,
  // o que tornava o throttle de 2s inoperante e causava refetch excessivo)
  const lastFetchTimeRef = useRef(0);
  const cachedDataRef = useRef<{ restaurants?: any[]; orders?: any[]; profiles?: any[] }>({});

  const fetchData = async (force = false, sessionOverride?: Session | null) => {
    const now = Date.now();
    if (!force && now - lastFetchTimeRef.current < 2000) return;
    lastFetchTimeRef.current = now;
    const cachedData = cachedDataRef.current;

    try {
      const [restData, orderData, profileData, settingsData] = await Promise.all([
        supabase.from('restaurants').select('*').order('rating', { ascending: false }),
        supabase.from('orders').select('*').order('timestamp', { ascending: false }).limit(100),
        supabase.from('profiles').select('*'),
        supabase.from('platform_settings').select('*').maybeSingle(),
      ]);

      devLog('[DEV] Dados carregados:', {
        restaurantes: restData.data?.length ?? 0,
        pedidos: orderData.data?.length ?? 0,
        perfis: profileData.data?.length ?? 0,
      });

      if (restData.data) {
        const mapped = restData.data.map((r: any) => ({
          ...r,
          ownerId: r.owner_id,
          menu: r.menu || [],
          rating: Number(r.rating || 0),
          asaasAccountId: r.asaas_account_id,
          coords: r.coords ?? { lat: -9.5422, lng: -57.4486 },
          isOpen: r.is_open !== false,
          openingHours: Array.isArray(r.opening_hours) ? r.opening_hours : [],
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

      if (typeof window !== 'undefined') {
        (window as any).debugProfileLength = profileData.data ? profileData.data.length : 'NULL';
      }

      if (profileData.data) {
        let mapped = profileData.data.map(p => mapProfile(p));
        
        // SELF-HEALING: Se usuário tem sessão mas não tem perfil (OAuth sem trigger, etc.)
        // ⚠️  NÃO roda se a conta tem menos de 60 s — evita criar CLIENT/APPROVED durante
        //     o cadastro de parceiros (race condition com o RPC upsert_profile).
        // 🔒 FIX SESSÃO: Usa sessionOverride quando disponível (passado do auth listener)
        //    para evitar race condition onde getSession() retorna null logo após troca de conta.
        let currentSession: Session | null;
        if (sessionOverride !== undefined) {
          currentSession = sessionOverride;
        } else {
          const { data } = await supabase.auth.getSession();
          currentSession = data.session;
        }

        if (currentSession?.user && !mapped.find(p => p.id === currentSession!.user.id)) {
          const accountAgeSec = (Date.now() - new Date(currentSession.user.created_at).getTime()) / 1000;
          const isJustCreated = accountAgeSec < 60; // dentro do janela de cadastro
          if (isJustCreated) {
            devLog('[DEV] Self-Healing IGNORADO — conta criada há', Math.round(accountAgeSec), 's (cadastro em andamento)');
          } else {
            devLog('[DEV] Perfil não encontrado! Tentando Self-Healing (conta existente)...');
            try {
              const newProfile = {
                id: currentSession.user.id,
                email: currentSession.user.email || '',
                name: currentSession.user.user_metadata?.full_name || currentSession.user.user_metadata?.name || currentSession.user.email?.split('@')[0] || 'Usuário',
                role: 'CLIENT',
                status: 'APPROVED',
                saved_addresses: []
              };
              const { data: insertedProfile, error: insertError } = await supabase.from('profiles').insert([newProfile]).select().single();
              if (!insertError && insertedProfile) {
                mapped.push(mapProfile(insertedProfile));
              } else {
                console.error('[DEV] Erro no Self-Healing:', insertError);
              }
            } catch(e) {}
          }
        }

        setProfiles(mapped);
        localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(mapped));
        cachedData.profiles = mapped;

        // ✅ FIX CRÍTICO: Atualiza currentUserProfile DIRETAMENTE aqui, no mesmo ciclo,
        // evitando race condition onde profiles.find() roda antes do setProfiles() ser commitado.
        if (currentSession?.user) {
          const myProfile = mapped.find(p => p.id === currentSession!.user.id) || null;
          setCurrentUserProfile(myProfile);
          devLog('[DEV] currentUserProfile setado diretamente:', myProfile?.role, myProfile?.status);
        }
      } else if (profileData.error) {
        console.error('[CRITICAL] Erro ao buscar profiles do Supabase:', profileData.error);
        if (typeof window !== 'undefined') {
          (window as any).lastSyncError = 'PROFILE ERROR: ' + profileData.error.message;
        }
      }

      if (settingsData.data) {
        setPlatformSettings({
          platformFeePct: (settingsData.data.platform_fee_pct ?? 15) / 100,
          driverFeePct: (settingsData.data.driver_fee_pct ?? 8) / 100,
          restaurantFeePct: (settingsData.data.restaurant_fee_pct ?? 8) / 100,
          minDeliveryFee: settingsData.data.min_delivery_fee ?? 5.0,
          minOrderValue: settingsData.data.min_order_value ?? 15.0,
        });
      }
      setIsSupabaseConnected(true);
    } catch (err: any) {
      console.error('Erro ao sincronizar dados:', err);
      if (typeof window !== 'undefined') {
        (window as any).lastSyncError = err?.message || String(err);
      }
      setIsSupabaseConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmPickup = async (orderId: string, code: string): Promise<boolean> => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return false;
    // Validação local rápida — evita chamada de rede com código errado
    if (order.pickupCode !== code) return false;

    if (!navigator.onLine) {
      addToSyncQueue({ orderId, code, type: 'pickup', timestamp: Date.now() });
      saveActiveOrderToOffline({ ...order, status: OrderStatus.OUT_FOR_DELIVERY });
      setOrders(prev =>
        prev.map(o => (o.id === orderId ? { ...o, status: OrderStatus.OUT_FOR_DELIVERY } : o))
      );
      return true;
    }

    // Update atômico: verifica código e status no banco para evitar race condition
    const { data: updated } = await supabase
      .from('orders')
      .update({ status: OrderStatus.OUT_FOR_DELIVERY })
      .eq('id', orderId)
      .eq('pickup_code', code)
      .eq('status', OrderStatus.READY)
      .select('id, customer_id, restaurant_name')
      .maybeSingle();

    if (!updated) return false;

    await fetchData();

    if (order.customerId) {
      supabase.functions.invoke('send-push-notification', {
        body: {
          userId: order.customerId,
          title: '🚀 Pedido saiu para entrega!',
          body: `Seu pedido de ${order.restaurantName} está a caminho. Fique de olho!`,
          data: { orderId, type: 'OUT_FOR_DELIVERY' },
        },
      }).catch(() => {});
    }

    return true;
  };

  const confirmDelivery = async (orderId: string, code: string): Promise<boolean> => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return false;
    // Validação local rápida — evita aceitar qualquer código quando offline
    if (order.deliveryCode !== code) return false;

    if (!navigator.onLine) {
      addToSyncQueue({ orderId, code, type: 'delivery', timestamp: Date.now() });
      clearOfflineActiveOrder();
      setOrders(prev =>
        prev.map(o => (o.id === orderId ? { ...o, status: OrderStatus.DELIVERED } : o))
      );
      return true;
    }

    // Update atômico: verifica código e status no banco
    const { data: updated } = await supabase
      .from('orders')
      .update({ status: OrderStatus.DELIVERED })
      .eq('id', orderId)
      .eq('delivery_code', code)
      .eq('status', OrderStatus.OUT_FOR_DELIVERY)
      .select('id')
      .maybeSingle();

    if (!updated) return false;

    // Repasses pós-entrega: restaurante e entregador recebem somente agora
    supabase.functions.invoke('release-payment-splits', { body: { orderId } }).catch(() => {});

    await fetchData();

    if (order.customerId) {
      supabase.functions.invoke('send-push-notification', {
        body: {
          userId: order.customerId,
          title: '🎉 Pedido entregue!',
          body: `Seu pedido de ${order.restaurantName} chegou. Que tal avaliar a experiência?`,
          data: { orderId, type: 'DELIVERED' },
        },
      }).catch(() => {});
    }

    return true;
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

        // 🔒 SEGURANÇA: Restaura carrinho do storage SOMENTE após sessão confirmada
        if (newSession?.user) {
          const savedCart = getCartFromOffline();
          if (savedCart && savedCart.length > 0) setCart(savedCart);
        }

        // Timeout de segurança: desbloqueia a UI após 8s caso o fetchData trave
        const loadingTimeout = setTimeout(() => {
          setIsLoading(false);
        }, 8000);

        try {
          // 🔒 FIX SESSÃO: passa newSession diretamente para evitar race condition em getSession()
          await fetchData(true, newSession);

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
                await fetchData(true, newSession);
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
        fetchData(false, newSession); // Silenciosamente, sem bloquear UI
      } else if (event === 'SIGNED_OUT') {
        // 🔒 SEGURANÇA: Limpa tudo ao deslogar
        setCurrentUserProfile(null); // ← explícito: não depende só do useEffect
        setCurrentRole(null);
        setCart([]);
        clearOfflineCart();
        setSession(null);
        setIsLoading(false);
      }
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchData(true);
    };
    window.addEventListener('online', processSyncQueue);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('online', processSyncQueue);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
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
          coords: r.coords ?? { lat: -9.5422, lng: -57.4486 },
          menu: r.menu || [],
          rating: Number(r.rating || 0),
          asaasAccountId: r.asaas_account_id,
          isOpen: r.is_open !== false,
          openingHours: Array.isArray(r.opening_hours) ? r.opening_hours : [],
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
    devLog('[DEV] registerProfile chamado com role:', profile.role);

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
    devLog('[DEV] isRestaurant:', isRestaurant);

    // Usa RPC com SECURITY DEFINER para bypassar RLS (inclui criação de restaurante atomicamente)
    const rpcParams = {
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
    };
    
    devLog('[DEV] RPC upsert_profile params:', { role: profile.role, email: profile.email });

    const { error: profileError } = await supabase.rpc('upsert_profile', rpcParams);
    if (profileError) {
      console.error('Erro no RPC upsert_profile:', profileError);
      throw new Error(`Erro ao salvar perfil: ${profileError.message}`);
    }

    devLog('[DEV] Perfil salvo com sucesso.');
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
    deliveryFeeOverride?: number,
    discountAmount: number = 0
  ) => {
    // 🔒 SEGURANÇA: Bloqueia criação de pedido sem sessão válida
    if (!session?.user?.id) {
      throw new Error('Você precisa estar logado para realizar um pedido.');
    }
    try {
      // ═══════════════════════════════════════════════════════
      // 0. IDEMPOTÊNCIA: Bloqueia pedido duplicado (ex: reconexão após queda)
      // ═══════════════════════════════════════════════════════
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: recentOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('customer_id', session.user.id)
        .eq('restaurant_id', restaurantId)
        .in('status', ['PENDING_PAYMENT', 'PENDING'])
        .gte('timestamp', twoMinutesAgo)
        .maybeSingle();

      if (recentOrder) {
        throw new Error('Você já tem um pedido em andamento neste restaurante. Aguarde a confirmação antes de fazer outro.');
      }

      // ═══════════════════════════════════════════════════════
      // 1. BUSCAR RESTAURANTE DO BANCO — não confiar no estado do React
      // ═══════════════════════════════════════════════════════
      const { data: restaurantData, error: restError } = await supabase
        .from('restaurants')
        .select('id, name, menu, owner_id')
        .eq('id', restaurantId)
        .single();

      if (restError || !restaurantData) {
        throw new Error('Restaurante não encontrado ou inativo.');
      }

      // ═══════════════════════════════════════════════════════
      // 2. VALIDAR PREÇOS CONTRA O BANCO — rejeita se divergir
      // ═══════════════════════════════════════════════════════
      let subtotal = 0;
      const validatedItems: typeof items = [];

      for (const item of items) {
        const realProduct = (restaurantData.menu as any[])?.find(
          (p: any) => p.id === item.product.id
        );
        if (!realProduct) {
          throw new Error(
            `Produto "${item.product.name}" não está disponível neste restaurante.`
          );
        }
        if (realProduct.available === false) {
          throw new Error(
            `Produto "${item.product.name}" está temporariamente esgotado.`
          );
        }
        const realPrice = Number(realProduct.price);
        const frontendPrice = Number(item.product.price);

        // 🔒 Tolerância de R$0,01 para diferenças de arredondamento
        if (Math.abs(realPrice - frontendPrice) > 0.01) {
          throw new Error(
            `Preço do produto "${item.product.name}" foi alterado. Por favor, atualize a página.`
          );
        }

        subtotal += realPrice * item.quantity;
        validatedItems.push({
          product: { ...item.product, price: realPrice }, // força o preço do banco
          quantity: item.quantity,
        });
      }

      // ═══════════════════════════════════════════════════════
      // 3. BUSCAR TAXAS DO BANCO — nunca do estado do React
      // ═══════════════════════════════════════════════════════
      let platformFeePct   = 0.15;
      let driverFeePct     = 0.08;
      let restaurantFeePct = 0.08;
      let minDeliveryFee   = 5.0;
      const maxDeliveryFee = 100.0; // limite máximo razoável para detectar manipulação

      const { data: cfg } = await supabase
        .from('platform_settings')
        .select('platform_fee_pct, driver_fee_pct, restaurant_fee_pct, min_delivery_fee')
        .maybeSingle();

      if (cfg) {
        platformFeePct   = (cfg.platform_fee_pct   ?? 15) / 100;
        driverFeePct     = (cfg.driver_fee_pct     ?? 8)  / 100;
        restaurantFeePct = (cfg.restaurant_fee_pct ?? 8)  / 100;
        minDeliveryFee   = cfg.min_delivery_fee     ?? 5.0;
      }

      // Taxa personalizada do lojista (buscada do banco via profiles)
      const { data: ownerData } = await supabase
        .from('profiles')
        .select('custom_fee_pct')
        .eq('id', restaurantData.owner_id)
        .maybeSingle();

      if (ownerData?.custom_fee_pct !== null && ownerData?.custom_fee_pct !== undefined) {
        restaurantFeePct = ownerData.custom_fee_pct / 100;
      }

      // ═══════════════════════════════════════════════════════
      // 4. VALIDAR TAXA DE ENTREGA — aceita o valor do backend
      //    mas rejeita valores absurdos (possível manipulação)
      // ═══════════════════════════════════════════════════════
      let deliveryFee = minDeliveryFee;
      if (deliveryFeeOverride !== undefined) {
        if (deliveryFeeOverride < 0 || deliveryFeeOverride > maxDeliveryFee) {
          throw new Error('Taxa de entrega inválida. Por favor, tente novamente.');
        }
        deliveryFee = deliveryFeeOverride;
      }

      // ═══════════════════════════════════════════════════════
      // 5. CALCULAR VALORES FINANCEIROS — todos no servidor
      // ═══════════════════════════════════════════════════════
      const finalProductTotal    = Math.max(0, subtotal - discountAmount);
      const restaurantNetEarnings = finalProductTotal * (1 - restaurantFeePct);
      const driverEarnings       = deliveryFee * (1 - driverFeePct);
      const platformFee          = (finalProductTotal - restaurantNetEarnings) + (deliveryFee - driverEarnings);
      const total                = finalProductTotal + deliveryFee;

      const { data: clientProfile } = await supabase
        .from('profiles').select('phone_number, avatar_url').eq('id', session.user.id).maybeSingle();

      const newOrder = {
        id: `ORD-${Date.now().toString().slice(-6)}`,
        restaurant_id: restaurantId,
        restaurant_name: restaurantData.name,
        customer_id: session.user.id,
        customer_address: address,
        customer_name: customerName,
        customer_phone: clientProfile?.phone_number ?? null,
        customer_avatar_url: clientProfile?.avatar_url ?? null,
        // PIX e Cartão de crédito começam como PENDING_PAYMENT até o webhook confirmar
        // Dinheiro e débito (offline) vão direto para PENDING
        status: (paymentMethod === 'PIX' || paymentMethod === 'CREDIT_CARD')
          ? OrderStatus.PENDING_PAYMENT
          : OrderStatus.PENDING,
        items: validatedItems,
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

      const { data, error } = await supabase.from('orders').insert(newOrder).select('id').single();
      if (error) throw new Error(`Falha ao criar pedido: ${error.message}`);
      await fetchData();

      // Notifica restaurante imediatamente (apenas para PENDING — PIX/cartão notifica via webhook)
      if (newOrder.status === OrderStatus.PENDING) {
        const ownerId = restaurantData.owner_id;
        if (ownerId) {
          supabase.functions.invoke('send-push-notification', {
            body: {
              userId: ownerId,
              title: '🛒 Novo Pedido!',
              body: `${customerName} fez um pedido de R$ ${total.toFixed(2)}. Confirme agora!`,
              data: { orderId: newOrder.id, type: 'NEW_ORDER' },
            },
          }).catch(() => {});
        }
      }

      return data; // { id: string } — ID do pedido criado
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
    if (data.asaasAccountId !== undefined) up.asaas_account_id = data.asaasAccountId;
    if (data.asaasCustomerId !== undefined) up.asaas_customer_id = data.asaasCustomerId;
    if (data.avatarUrl !== undefined) up.avatar_url = data.avatarUrl;
    if (data.customFeePct !== undefined) up.custom_fee_pct = data.customFeePct;
    if (data.savedCards !== undefined) up.saved_cards = data.savedCards;
    if (data.favoriteRestaurantIds !== undefined) up.favorite_restaurant_ids = data.favoriteRestaurantIds;
    if (data.driverTutorialSeen !== undefined) up.driver_tutorial_seen = data.driverTutorialSeen;
    if (data.clientTutorialSeen !== undefined) up.client_tutorial_seen = data.clientTutorialSeen;
    if (data.currentLocation !== undefined) up.current_location = data.currentLocation;

    // Captura role ANTES do fetchData (closure stale após setState assíncrono)
    const profileRoleSnapshot = profiles.find(p => p.id === id)?.role;

    const { error } = await supabase.from('profiles').update(up).eq('id', id);
    if (error) throw error;
    // Se a única mudança é currentLocation, não faz fetchData completo (seria chamado a cada GPS update)
    const isOnlyLocationUpdate =
      Object.keys(data).length === 1 && data.currentLocation !== undefined;
    if (!isOnlyLocationUpdate) await fetchData();

    if (data.status === 'APPROVED') {
      const profile = { role: profileRoleSnapshot } as any;
      const roleName = profile?.role === 'RESTAURANT' ? 'lojista' : 'entregador';
      supabase.functions.invoke('send-push-notification', {
        body: {
          userId: id,
          title: '🎉 Conta aprovada!',
          body: `Seu cadastro como ${roleName} foi aprovado. Já pode usar o DeliveryCity!`,
          data: { type: 'ACCOUNT_APPROVED' },
        },
      }).catch(() => {});
    }
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
    // 🔒 SEGURANÇA: Bloqueia adição ao carrinho sem sessão
    if (!session) return;
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

  const cancelOrder = async (orderId: string) => {
    if (!session?.user?.id) throw new Error('Não autenticado.');
    const order = orders.find(o => o.id === orderId);
    if (!order) throw new Error('Pedido não encontrado.');
    if (order.customerId !== session.user.id) throw new Error('Sem permissão.');
    if (!['PENDING', 'PENDING_PAYMENT'].includes(order.status))
      throw new Error('Não é possível cancelar um pedido que já está em preparo.');
    const ageMs = Date.now() - order.timestamp;
    if (ageMs > 3 * 60 * 1000)
      throw new Error('O prazo de cancelamento (3 minutos) já expirou.');
    const { error } = await supabase
      .from('orders')
      .update({ status: OrderStatus.CANCELLED, cancelled_at: new Date().toISOString() })
      .eq('id', orderId);
    if (error) throw error;
    await fetchData();

    // Notifica o restaurante sobre o cancelamento
    const restaurant = restaurants.find(r => r.id === order.restaurantId);
    if (restaurant?.ownerId) {
      supabase.functions.invoke('send-push-notification', {
        body: {
          userId: restaurant.ownerId,
          title: '❌ Pedido cancelado pelo cliente',
          body: `${order.customerName || 'Cliente'} cancelou o pedido #${orderId.slice(-6)}.`,
          data: { orderId, type: 'ORDER_CANCELLED' },
        },
      }).catch(() => {});
    }
  };

  const toggleFavorite = async (restaurantId: string) => {
    if (!currentUserProfile) return;
    const current = currentUserProfile.favoriteRestaurantIds || [];
    const updated = current.includes(restaurantId)
      ? current.filter(id => id !== restaurantId)
      : [...current, restaurantId];
    // Atualiza otimisticamente no estado local
    setCurrentUserProfile(prev => prev ? { ...prev, favoriteRestaurantIds: updated } : prev);
    setProfiles(prev => prev.map(p => p.id === currentUserProfile.id ? { ...p, favoriteRestaurantIds: updated } : p));
    const { error } = await supabase
      .from('profiles')
      .update({ favorite_restaurant_ids: updated })
      .eq('id', currentUserProfile.id);
    if (error) {
      // Reverte em caso de erro
      setCurrentUserProfile(prev => prev ? { ...prev, favoriteRestaurantIds: current } : prev);
      setProfiles(prev => prev.map(p => p.id === currentUserProfile.id ? { ...p, favoriteRestaurantIds: current } : p));
      throw error;
    }
  };

  const reportFailedDelivery = async (orderId: string, reason: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) throw new Error('Pedido não encontrado.');

    const { data: updated, error } = await supabase.from('orders')
      .update({ status: OrderStatus.DELIVERY_FAILED, failure_reason: reason })
      .eq('id', orderId).eq('status', OrderStatus.OUT_FOR_DELIVERY)
      .select('id').maybeSingle();
    if (error || !updated) throw new Error('Não foi possível registrar a falha de entrega.');

    // Reembolso automático via Asaas (best-effort: não bloqueia o fluxo se falhar)
    supabase.functions.invoke('refund-asaas-payment', { body: { orderId } }).catch(() => {});

    await fetchData();

    if (order.customerId) {
      supabase.functions.invoke('send-push-notification', {
        body: {
          userId: order.customerId,
          title: '⚠️ Problema na entrega',
          body: 'Seu entregador não conseguiu concluir a entrega. O reembolso será processado em breve.',
          data: { orderId, type: 'DELIVERY_FAILED' },
        },
      }).catch(() => {});
    }

    supabase.from('support_tickets').insert({
      user_id: session!.user.id,
      user_name: currentUserProfile?.name,
      user_role: 'DRIVER',
      message: `[AUTO] Entrega não concluída — Pedido #${orderId}. Motivo: ${reason}`,
      status: 'OPEN',
      created_at: new Date().toISOString(),
    }).then(null, () => {});
  };

  const startReturn = async (orderId: string) => {
    const { error } = await supabase.from('orders')
      .update({ status: OrderStatus.RETURNING })
      .eq('id', orderId).eq('status', OrderStatus.DELIVERY_FAILED);
    if (error) throw new Error(error.message);
    await fetchData();

    const order = orders.find(o => o.id === orderId);
    if (order?.restaurantId) {
      const { data: rest } = await supabase.from('restaurants')
        .select('owner_id').eq('id', order.restaurantId).single();
      if (rest?.owner_id) {
        supabase.functions.invoke('send-push-notification', {
          body: {
            userId: rest.owner_id,
            title: '🔄 Devolução a caminho',
            body: `Pedido #${orderId.slice(-4)} não pôde ser entregue. O entregador está retornando com o pedido.`,
            data: { orderId, type: 'RETURNING' },
          },
        }).catch(() => {});
      }
    }
  };

  const confirmReturn = async (orderId: string) => {
    const { error } = await supabase.from('orders')
      .update({ status: OrderStatus.RETURNED })
      .eq('id', orderId).eq('status', OrderStatus.RETURNING);
    if (error) throw new Error(error.message);
    await fetchData();
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

          // Notificações por status
          const order = orders.find(o => o.id === id);
          if (!order) return;

          if (s === OrderStatus.PREPARING && order.customerId) {
            supabase.functions.invoke('send-push-notification', {
              body: {
                userId: order.customerId,
                title: '👨‍🍳 Pedido aceito!',
                body: `${order.restaurantName} confirmou seu pedido e está preparando tudo!`,
                data: { orderId: id, type: 'ORDER_PREPARING' },
              },
            }).catch(() => {});
          }

          if (s === OrderStatus.READY) {
            // Notifica todos os entregadores disponíveis
            supabase.functions.invoke('send-push-notification', {
              body: {
                notifyDrivers: true,
                title: '📦 Pedido disponível!',
                body: `Novo pedido em ${order.restaurantName} pronto para retirada.`,
                data: { orderId: id, type: 'ORDER_READY' },
              },
            }).catch(() => {});
          }

          if (s === OrderStatus.CANCELLED && order.customerId) {
            supabase.functions.invoke('send-push-notification', {
              body: {
                userId: order.customerId,
                title: '❌ Pedido cancelado',
                body: `Seu pedido em ${order.restaurantName} foi cancelado. Dúvidas? Fale com o suporte.`,
                data: { orderId: id, type: 'ORDER_CANCELLED' },
              },
            }).catch(() => {});
          }
        },
        confirmPickup,
        confirmDelivery,
        processSyncQueue,
        submitRating: async (id, r) => {
          await supabase.from('orders').update({ rating: r }).eq('id', id);
          await fetchData();
        },
        assignDriver: async (oid, did) => {
          const driver = profiles.find(p => p.id === did);
          const order = orders.find(o => o.id === oid);

          let updatePayload: any = { driver_id: did, status: OrderStatus.READY };

          if (driver && order && driver.customFeePct !== undefined) {
            const driverFeePct = driver.customFeePct / 100;
            const newDriverEarnings = order.deliveryFee * (1 - driverFeePct);
            const diff = newDriverEarnings - order.driverNetEarnings;
            const newPlatformFee = order.platformFee - diff;

            updatePayload.driver_net_earnings = newDriverEarnings;
            updatePayload.platform_fee = newPlatformFee;
          }

          // 🔒 Anti-race condition: só atualiza se driver_id ainda for null
          // Evita que dois entregadores aceitem o mesmo pedido simultaneamente
          const { data: updated, error } = await supabase
            .from('orders')
            .update(updatePayload)
            .eq('id', oid)
            .is('driver_id', null)
            .select('id')
            .maybeSingle();

          if (error) throw new Error(`Erro ao aceitar pedido: ${error.message}`);
          if (!updated) throw new Error('Este pedido já foi aceito por outro entregador.');

          // Repasse somente em DELIVERED — release-payment-splits cuida de restaurante e entregador

          await fetchData();

          // Notifica cliente: entregador encontrado e a caminho do restaurante
          if (order?.customerId) {
            const driverName = driver?.name || 'Um entregador';
            supabase.functions.invoke('send-push-notification', {
              body: {
                userId: order.customerId,
                title: '🏍️ Entregador a caminho!',
                body: `${driverName} está indo buscar seu pedido em ${order.restaurantName}.`,
                data: { orderId: oid, type: 'DRIVER_ASSIGNED' },
              },
            }).catch(() => {});
          }
        },
        registerProfile,
        updateUserProfile,
        setupNotifications,
        deleteUserProfile: async id => {
          await supabase.from('profiles').delete().eq('id', id);
          await fetchData();
        },
        updateRestaurant: async (id, d) => {
          // Mapeia campos camelCase para snake_case do banco
          const dbData: any = { ...d };
          if ('isOpen' in d) { dbData.is_open = (d as any).isOpen; delete dbData.isOpen; }
          if ('openingHours' in d) { dbData.opening_hours = (d as any).openingHours; delete dbData.openingHours; }
          if ('ownerId' in d) { dbData.owner_id = (d as any).ownerId; delete dbData.ownerId; }
          if ('asaasAccountId' in d) { dbData.asaas_account_id = (d as any).asaasAccountId; delete dbData.asaasAccountId; }
          const { error } = await supabase.from('restaurants').update(dbData).eq('id', id);
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
        refreshData: () => fetchData(true),
        requestPasswordReset: async e => await supabase.auth.resetPasswordForEmail(e),
        toggleFavorite,
        cancelOrder,
        realDistances,
        recalculateDistances: async (addr: string, coords: { lat: number; lng: number }) => {
          const d = await getRealDistances(
            addr,
            restaurants.map(r => ({ id: r.id, lat: r.coords.lat, lng: r.coords.lng })),
            coords
          );
          setRealDistances(d);
        },
        calculateDistance: (lat1, lon1, lat2, lon2) => calculateHaversine(lat1, lon1, lat2, lon2),
        platformSettings,
        cart,
        addToCart,
        removeFromCart,
        updateCartItemQuantity,
        clearCart,
        reportFailedDelivery,
        startReturn,
        confirmReturn,
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
