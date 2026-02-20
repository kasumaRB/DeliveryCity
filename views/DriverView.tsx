
import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import { Order, OrderStatus } from '../types';
import { getActiveOrderFromOffline, addToSyncQueue } from '../services/offlineService';
import { Navigation, CheckCircle, KeyRound, Loader, LogOut, MapPin, Trophy, Bike, Store, WifiOff, RefreshCw, Layers, Star, Info, ChevronRight, Map as MapIcon, X, User, Settings, Save } from 'lucide-react';
import Logo from '../assets/Logo.png';

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
            phoneNumber: phone 
        });
        setIsSaving(false);
        alert("Dados atualizados!");
        onBack();
    };

    return (
        <div className="animate-in fade-in p-6 md:p-12">
            <button onClick={onBack} className="flex items-center gap-2 text-gray-400 font-bold mb-8"><ChevronRight className="rotate-180"/> Voltar</button>
            <h1 className="text-4xl font-black tracking-tighter mb-12">Meu Perfil de Entregador</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold mb-6">Configurações</h3>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500">Veículo</label>
                                <select value={vehicle} onChange={e => setVehicle(e.target.value)} className="w-full p-4 bg-gray-50 rounded-xl font-bold border-none outline-none">
                                    <option>Moto</option>
                                    <option>Bicicleta</option>
                                    <option>Carro</option>
                                </select>
                            </div>
                           {vehicle !== 'Bicicleta' && (
                             <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500">Placa</label>
                                <input value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} className="w-full p-4 bg-gray-50 rounded-xl font-bold border-none outline-none" />
                            </div>
                           )}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500">Telefone</label>
                                <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-4 bg-gray-50 rounded-xl font-bold border-none outline-none" />
                            </div>
                            <button onClick={handleSave} disabled={isSaving} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2">
                                {isSaving ? <Loader className="animate-spin"/> : <Save />} Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                     <h3 className="text-lg font-bold mb-6">Suas Avaliações</h3>
                     <div className="space-y-4">
                        {myRatings.length > 0 ? myRatings.map((r, i) => (
                            <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                                {[...Array(5)].map((_, starIdx) => (
                                    <Star key={starIdx} size={16} className={starIdx < r.driverStars ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'} />
                                ))}
                            </div>
                        )) : <p className="text-sm text-gray-400">Nenhuma avaliação ainda.</p>}
                     </div>
                </div>
            </div>
        </div>
    )
}

