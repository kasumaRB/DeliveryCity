import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { Order, OrderStatus } from '../types';
import {
  Navigation,
  CheckCircle,
  KeyRound,
  Loader,
  LogOut,
  MapPin,
  Trophy,
  Bike,
  Store,
  WifiOff,
  RefreshCw,
  Layers,
  Star,
  Info,
  ChevronRight,
  Map as MapIcon,
  X,
  User,
  Settings,
  Save,
  Clock,
  DollarSign,
  Package,
  TrendingUp,
  Phone,
  Wallet,
  History,
  BarChart3,
  Home,
  Power,
  MessageCircle,
  AlertTriangle,
} from 'lucide-react';
import Logo from '../assets/Logo.png';
import Nome from '../assets/Nome.png';

const DriverProfile: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { currentUserProfile, updateUserProfile, orders, platformSettings } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);
  const [vehicle, setVehicle] = useState(currentUserProfile?.vehicleType || 'Moto');
  const [plate, setPlate] = useState(currentUserProfile?.licensePlate || '');
  const [phone, setPhone] = useState(currentUserProfile?.phoneNumber || '');
  const [pixKey, setPixKey] = useState(currentUserProfile?.pixKey || '');
  const [pagseguroId, setPagseguroId] = useState(currentUserProfile?.pagseguroRecipientId || '');

  const myRatings = useMemo(() => {
    return orders
      .filter(o => o.driverId === currentUserProfile?.id && o.rating)
      .map(o => o.rating!)
      .reverse();
  }, [orders, currentUserProfile]);

  const avgRating = useMemo(() => {
    if (myRatings.length === 0) return 0;
    return myRatings.reduce((sum, r) => sum + (r.driverStars || 0), 0) / myRatings.length;
  }, [myRatings]);

  const handleSave = async () => {
    if (!currentUserProfile) return;
    setIsSaving(true);
    await updateUserProfile(currentUserProfile.id, {
      vehicleType: vehicle,
      licensePlate: vehicle !== 'Bicicleta' ? plate : '',
      phoneNumber: phone,
      pixKey,
      pagseguroRecipientId: pagseguroId,
    });
    setIsSaving(false);
    alert('Dados atualizados!');
    onBack();
  };

  return (
    <div className="animate-in fade-in p-6 md:p-8 max-w-4xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 font-bold mb-6 hover:text-white transition-colors"
      >
        <ChevronRight className="rotate-180" /> Voltar
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-8 rounded-[3rem] shadow-xl shadow-blue-900/20">
            <h1 className="text-3xl font-black text-white mb-2">Meu Perfil</h1>
            <p className="text-blue-200 font-medium">Gerencie suas informações</p>
          </div>

          <div className="bg-gray-800/50 p-8 rounded-[3rem] border border-gray-700/50">
            <h3 className="text-lg font-bold mb-6 text-white flex items-center gap-3">
              <Bike className="text-blue-400" /> Veículo
            </h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {['Moto', 'Bicicleta', 'Carro'].map(v => (
                <button
                  key={v}
                  onClick={() => setVehicle(v)}
                  className={`p-5 rounded-2xl font-bold transition-all ${
                    vehicle === v
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                      : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {vehicle !== 'Bicicleta' && (
              <div className="space-y-2 mb-6">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">
                  Placa do Veículo
                </label>
                <input
                  value={plate}
                  onChange={e => setPlate(e.target.value.toUpperCase())}
                  className="w-full p-5 bg-gray-700/50 rounded-2xl font-bold border-2 border-transparent outline-none text-white focus:border-blue-500 transition-all"
                  placeholder="ABC-1234"
                />
              </div>
            )}

            <div className="space-y-2 mb-6">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">
                WhatsApp
              </label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full p-5 bg-gray-700/50 rounded-2xl font-bold border-2 border-transparent outline-none text-white focus:border-blue-500 transition-all"
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2 mb-6">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">
                Chave PIX
              </label>
              <input
                value={pixKey}
                onChange={e => setPixKey(e.target.value)}
                className="w-full p-5 bg-gray-700/50 rounded-2xl font-bold border-2 border-transparent outline-none text-white focus:border-blue-500 transition-all"
                placeholder="CPF, E-mail ou Telefone..."
              />
            </div>

            <div className="space-y-2 mb-8">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">
                ID Recebedor (PagBank)
              </label>
              <input
                value={pagseguroId}
                onChange={e => setPagseguroId(e.target.value)}
                className="w-full p-5 bg-gray-700/50 rounded-2xl font-bold border-2 border-transparent outline-none text-white focus:border-blue-500 transition-all"
                placeholder="Ex: re_123456789..."
              />
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-5 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-900/20"
            >
              {isSaving ? <Loader className="animate-spin" size={20} /> : <Save size={20} />}
              Salvar Alterações
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-8 rounded-[3rem] shadow-xl shadow-orange-900/20 text-center">
            <Star className="mx-auto mb-3 text-white" size={40} />
            <h3 className="text-5xl font-black text-white mb-1">{avgRating.toFixed(1)}</h3>
            <p className="text-white/80 font-medium text-sm">Média de Avaliações</p>
            <div className="flex justify-center gap-1 mt-4">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={16}
                  className={i < Math.round(avgRating) ? 'text-white fill-white' : 'text-white/30'}
                />
              ))}
            </div>
          </div>

          <div className="bg-gray-800/50 p-8 rounded-[3rem] border border-gray-700/50">
            <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-3">
              <Info className="text-blue-400" size={20} /> Dicas
            </h3>
            <ul className="space-y-3 text-gray-400 text-sm font-medium">
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
                Mantenha seu perfil atualizado
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
                Responda rápido para mais pedidos
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
                Avaliações boas = mais entregas
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export const DriverView: React.FC = () => {
  const {
    currentUserProfile,
    orders,
    restaurants,
    assignDriver,
    confirmPickup,
    confirmDelivery,
    signOut,
    processSyncQueue,
    calculateDistance,
    platformSettings,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'earnings' | 'support' | 'profile'>('home');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const activeOrder = useMemo(
    () =>
      orders.find(
        o =>
          o.driverId === currentUserProfile?.id && ['READY', 'OUT_FOR_DELIVERY'].includes(o.status)
      ),
    [orders, currentUserProfile]
  );

  const myDelivered = useMemo(() =>
    orders.filter(o => o.driverId === currentUserProfile?.id && o.status === OrderStatus.DELIVERED),
    [orders, currentUserProfile]
  );

  const todayEarnings = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return myDelivered.filter(o => new Date(o.timestamp).getTime() >= today.getTime())
      .reduce((s, o) => s + (o.driverNetEarnings || 0), 0);
  }, [myDelivered]);

  const completedToday = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return myDelivered.filter(o => new Date(o.timestamp).getTime() >= today.getTime()).length;
  }, [myDelivered]);

  const weekEarnings = useMemo(() => {
    const w = new Date(); w.setDate(w.getDate() - 7); w.setHours(0,0,0,0);
    return myDelivered.filter(o => new Date(o.timestamp).getTime() >= w.getTime())
      .reduce((s, o) => s + (o.driverNetEarnings || 0), 0);
  }, [myDelivered]);

  const monthEarnings = useMemo(() => {
    const m = new Date(); m.setDate(1); m.setHours(0,0,0,0);
    return myDelivered.filter(o => new Date(o.timestamp).getTime() >= m.getTime())
      .reduce((s, o) => s + (o.driverNetEarnings || 0), 0);
  }, [myDelivered]);

  const myRatings = useMemo(() =>
    orders.filter(o => o.driverId === currentUserProfile?.id && o.rating)
      .sort((a, b) => b.timestamp - a.timestamp),
    [orders, currentUserProfile]
  );

  const avgRating = useMemo(() => {
    if (!myRatings.length) return 0;
    return myRatings.reduce((s, o) => s + ((o.rating as any)?.driverStars || o.rating || 0), 0) / myRatings.length;
  }, [myRatings]);

  const handleSendSupport = async () => {
    if (!supportMessage.trim() || !currentUserProfile) return;
    setSupportSending(true);
    try {
      const { error } = await supabase.from('support_tickets').insert({
        user_id: currentUserProfile.id,
        user_name: currentUserProfile.name,
        user_role: currentUserProfile.role,
        message: supportMessage,
        status: 'OPEN',
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      alert('Mensagem enviada! Retornaremos em breve. ✅');
      setSupportMessage('');
      setActiveTab('home');
    } catch { alert('Erro ao enviar. Tente novamente.'); }
    finally { setSupportSending(false); }
  };

  const availableOrdersWithScore = useMemo(() => {
    return orders
      .filter(o => o.status === OrderStatus.READY && !o.driverId)
      .map(order => {
        const restaurant = restaurants.find(r => r.id === order.restaurantId);
        if (!restaurant || !currentPos) {
          return { ...order, score: 0, distanceToRest: 0, distanceToCust: 0, totalDist: '---', timeMins: 0 };
        }
        
        const distToRest = calculateDistance(
          currentPos.lat,
          currentPos.lng,
          restaurant.coords.lat,
          restaurant.coords.lng
        );
        
        let distToCust = 0;
        if (order.coords) {
          distToCust = calculateDistance(
            restaurant.coords.lat,
            restaurant.coords.lng,
            order.coords.lat,
            order.coords.lng
          );
        }

        const totalDist = distToRest + distToCust;
        const timeMins = Math.round((totalDist / 30) * 60) + 5; // 30km/h + 5 min margin

        const rating = currentUserProfile?.averageRating || 5.0;
        const totalScore = (1 / (totalDist + 0.1)) * 6.0 + rating * 0.5;
        
        return { 
          ...order, 
          score: totalScore, 
          distanceToRest: distToRest.toFixed(1),
          distanceToCust: distToCust.toFixed(1),
          totalDist: totalDist.toFixed(1) + 'km',
          timeMins
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [orders, currentPos, currentUserProfile, calculateDistance, restaurants]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processSyncQueue();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let lastLocationUpdate = 0;
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        pos => {
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentPos(newPos);
          const now = Date.now();
          if (currentUserProfile?.id && isOnline && now - lastLocationUpdate > 10000) {
            lastLocationUpdate = now;
            updateUserProfile(currentUserProfile.id, { currentLocation: newPos });
          }
        },
        null,
        { enableHighAccuracy: true }
      );
    }
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentUserProfile?.id, isOnline, processSyncQueue, updateUserProfile]);

  const handleVerifyCode = async () => {
    if (!activeOrder || !inputCode) return;
    setIsVerifying(true);
    const isPickup = activeOrder.status === 'READY';
    const success = isPickup
      ? await confirmPickup(activeOrder.id, inputCode)
      : await confirmDelivery(activeOrder.id, inputCode);
    if (success) {
      setShowCodeInput(false);
      setInputCode('');
    } else {
      alert('Código inválido.');
    }
    setIsVerifying(false);
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (activeTab === 'profile')
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <DriverProfile onBack={() => setActiveTab('home')} />
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col h-screen overflow-hidden safe-area-top safe-area-bottom">
      {/* Top Bar */}
      <header className="bg-gray-800/80 backdrop-blur-xl border-b border-gray-700/50 px-6 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <img src={Logo} alt="Logo" className="h-10 w-auto object-contain" />
        </div>

        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
          >
            <div
              className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
            ></div>
            <span className="text-xs font-bold uppercase tracking-wider">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24">
        {/* Status Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-600 to-green-700 p-5 rounded-[2rem] shadow-lg shadow-green-900/20">
            <DollarSign className="text-white/80 mb-2" size={24} />
            <p className="text-green-100 text-xs font-bold uppercase tracking-wider mb-1">Hoje</p>
            <p className="text-2xl font-black text-white">{formatCurrency(todayEarnings)}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-5 rounded-[2rem] shadow-lg shadow-blue-900/20">
            <CheckCircle className="text-white/80 mb-2" size={24} />
            <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">
              Entregas
            </p>
            <p className="text-2xl font-black text-white">{completedToday}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-5 rounded-[2rem] shadow-lg shadow-orange-900/20">
            <Star className="text-white/80 mb-2" size={24} />
            <p className="text-orange-100 text-xs font-bold uppercase tracking-wider mb-1">Nota</p>
            <p className="text-2xl font-black text-white">
              {(currentUserProfile?.averageRating || 0).toFixed(1)}
            </p>
          </div>
        </div>

        {/* Active Order */}
        {activeOrder && (
          <div className="mb-6 animate-in fade-in slide-in-from-top-4">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-[2.5rem] shadow-xl shadow-blue-900/20">
              <div className="flex items-center justify-between mb-4">
                <span className="text-blue-100 text-sm font-bold uppercase tracking-wider">
                  {activeOrder.status === 'READY' ? '🛒 Retirada' : '🚚 Entrega'}
                </span>
                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black text-white">
                  #{activeOrder.id.slice(-4)}
                </span>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div
                  className={`p-4 rounded-2xl ${activeOrder.status === 'READY' ? 'bg-orange-500' : 'bg-green-500'}`}
                >
                  {activeOrder.status === 'READY' ? <Store size={28} /> : <MapPin size={28} />}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black text-white">
                    {activeOrder.status === 'READY'
                      ? activeOrder.restaurantName
                      : activeOrder.customerName}
                  </h3>
                  <p className="text-blue-200 text-sm font-medium">
                    {activeOrder.status === 'READY'
                      ? 'Vá até o restaurante'
                      : activeOrder.customerAddress}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCodeInput(true)}
                  className="flex-1 bg-white text-blue-600 py-4 rounded-2xl font-black uppercase text-sm tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <KeyRound size={20} />
                  {activeOrder.status === 'READY' ? 'Confirmar Retirada' : 'Finalizar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pedidos Disponíveis — visível na home quando não há pedido ativo */}
        {activeTab === 'home' && !activeOrder && (
          <div className="animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-black text-white">Pedidos Disponíveis</h2>
              <span className={`px-4 py-2 rounded-full text-xs font-bold ${
                availableOrdersWithScore.length > 0
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-gray-700/50 text-gray-500'
              }`}>
                {availableOrdersWithScore.length} {availableOrdersWithScore.length === 1 ? 'novo' : 'novos'}
              </span>
            </div>

            <div className="space-y-4">
              {availableOrdersWithScore.length === 0 ? (
                <div className="bg-gray-800/50 p-12 rounded-[3rem] text-center border border-gray-700/50">
                  <Bike size={48} className="mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400 font-bold">Nenhum pedido disponível no momento</p>
                  <p className="text-gray-500 text-sm mt-2">Fique online e aguarde novos pedidos</p>
                </div>
              ) : (
                availableOrdersWithScore.map(order => (
                  <div
                    key={order.id}
                    className="bg-gray-800/50 p-6 rounded-[2.5rem] border border-gray-700/50 hover:border-blue-500/50 transition-all cursor-pointer active:scale-[0.98]"
                    onClick={() => isOnline && assignDriver(order.id, currentUserProfile?.id!)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-black text-white">{order.restaurantName}</h3>
                        <p className="text-gray-400 text-sm">{order.customerAddress}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-black text-xl">
                          {formatCurrency(order.driverNetEarnings || order.deliveryFee * (1 - (platformSettings?.driverFeePct ?? 0.08)))}
                        </p>
                        <p className="text-gray-500 text-xs">Você recebe</p>
                      </div>
                    </div>

                    <div className="bg-gray-700/30 rounded-xl p-3 mb-4 space-y-2">
                      <div className="flex justify-between text-xs text-gray-300 font-medium">
                        <span>Taxa de Entrega:</span>
                        <span>{formatCurrency(order.deliveryFee)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-red-400 font-medium">
                        <span>Comissão ({(platformSettings?.driverFeePct ?? 0.08) * 100}%):</span>
                        <span>- {formatCurrency(order.deliveryFee * (platformSettings?.driverFeePct ?? 0.08))}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-300 font-medium pt-2 border-t border-gray-700/50">
                        <span>Distâncias:</span>
                        <span>{order.distanceToRest}km (Rest) + {order.distanceToCust}km (Cliente)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1.5 bg-gray-700/50 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-300">
                        <MapPin size={14} /> {order.totalDist}
                      </span>
                      <span className="flex items-center gap-1.5 bg-gray-700/50 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-300">
                        <Clock size={14} className="text-blue-400" /> ~{order.timeMins} min
                      </span>
                      <span className="flex items-center gap-1.5 bg-gray-700/50 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-300">
                        <Trophy size={14} className="text-yellow-500" /> {order.score.toFixed(1)}
                      </span>
                      <span className="flex-1"></span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          isOnline ? assignDriver(order.id, currentUserProfile?.id!) : null;
                        }}
                        disabled={!isOnline}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Aceitar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Histórico de Entregas */}
        {activeTab === 'history' && (
          <div className="animate-in fade-in duration-500">
            <h2 className="text-2xl font-black text-white mb-6">Histórico de Entregas</h2>
            <div className="space-y-3">
              {myDelivered.length === 0 ? (
                <div className="text-center py-16 text-gray-500 bg-gray-800/30 rounded-[3rem] border border-gray-700/50">
                  <History size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="font-bold">Nenhuma entrega realizada ainda</p>
                </div>
              ) : (
                orders.filter(o => o.driverId === currentUserProfile?.id)
                  .sort((a, b) => b.timestamp - a.timestamp).slice(0, 50)
                  .map(order => (
                    <div key={order.id} className="bg-gray-800/50 p-5 rounded-2xl border border-gray-700/50">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-bold text-white">{order.restaurantName}</span>
                          <p className="text-gray-500 text-xs mt-0.5">
                            {new Date(order.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${
                          order.status === OrderStatus.DELIVERED ? 'bg-green-500/20 text-green-400'
                          : order.status === OrderStatus.CANCELLED ? 'bg-red-500/20 text-red-400'
                          : 'bg-gray-600 text-gray-300'
                        }`}>
                          {order.status === OrderStatus.DELIVERED ? 'Entregue' : order.status === OrderStatus.CANCELLED ? 'Cancelado' : order.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-700/50">
                        <span className="text-gray-500 text-xs">#{order.id.slice(-6)} · {order.customerName}</span>
                        <span className="text-green-400 font-bold">{formatCurrency(order.driverNetEarnings)}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* Ganhos */}
        {activeTab === 'earnings' && (
          <div className="animate-in fade-in duration-500 space-y-6">
            <h2 className="text-2xl font-black text-white">Meus Ganhos</h2>
            <div className="grid grid-cols-1 gap-4">
              {[
                { label: 'Hoje', value: todayEarnings, color: 'from-green-600 to-green-700', count: completedToday },
                { label: 'Últimos 7 dias', value: weekEarnings, color: 'from-blue-600 to-blue-700',
                  count: myDelivered.filter(o => new Date(o.timestamp) >= new Date(Date.now()-7*86400000)).length },
                { label: 'Este mês', value: monthEarnings, color: 'from-purple-600 to-purple-700',
                  count: myDelivered.filter(o => new Date(o.timestamp).getMonth() === new Date().getMonth()).length },
                { label: 'Total acumulado', value: myDelivered.reduce((s,o)=>s+(o.driverNetEarnings||0),0),
                  color: 'from-amber-500 to-orange-500', count: myDelivered.length },
              ].map(item => (
                <div key={item.label} className={`bg-gradient-to-r ${item.color} p-6 rounded-[2rem] shadow-lg`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">{item.label}</p>
                      <p className="text-3xl font-black text-white">{formatCurrency(item.value)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/70 text-xs font-bold">Entregas</p>
                      <p className="text-2xl font-black text-white">{item.count}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-800/50 rounded-[2rem] p-6 border border-gray-700/50">
              <h3 className="font-black text-white mb-4 flex items-center gap-2"><Star size={18} className="text-amber-400" /> Minhas Avaliações ({myRatings.length})</h3>
              {myRatings.length === 0 ? (
                <p className="text-gray-500 text-sm font-medium text-center py-6">Nenhuma avaliação ainda</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-700/50">
                    <span className="text-4xl font-black text-white">{avgRating.toFixed(1)}</span>
                    <div>
                      <div className="flex gap-1">{[...Array(5)].map((_,i) => <Star key={i} size={14} className={i < Math.round(avgRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'} />)}</div>
                      <p className="text-gray-400 text-xs mt-1">{myRatings.length} avaliações</p>
                    </div>
                  </div>
                  {myRatings.slice(0, 10).map(order => {
                    const stars = typeof order.rating === 'object' ? (order.rating as any)?.driverStars : order.rating;
                    return (
                      <div key={order.id} className="bg-gray-900/40 p-4 rounded-2xl">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-1">{[...Array(5)].map((_,i) => <Star key={i} size={12} className={i < (stars||0) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'} />)}</div>
                          <span className="text-gray-500 text-[10px]">{new Date(order.timestamp).toLocaleDateString('pt-BR')}</span>
                        </div>
                        {order.feedback && <p className="text-gray-300 text-sm mt-2 italic">"{order.feedback}"</p>}
                        <p className="text-gray-500 text-xs mt-1">{order.restaurantName} → {order.customerName}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Suporte */}
        {activeTab === 'support' && (
          <div className="animate-in fade-in duration-500 space-y-6">
            <h2 className="text-2xl font-black text-white">Falar com Suporte</h2>
            <div className="bg-gray-800/50 rounded-[2.5rem] p-6 border border-gray-700/50">
              <p className="text-gray-400 text-sm font-medium mb-6">Descreva seu problema ou dúvida. Nossa equipe responderá em breve.</p>
              <textarea
                value={supportMessage}
                onChange={e => setSupportMessage(e.target.value)}
                rows={6}
                className="w-full p-5 bg-gray-900/50 rounded-2xl text-white font-medium outline-none border-2 border-gray-700 focus:border-blue-500 transition-all resize-none mb-4"
                placeholder="Ex: Tive um problema com o pedido #1234..."
              />
              <button
                onClick={handleSendSupport}
                disabled={supportSending || !supportMessage.trim()}
                className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-3 transition-all disabled:opacity-50"
              >
                {supportSending ? <><div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Enviando...</> : <><MessageCircle size={18} /> Enviar Mensagem</>}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-gray-800/80 backdrop-blur-xl border-t border-gray-700/50 px-2 py-3 flex justify-around items-center shrink-0">
        {[
          { tab: 'home', icon: Home, label: 'Início' },
          { tab: 'history', icon: History, label: 'Entregas' },
          { tab: 'earnings', icon: DollarSign, label: 'Ganhos' },
          { tab: 'support', icon: MessageCircle, label: 'Suporte' },
          { tab: 'profile', icon: User, label: 'Perfil' },
        ].map(({ tab, icon: Icon, label }) => (
          <button
            key={tab}
            onClick={() => tab === 'profile' ? setActiveTab('profile') : setActiveTab(tab as any)}
            className={`flex flex-col items-center gap-1 p-2.5 rounded-2xl transition-all ${
              activeTab === tab ? 'text-blue-400 bg-blue-500/10' : 'text-gray-500'
            }`}
          >
            <Icon size={22} />
            <span className="text-[10px] font-bold">{label}</span>
          </button>
        ))}
        <button onClick={signOut} className="flex flex-col items-center gap-1 p-2.5 rounded-2xl text-gray-500 hover:text-red-400 transition-all">
          <LogOut size={22} />
          <span className="text-[10px] font-bold">Sair</span>
        </button>
      </nav>

      {/* Code Input Modal */}
      {showCodeInput && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-gray-800 p-8 rounded-[3rem] w-full max-w-md animate-in zoom-in-95">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <KeyRound size={40} className="text-blue-400" />
              </div>
              <h3 className="text-2xl font-black text-white">Digite o Código</h3>
              <p className="text-gray-400 text-sm mt-2">
                {activeOrder?.status === 'READY'
                  ? 'Código do pedido no restaurante'
                  : 'Código de entrega'}
              </p>
            </div>

            <input
              type="text"
              value={inputCode}
              onChange={e => setInputCode(e.target.value)}
              className="w-full p-6 bg-gray-700/50 rounded-2xl text-center text-3xl font-black text-white tracking-[0.5em] border-2 border-gray-600 outline-none focus:border-blue-500 mb-6"
              placeholder="0000"
              maxLength={4}
              autoFocus
            />

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowCodeInput(false);
                  setInputCode('');
                }}
                className="flex-1 py-4 bg-gray-700 text-gray-300 rounded-2xl font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleVerifyCode}
                disabled={isVerifying || inputCode.length < 4}
                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold disabled:opacity-50"
              >
                {isVerifying ? <Loader className="animate-spin mx-auto" /> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed bottom-24 left-6 right-6 bg-red-600 text-white py-3 px-6 rounded-2xl flex items-center justify-center gap-3 shadow-xl animate-bounce z-40">
          <WifiOff size={20} />
          <span className="font-bold text-sm">Sem conexão — modo offline</span>
        </div>
      )}
    </div>
  );
};
