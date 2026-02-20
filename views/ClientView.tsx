
import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase'; // Corrected import path
import { Restaurant, Product, Order, PaymentMethod, UserAddress, OrderStatus, OrderRating } from '../types';
import { ShoppingBag, Star, Plus, Minus, ChevronLeft, MapPin, Home, User, List, Search, X, ShoppingCart, ChevronRight, Package, CheckCircle2, UtensilsCrossed, ThumbsUp, ThumbsDown, Bike, PlusCircle, CreditCard, DollarSign, Smartphone } from 'lucide-react';
import { AddressModal } from '../components/AddressModal';
import Logo from '../assets/Logo.png';
import Nome from '../assets/Nome.png';

// Informa ao TypeScript sobre a existência do objeto PagSeguro no window
declare global {
  interface Window {
    PagSeguro: any;
  }
}

export const ClientView: React.FC<{ onOpenProfile: () => void }> = ({ onOpenProfile }) => {
  const store = useAppStore();
  const {
    restaurants = [], orders = [], currentUserProfile,
    createOrder, recalculateDistances, submitRating, addAddress
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

  const [ratingOrder, setRatingOrder] = useState<Order | null>(null);
  const [storeStars, setStoreStars] = useState(0);
  const [driverStars, setDriverStars] = useState(0);
  const [productOk, setProductOk] = useState<boolean | null>(null);
  const [packagingOk, setPackagingOk] = useState<boolean | null>(null);

  // PagSeguro Card State
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  useEffect(() => {
      if (currentUserProfile) {
          const pendingRating = orders.find(o => 
            o.customerId === currentUserProfile.id && 
            o.status === OrderStatus.DELIVERED && 
            !o.rating
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
  };

  const handleFinishRating = async () => {
      if (!ratingOrder || !submitRating) return;
      const finalRating: OrderRating = {
          storeStars,
          driverStars: driverStars || (productOk ? 5 : 4),
          productOk: productOk === true,
          packagingOk: packagingOk === true
      };
      await submitRating(ratingOrder.id, finalRating);
      setRatingOrder(null);
      setStoreStars(0); setDriverStars(0); setProductOk(null); setPackagingOk(null);
  };

  const filteredStores = useMemo(() => {
    return restaurants.filter(r => 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        r.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [restaurants, searchQuery]);

  const handleAddToCart = (product: Product) => {
    if (!selectedRestaurant) return;

    const restaurantOfCart = cart.length > 0 ? restaurants.find(r => r.menu.some(p => p.id === cart[0].product.id)) : null;

    if (restaurantOfCart && restaurantOfCart.id !== selectedRestaurant.id) {
      if (window.confirm("Seu carrinho contém itens de outro restaurante. Deseja limpá-lo para adicionar este item?")) {
        setCart([{ product, quantity: 1 }]);
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
      if (quantity <= 0) {
        return currentCart.filter(item => item.product.id !== productId);
      }
      return currentCart.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      );
    });
  };

  const cartSubtotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.product.price * item.quantity, 0);
  }, [cart]);

  const deliveryFee = useMemo(() => cartSubtotal > 0 ? 5.00 : 0, [cartSubtotal]);
  const cartTotal = cartSubtotal + deliveryFee;

  const handleFinalizeOrder = async () => {
    if (!currentUserProfile) { onOpenProfile(); return; }
    if (!selectedAddress) { setIsAddressSelectorOpen(true); return; }
    if (!selectedRestaurant || cart.length === 0 || !createOrder) return;

    setIsProcessing(true);

    try {
      if (selectedPayment === 'CREDIT_CARD') {
        // 1. Validar se a biblioteca do PagSeguro está disponível
        if (!window.PagSeguro) {
          throw new Error('Serviço de pagamento indisponível. Tente novamente mais tarde.');
        }

        // 2. Criptografar os dados do cartão
        const [expMonth, expYear] = cardExpiry.split('/');
        const card = window.PagSeguro.encryptCard({
          publicKey: 'SUA_CHAVE_PUBLICA_PAGSEGURO_SANDBOX', // <-- TROCAR!
          holder: cardHolder,
          number: cardNumber.replace(/\s/g, ''),
          expMonth: expMonth,
          expYear: `20${expYear}`,
          securityCode: cardCvv
        });

        if (card.hasErrors) {
            const error = card.errors[0];
            throw new Error(`Erro no cartão (${error.code}): ${error.message}. Verifique os dados.`);
        }

        const encryptedCard = card.encryptedCard;

        // 3. Montar o objeto do pedido para a Edge Function
        const items = cart.map(item => ({
            name: item.product.name,
            quantity: item.quantity,
            unit_amount: Math.round(item.product.price * 100)
        }));

        const customer = {
            name: currentUserProfile.name,
            email: currentUserProfile.email,
            tax_id: currentUserProfile.cpf || ''
        };
        
        const totalInCents = Math.round(cartTotal * 100);
        const appFeeInCents = 200; // Taxa de R$2,00 para a plataforma

        const charge = {
            reference_id: `order_${new Date().getTime()}`,
            amount: { value: totalInCents, currency: 'BRL' },
            payment_method: {
                type: 'CREDIT_CARD',
                installments: 1,
                capture: true,
                card: { encrypted: encryptedCard }
            },
            split: {
                rules: [
                    {
                        recipient: selectedRestaurant.pagseguroRecipientId, // ID do recebedor (restaurante)
                        liable: true,
                        charge_processing_fee: true,
                        amount: { value: totalInCents - appFeeInCents }
                    },
                    {
                        recipient: 'SEU_ID_DE_RECEBEDOR_PAGSEGURO', // <-- TROCAR! ID da sua conta de marketplace
                        liable: false,
                        charge_processing_fee: false,
                        amount: { value: appFeeInCents }
                    }
                ]
            }
        };
        
        // 4. Invocar a Supabase Edge Function
        const { data, error } = await supabase.functions.invoke('create-pagseguro-payment', {
          body: { items, customer, charge }
        });

        if (error || (data && data.error_messages)) {
            console.error('Erro ao invocar função ou erro do PagSeguro:', error, data?.error_messages);
            const pagseguroError = data?.error_messages?.[0]?.description || 'Não foi possível processar o pagamento.';
            throw new Error(pagseguroError);
        }

        // 5. Se tudo deu certo, criar o pedido no banco de dados local
        await createOrder(selectedRestaurant.id, cart, selectedPayment, `${selectedAddress.street}, ${selectedAddress.number}`, currentUserProfile.name, data.id, selectedAddress.coords);

      } else {
        // Lógica para outros métodos de pagamento (PIX, Dinheiro)
        await createOrder(selectedRestaurant.id, cart, selectedPayment, `${selectedAddress.street}, ${selectedAddress.number}`, currentUserProfile.name, undefined, selectedAddress.coords);
      }

      // Limpar e mostrar sucesso
      setCart([]);
      setCardNumber(''); setCardHolder(''); setCardExpiry(''); setCardCvv('');
      setIsCheckoutOpen(false);
      setShowOrderSuccess(true);

    } catch (error: any) {
      console.error('Erro ao finalizar pedido:', error);
      alert(`Ocorreu um erro: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleBackToRestaurants = () => {
    setSelectedRestaurant(null);
  }

  const renderPaymentIcon = (method: PaymentMethod) => {
    switch(method) {
      case 'CREDIT_CARD': return <CreditCard size={20}/>;
      case 'PIX': return <Smartphone size={20}/>;
      case 'CASH': return <DollarSign size={20}/>;
      default: return <CreditCard size={20}/>;
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row h-full overflow-x-hidden">
      
      {/* SIDEBAR */}
      <aside className="hidden md:flex w-72 bg-white border-r flex-col p-6 sticky top-0 h-screen z-30 shadow-sm">
        <div className="mb-12 flex items-center justify-center gap-2">
            <img src={Logo} alt="Logo" className="h-16 md:h-20 w-auto object-contain" />
        </div>
        <nav className="flex-1 space-y-2">
            <button onClick={() => {setActiveTab('home'); setSelectedRestaurant(null);}} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeTab === 'home' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}><Home size={24}/> <span>Início</span></button>
            <button onClick={() => setActiveTab('orders')} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeTab === 'orders' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}><List size={24}/> <span>Pedidos</span></button>
            <button onClick={onOpenProfile} className="w-full flex items-center gap-4 p-4 rounded-2xl text-gray-400 hover:bg-gray-50 transition-all"><User size={24}/> <span>Perfil</span></button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen pb-24 md:pb-0 relative z-10">
        <header className="bg-white border-b sticky top-0 z-30 px-4 md:px-6 py-4 flex justify-between items-center h-16 shadow-sm">
            <div className="flex items-center gap-3 overflow-hidden w-full max-w-2xl">
                {selectedRestaurant ? (
                  <button onClick={handleBackToRestaurants} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-all">
                    <ChevronLeft size={24} />
                  </button>
                ) : (
                  <div className="flex items-center gap-2 shrink-0 md:hidden">
                     <img src={Logo} alt="Logo" className="h-8" />
                  </div>
                )}
                
                <button onClick={handleAddressButtonClick} className="flex items-center gap-2 text-[11px] md:text-xs font-black truncate flex-1 bg-gray-50 hover:bg-orange-50 border border-gray-100 hover:border-orange-100 px-3 py-2 rounded-2xl transition-all group">
                    <MapPin size={16} className="text-orange-600 shrink-0 group-hover:scale-110 transition-transform"/> 
                    <div className="flex flex-col items-start truncate">
                        <span className="text-[8px] text-gray-400 uppercase tracking-widest leading-none mb-0.5">Entregar em</span>
                        <span className="truncate text-gray-800">
                          {selectedAddress ? `${selectedAddress.street}, ${selectedAddress.number}` : (currentUserProfile ? 'Onde entregar?' : 'Faça login para continuar')}
                        </span>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 shrink-0 ml-auto"/>
                </button>
            </div>
        </header>

        <div className="bg-[#F8F9FC] flex-1">
          <div className="p-6 md:p-10 w-full max-w-7xl mx-auto flex-1">
              {activeTab === 'home' && !selectedRestaurant && (
                  <div className="animate-in fade-in duration-500">
                      <div className="relative mb-8 max-w-2xl">
                          <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400"/>
                          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="O que vamos pedir hoje?" className="w-full bg-white border border-gray-200 p-5 pl-14 rounded-3xl font-bold text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-orange-300 shadow-sm transition-all"/>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {filteredStores.map(restaurant => (
                              <div key={restaurant.id} onClick={() => setSelectedRestaurant(restaurant)} className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1 active:scale-[0.98]">
                                  <div className="h-44 bg-gray-100 relative">
                                      <img src={restaurant.image} className="w-full h-full object-cover" />
                                      <div className="absolute top-4 right-4 bg-white/90 px-2 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 backdrop-blur-sm">
                                          {restaurant.rating.toFixed(1)} <Star size={12} className="fill-orange-500 text-orange-500"/>
                                      </div>
                                  </div>
                                  <div className="p-6">
                                      <h3 className="font-black text-gray-900 text-lg mb-1">{restaurant.name}</h3>
                                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{restaurant.category}</p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {activeTab === 'home' && selectedRestaurant && (
                <div className="animate-in fade-in duration-300">
                  <div className="mb-8">
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900">{selectedRestaurant.name}</h1>
                    <p className="text-gray-500">{selectedRestaurant.category}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {selectedRestaurant.menu.map(product => {
                      const cartItem = cart.find(item => item.product.id === product.id);
                      return (
                        <div key={product.id} className="bg-white rounded-3xl p-6 flex gap-6 shadow-sm border border-gray-100">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-800">{product.name}</h4>
                            <p className="text-xs text-gray-400 mb-3">{product.description}</p>
                            <p className="font-black text-gray-900">
                              {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>
                          {cartItem ? (
                              <div className="flex items-center gap-2">
                                  <button onClick={() => updateCartQuantity(product.id, cartItem.quantity - 1)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><Minus size={14}/></button>
                                  <span className="font-bold w-6 text-center">{cartItem.quantity}</span>
                                  <button onClick={() => updateCartQuantity(product.id, cartItem.quantity + 1)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><Plus size={14}/></button>
                              </div>
                          ) : (
                              <button onClick={() => handleAddToCart(product)} className="self-start p-3 bg-orange-50 text-orange-600 rounded-full hover:bg-orange-100 transition-all">
                                <Plus size={20}/>
                              </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              
              {activeTab === 'orders' && (
                <div className="animate-in fade-in duration-300">
                   <h1 className="text-4xl font-black tracking-tighter text-gray-900 mb-8">Meus Pedidos</h1>
                   <div className="space-y-6">
                        {orders.filter(o => o.customerId === currentUserProfile?.id).map(order => (
                            <div key={order.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h3 className="font-black text-lg text-gray-900">{order.restaurantName}</h3>
                                        <p className="text-[10px] font-bold text-gray-400">Pedido #{order.id.slice(-6)}</p>
                                    </div>
                                    <span className="font-black text-lg">R$ {order.total.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-orange-600 bg-orange-50 p-3 rounded-xl">
                                    <Package size={16}/><span>{order.status}</span>
                                </div>
                            </div>
                        ))}
                   </div>
                </div>
              )}
          </div>
        </div>
      </main>

      {/* FLOATING CART BUTTON */}
      {cart.length > 0 && (
        <div className="fixed bottom-28 md:bottom-10 right-6 md:right-10 z-50 animate-in slide-in-from-bottom fade-in">
          <button onClick={() => setIsCheckoutOpen(true)} className="bg-orange-600 text-white font-bold py-4 px-6 rounded-3xl shadow-2xl shadow-orange-300 flex items-center gap-4 hover:bg-orange-700 transition-all active:scale-95">
            <ShoppingCart size={20} />
            <span>Ver Sacola ({cart.reduce((acc, item) => acc + item.quantity, 0)})</span>
            <span className="h-6 w-px bg-orange-400"></span>
            <span>{cartTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </button>
        </div>
      )}

      {/* MODAL DE CHECKOUT */}
      {isCheckoutOpen && (
          <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in">
              <div className="bg-white w-full md:max-w-md rounded-t-[3rem] md:rounded-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col">
                  <div className="flex justify-between items-center mb-6 flex-shrink-0">
                      <h3 className="text-xl font-black text-gray-900 tracking-tighter">Revisar Pedido</h3>
                      <button onClick={() => setIsCheckoutOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition"><X size={20}/></button>
                  </div>
                  
                  <div className="overflow-y-auto no-scrollbar flex-1 mb-6">
                    <div className="space-y-4 mb-6">
                      {cart.map(item => (
                        <div key={item.product.id} className="flex items-center gap-4">
                          <img src={item.product.image} className="w-16 h-16 rounded-2xl object-cover" />
                          <div className="flex-1">
                            <p className="font-bold text-sm text-gray-800">{item.product.name}</p>
                            <p className="font-black text-gray-900 text-sm">{item.product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)} className="p-2 bg-gray-100 rounded-full"><Minus size={14}/></button>
                            <span className="font-bold w-5 text-center text-sm">{item.quantity}</span>
                            <button onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)} className="p-2 bg-gray-100 rounded-full"><Plus size={14}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="space-y-2 py-6 border-y">
                      <div className="flex justify-between items-center text-sm text-gray-500"><span>Subtotal</span><span className="font-medium text-gray-800">{cartSubtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                      <div className="flex justify-between items-center text-sm text-gray-500"><span>Taxa de Entrega</span><span className="font-medium text-gray-800">{deliveryFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                      <div className="flex justify-between items-center font-bold text-lg"><span>Total</span><span>{cartTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                    </div>

                    <div className="py-6">
                      <h4 className="font-bold text-sm mb-3">Forma de Pagamento</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {(['CREDIT_CARD', 'PIX', 'CASH'] as PaymentMethod[]).map(method => (
                          <button key={method} onClick={() => setSelectedPayment(method)} className={`p-4 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-all ${selectedPayment === method ? 'border-orange-500 bg-orange-50' : 'border-gray-100 bg-gray-50'}`}>
                            {renderPaymentIcon(method)}
                            <span className="text-[10px] font-bold">{method === 'CREDIT_CARD' ? 'Crédito' : method}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {selectedPayment === 'CREDIT_CARD' && (
                      <div className="pt-2 pb-6 space-y-3 animate-in fade-in">
                          <h4 className="font-bold text-sm">Dados do Cartão</h4>
                          <div>
                              <label className="text-[10px] font-bold text-gray-500 uppercase">Número do cartão</label>
                              <input
                                  value={cardNumber}
                                  onChange={e => setCardNumber(e.target.value)}
                                  placeholder="0000 0000 0000 0000"
                                  className="w-full p-4 bg-gray-50 rounded-xl mt-1 font-bold outline-none border-2 border-transparent focus:border-orange-500"
                              />
                          </div>
                          <div>
                              <label className="text-[10px] font-bold text-gray-500 uppercase">Nome do titular</label>
                              <input
                                  value={cardHolder}
                                  onChange={e => setCardHolder(e.target.value)}
                                  placeholder="Como está no cartão"
                                  className="w-full p-4 bg-gray-50 rounded-xl mt-1 font-bold outline-none border-2 border-transparent focus:border-orange-500"
                              />
                          </div>
                          <div className="flex gap-4">
                              <div className="flex-1">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase">Validade</label>
                                  <input
                                      value={cardExpiry}
                                      onChange={e => setCardExpiry(e.target.value)}
                                      placeholder="MM/AA"
                                      className="w-full p-4 bg-gray-50 rounded-xl mt-1 font-bold outline-none border-2 border-transparent focus:border-orange-500"
                                  />
                              </div>
                              <div className="flex-1">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase">CVV</label>
                                  <input
                                      value={cardCvv}
                                      onChange={e => setCardCvv(e.target.value)}
                                      placeholder="123"
                                      className="w-full p-4 bg-gray-50 rounded-xl mt-1 font-bold outline-none border-2 border-transparent focus:border-orange-500"
                                  />
                              </div>
                          </div>
                      </div>
                    )}
                  </div>

                  <button onClick={handleFinalizeOrder} disabled={isProcessing} className="w-full bg-gray-950 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all flex-shrink-0 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Processando...</span>
                      </>
                    ) : (
                      'Finalizar Pedido'
                    )}
                  </button>
              </div>
          </div>
      )}
      
      {/* MODAL DE SUCESSO DO PEDIDO */}
      {showOrderSuccess && (
         <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in">
             <div className="bg-white w-full max-w-md rounded-[4rem] p-12 text-center shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
                 <div className="w-24 h-24 bg-green-100 text-green-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                     <Bike size={44}/>
                 </div>
                 <h2 className="text-3xl font-black text-gray-900 tracking-tighter mb-2">Pedido a Caminho!</h2>
                 <p className="text-gray-500 font-medium mb-8 text-sm leading-relaxed">Seu pedido foi confirmado e o restaurante já está preparando. Você pode acompanhar o status na aba "Pedidos".</p>
                 <button onClick={() => { setShowOrderSuccess(false); setActiveTab('orders'); }} className="w-full bg-gray-950 text-white py-5 rounded-2xl font-black uppercase text-sm tracking-widest active:scale-95 transition-all">Acompanhar Pedido</button>
             </div>
         </div>
      )}

      {/* MODAIS DE ENDEREÇO E AVALIAÇÃO (JÁ EXISTENTES) */}
      {isAddressSelectorOpen && ( <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in"><div className="bg-white w-full md:max-w-md rounded-t-[3rem] md:rounded-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300"><div className="flex justify-between items-center mb-8"><h3 className="text-xl font-black text-gray-900 tracking-tighter">Escolha onde entregar</h3><button onClick={() => setIsAddressSelectorOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition"><X size={20}/></button></div><div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar mb-8">{currentUserProfile?.savedAddresses?.map((addr) => (<button key={addr.id} onClick={() => handleSelectAddress(addr)} className={`w-full flex items-center gap-4 p-5 rounded-[2rem] border-2 transition-all ${selectedAddress?.id === addr.id ? 'border-orange-500 bg-orange-50 shadow-inner' : 'border-gray-50 bg-gray-50 hover:border-orange-100'}`}><div className={`p-3 rounded-2xl ${selectedAddress?.id === addr.id ? 'bg-orange-600 text-white' : 'bg-white text-gray-400'}`}><MapPin size={20}/></div><div className="text-left overflow-hidden"><p className="font-black text-gray-900 text-sm truncate">{addr.street}, {addr.number}</p><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">{addr.neighborhood || 'Centro'}</p></div>{selectedAddress?.id === addr.id && <CheckCircle2 size={20} className="ml-auto text-orange-600 shrink-0"/>}</button>))}<button onClick={() => { setIsAddressSelectorOpen(false); setIsAddressModalOpen(true); }} className="w-full flex items-center gap-4 p-5 rounded-[2rem] border-2 border-dashed border-gray-200 text-gray-400 hover:border-orange-200 hover:text-orange-600 transition-all group"><div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-orange-50"><PlusCircle size={20}/></div><span className="font-black text-xs uppercase tracking-widest">Adicionar novo endereço</span></button></div></div></div> )}
      {isAddressModalOpen && ( <AddressModal onClose={() => setIsAddressModalOpen(false)} onSave={handleAddNewAddress} title="Novo Endereço de Entrega"/> )}
      {ratingOrder && ( <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in"><div className="bg-white w-full max-w-md rounded-[4rem] p-12 text-center shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden"><div className="absolute top-0 left-0 w-full h-2 bg-orange-600"></div><div className="w-24 h-24 bg-orange-100 text-orange-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner"><Package size={44}/></div><h2 className="text-3xl font-black text-gray-900 tracking-tighter mb-2">Pedido Entregue!</h2><p className="text-gray-400 font-bold mb-12 text-sm leading-relaxed">Avalie sua experiência com a <span className="text-gray-900">{ratingOrder.restaurantName}</span></p><div className="flex justify-center gap-4 mb-14">{[1,2,3,4,5].map(star => (<button key={star} onClick={() => setStoreStars(star)} className={`transition-all duration-300 transform ${storeStars >= star ? 'scale-125' : 'scale-100 opacity-20 hover:opacity-50'}`}><Star size={48} className="fill-orange-500 text-orange-500" /></button>))}</div>{storeStars > 0 && (<div className="space-y-10 animate-in slide-in-from-bottom duration-500"><div className="grid grid-cols-2 gap-4"><div className="space-y-3"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Produto OK?</p><div className="flex gap-2"><button onClick={() => setProductOk(true)} className={`flex-1 py-4 rounded-2xl transition-all ${productOk === true ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400'}`}><ThumbsUp size={18}/></button><button onClick={() => setProductOk(false)} className={`flex-1 py-4 rounded-2xl transition-all ${productOk === false ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400'}`}><ThumbsDown size={18}/></button></div></div><div className="space-y-3"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Embalagem OK?</p><div className="flex gap-2"><button onClick={() => setPackagingOk(true)} className={`flex-1 py-4 rounded-2xl transition-all ${packagingOk === true ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400'}`}><ThumbsUp size={18}/></button><button onClick={() => setPackagingOk(false)} className={`flex-1 py-4 rounded-2xl transition-all ${packagingOk === false ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400'}`}><ThumbsDown size={18}/></button></div></div></div><button onClick={handleFinishRating} className="w-full bg-gray-950 text-white py-6 rounded-[2.5rem] font-black uppercase text-sm tracking-widest active:scale-95 transition-all shadow-2xl">Finalizar Feedback</button></div>)}</div></div> )}
      
      {/* NAVEGAÇÃO MOBILE */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-around items-center z-40 md:hidden shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
          <button onClick={() => {setActiveTab('home'); setSelectedRestaurant(null);}} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-orange-600' : 'text-gray-400 hover:text-gray-900'}`}>
              <Home size={24}/>
              <span className="text-[8px] font-black uppercase tracking-widest">Início</span>
          </button>
          <button onClick={() => setActiveTab('orders')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'orders' ? 'text-orange-600' : 'text-gray-400 hover:text-gray-900'}`}>
              <List size={24}/>
              <span className="text-[8px] font-black uppercase tracking-widest">Pedidos</span>
          </button>
          <button onClick={onOpenProfile} className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-900 transition-colors">
              <User size={24}/>
              <span className="text-[8px] font-black uppercase tracking-widest">Perfil</span>
          </button>
      </nav>
    </div>
  );
};