export const DriverView: React.FC = () => {
  const { 
      orders, restaurants, profiles, assignDriver, confirmPickup, 
      confirmDelivery, signOut, currentUserProfile, updateUserProfile, 
      calculateDistance, processSyncQueue 
  } = useAppStore();
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profile'>('dashboard');
  const currentDriverId = currentUserProfile?.id || '';
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [currentPos, setCurrentPos] = useState<{lat: number, lng: number} | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const activeOrder = useMemo(() => {
    const onlineOrder = orders.find(o => o.driverId === currentDriverId && ['READY', 'OUT_FOR_DELIVERY'].includes(o.status));
    if (onlineOrder) return onlineOrder;
    // Se estiver offline, tenta carregar do localStorage
    if (!isOnline) return getActiveOrderFromOffline();
    return null;
  }, [orders, currentDriverId, isOnline]);
  
  const availableOrdersWithScore = useMemo(() => {
      return orders.filter(o => o.status === OrderStatus.READY && !o.driverId).map(order => {
          const restaurant = restaurants.find(r => r.id === order.restaurantId);
          if (!restaurant || !currentPos) return { ...order, score: 0, distance: '---' };

          const distKm = calculateDistance(currentPos.lat, currentPos.lng, restaurant.coords.lat, restaurant.coords.lng);
          const factorD = (1 / (distKm + 0.1)) * 6.0;
          const rating = currentUserProfile?.averageRating || 5.0;
          const factorA = rating * 0.5;
          const lastOrder = currentUserProfile?.lastOrderTimestamp || 0;
          const waitMinutes = lastOrder === 0 ? 60 : (Date.now() - lastOrder) / 60000;
          const opportunityScore = Math.min(5, waitMinutes / 15); 
          const factorO = opportunityScore * 3.0;
          const totalScore = factorD + factorA + factorO;
          return { ...order, score: totalScore, distance: distKm.toFixed(1) + 'km' };
      }).sort((a, b) => b.score - a.score);
  }, [orders, currentPos, currentUserProfile, calculateDistance]);

  useEffect(() => {
      // Listener para status da conexão
      const handleOnline = () => { setIsOnline(true); processSyncQueue(); };
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      if (!navigator.geolocation) return;
      const watchId = navigator.geolocation.watchPosition(
          (pos) => {
              const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              setCurrentPos(newPos);
              if (currentDriverId && isOnline) {
                  updateUserProfile(currentDriverId, { currentLocation: newPos });
              }
          },
          (err) => console.error("GPS Error:", err),
          { enableHighAccuracy: true, maximumAge: 1000 }
      );
      return () => {
          navigator.geolocation.clearWatch(watchId);
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
      };
  }, [currentDriverId, isOnline, processSyncQueue]);

  const handleVerifyCode = async () => {
      if (!activeOrder || !inputCode) return;
      setIsVerifying(true);
      const isPickup = activeOrder.status === 'READY';
      
      if (isOnline) {
          const success = isPickup ? await confirmPickup(activeOrder.id, inputCode) : await confirmDelivery(activeOrder.id, inputCode);
          if (success) { 
              setShowCodeInput(false); 
              setInputCode('');
          } else {
              alert("Código inválido.");
          }
      } else {
          // Lógica OFFLINE
          const offlineOrder = getActiveOrderFromOffline();
          if (!offlineOrder) {
              alert("Erro: Pedido não encontrado no modo offline.");
              setIsVerifying(false);
              return;
          }
          
          const codeToVerify = isPickup ? offlineOrder.pickupCode : offlineOrder.deliveryCode;

          if (codeToVerify === inputCode) {
              const confirmation: any = { // O tipo será OfflineConfirmation
                  orderId: offlineOrder.id,
                  code: inputCode,
                  type: isPickup ? 'pickup' : 'delivery',
                  timestamp: Date.now(),
              };
              addToSyncQueue(confirmation);
              alert(`Confirmação ${isPickup ? 'de coleta' : 'de entrega'} salva! Será enviada assim que a internet voltar.`);
              setShowCodeInput(false);
              setInputCode('');
              // Se for entrega final, limpa o pedido ativo para liberar a tela do motorista
              if (!isPickup) {
                  // Idealmente, a UI refletiria que o pedido foi concluído offline
              }
          } else {
              alert("Código inválido.");
          }
      }
      setIsVerifying(false);
  };
  
  if (activeTab === 'profile') {
      return <DriverProfile onBack={() => setActiveTab('dashboard')} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col md:flex-row h-screen overflow-hidden">
      
      <aside className="hidden md:flex w-80 bg-gray-900 flex-col p-10 h-full border-r border-gray-800">
          <div className="flex items-center gap-4 mb-16">
              <img src={Logo} alt="Logo" className="h-12" />
          </div>
          
          <div className="space-y-6 flex-1">
              <div className="bg-gray-800/50 p-8 rounded-[2.5rem] border border-gray-700">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3">Sua Avaliação</p>
                  <div className="flex items-center gap-2 mb-6">
                      <h2 className="text-3xl font-black text-white">{(currentUserProfile?.averageRating || 0).toFixed(1)}</h2>
                      <Star className="text-yellow-500 fill-yellow-500" size={24}/>
                  </div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-900/50 p-3 rounded-2xl flex items-center gap-2">
                      <Info size={14} className="text-blue-400"/> {currentUserProfile?.ratingsCount || 0} avaliações
                  </div>
              </div>

              <div className="bg-gray-800/50 p-8 rounded-[2.5rem] border border-gray-700">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Ganhos em Carteira</p>
                  <h2 className="text-3xl font-black text-green-400">R$ {(currentUserProfile?.commissionBalance || 0).toFixed(2)}</h2>
              </div>
          </div>
          <button onClick={() => setActiveTab('profile')} className="flex items-center gap-5 p-5 text-gray-400 hover:text-white transition-colors font-black text-sm"><Settings size={22}/> Configurações</button>
          <button onClick={signOut} className="flex items-center gap-5 p-5 text-gray-500 hover:text-red-400 transition-colors font-black text-sm"><LogOut size={22}/> Sair</button>
      </aside>

      <main className="flex-1 overflow-y-auto no-scrollbar relative p-6 md:p-12">
          {!isOnline && (
              <div className="absolute top-6 right-6 bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-full flex items-center gap-2 animate-pulse">
                  <WifiOff size={14}/> MODO OFFLINE
              </div>
          )}
          {activeOrder ? (
            <div className="max-w-3xl mx-auto animate-in fade-in h-full flex flex-col">
                <header className="mb-10 flex justify-between items-center">
                    <div>
                        <h2 className="text-4xl font-black tracking-tighter">Missão Ativa</h2>
                        <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Siga para o próximo ponto de {activeOrder.status === 'READY' ? 'coleta' : 'entrega'}</p>
                    </div>
                    <div className="p-4 bg-gray-900 rounded-3xl border border-gray-800">
                        <Navigation size={24} className="text-green-500 animate-pulse"/>
                    </div>
                </header>

                <div className="bg-gray-900 rounded-[3.5rem] border border-gray-800 overflow-hidden shadow-2xl">
                    <div className="bg-gray-800/80 backdrop-blur-md p-5 flex items-center justify-around border-b border-gray-700">
                        <div className={`flex items-center gap-3 ${activeOrder.status === 'READY' ? 'opacity-100' : 'opacity-40'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${activeOrder.status === 'READY' ? 'bg-orange-500' : 'bg-gray-700'}`}>1</div>
                            <span className="text-[10px] font-black uppercase tracking-widest">Coleta</span>
                        </div>
                        <div className="w-12 h-px bg-gray-700"/>
                        <div className={`flex items-center gap-3 ${activeOrder.status === 'OUT_FOR_DELIVERY' ? 'opacity-100' : 'opacity-40'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${activeOrder.status === 'OUT_FOR_DELIVERY' ? 'bg-green-500' : 'bg-gray-700'}`}>2</div>
                            <span className="text-[10px] font-black uppercase tracking-widest">Entrega</span>
                        </div>
                    </div>

                    <div className="p-10 md:p-14 space-y-12">
                        <div>
                            <div className="flex items-center gap-4 mb-4">
                                <div className={`p-4 rounded-2xl ${activeOrder.status === 'READY' ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500'}`}>
                                    {activeOrder.status === 'READY' ? <Store size={32}/> : <MapIcon size={32}/>}
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-white tracking-tighter">
                                        {activeOrder.status === 'READY' ? activeOrder.restaurantName : activeOrder.customerName}
                                    </h2>
                                    <p className="text-gray-500 font-bold flex items-center gap-2 mt-1">
                                        <MapPin size={16}/> {activeOrder.status === 'READY' ? 'Ponto de Coleta' : 'Ponto de Entrega'}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-gray-800/50 p-8 rounded-[2.5rem] border border-gray-700 text-lg font-black leading-relaxed shadow-inner">
                                {activeOrder.status === 'READY' ? 'Aguardando sua chegada na loja...' : activeOrder.customerAddress}
                            </div>
                        </div>

                        <button 
                            onClick={() => setShowCodeInput(true)}
                            className={`w-full py-7 rounded-[2.5rem] font-black text-lg uppercase tracking-widest shadow-2xl transition active:scale-95 flex items-center justify-center gap-4 ${
                                activeOrder.status === 'READY' ? 'bg-orange-600 text-white shadow-orange-900/20' : 'bg-green-600 text-white shadow-green-900/20'
                            }`}
                        >
                            <KeyRound size={26}/> {activeOrder.status === 'READY' ? 'Validar na Loja' : 'Finalizar Entrega'}
                        </button>
                    </div>
                </div>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto animate-in fade-in">
                <header className="mb-14 flex justify-between items-end">
                    <div>
                        <h2 className="text-5xl font-black text-white tracking-tighter mb-3">Pátio de Entregas</h2>
                        <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.3em]">Distribuição Equitativa: Apiacás em tempo real</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {availableOrdersWithScore.map(order => (
                        <div key={order.id} className="bg-gray-900 p-10 rounded-[4rem] border border-gray-800 hover:border-green-500/50 transition-all group relative overflow-hidden shadow-sm hover:shadow-2xl">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity"><Bike size={120}/></div>
                            
                            <div className="mb-10 relative z-10">
                                <h3 className="font-black text-3xl text-white tracking-tighter mb-3">{order.restaurantName}</h3>
                                <div className="flex items-center gap-6">
                                    <div className="text-[10px] text-gray-500 flex items-center gap-2 font-black uppercase tracking-widest">
                                        <MapPin size={14} className="text-green-600"/> {order.distance}
                                    </div>
                                    <div className="text-[10px] text-gray-500 flex items-center gap-2 font-black uppercase tracking-widest">
                                        <Trophy size={14} className="text-yellow-500"/> Score {order.score.toFixed(1)}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center relative z-10">
                                <div>
                                    <div className="text-green-400 font-black text-4xl tracking-tighter">R$ {order.driverNetEarnings.toFixed(2)}</div>
                                    <p className="text-[8px] text-gray-500 font-black uppercase tracking-[0.2em] mt-1">Ganhos Estimados</p>
                                </div>
                                <button 
                                    onClick={() => isOnline ? assignDriver(order.id, currentDriverId) : alert("Fique Online para aceitar!")}
                                    className="bg-white text-black px-10 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-green-600 hover:text-white transition-all active:scale-95 shadow-xl"
                                >
                                    Aceitar
                                </button>
                            </div>
                        </div>
                    ))}
                    {availableOrdersWithScore.length === 0 && (
                        <div className="col-span-full py-48 flex flex-col items-center justify-center text-gray-800 border-4 border-dashed border-gray-900 rounded-[5rem]">
                            <div className="bg-gray-900 p-10 rounded-full mb-8"><RefreshCw size={64} className="animate-spin text-green-500/20" /></div>
                            <p className="font-black uppercase tracking-[0.4em] text-xs opacity-40">Buscando novos pedidos na cidade...</p>
                        </div>
                    )}
                </div>
            </div>
          )}

          {showCodeInput && (
            <div className="fixed inset-0 bg-black/95 z-[110] flex items-center justify-center p-6 backdrop-blur-xl animate-in zoom-in-95 duration-300">
                <div className="bg-gray-900 w-full max-w-sm rounded-[4rem] p-12 border border-gray-800 text-center">
                    <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-8 text-green-500 border border-gray-700"><KeyRound size={40}/></div>
                    <h3 className="text-3xl font-black mb-3 tracking-tighter text-white">Código de Segurança</h3>
                    <p className="text-gray-500 text-xs font-bold mb-10 uppercase tracking-widest">Peça o código de 4 dígitos para {activeOrder?.status === 'READY' ? 'a loja' : 'o cliente'}</p>
                    <input 
                        type="text" maxLength={4} value={inputCode} 
                        onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-gray-800 border-4 border-gray-700 rounded-[2rem] text-center text-5xl font-black py-8 mb-10 tracking-[20px] focus:border-green-500 outline-none text-white shadow-inner transition-all"
                        placeholder="0000"
                    />
                    <div className="flex flex-col gap-4">
                        <button 
                            onClick={handleVerifyCode} disabled={inputCode.length !== 4 || isVerifying}
                            className="w-full bg-white text-black font-black py-6 rounded-[2rem] disabled:opacity-50 transition-all text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-4"
                        >
                            {isVerifying ? <Loader className="animate-spin" size={24}/> : <CheckCircle size={24}/>} Confirmar
                        </button>
                        <button onClick={() => setShowCodeInput(false)} className="text-gray-500 font-black text-[10px] uppercase tracking-[0.2em] py-4">Voltar</button>
                    </div>
                </div>
            </div>
          )}
      </main>
    </div>
  );
};
