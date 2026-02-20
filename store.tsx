
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Restaurant, Order, OrderStatus, Product, UserRole, PaymentMethod, UserProfile, UserAddress, OrderRating } from './types';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { getRealDistances, calculateHaversine } from './services/mapsService';
import { saveActiveOrderToOffline, clearOfflineActiveOrder, getSyncQueue, clearSyncQueue, OfflineConfirmation } from './services/offlineService';

const SUPERUSER_EMAIL = 'wendelbaracho@hotmail.com';

interface AppContextType {
  restaurants: Restaurant[];
  orders: Order[];
  profiles: UserProfile[]; 
  currentRole: UserRole | null;
  isLoading: boolean;
  isSupabaseConnected: boolean | null; 
  session: Session | null;
  currentUserProfile: UserProfile | null;
  setRole: (role: UserRole | null) => void;
  signOut: () => Promise<void>;
  loginAsTestUser: (profileId: string) => Promise<void>;
  createOrder: (restaurantId: string, items: any[], paymentMethod: PaymentMethod, address: string, customerName: string, changeFor?: number, addressCoords?: {lat: number, lng: number}) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  confirmPickup: (orderId: string, code: string) => Promise<boolean>;
  confirmDelivery: (orderId: string, code: string) => Promise<boolean>;
  processSyncQueue: () => Promise<void>;
  submitRating: (orderId: string, rating: OrderRating) => Promise<void>;
  assignDriver: (orderId: string, driverId: string) => Promise<void>;
  registerProfile: (profile: Partial<UserProfile>) => Promise<void>; 
  updateUserProfile: (id: string, data: Partial<UserProfile>) => Promise<void>;
  deleteUserProfile: (id: string) => Promise<void>;
  addAddress: (address: Omit<UserAddress, 'id'>) => Promise<UserAddress | void>; 
  updateAddress: (address: UserAddress) => Promise<void>;
  deleteAddress: (addressId: string) => Promise<void>;
  refreshData: () => Promise<void>;
  adjustCommissionBalance: (userId: string, amount: number) => Promise<void>;
  realDistances: Record<string, any>;
  recalculateDistances: (originAddress: string, originCoords: {lat: number, lng: number}) => Promise<void>;
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean | null>(null);
  const [realDistances, setRealDistances] = useState<Record<string, any>>({});

  const currentUserProfile = session ? profiles.find(p => p.id === session.user.id) || null : null;

  useEffect(() => {
    if (currentUserProfile) {
      setCurrentRole(currentUserProfile.role);
    }
  }, [currentUserProfile]);

  const mapProfile = (p: any): UserProfile => {
    const isSuper = p.email?.toLowerCase() === SUPERUSER_EMAIL.toLowerCase();
    return { 
      id: p.id, email: p.email, name: p.name, 
      role: isSuper ? UserRole.ADMIN : (p.role as UserRole), 
      status: isSuper ? 'APPROVED' : (p.status || 'PENDING'), 
      cpf: p.cpf || '', cnpj: p.cnpj || '', 
      vehicleType: p.vehicle_type || '', 
      licensePlate: p.license_plate || '',
      pixKey: p.pix_key || '', 
      pagseguroRecipientId: p.pagseguro_recipient_id || '',
      phoneNumber: p.phone_number || '', 
      savedAddresses: Array.isArray(p.saved_addresses) ? p.saved_addresses : [], 
      commissionBalance: Number(p.balance || 0),
      averageRating: Number(p.average_rating || 0),
      ratingsCount: Number(p.ratings_count || 0),
      lastOrderTimestamp: p.last_order_timestamp,
      createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
      passwordPlain: p.password_plain || ''
    };
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    return calculateHaversine(lat1, lon1, lat2, lon2);
  };

  const recalculateDistances = async (originAddress: string, originCoords: {lat: number, lng: number}) => {
    const destinations = restaurants.map(r => ({ id: r.id, lat: r.coords.lat, lng: r.coords.lng }));
    const results = await getRealDistances(originAddress, destinations, originCoords);
    setRealDistances(results);
  };

