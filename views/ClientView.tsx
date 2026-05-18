import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import {
  Restaurant,
  Product,
  Order,
  PaymentMethod,
  UserAddress,
  OrderStatus,
  OrderRating,
  SavedCard,
} from '../types';
import {
  Star,
  Plus,
  Minus,
  ChevronLeft,
  MapPin,
  Home,
  User,
  List,
  Search,
  X,
  ShoppingCart,
  ChevronRight,
  Package,
  CheckCircle2,
  UtensilsCrossed,
  ThumbsUp,
  ThumbsDown,
  Bike,
  PlusCircle,
  CreditCard,
  Smartphone,
  Loader,
  Tag,
  Check,
  Trash2,
} from 'lucide-react';
import { AddressModal } from '../components/AddressModal';
import Logo from '../assets/Logo.png';
import Nome from '../assets/Nome.png';

declare global {
  interface Window {
    PagSeguro: any;
  }
}

export const ClientView: React.FC<{ onOpenProfile: () => void }> = ({ onOpenProfile }) => {
  const store = useAppStore();
  const {
    restaurants = [],
    orders = [],
    currentUserProfile,
    createOrder,
    recalculateDistances,
    calculateDistance,
    submitRating,
    addAddress,
    platformSettings,
    profiles,
  } = store || {};

  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'orders'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('CREDIT_CARD');
  const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(null);
  const [isAddressSelectorOpen, setIsAddressSelectorOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  // Rastreia se o checkout estava aberto quando o seletor de endereço foi ativado
  const [checkoutWasOpen, setCheckoutWasOpen] = useState(false);

  const [ratingOrder, setRatingOrder] = useState<Order | null>(null);
  const [storeStars, setStoreStars] = useState(0);
  const [driverStars, setDriverStars] = useState(0);
  const [productOk, setProductOk] = useState<boolean | null>(null);
  const [packagingOk, setPackagingOk] = useState<boolean | null>(null);
  const [ratingComment, setRatingComment] = useState('');

  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [saveCardForFuture, setSaveCardForFuture] = useState(false);

  // Cartão salvo selecionado
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string | null>(null);
  const [savedCardCvv, setSavedCardCvv] = useState(''); // CVV necessário mesmo para cards salvos (PCI)
  const [showNewCardForm, setShowNewCardForm] = useState(false);

  // Coupon states
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
    isFreeDelivery?: boolean;
  } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // Search and filter states
  const [selectedCategory, setSelectedCategory] = useState('');
  const [productSearch, setProductSearch] = useState('');

  // Helper: traduz status do pedido para português
  const traduzirStatus = (status: string): { label: string; color: string } => {
    const map: Record<string, { label: string; color: string }> = {
      PENDING:          { label: '\u23f3 Aguardando',    color: 'bg-yellow-100 text-yellow-700' },
      PREPARING:        { label: '\ud83d\udc68\u200d\ud83c\udf73 Preparando',    color: 'bg-blue-100 text-blue-700' },
      READY:            { label: '\u2705 Pronto',         color: 'bg-green-100 text-green-700' },
      OUT_FOR_DELIVERY: { label: '\ud83d\udeb4 Em Entrega',    color: 'bg-purple-100 text-purple-700' },
      DELIVERED:        { label: '\ud83c\udf89 Entregue',      color: 'bg-gray-100 text-gray-600' },
      CANCELLED:        { label: '\u274c Cancelado',     color: 'bg-red-100 text-red-700' },
    };
    return map[status] || { label: status, color: 'bg-orange-100 text-orange-700' };
  };

  useEffect(() => {
    setSelectedCategory('');
    setProductSearch('');
  }, [selectedRestaurant?.id]);

  // 🔒 SEGURANÇA: Limpa carrinho local e estado de checkout ao deslogar
  useEffect(() => {
    if (!currentUserProfile) {
      setCart([]);
      setSelectedRestaurant(null);
      setIsCheckoutOpen(false);
      setSelectedAddress(null);
      setAppliedCoupon(null);
      setCouponCode('');
    }
  }, [currentUserProfile]);

  useEffect(() => {
    if (currentUserProfile) {
      const pendingRating = orders.find(
        o =>
          o.customerId === currentUserProfile.id && o.status === OrderStatus.DELIVERED && !o.rating
      );
      if (pendingRating) setRatingOrder(pendingRating);

      if (!selectedAddress && currentUserProfile.savedAddresses?.length > 0) {
        handleSelectAddress(currentUserProfile.savedAddresses[0]);
      }
    }
  }, [orders, currentUserProfile]);

  const handleAddressButtonClick = () => {
    if (currentUserProfile) {
      setIsAddressSelectorOpen(true);
    } else {
      onOpenProfile();
    }
  };

  const handleSelectAddress = (addr: UserAddress) => {
    setSelectedAddress(addr);
    setIsAddressSelectorOpen(false);
    if (addr.coords && recalculateDistances) {
      recalculateDistances(`${addr.street}, ${addr.number}`, addr.coords);
    }
  };

  const handleAddNewAddress = async (addr: Omit<UserAddress, 'id'>) => {
    const newAddr = await addAddress(addr);
    if (newAddr) {
      handleSelectAddress(newAddr as UserAddress);
    }
    setIsAddressModalOpen(false);
    setIsAddressSelectorOpen(false);
    // Se o checkout estava aberto antes de entrar no fluxo de endereço, reabre
    if (checkoutWasOpen) {
      setIsCheckoutOpen(true);
      setCheckoutWasOpen(false);
    }
  };

  const handleFinishRating = async () => {
    if (!ratingOrder || !submitRating) return;
    const finalRating: OrderRating = {
      storeStars,
      driverStars: driverStars || undefined,
      productOk: productOk === true,
      packagingOk: packagingOk === true,
      comment: ratingComment.trim() || undefined,
    };
    await submitRating(ratingOrder.id, finalRating);
    setRatingOrder(null);
    setStoreStars(0);
    setDriverStars(0);
    setProductOk(null);
    setPackagingOk(null);
    setRatingComment('');
  };

  const filteredStores = useMemo(() => {
    return restaurants.filter(
      r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [restaurants, searchQuery]);

  const handleAddToCart = (product: Product) => {
    // 🔒 SEGURANÇA: Exige login antes de adicionar ao carrinho
    if (!currentUserProfile) {
      onOpenProfile();
      return;
    }
    if (!selectedRestaurant) return;
    const restaurantOfCart =
      cart.length > 0 ? restaurants.find(r => r.menu.some(p => p.id === cart[0].product.id)) : null;
    if (restaurantOfCart && restaurantOfCart.id !== selectedRestaurant.id) {
      if (
        window.confirm(
          'Seu carrinho contém itens de outro restaurante. Deseja limpá-lo para adicionar este item?'
        )
      ) {
        setCart([{ product, quantity: 1 }]);
        setAppliedCoupon(null);
        setCouponCode('');
      }
      return;
    }
    setCart(currentCart => {
      const existingItem = currentCart.find(item => item.product.id === product.id);
      if (existingItem) {
        return currentCart.map(item =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...currentCart, { product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    setCart(currentCart => {
      if (quantity <= 0) return currentCart.filter(item => item.product.id !== productId);
      return currentCart.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      );
    });
  };

  const cartSubtotal = useMemo(
    () => cart.reduce((total, item) => total + item.product.price * item.quantity, 0),
    [cart]
  );

  // Distância em km entre endereço do cliente e restaurante
  const distKm = useMemo(() => {
    if (!selectedRestaurant || !selectedAddress?.coords) return 0;
    return calculateDistance?.(
      selectedAddress.coords.lat,
      selectedAddress.coords.lng,
      selectedRestaurant.coords.lat,
      selectedRestaurant.coords.lng
    ) ?? 0;
  }, [selectedRestaurant, selectedAddress, calculateDistance]);

  // Taxa de entrega: R$4,00 base + R$0,50 por km
  const deliveryFee = useMemo(() => {
    if (cartSubtotal === 0) return 0;
    if (appliedCoupon?.isFreeDelivery) return 0;
    return 4.00 + (distKm * 0.50);
  }, [cartSubtotal, appliedCoupon, distKm]);

  // Taxa estimada para um restaurante qualquer (sem carrinho aberto)
  const estimatedDeliveryFee = (restaurant: typeof selectedRestaurant) => {
    if (!restaurant || !selectedAddress?.coords) return null;
    const d = calculateDistance?.(
      selectedAddress.coords.lat,
      selectedAddress.coords.lng,
      restaurant!.coords.lat,
      restaurant!.coords.lng
    ) ?? 0;
    return 4.00 + (d * 0.50);
  };

  const discount = appliedCoupon ? (appliedCoupon.discount > 0 ? appliedCoupon.discount : 0) : 0;
  const cartTotal = Math.max(0, cartSubtotal + deliveryFee - discount);

  const handleApplyCoupon = async () => {
    if (!selectedRestaurant || !couponCode.trim()) return;
    setCouponError('');
    setIsApplyingCoupon(true);

    const promo = selectedRestaurant.promotions?.find(
      p => p.code.toUpperCase() === couponCode.toUpperCase() && p.isActive
    );

    if (!promo) {
      setCouponError('Cupom inválido ou expirado');
      setIsApplyingCoupon(false);
      return;
    }

    if (promo.minOrderValue && cartSubtotal < promo.minOrderValue) {
      setCouponError(`Pedido mínimo: R$ ${promo.minOrderValue.toFixed(2)}`);
      setIsApplyingCoupon(false);
      return;
    }

    if (promo.type === 'FREE_DELIVERY' && cartSubtotal < 30) {
      setCouponError('Frete grátis válido only para pedidos acima de R$ 30,00');
      setIsApplyingCoupon(false);
      return;
    }

    const isFreeDelivery = promo.type === 'FREE_DELIVERY';
    const discountValue = isFreeDelivery
      ? 0
      : promo.discountType === 'PERCENT'
        ? (cartSubtotal * promo.discountValue) / 100
        : promo.discountValue;

    setAppliedCoupon({ code: promo.code, discount: discountValue, isFreeDelivery });
    setIsApplyingCoupon(false);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const handleFinalizeOrder = async () => {
    if (!currentUserProfile) {
      onOpenProfile();
      return;
    }

    // Verifica se o perfil do cliente está completo antes de permitir o pedido
    const profileIncomplete = !currentUserProfile.phoneNumber || !currentUserProfile.cpf;
    if (profileIncomplete) {
      alert(
        'Para fazer um pedido, complete seu perfil primeiro (WhatsApp e CPF são obrigatórios).'
      );
      onOpenProfile();
      return;
    }

    if (!selectedAddress) {
      // Fecha checkout temporariamente para o seletor de endereço ficar visível
      setCheckoutWasOpen(true);
      setIsCheckoutOpen(false);
      setIsAddressSelectorOpen(true);
      return;
    }
    if (!selectedRestaurant || cart.length === 0 || !createOrder) return;

    setIsProcessing(true);
    try {
      if (selectedPayment === 'CREDIT_CARD' || selectedPayment === 'DEBIT_CARD') {
        if (!window.PagSeguro) {
          throw new Error('Serviço de pagamento indisponível. Tente outro método de pagamento.');
        }
        const pagseguroPublicKey = import.meta.env.VITE_PAGSEGURO_PUBLIC_KEY;
        if (!pagseguroPublicKey) {
          throw new Error('Chave do PagSeguro não configurada. Entre em contato com o suporte.');
        }

        // ─── Calcula split ────────────────────────────────────────────
        const buildSplit = () => {
          let restaurantFeePct = platformSettings?.restaurantFeePct ?? 0.08;
          const owner = profiles?.find(p => p.id === selectedRestaurant.ownerId);
          if (owner?.customFeePct !== undefined) restaurantFeePct = owner.customFeePct / 100;
          const finalProductTotal = Math.max(0, cartSubtotal - discount);
          const restaurantNetEarnings = finalProductTotal * (1 - restaurantFeePct);
          const platformTotalCut = cartTotal - restaurantNetEarnings;
          return {
            rules: [
              { recipient: selectedRestaurant.pagseguroRecipientId, liable: true, charge_processing_fee: true, amount: { value: Math.round(restaurantNetEarnings * 100) } },
              { recipient: import.meta.env.VITE_PAGSEGURO_PLATFORM_RECIPIENT_ID || '', liable: false, charge_processing_fee: false, amount: { value: Math.round(platformTotalCut * 100) } },
            ],
          };
        };

        let encryptedCard: string;
        const savedCards = currentUserProfile.savedCards || [];
        const selectedSaved = savedCards.find(c => c.id === selectedSavedCardId);

        if (selectedSaved) {
          // ── Usar cartão salvo: re-encripta com CVV informado ──────────
          if (!savedCardCvv || savedCardCvv.length < 3) {
            throw new Error('Informe o CVV do cartão selecionado.');
          }
          const enc = window.PagSeguro.encryptCard({
            publicKey: pagseguroPublicKey,
            holder: selectedSaved.holderName,
            number: `000000000000${selectedSaved.last4}`, // placeholder — PagSeguro aceita token diretamente
            expMonth: selectedSaved.expiryMonth,
            expYear: `20${selectedSaved.expiryYear}`,
            securityCode: savedCardCvv,
          });
          // Na prática, usa o token salvo no campo card.token para a API do PagSeguro
          encryptedCard = enc.encryptedCard;
        } else {
          // ── Novo cartão ───────────────────────────────────────────────
          const [expMonth, expYear] = cardExpiry.split('/');
          const enc = window.PagSeguro.encryptCard({
            publicKey: pagseguroPublicKey,
            holder: cardHolder,
            number: cardNumber.replace(/\s/g, ''),
            expMonth,
            expYear: `20${expYear}`,
            securityCode: cardCvv,
          });
          if (enc.hasErrors) throw new Error(`Erro no cartão: ${enc.errors[0].message}`);
          encryptedCard = enc.encryptedCard;
        }

        const { data, error } = await supabase.functions.invoke('create-pagseguro-payment', {
          body: {
            items: cart.map(i => ({ name: i.product.name, quantity: i.quantity, unit_amount: Math.round(i.product.price * 100) })),
            customer: { name: currentUserProfile.name, email: currentUserProfile.email, tax_id: currentUserProfile.cpf || '' },
            charge: {
              reference_id: `order_${Date.now()}`,
              amount: { value: Math.round(cartTotal * 100), currency: 'BRL' },
              payment_method: {
                type: selectedPayment === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'DEBIT_CARD',
                installments: 1,
                capture: true,
                card: selectedSaved
                  ? { id: selectedSaved.token, security_code: savedCardCvv }
                  : { encrypted: encryptedCard, store: saveCardForFuture },
              },
              split: buildSplit(),
            },
          },
        });
        if (error) throw error;

        // ── Salvar cartão se o usuário escolheu e é um cartão novo ──
        if (saveCardForFuture && !selectedSaved && data.charges?.[0]?.payment_method?.card) {
          const cardResp = data.charges[0].payment_method.card;
          const newSavedCard: SavedCard = {
            id: `card-${Date.now()}`,
            token: cardResp.id || encryptedCard,
            last4: cardResp.last_digits || cardNumber.slice(-4).replace(/\D/g, ''),
            brand: cardResp.brand || 'CARD',
            holderName: cardHolder,
            expiryMonth: cardExpiry.split('/')[0],
            expiryYear: cardExpiry.split('/')[1],
          };
          const updatedCards = [...savedCards, newSavedCard];
          await store.updateUserProfile!(currentUserProfile.id, { savedCards: updatedCards });
        }

        await createOrder(
          selectedRestaurant.id, cart, selectedPayment,
          `${selectedAddress.street}, ${selectedAddress.number}`,
          currentUserProfile.name, data.id, selectedAddress.coords, deliveryFee, discount
        );
      } else {
        await createOrder(
          selectedRestaurant.id,
          cart,
          selectedPayment,
          `${selectedAddress.street}, ${selectedAddress.number}`,
          currentUserProfile.name,
          undefined,
          selectedAddress.coords,
          deliveryFee,
          discount
        );
      }
      setCart([]);
      setCardNumber('');
      setCardHolder('');
      setCardExpiry('');
      setCardCvv('');
      setIsCheckoutOpen(false);
      setShowOrderSuccess(true);
    } catch (error: any) {
      alert(`Erro: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] flex flex-col md:flex-row overflow-hidden relative safe-area-top safe-area-bottom">
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex w-72 bg-white border-r flex-col p-8 sticky top-0 h-screen z-30 shadow-xl shadow-gray-100">
        <div className="mb-14 flex flex-col items-center">
          <img src={Logo} alt="Logo" className="h-20 w-auto object-contain mb-4 drop-shadow-md" />
          <img src={Nome} alt="DeliveryCity" className="h-5 w-auto object-contain opacity-80" />
        </div>
        <nav className="flex-1 space-y-3">
          <button
            onClick={() => {
              setActiveTab('home');
              setSelectedRestaurant(null);
            }}
            className={`w-full flex items-center gap-4 p-5 rounded-[2rem] font-bold transition-all ${activeTab === 'home' ? 'bg-orange-600 text-white shadow-xl shadow-orange-100' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            <Home size={24} /> <span>Início</span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center gap-4 p-5 rounded-[2rem] font-bold transition-all ${activeTab === 'orders' ? 'bg-orange-600 text-white shadow-xl shadow-orange-100' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            <List size={24} /> <span>Meus Pedidos</span>
          </button>
          <button
            onClick={onOpenProfile}
            className={`w-full flex items-center gap-4 p-5 rounded-[2rem] font-bold transition-all ${activeTab === 'profile' ? 'bg-orange-600 text-white shadow-xl shadow-orange-100' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            <User size={24} /> <span>Meu Perfil</span>
          </button>
        </nav>
      </aside>

      {/* CONTEÚDO PRINCIPAL COM PADDING INFERIOR PARA NÃO FICAR ATRÁS DO MENU */}
      <main className="flex-1 flex flex-col min-h-screen pb-36 md:pb-0 relative z-10 overflow-y-auto no-scrollbar">
        {/* HEADER MOBILE AJUSTADO */}
        <header className="bg-white/90 backdrop-blur-xl sticky top-0 z-[45] px-6 py-4 flex flex-col gap-4 border-b border-gray-100 shadow-sm">
          <div className="flex justify-between items-center w-full">
            {selectedRestaurant ? (
              <button
                onClick={() => setSelectedRestaurant(null)}
                className="p-2.5 bg-gray-50 text-gray-900 rounded-2xl border border-gray-100 active:scale-95 transition-all"
              >
                <ChevronLeft size={24} />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <img src={Logo} alt="Logo" className="h-9 w-auto" />
                <img src={Nome} alt="DeliveryCity" className="h-4 w-auto opacity-70" />
              </div>
            )}
            {/* REMOVIDO BOTÃO DE PERFIL DUPLICADO DAQUI */}
          </div>

          <button
            onClick={handleAddressButtonClick}
            className="flex items-center gap-3 text-left w-full bg-gray-50 border border-gray-100 px-5 py-3 rounded-[1.2rem] active:scale-[0.98] transition-all"
          >
            <MapPin size={16} className="text-orange-600 shrink-0" />
            <div className="flex flex-col flex-1 truncate">
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">
                Entregar em
              </span>
              <span className="truncate text-[11px] font-black text-gray-900">
                {selectedAddress
                  ? `${selectedAddress.street}, ${selectedAddress.number}`
                  : currentUserProfile
                    ? 'Defina seu endereço'
                    : 'Olá! Faça login para pedir'}
              </span>
            </div>
            <ChevronRight size={14} className="text-gray-300 ml-auto" />
          </button>
        </header>

        <div className="p-6 md:p-12 w-full max-w-7xl mx-auto">
          {activeTab === 'home' && !selectedRestaurant && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-700">
              <h2 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tighter mb-8">
                Fome de quê?
              </h2>
              <div className="relative mb-10 max-w-2xl">
                <Search
                  size={20}
                  className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar restaurante..."
                  className="w-full bg-white border-2 border-transparent p-5 pl-16 rounded-[2rem] font-bold text-gray-700 outline-none shadow-xl shadow-gray-100 focus:border-orange-200 transition-all"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredStores.map(restaurant => {
                  const estFee = estimatedDeliveryFee(restaurant);
                  return (
                    <div
                      key={restaurant.id}
                      onClick={() => {
                        setSelectedRestaurant(restaurant);
                        // Se logado mas sem endereço definido, pede o endereço imediatamente
                        if (currentUserProfile && !selectedAddress) {
                          setCheckoutWasOpen(false);
                          setIsAddressSelectorOpen(true);
                        }
                      }}
                      className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-100 border border-gray-50 overflow-hidden cursor-pointer hover:-translate-y-1 transition-all active:scale-[0.98]"
                    >
                      <div className="h-48 relative">
                        <img src={restaurant.image} className="w-full h-full object-cover" />
                        <div className="absolute top-4 right-4 bg-white/95 px-2 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 backdrop-blur-sm shadow-sm">
                          {restaurant.rating.toFixed(1)}{' '}
                          <Star size={12} className="fill-orange-500 text-orange-500" />
                        </div>
                      </div>
                      <div className="p-6">
                        <h3 className="font-black text-gray-900 text-lg mb-1">{restaurant.name}</h3>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-2">
                          {restaurant.category}
                        </p>
                        {/* Taxa de entrega estimada */}
                        <div className="flex items-center gap-2 text-[10px] font-black">
                          <MapPin size={10} className="text-orange-400" />
                          <span className="text-gray-500">
                            {estFee !== null
                              ? `Entrega ~R$ ${estFee.toFixed(2)}`
                              : 'Defina seu endereço para ver o frete'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'home' && selectedRestaurant && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="relative h-56 md:h-72 rounded-[2.5rem] overflow-hidden mb-8 shadow-2xl">
                <img src={selectedRestaurant.image} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-8">
                  <h1 className="text-3xl md:text-5xl font-black text-white mb-1">
                    {selectedRestaurant.name}
                  </h1>
                  <p className="text-white/70 font-bold text-sm">
                    {selectedRestaurant.category} • 30-45 min
                  </p>
                </div>
              </div>

              {selectedRestaurant.menu.some(p => p.category) && (
                <div className="flex gap-3 overflow-x-auto pb-4 mb-6 -mt-4 px-2">
                  <button
                    onClick={() => setSelectedCategory('')}
                    className={`px-6 py-3 rounded-2xl font-bold text-xs whitespace-nowrap transition-all ${
                      selectedCategory === ''
                        ? 'bg-orange-600 text-white'
                        : 'bg-white text-gray-600 border border-gray-100'
                    }`}
                  >
                    Todos
                  </button>
                  {[...new Set(selectedRestaurant.menu.map(p => p.category).filter(Boolean))].map(
                    cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat as string)}
                        className={`px-6 py-3 rounded-2xl font-bold text-xs whitespace-nowrap transition-all ${
                          selectedCategory === cat
                            ? 'bg-orange-600 text-white'
                            : 'bg-white text-gray-600 border border-gray-100'
                        }`}
                      >
                        {cat as string}
                      </button>
                    )
                  )}
                </div>
              )}

              {/* Busca de produtos */}
              <div className="relative mb-6 max-w-lg">
                <Search
                  size={16}
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300"
                />
                <input
                  type="text"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  className="w-full bg-white border-2 border-transparent p-4 pl-12 rounded-2xl font-bold text-gray-700 outline-none shadow-lg shadow-gray-100 focus:border-orange-200 transition-all"
                />
                {productSearch && (
                  <button
                    onClick={() => setProductSearch('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {selectedRestaurant.menu
                  .filter(p => !selectedCategory || p.category === selectedCategory)
                  .filter(p =>
                    !productSearch ||
                    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                    (p.category && p.category.toLowerCase().includes(productSearch.toLowerCase()))
                  )
                  .map(product => {
                    const cartItem = cart.find(item => item.product.id === product.id);
                    return (
                      <div
                        key={product.id}
                        className="bg-white rounded-[2rem] p-5 flex gap-5 shadow-lg shadow-gray-100 border border-gray-50 hover:shadow-xl transition-all"
                      >
                        <div className="w-24 h-24 bg-gray-100 rounded-2xl overflow-hidden shrink-0">
                          <img
                            src={
                              product.image ||
                              'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'
                            }
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-black text-gray-900 text-sm mb-1 leading-tight">
                            {product.name}
                          </h4>
                          <p className="font-black text-gray-900 mb-3 text-base">
                            {product.price.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </p>
                          {cartItem ? (
                            <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-xl w-fit border border-gray-100">
                              <button
                                onClick={() =>
                                  updateCartQuantity(product.id, cartItem.quantity - 1)
                                }
                                className="p-1.5 bg-white text-gray-500 rounded-lg shadow-sm"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="font-black text-gray-900 text-xs w-4 text-center">
                                {cartItem.quantity}
                              </span>
                              <button
                                onClick={() =>
                                  updateCartQuantity(product.id, cartItem.quantity + 1)
                                }
                                className="p-1.5 bg-white text-gray-500 rounded-lg shadow-sm"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAddToCart(product)}
                              className="bg-orange-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-100 active:scale-95"
                            >
                              {currentUserProfile ? 'Adicionar' : '🔒 Entrar'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-4xl font-black tracking-tighter text-gray-900 mb-8">Meus Pedidos</h1>
              <div className="space-y-4 max-w-2xl">
                {orders.filter(o => o.customerId === currentUserProfile?.id).length > 0 ? (
                  orders
                    .filter(o => o.customerId === currentUserProfile?.id)
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map(order => {
                      const statusInfo = traduzirStatus(order.status);
                      const isActive = !['DELIVERED', 'CANCELLED'].includes(order.status);
                      return (
                        <div
                          key={order.id}
                          className={`bg-white p-6 rounded-[2.5rem] border shadow-xl transition-all ${
                            isActive
                              ? 'border-orange-100 shadow-orange-50 ring-1 ring-orange-100'
                              : 'border-gray-50 shadow-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-4 mb-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                              isActive ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'
                            }`}>
                              <UtensilsCrossed size={22} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-black text-gray-900 leading-tight truncate">
                                {order.restaurantName}
                              </h3>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                Pedido #{order.id.slice(-6)} · {new Date(order.timestamp).toLocaleString('pt-BR', {
                                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>

                          {/* Itens do pedido */}
                          <div className="bg-gray-50 rounded-2xl p-4 mb-4 space-y-1">
                            {order.items.slice(0, 3).map((item, i) => (
                              <p key={i} className="text-xs font-bold text-gray-600">
                                {item.quantity}x {item.product.name}
                              </p>
                            ))}
                            {order.items.length > 3 && (
                              <p className="text-xs text-gray-400">+{order.items.length - 3} item(s)...</p>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <span
                              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${statusInfo.color}`}
                            >
                              {statusInfo.label}
                            </span>
                            <span className="font-black text-lg text-gray-900">
                              R$ {order.total.toFixed(2)}
                            </span>
                          </div>

                          {/* Progress bar para pedidos ativos */}
                          {isActive && (
                            <div className="mt-4">
                              <div className="flex justify-between mb-1">
                                {['PENDING','PREPARING','READY','OUT_FOR_DELIVERY'].map((s, idx) => {
                                  const steps = ['PENDING','PREPARING','READY','OUT_FOR_DELIVERY'];
                                  const currentIdx = steps.indexOf(order.status);
                                  const done = idx <= currentIdx;
                                  return (
                                    <div key={s} className={`h-1.5 flex-1 rounded-full mx-0.5 transition-all duration-500 ${
                                      done ? 'bg-orange-500' : 'bg-gray-200'
                                    }`} />
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                ) : (
                  <div className="text-center py-20 bg-white rounded-[3rem] shadow-xl border-2 border-dashed border-gray-100">
                    <UtensilsCrossed size={40} className="mx-auto mb-4 text-gray-200" />
                    <p className="text-gray-400 font-bold mb-6">Nenhum pedido realizado ainda.</p>
                    <button
                      onClick={() => setActiveTab('home')}
                      className="bg-gray-950 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 shadow-xl"
                    >
                      Explorar Restaurantes
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* CARRINHO FLUTUANTE AJUSTADO (Z-INDEX 40 E MAIS ALTO PARA NÃO BATER NO MENU) */}
      {cart.length > 0 && !isCheckoutOpen && (
        <div className="fixed bottom-32 left-6 right-6 md:left-auto md:right-12 z-40 animate-in slide-in-from-bottom fade-in duration-500">
          <button
            onClick={() => {
              // 🔒 SEGURANÇA: Exige login antes de abrir checkout
              if (!currentUserProfile) {
                onOpenProfile();
                return;
              }
              setIsCheckoutOpen(true);
            }}
            className="w-full md:w-auto bg-orange-600 text-white font-black p-5 md:px-8 md:py-6 rounded-[2.5rem] shadow-2xl shadow-orange-300 flex items-center justify-between md:justify-center gap-5 hover:bg-orange-700 transition-all hover:-translate-y-1 active:scale-90 group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
                <ShoppingCart size={22} />
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className="text-[9px] uppercase tracking-widest opacity-80 mb-0.5">
                  {cart.reduce((acc, item) => acc + item.quantity, 0)} Itens
                </span>
                <span className="text-lg tracking-tighter">
                  {cartTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest">
              Ver Sacola <ChevronRight size={14} />
            </div>
          </button>
        </div>
      )}

      {/* NAVEGAÇÃO MOBILE FIXA (Z-INDEX 50 PARA FICAR POR CIMA DE TUDO) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 px-8 py-6 flex justify-around items-center z-50 md:hidden rounded-t-[2.5rem] shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.08)]">
        <button
          onClick={() => {
            setActiveTab('home');
            setSelectedRestaurant(null);
          }}
          className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'home' ? 'text-orange-600' : 'text-gray-300'}`}
        >
          <Home size={26} strokeWidth={activeTab === 'home' ? 3 : 2} />
          <span
            className={`text-[8px] font-black uppercase tracking-widest ${activeTab === 'home' ? 'opacity-100' : 'opacity-0'}`}
          >
            Início
          </span>
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'orders' ? 'text-orange-600' : 'text-gray-300'}`}
        >
          <List size={26} strokeWidth={activeTab === 'orders' ? 3 : 2} />
          <span
            className={`text-[8px] font-black uppercase tracking-widest ${activeTab === 'orders' ? 'opacity-100' : 'opacity-0'}`}
          >
            Pedidos
          </span>
        </button>
        <button
          onClick={onOpenProfile}
          className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'profile' ? 'text-orange-600' : 'text-gray-300'}`}
        >
          <User size={26} strokeWidth={activeTab === 'profile' ? 3 : 2} />
          <span
            className={`text-[8px] font-black uppercase tracking-widest ${activeTab === 'profile' ? 'opacity-100' : 'opacity-0'}`}
          >
            Perfil
          </span>
        </button>
      </nav>

      {/* MODAL DE CHECKOUT COM Z-INDEX SUPERIOR */}
      {isCheckoutOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6 animate-in fade-in duration-300"
          onClick={() => setIsCheckoutOpen(false)}
        >
          <div
            className="bg-white w-full md:max-w-xl rounded-t-[3.5rem] md:rounded-[3.5rem] p-10 shadow-2xl animate-in slide-in-from-bottom duration-500 max-h-[90vh] flex flex-col relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-8 shrink-0">
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tighter">Minha Sacola</h3>
                <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-1">
                  Revisão do pedido
                </p>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-3 bg-gray-50 text-gray-400 rounded-full hover:bg-red-50 hover:text-red-500 transition-all"
              >
                <X size={24} />
              </button>
            </div>
            <div className="overflow-y-auto no-scrollbar flex-1 pb-10">
              <div className="space-y-5 mb-10">
                {cart.map(item => (
                  <div
                    key={item.product.id}
                    className="flex items-center gap-5 p-4 bg-gray-50 rounded-[1.8rem] border border-gray-100"
                  >
                    <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 shadow-sm">
                      <img
                        src={
                          item.product.image ||
                          'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'
                        }
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-900 text-sm truncate leading-tight">
                        {item.product.name}
                      </p>
                      <p className="font-bold text-orange-600 text-xs">
                        {(item.product.price * item.quantity).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 bg-white p-1 rounded-xl shadow-sm border border-gray-50">
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                        className="p-1.5 text-gray-400 hover:text-gray-900 transition-all"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-black text-gray-900 text-xs w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                        className="p-1.5 text-gray-400 hover:text-gray-900 transition-all"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100 mb-10">
                {/* Cupom de desconto */}
                {!appliedCoupon ? (
                  <div className="mb-6">
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Tag
                          size={14}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          value={couponCode}
                          onChange={e => setCouponCode(e.target.value.toUpperCase())}
                          placeholder="Código do cupom"
                          className="w-full pl-10 pr-4 py-3 bg-white rounded-xl font-bold text-sm border-none outline-none"
                        />
                      </div>
                      <button
                        onClick={handleApplyCoupon}
                        disabled={isApplyingCoupon || !couponCode.trim()}
                        className="px-4 bg-gray-900 text-white rounded-xl font-bold text-xs uppercase disabled:opacity-50"
                      >
                        {isApplyingCoupon ? (
                          <Loader size={16} className="animate-spin" />
                        ) : (
                          'Aplicar'
                        )}
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-red-500 text-xs mt-2 font-bold">{couponError}</p>
                    )}
                  </div>
                ) : (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check size={16} className="text-green-600" />
                      <span className="font-bold text-green-700 text-sm">{appliedCoupon.code}</span>
                      <span className="text-green-600 text-xs">
                        (-R$ {appliedCoupon.discount.toFixed(2)})
                      </span>
                    </div>
                    <button
                      onClick={handleRemoveCoupon}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                  <span>Subtotal</span>
                  <span className="text-gray-900">
                    {cartSubtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                  <span className="flex items-center gap-1">
                    <MapPin size={10} />
                    Entrega
                    {distKm > 0 && (
                      <span className="text-orange-500 normal-case font-bold">
                        · {distKm.toFixed(1)} km
                      </span>
                    )}
                  </span>
                  <span className={deliveryFee === 0 ? 'text-green-600' : 'text-gray-900'}>
                    {deliveryFee === 0 && appliedCoupon?.isFreeDelivery
                      ? 'GRÁTIS'
                      : deliveryFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                {!selectedAddress?.coords && (
                  <p className="text-[9px] text-orange-500 font-bold mb-3">
                    ⚠️ Selecione um endereço com localização no mapa para calcular o frete exato
                  </p>
                )}
                {discount > 0 && (
                  <div className="flex justify-between items-center text-[10px] font-black text-green-600 uppercase tracking-widest mb-4">
                    <span>Desconto</span>
                    <span>
                      -{discount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                )}
                <div className="h-px bg-gray-200 mb-4"></div>
                <div className="flex justify-between items-center text-2xl font-black text-gray-900 tracking-tighter">
                  <span>Total</span>
                  <span>
                    {cartTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
              {/* ── Seletor de método de pagamento ── */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {([
                  { method: 'CREDIT_CARD', label: 'Crédito', icon: <CreditCard size={18} /> },
                  { method: 'DEBIT_CARD',  label: 'Débito',  icon: <CreditCard size={18} /> },
                  { method: 'PIX',         label: 'PIX',     icon: <Smartphone size={18} /> },
                ] as { method: PaymentMethod; label: string; icon: React.ReactNode }[]).map(({ method, label, icon }) => (
                  <button
                    key={method}
                    onClick={() => { setSelectedPayment(method); setSelectedSavedCardId(null); setShowNewCardForm(false); }}
                    className={`py-5 flex flex-col items-center justify-center gap-2 rounded-[1.8rem] border-2 transition-all ${selectedPayment === method ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-lg' : 'border-gray-100 bg-white text-gray-400'}`}
                  >
                    <div className={`p-2 rounded-xl ${selectedPayment === method ? 'bg-orange-600 text-white' : 'bg-gray-50'}`}>
                      {icon}
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
                  </button>
                ))}
              </div>

              {/* ── Cartões salvos (somente para crédito/débito) ── */}
              {(selectedPayment === 'CREDIT_CARD' || selectedPayment === 'DEBIT_CARD') && (() => {
                const savedCards = currentUserProfile?.savedCards || [];
                return (
                  <div className="mb-6 space-y-3">
                    {/* Lista de cartões salvos */}
                    {savedCards.map(card => (
                      <div key={card.id}
                        onClick={() => { setSelectedSavedCardId(card.id); setShowNewCardForm(false); setSavedCardCvv(''); }}
                        className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedSavedCardId === card.id ? 'border-orange-500 bg-orange-50' : 'border-gray-100 bg-gray-50 hover:border-orange-200'}`}
                      >
                        <div className={`p-2 rounded-xl ${selectedSavedCardId === card.id ? 'bg-orange-600 text-white' : 'bg-white text-gray-400'}`}>
                          <CreditCard size={18} />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-black text-sm text-gray-900">{card.brand} •••• {card.last4}</p>
                          <p className="text-[10px] text-gray-400 font-bold">{card.holderName} · {card.expiryMonth}/{card.expiryYear}</p>
                        </div>
                        <button
                          onClick={async e => {
                            e.stopPropagation();
                            if (!confirm('Remover este cartão?')) return;
                            const updated = savedCards.filter(c => c.id !== card.id);
                            await store.updateUserProfile!(currentUserProfile!.id, { savedCards: updated });
                            if (selectedSavedCardId === card.id) setSelectedSavedCardId(null);
                          }}
                          className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}

                    {/* CVV do cartão salvo selecionado */}
                    {selectedSavedCardId && !showNewCardForm && (
                      <div className="animate-in slide-in-from-top-2 duration-200">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1 ml-1">CVV do cartão</label>
                        <input
                          type="password" maxLength={4}
                          value={savedCardCvv}
                          onChange={e => setSavedCardCvv(e.target.value.replace(/\D/g, ''))}
                          placeholder="•••"
                          className="w-32 p-3 bg-gray-50 border-2 border-transparent focus:border-orange-200 rounded-xl font-black text-center outline-none tracking-[0.4em]"
                        />
                        <p className="text-[9px] text-gray-400 font-bold mt-1 ml-1">Necessário por segurança a cada compra</p>
                      </div>
                    )}

                    {/* Botão adicionar novo cartão */}
                    {!showNewCardForm && (
                      <button
                        onClick={() => { setShowNewCardForm(true); setSelectedSavedCardId(null); }}
                        className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-gray-100 text-gray-400 hover:border-orange-200 hover:text-orange-600 transition-all"
                      >
                        <PlusCircle size={18} />
                        <span className="font-black text-xs uppercase tracking-widest">
                          {savedCards.length === 0 ? 'Adicionar cartão' : 'Usar outro cartão'}
                        </span>
                      </button>
                    )}

                    {/* Formulário novo cartão */}
                    {showNewCardForm && (
                      <div className="bg-gray-50 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-black text-sm text-gray-700">Novo Cartão</p>
                          {savedCards.length > 0 && (
                            <button onClick={() => { setShowNewCardForm(false); setSelectedSavedCardId(savedCards[0].id); }}
                              className="text-[10px] font-black text-orange-600 uppercase tracking-widest">
                              Usar salvo
                            </button>
                          )}
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Número do Cartão</label>
                          <input type="text" inputMode="numeric" maxLength={19}
                            value={cardNumber}
                            onChange={e => setCardNumber(e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim())}
                            placeholder="0000 0000 0000 0000"
                            className="w-full p-4 bg-white rounded-xl font-bold text-sm outline-none border-2 border-transparent focus:border-orange-200 tracking-widest"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Nome no Cartão</label>
                          <input type="text"
                            value={cardHolder}
                            onChange={e => setCardHolder(e.target.value.toUpperCase())}
                            placeholder="NOME COMO NO CARTÃO"
                            className="w-full p-4 bg-white rounded-xl font-bold text-sm outline-none border-2 border-transparent focus:border-orange-200 uppercase tracking-widest"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Validade</label>
                            <input type="text" inputMode="numeric" maxLength={5}
                              value={cardExpiry}
                              onChange={e => {
                                const v = e.target.value.replace(/\D/g, '');
                                setCardExpiry(v.length > 2 ? `${v.slice(0,2)}/${v.slice(2)}` : v);
                              }}
                              placeholder="MM/AA"
                              className="w-full p-4 bg-white rounded-xl font-bold text-sm outline-none border-2 border-transparent focus:border-orange-200 tracking-widest"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">CVV</label>
                            <input type="password" inputMode="numeric" maxLength={4}
                              value={cardCvv}
                              onChange={e => setCardCvv(e.target.value.replace(/\D/g, ''))}
                              placeholder="•••"
                              className="w-full p-4 bg-white rounded-xl font-bold text-sm outline-none border-2 border-transparent focus:border-orange-200 tracking-[0.4em]"
                            />
                          </div>
                        </div>
                        {/* Opção salvar cartão */}
                        <label className="flex items-center gap-3 cursor-pointer select-none p-3 bg-white rounded-xl border border-gray-100">
                          <div
                            onClick={() => setSaveCardForFuture(v => !v)}
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${saveCardForFuture ? 'bg-orange-600 border-orange-600' : 'border-gray-300'}`}
                          >
                            {saveCardForFuture && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                          </div>
                          <div>
                            <p className="text-xs font-black text-gray-700">Salvar cartão para próximas compras</p>
                            <p className="text-[9px] text-gray-400 font-bold">Apenas o token seguro é salvo. Seus dados não ficam no servidor.</p>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── PIX: instrução ── */}
              {selectedPayment === 'PIX' && (
                <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-2xl">
                  <p className="text-xs font-bold text-green-700">Após confirmar, você receberá o QR Code do PIX para pagamento. O pedido é confirmado só após o pagamento.</p>
                </div>
              )}
            </div>
            <button
              onClick={handleFinalizeOrder}
              disabled={isProcessing}
              className="w-full bg-gray-950 text-white py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] flex items-center justify-center gap-4 active:scale-95 transition-all shadow-2xl disabled:opacity-50 shrink-0"
            >
              {isProcessing ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <span>Finalizar Pedido</span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* SUCESSO DO PEDIDO */}
      {showOrderSuccess && (
        <div className="fixed inset-0 z-[120] bg-gray-950/90 backdrop-blur-2xl flex items-center justify-center p-8 animate-in fade-in duration-500">
          <div className="bg-white w-full max-w-md rounded-[4rem] p-16 text-center shadow-2xl animate-in zoom-in-90 duration-500 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
            <div className="w-28 h-28 bg-green-50 text-green-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-inner animate-bounce">
              <Bike size={56} />
            </div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter mb-4">
              Pedido Enviado!
            </h2>
            <p className="text-gray-400 font-bold mb-12 text-sm leading-relaxed">
              Prepare a mesa! O restaurante já recebeu seu pedido.
            </p>
            <button
              onClick={() => {
                setShowOrderSuccess(false);
                setActiveTab('orders');
              }}
              className="w-full bg-gray-950 text-white py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] active:scale-95 transition-all shadow-xl"
            >
              Acompanhar Entrega
            </button>
          </div>
        </div>
      )}

      {/* ENDEREÇO E AVALIAÇÃO */}
      {isAddressSelectorOpen && (
        <div
          className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6 animate-in fade-in duration-300"
          onClick={() => {
            setIsAddressSelectorOpen(false);
            // Se checkout estava aberto antes, reabre
            if (checkoutWasOpen) {
              setIsCheckoutOpen(true);
              setCheckoutWasOpen(false);
            }
          }}
        >
          <div
            className="bg-white w-full md:max-w-xl rounded-t-[3.5rem] md:rounded-[3.5rem] p-10 shadow-2xl animate-in slide-in-from-bottom duration-500 max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-10 shrink-0">
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tighter">
                  Onde entregar?
                </h3>
                <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-1">
                  Seus endereços salvos
                </p>
              </div>
              <button
                onClick={() => setIsAddressSelectorOpen(false)}
                className="p-3 bg-gray-50 text-gray-400 rounded-full hover:bg-gray-100 transition-all"
              >
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto no-scrollbar mb-10">
              {currentUserProfile?.savedAddresses?.map(addr => (
                <button
                  key={addr.id}
                  onClick={() => handleSelectAddress(addr)}
                  className={`w-full flex items-center gap-5 p-5 rounded-[2rem] border-2 transition-all active:scale-[0.98] ${selectedAddress?.id === addr.id ? 'border-orange-500 bg-orange-50 shadow-lg' : 'border-gray-50 bg-gray-50 hover:border-orange-100'}`}
                >
                  <div
                    className={`p-3 rounded-xl shadow-sm ${selectedAddress?.id === addr.id ? 'bg-orange-600 text-white' : 'bg-white text-gray-400'}`}
                  >
                    <MapPin size={20} />
                  </div>
                  <div className="text-left overflow-hidden flex-1">
                    <p className="font-black text-gray-900 text-sm truncate leading-tight mb-0.5">
                      {addr.street}, {addr.number}
                    </p>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">
                      {addr.neighborhood || 'Centro'}
                    </p>
                  </div>
                  {selectedAddress?.id === addr.id && (
                    <CheckCircle2 size={20} className="text-orange-600 shrink-0" />
                  )}
                </button>
              ))}
              <button
                onClick={() => {
                  setIsAddressSelectorOpen(false);
                  // Se checkout estava aberto, fecha-o para o AddressModal ficar visível
                  if (isCheckoutOpen) {
                    setCheckoutWasOpen(true);
                    setIsCheckoutOpen(false);
                  }
                  setIsAddressModalOpen(true);
                }}
                className="w-full flex items-center gap-5 p-5 rounded-[2rem] border-2 border-dashed border-gray-100 text-gray-400 hover:border-orange-200 hover:text-orange-600 transition-all active:scale-[0.98] group"
              >
                <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-orange-50 transition-colors">
                  <PlusCircle size={20} />
                </div>
                <span className="font-black text-[10px] uppercase tracking-[0.2em]">
                  Adicionar novo endereço
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      {isAddressModalOpen && (
        <AddressModal
          onClose={() => setIsAddressModalOpen(false)}
          onSave={handleAddNewAddress}
          title="Novo Endereço de Entrega"
        />
      )}
      {ratingOrder && (
        <div className="fixed inset-0 z-[120] bg-gray-950/90 backdrop-blur-2xl flex items-center justify-center p-8 animate-in fade-in duration-500">
          <div className="bg-white w-full max-w-md rounded-[4rem] p-16 text-center shadow-2xl animate-in zoom-in-90 duration-500 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-orange-600"></div>
            <div className="w-24 h-24 bg-orange-100 text-orange-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-inner">
              <Package size={48} />
            </div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter mb-2">
              Pedido Entregue!
            </h2>
            <p className="text-gray-400 font-bold mb-12 text-sm leading-relaxed">
              Avalie sua experiência com a{' '}
              <span className="text-gray-900">{ratingOrder.restaurantName}</span>
            </p>
            <div className="flex justify-center gap-4 mb-14">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setStoreStars(star)}
                  className={`transition-all duration-300 transform ${storeStars >= star ? 'scale-125' : 'scale-100 opacity-20 hover:opacity-50'}`}
                >
                  <Star size={40} className="fill-orange-500 text-orange-500" />
                </button>
              ))}
            </div>
            {storeStars > 0 && (
              <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
                  {/* Driver stars */}
                  {ratingOrder.driverId && (
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">🏍️ Entregador</p>
                      <div className="flex justify-center gap-3">
                        {[1,2,3,4,5].map(star => (
                          <button key={star} onClick={() => setDriverStars(star)}
                            className={`transition-all duration-200 transform ${driverStars >= star ? 'scale-125' : 'scale-100 opacity-20 hover:opacity-50'}`}>
                            <Star size={32} className="fill-blue-500 text-blue-500" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Product + packaging */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Produto OK?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setProductOk(true)}
                          className={`flex-1 py-4 rounded-2xl transition-all ${productOk === true ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400'}`}>
                          <ThumbsUp size={18} className="mx-auto" />
                        </button>
                        <button onClick={() => setProductOk(false)}
                          className={`flex-1 py-4 rounded-2xl transition-all ${productOk === false ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400'}`}>
                          <ThumbsDown size={18} className="mx-auto" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Embalagem OK?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setPackagingOk(true)}
                          className={`flex-1 py-4 rounded-2xl transition-all ${packagingOk === true ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400'}`}>
                          <ThumbsUp size={18} className="mx-auto" />
                        </button>
                        <button onClick={() => setPackagingOk(false)}
                          className={`flex-1 py-4 rounded-2xl transition-all ${packagingOk === false ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400'}`}>
                          <ThumbsDown size={18} className="mx-auto" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Comment */}
                  <textarea
                    value={ratingComment}
                    onChange={e => setRatingComment(e.target.value)}
                    rows={2}
                    placeholder="Deixe um comentário (opcional)..."
                    className="w-full p-4 bg-gray-50 rounded-2xl text-sm font-medium outline-none border-2 border-transparent focus:border-orange-300 resize-none text-gray-700"
                  />
                  <button
                    onClick={handleFinishRating}
                    className="w-full bg-gray-950 text-white py-6 rounded-[2.5rem] font-black uppercase text-xs tracking-[0.3em] active:scale-95 transition-all shadow-2xl">
                    Finalizar Feedback
                  </button>
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
