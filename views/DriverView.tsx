import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { Order, OrderStatus, UserAddress } from '../types';
import { AddressModal } from '../components/AddressModal';
import { TutorialModal, hasSeen, markSeen } from '../components/TutorialModal';
import { useAndroidBack } from '../hooks/useAndroidBack';
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
  Camera,
  ImagePlus,
  HelpCircle,
  MessageSquare,
  RotateCcw,
  Bell,
} from 'lucide-react';
import Logo from '../assets/Logo.png';
import Nome from '../assets/Nome.png';

const DriverProfile: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { currentUserProfile, updateUserProfile, orders, signOut } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [vehicle, setVehicle] = useState(currentUserProfile?.vehicleType || 'Moto');
  const [plate, setPlate] = useState(currentUserProfile?.licensePlate || '');
  const [phone, setPhone] = useState(currentUserProfile?.phoneNumber || '');
  const [pixKey, setPixKey] = useState(currentUserProfile?.pixKey || '');
  const [asaasAccountId] = useState(currentUserProfile?.asaasAccountId || '');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const baseAddr = currentUserProfile?.savedAddresses?.find(a => a.label === 'Base');
  const [baseAddressText, setBaseAddressText] = useState(
    baseAddr
      ? [baseAddr.street, baseAddr.number && `nº ${baseAddr.number}`, baseAddr.neighborhood, baseAddr.city]
          .filter(Boolean).join(', ')
      : ''
  );
  const [baseAddressData, setBaseAddressData] = useState<UserAddress | null>(baseAddr || null);
  const [showBaseModal, setShowBaseModal] = useState(false);

  const myDeliveries = useMemo(() =>
    orders.filter(o => o.driverId === currentUserProfile?.id && o.status === OrderStatus.DELIVERED),
    [orders, currentUserProfile]
  );

  const myRatings = useMemo(() =>
    orders.filter(o => o.driverId === currentUserProfile?.id && (o.rating as any)?.driverStars > 0),
    [orders, currentUserProfile]
  );

  const avgRating = useMemo(() => {
    if (!myRatings.length) return 0;
    return myRatings.reduce((s, o) => s + ((o.rating as any)?.driverStars ?? 0), 0) / myRatings.length;
  }, [myRatings]);

  const totalEarned = useMemo(() =>
    myDeliveries.reduce((s, o) => s + (o.driverNetEarnings || 0), 0),
    [myDeliveries]
  );

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserProfile) return;
    setIsUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `driver-${currentUserProfile.id}.${ext}`;
      const { data, error } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path);
      await updateUserProfile(currentUserProfile.id, { avatarUrl: publicUrl });
    } catch (e: any) {
      alert('Erro ao enviar foto: ' + (e?.message || 'Tente novamente'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!currentUserProfile) return;
    setIsSaving(true);
    try {
      const otherAddresses = (currentUserProfile.savedAddresses || []).filter(a => a.label !== 'Base');
      const newSavedAddresses = baseAddressData
        ? [{ ...baseAddressData, label: 'Base' }, ...otherAddresses]
        : otherAddresses;
      await updateUserProfile(currentUserProfile.id, {
        vehicleType: vehicle,
        licensePlate: vehicle !== 'Bicicleta' ? plate : '',
        phoneNumber: phone,
        pixKey,
        savedAddresses: newSavedAddresses,
      });
      alert('Dados atualizados!');
      onBack();
    } catch (e: any) {
      alert('Erro ao salvar: ' + (e?.message || 'Tente novamente'));
    } finally {
      setIsSaving(false);
    }
  };

  const vehicleIcons: Record<string, string> = { Moto: '🏍️', Bicicleta: '🚲', Carro: '🚗' };

  return (
    <div className="animate-in fade-in" style={{ paddingBottom: 'max(40px, env(safe-area-inset-bottom))' }}>
      {/* Hero */}
      <div className="bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 px-6 pt-6 pb-10 relative">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 font-bold mb-6 hover:text-white transition-colors text-sm"
        >
          <ChevronRight className="rotate-180" size={18} /> Voltar
        </button>

        {/* Avatar + nome */}
        <div className="flex items-end gap-5 mb-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-[2rem] overflow-hidden bg-blue-900/60 border-2 border-blue-500/40 shadow-xl">
              {currentUserProfile?.avatarUrl ? (
                <img src={currentUserProfile.avatarUrl} alt="foto" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User size={40} className="text-blue-300" />
                </div>
              )}
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-lg border-2 border-gray-900 hover:bg-blue-500 transition-all"
            >
              {isUploadingAvatar ? <Loader size={14} className="animate-spin text-white" /> : <Camera size={14} className="text-white" />}
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-white truncate">{currentUserProfile?.name || 'Entregador'}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm font-bold text-blue-300">
                {vehicleIcons[vehicle] || '🚗'} {vehicle}
              </span>
              {plate && vehicle !== 'Bicicleta' && (
                <span className="bg-white/10 text-gray-300 text-[10px] font-black px-2 py-0.5 rounded-lg tracking-widest">
                  {plate}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Entregas', value: myDeliveries.length, color: 'text-green-400' },
            { label: 'Nota Média', value: myRatings.length ? avgRating.toFixed(1) + ' ⭐' : '—', color: 'text-amber-400' },
            { label: 'Total Ganho', value: `R$${totalEarned.toFixed(0)}`, color: 'text-blue-300' },
          ].map(s => (
            <div key={s.label} className="bg-white/5 backdrop-blur rounded-2xl p-3 text-center border border-white/10">
              <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Formulário */}
      <div className="px-6 -mt-4 space-y-4">

        {/* Veículo */}
        <div className="bg-gray-800/60 backdrop-blur p-6 rounded-[2rem] border border-gray-700/50">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Bike size={14} className="text-blue-400" /> Veículo
          </p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {['Moto', 'Bicicleta', 'Carro'].map(v => (
              <button
                key={v}
                onClick={() => setVehicle(v)}
                className={`py-3 rounded-2xl text-sm font-black transition-all ${vehicle === v ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'}`}
              >
                {vehicleIcons[v]} {v}
              </button>
            ))}
          </div>
          {vehicle !== 'Bicicleta' && (
            <input
              value={plate}
              onChange={e => setPlate(e.target.value.toUpperCase())}
              className="w-full p-4 bg-gray-700/50 rounded-2xl font-black border-2 border-transparent outline-none text-white focus:border-blue-500 transition-all tracking-widest text-center text-lg"
              placeholder="ABC-1234"
              maxLength={8}
            />
          )}
        </div>

        {/* Contato */}
        <div className="bg-gray-800/60 backdrop-blur p-6 rounded-[2rem] border border-gray-700/50">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Phone size={14} className="text-green-400" /> Contato
          </p>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full p-4 bg-gray-700/50 rounded-2xl font-bold border-2 border-transparent outline-none text-white focus:border-blue-500 transition-all"
            placeholder="(00) 00000-0000"
          />
        </div>

        {/* Pagamento */}
        <div className="bg-gray-800/60 backdrop-blur p-6 rounded-[2rem] border border-gray-700/50">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Wallet size={14} className="text-purple-400" /> Chave PIX
          </p>
          <input
            value={pixKey}
            onChange={e => setPixKey(e.target.value)}
            className="w-full p-4 bg-gray-700/50 rounded-2xl font-bold border-2 border-transparent outline-none text-white focus:border-blue-500 transition-all"
            placeholder="CPF, e-mail ou telefone"
          />
        </div>

        {/* Região */}
        <div className="bg-gray-800/60 backdrop-blur p-6 rounded-[2rem] border border-gray-700/50">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <MapPin size={14} className="text-orange-400" /> Região de Atuação
          </p>
          <div className="relative">
            <input
              value={baseAddressText}
              readOnly
              placeholder="Toque para definir sua região"
              className="w-full p-4 pr-12 bg-gray-700/50 rounded-2xl font-bold border-2 border-transparent outline-none text-white cursor-pointer"
              onClick={() => setShowBaseModal(true)}
            />
            <button
              type="button"
              onClick={() => setShowBaseModal(true)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-orange-600/30 text-orange-400 hover:bg-orange-600/50 transition-all"
            >
              <MapPin size={16} />
            </button>
          </div>
          {baseAddressData?.coords && (
            <p className="text-[11px] text-green-400 font-bold mt-2 ml-1 flex items-center gap-1.5">
              <CheckCircle size={12} /> Localização definida
            </p>
          )}
        </div>

        {/* Conta Asaas (somente leitura) */}
        {asaasAccountId && (
          <div className="bg-gray-800/40 p-5 rounded-[2rem] border border-gray-700/30">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">ID Conta Asaas</p>
            <p className="text-gray-500 text-xs font-mono break-all">{asaasAccountId}</p>
          </div>
        )}

        {/* Salvar */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-5 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-900/40"
        >
          {isSaving ? <Loader className="animate-spin" size={20} /> : <Save size={20} />}
          Salvar Alterações
        </button>

        {/* Sair */}
        <button
          onClick={() => { if (window.confirm('Deseja sair da conta?')) signOut(); }}
          className="w-full py-4 flex items-center justify-center gap-2 text-red-400 font-bold text-sm hover:text-red-300 transition-colors"
        >
          <LogOut size={18} /> Sair da Conta
        </button>
      </div>

      {showBaseModal && (
        <AddressModal
          onClose={() => setShowBaseModal(false)}
          onSave={(addr: Omit<UserAddress, 'id'>) => {
            const parts = [addr.street, addr.number && `nº ${addr.number}`, addr.neighborhood, addr.city]
              .filter(Boolean)
              .join(', ');
            setBaseAddressText(parts);
            setBaseAddressData({ ...addr, id: baseAddressData?.id || crypto.randomUUID(), label: 'Base' });
            setShowBaseModal(false);
          }}
          initialAddress={baseAddressData}
          title="Sua Região de Atuação"
          saveButtonLabel="Confirmar Região"
        />
      )}
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
    reportFailedDelivery,
    startReturn,
    signOut,
    processSyncQueue,
    calculateDistance,
    platformSettings,
    updateUserProfile,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'earnings' | 'support' | 'profile'>('home');
  const [historySubTab, setHistorySubTab] = useState<'deliveries' | 'reviews'>('deliveries');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [supportWhatsapp, setSupportWhatsapp] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  useEffect(() => {
    if (!currentUserProfile) return;
    if (currentUserProfile.driverTutorialSeen || hasSeen('DRIVER')) {
      markSeen('DRIVER'); // sincroniza localStorage caso venha do banco
      return;
    }
    setShowTutorial(true);
  }, [currentUserProfile?.id]);

  useAndroidBack(() => {
    if (showTutorial)          { markSeen('DRIVER'); updateUserProfile(currentUserProfile!.id, { driverTutorialSeen: true }).catch(() => {}); setShowTutorial(false); return true; }
    if (showCodeInput)         { setShowCodeInput(false);                   return true; }
    if (activeTab !== 'home')  { setActiveTab('home');                      return true; }
    return false; // minimiza
  });
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);

  // Fluxo de falha de entrega
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [failureReason, setFailureReason] = useState('');
  const [isReportingFailed, setIsReportingFailed] = useState(false);
  const [failedConfirmed, setFailedConfirmed] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Delivery photo state
  const [deliveryPhotoStep, setDeliveryPhotoStep] = useState(false);
  const [deliveryPhotoPreview, setDeliveryPhotoPreview] = useState<string | null>(null);
  const [deliveryPhotoFile, setDeliveryPhotoFile] = useState<File | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const deliveryPhotoInputRef = useRef<HTMLInputElement>(null);

  const activeOrder = useMemo(
    () =>
      orders.find(
        o =>
          o.driverId === currentUserProfile?.id &&
          ['READY', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED', 'RETURNING'].includes(o.status)
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
    orders
      .filter(o => o.driverId === currentUserProfile?.id && (o.rating as any)?.driverStars > 0)
      .sort((a, b) => b.timestamp - a.timestamp),
    [orders, currentUserProfile]
  );

  const avgRating = useMemo(() => {
    if (!myRatings.length) return 0;
    return myRatings.reduce((s, o) => s + ((o.rating as any)?.driverStars ?? 0), 0) / myRatings.length;
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
    supabase.from('platform_settings').select('support_whatsapp').maybeSingle()
      .then(({ data }) => { if (data?.support_whatsapp) setSupportWhatsapp(data.support_whatsapp); });
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processSyncQueue();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let lastLocationUpdate = 0;
    let geoWatchId: number | null = null;
    if (navigator.geolocation) {
      geoWatchId = navigator.geolocation.watchPosition(
        pos => {
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentPos(newPos);
          const now = Date.now();
          if (currentUserProfile?.id && isOnline && now - lastLocationUpdate > 10000) {
            lastLocationUpdate = now;
            updateUserProfile(currentUserProfile.id, { currentLocation: newPos });
          }
        },
        (err) => {
          // GPS negado ou indisponível — usa última posição conhecida sem travar o app
          console.warn('[GPS] Erro ao obter localização:', err.message);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      );
    }
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      // Limpa o watcher de GPS para não empilhar múltiplos ao re-rodar o effect
      if (geoWatchId !== null) navigator.geolocation.clearWatch(geoWatchId);
    };
  }, [currentUserProfile?.id, isOnline, processSyncQueue, updateUserProfile]);

  const handleVerifyCode = async () => {
    if (!activeOrder || !inputCode) return;
    const isPickup = activeOrder.status === 'READY';

    if (isPickup) {
      setIsVerifying(true);
      const success = await confirmPickup(activeOrder.id, inputCode);
      if (success) {
        setShowCodeInput(false);
        setInputCode('');
      } else {
        alert('Código inválido.');
      }
      setIsVerifying(false);
    } else {
      // Delivery: go to photo capture step
      setDeliveryPhotoStep(true);
    }
  };

  const handleDeliveryPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDeliveryPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setDeliveryPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleConfirmDeliveryWithPhoto = async () => {
    if (!activeOrder || !inputCode) return;
    setIsUploadingPhoto(true);
    try {
      // Confirma entrega primeiro — só faz upload se código correto
      const success = await confirmDelivery(activeOrder.id, inputCode);
      if (success) {
        if (deliveryPhotoFile) {
          const fileName = `delivery/${activeOrder.id}-${Date.now()}.jpg`;
          const { data, error: uploadErr } = await supabase.storage
            .from('avatars')
            .upload(fileName, deliveryPhotoFile, { upsert: true });
          if (!uploadErr && data) {
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
            await supabase.from('orders').update({ delivery_photo_url: publicUrl }).eq('id', activeOrder.id);
          }
        }
        setShowCodeInput(false);
        setInputCode('');
        setDeliveryPhotoStep(false);
        setDeliveryPhotoPreview(null);
        setDeliveryPhotoFile(null);
      } else {
        alert('Código inválido. Volte e verifique o código.');
        setDeliveryPhotoStep(false);
      }
    } catch (e: any) {
      alert('Erro ao confirmar entrega: ' + (e.message || 'Tente novamente'));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (activeTab === 'profile')
    return (
      <div className="h-dvh bg-gray-950 flex justify-center items-start overflow-y-auto overflow-x-hidden">
        <div className="w-full md:max-w-2xl min-h-full bg-gray-900 text-white safe-area-top md:border-x md:border-gray-800/60">
          <DriverProfile onBack={() => setActiveTab('home')} />
        </div>
      </div>
    );

  const driverSlides = [
    { emoji: '🔔', title: 'Notificação de pedido', description: 'Quando um pedido estiver pronto no restaurante, você receberá uma notificação. Aceite rápido — outros entregadores também são avisados!' },
    { emoji: '📦', title: 'Vá buscar e confirme', description: 'No restaurante, toque em "Confirmar coleta" e digite o código que o atendente mostrar para você.' },
    { emoji: '🚀', title: 'Entregue e finalize', description: 'Na entrega, o cliente mostrará o código no app dele. Digite o código para confirmar e concluir a entrega.' },
    { emoji: '💰', title: 'Acompanhe seus ganhos', description: 'Veja o total de hoje, semana e mês na aba "Ganhos". O repasse é feito via Asaas diretamente na sua conta.' },
  ];

  return (
    <>
    {showTutorial && (
      <TutorialModal
        slides={driverSlides}
        accentColor="blue"
        onClose={() => { markSeen('DRIVER'); updateUserProfile(currentUserProfile!.id, { driverTutorialSeen: true }).catch(() => {}); setShowTutorial(false); }}
      />
    )}
    <div className="h-dvh bg-gray-950 flex justify-center overflow-hidden">
    <div className="flex flex-col w-full md:max-w-2xl bg-gray-900 text-white overflow-hidden safe-area-top md:border-x md:border-gray-800/60">

      {/* Top Bar — limpo, logo + status */}
      <header className="bg-gray-950 border-b border-gray-800/60 px-5 py-3 flex justify-between items-center shrink-0">
        <img src={Logo} alt="Logo" className="h-8 w-auto object-contain" />
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className={`text-xs font-bold tracking-wider ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-28">

        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="px-4 pt-4">

            {/* Quick stats — linha discreta no topo quando sem pedido ativo */}
            {!activeOrder && (
              <p className="text-gray-500 text-xs font-medium mb-5 tracking-wide">
                <span className="text-gray-400">{completedToday}</span> hoje
                {' · '}
                <span className="text-gray-400">{formatCurrency(todayEarnings)}</span>
                {' · '}
                <span className="text-amber-400">{(currentUserProfile?.averageRating || 0).toFixed(1)} ★</span>
              </p>
            )}

            {/* Pedido ativo */}
            {activeOrder && (
              <div className="mb-6 animate-in fade-in slide-in-from-top-4">

                {/* READY — Retirada */}
                {activeOrder.status === 'READY' && (
                  <div>
                    <p className="text-[10px] font-black text-orange-400 tracking-widest uppercase mb-2">Retirada</p>
                    <h2 className="text-3xl font-black text-white leading-tight mb-1">{activeOrder.restaurantName}</h2>
                    <p className="text-gray-500 text-sm mb-5">Vá até o restaurante e retire o pedido</p>
                    <button
                      onClick={() => setShowCodeInput(true)}
                      className="w-full bg-orange-500 text-white py-4 rounded-xl font-black text-sm tracking-wide flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      <KeyRound size={18} />
                      Confirmar Retirada
                    </button>
                  </div>
                )}

                {/* OUT_FOR_DELIVERY — Entregando */}
                {activeOrder.status === 'OUT_FOR_DELIVERY' && (
                  <div>
                    <p className="text-[10px] font-black text-green-400 tracking-widest uppercase mb-2">Entregando</p>
                    <h2 className="text-3xl font-black text-white leading-tight mb-1">{activeOrder.customerName}</h2>
                    <p className="text-gray-500 text-sm mb-5">{activeOrder.customerAddress}</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowCodeInput(true)}
                        className="flex-1 bg-green-600 text-white py-4 rounded-xl font-black text-sm tracking-wide flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <CheckCircle size={18} />
                        Finalizar
                      </button>
                      <button
                        onClick={() => { setFailedConfirmed(false); setFailureReason(''); setShowFailedModal(true); }}
                        className="flex-1 py-4 border border-red-500/50 text-red-400 rounded-xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <AlertTriangle size={16} />
                        Não entreguei
                      </button>
                    </div>
                  </div>
                )}

                {/* DELIVERY_FAILED — Devolução necessária */}
                {activeOrder.status === 'DELIVERY_FAILED' && (
                  <div className="bg-gray-800/40 rounded-2xl p-5 border-l-2 border-orange-500">
                    <p className="text-[10px] font-black text-orange-400 tracking-widest uppercase mb-2">Entrega não concluída</p>
                    <p className="text-white font-bold mb-1">{activeOrder.restaurantName}</p>
                    <p className="text-gray-500 text-sm mb-4">Reembolso em processamento. Devolva o pedido ao restaurante.</p>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(activeOrder.restaurantName)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-400 font-bold text-sm mb-4"
                    >
                      <MapPin size={14} /> Navegar até {activeOrder.restaurantName}
                    </a>
                    <button
                      onClick={async () => {
                        try { await startReturn(activeOrder.id); }
                        catch (e: any) { alert(e.message || 'Erro ao iniciar devolução.'); }
                      }}
                      className="w-full py-4 bg-orange-500 text-white rounded-xl font-black text-sm tracking-wide flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      <RotateCcw size={16} /> Iniciar devolução
                    </button>
                  </div>
                )}

                {/* RETURNING — Devolvendo */}
                {activeOrder.status === 'RETURNING' && (
                  <div className="bg-gray-800/40 rounded-2xl p-5 border-l-2 border-gray-600">
                    <div className="flex items-center gap-3">
                      <RotateCcw size={20} className="text-orange-400 animate-spin" style={{ animationDuration: '3s' }} />
                      <div>
                        <p className="text-white font-black">Devolvendo ao restaurante</p>
                        <p className="text-gray-500 text-sm">Aguarde a confirmação após entregar o pedido.</p>
                      </div>
                    </div>
                    <span className="mt-3 inline-block text-orange-400 text-[10px] font-black tracking-widest uppercase">
                      #{activeOrder.id.slice(-4)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Pedidos disponíveis — quando não há pedido ativo */}
            {!activeOrder && (
              <div className="animate-in fade-in duration-500">
                {availableOrdersWithScore.length === 0 ? (
                  <div className="pt-12 pb-16 text-center">
                    <Bike size={40} className="mx-auto mb-4 text-gray-700" />
                    <p className="text-gray-400 font-bold text-base">Nenhum pedido no momento</p>
                    <p className="text-gray-600 text-sm mt-1">Fique online e aguarde novos pedidos</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">
                      {availableOrdersWithScore.length} {availableOrdersWithScore.length === 1 ? 'pedido disponível' : 'pedidos disponíveis'}
                    </p>
                    {availableOrdersWithScore.map(order => (
                      <div
                        key={order.id}
                        className="py-4 border-b border-gray-800/80 last:border-0"
                        style={{ opacity: acceptingOrderId === order.id ? 0.5 : 1 }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-black text-white text-base min-w-0 truncate">{order.restaurantName}</span>
                          <span className="text-green-400 font-black text-lg shrink-0">
                            + {formatCurrency(order.driverNetEarnings || order.deliveryFee * (1 - (platformSettings?.driverFeePct ?? 0.08)))}
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs mb-3">
                          {order.customerAddress} · {order.totalDist}
                        </p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded-md">
                            ~{order.timeMins} min
                          </span>
                          <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded-md">
                            {order.distanceToRest}km até rest.
                          </span>
                          <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded-md">
                            ★ {order.score.toFixed(1)}
                          </span>
                        </div>
                        <button
                          onClick={async () => {
                            if (!isOnline || acceptingOrderId) return;
                            setAcceptingOrderId(order.id);
                            try {
                              await assignDriver(order.id, currentUserProfile?.id!);
                            } catch (e: any) {
                              alert(e.message || 'Não foi possível aceitar este pedido.');
                            } finally {
                              setAcceptingOrderId(null);
                            }
                          }}
                          disabled={!isOnline || !!acceptingOrderId}
                          className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
                        >
                          {acceptingOrderId === order.id ? 'Aceitando...' : 'Aceitar'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="px-4 pt-5 animate-in fade-in duration-500">

            {/* Toggle com underline indicator */}
            <div className="flex gap-6 border-b border-gray-800 mb-5">
              <button
                onClick={() => setHistorySubTab('deliveries')}
                className={`pb-3 text-sm font-black uppercase tracking-wider transition-all relative ${
                  historySubTab === 'deliveries' ? 'text-white' : 'text-gray-600'
                }`}
              >
                Entregas
                {historySubTab === 'deliveries' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 rounded-full" />
                )}
              </button>
              <button
                onClick={() => setHistorySubTab('reviews')}
                className={`pb-3 text-sm font-black uppercase tracking-wider transition-all relative ${
                  historySubTab === 'reviews' ? 'text-white' : 'text-gray-600'
                }`}
              >
                Avaliações {myRatings.length > 0 && `(${myRatings.length})`}
                {historySubTab === 'reviews' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />
                )}
              </button>
            </div>

            {/* Sub-tab: Entregas */}
            {historySubTab === 'deliveries' && (
              <div>
                {myDelivered.length === 0 ? (
                  <div className="pt-12 pb-16 text-center">
                    <History size={40} className="mx-auto mb-4 text-gray-700" />
                    <p className="text-gray-400 font-bold">Nenhuma entrega realizada ainda</p>
                  </div>
                ) : (
                  orders.filter(o => o.driverId === currentUserProfile?.id)
                    .sort((a, b) => b.timestamp - a.timestamp).slice(0, 50)
                    .map(order => (
                      <div key={order.id} className="py-3.5 border-b border-gray-800/60 last:border-0 flex items-center justify-between">
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="font-bold text-white text-sm truncate">{order.restaurantName}</p>
                          <p className="text-gray-600 text-xs mt-0.5">
                            {new Date(order.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            {' · '}{order.customerName}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-green-400 font-black text-sm">{formatCurrency(order.driverNetEarnings)}</p>
                          <span className={`text-[9px] font-black uppercase ${
                            order.status === OrderStatus.DELIVERED ? 'text-green-600'
                            : order.status === OrderStatus.CANCELLED ? 'text-red-500'
                            : 'text-gray-500'
                          }`}>
                            {order.status === OrderStatus.DELIVERED ? 'Entregue' : order.status === OrderStatus.CANCELLED ? 'Cancelado' : order.status}
                          </span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}

            {/* Sub-tab: Avaliações */}
            {historySubTab === 'reviews' && (
              <div>
                {myRatings.length === 0 ? (
                  <div className="pt-12 pb-16 text-center">
                    <Star size={40} className="mx-auto mb-4 text-gray-700" />
                    <p className="text-gray-400 font-bold">Nenhuma avaliação ainda</p>
                    <p className="text-gray-600 text-sm mt-1">As avaliações dos clientes aparecem aqui após a entrega</p>
                  </div>
                ) : (
                  <>
                    {/* Média hero em amber */}
                    <div className="mb-6 flex items-baseline gap-3">
                      <span className="text-5xl font-black text-amber-400">{avgRating.toFixed(1)}</span>
                      <div>
                        <div className="flex gap-0.5 mb-1">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} size={14} className={s <= Math.round(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-gray-700'} />
                          ))}
                        </div>
                        <p className="text-gray-500 text-xs font-medium">{myRatings.length} avaliação{myRatings.length !== 1 ? 'ões' : ''}</p>
                      </div>
                    </div>

                    {/* Lista de avaliações sem card */}
                    {myRatings.map(order => {
                      const stars: number = (order.rating as any)?.driverStars ?? 0;
                      const comment: string | undefined = (order.rating as any)?.comment || order.feedback;
                      return (
                        <div key={order.id} className="py-4 border-b border-gray-800/60 last:border-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map(s => (
                                <Star key={s} size={13} className={s <= stars ? 'fill-amber-400 text-amber-400' : 'text-gray-700'} />
                              ))}
                            </div>
                            <span className="text-gray-600 text-[10px]">
                              {new Date(order.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-gray-500 text-xs mb-1">{order.customerName} · {order.restaurantName}</p>
                          {comment ? (
                            <p className="text-gray-300 text-sm italic">"{comment}"</p>
                          ) : (
                            <p className="text-gray-700 text-xs italic">Sem comentário</p>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* EARNINGS TAB */}
        {activeTab === 'earnings' && (
          <div className="px-4 pt-8 animate-in fade-in duration-500">

            {/* Número hero: hoje */}
            <div className="text-center mb-8">
              <p className="text-5xl font-black text-white">{formatCurrency(todayEarnings)}</p>
              <p className="text-gray-500 text-sm mt-1 font-medium">hoje</p>
            </div>

            {/* Tabela simples */}
            <div>
              {[
                {
                  label: 'Últimos 7 dias',
                  value: weekEarnings,
                  count: myDelivered.filter(o => new Date(o.timestamp) >= new Date(Date.now()-7*86400000)).length,
                },
                {
                  label: 'Este mês',
                  value: monthEarnings,
                  count: myDelivered.filter(o => new Date(o.timestamp).getMonth() === new Date().getMonth()).length,
                },
                {
                  label: 'Total acumulado',
                  value: myDelivered.reduce((s,o)=>s+(o.driverNetEarnings||0),0),
                  count: myDelivered.length,
                },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-4 border-b border-gray-800/60 last:border-0">
                  <span className="text-gray-400 text-sm font-medium">{item.label}</span>
                  <div className="text-right">
                    <p className="text-white font-black text-base">{formatCurrency(item.value)}</p>
                    <p className="text-gray-600 text-[10px] font-medium">{item.count} entrega{item.count !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUPPORT TAB */}
        {activeTab === 'support' && (
          <div className="px-4 pt-5 animate-in fade-in duration-500">

            {/* Lista vertical de opções */}
            {supportWhatsapp && (
              <a
                href={`https://wa.me/55${supportWhatsapp}?text=${encodeURIComponent('Olá! Preciso de ajuda com uma entrega no DeliveryCity.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 py-4 border-b border-gray-800 group"
              >
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                  <Phone size={18} className="text-green-400" />
                </div>
                <span className="flex-1 text-white font-bold text-sm">Falar no WhatsApp</span>
                <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
              </a>
            )}

            <button
              onClick={() => setShowTutorial(true)}
              className="flex items-center gap-4 py-4 border-b border-gray-800 w-full group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <HelpCircle size={18} className="text-blue-400" />
              </div>
              <span className="flex-1 text-white font-bold text-sm text-left">Ver tutorial</span>
              <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
            </button>

            {/* Separador + formulário */}
            <div className="pt-6 pb-2">
              <p className="text-gray-600 text-xs font-medium mb-4">Ou deixe uma mensagem. Nossa equipe responderá em breve.</p>
              <textarea
                value={supportMessage}
                onChange={e => setSupportMessage(e.target.value)}
                rows={5}
                className="w-full p-4 bg-gray-800/50 rounded-xl text-white font-medium outline-none border border-gray-700/60 focus:border-blue-500/60 transition-all resize-none mb-4"
                placeholder="Ex: Tive um problema com o pedido #1234..."
              />
              <button
                onClick={handleSendSupport}
                disabled={supportSending || !supportMessage.trim()}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-sm tracking-wide flex items-center justify-center gap-3 transition-all disabled:opacity-50 active:scale-95"
              >
                {supportSending
                  ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Enviando...</>
                  : <><MessageCircle size={16} /> Enviar Mensagem</>
                }
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation — linha fina no topo da tab ativa */}
      <nav
        className="bg-gray-950 border-t border-gray-800/60 px-4 pt-2 flex justify-around items-center shrink-0"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        {(
          [
            { tab: 'home', icon: Home, label: 'Início' },
            { tab: 'history', icon: History, label: 'Entregas' },
            { tab: 'earnings', icon: DollarSign, label: 'Ganhos' },
            { tab: 'support', icon: MessageCircle, label: 'Suporte' },
            { tab: 'profile', icon: User, label: 'Perfil' },
          ] as const
        ).map(({ tab, icon: Icon, label }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex flex-col items-center gap-1 px-3 py-2 relative transition-all ${
              activeTab === tab ? 'text-white' : 'text-gray-600'
            }`}
          >
            {activeTab === tab && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-blue-400 rounded-full" />
            )}
            <Icon size={22} strokeWidth={activeTab === tab ? 2.5 : 1.5} />
            <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
          </button>
        ))}
      </nav>

      {/* Modal: Não consegui entregar */}
      {showFailedModal && activeOrder && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-end justify-center z-50">
          <div className="bg-gray-900 rounded-t-[3rem] w-full max-w-lg p-6 pb-10 animate-in slide-in-from-bottom-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white">Problema na entrega</h3>
              <button onClick={() => setShowFailedModal(false)} className="p-2 text-gray-400 hover:text-white">
                <X size={22} />
              </button>
            </div>

            {!failedConfirmed ? (
              <>
                {/* Seção 1: Contato com o cliente */}
                {activeOrder.customerPhone && (
                  <div className="bg-gray-800 rounded-2xl p-4 mb-4">
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Tentar contato com o cliente</p>
                    <div className="flex gap-3">
                      <a
                        href={`https://wa.me/55${activeOrder.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${activeOrder.customerName}! Estou no endereço de entrega do seu pedido. Pode me atender?`)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                      >
                        <MessageSquare size={16} /> WhatsApp
                      </a>
                      <button
                        onClick={() => {
                          supabase.functions.invoke('send-push-notification', {
                            body: {
                              userId: activeOrder.customerId,
                              title: '📍 Entregador no seu endereço',
                              body: 'Seu entregador está aguardando. Toque para abrir o app.',
                              data: { orderId: activeOrder.id, type: 'DRIVER_WAITING' },
                            },
                          }).catch(() => {});
                          alert('Notificação enviada ao cliente!');
                        }}
                        className="flex-1 py-3 bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                      >
                        <Bell size={16} /> Notificar
                      </button>
                    </div>
                  </div>
                )}

                {/* Seção 2: Suporte da plataforma */}
                {supportWhatsapp && (
                  <div className="bg-gray-800 rounded-2xl p-4 mb-4">
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Suporte da plataforma</p>
                    <a
                      href={`https://wa.me/55${supportWhatsapp}?text=${encodeURIComponent(`Preciso de ajuda na entrega do pedido #${activeOrder.id.slice(-4)}.`)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-green-400 font-bold text-sm"
                    >
                      <MessageSquare size={16} /> Falar com suporte via WhatsApp
                    </a>
                  </div>
                )}

                {/* Seção 3: Confirmar não-entrega */}
                <div className="bg-gray-800 rounded-2xl p-4 mb-4">
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Motivo da não-entrega</p>
                  <div className="space-y-2">
                    {['Cliente não estava no local', 'Não atende / não responde', 'Endereço não encontrado', 'Cliente recusou o pedido', 'Outro'].map(r => (
                      <label key={r} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${failureReason === r ? 'bg-red-600/20 border border-red-500/40' : 'bg-gray-700/50 border border-transparent'}`}>
                        <input
                          type="radio"
                          name="failureReason"
                          value={r}
                          checked={failureReason === r}
                          onChange={e => setFailureReason(e.target.value)}
                          className="accent-red-500"
                        />
                        <span className="text-white text-sm font-medium">{r}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  disabled={!failureReason || isReportingFailed}
                  onClick={async () => {
                    setIsReportingFailed(true);
                    try {
                      await reportFailedDelivery(activeOrder.id, failureReason);
                      setFailedConfirmed(true);
                    } catch (e: any) {
                      alert(e.message || 'Erro ao registrar falha.');
                    } finally {
                      setIsReportingFailed(false);
                    }
                  }}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-sm disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isReportingFailed ? <Loader size={18} className="animate-spin" /> : <AlertTriangle size={18} />}
                  Confirmar não entrega e solicitar reembolso
                </button>
              </>
            ) : (
              /* Após confirmar: instruções de devolução */
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <RotateCcw size={32} className="text-orange-400" />
                </div>
                <h4 className="text-white font-black text-lg mb-2">Reembolso solicitado</h4>
                <p className="text-gray-400 text-sm mb-6">Agora você precisa devolver o pedido ao restaurante <strong className="text-white">{activeOrder.restaurantName}</strong>.</p>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(activeOrder.restaurantName)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-blue-400 font-bold text-sm mb-6 underline"
                >
                  <MapPin size={16} /> Abrir rota no Google Maps
                </a>
                <button
                  onClick={async () => {
                    try {
                      await startReturn(activeOrder.id);
                      setShowFailedModal(false);
                    } catch (e: any) {
                      alert(e.message || 'Erro ao iniciar devolução.');
                    }
                  }}
                  className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2"
                >
                  <RotateCcw size={18} /> Iniciar devolução
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Code Input Modal */}
      {showCodeInput && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-gray-800 p-8 rounded-[3rem] w-full max-w-md animate-in zoom-in-95">
            {!deliveryPhotoStep ? (
              <>
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <KeyRound size={40} className="text-blue-400" />
                  </div>
                  <h3 className="text-2xl font-black text-white">Digite o Código</h3>
                  <p className="text-gray-400 text-sm mt-2">
                    {activeOrder?.status === 'READY'
                      ? 'Código do pedido no restaurante'
                      : 'Código de entrega do cliente'}
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
                    {isVerifying ? <Loader className="animate-spin mx-auto" /> : 'Avançar'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Camera size={40} className="text-green-400" />
                  </div>
                  <h3 className="text-2xl font-black text-white">Foto da Entrega</h3>
                  <p className="text-gray-400 text-sm mt-2">
                    Registre a entrega com uma foto (recomendado)
                  </p>
                </div>

                <input
                  ref={deliveryPhotoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleDeliveryPhotoChange}
                />

                {deliveryPhotoPreview ? (
                  <div className="relative mb-6">
                    <img
                      src={deliveryPhotoPreview}
                      className="w-full h-48 object-cover rounded-2xl"
                    />
                    <button
                      onClick={() => {
                        setDeliveryPhotoPreview(null);
                        setDeliveryPhotoFile(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => deliveryPhotoInputRef.current?.click()}
                    className="w-full h-36 border-2 border-dashed border-gray-600 rounded-2xl flex flex-col items-center justify-center gap-3 text-gray-400 hover:border-green-500 hover:text-green-400 transition-all mb-6"
                  >
                    <ImagePlus size={32} />
                    <span className="text-sm font-bold">Tirar foto / Escolher imagem</span>
                  </button>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={() => setDeliveryPhotoStep(false)}
                    className="flex-1 py-4 bg-gray-700 text-gray-300 rounded-2xl font-bold"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleConfirmDeliveryWithPhoto}
                    disabled={isUploadingPhoto}
                    className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-black disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isUploadingPhoto ? (
                      <Loader className="animate-spin" size={18} />
                    ) : (
                      <CheckCircle size={18} />
                    )}
                    {isUploadingPhoto ? 'Enviando...' : 'Confirmar Entrega'}
                  </button>
                </div>
                {!deliveryPhotoPreview && (
                  <p className="text-center text-gray-500 text-xs mt-3 font-medium">
                    A foto é opcional mas recomendada para sua segurança
                  </p>
                )}
              </>
            )}
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
    </div>
    </>
  );
};
