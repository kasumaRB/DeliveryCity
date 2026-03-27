import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { OrderStatus, Product, UserRole, Promotion } from '../types';

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
  } = useAppStore();

  const myRestaurant = restaurants.find(r => r.ownerId === currentUserProfile?.id);
  const myOrders = myRestaurant ? orders.filter(o => o.restaurantId === myRestaurant.id) : [];

  const [activeTab, setActiveTab] = useState<
    'orders' | 'menu' | 'promotions' | 'stats' | 'profile' | 'support'
  >('orders');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [itemFormName, setItemFormName] = useState('');
  const [itemFormOwnerPrice, setItemFormOwnerPrice] = useState('');
  const [itemFormDesc, setItemFormDesc] = useState('');
  const [itemFormImage, setItemFormImage] = useState('');
  const [itemFormCategory, setItemFormCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [restaurantImage, setRestaurantImage] = useState(myRestaurant?.image || '');

  // Support
  const [supportMessage, setSupportMessage] = useState('');

  // Profile Form States
  const [storeName, setStoreName] = useState(myRestaurant?.name || '');
  const [storeAddress, setStoreAddress] = useState(myRestaurant?.address || '');
  const [storeDescription, setStoreDescription] = useState(currentUserProfile?.description || '');
  const [storeWorkingHours, setStoreWorkingHours] = useState(
    currentUserProfile?.workingHours || ''
  );
  const [respName, setRespName] = useState(currentUserProfile?.name || '');
  const [respPhone, setRespPhone] = useState(currentUserProfile?.phoneNumber || '');
  const [respCpf, setRespCpf] = useState(currentUserProfile?.cpf || '');
  const [respPix, setRespPix] = useState(currentUserProfile?.pixKey || '');

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

  useEffect(() => {
    if (myRestaurant && currentUserProfile) {
      setStoreName(myRestaurant.name);
      setStoreAddress(myRestaurant.address || '');
      setStoreDescription(currentUserProfile.description || '');
      setStoreWorkingHours(currentUserProfile.workingHours || '');
      setRespName(currentUserProfile.name);
      setRespPhone(currentUserProfile.phoneNumber || '');
      setRespCpf(currentUserProfile.cpf || '');
      setRespPix(currentUserProfile.pixKey || '');
    }
  }, [myRestaurant, currentUserProfile]);

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
      console.log('Uploading restaurant image...');
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
      console.log('Upload success:', data);
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
      console.log('Starting image upload...');
      const resizedFile = await resizeImage(file, 400, 400);
      console.log('Image resized, uploading...');
      const fileExt = 'jpg';
      const fileName = `products/${currentUserProfile?.id}-${Date.now()}.${fileExt}`;

      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, resizedFile);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(uploadError.message);
      }

      console.log('Upload successful:', data);
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
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setItemFormName(product.name);
    const basePrice = product.ownerPrice || Math.round((product.price / 1.15) * 100) / 100;
    setItemFormOwnerPrice(basePrice.toFixed(2));
    setItemFormDesc(product.description);
    setItemFormImage(product.image);
    setItemFormCategory(product.category || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveItem = async () => {
    if (!myRestaurant || !itemFormName || !itemFormOwnerPrice) return;
    const ownerPrice = parseFloat(itemFormOwnerPrice);
    const finalPrice = ownerPrice * 1.15;
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
      // Update both restaurant and user profile tables
      await updateRestaurant(myRestaurant.id, { name: storeName, address: storeAddress });
      await updateUserProfile(currentUserProfile.id, {
        name: respName,
        phoneNumber: respPhone,
        cpf: respCpf,
        pixKey: respPix,
        description: storeDescription,
        workingHours: storeWorkingHours,
        businessName: storeName,
      });
      alert('Perfil da loja atualizado com sucesso!');
      await refreshData();
      setShowEditModal(false);
    } catch (e: any) {
      alert(e.message);
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
      <aside className="hidden md:flex w-72 bg-white border-r flex-col p-8 h-full shadow-xl shadow-gray-100">
        <div className="flex flex-col items-center mb-14 gap-3">
          <img src={Logo} alt="Logo" className="h-16 w-auto object-contain drop-shadow-lg" />
          <img src={Nome} alt="DeliveryCity" className="h-5 w-auto object-contain opacity-50" />
        </div>
        <nav className="flex-1 space-y-3">
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
              className={`w-full flex items-center gap-5 p-5 rounded-[2rem] font-bold transition-all ${activeTab === item.id ? 'bg-orange-600 text-white shadow-xl shadow-orange-100' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <item.icon size={22} /> <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>
        <button
          onClick={signOut}
          className="mt-auto flex items-center gap-5 p-5 text-gray-400 hover:text-red-500 transition-colors font-bold text-sm uppercase tracking-widest"
        >
          <LogOut size={22} /> Sair
        </button>
      </aside>

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
            onClick={() => setActiveTab('profile')}
            className={`p-2.5 rounded-xl border transition-all ${activeTab === 'profile' ? 'bg-orange-50 border-orange-100 text-orange-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
          >
            <User size={20} />
          </button>
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
              <header className="mb-12">
                <h2 className="text-4xl font-black text-gray-900 tracking-tighter mb-2">
                  Painel de Pedidos
                </h2>
                <div className="flex items-center gap-2 text-xs font-black text-green-600 uppercase tracking-widest">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Em operação
                </div>
              </header>

              <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0 overflow-x-auto pb-4 no-scrollbar">
                {/* COLUNA: PENDENTES */}
                <div className="flex flex-col min-w-[320px] h-full">
                  <div className="flex items-center justify-between mb-6 px-4">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
                      <Clock size={16} /> Pendentes
                    </h3>
                    <span className="bg-orange-100 text-orange-600 text-[10px] font-black px-3 py-1 rounded-full">
                      {getOrdersByStatus([OrderStatus.PENDING]).length}
                    </span>
                  </div>
                  <div className="flex-1 bg-gray-100/50 rounded-[3rem] p-5 space-y-5 overflow-y-auto no-scrollbar border-2 border-dashed border-gray-200 shadow-inner">
                    {getOrdersByStatus([OrderStatus.PENDING]).map(order => (
                      <div
                        key={order.id}
                        className="bg-white p-6 rounded-[2.5rem] shadow-sm animate-in zoom-in-95 border border-gray-50 hover:shadow-xl transition-all"
                      >
                        <div className="flex justify-between items-start mb-6">
                          <span className="font-black text-gray-900 text-xl tracking-tighter">
                            #{order.id.slice(-4)}
                          </span>
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            {new Date(order.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="space-y-3 mb-8 bg-gray-50 p-5 rounded-[1.5rem] border border-gray-100">
                          {order.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="text-sm font-bold text-gray-700 flex justify-between"
                            >
                              <span>
                                {item.quantity}x {item.product.name}
                              </span>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => updateOrderStatus(order.id, OrderStatus.PREPARING)}
                          className="w-full bg-orange-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-100 active:scale-95 transition-all"
                        >
                          Aceitar Pedido
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* COLUNA: PREPARANDO */}
                <div className="flex flex-col min-w-[320px] h-full">
                  <div className="flex items-center justify-between mb-6 px-4">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
                      <Utensils size={16} className="text-blue-500" /> Na Cozinha
                    </h3>
                    <span className="bg-blue-100 text-blue-600 text-[10px] font-black px-3 py-1 rounded-full">
                      {getOrdersByStatus([OrderStatus.PREPARING]).length}
                    </span>
                  </div>
                  <div className="flex-1 bg-blue-50/30 rounded-[3rem] p-5 space-y-5 overflow-y-auto no-scrollbar border-2 border-dashed border-blue-100 shadow-inner">
                    {getOrdersByStatus([OrderStatus.PREPARING]).map(order => (
                      <div
                        key={order.id}
                        className="bg-white p-6 rounded-[2.5rem] shadow-sm animate-in zoom-in-95 border border-gray-50"
                      >
                        <div className="flex justify-between items-start mb-6">
                          <span className="font-black text-gray-900 text-xl tracking-tighter">
                            #{order.id.slice(-4)}
                          </span>
                          <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-widest animate-pulse">
                            Cozinhando
                          </span>
                        </div>
                        <div className="space-y-3 mb-8 bg-gray-50 p-5 rounded-[1.5rem] border border-gray-100">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="text-sm font-bold text-gray-700">
                              {item.quantity}x {item.product.name}
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => updateOrderStatus(order.id, OrderStatus.READY)}
                          className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all"
                        >
                          Marcar como Pronto
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* COLUNA: PRONTOS */}
                <div className="flex flex-col min-w-[320px] h-full">
                  <div className="flex items-center justify-between mb-6 px-4">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
                      <CheckCircle size={16} className="text-green-500" /> Prontos
                    </h3>
                    <span className="bg-green-100 text-green-600 text-[10px] font-black px-3 py-1 rounded-full">
                      {getOrdersByStatus([OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY]).length}
                    </span>
                  </div>
                  <div className="flex-1 bg-green-50/30 rounded-[3rem] p-5 space-y-5 overflow-y-auto no-scrollbar border-2 border-dashed border-green-100 shadow-inner">
                    {getOrdersByStatus([OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY]).map(
                      order => (
                        <div
                          key={order.id}
                          className="bg-white p-6 rounded-[2.5rem] shadow-sm animate-in zoom-in-95 border border-gray-50"
                        >
                          <div className="flex justify-between items-start mb-6">
                            <span className="font-black text-gray-900 text-xl tracking-tighter">
                              #{order.id.slice(-4)}
                            </span>
                            <div className="flex items-center gap-2">
                              <Bike
                                size={16}
                                className={order.driverId ? 'text-green-500' : 'text-gray-300'}
                              />
                              <span
                                className={`text-[9px] font-black uppercase tracking-widest ${order.driverId ? 'text-green-600' : 'text-orange-500'}`}
                              >
                                {order.status === OrderStatus.OUT_FOR_DELIVERY
                                  ? 'Em Trânsito'
                                  : order.driverId
                                    ? 'Entregador Chegando'
                                    : 'Buscando Motoboy'}
                              </span>
                            </div>
                          </div>
                          <div className="bg-gray-900 p-6 rounded-[2rem] text-center shadow-lg">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-2">
                              Código de Coleta
                            </p>
                            <span className="text-3xl text-white font-black tracking-[8px]">
                              {order.pickupCode}
                            </span>
                          </div>
                        </div>
                      )
                    )}
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
                    window.scrollTo(0, 0);
                  }}
                  className="flex items-center gap-3 bg-orange-600 text-white px-8 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl shadow-orange-100 active:scale-95 transition-all"
                >
                  <Plus size={20} /> Novo Prato
                </button>
              </header>

              <div className="flex flex-col xl:flex-row gap-12 items-start">
                <div className="w-full xl:w-[450px] bg-white p-10 rounded-[3.5rem] shadow-xl shadow-gray-100 border border-gray-50 sticky top-10 h-fit">
                  <h3 className="text-2xl font-black text-gray-900 mb-10 flex items-center gap-4">
                    {editingProduct ? (
                      <Edit2 size={24} className="text-orange-600" />
                    ) : (
                      <Plus size={24} className="text-orange-600" />
                    )}{' '}
                    {editingProduct ? 'Editar Item' : 'Novo Item'}
                  </h3>
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
                        Preço na sua mão (R$)
                      </label>
                      <input
                        type="number"
                        value={itemFormOwnerPrice}
                        onChange={e => setItemFormOwnerPrice(e.target.value)}
                        className="w-full p-5 bg-gray-50 rounded-2xl font-black border-none outline-none focus:ring-2 focus:ring-orange-100 shadow-inner"
                        placeholder="0.00"
                      />
                      <p className="px-4 text-[9px] text-gray-400 font-bold italic leading-relaxed">
                        * Adicionamos 15% para a plataforma.
                      </p>
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
                      className="w-full bg-gray-900 text-white py-6 rounded-[2rem] font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-xl"
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
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-8">
                  {myRestaurant.menu.map(item => (
                    <div
                      key={item.id}
                      className="bg-white p-6 rounded-[3.5rem] border border-gray-50 shadow-sm flex flex-col group hover:shadow-2xl transition-all h-full"
                    >
                      <div className="relative h-56 rounded-[2.5rem] overflow-hidden mb-8 shadow-inner">
                        <img
                          src={item.image}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                        <div className="absolute top-4 right-4 flex gap-2">
                          <button
                            onClick={() => handleEditClick(item)}
                            className="p-3 bg-white/95 backdrop-blur-md text-blue-600 rounded-2xl shadow-xl hover:bg-white transition active:scale-90"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => deleteProduct(myRestaurant.id, item.id)}
                            className="p-3 bg-white/95 backdrop-blur-md text-red-600 rounded-2xl shadow-xl hover:bg-white transition active:scale-90"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      <h4 className="font-black text-gray-900 text-xl mb-2 px-2">{item.name}</h4>
                      <p className="text-gray-400 text-xs font-bold line-clamp-2 mb-8 px-2 leading-relaxed">
                        {item.description}
                      </p>
                      <div className="mt-auto bg-gray-50 p-6 rounded-[2rem] flex justify-between items-center border border-gray-100">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          Venda
                        </span>
                        <span className="font-black text-gray-900 text-2xl tracking-tighter">
                          R$ {item.price.toFixed(2)}
                        </span>
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

              <div className="bg-white p-8 rounded-[3rem] shadow-xl shadow-gray-100 border border-gray-50 mb-8">
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
                    className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex justify-between items-center"
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

          {activeTab === 'stats' && (
            <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
              <header className="mb-12">
                <h2 className="text-4xl font-black text-gray-900 tracking-tighter mb-2">Vendas</h2>
                <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">
                  Resumo das suas vendas.
                </p>
              </header>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                    Total Pedidos
                  </p>
                  <p className="text-3xl font-black text-gray-900">{myOrders.length}</p>
                </div>
                <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                    Pedidos Entregues
                  </p>
                  <p className="text-3xl font-black text-green-600">
                    {myOrders.filter(o => o.status === OrderStatus.DELIVERED).length}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                    Faturamento Total
                  </p>
                  <p className="text-3xl font-black text-gray-900">
                    R${' '}
                    {myOrders
                      .reduce((sum, o) => sum + (o.restaurantNetEarnings || o.total), 0)
                      .toFixed(2)}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                    Ticket Médio
                  </p>
                  <p className="text-3xl font-black text-gray-900">
                    R${' '}
                    {(
                      myOrders.reduce((sum, o) => sum + o.total, 0) / Math.max(myOrders.length, 1)
                    ).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
                <h3 className="text-lg font-black text-gray-900 mb-6">Últimos Pedidos</h3>
                <div className="space-y-4">
                  {myOrders.slice(0, 10).map(order => (
                    <div
                      key={order.id}
                      className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl"
                    >
                      <div>
                        <p className="font-black text-gray-900">#{order.id.slice(-4)}</p>
                        <p className="text-gray-500 text-xs">
                          {order.items.length} item(s) •{' '}
                          {new Date(order.timestamp).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-gray-900">R$ {order.total.toFixed(2)}</p>
                        <span
                          className={`text-[10px] font-black uppercase ${order.status === OrderStatus.DELIVERED ? 'text-green-600' : 'text-orange-500'}`}
                        >
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="max-w-4xl mx-auto py-10 animate-in zoom-in-95 duration-500">
              <div className="bg-white rounded-[4rem] p-12 shadow-xl shadow-gray-100 border border-gray-50 relative">
                <div className="absolute top-0 left-0 w-full h-2 bg-orange-600"></div>
                <div className="flex flex-col md:flex-row gap-12 items-center md:items-start mb-16">
                  <div className="relative">
                    <img
                      src={myRestaurant.image}
                      className="w-48 h-48 rounded-[3rem] object-cover shadow-2xl border-8 border-white ring-1 ring-gray-100"
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
                      className="absolute bottom-0 right-0 bg-gray-950 text-white p-3 rounded-2xl shadow-2xl active:scale-95 border-4 border-white"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                  <div className="text-center md:text-left flex-1">
                    <h3 className="text-3xl font-black text-gray-900 mb-2">{myRestaurant.name}</h3>
                    <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.2em] mb-6">
                      {myRestaurant.category} • {currentUserProfile.email}
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-orange-50/50 p-4 rounded-3xl border border-orange-100">
                        <p className="text-[8px] font-black text-orange-400 uppercase tracking-widest mb-1">
                          Status
                        </p>
                        <p className="font-black text-orange-600 text-sm">
                          {currentUserProfile.status}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">
                          Repasse
                        </p>
                        <p className="font-black text-gray-900 text-sm">85% Livre</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-4">
                      Dados da Operação
                    </h4>
                    <div className="bg-gray-50 p-6 rounded-[2.5rem] space-y-4">
                      <div className="flex items-center gap-4 text-gray-600">
                        <Clock size={18} />
                        <span className="text-sm font-bold">
                          {currentUserProfile.workingHours || 'Não definido'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-gray-600">
                        <MapPin size={18} />
                        <span className="text-sm font-bold truncate">
                          {myRestaurant.address || 'Não definido'}
                        </span>
                      </div>
                      <div className="flex items-start gap-4 text-gray-600">
                        <AlignLeft size={18} className="mt-1" />
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
                    <div className="bg-gray-50 p-6 rounded-[2.5rem] space-y-4">
                      <div className="flex items-center gap-4 text-gray-600">
                        <User size={18} />
                        <span className="text-sm font-bold">{currentUserProfile.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-gray-600">
                        <Package size={18} />
                        <span className="text-sm font-bold">
                          CPF: {currentUserProfile.cpf || '---'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-gray-600">
                        <Wallet size={18} />
                        <span className="text-sm font-bold">
                          PIX: {currentUserProfile.pixKey || '---'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowEditModal(true)}
                  className="w-full bg-gray-900 text-white py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] active:scale-95 transition-all shadow-xl flex items-center justify-center gap-4"
                >
                  <Edit2 size={18} /> Editar Perfil da Loja
                </button>
              </div>
            </div>
          )}

          {activeTab === 'support' && (
            <div className="max-w-2xl mx-auto py-10 animate-in fade-in duration-500">
              <div className="bg-white rounded-[3rem] p-10 shadow-xl shadow-gray-100 border border-gray-50">
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
                    className="w-full bg-orange-600 text-white py-6 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
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
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-100 px-8 py-6 flex justify-around items-center z-40 rounded-t-[3rem] shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.05)]">
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
      {showEditModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6 animate-in fade-in duration-300"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white w-full md:max-w-2xl rounded-t-[3.5rem] md:rounded-[3.5rem] p-10 shadow-2xl animate-in slide-in-from-bottom duration-500 max-h-[90vh] flex flex-col relative"
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
                <input
                  value={storeAddress}
                  onChange={e => setStoreAddress(e.target.value)}
                  placeholder="Endereço"
                  className="w-full p-5 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-100"
                />
                <input
                  value={storeWorkingHours}
                  onChange={e => setStoreWorkingHours(e.target.value)}
                  placeholder="Horário (ex: 08:00 às 22:00)"
                  className="w-full p-5 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-100"
                />
                <textarea
                  value={storeDescription}
                  onChange={e => setStoreDescription(e.target.value)}
                  placeholder="Descrição da Loja"
                  className="w-full p-5 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-100 h-24 resize-none"
                />
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
                <input
                  value={respPix}
                  onChange={e => setRespPix(e.target.value)}
                  placeholder="Chave PIX"
                  className="w-full p-5 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-100"
                />
              </div>
            </div>

            <button
              onClick={handleUpdateStoreProfile}
              disabled={isSaving}
              className="w-full bg-orange-600 text-white py-6 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
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
