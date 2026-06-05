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
  UserRole,
} from '../types';
import { TutorialModal, hasSeen, markSeen } from '../components/TutorialModal';
import { useAndroidBack } from '../hooks/useAndroidBack';
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
  Wallet,
  Pencil,
  Heart,
  Receipt,
  Ban,
  HelpCircle,
} from 'lucide-react';
import { AddressModal } from '../components/AddressModal';
import { DriverTrackingMap } from '../components/DriverTrackingMap';
import Logo from '../assets/Logo.png';
import Nome from '../assets/Nome.png';

// PagSeguro removido — pagamentos agora processados via Asaas (Edge Functions)

export const ClientView: React.FC<{ onOpenProfile: () => void }> = ({ onOpenProfile }) => {
  const store = useAppStore();
  const {
    restaurants = [],
    orders = [],
    currentUserProfile,
    createOrder,
    recalculateDistances,
    calculateDistance,
    realDistances,
    submitRating,
    addAddress,
    updateAddress,
    deleteAddress,
    platformSettings,
    profiles,
    toggleFavorite,
    cancelOrder,
    updateUserProfile,
  } = store || {};

  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'profile'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('CREDIT_CARD');
  const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(null);
  const [isAddressSelectorOpen, setIsAddressSelectorOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
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

  // PIX modal — exibido após criação da cobrança Asaas
  const [pixModal, setPixModal] = useState<{
    qrCode: string;
    qrCodeImage: string | null;
    asaasPaymentId: string;
  } | null>(null);

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
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Receipt modal
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  // Cancel order
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  // WhatsApp de suporte
  const [supportWhatsapp, setSupportWhatsapp] = useState<string | null>(null);

  // Tutorial
  const [showTutorial, setShowTutorial] = useState(false);

  // Relógio para o contador regressivo de entrega (tick a cada 30s)
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!currentUserProfile || currentUserProfile.role !== UserRole.CLIENT) return;
    if (currentUserProfile.clientTutorialSeen || hasSeen('CLIENT')) {
      markSeen('CLIENT');
      return;
    }
    setShowTutorial(true);
  }, [currentUserProfile?.id]);

  useAndroidBack(() => {
    if (showTutorial)            { markSeen('CLIENT'); if (currentUserProfile) updateUserProfile!(currentUserProfile.id, { clientTutorialSeen: true }).catch(() => {}); setShowTutorial(false); return true; }
    if (receiptOrder)            { setReceiptOrder(null);                            return true; }
    if (pixModal)                { setPixModal(null);                                return true; }
    if (isAddressModalOpen)      { setIsAddressModalOpen(false);                     return true; }
    if (isAddressSelectorOpen)   { setIsAddressSelectorOpen(false);                  return true; }
    if (isCheckoutOpen)          { setIsCheckoutOpen(false);                         return true; }
    if (selectedRestaurant)      { setSelectedRestaurant(null);                      return true; }
    if (activeTab !== 'home')    { setActiveTab('home'); setSelectedRestaurant(null); return true; }
    return false; // home tab sem nada aberto → minimiza
  });

  // Helper: traduz status do pedido para português
  const traduzirStatus = (status: string): { label: string; color: string } => {
    const map: Record<string, { label: string; color: string }> = {
      PENDING_PAYMENT:  { label: '\u23f3 Aguard. Pgto',    color: 'bg-orange-100 text-orange-700' },
      PENDING:          { label: '\u23f3 Aguardando',    color: 'bg-yellow-100 text-yellow-700' },
      PREPARING:        { label: '\ud83d\udc68\u200d\ud83c\udf73 Preparando',    color: 'bg-blue-100 text-blue-700' },
      READY:            { label: '\u2705 Pronto',         color: 'bg-green-100 text-green-700' },
      OUT_FOR_DELIVERY: { label: '\ud83d\udeb4 Em Entrega',    color: 'bg-purple-100 text-purple-700' },
      DELIVERED:        { label: '\ud83c\udf89 Entregue',      color: 'bg-gray-100 text-gray-600' },
      CANCELLED:        { label: '\u274c Cancelado',     color: 'bg-red-100 text-red-700' },
      DELIVERY_FAILED:  { label: '\u26a0\ufe0f N\u00e3o entregue', color: 'bg-red-100 text-red-700' },
      RETURNING:        { label: '\ud83d\udd04 Devolvendo',    color: 'bg-orange-100 text-orange-700' },
      RETURNED:         { label: '\ud83d\udce6 Devolvido',     color: 'bg-gray-100 text-gray-500' },
    };
    return map[status] || { label: status, color: 'bg-orange-100 text-orange-700' };
  };

  useEffect(() => {
    supabase.from('platform_settings').select('support_whatsapp').maybeSingle()
      .then(({ data }) => { if (data?.support_whatsapp) setSupportWhatsapp(data.support_whatsapp); });
  }, []);

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

  // Formata endereço para exibição — funciona mesmo sem rua cadastrada (só coords)
  const formatAddressDisplay = (addr: UserAddress): string => {
    if (addr.street && !addr.street.includes(',')) return addr.number ? `${addr.street}, ${addr.number}` : addr.street;
    if (addr.street) return addr.street; // já tem tudo junto (ex: coordenadas)
    if (addr.reference) return addr.reference;
    if (addr.neighborhood) return addr.neighborhood;
    if (addr.coords) return `📍 ${addr.coords.lat.toFixed(4)}, ${addr.coords.lng.toFixed(4)}`;
    return addr.city || 'Local definido';
  };

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

  const handleSaveAddress = async (addr: Omit<UserAddress, 'id'>) => {
    if (editingAddress) {
      // Editar endereço existente
      await updateAddress?.({ ...addr, id: editingAddress.id });
      setEditingAddress(null);
      setIsAddressModalOpen(false);
      // Reabre o seletor para o usuário ver o endereço atualizado
      setIsAddressSelectorOpen(true);
    } else {
      // Criar novo endereço
      const newAddr = await addAddress?.(addr);
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
    }
  };

  const handleEditAddress = (addr: UserAddress) => {
    setEditingAddress(addr);
    setIsAddressSelectorOpen(false); // fecha o seletor para o modal aparecer limpo
    setIsAddressModalOpen(true);
  };

  const handleDeleteAddress = async (addrId: string) => {
    await deleteAddress?.(addrId);
    // Se o endereço excluído era o selecionado, seleciona o primeiro disponível
    if (selectedAddress?.id === addrId) {
      const remaining = currentUserProfile?.savedAddresses?.filter(a => a.id !== addrId) ?? [];
      setSelectedAddress(remaining.length > 0 ? remaining[0] : null);
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
    const favIds = currentUserProfile?.favoriteRestaurantIds ?? [];
    return restaurants
      .filter(r => !showFavoritesOnly || favIds.includes(r.id))
      .filter(
        r =>
          r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [restaurants, searchQuery, showFavoritesOnly, currentUserProfile?.favoriteRestaurantIds]);

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

  // Taxa de serviço fixa (configurável no admin) — só incide quando há itens no carrinho
  const serviceFee = useMemo(() => {
    if (cartSubtotal === 0) return 0;
    return platformSettings?.serviceFee ?? 4.0;
  }, [cartSubtotal, platformSettings]);

  const discount = appliedCoupon ? (appliedCoupon.discount > 0 ? appliedCoupon.discount : 0) : 0;
  const cartTotal = Math.max(0, cartSubtotal + deliveryFee + serviceFee - discount);

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

    // Valida restaurante ainda aberto (pode ter fechado enquanto o carrinho estava montado)
    if (selectedRestaurant.isOpen === false) {
      alert('Este restaurante está fechado no momento. Por favor, escolha outro.');
      setIsCheckoutOpen(false);
      setSelectedRestaurant(null);
      setCart([]);
      return;
    }

    // Valida valor mínimo do pedido
    const minOrderValue = platformSettings?.minOrderValue ?? 15;
    if (cartSubtotal < minOrderValue) {
      alert(`Pedido mínimo é R$ ${minOrderValue.toFixed(2)}. Adicione mais itens ao carrinho.`);
      return;
    }

    setIsProcessing(true);
    try {
      const savedCards = currentUserProfile.savedCards || [];
      const selectedSaved = savedCards.find(c => c.id === selectedSavedCardId);

      // ── 1. Criar o pedido no banco (status PENDING_PAYMENT ou PENDING para dinheiro) ──
      const createdOrder = await createOrder(
        selectedRestaurant.id,
        cart,
        selectedPayment,
        formatAddressDisplay(selectedAddress),
        currentUserProfile.name,
        undefined, // paymentId — preenchido após cobrança Asaas
        selectedAddress.coords,
        deliveryFee,
        discount
      );

      // ── 2. Para CREDIT_CARD ou PIX — chamar Edge Function create-asaas-payment ──
      if (selectedPayment === 'CREDIT_CARD' || selectedPayment === 'PIX') {
        const newOrderId = (createdOrder as any)?.id;
        if (!newOrderId) throw new Error('Pedido criado mas ID não encontrado.');

        const paymentBody: Record<string, any> = {
          orderId: newOrderId,
          billingType: selectedPayment === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX',
        };

        // Dados de cartão
        if (selectedPayment === 'CREDIT_CARD') {
          if (selectedSaved?.token) {
            // Cartão tokenizado (token Asaas salvo no perfil)
            paymentBody.creditCardToken = selectedSaved.token;
          } else {
            // Cartão novo — dados enviados para tokenização no Asaas
            const [expMonth, expYear] = cardExpiry.split('/');
            if (!cardNumber || !cardHolder || !expMonth || !expYear || !cardCvv) {
              throw new Error('Preencha todos os dados do cartão.');
            }
            paymentBody.creditCard = {
              holderName: cardHolder,
              number: cardNumber.replace(/\s/g, ''),
              expiryMonth: expMonth.trim(),
              expiryYear: `20${expYear.trim()}`,
              ccv: cardCvv,
            };
            paymentBody.creditCardHolderInfo = {
              name: currentUserProfile.name,
              email: currentUserProfile.email,
              cpfCnpj: currentUserProfile.cpf?.replace(/\D/g, '') || '',
              postalCode: selectedAddress.zipCode?.replace(/\D/g, '') || '78580000',
              addressNumber: selectedAddress.number || 's/n',
              phone: currentUserProfile.phoneNumber?.replace(/\D/g, '') || '',
            };
          }
        }

        const { data: pmData, error: pmError } = await supabase.functions.invoke('create-asaas-payment', {
          body: paymentBody,
        });

        if (pmError) throw pmError;
        if (!pmData?.asaasPaymentId) throw new Error('Falha ao criar cobrança Asaas.');

        // ── Salvar token do cartão para uso futuro ──
        if (selectedPayment === 'CREDIT_CARD' && saveCardForFuture && !selectedSaved && pmData.creditCardToken) {
          const newSavedCard: SavedCard = {
            id: `card-${Date.now()}`,
            token: pmData.creditCardToken,
            last4: cardNumber.slice(-4).replace(/\D/g, ''),
            brand: pmData.creditCardBrand || 'CARD',
            holderName: cardHolder,
            expiryMonth: cardExpiry.split('/')[0],
            expiryYear: cardExpiry.split('/')[1],
          };
          const updatedCards = [...savedCards, newSavedCard];
          await store.updateUserProfile!(currentUserProfile.id, { savedCards: updatedCards });
        }

        // ── Para PIX: exibir modal com QR code ──
        if (selectedPayment === 'PIX' && pmData.pixQrCode) {
          setCart([]);
          setCardNumber('');
          setCardHolder('');
          setCardExpiry('');
          setCardCvv('');
          setIsCheckoutOpen(false);
          setPixModal({
            qrCode: pmData.pixQrCode,
            qrCodeImage: pmData.pixQrCodeImage || null,
            asaasPaymentId: pmData.asaasPaymentId,
          });
          return; // não mostra "pedido confirmado" ainda — aguarda pagamento via webhook
        }
      }

      // ── 3. Limpar e confirmar ──
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

  const clientSlides = [
    { emoji: '🏪', title: 'Escolha um restaurante', description: 'Veja os restaurantes disponíveis, o cardápio completo e adicione itens ao carrinho.' },
    { emoji: '📍', title: 'Informe seu endereço', description: 'Use o mapa ou preencha manualmente. Você pode salvar endereços favoritos para usar rapidamente.' },
    { emoji: '💳', title: 'Pague com PIX ou Crédito', description: 'Pagamento 100% seguro via Asaas. Com PIX você paga na hora; com cartão é automático.' },
    { emoji: '🔑', title: 'Código de entrega', description: 'Quando o entregador chegar, você verá um código no app. Mostre ao entregador para confirmar o recebimento.' },
  ];

  return (
    <>
    {showTutorial && (
      <TutorialModal
        slides={clientSlides}
        accentColor="orange"
        onClose={() => { markSeen('CLIENT'); if (currentUserProfile) updateUserProfile!(currentUserProfile.id, { clientTutorialSeen: true }).catch(() => {}); setShowTutorial(false); }}
      />
    )}
    <div className="h-dvh bg-gray-50 flex flex-col md:flex-row overflow-hidden relative safe-area-top">
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-100 flex-col p-6 sticky top-0 h-dvh z-30">
        <div className="mb-10 flex items-center gap-3 px-2">
          <img src={Logo} alt="Logo" className="h-8 w-auto object-contain" />
          <img src={Nome} alt="DeliveryCity" className="h-4 w-auto object-contain opacity-70" />
        </div>
        <nav className="flex-1 space-y-1">
          <button
            onClick={() => {
              setActiveTab('home');
              setSelectedRestaurant(null);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'home' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Home size={20} /> <span>Início</span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'orders' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <List size={20} /> <span>Meus Pedidos</span>
          </button>
          <button
            onClick={onOpenProfile}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'profile' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <User size={20} /> <span>Meu Perfil</span>
          </button>
          <button
            onClick={() => setShowTutorial(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-50 transition-all"
          >
            <HelpCircle size={20} /> <span>Tutorial</span>
          </button>
        </nav>
      </aside>

      {/* CONTEÚDO PRINCIPAL COM PADDING INFERIOR PARA NÃO FICAR ATRÁS DO MENU */}
      <main className="flex-1 flex flex-col min-h-0 pb-36 md:pb-0 relative z-10 overflow-y-auto no-scrollbar">
        {/* HEADER */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-[45] px-6 py-4 flex flex-col gap-3">
          <div className="flex justify-between items-center w-full">
            {selectedRestaurant ? (
              <button
                onClick={() => setSelectedRestaurant(null)}
                className="p-2 text-gray-700 hover:bg-gray-50 rounded-xl active:scale-95 transition-all"
              >
                <ChevronLeft size={22} />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <img src={Logo} alt="Logo" className="h-8 w-auto" />
                <img src={Nome} alt="DeliveryCity" className="h-3.5 w-auto opacity-60" />
              </div>
            )}
          </div>

          <button
            onClick={handleAddressButtonClick}
            className="flex items-center gap-3 text-left w-full bg-gray-50 border border-gray-100 px-4 py-2.5 rounded-xl active:scale-[0.98] transition-all"
          >
            <MapPin size={15} className="text-orange-600 shrink-0" />
            <div className="flex flex-col flex-1 truncate">
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">
                Entregar em
              </span>
              <span className="truncate text-xs font-bold text-gray-900">
                {selectedAddress
                  ? formatAddressDisplay(selectedAddress)
                  : currentUserProfile
                    ? 'Defina seu endereço'
                    : 'Olá! Faça login para pedir'}
              </span>
            </div>
            <ChevronRight size={14} className="text-gray-300 ml-auto" />
          </button>
        </header>

        <div className="p-5 md:p-10 w-full max-w-7xl mx-auto">
          {activeTab === 'home' && !selectedRestaurant && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-700">
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight mb-6">
                Fome de quê?
              </h2>
              <div className="relative mb-5 max-w-2xl">
                <Search
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar restaurante..."
                  className="w-full bg-white border border-gray-200 py-3 pl-11 pr-4 rounded-xl font-medium text-gray-700 outline-none focus:border-orange-300 transition-all text-sm"
                />
              </div>
              {currentUserProfile && (
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => setShowFavoritesOnly(false)}
                    className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                      !showFavoritesOnly
                        ? 'bg-orange-600 text-white'
                        : 'bg-white text-gray-500 border border-gray-200'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setShowFavoritesOnly(true)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                      showFavoritesOnly
                        ? 'bg-red-500 text-white'
                        : 'bg-white text-gray-500 border border-gray-200'
                    }`}
                  >
                    <Heart size={12} className={showFavoritesOnly ? 'fill-white' : ''} />
                    Favoritos
                    {(currentUserProfile.favoriteRestaurantIds?.length ?? 0) > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        showFavoritesOnly ? 'bg-white/20' : 'bg-red-100 text-red-500'
                      }`}>
                        {currentUserProfile.favoriteRestaurantIds!.length}
                      </span>
                    )}
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredStores.map(restaurant => {
                  const estFee = estimatedDeliveryFee(restaurant);
                  const isClosed = restaurant.isOpen === false;
                  const isFav = currentUserProfile?.favoriteRestaurantIds?.includes(restaurant.id) ?? false;
                  const travelMins = realDistances?.[restaurant.id]
                    ? parseInt(realDistances[restaurant.id].durationText) || 0
                    : 0;
                  const prepMins = restaurant.prepTime ?? 30;
                  const totalMins = travelMins > 0 ? prepMins + travelMins : prepMins;
                  const timeLabel = travelMins > 0 ? `~${totalMins} min` : `~${prepMins} min preparo`;
                  return (
                    <div
                      key={restaurant.id}
                      onClick={() => {
                        if (isClosed) return; // bloqueia clique em restaurante fechado
                        setSelectedRestaurant(restaurant);
                        // Se logado mas sem endereço definido, pede o endereço imediatamente
                        if (currentUserProfile && !selectedAddress) {
                          setCheckoutWasOpen(false);
                          setIsAddressSelectorOpen(true);
                        }
                      }}
                      className={`bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm transition-all ${isClosed ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]'}`}
                    >
                      {/* Imagem do restaurante */}
                      <div className="h-36 bg-gray-100 relative overflow-hidden">
                        <img src={restaurant.image} className={`w-full h-full object-cover ${isClosed ? 'grayscale' : ''}`} />
                        {/* Badge de categoria no canto */}
                        <span className="absolute top-3 left-3 bg-white/90 backdrop-blur text-gray-700 text-[10px] font-black px-2 py-1 rounded-lg">
                          {restaurant.category}
                        </span>
                        {currentUserProfile && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              toggleFavorite?.(restaurant.id);
                            }}
                            className="absolute top-3 right-3 p-1.5 bg-white/90 backdrop-blur rounded-lg active:scale-90 transition-all"
                          >
                            <Heart
                              size={14}
                              className={isFav ? 'fill-red-500 text-red-500' : 'text-gray-400'}
                            />
                          </button>
                        )}
                        {isClosed && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/20">
                            <span className="bg-gray-900/80 text-white text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg">
                              Fechado
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-black text-gray-900 text-base leading-tight">{restaurant.name}</h3>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <Star size={12} fill="currentColor" className="text-amber-500" />
                            <span className="text-xs font-bold text-gray-700">{restaurant.rating.toFixed(1)}</span>
                          </div>
                        </div>
                        <p className="text-gray-400 text-xs">
                          {isClosed
                            ? 'Estabelecimento fechado'
                            : estFee !== null
                              ? `${estFee === 0 ? 'Entrega grátis' : `Entrega R$ ${estFee.toFixed(2)}`} · ${timeLabel}`
                              : 'Defina seu endereço para ver o frete'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'home' && selectedRestaurant && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Banner do restaurante — sem gradiente pesado */}
              <div className="relative h-44 md:h-60 rounded-2xl overflow-hidden mb-6 border border-gray-100">
                <img src={selectedRestaurant.image} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-6">
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-0.5">
                    {selectedRestaurant.name}
                  </h1>
                  <p className="text-white/70 text-xs font-medium">
                    {selectedRestaurant.category} · {(() => {
                      const t = realDistances?.[selectedRestaurant.id];
                      const travel = t ? (parseInt(t.durationText) || 0) : 0;
                      const prep = selectedRestaurant.prepTime ?? 30;
                      return travel > 0 ? `~${prep + travel} min` : `~${prep} min preparo`;
                    })()}
                  </p>
                </div>
              </div>

              {selectedRestaurant.menu.some(p => p.category) && (
                <div className="flex gap-2 overflow-x-auto pb-3 mb-5 no-scrollbar">
                  <button
                    onClick={() => setSelectedCategory('')}
                    className={`px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                      selectedCategory === ''
                        ? 'bg-orange-600 text-white'
                        : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                  >
                    Todos
                  </button>
                  {[...new Set(selectedRestaurant.menu.map(p => p.category).filter(Boolean))].map(
                    cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat as string)}
                        className={`px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                          selectedCategory === cat
                            ? 'bg-orange-600 text-white'
                            : 'bg-white text-gray-600 border border-gray-200'
                        }`}
                      >
                        {cat as string}
                      </button>
                    )
                  )}
                </div>
              )}

              {/* Busca de produtos */}
              <div className="relative mb-5 max-w-lg">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  className="w-full bg-white border border-gray-200 py-2.5 pl-10 pr-4 rounded-xl font-medium text-sm text-gray-700 outline-none focus:border-orange-300 transition-all"
                />
                {productSearch && (
                  <button
                    onClick={() => setProductSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Lista de produtos — layout horizontal simples */}
              <div className="divide-y divide-gray-100">
                {selectedRestaurant.menu
                  .filter(p => !selectedCategory || p.category === selectedCategory)
                  .filter(p =>
                    !productSearch ||
                    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                    (p.category && p.category.toLowerCase().includes(productSearch.toLowerCase()))
                  )
                  .map(product => {
                    const cartItem = cart.find(item => item.product.id === product.id);
                    const isUnavailable = product.available === false;
                    return (
                      <div
                        key={product.id}
                        className={`flex items-center gap-4 py-4 ${isUnavailable ? 'opacity-60' : ''}`}
                      >
                        {/* Imagem quadrada à esquerda */}
                        <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden shrink-0 relative">
                          <img
                            src={
                              product.image ||
                              'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'
                            }
                            className={`w-full h-full object-cover ${isUnavailable ? 'grayscale' : ''}`}
                          />
                          {isUnavailable && (
                            <div className="absolute inset-0 bg-gray-900/20 flex items-center justify-center">
                              <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide">
                                Esgotado
                              </span>
                            </div>
                          )}
                        </div>
                        {/* Nome, desc e preço à direita */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 text-sm leading-snug mb-0.5">
                            {product.name}
                          </h4>
                          {product.category && (
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{product.category}</p>
                          )}
                          <p className="font-black text-orange-600 text-base">
                            {product.price.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </p>
                        </div>
                        {/* Controles de quantidade ou botão adicionar */}
                        <div className="shrink-0">
                          {isUnavailable ? (
                            <span className="text-[9px] font-bold text-red-400 uppercase tracking-wide">
                              Indisponível
                            </span>
                          ) : cartItem ? (
                            <div className="flex items-center gap-2 bg-gray-50 px-2 py-1.5 rounded-xl border border-gray-100">
                              <button
                                onClick={() =>
                                  updateCartQuantity(product.id, cartItem.quantity - 1)
                                }
                                className="p-1 text-gray-500 hover:text-gray-900 transition-all"
                              >
                                <Minus size={13} />
                              </button>
                              <span className="font-black text-gray-900 text-xs w-4 text-center">
                                {cartItem.quantity}
                              </span>
                              <button
                                onClick={() =>
                                  updateCartQuantity(product.id, cartItem.quantity + 1)
                                }
                                className="p-1 text-gray-500 hover:text-gray-900 transition-all"
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAddToCart(product)}
                              className="bg-orange-600 text-white px-4 py-2 rounded-xl font-bold text-xs tracking-wide active:scale-95 transition-all"
                            >
                              {currentUserProfile ? 'Adicionar' : 'Entrar'}
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
              <h1 className="text-3xl font-black tracking-tight text-gray-900 mb-6">Meus Pedidos</h1>
              <div className="space-y-3 max-w-2xl">
                {orders.filter(o => o.customerId === currentUserProfile?.id).length > 0 ? (
                  orders
                    .filter(o => o.customerId === currentUserProfile?.id)
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map(order => {
                      const statusInfo = traduzirStatus(order.status);
                      const isActive = !['DELIVERED', 'CANCELLED', 'RETURNED'].includes(order.status);
                      const progressSteps = ['PENDING', 'PENDING_PAYMENT', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];
                      const stepLabels = ['Recebido', 'Pgto', 'Preparo', 'Pronto', 'Entrega'];
                      const currentStepIdx = progressSteps.indexOf(order.status);

                      // Contador regressivo: só existe após restaurante confirmar (PREPARING em diante)
                      const orderRestaurant = restaurants.find(r => r.id === order.restaurantId);
                      const prepMins = orderRestaurant?.prepTime ?? 30;
                      let travelMins = 15;
                      if (order.coords && orderRestaurant?.coords && calculateDistance) {
                        const distKm = calculateDistance(
                          orderRestaurant.coords.lat, orderRestaurant.coords.lng,
                          (order.coords as any).lat, (order.coords as any).lng
                        );
                        travelMins = Math.ceil(distKm * 1.35 * 3 + 5);
                      }
                      const totalEstMins = prepMins + travelMins;
                      const eta = order.confirmedAt ? order.confirmedAt + totalEstMins * 60 * 1000 : null;
                      const remainingMs = eta ? eta - now : null;
                      const isOverdue = remainingMs !== null && remainingMs < 0;
                      const remainingMins = remainingMs !== null ? Math.ceil(remainingMs / 60000) : null;
                      const showCountdown = isActive && eta !== null && !['PENDING', 'PENDING_PAYMENT'].includes(order.status);
                      return (
                        <div
                          key={order.id}
                          className={`bg-white rounded-2xl border transition-all ${
                            isActive ? 'border-orange-100' : 'border-gray-100'
                          }`}
                        >
                          <div className="p-5">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-black text-gray-900 text-base leading-tight truncate">
                                  {order.restaurantName}
                                </h3>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  #{order.id.slice(-6)} · {new Date(order.timestamp).toLocaleString('pt-BR', {
                                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                  })}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 ml-3 shrink-0">
                                <span className="font-black text-lg text-gray-900">
                                  R$ {order.total.toFixed(2)}
                                </span>
                                {order.status === OrderStatus.DELIVERED && (
                                  <button
                                    onClick={() => setReceiptOrder(order)}
                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-all active:scale-95"
                                    title="Ver comprovante"
                                  >
                                    <Receipt size={15} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Itens do pedido — lista simples */}
                            <div className="mb-3 space-y-0.5">
                              {order.items.slice(0, 3).map((item, i) => (
                                <p key={i} className="text-xs text-gray-500">
                                  {item.quantity}× {item.product.name}
                                </p>
                              ))}
                              {order.items.length > 3 && (
                                <p className="text-xs text-gray-400">+{order.items.length - 3} item(s)</p>
                              )}
                            </div>

                            <span
                              className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold ${statusInfo.color}`}
                            >
                              {statusInfo.label}
                            </span>

                            {/* Cancel button for recent pending orders */}
                            {[OrderStatus.PENDING, OrderStatus.PENDING_PAYMENT].includes(order.status as OrderStatus) &&
                              Date.now() - order.timestamp <= 3 * 60 * 1000 && (
                              <button
                                onClick={async () => {
                                  if (!window.confirm('Tem certeza que deseja cancelar este pedido?')) return;
                                  setCancellingOrderId(order.id);
                                  try {
                                    await cancelOrder?.(order.id);
                                  } catch (e: any) {
                                    alert(e.message || 'Erro ao cancelar pedido');
                                  } finally {
                                    setCancellingOrderId(null);
                                  }
                                }}
                                disabled={cancellingOrderId === order.id}
                                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-xs border border-red-100 active:scale-95 transition-all disabled:opacity-50"
                              >
                                {cancellingOrderId === order.id ? (
                                  <Loader size={13} className="animate-spin" />
                                ) : (
                                  <Ban size={13} />
                                )}
                                Cancelar Pedido (dentro de 3 min)
                              </button>
                            )}
                          </div>

                          {/* Progress indicator visual limpo para pedidos ativos */}
                          {isActive && (
                            <div className="px-5 pb-5">
                              <div className="flex items-center gap-0">
                                {progressSteps.map((s, idx) => {
                                  const done = idx <= currentStepIdx;
                                  const current = idx === currentStepIdx;
                                  const isLast = idx === progressSteps.length - 1;
                                  return (
                                    <React.Fragment key={s}>
                                      <div className="flex flex-col items-center gap-1">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                                          done
                                            ? 'bg-orange-500 border-orange-500'
                                            : 'bg-white border-gray-200'
                                        } ${current ? 'ring-2 ring-orange-200' : ''}`}>
                                          {done && <Check size={10} className="text-white" strokeWidth={3} />}
                                        </div>
                                        <span className={`text-[8px] font-bold uppercase tracking-wide ${done ? 'text-orange-600' : 'text-gray-300'}`}>
                                          {stepLabels[idx]}
                                        </span>
                                      </div>
                                      {!isLast && (
                                        <div className={`flex-1 h-0.5 mb-4 transition-all duration-500 ${
                                          idx < currentStepIdx ? 'bg-orange-400' : 'bg-gray-100'
                                        }`} />
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Contador regressivo de entrega */}
                          {showCountdown && (
                            <div className="mx-5 mb-4 rounded-xl p-4 flex items-center gap-3 bg-orange-50 border border-orange-100">
                              {isOverdue ? (
                                <>
                                  <span className="text-xl">🕐</span>
                                  <div>
                                    <p className="text-xs font-black text-orange-700">Aguarde, seu pedido está a caminho</p>
                                    <p className="text-[11px] text-orange-500 font-medium mt-0.5">
                                      Está demorando um pouquinho mais que o previsto. Já já chega!
                                    </p>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                                    <span className="text-base font-black text-orange-600">{remainingMins}</span>
                                  </div>
                                  <div>
                                    <p className="text-xs font-black text-orange-700">
                                      {order.status === 'OUT_FOR_DELIVERY' ? 'Chegando em' : 'Previsão de entrega em'}
                                    </p>
                                    <p className="text-[11px] text-orange-500 font-medium mt-0.5">
                                      {remainingMins === 1 ? 'menos de 1 minuto' : `~${remainingMins} minutos`}
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {/* Rastreamento do entregador em tempo real */}
                          {order.status === OrderStatus.OUT_FOR_DELIVERY && order.driverId && (() => {
                            const driver = profiles.find(p => p.id === order.driverId);
                            const driverLoc = driver?.currentLocation;
                            const custCoords = order.coords;
                            const distMeters = (driverLoc && custCoords)
                              ? calculateDistance(driverLoc.lat, driverLoc.lng, custCoords.lat, custCoords.lng) * 1000
                              : null;
                            const etaMins = distMeters !== null ? Math.max(1, Math.round(distMeters / 350)) : null; // ~21km/h moto urbana

                            return (
                              <div className="mx-5 mb-5 bg-purple-50 border border-purple-100 rounded-xl p-4 animate-in fade-in duration-500">
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="bg-purple-600 p-2 rounded-lg shrink-0">
                                    <Bike size={16} className="text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-purple-900 truncate">
                                      {driver?.name || 'Entregador'} está a caminho
                                    </p>
                                    <p className="text-[10px] text-purple-500 font-medium">
                                      {driver?.vehicleType || 'Veículo'} {driver?.licensePlate ? `· ${driver.licensePlate}` : ''}
                                    </p>
                                  </div>
                                  {driver?.phoneNumber && (
                                    <a
                                      href={`https://wa.me/55${driver.phoneNumber.replace(/\D/g, '')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-green-100 text-green-700 p-2 rounded-lg hover:bg-green-200 transition shrink-0"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                      </svg>
                                    </a>
                                  )}
                                </div>
                                {driverLoc ? (
                                  <>
                                    {/* Mapa em tempo real */}
                                    <DriverTrackingMap
                                      driverLoc={driverLoc}
                                      destCoords={custCoords ?? null}
                                    />
                                    {/* Distância e ETA abaixo do mapa */}
                                    {distMeters !== null && (
                                      <div className="flex items-center gap-3 bg-white rounded-lg p-3 mt-2">
                                        <MapPin size={14} className="text-purple-500 shrink-0" />
                                        <div>
                                          <p className="text-xs font-bold text-gray-800">
                                            {distMeters < 1000
                                              ? `${Math.round(distMeters)}m de você`
                                              : `${(distMeters / 1000).toFixed(1)}km de você`}
                                          </p>
                                          <p className="text-[10px] text-gray-400">
                                            Previsão: ~{etaMins} min
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="flex items-center gap-2 text-[10px] text-purple-400 font-medium">
                                    <Loader size={12} className="animate-spin" />
                                    Aguardando localização do entregador...
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })
                ) : (
                  <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                    <UtensilsCrossed size={36} className="mx-auto mb-3 text-gray-200" />
                    <p className="text-gray-400 text-sm mb-5">Nenhum pedido realizado ainda.</p>
                    <button
                      onClick={() => setActiveTab('home')}
                      className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold text-xs tracking-wide active:scale-95 transition-all"
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

      {/* CARRINHO FLUTUANTE */}
      {cart.length > 0 && !isCheckoutOpen && (
        <div className="fixed bottom-28 left-4 right-4 md:left-auto md:right-10 z-40 animate-in slide-in-from-bottom fade-in duration-500">
          <button
            onClick={() => {
              // 🔒 SEGURANÇA: Exige login antes de abrir checkout
              if (!currentUserProfile) {
                onOpenProfile();
                return;
              }
              setIsCheckoutOpen(true);
            }}
            className="w-full md:w-auto bg-orange-600 text-white font-bold py-4 px-5 md:px-7 rounded-xl flex items-center justify-between md:justify-center gap-4 hover:bg-orange-700 transition-all active:scale-[0.97] shadow-lg shadow-orange-200"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <ShoppingCart size={18} />
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className="text-[9px] uppercase tracking-widest opacity-80 mb-0.5">
                  {cart.reduce((acc, item) => acc + item.quantity, 0)} Itens
                </span>
                <span className="text-base font-black">
                  {cartTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold opacity-90">
              Ver Sacola <ChevronRight size={14} />
            </div>
          </button>
        </div>
      )}

      {/* BOTÃO FLUTUANTE DE SUPORTE VIA WHATSAPP */}
      {supportWhatsapp && !isCheckoutOpen && (
        <a
          href={`https://wa.me/55${supportWhatsapp}?text=${encodeURIComponent('Olá! Preciso de ajuda com um pedido no DeliveryCity.')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-28 left-6 z-40 bg-green-500 text-white p-4 rounded-full shadow-2xl shadow-green-300 flex items-center justify-center active:scale-90 hover:bg-green-400 transition-all md:hidden"
          title="Falar com o suporte"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      )}

      {/* NAVEGAÇÃO MOBILE FIXA (Z-INDEX 50 PARA FICAR POR CIMA DE TUDO) */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 px-8 pt-6 flex justify-around items-center z-50 md:hidden rounded-t-[2.5rem] shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
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
                {serviceFee > 0 && (
                  <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                    <span>Taxa de serviço</span>
                    <span className="text-gray-900">
                      {serviceFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
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
              <div className="grid grid-cols-2 gap-3 mb-6">
                {([
                  { method: 'CREDIT_CARD', label: 'Crédito', icon: <CreditCard size={18} /> },
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
              {selectedPayment === 'CREDIT_CARD' && (() => {
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

      {/* MODAL PIX — aguardando pagamento */}
      {pixModal && (
        <div className="fixed inset-0 z-[130] bg-gray-950/95 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-10 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-orange-500"></div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tighter mb-2">
              Pague com PIX
            </h2>
            <p className="text-gray-400 font-medium mb-6 text-sm">
              Escaneie o QR code ou copie o código abaixo. O pedido será confirmado automaticamente após o pagamento.
            </p>

            {pixModal.qrCodeImage ? (
              <img
                src={`data:image/png;base64,${pixModal.qrCodeImage}`}
                alt="QR Code PIX"
                className="w-56 h-56 mx-auto mb-6 rounded-2xl border-4 border-orange-100"
              />
            ) : (
              <div className="w-56 h-56 mx-auto mb-6 bg-orange-50 rounded-2xl flex items-center justify-center">
                <Wallet size={64} className="text-orange-300" />
              </div>
            )}

            <div className="bg-gray-50 rounded-2xl p-4 mb-6">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                Código PIX Copia e Cola
              </p>
              <p className="text-xs font-mono text-gray-700 break-all leading-relaxed">
                {pixModal.qrCode}
              </p>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(pixModal.qrCode).catch(() => {});
                alert('Código PIX copiado!');
              }}
              className="w-full bg-orange-500 hover:bg-orange-400 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest mb-3 transition-all active:scale-95"
            >
              Copiar Código PIX
            </button>

            <button
              onClick={() => {
                setPixModal(null);
                setActiveTab('orders');
              }}
              className="w-full bg-gray-100 text-gray-700 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all active:scale-95"
            >
              Ver Meus Pedidos
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
                <div
                  key={addr.id}
                  className={`w-full flex items-center gap-3 p-4 rounded-[2rem] border-2 transition-all ${selectedAddress?.id === addr.id ? 'border-orange-500 bg-orange-50 shadow-lg' : 'border-gray-50 bg-gray-50'}`}
                >
                  {/* Área clicável para selecionar o endereço */}
                  <button
                    onClick={() => handleSelectAddress(addr)}
                    className="flex items-center gap-4 flex-1 min-w-0 text-left active:scale-[0.98] transition-transform"
                  >
                    <div
                      className={`p-3 rounded-xl shadow-sm shrink-0 ${selectedAddress?.id === addr.id ? 'bg-orange-600 text-white' : 'bg-white text-gray-400'}`}
                    >
                      <MapPin size={20} />
                    </div>
                    <div className="overflow-hidden flex-1">
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

                  {/* Botões de ação: Editar e Excluir */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleEditAddress(addr)}
                      className="p-2 rounded-xl text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-95"
                      title="Editar endereço"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="p-2 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all active:scale-95"
                      title="Excluir endereço"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
              {(currentUserProfile?.savedAddresses?.length ?? 0) < 2 ? (
                <button
                  onClick={() => {
                    setEditingAddress(null);
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
              ) : (
                <p className="text-center text-[10px] font-black text-gray-300 uppercase tracking-widest py-2">
                  Limite de 2 endereços atingido · edite ou exclua um para adicionar outro
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      {isAddressModalOpen && (
        <AddressModal
          onClose={() => {
            setIsAddressModalOpen(false);
            if (editingAddress) {
              // Se estava editando e cancelou, volta pro seletor
              setEditingAddress(null);
              setIsAddressSelectorOpen(true);
            } else if (checkoutWasOpen) {
              // Se estava criando durante checkout, reabre o checkout
              setCheckoutWasOpen(false);
              setIsCheckoutOpen(true);
            }
          }}
          onSave={handleSaveAddress}
          initialAddress={editingAddress}
          title={editingAddress ? 'Editar Endereço' : 'Novo Endereço de Entrega'}
          saveButtonLabel={editingAddress ? 'Salvar Alterações' : 'Salvar Endereço'}
        />
      )}
      {/* RECEIPT MODAL */}
      {receiptOrder && (
        <div
          className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6 animate-in fade-in duration-300"
          onClick={() => setReceiptOrder(null)}
        >
          <div
            className="bg-white w-full md:max-w-md rounded-t-[3.5rem] md:rounded-[3.5rem] p-10 shadow-2xl animate-in slide-in-from-bottom duration-500 max-h-[85vh] flex flex-col relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-green-500" />
            <div className="flex justify-between items-center mb-8 shrink-0">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tighter">Comprovante</h3>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-0.5">
                  Pedido #{receiptOrder.id.slice(-6)}
                </p>
              </div>
              <button
                onClick={() => setReceiptOrder(null)}
                className="p-3 bg-gray-50 text-gray-400 rounded-full hover:bg-red-50 hover:text-red-500 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto no-scrollbar space-y-5">
              <div className="bg-gray-50 rounded-2xl p-5 space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Restaurante</p>
                <p className="font-black text-gray-900">{receiptOrder.restaurantName}</p>
                <p className="text-gray-400 text-xs font-bold">
                  {new Date(receiptOrder.timestamp).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Itens</p>
                {receiptOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm font-bold text-gray-700">
                    <span>{item.quantity}× {item.product.name}</span>
                    <span>{(item.product.price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 rounded-2xl p-5 space-y-2">
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Subtotal</span>
                  <span>{receiptOrder.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>Entrega</span>
                  <span>{receiptOrder.deliveryFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                {(receiptOrder.serviceFee ?? 0) > 0 && (
                  <div className="flex justify-between text-xs font-bold text-gray-500">
                    <span>Taxa de serviço</span>
                    <span>{receiptOrder.serviceFee!.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                )}
                <div className="h-px bg-gray-200 my-1" />
                <div className="flex justify-between font-black text-gray-900 text-lg">
                  <span>Total</span>
                  <span>{receiptOrder.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                  Pagamento: {receiptOrder.paymentMethod === 'CREDIT_CARD' ? 'Cartão de Crédito' : 'PIX'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-5">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Entregue em</p>
                <p className="font-bold text-sm text-gray-700">{receiptOrder.customerAddress}</p>
              </div>
            </div>
          </div>
        </div>
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
    </>
  );
};
