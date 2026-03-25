import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import { Order, OrderStatus } from '../types';
import { getActiveOrderFromOffline, addToSyncQueue } from '../services/offlineService';
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
} from 'lucide-react';
import Logo from '../assets/Logo.png';
import Nome from '../assets/Nome.png';

const DriverProfile: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { currentUserProfile, updateUserProfile, orders } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);
  const [vehicle, setVehicle] = useState(currentUserProfile?.vehicleType || 'Moto');
  const [plate, setPlate] = useState(currentUserProfile?.licensePlate || '');
  const [phone, setPhone] = useState(currentUserProfile?.phoneNumber || '');

  const myRatings = useMemo(() => {
    return orders
      .filter(o => o.driverId === currentUserProfile?.id && o.rating)
      .map(o => o.rating!)
      .reverse();
  }, [orders, currentUserProfile]);

  const handleSave = async () => {
    if (!currentUserProfile) return;
    setIsSaving(true);
    await updateUserProfile(currentUserProfile.id, {
      vehicleType: vehicle,
      licensePlate: plate,
      phoneNumber: phone,
    });
    setIsSaving(false);
    alert('Dados atualizados!');
    onBack();
  };

  return (
    <div className="animate-in fade-in p-6 md:p-12 max-w-5xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 font-bold mb-8 hover:text-white transition-colors"
      >
        <ChevronRight className="rotate-180" /> Voltar
      </button>
      <h1 className="text-4xl font-black tracking-tighter mb-12">Meu Perfil</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-900 p-8 rounded-[2.5rem] border border-gray-800 shadow-xl">
          <h3 className="text-lg font-bold mb-6 text-gray-300">Configurações de Trabalho</h3>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">
                Veículo
              </label>
              <select
                value={vehicle}
                onChange={e => setVehicle(e.target.value)}
                className="w-full p-4 bg-gray-800 rounded-2xl font-bold border-none outline-none text-white focus:ring-2 focus:ring-green-500/20 transition-all"
              >
                <option>Moto</option>
                <option>Bicicleta</option>
                <option>Carro</option>
              </select>
            </div>
            {vehicle !== 'Bicicleta' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">
                  Placa
                </label>
                <input
                  value={plate}
                  onChange={e => setPlate(e.target.value.toUpperCase())}
                  className="w-full p-4 bg-gray-800 rounded-2xl font-bold border-none outline-none text-white focus:ring-2 focus:ring-green-500/20 transition-all"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">
                WhatsApp
              </label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full p-4 bg-gray-800 rounded-2xl font-bold border-none outline-none text-white focus:ring-2 focus:ring-green-500/20 transition-all"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-green-900/20 mt-4"
            >
              {isSaving ? <Loader className="animate-spin" size={20} /> : <Save size={20} />} Salvar
              Dados
            </button>
          </div>
        </div>

        <div className="bg-gray-900 p-8 rounded-[2.5rem] border border-gray-800 shadow-xl">
          <h3 className="text-lg font-bold mb-6 text-gray-300">Feedback dos Clientes</h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
            {myRatings.length > 0 ? (
              myRatings.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-5 bg-gray-800/50 rounded-2xl border border-gray-700"
                >
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, starIdx) => (
                      <Star
                        key={starIdx}
                        size={14}
                        className={
                          starIdx < r.driverStars
                            ? 'text-yellow-500 fill-yellow-500'
                            : 'text-gray-600'
                        }
                      />
                    ))}
                  </div>
                  <span className="text-[9px] font-black text-gray-500 uppercase">
                    Avaliação #{i + 1}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-10 opacity-30 italic text-sm">
                Nenhuma avaliação ainda.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const DriverView: React.FC = () => {
  const {
    orders,
    assignDriver,
    confirmPickup,
    confirmDelivery,
    signOut,
    currentUserProfile,
    updateUserProfile,
    calculateDistance,
    processSyncQueue,
    restaurants,
  } = useAppStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'stats' | 'profile'>(
    'dashboard'
  );
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

  const availableOrdersWithScore = useMemo(() => {
    return orders
      .filter(o => o.status === OrderStatus.READY && !o.driverId)
      .map(order => {
        const restaurant = restaurants.find(r => r.id === order.restaurantId);
        if (!restaurant || !currentPos) return { ...order, score: 0, distance: '---' };
        const distKm = calculateDistance(
          currentPos.lat,
          currentPos.lng,
          restaurant.coords.lat,
          restaurant.coords.lng
        );
        const rating = currentUserProfile?.averageRating || 5.0;
        const totalScore = (1 / (distKm + 0.1)) * 6.0 + rating * 0.5;
        return { ...order, score: totalScore, distance: distKm.toFixed(1) + 'km' };
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
          // Atualiza localização no banco apenas a cada 10 segundos para não sobrecarregar
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

  if (activeTab === 'profile')
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <DriverProfile onBack={() => setActiveTab('dashboard')} />
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col md:flex-row h-screen overflow-hidden">
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex w-80 bg-gray-900 flex-col p-10 h-full border-r border-gray-800 shadow-2xl">
        <div className="flex flex-col items-center mb-16 gap-3">
          <img src={Logo} alt="Logo" className="h-16 w-auto object-contain drop-shadow-xl" />
          <img src={Nome} alt="DeliveryCity" className="h-5 w-auto object-contain opacity-50" />
        </div>

        <div className="space-y-6 flex-1">
          <div className="bg-gray-800/40 p-8 rounded-[3rem] border border-gray-800 shadow-inner">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">
              Minha Reputação
            </p>
            <div className="flex items-center gap-3">
              <h2 className="text-4xl font-black text-white">
                {(currentUserProfile?.averageRating || 0).toFixed(1)}
              </h2>
              <Star className="text-yellow-500 fill-yellow-500 animate-pulse" size={28} />
            </div>
          </div>
          <div className="bg-gray-800/40 p-8 rounded-[3rem] border border-gray-800 shadow-inner">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">
              {isOnline ? 'Online' : 'Offline'}
            </p>
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
              ></div>
              <h2 className="text-xl font-black text-white">
                {isOnline ? 'Recebendo pedidos' : 'Indisponível'}
              </h2>
            </div>
          </div>
          <div className="bg-gray-800/40 p-8 rounded-[3rem] border border-gray-800 shadow-inner">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">
              Ganhos de Hoje
            </p>
            <h2 className="text-4xl font-black text-green-400 tracking-tighter">
              R$ {(currentUserProfile?.commissionBalance || 0).toFixed(2)}
            </h2>
          </div>
        </div>

        <div className="pt-10 space-y-2">
          <button
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-5 p-5 rounded-2xl transition-all font-black text-xs uppercase tracking-widest ${activeTab === 'history' ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            <Clock size={20} /> Histórico
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`w-full flex items-center gap-5 p-5 rounded-2xl transition-all font-black text-xs uppercase tracking-widest ${activeTab === 'stats' ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            <TrendingUp size={20} /> Estatísticas
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-5 p-5 rounded-2xl transition-all font-black text-xs uppercase tracking-widest ${activeTab === 'profile' ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            <Settings size={20} /> Configurações
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-5 p-5 text-gray-600 hover:text-red-400 hover:bg-red-500/5 rounded-2xl transition-all font-black text-xs uppercase tracking-widest"
          >
            <LogOut size={20} /> Sair
          </button>
        </div>
      </aside>

      {/* HEADER MOBILE */}
      <header className="md:hidden bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src={Logo} alt="Logo" className="h-10 w-auto object-contain" />
          <div className="h-6 w-px bg-gray-800 mx-1"></div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            Entregador
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`p-2 rounded-xl transition-all ${activeTab === 'dashboard' ? 'text-white bg-white/10' : 'text-gray-400'}`}
          >
            <Bike size={20} />
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`p-2 rounded-xl transition-all ${activeTab === 'history' ? 'text-white bg-white/10' : 'text-gray-400'}`}
          >
            <Clock size={20} />
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`p-2 rounded-xl transition-all ${activeTab === 'stats' ? 'text-white bg-white/10' : 'text-gray-400'}`}
          >
            <TrendingUp size={20} />
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`p-2.5 bg-gray-800 rounded-xl border border-gray-700 ${activeTab === 'profile' ? 'text-white' : 'text-gray-400'}`}
          >
            <User size={20} />
          </button>
          <button
            onClick={signOut}
            className="p-2.5 bg-gray-800 rounded-xl border border-gray-700 text-gray-500"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar relative p-6 md:p-12 pb-32">
        {!isOnline && (
          <div className="fixed top-20 right-6 bg-red-600 text-white text-[9px] font-black px-4 py-2 rounded-full flex items-center gap-2 animate-bounce z-50 shadow-xl uppercase tracking-widest">
            Sem Conexão
          </div>
        )}

        {activeOrder ? (
          <div className="max-w-3xl mx-auto animate-in fade-in h-full flex flex-col">
            <header className="mb-10">
              <h2 className="text-4xl font-black tracking-tighter">Missão Ativa</h2>
              <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">
                Siga as instruções para {activeOrder.status === 'READY' ? 'Coleta' : 'Entrega'}
              </p>
            </header>

            <div className="bg-gray-900 rounded-[4rem] border border-gray-800 overflow-hidden shadow-2xl">
              <div className="bg-gray-800/50 p-6 flex items-center justify-around border-b border-gray-800">
                <div
                  className={`flex flex-col items-center gap-2 ${activeOrder.status === 'READY' ? 'opacity-100' : 'opacity-20'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center font-black text-sm">
                    1
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-widest">Retirada</span>
                </div>
                <div className="h-px w-16 bg-gray-800" />
                <div
                  className={`flex flex-col items-center gap-2 ${activeOrder.status === 'OUT_FOR_DELIVERY' ? 'opacity-100' : 'opacity-20'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center font-black text-sm">
                    2
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-widest">Entrega</span>
                </div>
              </div>

              <div className="p-10 md:p-16 space-y-12">
                <div className="flex items-start gap-6">
                  <div
                    className={`p-5 rounded-[2rem] shadow-inner ${activeOrder.status === 'READY' ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500'}`}
                  >
                    {activeOrder.status === 'READY' ? <Store size={40} /> : <MapIcon size={40} />}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-3xl font-black text-white tracking-tighter mb-2">
                      {activeOrder.status === 'READY'
                        ? activeOrder.restaurantName
                        : activeOrder.customerName}
                    </h3>
                    <div className="bg-gray-800/80 p-6 rounded-[2rem] border border-gray-700 text-base font-bold leading-relaxed text-gray-300">
                      {activeOrder.status === 'READY'
                        ? 'Vá até o restaurante para retirar o pedido.'
                        : activeOrder.customerAddress}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowCodeInput(true)}
                  className={`w-full py-8 rounded-[2.5rem] font-black text-xl uppercase tracking-[0.2em] shadow-2xl transition active:scale-95 flex items-center justify-center gap-4 ${activeOrder.status === 'READY' ? 'bg-orange-600 text-white' : 'bg-green-600 text-white'}`}
                >
                  <KeyRound size={28} />{' '}
                  {activeOrder.status === 'READY' ? 'Validar Retirada' : 'Finalizar Entrega'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto animate-in fade-in">
            <header className="mb-14">
              <h2 className="text-5xl font-black text-white tracking-tighter mb-2">Disponíveis</h2>
              <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.3em]">
                Novas oportunidades em tempo real
              </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {availableOrdersWithScore.map(order => (
                <div
                  key={order.id}
                  className="bg-gray-900 p-10 rounded-[3.5rem] border border-gray-800 hover:border-green-500/30 transition-all group relative overflow-hidden shadow-xl active:scale-[0.98]"
                >
                  <div className="absolute -top-10 -right-10 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Bike size={200} />
                  </div>
                  <div className="mb-10 relative z-10">
                    <h3 className="font-black text-3xl text-white tracking-tighter mb-4">
                      {order.restaurantName}
                    </h3>
                    <div className="flex gap-4">
                      <span className="bg-gray-800 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <MapPin size={12} className="text-green-500" /> {order.distance}
                      </span>
                      <span className="bg-gray-800 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <Trophy size={12} className="text-yellow-500" /> Score{' '}
                        {order.score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-end relative z-10">
                    <div>
                      <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">
                        Você recebe
                      </p>
                      <div className="text-green-400 font-black text-4xl tracking-tighter">
                        R$ {order.driverNetEarnings.toFixed(2)}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        isOnline
                          ? assignDriver(order.id, currentUserProfile?.id!)
                          : alert('Fique Online!')
                      }
                      className="bg-white text-black px-10 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-green-600 hover:text-white transition-all shadow-xl"
                    >
                      Aceitar
                    </button>
                  </div>
                </div>
              ))}
              {availableOrdersWithScore.length === 0 && (
                <div className="col-span-full py-32 flex flex-col items-center justify-center text-gray-800 border-4 border-dashed border-gray-900 rounded-[4rem]">
                  <RefreshCw size={48} className="animate-spin mb-6 opacity-20" />
                  <p className="font-black uppercase tracking-[0.4em] text-[10px] opacity-30 text-center px-10 leading-relaxed">
                    Aguardando novos pedidos
                    <br />
                    para a sua localização...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {showCodeInput && (
          <div className="fixed inset-0 bg-black/95 z-[110] flex items-center justify-center p-6 backdrop-blur-2xl animate-in zoom-in-95 duration-300">
            <div className="bg-gray-900 w-full max-w-sm rounded-[4rem] p-12 border border-gray-800 text-center shadow-3xl">
              <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-8 text-green-500 border border-gray-700 shadow-inner">
                <KeyRound size={40} />
              </div>
              <h3 className="text-3xl font-black mb-2 tracking-tighter text-white">
                Código Seguro
              </h3>
              <p className="text-gray-500 text-[10px] font-black mb-10 uppercase tracking-widest leading-relaxed">
                Confirme os 4 dígitos com{' '}
                {activeOrder?.status === 'READY' ? 'o Lojista' : 'o Cliente'}
              </p>
              <input
                type="text"
                maxLength={4}
                value={inputCode}
                onChange={e => setInputCode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-gray-800 border-4 border-gray-700 rounded-[2rem] text-center text-5xl font-black py-8 mb-10 tracking-[15px] focus:border-green-500 outline-none text-white transition-all"
                placeholder="0000"
              />
              <div className="flex flex-col gap-4">
                <button
                  onClick={handleVerifyCode}
                  disabled={inputCode.length !== 4 || isVerifying}
                  className="w-full bg-white text-black font-black py-6 rounded-[2rem] text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50"
                >
                  {isVerifying ? (
                    <Loader className="animate-spin" size={24} />
                  ) : (
                    <CheckCircle size={24} />
                  )}{' '}
                  Confirmar
                </button>
                <button
                  onClick={() => setShowCodeInput(false)}
                  className="text-gray-600 font-black text-[9px] uppercase tracking-[0.3em] py-4 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HISTÓRICO DE ENTREGAS */}
        {activeTab === 'history' && (
          <div className="max-w-5xl mx-auto animate-in fade-in">
            <header className="mb-14">
              <h2 className="text-5xl font-black text-white tracking-tighter mb-2">Histórico</h2>
              <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.3em]">
                Todas as suas entregas realizadas
              </p>
            </header>

            <div className="space-y-4">
              {orders
                .filter(
                  o => o.driverId === currentUserProfile?.id && o.status === OrderStatus.DELIVERED
                )
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                .map(order => (
                  <div
                    key={order.id}
                    className="bg-gray-900 p-6 rounded-[2.5rem] border border-gray-800 shadow-xl"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-black text-white text-xl">{order.restaurantName}</h4>
                        <p className="text-gray-400 text-sm">{order.customerName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-black text-2xl">
                          R$ {order.driverNetEarnings.toFixed(2)}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleDateString('pt-BR')
                            : '---'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-gray-400 text-xs">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {order.customerAddress}
                      </span>
                    </div>
                    {order.rating && (
                      <div className="mt-4 flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            className={
                              i < order.rating!.driverStars
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-gray-600'
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              {orders.filter(
                o => o.driverId === currentUserProfile?.id && o.status === OrderStatus.DELIVERED
              ).length === 0 && (
                <div className="py-20 text-center text-gray-600">
                  <Package size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="font-black uppercase tracking-widest text-sm">
                    Nenhuma entrega ainda
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ESTATÍSTICAS */}
        {activeTab === 'stats' && (
          <div className="max-w-5xl mx-auto animate-in fade-in">
            <header className="mb-14">
              <h2 className="text-5xl font-black text-white tracking-tighter mb-2">Estatísticas</h2>
              <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.3em]">
                Seu desempenho como entregador
              </p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
              <div className="bg-gray-900 p-6 rounded-[2rem] border border-gray-800">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                  Total Entregas
                </p>
                <p className="text-3xl font-black text-white">
                  {
                    orders.filter(
                      o =>
                        o.driverId === currentUserProfile?.id && o.status === OrderStatus.DELIVERED
                    ).length
                  }
                </p>
              </div>
              <div className="bg-gray-900 p-6 rounded-[2rem] border border-gray-800">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                  Ganhos Total
                </p>
                <p className="text-3xl font-black text-green-400">
                  R${' '}
                  {orders
                    .filter(o => o.driverId === currentUserProfile?.id)
                    .reduce((sum, o) => sum + (o.driverNetEarnings || 0), 0)
                    .toFixed(2)}
                </p>
              </div>
              <div className="bg-gray-900 p-6 rounded-[2rem] border border-gray-800">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                  Média por Entrega
                </p>
                <p className="text-3xl font-black text-white">
                  R${' '}
                  {(
                    orders
                      .filter(
                        o =>
                          o.driverId === currentUserProfile?.id &&
                          o.status === OrderStatus.DELIVERED
                      )
                      .reduce((sum, o) => sum + (o.driverNetEarnings || 0), 0) /
                    Math.max(
                      orders.filter(
                        o =>
                          o.driverId === currentUserProfile?.id &&
                          o.status === OrderStatus.DELIVERED
                      ).length,
                      1
                    )
                  ).toFixed(2)}
                </p>
              </div>
              <div className="bg-gray-900 p-6 rounded-[2rem] border border-gray-800">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                  Avaliação
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-black text-white">
                    {(currentUserProfile?.averageRating || 0).toFixed(1)}
                  </p>
                  <Star className="text-yellow-500 fill-yellow-500" size={20} />
                </div>
              </div>
            </div>

            <div className="bg-gray-900 p-8 rounded-[2.5rem] border border-gray-800">
              <h3 className="text-lg font-black text-white mb-6">Últimas Avaliações</h3>
              <div className="space-y-4">
                {orders
                  .filter(o => o.driverId === currentUserProfile?.id && o.rating)
                  .slice(0, 5)
                  .map(order => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 bg-gray-800/50 rounded-2xl"
                    >
                      <div>
                        <p className="font-black text-white">{order.restaurantName}</p>
                        <p className="text-gray-400 text-xs">
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleDateString('pt-BR')
                            : ''}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={16}
                            className={
                              i < order.rating!.driverStars
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-gray-600'
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                {!orders.filter(o => o.driverId === currentUserProfile?.id && o.rating).length && (
                  <p className="text-gray-500 text-center py-4">Nenhuma avaliação ainda</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