  const fetchData = async () => {
    try {
      const { data: restData, error: restError } = await supabase.from('restaurants').select('*').order('rating', { ascending: false });
      if (restError) console.warn("Erro ao buscar restaurantes:", restError.message);
      if (restData) setRestaurants(restData.map((r: any) => ({ ...r, menu: r.menu || [], rating: Number(r.rating || 0), ratingsCount: Number(r.ratings_count || 0) })));
      
      const { data: orderData, error: orderError } = await supabase.from('orders').select('*').order('timestamp', { ascending: false }).limit(100);
      if (orderError) console.warn("Erro ao buscar pedidos:", orderError.message);
      if (orderData) setOrders(orderData.map(o => ({ ...o, items: o.items || [] } as Order)));
      
      const { data: profileData, error: profileError } = await supabase.from('profiles').select('*');
      if (profileError) {
        console.error("Store: Erro ao buscar perfis (Global):", profileError.message);
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user?.id) {
          const { data: singleData, error: singleError } = await supabase.from('profiles').select('*').eq('id', currentSession.user.id).single();
          if (singleData && !singleError) setProfiles([mapProfile(singleData)]);
        }
        return;
      }
      if (profileData) setProfiles(profileData.map(p => mapProfile(p)));

    } catch(err: any) { 
      console.error("Store: Erro fatal inesperado no fetchData:", err.message || err); 
    }
  };
  
  const initializeApp = async () => {
    setIsLoading(true);
    try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        await fetchData();
        setIsSupabaseConnected(true);
        const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
          setSession(session);
          if (session) await fetchData();
        });
        return () => authListener.subscription.unsubscribe();
    } catch (e: any) { 
      console.error("Erro na inicialização:", e.message || e);
      setIsSupabaseConnected(false); 
    } finally { 
      setIsLoading(false); 
    }
  };

  useEffect(() => {
    initializeApp();
  }, []);

  const createOrder = async (restaurantId: string, items: any[], paymentMethod: PaymentMethod, address: string, customerName: string, changeFor?: number, addressCoords?: {lat: number, lng: number}) => {
    const restaurant = restaurants.find(r => r.id === restaurantId);
    if (!restaurant) return;
    const subtotal = items.reduce((sum, i) => sum + (i.product.price * i.quantity), 0);
    const deliveryFee = 5.00;
    const newOrder = {
      id: `ORD-${Date.now().toString().slice(-6)}`,
      restaurant_id: restaurantId, restaurant_name: restaurant.name,
      customer_id: session?.user.id, customer_address: address,
      customer_name: customerName, status: OrderStatus.PENDING, items, subtotal,
      delivery_fee: deliveryFee, total: subtotal + deliveryFee, payment_method: paymentMethod, 
      timestamp: new Date().toISOString(),
    };
    const { error } = await supabase.from('orders').insert(newOrder);
    if (error) console.error("Erro ao criar pedido:", error.message);
    await fetchData();
  };

 const submitRating = async (orderId: string, rating: OrderRating) => {
    const { error } = await supabase.from('orders').update({ rating }).eq('id', orderId);
    if (error) {
      console.error("Erro ao submeter avaliação:", error.message);
      return;
    }

    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    if (order.driverId) {
      const driver = profiles.find(p => p.id === order.driverId);
      if (driver) {
        const currentTotalRatings = driver.ratingsCount || 0;
        const currentAvg = driver.averageRating || 0;
        const newAvg = (currentAvg * currentTotalRatings + rating.driverStars) / (currentTotalRatings + 1);
        await supabase.from('profiles').update({ 
          average_rating: newAvg.toFixed(2),
          ratings_count: currentTotalRatings + 1
        }).eq('id', order.driverId);
      }
    }

    const restaurant = restaurants.find(r => r.id === order.restaurantId);
    if (restaurant) {
        const currentTotalRatings = (restaurant as any).ratings_count || 0;
        const currentAvg = restaurant.rating || 0;
        const newAvg = (currentAvg * currentTotalRatings + rating.storeStars) / (currentTotalRatings + 1);
        await supabase.from('restaurants').update({
            rating: newAvg.toFixed(2),
            ratings_count: currentTotalRatings + 1
        }).eq('id', restaurant.id);
    }

    await fetchData();
  };

  const confirmPickup = async (orderId: string, code: string): Promise<boolean> => {
      const order = orders.find(o => o.id === orderId);
      if (!order || order.pickupCode !== code) return false;
      await updateOrderStatus(orderId, OrderStatus.OUT_FOR_DELIVERY);
      return true;
  };

  const confirmDelivery = async (orderId: string, code: string): Promise<boolean> => {
      const order = orders.find(o => o.id === orderId);
      if (!order || order.deliveryCode !== code) return false;
      await updateOrderStatus(orderId, OrderStatus.DELIVERED);
      clearOfflineActiveOrder(); // Limpa o pedido offline após sucesso
      return true;
  };

  const processSyncQueue = async () => {
    const queue = getSyncQueue();
    if (queue.length === 0) return;

    console.log(`Sincronizando ${queue.length} confirmações offline...`);
    
    let allSucceeded = true;
    for (const confirmation of queue) {
      const { orderId, code, type } = confirmation;
      let success = false;
      if (type === 'pickup') {
        success = await confirmPickup(orderId, code);
      } else {
        success = await confirmDelivery(orderId, code);
      }
      if (!success) {
        allSucceeded = false;
        console.error(`Falha ao sincronizar confirmação offline para o pedido ${orderId}`);
        // Decide not to break, to try to sync other pending orders
      }
    }

    if (allSucceeded) {
      console.log("Sincronização offline concluída com sucesso.");
      clearSyncQueue();
    }
  };

  const adjustCommissionBalance = async (userId: string, amount: number) => {
    const { error } = await supabase.rpc('adjust_balance', { user_id: userId, amount_to_add: amount });
    if (error) console.error("Erro ao ajustar balanço:", error.message);
    await fetchData();
  };

  const signOut = async () => {
      await supabase.auth.signOut();
      setCurrentRole(null);
      setSession(null);
      setProfiles([]);
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (error) console.error("Erro ao atualizar status:", error.message);
    await fetchData();
  };

  const assignDriver = async (orderId: string, driverId: string) => {
     const { data, error } = await supabase.from('orders').update({ driver_id: driverId, status: OrderStatus.ACCEPTED }).eq('id', orderId).select().single();
     if (error) {
        console.error("Erro ao atribuir motorista:", error.message);
        return;
     }
     if (data) {
        saveActiveOrderToOffline(data as Order); // Salva o pedido ativo para uso offline
     }
     await fetchData();
  };

  const loginAsTestUser = async (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (profile && profile.passwordPlain) {
        await signOut();
        const { error } = await supabase.auth.signInWithPassword({ 
            email: profile.email,
            password: profile.passwordPlain
        });
        if (error) {
            alert("Não foi possível entrar como este usuário. A senha pode ter sido alterada ou o perfil é de um parceiro não aprovado.");
            await initializeApp(); 
        } else {
            window.location.reload();
        }
    } else {
        alert("Login não disponível para este usuário (senha não salva).");
    }
  };
  
  const registerProfile = async (profile: Partial<UserProfile>) => {
      const profileToSave: any = { 
          ...profile, 
          saved_addresses: Array.isArray(profile.savedAddresses) ? profile.savedAddresses : [],
          ratings_count: 0,
          average_rating: 0
      };
      const { error } = await supabase.from('profiles').upsert(profileToSave);
      if (error) {
          console.error("Erro ao registrar perfil no Supabase:", error.message);
          throw error;
      }
      await fetchData();
  };

  const updateUserProfile = async (id: string, data: Partial<UserProfile>) => {
      const { error } = await supabase.from('profiles').update(data).eq('id', id);
      if (error) console.error("Erro ao atualizar perfil:", error.message);
      await fetchData();
  };

  const deleteUserProfile = async (id: string) => { 
    const { error } = await supabase.rpc('delete_user_by_id', { user_id_to_delete: id });
    if (error) {
        console.error("Erro ao deletar usuário (RPC):", error.message);
        alert("Não foi possível remover o usuário. Verifique as permissões e a função no Supabase.");
    }
    await fetchData(); 
  };

  const addAddress = async (addrData: Omit<UserAddress, 'id'>): Promise<UserAddress | void> => { 
      if (!currentUserProfile) return;
      const newAddress = { id: `addr-${Date.now()}`, ...addrData };
      const currentAddresses = Array.isArray(currentUserProfile.savedAddresses) ? currentUserProfile.savedAddresses : [];
      const updatedAddresses = [...currentAddresses, newAddress];
      const { error } = await supabase.from('profiles').update({ saved_addresses: updatedAddresses }).eq('id', currentUserProfile.id);
      if (error) {
          console.error("Falha ao adicionar endereço no DB:", error);
          return;
      }
      await fetchData();
      return newAddress; 
  };
  
  const updateAddress = async (address: UserAddress) => { 
    if (!currentUserProfile) return; 
    const currentAddresses = Array.isArray(currentUserProfile.savedAddresses) ? currentUserProfile.savedAddresses : [];
    const updatedAddresses = currentAddresses.map(addr => addr.id === address.id ? address : addr); 
    const { error } = await supabase.from('profiles').update({ saved_addresses: updatedAddresses }).eq('id', currentUserProfile.id);
    if (error) console.error("Falha ao atualizar endereço no DB:", error);
    await fetchData();
  };
  
  const deleteAddress = async (addressId: string) => { 
    if (!currentUserProfile) return; 
    const currentAddresses = Array.isArray(currentUserProfile.savedAddresses) ? currentUserProfile.savedAddresses : [];
    const updatedAddresses = currentAddresses.filter(a => a.id !== addressId); 
    const { error } = await supabase.from('profiles').update({ saved_addresses: updatedAddresses }).eq('id', currentUserProfile.id);
    if (error) console.error("Falha ao deletar endereço no DB:", error);
    await fetchData();
  };

  // Dummy functions for props not used in this view but required by the context type
  const dummyAsync = async () => {};

  return (
    <AppContext.Provider value={{
      restaurants, orders, profiles, currentRole, isLoading, session, currentUserProfile,
      isSupabaseConnected, setRole: setCurrentRole, signOut, loginAsTestUser, submitRating, processSyncQueue,
      createOrder, updateOrderStatus, confirmPickup, confirmDelivery, 
      assignDriver, registerProfile, updateUserProfile, deleteUserProfile,
      addAddress, updateAddress, deleteAddress, refreshData: fetchData, adjustCommissionBalance,
      realDistances, recalculateDistances, calculateDistance
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppStore must be used within AppProvider");
  return context;
};
