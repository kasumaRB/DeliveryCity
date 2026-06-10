import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { OrderStatus, Product, UserRole, Promotion, UserAddress, DaySchedule } from '../types';
import { AddressModal } from '../components/AddressModal';
import { DeleteAccountModal } from '../components/DeleteAccountModal';

const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          blob => {
            if (blob) {
              const resizedFile = new File([blob], file.name, { type: 'image/jpeg' });
              resolve(resizedFile);
            } else {
              reject(new Error('Failed to resize image'));
            }
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

import {
  Clock,
  CheckCircle,
  Utensils,
  Loader,
  LogOut,
  List,
  Store,
  LayoutDashboard,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  Bike,
  User,
  Save,
  Package,
  ChevronLeft,
  ChevronRight,
  X,
  Info,
  AlignLeft,
  Wallet,
  Tag,
  Percent,
  Gift,
  DollarSign,
  TrendingUp,
  MessageCircle,
  Star,
  Award,
  TrendingDown,
  Filter,
} from 'lucide-react';
import Logo from '../assets/Logo.png';
import Nome from '../assets/Nome.png';

export const RestaurantView: React.FC = () => {
  const {
    restaurants,
    orders,
    updateOrderStatus,
    updateMenu,
    updateRestaurant,
    updateProduct,
    deleteProduct,
    currentUserProfile,
    signOut,
    updateUserProfile,
    refreshData,
    platformSettings,
    confirmReturn,
    generateReturnCode,
  } = useAppStore();

  const myRestaurant = restaurants.find(r => r.ownerId === currentUserProfile?.id);
  const myOrders = myRestaurant ? orders.filter(o => o.restaurantId === myRestaurant.id) : [];

  // Som de alerta quando chega novo pedido PENDING
  const prevPendingCount = useRef<number | null>(null);
  useEffect(() => {
    const pendingCount = myOrders.filter(o => o.status === 'PENDING').length;
    if (prevPendingCount.current !== null && pendingCount > prevPendingCount.current) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const playBeep = (freq: number, start: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.4, ctx.currentTime + start);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + duration);
        };
        playBeep(880, 0, 0.15);
        playBeep(1100, 0.18, 0.15);
        playBeep(1320, 0.36, 0.25);
      } catch {}
    }
    prevPendingCount.current = pendingCount;
  }, [myOrders]);

  const [activeTab, setActiveTab] = useState<
    'orders' | 'menu' | 'promotions' | 'stats' | 'profile' | 'support'
  >('orders');
  const [mobileKanbanTab, setMobileKanbanTab] = useState<'pending' | 'preparing' | 'ready' | 'returning'>('pending');
  const [confirmingReturnId, setConfirmingReturnId] = useState<string | null>(null);
  const [generatingCodeId, setGeneratingCodeId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [itemFormName, setItemFormName] = useState('');
  const [itemFormOwnerPrice, setItemFormOwnerPrice] = useState('');
  const [itemFormDesc, setItemFormDesc] = useState('');
  const [itemFormImage, setItemFormImage] = useState('');
  const [itemFormCategory, setItemFormCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [restaurantImage, setRestaurantImage] = useState(myRestaurant?.image || '');
  const [showProductForm, setShowProductForm] = useState(false);

  // Support
  const [supportMessage, setSupportMessage] = useState('');

  // Profile Form States
  const [storeName, setStoreName] = useState(myRestaurant?.name || '');
  const [storeAddress, setStoreAddress] = useState(myRestaurant?.address || '');
  const [storeCoords, setStoreCoords] = useState<{ lat: number; lng: number } | null>(
    myRestaurant?.coords || null
  );
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [storeDescription, setStoreDescription] = useState(currentUserProfile?.description || '');
  const [storePrepTime, setStorePrepTime] = useState(String(myRestaurant?.prepTime ?? 30));
  const [storeWorkingHours, setStoreWorkingHours] = useState(
    currentUserProfile?.workingHours || ''
  );

  const defaultSchedule = (): DaySchedule[] =>
    ([0,1,2,3,4,5,6] as DaySchedule['day'][]).map(d => ({ day: d, open: '06:00', close: '20:00', closed: false }));

  const [scheduleHours, setScheduleHours] = useState<DaySchedule[]>(() =>
    (myRestaurant?.openingHours && myRestaurant.openingHours.length > 0)
      ? myRestaurant.openingHours
      : defaultSchedule()
  );
  const [respName, setRespName] = useState(currentUserProfile?.name || '');
  const [respPhone, setRespPhone] = useState(currentUserProfile?.phoneNumber || '');
  const [respCpf, setRespCpf] = useState(currentUserProfile?.cpf || '');
  const [respPix, setRespPix] = useState(currentUserProfile?.pixKey || '');
  const [respAsaasId, setRespAsaasId] = useState(currentUserProfile?.asaasAccountId || '');
  const [storeCnpj, setStoreCnpj] = useState(myRestaurant?.cnpj || '');
  const [storePhoneNumber, setStorePhoneNumber] = useState(myRestaurant?.phoneNumber || '');
  const [storeCategory, setStoreCategory] = useState(myRestaurant?.category || '');
  const [statsPeriod, setStatsPeriod] = useState<'today' | 'week' | 'month' | 'all'>('all');

  // Promotion states
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscountType, setPromoDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [promoDiscountValue, setPromoDiscountValue] = useState('');
  const [promoMinValue, setPromoMinValue] = useState('');
  const [promoDescription, setPromoDescription] = useState('');
  const [promoValidUntil, setPromoValidUntil] = useState('');
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [promoType, setPromoType] = useState<
    'PRODUCT_SPECIFIC' | 'MULTIPLE_PRODUCTS' | 'COUPON' | 'FREE_DELIVERY'
  >('COUPON');
  const [promoProductIds, setPromoProductIds] = useState<string[]>([]);
  const [promoMaxUsage, setPromoMaxUsage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Sincroniza os campos do formulário APENAS quando o modal de edição é ABERTO.
  // NÃO depende de myRestaurant/currentUserProfile para evitar que atualizações
  // do Realtime (que criam novas referências de objeto no store) resetem os campos
  // enquanto o usuário está editando.
  useEffect(() => {
    if (showEditModal && myRestaurant && currentUserProfile) {
      setStoreName(myRestaurant.name);
      setStoreAddress(myRestaurant.address || '');
      setStoreCoords(myRestaurant.coords || null);
      setStoreDescription(currentUserProfile.description || '');
      setStoreWorkingHours(currentUserProfile.workingHours || '');
      setScheduleHours(
        (myRestaurant.openingHours && myRestaurant.openingHours.length > 0)
          ? myRestaurant.openingHours
          : defaultSchedule()
      );
      setRespName(currentUserProfile.name);
      setRespPhone(currentUserProfile.phoneNumber || '');
      setRespCpf(currentUserProfile.cpf || '');
      setRespPix(currentUserProfile.pixKey || '');
      setRespAsaasId(currentUserProfile.asaasAccountId || '');
      setStorePrepTime(String(myRestaurant.prepTime ?? 30));
      setStoreCnpj(myRestaurant.cnpj || '');
      setStorePhoneNumber(myRestaurant.phoneNumber || '');
      setStoreCategory(myRestaurant.category || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEditModal]);

  const restaurantImageInputRef = React.useRef<HTMLInputElement>(null);

  const handleRestaurantImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !myRestaurant) return;
    if (!file.type.startsWith('image/')) {
      alert('Selecione uma imagem válida');
      return;
    }
    setIsSaving(true);
    try {
      const resizedFile = await resizeImage(file, 600, 600);
      const fileExt = 'jpg';
      const fileName = `restaurants/${myRestaurant.id}-${Date.now()}.${fileExt}`;
      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, resizedFile);
      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(uploadError.message);
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await updateRestaurant(myRestaurant.id, { image: publicUrl });
      setRestaurantImage(publicUrl);
      alert('Foto da loja atualizada!');
    } catch (error: any) {
      console.error('Full error:', error);
      alert('Erro ao atualizar foto: ' + (error.message || error));
    } finally {
      setIsSaving(false);
    }
  };

  const productImageInputRef = React.useRef<HTMLInputElement>(null);

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Selecione uma imagem válida');
      return;
    }
    setIsSaving(true);
    try {
      const resizedFile = await resizeImage(file, 400, 400);
      const fileExt = 'jpg';
      const fileName = `products/${currentUserProfile?.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, resizedFile);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(uploadError.message);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setItemFormImage(publicUrl);
      alert('Imagem carregada!');
    } catch (error: any) {
      console.error('Full error:', error);
      alert('Erro ao carregar imagem: ' + (error.message || error));
    } finally {
      setIsSaving(false);
    }
  };

  const resetMenuForm = () => {
    setEditingProduct(null);
    setItemFormName('');
    setItemFormOwnerPrice('');
    setItemFormDesc('');
    setItemFormImage('');
    setItemFormCategory('');
    setShowProductForm(false);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setItemFormName(product.name);
    
    const feePct = currentUserProfile?.customFeePct !== undefined 
      ? currentUserProfile.customFeePct / 100 
      : (platformSettings?.restaurantFeePct ?? 0.08);
    const basePrice = product.price || 0;
    setItemFormOwnerPrice(basePrice.toFixed(2));
    
    setItemFormDesc(product.description);
    setItemFormImage(product.image);
    setItemFormCategory(product.category || '');
    setShowProductForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveItem = async () => {
    const price = parseFloat(itemFormOwnerPrice);
    const feePct = currentUserProfile?.customFeePct !== undefined 
      ? currentUserProfile.customFeePct / 100 
      : (platformSettings?.restaurantFeePct ?? 0.08);
    const ownerPrice = price * (1 - feePct);
    const finalPrice = price;
    const img = itemFormImage || `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500`;

    try {
      if (editingProduct)
        await updateProduct(myRestaurant.id, editingProduct.id, {
          name: itemFormName,
          ownerPrice,
          price: Number(finalPrice.toFixed(2)),
          description: itemFormDesc,
          image: img,
          category: itemFormCategory || undefined,
        });
      else
        await updateMenu(myRestaurant.id, {
          id: `p-${Date.now()}`,
          name: itemFormName,
          description: itemFormDesc,
          ownerPrice,
          price: Number(finalPrice.toFixed(2)),
          image: img,
          category: itemFormCategory || undefined,
        });
      resetMenuForm();
      alert('Item salvo!');
    } catch (e: any) {
      alert('Erro ao salvar: ' + e.message);
    }
  };

  const handleUpdateStoreProfile = async () => {
    if (!myRestaurant || !currentUserProfile) return;
    setIsSaving(true);
    try {
      // Salva dados do restaurante e do perfil do responsável em paralelo
      await Promise.all([
        updateRestaurant(myRestaurant.id, {
          name: storeName,
          address: storeAddress,
          openingHours: scheduleHours,
          prepTime: Math.max(1, parseInt(storePrepTime) || 30),
          cnpj: storeCnpj,
          phoneNumber: storePhoneNumber,
          category: storeCategory,
          ...(storeCoords ? { coords: storeCoords } : {}),
        }),
        updateUserProfile(currentUserProfile.id, {
          name: respName,
          phoneNumber: respPhone,
          cpf: respCpf,
          pixKey: respPix,
          asaasAccountId: respAsaasId,
          description: storeDescription,
          workingHours: storeWorkingHours,
        }),
      ]);
      setShowEditModal(false);
      alert('Perfil da loja atualizado com sucesso!');
    } catch (e: any) {
      alert('Erro ao salvar: ' + (e?.message || 'Tente novamente'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendSupport = async () => {
    if (!supportMessage.trim() || !currentUserProfile) return;
    setIsSaving(true);
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
      alert('Mensagem enviada! Retornaremos em breve.');
      setSupportMessage('');
      setActiveTab('orders');
    } catch (e: any) {
      alert('Erro ao enviar mensagem.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!myRestaurant)
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader className="animate-spin text-orange-600" />
      </div>
    );

  const getOrdersByStatus = (statusList: OrderStatus[]) =>
    myOrders.filter(o => statusList.includes(o.status));

  const handleSavePromotion = async () => {
    if (!myRestaurant || !promoCode || !promoDiscountValue) return;
    const now = Date.now();
    const validUntil = promoValidUntil
      ? new Date(promoValidUntil).getTime()
      : now + 7 * 24 * 60 * 60 * 1000;

    const newPromo: Promotion = {
      id: editingPromo?.id || `promo-${Date.now()}`,
      code: promoCode.toUpperCase(),
      discountType: promoDiscountType,
      discountValue: parseFloat(promoDiscountValue),
      minOrderValue: promoMinValue ? parseFloat(promoMinValue) : undefined,
      description: promoDescription,
      validFrom: now,
      validUntil,
      isActive: true,
      type: promoType,
      productIds:
        promoType === 'PRODUCT_SPECIFIC' || promoType === 'MULTIPLE_PRODUCTS'
          ? promoProductIds
          : undefined,
      maxUsage: promoMaxUsage ? parseInt(promoMaxUsage) : undefined,
    };

    const currentPromos = myRestaurant.promotions || [];
    const updatedPromos = editingPromo
      ? currentPromos.map(p => (p.id === editingPromo.id ? newPromo : p))
      : [...currentPromos, newPromo];

    try {
      await updateRestaurant(myRestaurant.id, { promotions: updatedPromos });
      alert(editingPromo ? 'Promoção atualizada!' : 'Promoção criada!');
    } catch (e: any) {
      alert('Erro ao salvar promoção: ' + e.message);
      return;
    }

    // Reset form
    setPromoCode('');
    setPromoDiscountValue('');
    setPromoMinValue('');
    setPromoDescription('');
    setPromoValidUntil('');
    setPromoType('COUPON');
    setPromoProductIds([]);
    setPromoMaxUsage('');
    setEditingPromo(null);
  };

  const handleDeletePromotion = async (promoId: string) => {
    if (!myRestaurant || !window.confirm('Tem certeza que deseja excluir esta promoção?')) return;
    const updatedPromos = (myRestaurant.promotions || []).filter(p => p.id !== promoId);
    await updateRestaurant(myRestaurant.id, { promotions: updatedPromos });
  };

  const handleEditPromotion = (promo: Promotion) => {
    setEditingPromo(promo);
    setPromoCode(promo.code);
    setPromoDiscountType(promo.discountType);
    setPromoDiscountValue(promo.discountValue.toString());
    setPromoMinValue(promo.minOrderValue?.toString() || '');
    setPromoDescription(promo.description || '');
    setPromoValidUntil(new Date(promo.validUntil).toISOString().split('T')[0]);
    setPromoType(promo.type || 'COUPON');
    setPromoProductIds(promo.productIds || []);
    setPromoMaxUsage(promo.maxUsage?.toString() || '');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col md:flex-row h-screen overflow-hidden safe-area-top safe-area-bottom">
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col py-8 px-5 h-full">
        <div className="flex items-center gap-3 mb-10 px-2">
          <img src={Logo} alt="Logo" className="h-8 w-auto object-contain" />
          <img src={Nome} alt="DeliveryCity" className="h-4 w-auto object-contain opacity-40" />
        </div>
        <nav className="flex-1 space-y-1">
          {[
            { id: 'orders', label: 'Cozinha', icon: LayoutDashboard },
            { id: 'menu', label: 'Cardápio', icon: List },
            { id: 'promotions', label: 'Promoções', icon: Tag },
            { id: 'stats', label: 'Vendas', icon: TrendingUp },
            { id: 'profile', label: 'Minha Loja', icon: Store },
            { id: 'support', label: 'Suporte', icon: MessageCircle },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm ${
                activeTab === item.id
                  ? 'border-l-4 border-orange-600 bg-orange-50 text-orange-600 pl-3'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
              }`}
            >
              <item.icon size={18} /> <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-3 px-4 py-2 text-red-300 hover:text-red-500 transition-colors font-bold text-xs uppercase tracking-widest"
          >
            Excluir minha conta
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-500 transition-colors font-bold text-sm"
          >
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>
      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}

      {/* HEADER MOBILE */}
      <header className="md:hidden bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <img src={Logo} alt="Logo" className="h-10 w-auto object-contain" />
          <div className="h-6 w-px bg-gray-100 mx-1"></div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            Restaurante
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={signOut}
            className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-gray-400"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 md:p-12 no-scrollbar pb-32">
          {activeTab === 'orders' && (
            <div className="h-full flex flex-col animate-in fade-in duration-500">
              <header className="mb-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tighter mb-2">
                      Painel de Pedidos
                    </h2>
                    <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest ${myRestaurant.isOpen !== false ? 'text-green-600' : 'text-red-500'}`}>
                      <div className={`w-2 h-2 rounded-full ${myRestaurant.isOpen !== false ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                      {myRestaurant.isOpen !== false ? 'Em operação' : 'Loja fechada'}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const next = !myRestaurant.isOpen;
                      if (next && (!myRestaurant.menu || myRestaurant.menu.length === 0)) {
                        alert('Adicione pelo menos um produto ao cardápio antes de abrir a loja.');
                        return;
                      }
                      await updateRestaurant(myRestaurant.id, { isOpen: next });
                    }}
                    className={`flex items-center gap-3 px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-wide transition-all shrink-0 ${
                      myRestaurant.isOpen !== false
                        ? 'bg-green-500 text-white'
                        : 'bg-red-100 text-red-600 hover:bg-red-200'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${
                      myRestaurant.isOpen !== false ? 'bg-white animate-pulse' : 'bg-red-400'
                    }`} />
                    {myRestaurant.isOpen !== false ? 'Aberta' : 'Fechada'}
                  </button>
                </div>
              </header>

              {/* MOBILE: Seletor de coluna */}
              <div className="flex lg:hidden gap-1 mb-4 bg-gray-100 p-1 rounded-xl overflow-x-auto no-scrollbar">
                {([
                  { id: 'pending', label: 'Pendentes', count: getOrdersByStatus([OrderStatus.PENDING]).length, color: 'bg-orange-500' },
                  { id: 'preparing', label: 'Cozinha', count: getOrdersByStatus([OrderStatus.PREPARING]).length, color: 'bg-blue-500' },
                  { id: 'ready', label: 'Prontos', count: getOrdersByStatus([OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY]).length, color: 'bg-green-500' },
                  { id: 'returning', label: 'Devoluções', count: getOrdersByStatus([OrderStatus.RETURNING]).length, color: 'bg-red-500' },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setMobileKanbanTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-black transition-all whitespace-nowrap ${
                      mobileKanbanTab === tab.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${tab.color} shrink-0`} />
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full text-white ${tab.color}`}>{tab.count}</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0 pb-4 no-scrollbar">
                {/* COLUNA: PENDENTES */}
                <div className={`flex flex-col h-full ${mobileKanbanTab !== 'pending' ? 'hidden lg:flex' : 'flex'}`}>
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.15em]">
                      Pendentes ({getOrdersByStatus([OrderStatus.PENDING]).length})
                    </h3>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar">
                    {getOrdersByStatus([OrderStatus.PENDING]).map(order => (
                      <div
                        key={order.id}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 animate-in zoom-in-95 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                                <span className="text-orange-600 font-black text-xs">
                                  {order.customerName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="font-black text-gray-900 text-sm">{order.customerName}</span>
                            </div>
                            {order.customerAddress && (
                              <p className="text-gray-400 text-xs truncate max-w-[160px]">{order.customerAddress}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-black text-gray-900 text-sm">#{order.id.slice(-4)}</span>
                            <p className="text-gray-400 text-[10px]">
                              {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <div className="border-t border-gray-50 pt-2 space-y-1 mb-3">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs text-gray-600">
                              <span>{item.quantity}x {item.product.name}</span>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => updateOrderStatus(order.id, OrderStatus.PREPARING)}
                          className="w-full bg-orange-600 text-white py-2.5 rounded-xl font-black text-xs tracking-wide active:scale-95 transition-all"
                        >
                          Aceitar Pedido
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* COLUNA: PREPARANDO */}
                <div className={`flex flex-col h-full ${mobileKanbanTab !== 'preparing' ? 'hidden lg:flex' : 'flex'}`}>
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.15em]">
                      Na Cozinha ({getOrdersByStatus([OrderStatus.PREPARING]).length})
                    </h3>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar">
                    {getOrdersByStatus([OrderStatus.PREPARING]).map(order => (
                      <div
                        key={order.id}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 animate-in zoom-in-95"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                <span className="text-blue-600 font-black text-xs">
                                  {order.customerName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="font-black text-gray-900 text-sm">{order.customerName}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-black text-gray-900 text-sm">#{order.id.slice(-4)}</span>
                            <p className="text-blue-500 text-[10px] font-black animate-pulse">Cozinhando</p>
                          </div>
                        </div>
                        <div className="border-t border-gray-50 pt-2 space-y-1 mb-3">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs text-gray-600">
                              <span>{item.quantity}x {item.product.name}</span>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => updateOrderStatus(order.id, OrderStatus.READY)}
                          className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-black text-xs tracking-wide active:scale-95 transition-all"
                        >
                          Marcar como Pronto
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* COLUNA: PRONTOS */}
                <div className={`flex flex-col h-full ${mobileKanbanTab !== 'ready' ? 'hidden lg:flex' : 'flex'}`}>
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.15em]">
                      Prontos ({getOrdersByStatus([OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY]).length})
                    </h3>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar">
                    {getOrdersByStatus([OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY]).map(
                      order => (
                        <div
                          key={order.id}
                          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 animate-in zoom-in-95"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                                  <span className="text-green-600 font-black text-xs">
                                    {order.customerName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <span className="font-black text-gray-900 text-sm">{order.customerName}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-black text-gray-900 text-sm">#{order.id.slice(-4)}</span>
                              <div className="flex items-center gap-1 justify-end mt-0.5">
                                <Bike
                                  size={12}
                                  className={order.driverId ? 'text-green-500' : 'text-gray-300'}
                                />
                                <span
                                  className={`text-[9px] font-black uppercase ${order.driverId ? 'text-green-600' : 'text-orange-500'}`}
                                >
                                  {order.status === OrderStatus.OUT_FOR_DELIVERY
                                    ? 'Em Trânsito'
                                    : order.driverId
                                      ? 'A caminho'
                                      : 'Buscando'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="bg-gray-900 px-4 py-3 rounded-xl text-center">
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">
                              Código de Coleta
                            </p>
                            <span className="text-2xl text-white font-black tracking-[6px]">
                              {order.pickupCode}
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
                {/* COLUNA: DEVOLUÇÕES */}
                <div className={`flex flex-col h-full ${mobileKanbanTab !== 'returning' ? 'hidden lg:flex' : 'flex'}`}>
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.15em]">
                      Devoluções ({getOrdersByStatus([OrderStatus.RETURNING]).length})
                    </h3>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar">
                    {getOrdersByStatus([OrderStatus.RETURNING]).length === 0 ? (
                      <p className="text-gray-300 text-xs text-center pt-6">Sem devoluções</p>
                    ) : getOrdersByStatus([OrderStatus.RETURNING]).map(order => (
                      <div
                        key={order.id}
                        className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4 animate-in zoom-in-95"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                                <span className="text-orange-600 font-black text-xs">
                                  {order.customerName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="font-black text-gray-900 text-sm">{order.customerName}</span>
                            </div>
                            {order.failureReason && (
                              <p className="text-red-400 text-[10px] font-medium mt-0.5">Motivo: {order.failureReason}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-black text-gray-900 text-sm">#{order.id.slice(-4)}</span>
                            <p className="text-orange-500 text-[9px] font-black animate-pulse mt-0.5">A caminho</p>
                          </div>
                        </div>
                        <div className="border-t border-gray-50 pt-2 space-y-1 mb-3">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs text-gray-600">
                              <span>{item.quantity}x {item.product.name}</span>
                            </div>
                          ))}
                        </div>
                        {/* Código de devolução — gerado pelo restaurante, digitado pelo entregador */}
                        {order.returnCode ? (
                          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 text-center">
                            <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">Código de devolução</p>
                            <p className="text-4xl font-black text-orange-700 tracking-[0.3em]">{order.returnCode}</p>
                            <p className="text-[10px] text-orange-400 mt-2">Mostre ao entregador. Ele digitará no aplicativo.</p>
                          </div>
                        ) : (
                          <button
                            disabled={generatingCodeId === order.id}
                            onClick={async () => {
                              setGeneratingCodeId(order.id);
                              try { await generateReturnCode(order.id); }
                              catch (e: any) { alert(e.message || 'Erro ao gerar código.'); }
                              finally { setGeneratingCodeId(null); }
                            }}
                            className="w-full bg-orange-600 text-white py-2.5 rounded-xl font-black text-xs tracking-wide active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {generatingCodeId === order.id
                              ? <><Loader size={14} className="animate-spin" /> Gerando...</>
                              : '🔑 Gerar código de devolução'
                            }
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'menu' && (
            <div className="animate-in fade-in duration-500 max-w-7xl mx-auto">
              <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-16">
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tighter mb-2">
                    Cardápio Digital
                  </h2>
                  <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">
                    Gestão de produtos da sua loja.
                  </p>
                </div>
                <button
                  onClick={() => {
                    resetMenuForm();
                    setShowProductForm(true);
                    window.scrollTo(0, 0);
                  }}
                  className="flex items-center gap-3 bg-orange-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wide active:scale-95 transition-all"
                >
                  <Plus size={20} /> Novo Prato
                </button>
              </header>

              <div className="flex flex-col xl:flex-row gap-12 items-start">
                {showProductForm && (
                  <div className="w-full xl:w-[450px] bg-white p-8 rounded-2xl shadow-sm border border-gray-100 xl:sticky xl:top-10 h-fit">
                    <div className="flex justify-between items-start mb-10">
                      <h3 className="text-2xl font-black text-gray-900 flex items-center gap-4">
                        {editingProduct ? (
                          <Edit2 size={24} className="text-orange-600" />
                        ) : (
                          <Plus size={24} className="text-orange-600" />
                        )}{' '}
                        {editingProduct ? 'Editar Item' : 'Novo Item'}
                      </h3>
                      <button
                        onClick={resetMenuForm}
                        className="p-2 bg-gray-50 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-600 transition-all"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                        Nome do Prato
                      </label>
                      <input
                        value={itemFormName}
                        onChange={e => setItemFormName(e.target.value)}
                        className="w-full p-5 bg-gray-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-orange-100 shadow-inner"
                        placeholder="Ex: X-Salada Especial"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                        Categoria / Tipo
                      </label>
                      <select
                        value={itemFormCategory}
                        onChange={e => setItemFormCategory(e.target.value)}
                        className="w-full p-5 bg-gray-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-orange-100 shadow-inner"
                      >
                        <option value="">Selecione...</option>
                        <option value="Lanche">Lanche</option>
                        <option value="Pizza">Pizza</option>
                        <option value="Hambúrguer">Hambúrguer</option>
                        <option value="Açai">Açai</option>
                        <option value="Sorvete">Sorvete</option>
                        <option value="Bebida">Bebida</option>
                        <option value="Sobremesa">Sobremesa</option>
                        <option value="Salgado">Salgado</option>
                        <option value=" Japonesa">Japonesa</option>
                        <option value="Mexicana">Mexicana</option>
                        <option value="Italiana">Italiana</option>
                        <option value="Brasileira">Brasileira</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                        Foto do Prato
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-gray-100 rounded-2xl overflow-hidden flex items-center justify-center">
                          {itemFormImage ? (
                            <img src={itemFormImage} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-gray-400 text-xs">Sem foto</span>
                          )}
                        </div>
                        <input
                          type="file"
                          ref={productImageInputRef}
                          accept="image/*"
                          className="hidden"
                          onChange={handleProductImageUpload}
                        />
                        <button
                          type="button"
                          onClick={() => productImageInputRef.current?.click()}
                          className="px-4 py-3 bg-orange-100 text-orange-600 rounded-xl font-bold text-xs"
                        >
                          Escolher Imagem
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                        Preço de Venda (R$)
                      </label>
                      <input
                        type="number"
                        value={itemFormOwnerPrice}
                        onChange={e => setItemFormOwnerPrice(e.target.value)}
                        className="w-full p-5 bg-gray-50 rounded-2xl font-black border-none outline-none focus:ring-2 focus:ring-orange-100 shadow-inner"
                        placeholder="0.00"
                      />
                      <div className="px-4 py-2 bg-purple-50 rounded-xl space-y-1">
                        <p className="text-[10px] text-purple-700 font-bold leading-relaxed flex justify-between">
                          <span>Comissão da plataforma ({(currentUserProfile?.customFeePct ?? (platformSettings?.restaurantFeePct ?? 0.08) * 100)}%):</span>
                          <span>- R$ {((parseFloat(itemFormOwnerPrice) || 0) * (currentUserProfile?.customFeePct !== undefined ? currentUserProfile.customFeePct / 100 : (platformSettings?.restaurantFeePct ?? 0.08))).toFixed(2)}</span>
                        </p>
                        <p className="text-xs text-purple-900 font-black flex justify-between pt-1 border-t border-purple-100">
                          <span>Preço na sua mão (você recebe):</span>
                          <span>R$ {((parseFloat(itemFormOwnerPrice) || 0) * (1 - (currentUserProfile?.customFeePct !== undefined ? currentUserProfile.customFeePct / 100 : (platformSettings?.restaurantFeePct ?? 0.08)))).toFixed(2)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                        Descrição
                      </label>
                      <textarea
                        value={itemFormDesc}
                        onChange={e => setItemFormDesc(e.target.value)}
                        className="w-full p-5 bg-gray-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-orange-100 min-h-[120px] shadow-inner"
                        placeholder="Detalhes e ingredientes..."
                      />
                    </div>
                    <button
                      onClick={handleSaveItem}
                      className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-wide active:scale-95 transition-all"
                    >
                      Salvar Cardápio
                    </button>
                    {editingProduct && (
                      <button
                        onClick={resetMenuForm}
                        className="w-full py-4 text-gray-400 font-bold text-xs uppercase tracking-widest"
                      >
                        Cancelar Edição
                      </button>
                    )}
                  </div>
                  </div>
                )}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                  {myRestaurant.menu.map(item => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col group hover:shadow-md transition-all h-full overflow-hidden"
                    >
                      <div className="relative h-44 overflow-hidden">
                        <img
                          src={item.image}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-3 right-3 flex gap-1.5">
                          <button
                            onClick={() => handleEditProduct(item)}
                            className="p-2 bg-white/95 backdrop-blur-md text-blue-600 rounded-xl shadow-md hover:bg-white transition active:scale-90"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => deleteProduct(myRestaurant.id, item.id)}
                            className="p-2 bg-white/95 backdrop-blur-md text-red-600 rounded-xl shadow-md hover:bg-white transition active:scale-90"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="p-4 flex flex-col flex-1">
                        <h4 className="font-black text-gray-900 text-base mb-1">{item.name}</h4>
                        <p className="text-gray-400 text-xs line-clamp-2 mb-3 leading-relaxed flex-1">
                          {item.description}
                        </p>
                        <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wide">
                            Venda
                          </span>
                          <div className="text-right">
                            <p className="text-sm font-black text-gray-900">
                              R$ {item.price.toFixed(2)}
                            </p>
                            <p className="text-[9px] text-gray-400 font-bold">
                              Repasse: R$ {(item.price * (1 - (currentUserProfile?.customFeePct !== undefined ? currentUserProfile.customFeePct / 100 : (platformSettings?.restaurantFeePct ?? 0.08)))).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'promotions' && (
            <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
              <header className="mb-12">
                <h2 className="text-4xl font-black text-gray-900 tracking-tighter mb-2">
                  Promoções
                </h2>
                <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">
                  Crie cupons de desconto para seus clientes.
                </p>
              </header>

              <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm mb-8">
                <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-3">
                  {editingPromo ? <Edit2 size={20} /> : <Plus size={20} />}
                  {editingPromo ? 'Editar Promoção' : 'Nova Promoção'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                      Código do Cupom
                    </label>
                    <input
                      value={promoCode}
                      onChange={e => setPromoCode(e.target.value.toUpperCase())}
                      className="w-full p-5 bg-gray-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-orange-100"
                      placeholder="EX: PROMO10"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                      Tipo de Desconto
                    </label>
                    <select
                      value={promoDiscountType}
                      onChange={e => setPromoDiscountType(e.target.value as 'PERCENT' | 'FIXED')}
                      className="w-full p-5 bg-gray-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-orange-100"
                    >
                      <option value="PERCENT">Porcentagem (%)</option>
                      <option value="FIXED">Valor Fixo (R$)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                      Valor do Desconto
                    </label>
                    <input
                      type="number"
                      value={promoDiscountValue}
                      onChange={e => setPromoDiscountValue(e.target.value)}
                      className="w-full p-5 bg-gray-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-orange-100"
                      placeholder={promoDiscountType === 'PERCENT' ? '10' : '5.00'}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                      Pedido Mínimo (R$)
                    </label>
                    <input
                      type="number"
                      value={promoMinValue}
                      onChange={e => setPromoMinValue(e.target.value)}
                      className="w-full p-5 bg-gray-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-orange-100"
                      placeholder="Opcional"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                      Validade Até
                    </label>
                    <input
                      type="date"
                      value={promoValidUntil}
                      onChange={e => setPromoValidUntil(e.target.value)}
                      className="w-full p-5 bg-gray-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                      Descrição
                    </label>
                    <input
                      value={promoDescription}
                      onChange={e => setPromoDescription(e.target.value)}
                      className="w-full p-5 bg-gray-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-orange-100"
                      placeholder="Ex: Inauguração"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                      Tipo de Promoção
                    </label>
                    <select
                      value={promoType}
                      onChange={e => setPromoType(e.target.value as any)}
                      className="w-full p-5 bg-gray-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-orange-100"
                    >
                      <option value="COUPON">Cupom de Desconto (qualquer pedido)</option>
                      <option value="PRODUCT_SPECIFIC">Produto Específico</option>
                      <option value="MULTIPLE_PRODUCTS">Múltiplos Produtos</option>
                      <option value="FREE_DELIVERY">Frete Grátis</option>
                    </select>
                  </div>
                  {(promoType === 'PRODUCT_SPECIFIC' || promoType === 'MULTIPLE_PRODUCTS') && (
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                        Selecione os Produtos
                      </label>
                      <div className="bg-gray-50 p-4 rounded-2xl max-h-40 overflow-y-auto space-y-2">
                        {myRestaurant.menu.map(product => (
                          <label
                            key={product.id}
                            className="flex items-center gap-3 p-2 hover:bg-white rounded-xl cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={promoProductIds.includes(product.id)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setPromoProductIds([...promoProductIds, product.id]);
                                } else {
                                  setPromoProductIds(
                                    promoProductIds.filter(id => id !== product.id)
                                  );
                                }
                              }}
                              className="w-5 h-5 rounded text-orange-600"
                            />
                            <span className="font-bold text-sm">{product.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                      Limite de Uso (vezes)
                    </label>
                    <input
                      type="number"
                      value={promoMaxUsage}
                      onChange={e => setPromoMaxUsage(e.target.value)}
                      className="w-full p-5 bg-gray-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-orange-100"
                      placeholder="Ilimitado"
                    />
                  </div>
                </div>
                <div className="flex gap-4 mt-6">
                  <button
                    onClick={handleSavePromotion}
                    className="flex-1 bg-orange-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95"
                  >
                    {editingPromo ? 'Atualizar' : 'Criar'} Promoção
                  </button>
                  {editingPromo && (
                    <button
                      onClick={() => {
                        setEditingPromo(null);
                        setPromoCode('');
                        setPromoDiscountValue('');
                        setPromoType('COUPON');
                        setPromoProductIds([]);
                        setPromoMaxUsage('');
                      }}
                      className="px-6 bg-gray-100 text-gray-600 py-5 rounded-2xl font-bold text-xs uppercase"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-black text-gray-900">Promoções Ativas</h3>
                {(myRestaurant.promotions || []).map(promo => (
                  <div
                    key={promo.id}
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-black text-xl text-gray-900">{promo.code}</span>
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black ${promo.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {promo.isActive ? 'ATIVO' : 'INATIVO'}
                        </span>
                      </div>
                      <p className="text-gray-500 text-sm mt-1">
                        {promo.discountType === 'PERCENT'
                          ? `${promo.discountValue}%`
                          : `R$ ${promo.discountValue.toFixed(2)}`}{' '}
                        de desconto
                        {promo.minOrderValue && ` • Mín: R$ ${promo.minOrderValue.toFixed(2)}`}
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        Validade: {new Date(promo.validUntil).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditPromotion(promo)}
                        className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDeletePromotion(promo.id)}
                        className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                {(!myRestaurant.promotions || myRestaurant.promotions.length === 0) && (
                  <div className="text-center py-12 text-gray-400">
                    <Gift size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="font-black uppercase tracking-widest text-sm">
                      Nenhuma promoção ainda
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'stats' && (() => {
            const periodStart: Record<string, number> = {
              today: (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })(),
              week:  (() => { const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0,0,0,0); return d.getTime(); })(),
              month: (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.getTime(); })(),
              all: 0,
            };
            const filteredOrders = statsPeriod === 'all' ? myOrders : myOrders.filter(o => o.timestamp >= periodStart[statsPeriod]);

            const delivered = filteredOrders.filter(o => o.status === OrderStatus.DELIVERED);
            const totalRevenue = delivered.reduce((s, o) => s + (o.restaurantNetEarnings || o.total), 0);
            const totalGMV = filteredOrders.reduce((s, o) => s + o.total, 0);
            const avgTicket = delivered.length > 0 ? totalGMV / delivered.length : 0;
            const cancelledCount = filteredOrders.filter(o => o.status === 'CANCELLED').length;
            const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            // Product sales analytics
            const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
            filteredOrders.filter(o => o.status === OrderStatus.DELIVERED).forEach(o => {
              o.items.forEach((item: any) => {
                const id = item.product?.id || item.id;
                const name = item.product?.name || item.name || '?';
                if (!productSales[id]) productSales[id] = { name, qty: 0, revenue: 0 };
                productSales[id].qty += item.quantity;
                productSales[id].revenue += (item.product?.price || item.price || 0) * item.quantity;
              });
            });
            const allProducts = Object.values(productSales).sort((a, b) => b.qty - a.qty);
            const topProducts = allProducts.slice(0, 5);
            const worstProducts = [...allProducts].reverse().slice(0, 3);
            const maxQty = topProducts[0]?.qty || 1;

            // Ratings
            const ratedOrders = filteredOrders.filter(o => o.rating);
            const avgRestRating = ratedOrders.length > 0
              ? ratedOrders.reduce((s, o) => s + ((o.rating as any)?.restaurantStars || (o.rating as any)?.stars || 0), 0) / ratedOrders.length
              : 0;

            const statusMap: Record<string, { label: string; color: string }> = {
              PENDING: { label: 'Aguardando', color: 'text-yellow-600 bg-yellow-50' },
              PREPARING: { label: 'Preparando', color: 'text-blue-600 bg-blue-50' },
              READY: { label: 'Pronto', color: 'text-green-600 bg-green-50' },
              OUT_FOR_DELIVERY: { label: 'Em Entrega', color: 'text-purple-600 bg-purple-50' },
              DELIVERED: { label: 'Entregue', color: 'text-gray-600 bg-gray-100' },
              CANCELLED: { label: 'Cancelado', color: 'text-red-600 bg-red-50' },
            };

            return (
              <div className="animate-in fade-in duration-500 max-w-4xl mx-auto space-y-6">
                <header>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tighter mb-1">Painel de Vendas</h2>
                  <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Desempenho completo da sua loja</p>
                </header>

                {/* Period filter */}
                <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
                  {([
                    { id: 'today', label: 'Hoje' },
                    { id: 'week',  label: '7 dias' },
                    { id: 'month', label: 'Mês' },
                    { id: 'all',   label: 'Tudo' },
                  ] as const).map(p => (
                    <button
                      key={p.id}
                      onClick={() => setStatsPeriod(p.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${statsPeriod === p.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* KPI Cards — 2×2 no mobile, 1×4 no desktop */}
                <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-gray-100">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-px">
                    {[
                      { label: 'Pedidos', value: myOrders.length, color: 'text-gray-900' },
                      { label: 'Entregues', value: delivered.length, color: 'text-green-600' },
                      { label: 'Cancelados', value: cancelledCount, color: 'text-red-500' },
                      { label: 'Avaliação', value: avgRestRating.toFixed(1), color: 'text-amber-500' },
                    ].map(k => (
                      <div key={k.label} className="bg-white p-5 text-center">
                        <p className={`text-3xl font-black ${k.color} leading-none mb-1`}>{k.value}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{k.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Revenue cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide mb-2">Faturamento Líquido</p>
                    <p className="text-4xl font-black text-green-600">{fmt(totalRevenue)}</p>
                    <p className="text-gray-400 text-xs font-bold mt-1">Valor que você recebe (após taxa)</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide mb-2">Volume Bruto (GMV)</p>
                    <p className="text-3xl font-black text-gray-900 mb-3">{fmt(totalGMV)}</p>
                    <div className="space-y-1.5 text-xs font-bold">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Taxa plataforma</span>
                        <span className="text-red-500">- {fmt(totalGMV - totalRevenue)}</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-100 pt-1.5">
                        <span className="text-gray-700">Ticket médio</span>
                        <span className="font-black text-gray-900">{fmt(avgTicket)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Best & Worst sellers */}
                {allProducts.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                      <h3 className="font-black text-gray-900 mb-5 flex items-center gap-2"><Award size={18} className="text-amber-500" /> Mais Vendidos</h3>
                      <div className="space-y-4">
                        {topProducts.map((p, i) => (
                          <div key={i}>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-bold text-gray-800">{i+1}. {p.name}</span>
                              <span className="text-xs font-black text-orange-500">{p.qty}×</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(p.qty/maxQty)*100}%` }} />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">{fmt(p.revenue)} em receita</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                      <h3 className="font-black text-gray-900 mb-5 flex items-center gap-2"><TrendingDown size={18} className="text-red-400" /> Menos Vendidos</h3>
                      <div className="space-y-4">
                        {worstProducts.length === 0
                          ? <p className="text-gray-400 text-sm">Dados insuficientes</p>
                          : worstProducts.map((p, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-red-50 rounded-2xl">
                              <span className="text-sm font-bold text-gray-700">{p.name}</span>
                              <span className="text-xs font-black text-red-400">{p.qty}× vendido(s)</span>
                            </div>
                          ))
                        }
                        {worstProducts.length > 0 && (
                          <p className="text-[10px] text-gray-400 italic">💡 Considere promoção nesses itens</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Ratings */}
                {ratedOrders.length > 0 && (
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="font-black text-gray-900 mb-5 flex items-center gap-2"><Star size={18} className="text-amber-500" /> Avaliações da Loja ({ratedOrders.length})</h3>
                    <div className="flex items-center gap-6 mb-6">
                      <span className="text-5xl font-black text-gray-900">{avgRestRating.toFixed(1)}</span>
                      <div>
                        <div className="flex gap-1 mb-1">
                          {[...Array(5)].map((_, i) => <Star key={i} size={18} className={i < Math.round(avgRestRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'} />)}
                        </div>
                        <p className="text-gray-400 text-xs font-bold">{ratedOrders.length} avaliações</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {ratedOrders.slice(0, 5).map(order => {
                        const stars = (order.rating as any)?.restaurantStars || (order.rating as any)?.stars || 0;
                        const comment = (order.rating as any)?.comment || order.feedback || '';
                        return (
                          <div key={order.id} className="py-3 border-b border-gray-100 last:border-0">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-bold text-gray-800 text-sm">{order.customerName}</p>
                                <div className="flex gap-0.5 mt-1">
                                  {[...Array(5)].map((_, i) => <Star key={i} size={11} className={i < stars ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />)}
                                </div>
                              </div>
                              <span className="text-gray-400 text-[10px]">{new Date(order.timestamp).toLocaleDateString('pt-BR')}</span>
                            </div>
                            {comment && <p className="text-gray-600 text-sm mt-2 italic">"{comment}"</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Detailed order history — who bought + who delivered */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="font-black text-gray-900 mb-6">Registro de Vendas</h3>
                  <div className="space-y-3">
                    {filteredOrders.length === 0 ? (
                      <p className="text-center py-8 text-gray-400 font-bold">Nenhum pedido neste período.</p>
                    ) : [...filteredOrders].sort((a, b) => b.timestamp - a.timestamp).slice(0, 20).map(order => {
                      const s = statusMap[order.status] || { label: order.status, color: 'text-gray-500 bg-gray-100' };
                      return (
                        <div key={order.id} className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-black text-gray-900 text-sm">#{order.id.slice(-6)}</p>
                              <p className="text-gray-400 text-[10px]">{new Date(order.timestamp).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-gray-900 text-sm">{fmt(order.total)}</span>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-white p-2.5 rounded-xl">
                              <p className="text-gray-400 font-bold uppercase tracking-widest text-[9px] mb-1">🛍️ Cliente</p>
                              <p className="font-bold text-gray-800">{order.customerName}</p>
                              <p className="text-gray-400 truncate">{order.customerAddress}</p>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl">
                              <p className="text-gray-400 font-bold uppercase tracking-widest text-[9px] mb-1">🏍️ Entregador</p>
                              <p className="font-bold text-gray-800">{order.driverName || (order.driverId ? 'Atribuído' : 'Aguardando')}</p>
                              {order.status === OrderStatus.DELIVERED && <p className="text-green-600 text-[9px] font-black">✓ Entregue</p>}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {order.items.map((it: any, idx: number) => (
                              <span key={idx} className="text-[10px] bg-orange-50 text-orange-700 font-bold px-2 py-0.5 rounded-lg">{it.quantity}× {it.product?.name || it.name}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === 'profile' && (
            <div className="max-w-4xl mx-auto py-10 animate-in zoom-in-95 duration-500">
              <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-orange-600 rounded-l-2xl"></div>
                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start mb-10 pl-4">
                  <div className="relative">
                    <img
                      src={myRestaurant.image}
                      className="w-36 h-36 rounded-2xl object-cover border border-gray-200"
                    />
                    <input
                      type="file"
                      ref={restaurantImageInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handleRestaurantImageUpload}
                    />
                    <button
                      onClick={() => restaurantImageInputRef.current?.click()}
                      className="absolute bottom-0 right-0 bg-gray-900 text-white p-2 rounded-xl shadow-md active:scale-95 border-2 border-white"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                  <div className="text-center md:text-left flex-1">
                    <h3 className="text-3xl font-black text-gray-900 mb-1">{myRestaurant.name}</h3>
                    <p className="text-gray-400 font-bold text-[10px] tracking-[0.15em] mb-1">
                      {myRestaurant.category || 'Categoria não definida'} • {currentUserProfile.email}
                    </p>
                    {myRestaurant.phoneNumber && (
                      <p className="text-gray-500 text-xs font-bold mb-1">📞 {myRestaurant.phoneNumber}</p>
                    )}
                    {myRestaurant.cnpj && (
                      <p className="text-gray-400 text-[10px] font-bold mb-3">CNPJ: {myRestaurant.cnpj}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <div className="bg-orange-50 px-3 py-2 rounded-xl border border-orange-100">
                        <p className="text-[9px] font-black text-orange-400 uppercase tracking-wide mb-0.5">Status</p>
                        <p className="font-black text-orange-600 text-xs">{currentUserProfile.status}</p>
                      </div>
                      {myRestaurant.rating > 0 && (
                        <div className="bg-amber-50 px-3 py-2 rounded-xl border border-amber-100">
                          <p className="text-[9px] font-black text-amber-500 uppercase tracking-wide mb-0.5">Avaliação</p>
                          <p className="font-black text-amber-600 text-xs">
                            ★ {myRestaurant.rating.toFixed(1)} ({myRestaurant.ratingsCount || 0})
                          </p>
                        </div>
                      )}
                      <div className="bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-wide mb-0.5">Repasse</p>
                        <p className="font-black text-gray-900 text-xs">
                          {100 - Math.round((currentUserProfile?.customFeePct ?? (platformSettings?.restaurantFeePct ?? 0.08) * 100))}% Líquido
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-4">
                      Dados da Operação
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                      <div className="flex items-start gap-3 text-gray-600">
                        <Clock size={16} className="mt-0.5 shrink-0" />
                        <div className="text-xs font-bold leading-relaxed">
                          {myRestaurant.openingHours && myRestaurant.openingHours.length > 0
                            ? (['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'] as const).map((label, idx) => {
                                const s = myRestaurant.openingHours!.find(x => x.day === idx);
                                if (!s || s.closed) return null;
                                return <span key={idx} className="block">{label}: {s.open} – {s.close}</span>;
                              })
                            : <span className="text-gray-400 italic">Horário não configurado</span>
                          }
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-gray-600">
                        <MapPin size={16} />
                        <span className="text-sm font-bold truncate">
                          {myRestaurant.address || 'Não definido'}
                        </span>
                      </div>
                      <div className="flex items-start gap-3 text-gray-600">
                        <AlignLeft size={16} className="mt-0.5" />
                        <span className="text-xs font-bold leading-relaxed">
                          {currentUserProfile.description || 'Sem descrição.'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-4">
                      Responsável
                    </h4>
                    <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                      <div className="flex items-center gap-3 text-gray-600">
                        <User size={16} />
                        <span className="text-sm font-bold">{currentUserProfile.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-600">
                        <Package size={16} />
                        <span className="text-sm font-bold">
                          CPF: {currentUserProfile.cpf || '---'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-600">
                        <Wallet size={16} />
                        <span className={`text-sm font-bold ${!currentUserProfile.pixKey ? 'text-red-500' : ''}`}>
                          PIX: {currentUserProfile.pixKey || '⚠️ Não cadastrado'}
                        </span>
                      </div>
                      {!currentUserProfile.pixKey && (
                        <button
                          onClick={() => setShowEditModal(true)}
                          className="mt-2 w-full py-2 bg-red-50 border border-red-200 text-red-600 rounded-xl font-black text-xs"
                        >
                          ⚠️ Cadastre sua chave PIX para receber pagamentos
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowEditModal(true)}
                  className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-black uppercase text-xs tracking-wide active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <Edit2 size={18} /> Editar Perfil da Loja
                </button>
              </div>
            </div>
          )}

          {activeTab === 'support' && (
            <div className="max-w-2xl mx-auto py-10 animate-in fade-in duration-500">
              <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
                <div className="text-center mb-10">
                  <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <MessageCircle size={40} className="text-orange-600" />
                  </div>
                  <h2 className="text-3xl font-black text-gray-900 tracking-tighter mb-2">
                    Precisa de Ajuda?
                  </h2>
                  <p className="text-gray-500 font-bold text-sm">
                    Nossa equipe está pronta para atender você.
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 mb-2 block">
                      Descreva seu problema ou dúvida
                    </label>
                    <textarea
                      value={supportMessage}
                      onChange={e => setSupportMessage(e.target.value)}
                      placeholder="Ex: Problema com pedido, dúvida sobre taxas, preciso de ajuda com..."
                      className="w-full p-5 bg-gray-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-orange-100 min-h-[150px] resize-none"
                    />
                  </div>

                  <button
                    onClick={handleSendSupport}
                    disabled={isSaving || !supportMessage.trim()}
                    className="w-full bg-orange-600 text-white py-3.5 rounded-xl font-black uppercase text-xs tracking-wide flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader className="animate-spin" size={20} />
                    ) : (
                      <MessageCircle size={20} />
                    )}
                    Enviar Mensagem
                  </button>

                  <div className="text-center pt-4">
                    <p className="text-gray-400 text-xs font-bold">
                      Respondemos em até 24 horas úteis
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BARRA INFERIOR MOBILE */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 pt-4 flex justify-around items-center z-40"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'orders' ? 'text-orange-600 scale-110' : 'text-gray-300'}`}
          >
            <LayoutDashboard size={26} strokeWidth={activeTab === 'orders' ? 3 : 2} />
            <span
              className={`text-[8px] font-black uppercase tracking-widest ${activeTab === 'orders' ? 'opacity-100' : 'opacity-0'}`}
            >
              Cozinha
            </span>
          </button>
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'menu' ? 'text-orange-600 scale-110' : 'text-gray-300'}`}
          >
            <List size={26} strokeWidth={activeTab === 'menu' ? 3 : 2} />
            <span
              className={`text-[8px] font-black uppercase tracking-widest ${activeTab === 'menu' ? 'opacity-100' : 'opacity-0'}`}
            >
              Cardápio
            </span>
          </button>
          <button
            onClick={() => setActiveTab('promotions')}
            className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'promotions' ? 'text-orange-600 scale-110' : 'text-gray-300'}`}
          >
            <Tag size={26} strokeWidth={activeTab === 'promotions' ? 3 : 2} />
            <span
              className={`text-[8px] font-black uppercase tracking-widest ${activeTab === 'promotions' ? 'opacity-100' : 'opacity-0'}`}
            >
              Promo
            </span>
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'stats' ? 'text-orange-600 scale-110' : 'text-gray-300'}`}
          >
            <TrendingUp size={26} strokeWidth={activeTab === 'stats' ? 3 : 2} />
            <span
              className={`text-[8px] font-black uppercase tracking-widest ${activeTab === 'stats' ? 'opacity-100' : 'opacity-0'}`}
            >
              Vendas
            </span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'profile' ? 'text-orange-600 scale-110' : 'text-gray-300'}`}
          >
            <Store size={26} strokeWidth={activeTab === 'profile' ? 3 : 2} />
            <span
              className={`text-[8px] font-black uppercase tracking-widest ${activeTab === 'profile' ? 'opacity-100' : 'opacity-0'}`}
            >
              Loja
            </span>
          </button>
          <button
            onClick={() => setActiveTab('support')}
            className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'support' ? 'text-orange-600 scale-110' : 'text-gray-300'}`}
          >
            <MessageCircle size={26} strokeWidth={activeTab === 'support' ? 3 : 2} />
            <span
              className={`text-[8px] font-black uppercase tracking-widest ${activeTab === 'support' ? 'opacity-100' : 'opacity-0'}`}
            >
              Ajuda
            </span>
          </button>
        </nav>
      </main>

      {/* MODAL DE EDIÇÃO DO LOJISTA */}
      {showLocationModal && (
        <AddressModal
          onClose={() => setShowLocationModal(false)}
          onSave={(addr: Omit<UserAddress, 'id'>) => {
            const parts = [addr.street, addr.number && `nº ${addr.number}`, addr.neighborhood, addr.city, addr.state]
              .filter(Boolean)
              .join(', ');
            setStoreAddress(parts);
            if (addr.coords) setStoreCoords(addr.coords);
            setShowLocationModal(false);
          }}
          initialAddress={
            storeCoords
              ? ({ coords: storeCoords, street: storeAddress, number: '', neighborhood: '', city: 'Apiacás', state: 'MT', label: 'Loja', zipCode: '' } as UserAddress)
              : null
          }
          title="Localização da Loja"
          saveButtonLabel="Confirmar Localização"
        />
      )}

      {showEditModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6 animate-in fade-in duration-300"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl p-8 shadow-xl animate-in slide-in-from-bottom duration-500 max-h-[90vh] flex flex-col relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-8 shrink-0">
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tighter">
                  Editar Perfil
                </h3>
                <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-1">
                  Configurações da Loja e Responsável
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-3 bg-gray-50 text-gray-400 rounded-full hover:bg-red-50 hover:text-red-500 transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="overflow-y-auto no-scrollbar flex-1 space-y-8 pb-10 pr-2">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest ml-4">
                  Dados da Loja
                </h4>
                <input
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                  placeholder="Nome da Loja"
                  className="w-full p-5 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-100"
                />
                <div className="relative">
                  <input
                    value={storeAddress}
                    onChange={e => setStoreAddress(e.target.value)}
                    placeholder="Endereço da loja"
                    className="w-full p-5 pr-14 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLocationModal(true)}
                    title="Definir localização no mapa"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-orange-100 text-orange-600 hover:bg-orange-200 transition-all"
                  >
                    <MapPin size={20} />
                  </button>
                </div>
                {storeCoords && (
                  <p className="text-[11px] text-green-600 font-bold ml-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    Localização no mapa definida ✓
                  </p>
                )}
                {/* Editor de horários por dia da semana */}
                <div className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4 pt-4 pb-2">
                    Horário de Funcionamento
                  </p>
                  <div className="divide-y divide-gray-100">
                    {(['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'] as const).map((label, idx) => {
                      const day = idx as DaySchedule['day'];
                      const entry = scheduleHours.find(s => s.day === day) ?? { day, open: '06:00', close: '20:00', closed: false };
                      const update = (patch: Partial<DaySchedule>) =>
                        setScheduleHours(prev => {
                          const exists = prev.find(s => s.day === day);
                          if (exists) return prev.map(s => s.day === day ? { ...s, ...patch } : s);
                          return [...prev, { ...entry, ...patch }];
                        });
                      return (
                        <div key={day} className={`flex items-center gap-3 px-4 py-3 transition-colors ${entry.closed ? 'opacity-40' : ''}`}>
                          <input
                            type="checkbox"
                            checked={!entry.closed}
                            onChange={e => update({ closed: !e.target.checked })}
                            className="w-4 h-4 accent-orange-500 shrink-0 cursor-pointer"
                          />
                          <span className="text-xs font-black text-gray-700 w-7 shrink-0">{label}</span>
                          <input
                            type="time"
                            value={entry.open}
                            disabled={entry.closed}
                            onChange={e => update({ open: e.target.value })}
                            className="flex-1 p-2 bg-white rounded-xl text-xs font-bold outline-none border border-gray-200 focus:border-orange-300 disabled:cursor-not-allowed text-center"
                          />
                          <span className="text-gray-300 text-xs font-bold shrink-0">até</span>
                          <input
                            type="time"
                            value={entry.close}
                            disabled={entry.closed}
                            onChange={e => update({ close: e.target.value })}
                            className="flex-1 p-2 bg-white rounded-xl text-xs font-bold outline-none border border-gray-200 focus:border-orange-300 disabled:cursor-not-allowed text-center"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <textarea
                  value={storeDescription}
                  onChange={e => setStoreDescription(e.target.value)}
                  placeholder="Descrição da Loja"
                  className="w-full p-5 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-100 h-24 resize-none"
                />
                <select
                  value={storeCategory}
                  onChange={e => setStoreCategory(e.target.value)}
                  className="w-full p-5 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-100"
                >
                  <option value="">Categoria da loja</option>
                  <option value="Lanche">Lanche</option>
                  <option value="Pizza">Pizza</option>
                  <option value="Hambúrguer">Hambúrguer</option>
                  <option value="Açaí">Açaí</option>
                  <option value="Sorvete">Sorvete</option>
                  <option value="Japonesa">Japonesa</option>
                  <option value="Mexicana">Mexicana</option>
                  <option value="Italiana">Italiana</option>
                  <option value="Brasileira">Brasileira</option>
                  <option value="Marmita">Marmita</option>
                  <option value="Padaria">Padaria</option>
                  <option value="Outro">Outro</option>
                </select>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">
                      Tempo preparo (min)
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={5}
                      value={storePrepTime}
                      onChange={e => setStorePrepTime(e.target.value)}
                      placeholder="ex: 30"
                      className="w-full p-5 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-100"
                    />
                  </div>
                  <input
                    value={storePhoneNumber}
                    onChange={e => setStorePhoneNumber(e.target.value)}
                    placeholder="Tel. da loja"
                    className="w-full p-5 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-100 mt-6"
                  />
                  <input
                    value={storeCnpj}
                    onChange={e => setStoreCnpj(e.target.value.replace(/\D/g, '').slice(0, 14))}
                    placeholder="CNPJ (números)"
                    inputMode="numeric"
                    className="w-full p-5 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-100 mt-6"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                  Dados do Responsável
                </h4>
                <input
                  value={respName}
                  onChange={e => setRespName(e.target.value)}
                  placeholder="Nome do Responsável"
                  className="w-full p-5 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-100"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    value={respPhone}
                    onChange={e => setRespPhone(e.target.value)}
                    placeholder="Telefone"
                    className="w-full p-5 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-100"
                  />
                  <input
                    value={respCpf}
                    onChange={e => setRespCpf(e.target.value)}
                    placeholder="CPF"
                    className="w-full p-5 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-100"
                  />
                </div>
                <div>
                  <input
                    value={respPix}
                    onChange={e => setRespPix(e.target.value)}
                    placeholder="Chave PIX"
                    className={`w-full p-5 bg-gray-50 rounded-2xl font-bold outline-none border-2 focus:border-orange-100 transition-all ${!respPix ? 'border-red-300' : 'border-transparent'}`}
                  />
                  {!respPix && (
                    <p className="mt-2 text-xs font-black text-red-500 flex items-center gap-1.5 px-1">
                      ⚠️ Sem chave PIX você não receberá repasses dos pedidos entregues. Cadastre agora.
                    </p>
                  )}
                </div>
                <input
                  value={respAsaasId}
                  onChange={e => setRespAsaasId(e.target.value)}
                  placeholder="ID Subconta Asaas (gerado automaticamente)"
                  readOnly
                  className="w-full p-5 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-100 opacity-60 cursor-default"
                />
              </div>
            </div>

            <button
              onClick={handleUpdateStoreProfile}
              disabled={isSaving}
              className="w-full bg-orange-600 text-white py-3.5 rounded-xl font-black uppercase text-xs tracking-wide flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <Loader className="animate-spin" size={20} /> : <Save size={20} />} Salvar
              Alterações
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
