
import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import { OrderStatus, Product } from '../types';
import { Clock, CheckCircle, Utensils, Loader, LogOut, List, Store, LayoutDashboard, Plus, Edit2, Trash2, MapPin, Bike, User, Save, Package } from 'lucide-react';
import Logo from '../assets/Logo.png';
import Nome from '../assets/Nome.png';

export const RestaurantView: React.FC = () => {
  const { restaurants, orders, updateOrderStatus, updateMenu, updateRestaurant, updateProduct, deleteProduct, currentUserProfile, signOut } = useAppStore();
  
  const myRestaurant = restaurants.find(r => r.ownerId === currentUserProfile?.id);
  const myOrders = myRestaurant ? orders.filter(o => o.restaurantId === myRestaurant.id) : [];

  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'profile'>('orders');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null); 
  const [itemFormName, setItemFormName] = useState('');
  const [itemFormOwnerPrice, setItemFormOwnerPrice] = useState(''); 
  const [itemFormDesc, setItemFormDesc] = useState('');
  const [itemFormImage, setItemFormImage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [storeName, setStoreName] = useState(myRestaurant?.name || '');
  const [storeAddress, setStoreAddress] = useState(myRestaurant?.address || '');

  useEffect(() => {
    if (myRestaurant) {
      setStoreName(myRestaurant.name);
      setStoreAddress(myRestaurant.address || '');
    }
  }, [myRestaurant]);

  const resetMenuForm = () => {
    setEditingProduct(null); setItemFormName(''); setItemFormOwnerPrice(''); setItemFormDesc(''); setItemFormImage('');
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product); setItemFormName(product.name);
    const basePrice = product.ownerPrice || (product.price / 1.15);
    setItemFormOwnerPrice(basePrice.toFixed(2)); setItemFormDesc(product.description); setItemFormImage(product.image);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveItem = async () => {
    if(!myRestaurant || !itemFormName || !itemFormOwnerPrice) return;
    const ownerPrice = parseFloat(itemFormOwnerPrice);
    const finalPrice = ownerPrice * 1.15;
    const img = itemFormImage || `https://source.unsplash.com/random/400x400/?food,${itemFormName}`;

    try {
        if (editingProduct) await updateProduct(myRestaurant.id, editingProduct.id, { name: itemFormName, ownerPrice, price: Number(finalPrice.toFixed(2)), description: itemFormDesc, image: img });
        else await updateMenu(myRestaurant.id, { id: `p-${Date.now()}`, name: itemFormName, description: itemFormDesc, ownerPrice, price: Number(finalPrice.toFixed(2)), image: img });
        resetMenuForm();
        alert("Item salvo!");
    } catch(e) { alert("Erro ao salvar."); }
  };

  const handleUpdateStoreProfile = async () => {
      if (!myRestaurant) return;
      setIsSaving(true);
      try {
          await updateRestaurant(myRestaurant.id, { name: storeName, address: storeAddress });
          alert("Perfil atualizado!");
      } catch (e: any) { alert(e.message); }
      finally { setIsSaving(false); }
  };

  if (!myRestaurant) return <div className="h-screen flex items-center justify-center"><Loader className="animate-spin text-orange-600" /></div>;

  const getOrdersByStatus = (statusList: OrderStatus[]) => myOrders.filter(o => statusList.includes(o.status));

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col md:flex-row h-screen overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="hidden md:flex w-72 bg-gray-900 flex-col p-8 h-full text-white">
          <div className="flex items-center justify-center gap-2 mb-16">
              <img src={Logo} alt="Logo" className="h-10" />
              <img src={Nome} alt="DeliveryCity" className="h-5" />
          </div>
          <nav className="flex-1 space-y-3">
              {[
                { id: 'orders', label: 'Cozinha', icon: LayoutDashboard },
                { id: 'menu', label: 'Cardápio', icon: List },
                { id: 'profile', label: 'Minha Loja', icon: Store },
              ].map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`w-full flex items-center gap-5 p-4 rounded-[1.5rem] transition-all ${activeTab === item.id ? 'bg-orange-600 text-white shadow-xl shadow-orange-900/30' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                    <item.icon size={22}/> <span className="font-black text-sm">{item.label}</span>
                </button>
              ))}
          </nav>
          <button onClick={signOut} className="mt-auto flex items-center gap-5 p-5 text-gray-500 hover:text-red-400 transition-colors font-black text-sm"><LogOut size={22}/> Sair</button>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 md:p-12 no-scrollbar pb-24">
              {activeTab === 'orders' && (
                  <div className="h-full flex flex-col">
                      <header className="mb-12">
                          <h2 className="text-4xl font-black text-gray-900 tracking-tighter mb-2">Monitor de Cozinha</h2>
                          <div className="flex items-center gap-2 text-xs font-black text-green-600 uppercase tracking-widest">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/> Online - Recebendo Pedidos
                          </div>
                      </header>

                      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0 overflow-x-auto pb-4 no-scrollbar">
                          {/* COLUNA: PENDENTES */}
                          <div className="flex flex-col min-w-[320px] h-full">
                              <div className="flex items-center justify-between mb-6 px-4">
                                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3"><Clock size={16}/> Pendentes</h3>
                                  <span className="bg-orange-100 text-orange-600 text-[10px] font-black px-3 py-1 rounded-full">{getOrdersByStatus([OrderStatus.PENDING]).length}</span>
                              </div>
                              <div className="flex-1 bg-gray-200/40 rounded-[3rem] p-5 space-y-5 overflow-y-auto no-scrollbar border-2 border-dashed border-gray-200">
                                  {getOrdersByStatus([OrderStatus.PENDING]).map(order => (
                                      <div key={order.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm animate-in zoom-in-95 border border-gray-50">
                                          <div className="flex justify-between items-start mb-6">
                                              <span className="font-black text-gray-900 text-xl tracking-tighter">#{order.id.slice(-4)}</span>
                                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(order.timestamp).toLocaleTimeString()}</span>
                                          </div>
                                          <div className="space-y-3 mb-8 bg-gray-50 p-4 rounded-2xl">
                                              {order.items.map((item, idx) => (
                                                  <div key={idx} className="text-sm font-black text-gray-700">{item.quantity}x {item.product.name}</div>
                                              ))}
                                          </div>
                                          <button onClick={() => updateOrderStatus(order.id, OrderStatus.PREPARING)} className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all">Aceitar Pedido</button>
                                      </div>
                                  ))}
                              </div>
                          </div>

                          {/* COLUNA: PREPARANDO */}
                          <div className="flex flex-col min-w-[320px] h-full">
                              <div className="flex items-center justify-between mb-6 px-4">
                                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3"><Utensils size={16} className="text-blue-500"/> Na Cozinha</h3>
                                  <span className="bg-blue-100 text-blue-600 text-[10px] font-black px-3 py-1 rounded-full">{getOrdersByStatus([OrderStatus.PREPARING]).length}</span>
                              </div>
                              <div className="flex-1 bg-blue-50/50 rounded-[3rem] p-5 space-y-5 overflow-y-auto no-scrollbar border-2 border-dashed border-blue-100">
                                  {getOrdersByStatus([OrderStatus.PREPARING]).map(order => (
                                      <div key={order.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm animate-in zoom-in-95 border border-blue-50">
                                          <div className="flex justify-between items-start mb-6">
                                              <span className="font-black text-gray-900 text-xl tracking-tighter">#{order.id.slice(-4)}</span>
                                              <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest animate-pulse">Cozinhando</span>
                                          </div>
                                          <div className="space-y-3 mb-8 bg-gray-50 p-4 rounded-2xl">
                                              {order.items.map((item, idx) => (                                                  <div key={idx} className="text-sm font-black text-gray-700">{item.quantity}x {item.product.name}</div>
                                              ))}
                                          </div>
                                          <button onClick={() => updateOrderStatus(order.id, OrderStatus.READY)} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all">Marcar como Pronto</button>
                                      </div>
                                  ))}
                              </div>
                          </div>

                          {/* COLUNA: PRONTOS */}
                          <div className="flex flex-col min-w-[320px] h-full">
                              <div className="flex items-center justify-between mb-6 px-4">
                                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3"><CheckCircle size={16} className="text-green-500"/> Prontos</h3>
                                  <span className="bg-green-100 text-green-600 text-[10px] font-black px-3 py-1 rounded-full">{getOrdersByStatus([OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY]).length}</span>
                              </div>
                              <div className="flex-1 bg-green-50/50 rounded-[3rem] p-5 space-y-5 overflow-y-auto no-scrollbar border-2 border-dashed border-green-100">
                                  {getOrdersByStatus([OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY]).map(order => (
                                      <div key={order.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm animate-in zoom-in-95 border border-green-50">
                                          <div className="flex justify-between items-start mb-4">
                                              <span className="font-black text-gray-900 text-xl tracking-tighter">#{order.id.slice(-4)}</span>
                                              <div className="flex items-center gap-2">
                                                  <Bike size={16} className={order.driverId ? "text-green-500" : "text-gray-300"} />
                                                  <span className={`text-[9px] font-black uppercase tracking-widest ${order.driverId ? 'text-green-600' : 'text-orange-500'}`}>
                                                      {order.status === OrderStatus.OUT_FOR_DELIVERY ? 'Em Trânsito' : (order.driverId ? 'Entregador Chegando' : 'Buscando Motoboy')}
                                                  </span>
                                              </div>
                                          </div>
                                          <div className="bg-gray-50 p-4 rounded-2xl text-[10px] font-black text-gray-400 mb-2">
                                              CÓDIGO COLETA: <span className="text-lg text-gray-900 block mt-1 tracking-[4px]">{order.pickupCode}</span>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {activeTab === 'menu' && (
                  <div className="animate-in fade-in duration-500 max-w-7xl mx-auto">
                      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-16">
                          <div><h2 className="text-4xl font-black text-gray-900 tracking-tighter mb-2">Cardápio Digital</h2><p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Gestão completa de produtos.</p></div>
                          <button onClick={() => { resetMenuForm(); window.scrollTo(0,0); }} className="flex items-center gap-3 bg-orange-600 text-white px-8 py-5 rounded-[2rem] font-black text-sm shadow-2xl active:scale-95 transition-all"><Plus size={20}/> Novo Item</button>
                      </header>

                      <div className="flex flex-col xl:flex-row gap-12 items-start">
                          <div className="w-full xl:w-[450px] bg-white p-10 rounded-[3.5rem] shadow-sm border border-gray-100 sticky top-10 h-fit">
                                <h3 className="text-2xl font-black text-gray-900 mb-10 flex items-center gap-4">{editingProduct ? <Edit2 size={24}/> : <Plus size={24}/>} {editingProduct ? 'Editar' : 'Adicionar'}</h3>
                                <div className="space-y-8">
                                    <div className="space-y-3"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome do Prato</label><input value={itemFormName} onChange={e => setItemFormName(e.target.value)} className="w-full p-5 bg-gray-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-orange-100" placeholder="Ex: Burger Bacon" /></div>
                                    <div className="space-y-3"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Preço Sugerido (R$)</label><input type="number" value={itemFormOwnerPrice} onChange={e => setItemFormOwnerPrice(e.target.value)} className="w-full p-5 bg-gray-50 rounded-2xl font-black border-none outline-none focus:ring-2 focus:ring-orange-100" placeholder="0.00" /><p className="text-[10px] text-gray-400 font-bold italic leading-relaxed">* Adicionamos automaticamente 15% de comissão para a plataforma.</p></div>
                                    <div className="space-y-3"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Descrição</label><textarea value={itemFormDesc} onChange={e => setItemFormDesc(e.target.value)} className="w-full p-5 bg-gray-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-orange-100 min-h-[120px]" placeholder="Ingredientes e detalhes..." /></div>
                                    <button onClick={handleSaveItem} className="w-full bg-gray-900 text-white py-6 rounded-[2rem] font-black text-lg active:scale-95 transition-all shadow-xl">Salvar Item</button>
                                </div>
                          </div>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-8">
                              {myRestaurant.menu.map(item => (
                                  <div key={item.id} className="bg-white p-6 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col group hover:shadow-2xl transition-all h-full">
                                      <div className="relative h-48 rounded-[2.5rem] overflow-hidden mb-8">
                                          <img src={item.image} className="w-full h-full object-cover" />
                                          <div className="absolute top-4 right-4 flex gap-2">
                                              <button onClick={() => handleEditClick(item)} className="p-3 bg-white/90 backdrop-blur-sm text-blue-600 rounded-xl shadow-lg hover:bg-white transition"><Edit2 size={16}/></button>
                                              <button onClick={() => deleteProduct(myRestaurant.id, item.id)} className="p-3 bg-white/90 backdrop-blur-sm text-red-600 rounded-xl shadow-lg hover:bg-white transition"><Trash2 size={16}/></button>
                                          </div>
                                      </div>
                                      <h4 className="font-black text-gray-900 text-xl mb-2">{item.name}</h4>
                                      <p className="text-gray-400 text-xs font-bold line-clamp-2 mb-6">{item.description}</p>
                                      <div className="mt-auto border-t pt-6 flex justify-between items-center"><span className="font-black text-gray-900 text-2xl">R$ {item.price.toFixed(2)}</span></div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              )}

              {activeTab === 'profile' && (
                  <div className="max-w-3xl mx-auto py-10 animate-in zoom-in-95">
                      <div className="bg-white rounded-[4rem] p-12 shadow-sm border border-gray-100 text-center">
                          <img src={myRestaurant.image} className="w-56 h-56 rounded-[4.5rem] object-cover mx-auto mb-10 shadow-2xl border-8 border-white" />
                          <div className="space-y-6 text-left">
                              <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Nome Comercial</label><input value={storeName} onChange={e => setStoreName(e.target.value)} className="w-full p-5 bg-gray-50 rounded-[2rem] font-black text-xl border-none outline-none focus:ring-2 focus:ring-orange-100" /></div>
                              <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Endereço Público</label><input value={storeAddress} onChange={e => setStoreAddress(e.target.value)} className="w-full p-5 bg-gray-50 rounded-[2rem] font-bold border-none outline-none focus:ring-2 focus:ring-orange-100" /></div>
                              <button onClick={handleUpdateStoreProfile} disabled={isSaving} className="w-full bg-gray-900 text-white py-6 rounded-[2.5rem] font-black text-lg active:scale-95 transition-all shadow-xl">{isSaving ? <Loader className="animate-spin" /> : <Save />} Atualizar Loja</button>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      </main>
    </div>
  );
};
