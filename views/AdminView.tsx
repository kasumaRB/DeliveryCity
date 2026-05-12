import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../store';
import {
  Users,
  Shield,
  Search,
  LogOut,
  LayoutDashboard,
  Eye,
  Save,
  DollarSign,
  RefreshCw,
  Loader,
  Play,
  X,
  Clock,
  Store,
  Bike,
  Terminal,
  Menu,
  Trash2,
  Wallet,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import Logo from '../assets/Logo.png';

const AdminSidebar: React.FC<{
  activeTab: string;
  onTabClick: (tab: any) => void;
  onSignOut: () => void;
  profiles: UserProfile[];
}> = ({ activeTab, onTabClick, onSignOut, profiles }) => (
  <aside className="bg-gray-900 flex flex-col h-full border-r border-gray-800">
    <div className="p-8 flex items-center justify-center">
      <img src={Logo} alt="Logo" className="h-16 md:h-20 w-auto object-contain" />
    </div>
    <nav className="flex-1 px-4 space-y-2">
      {[
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'users', label: 'Usuários', icon: Users },
        {
          id: 'requests',
          label: 'Solicitações',
          icon: Clock,
          badge: profiles.filter(p => p.status === 'PENDING').length,
        },
        { id: 'partners', label: 'Parceiros', icon: Store },
        { id: 'support', label: 'Suporte', icon: MessageSquare },
        { id: 'settings', label: 'Configurações', icon: DollarSign },
        { id: 'system', label: 'Status & Logs', icon: Terminal },
      ].map(item => (
        <button
          key={item.id}
          onClick={() => onTabClick(item.id as any)}
          className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === item.id ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-400 hover:bg-white/5'}`}
        >
          <div className="flex items-center gap-4">
            <item.icon size={20} /> {item.label}
          </div>
          {(item.badge ?? 0) > 0 && (
            <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full">
              {item.badge}
            </span>
          )}
        </button>
      ))}
    </nav>
    <div className="p-6 border-t border-gray-800">
      <button
        onClick={onSignOut}
        className="w-full flex items-center gap-4 text-gray-500 font-black text-sm p-4 hover:text-red-400 transition-colors"
      >
        <LogOut size={20} /> Sair
      </button>
    </div>
  </aside>
);

export const AdminView: React.FC = () => {
  const {
    profiles,
    updateUserProfile,
    deleteUserProfile,
    isSupabaseConnected,
    signOut,
    refreshData,
    loginAsTestUser,
    orders,
    restaurants,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'users' | 'requests' | 'partners' | 'support' | 'settings' | 'system'
  >('dashboard');
  const [userSearch, setUserSearch] = useState('');
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [approvalLoading, setApprovalLoading] = useState<
    Record<string, 'approving' | 'blocking' | null>
  >({});
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'support') {
      fetchSupportTickets();
    }
  }, [activeTab]);

  const fetchSupportTickets = async () => {
    console.log('[DEBUG] fetchSupportTickets chamado');
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[DEBUG] Erro ao buscar tickets de suporte:', error);
      } else {
        console.log('[DEBUG] Tickets de suporte encontrados:', data?.length || 0);
        if (data) setSupportTickets(data);
      }
    } catch (err) {
      console.error('[DEBUG] Erro inesperado ao buscar tickets:', err);
    }
  };

  const handleUpdateDossier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingUser) return;
    setIsSaving(true);
    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement);
      await updateUserProfile(viewingUser.id, {
        name: formData.get('name') as string,
        cpf: formData.get('cpf') as string,
        cnpj: formData.get('cnpj') as string,
        licensePlate: formData.get('licensePlate') as string,
        phoneNumber: formData.get('phone') as string,
        status: formData.get('status') as any,
        pixKey: formData.get('pixKey') as string,
        businessName: formData.get('businessName') as string,
        workingHours: formData.get('workingHours') as string,
        description: formData.get('description') as string,
        pagseguroRecipientId: formData.get('pagseguroRecipientId') as string,
      });
      alert('Alterações salvas com sucesso!');
      setViewingUser(null);
    } catch (e: any) {
      alert(`Erro ao salvar: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!viewingUser?.email) return;
    if (!confirm(`Enviar link de redefinição de senha para ${viewingUser.email}?`)) return;
    setResetPasswordLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(viewingUser.email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      alert('E-mail de redefinição enviado com sucesso!');
    } catch (e: any) {
      alert(`Erro ao enviar: ${e.message}`);
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const filteredProfiles = useMemo(() => {
    return profiles.filter(
      p =>
        p.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        p.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
        p.businessName?.toLowerCase().includes(userSearch.toLowerCase())
    );
  }, [profiles, userSearch]);

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex font-sans">
      <div className="w-72 hidden md:block h-screen sticky top-0">
        <AdminSidebar
          activeTab={activeTab}
          onTabClick={t => setActiveTab(t)}
          onSignOut={signOut}
          profiles={profiles}
        />
      </div>

      {isMenuOpen && (
        <div className="fixed inset-0 z-[110] md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
          ></div>
          <div className="relative w-72 h-full bg-gray-900 shadow-xl animate-in slide-in-from-left duration-300">
            <AdminSidebar
              activeTab={activeTab}
              onTabClick={t => {
                setActiveTab(t);
                setIsMenuOpen(false);
              }}
              onSignOut={signOut}
              profiles={profiles}
            />
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col md:h-screen overflow-hidden">
        <header className="h-20 bg-white border-b flex items-center justify-between px-6 md:px-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-2 text-gray-500">
              <Menu size={24} />
            </button>
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
              {activeTab}
            </h2>
          </div>
          <button
            onClick={() => refreshData()}
            className="p-3 text-gray-400 hover:text-purple-600 bg-gray-50 rounded-xl transition-all"
          >
            <RefreshCw size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 no-scrollbar pb-32">
          {activeTab === 'dashboard' && (() => {
            const today = new Date(); today.setHours(0,0,0,0);
            const todayOrders = orders.filter(o => new Date(o.timestamp).getTime() >= today.getTime());
            const deliveredOrders = orders.filter(o => o.status === 'DELIVERED');
            const totalRevenue = deliveredOrders.reduce((s, o) => s + o.total, 0);
            const platformRevenue = deliveredOrders.reduce((s, o) => s + (o.platformFee || 0), 0);
            const avgTicket = deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0;
            const completionRate = orders.length > 0
              ? Math.round((deliveredOrders.length / orders.length) * 100) : 0;
            const pendingApprovals = profiles.filter(p => (p.status as any) === 'PENDING').length;
            const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            return (
              <div className="space-y-8 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-gray-900 tracking-tighter">Visão Geral</h3>
                  {pendingApprovals > 0 && (
                    <button
                      onClick={() => setActiveTab('users')}
                      className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest animate-pulse"
                    >
                      <span className="w-2 h-2 bg-amber-500 rounded-full" />
                      {pendingApprovals} aprovação{pendingApprovals > 1 ? 'ões' : ''} pendente{pendingApprovals > 1 ? 's' : ''}
                    </button>
                  )}
                </div>

                {/* KPIs - Linha 1: Contadores */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
                      <Users size={22} />
                    </div>
                    <p className="text-3xl font-black text-gray-900">{profiles.length}</p>
                    <p className="text-xs font-bold text-gray-400 mt-1">Usuários Cadastrados</p>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4">
                      <Store size={22} />
                    </div>
                    <p className="text-3xl font-black text-gray-900">{restaurants.length}</p>
                    <p className="text-xs font-bold text-gray-400 mt-1">Lojas Ativas</p>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                    <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center mb-4">
                      <Bike size={22} />
                    </div>
                    <p className="text-3xl font-black text-gray-900">{profiles.filter(p => p.role === 'DRIVER').length}</p>
                    <p className="text-xs font-bold text-gray-400 mt-1">Entregadores</p>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                      <LayoutDashboard size={22} />
                    </div>
                    <p className="text-3xl font-black text-gray-900">{todayOrders.length}</p>
                    <p className="text-xs font-bold text-gray-400 mt-1">Pedidos Hoje</p>
                  </div>
                </div>

                {/* KPIs - Linha 2: Financeiro */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-green-100">
                    <p className="text-xs font-black uppercase tracking-widest text-green-100 mb-3">GMV Total (Volume)</p>
                    <p className="text-4xl font-black">{fmt(totalRevenue)}</p>
                    <p className="text-green-100 text-xs font-bold mt-2">{deliveredOrders.length} pedidos entregues</p>
                  </div>
                  <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-purple-100">
                    <p className="text-xs font-black uppercase tracking-widest text-purple-100 mb-3">Receita Plataforma</p>
                    <p className="text-4xl font-black">{fmt(platformRevenue)}</p>
                    <p className="text-purple-100 text-xs font-bold mt-2">Taxa de 15% sobre subtotal</p>
                  </div>
                  <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Ticket Médio</p>
                        <p className="text-3xl font-black text-gray-900">{fmt(avgTicket)}</p>
                      </div>
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <TrendingUp size={20} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <span className="text-xs font-bold text-gray-400">Taxa de conclusão</span>
                      <span className={`text-sm font-black ${completionRate >= 80 ? 'text-green-600' : completionRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {completionRate}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${completionRate}%` }} />
                    </div>
                  </div>
                </div>

                {/* Pedidos recentes */}
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-8 pb-4 flex items-center justify-between">
                    <h4 className="text-lg font-black text-gray-900">Pedidos Recentes</h4>
                    <button onClick={() => setActiveTab('orders')} className="text-xs font-black text-orange-600 uppercase tracking-widest hover:underline">
                      Ver todos →
                    </button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {orders.slice(0, 6).map(o => {
                      const statusMap: Record<string,{label:string;color:string}> = {
                        PENDING: {label:'Aguardando', color:'text-yellow-600 bg-yellow-50'},
                        PREPARING: {label:'Preparando', color:'text-blue-600 bg-blue-50'},
                        READY: {label:'Pronto', color:'text-green-600 bg-green-50'},
                        OUT_FOR_DELIVERY: {label:'Em Entrega', color:'text-purple-600 bg-purple-50'},
                        DELIVERED: {label:'Entregue', color:'text-gray-600 bg-gray-100'},
                        CANCELLED: {label:'Cancelado', color:'text-red-600 bg-red-50'},
                      };
                      const s = statusMap[o.status] || {label: o.status, color:'text-gray-500 bg-gray-100'};
                      return (
                        <div key={o.id} className="px-8 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                          <div>
                            <p className="font-black text-gray-900 text-sm">{o.restaurantName}</p>
                            <p className="text-gray-400 text-xs">{o.customerName} • #{o.id.slice(-6)}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${s.color}`}>{s.label}</span>
                            <span className="font-black text-gray-900 text-sm">{fmt(o.total)}</span>
                          </div>
                        </div>
                      );
                    })}
                    {orders.length === 0 && (
                      <p className="px-8 py-8 text-gray-400 text-sm font-bold text-center">Nenhum pedido ainda.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {(activeTab === 'users' || activeTab === 'partners') && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h3 className="text-2xl font-black text-gray-900 tracking-tighter">
                  {activeTab === 'users' ? 'Gestão de Contas' : 'Parceiros de Negócio'}
                </h3>
                <div className="relative w-full md:max-w-md">
                  <Search
                    className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                  <input
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="Pesquisar..."
                    className="w-full p-5 pl-14 bg-white border border-gray-100 rounded-2xl font-bold shadow-sm outline-none"
                  />
                </div>
              </div>
              <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-x-auto shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50/70 border-b border-gray-100">
                    <tr>
                      <th className="px-8 py-5 font-black text-gray-400 text-xs uppercase tracking-widest">
                        Usuário / Negócio
                      </th>
                      <th className="px-8 py-5 font-black text-gray-400 text-xs uppercase tracking-widest">
                        Papel
                      </th>
                      <th className="px-8 py-5 font-black text-gray-400 text-xs uppercase tracking-widest">
                        Status
                      </th>
                      <th className="px-8 py-5 font-black text-gray-400 text-xs uppercase tracking-widest text-center">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredProfiles
                      .filter(p =>
                        activeTab === 'users'
                          ? p.role === UserRole.CLIENT
                          : p.role !== UserRole.CLIENT
                      )
                      .map(p => (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-8 py-6">
                            <div className="font-black text-gray-900">
                              {p.businessName || p.name}
                            </div>
                            <div className="text-[10px] text-gray-500 font-bold">{p.email}</div>
                          </td>
                          <td className="px-8 py-6">
                            <span
                              className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${p.role === UserRole.RESTAURANT ? 'bg-orange-50 text-orange-600' : p.role === UserRole.DRIVER ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}
                            >
                              {p.role}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <span
                              className={`font-bold text-[10px] ${p.status === 'APPROVED' ? 'text-green-600' : 'text-orange-500'}`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex justify-center gap-3">
                              <button
                                onClick={() => setViewingUser(p)}
                                className="p-3 text-gray-400 bg-gray-100 rounded-xl hover:text-purple-600 transition-all shadow-sm"
                              >
                                <Eye size={18} />
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm('Apagar usuário?')) deleteUserProfile(p.id);
                                }}
                                disabled={p.role === UserRole.ADMIN}
                                className="p-3 text-red-400 bg-red-50 rounded-xl hover:bg-red-600 hover:text-white transition-all disabled:opacity-20 shadow-sm"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-gray-900 tracking-tighter">
                  Fila de Aprovação
                </h3>
                <div className="flex items-center gap-2 text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-4 py-2 rounded-full">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block"></span>
                  Tempo Real
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {profiles.filter(p => p.status === 'PENDING').length === 0 ? (
                  <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100 text-gray-300 font-black uppercase tracking-widest text-xs">
                    Nenhuma solicitação pendente
                  </div>
                ) : (
                  profiles
                    .filter(p => p.status === 'PENDING')
                    .map(p => {
                      const isProcessing = !!approvalLoading[p.id];
                      const handleApproval = async (status: 'APPROVED' | 'BLOCKED') => {
                        setApprovalLoading(prev => ({
                          ...prev,
                          [p.id]: status === 'APPROVED' ? 'approving' : 'blocking',
                        }));
                        try {
                          await updateUserProfile(p.id, { status: status as any });
                          if (status === 'APPROVED' && p.role === UserRole.RESTAURANT) {
                            const restaurantId = `rest-${p.id}`;
                            const { data: existing } = await supabase
                              .from('restaurants')
                              .select('id')
                              .eq('id', restaurantId)
                              .single();
                            if (existing) {
                              await supabase
                                .from('restaurants')
                                .update({ is_active: true })
                                .eq('id', restaurantId);
                            }
                          }
                        } catch (err: any) {
                          alert(`Erro ao atualizar parceiro: ${err.message || 'Tente novamente.'}`);
                        } finally {
                          setApprovalLoading(prev => ({ ...prev, [p.id]: null }));
                        }
                      };
                      return (
                        <div
                          key={p.id}
                          className="bg-white p-8 rounded-[2.5rem] border border-orange-100 shadow-sm animate-in zoom-in-95 relative overflow-hidden"
                        >
                          {/* Badge NOVO piscando */}
                          <span className="absolute top-5 right-5 bg-orange-500 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">
                            Novo
                          </span>

                          <div className="flex items-center gap-4 mb-6">
                            <div
                              className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${p.role === UserRole.RESTAURANT ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}
                            >
                              {p.role === UserRole.RESTAURANT ? (
                                <Store size={24} />
                              ) : (
                                <Bike size={24} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-black text-gray-900 text-lg truncate">
                                {p.businessName || p.name}
                              </h4>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                {p.role === UserRole.RESTAURANT ? 'Lojista' : 'Entregador'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="bg-gray-50 p-4 rounded-2xl">
                              <p className="text-[8px] font-black text-gray-400 uppercase mb-1">
                                Nome
                              </p>
                              <p className="font-black text-xs truncate">{p.name || '---'}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-2xl">
                              <p className="text-[8px] font-black text-gray-400 uppercase mb-1">
                                WhatsApp
                              </p>
                              <p className="font-black text-xs">{p.phoneNumber || '---'}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-2xl">
                              <p className="text-[8px] font-black text-gray-400 uppercase mb-1">
                                Documento
                              </p>
                              <p className="font-black text-xs truncate">
                                {p.cpf || p.cnpj || '---'}
                              </p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-2xl">
                              <p className="text-[8px] font-black text-gray-400 uppercase mb-1">
                                {p.role === UserRole.DRIVER ? 'Placa' : 'E-mail'}
                              </p>
                              <p className="font-black text-xs truncate">
                                {p.role === UserRole.DRIVER ? p.licensePlate || '---' : p.email}
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <button
                              onClick={() => handleApproval('APPROVED')}
                              disabled={isProcessing}
                              className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                              {approvalLoading[p.id] === 'approving' ? (
                                <Loader size={14} className="animate-spin" />
                              ) : null}
                              Aprovar
                            </button>
                            <button
                              onClick={() => handleApproval('BLOCKED')}
                              disabled={isProcessing}
                              className="px-6 bg-red-50 text-red-600 rounded-2xl font-black text-xs uppercase transition-all shadow-sm active:scale-95 disabled:opacity-60 flex items-center justify-center"
                            >
                              {approvalLoading[p.id] === 'blocking' ? (
                                <Loader size={14} className="animate-spin" />
                              ) : (
                                <X size={18} />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}

          {activeTab === 'support' && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-2xl font-black text-gray-900 tracking-tighter">
                Tickets de Suporte
              </h3>
              <div className="space-y-4">
                {supportTickets.map(ticket => (
                  <div
                    key={ticket.id}
                    className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[9px] font-black bg-orange-100 text-orange-600 px-3 py-1 rounded-full uppercase tracking-widest mb-2 inline-block">
                          {ticket.user_role}
                        </span>
                        <h4 className="font-black text-gray-900">{ticket.user_name}</h4>
                      </div>
                      <span className="text-[10px] text-gray-400 font-bold">
                        {new Date(ticket.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 font-medium bg-gray-50 p-4 rounded-2xl">
                      {ticket.message}
                    </p>
                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={() => window.open(`https://wa.me/55${ticket.user_id}`, '_blank')}
                        className="text-[10px] font-black uppercase text-green-600 hover:underline"
                      >
                        Responder via WhatsApp
                      </button>
                      <button
                        onClick={async () => {
                          await supabase.from('support_tickets').delete().eq('id', ticket.id);
                          fetchSupportTickets();
                        }}
                        className="text-[10px] font-black uppercase text-red-400 hover:underline ml-auto"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (() => {
            const [settings, setSettings] = React.useState({
              platform_fee_pct: 15,
              driver_fee_pct: 8,
              restaurant_fee_pct: 8,
              min_delivery_fee: 4.0,
              min_order_value: 15.0,
            });
            const [settingsLoading, setSettingsLoading] = React.useState(true);
            const [settingsSaving, setSettingsSaving] = React.useState(false);
            const [settingsMsg, setSettingsMsg] = React.useState('');

            React.useEffect(() => {
              supabase.from('platform_settings').select('*').single().then(({ data }) => {
                if (data) setSettings({
                  platform_fee_pct: data.platform_fee_pct ?? 15,
                  driver_fee_pct: data.driver_fee_pct ?? 8,
                  restaurant_fee_pct: data.restaurant_fee_pct ?? 8,
                  min_delivery_fee: data.min_delivery_fee ?? 4.0,
                  min_order_value: data.min_order_value ?? 15.0,
                });
                setSettingsLoading(false);
              });
            }, []);

            const handleSaveSettings = async () => {
              setSettingsSaving(true);
              try {
                const { error } = await supabase.from('platform_settings').upsert({
                  id: 1,
                  ...settings,
                  updated_at: new Date().toISOString(),
                });
                if (error) throw error;
                setSettingsMsg('✅ Configurações salvas com sucesso!');
              } catch (e: any) {
                setSettingsMsg('❌ Erro ao salvar: ' + e.message);
              } finally {
                setSettingsSaving(false);
                setTimeout(() => setSettingsMsg(''), 4000);
              }
            };

            const totalPct = settings.driver_fee_pct + settings.restaurant_fee_pct;
            const platformNet = settings.platform_fee_pct - totalPct;

            return (
              <div className="max-w-3xl mx-auto animate-in fade-in space-y-8">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tighter mb-1">Configurações Financeiras</h3>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Split de pagamento e limites da plataforma</p>
                </div>

                {settingsLoading ? (
                  <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin" /></div>
                ) : (
                  <>
                    {/* Divisão visual do split */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
                      <h4 className="font-black text-gray-700 mb-6 flex items-center gap-2">
                        <DollarSign size={18} className="text-purple-500" /> Divisão do Pagamento
                      </h4>
                      <div className="mb-6">
                        <div className="flex h-6 rounded-full overflow-hidden gap-0.5">
                          <div className="bg-orange-500 transition-all flex items-center justify-center text-white text-[9px] font-black" style={{ width: `${settings.restaurant_fee_pct}%` }}>
                            {settings.restaurant_fee_pct}%
                          </div>
                          <div className="bg-green-500 transition-all flex items-center justify-center text-white text-[9px] font-black" style={{ width: `${settings.driver_fee_pct}%` }}>
                            {settings.driver_fee_pct}%
                          </div>
                          <div className="bg-purple-600 transition-all flex items-center justify-center text-white text-[9px] font-black flex-1">
                            {(100 - settings.restaurant_fee_pct - settings.driver_fee_pct)}%
                          </div>
                        </div>
                        <div className="flex justify-between mt-3 text-[10px] font-black uppercase">
                          <span className="text-orange-500">Lojista</span>
                          <span className="text-green-600">Entregador</span>
                          <span className="text-purple-600">Cliente (paga tudo)</span>
                        </div>
                      </div>
                      <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 text-sm font-bold text-purple-700">
                        💡 A taxa da plataforma ({settings.platform_fee_pct}%) é retirada do valor do pedido. Desse valor, {settings.driver_fee_pct}% vai para o entregador e {settings.restaurant_fee_pct}% vai para o lojista.
                        {platformNet > 0
                          ? ` A plataforma fica com os ${platformNet}% restantes.`
                          : platformNet < 0
                            ? ` ⚠️ Atenção: a soma dos repasses (${totalPct}%) supera a taxa da plataforma (${settings.platform_fee_pct}%)!`
                            : ' A plataforma não retém nada (repasse 100%).'}
                      </div>
                    </div>

                    {/* Campos de configuração */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 space-y-6">
                      <h4 className="font-black text-gray-700 mb-2">Taxas (%)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                          { key: 'platform_fee_pct', label: 'Taxa Plataforma', color: 'purple', help: 'Cobrado sobre o subtotal do pedido' },
                          { key: 'driver_fee_pct', label: 'Repasse Entregador', color: 'green', help: 'Porcentagem que o entregador recebe' },
                          { key: 'restaurant_fee_pct', label: 'Repasse Lojista', color: 'orange', help: 'Porcentagem que o lojista recebe' },
                        ].map(field => (
                          <div key={field.key}>
                            <label className={`text-[10px] font-black text-${field.color}-600 uppercase tracking-widest mb-2 block`}>{field.label}</label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={(settings as any)[field.key]}
                                onChange={e => setSettings(s => ({ ...s, [field.key]: parseFloat(e.target.value) || 0 }))}
                                className="w-full p-4 pr-10 bg-gray-50 rounded-2xl font-black text-xl outline-none border-2 border-transparent focus:border-purple-300 transition-all"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-black">%</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1 ml-1">{field.help}</p>
                          </div>
                        ))}
                      </div>

                      <h4 className="font-black text-gray-700 pt-4 border-t border-gray-100">Limites Mínimos</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                          { key: 'min_delivery_fee', label: 'Taxa de Entrega Mínima', help: 'Cobrado do cliente quando não há taxa definida' },
                          { key: 'min_order_value', label: 'Pedido Mínimo (R$)', help: 'Valor mínimo para realizar um pedido' },
                        ].map(field => (
                          <div key={field.key}>
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">{field.label}</label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-sm">R$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={(settings as any)[field.key]}
                                onChange={e => setSettings(s => ({ ...s, [field.key]: parseFloat(e.target.value) || 0 }))}
                                className="w-full p-4 pl-10 bg-gray-50 rounded-2xl font-black outline-none border-2 border-transparent focus:border-purple-300 transition-all"
                              />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1 ml-1">{field.help}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {settingsMsg && (
                      <div className={`p-4 rounded-2xl text-sm font-bold text-center ${settingsMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {settingsMsg}
                      </div>
                    )}

                    <button
                      onClick={handleSaveSettings}
                      disabled={settingsSaving}
                      className="w-full py-5 bg-gray-950 text-white rounded-[2rem] font-black uppercase text-sm tracking-widest flex items-center justify-center gap-3 hover:bg-purple-700 transition-all disabled:opacity-50"
                    >
                      {settingsSaving ? <><div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Salvando...</> : <><Save size={18} /> Salvar Configurações</>}
                    </button>
                  </>
                )}
              </div>
            );
          })()}

          {activeTab === 'system' && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-2xl font-black text-gray-900 tracking-tighter">
                Integridade do Sistema
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <h4 className="font-black text-sm uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                    <Terminal size={16} /> Status de Conexão
                  </h4>
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-4 h-4 rounded-full ${isSupabaseConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
                    ></div>
                    <span className="font-black text-lg">
                      {isSupabaseConnected ? 'Supabase Online' : 'Conexão Falhou'}
                    </span>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                  <h4 className="font-black text-sm uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                    <AlertTriangle size={16} /> Alertas Críticos
                  </h4>
                  <p className="text-gray-400 font-bold italic">
                    Nenhum erro reportado nas últimas 24h.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {viewingUser && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] p-8 md:p-12 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col relative">
            <div className="flex justify-between items-center mb-8 shrink-0">
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tighter">
                  Dossiê do Usuário
                </h3>
                <p className="text-sm text-gray-500">{viewingUser.email}</p>
              </div>
              <button
                onClick={() => setViewingUser(null)}
                className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition"
              >
                <X size={20} />
              </button>
            </div>

            <form
              id="user-dossier-form"
              onSubmit={handleUpdateDossier}
              className="flex-1 overflow-y-auto no-scrollbar space-y-6 pr-2 pb-10"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">
                    Nome Completo
                  </label>
                  <input
                    name="name"
                    defaultValue={viewingUser.name}
                    className="w-full mt-1 p-4 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">
                    Status da Conta
                  </label>
                  <select
                    name="status"
                    defaultValue={viewingUser.status}
                    className="w-full mt-1 p-4 bg-gray-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-purple-500 appearance-none"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="BLOCKED">BLOCKED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-2 flex items-center gap-2">
                    <DollarSign size={12} /> ID PagSeguro
                  </label>
                  <input
                    name="pagseguroRecipientId"
                    defaultValue={viewingUser.pagseguroRecipientId || ''}
                    className="w-full mt-1 p-4 bg-gray-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-2 flex items-center gap-2">
                    <Wallet size={12} /> Chave PIX
                  </label>
                  <input
                    name="pixKey"
                    defaultValue={viewingUser.pixKey || ''}
                    className="w-full mt-1 p-4 bg-gray-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">
                    CPF / CNPJ
                  </label>
                  <input
                    name="cpf"
                    defaultValue={viewingUser.cpf || viewingUser.cnpj || ''}
                    className="w-full mt-1 p-4 bg-gray-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">
                    WhatsApp
                  </label>
                  <input
                    name="phone"
                    defaultValue={viewingUser.phoneNumber || ''}
                    className="w-full mt-1 p-4 bg-gray-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-purple-500"
                  />
                </div>
              </div>

              {viewingUser.role === UserRole.RESTAURANT && (
                <div className="space-y-6 pt-4 border-t border-gray-100">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">
                      Nome da Loja
                    </label>
                    <input
                      name="businessName"
                      defaultValue={viewingUser.businessName || ''}
                      className="w-full mt-1 p-4 bg-orange-50 rounded-xl font-black outline-none border-2 border-transparent focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">
                      Horário de Funcionamento
                    </label>
                    <input
                      name="workingHours"
                      defaultValue={viewingUser.workingHours || ''}
                      className="w-full mt-1 p-4 bg-orange-50 rounded-xl font-black outline-none border-2 border-transparent focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">
                      Descrição
                    </label>
                    <textarea
                      name="description"
                      defaultValue={viewingUser.description || ''}
                      className="w-full mt-1 p-4 bg-orange-50 rounded-xl font-black outline-none border-2 border-transparent focus:border-purple-500 h-24 resize-none"
                    />
                  </div>
                </div>
              )}

              {viewingUser.role === UserRole.DRIVER && (
                <div className="space-y-6 pt-4 border-t border-gray-100">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">
                      Placa do Veículo
                    </label>
                    <input
                      name="licensePlate"
                      defaultValue={viewingUser.licensePlate || ''}
                      className="w-full mt-1 p-4 bg-green-50 rounded-xl font-black outline-none border-2 border-transparent focus:border-purple-500 uppercase"
                    />
                  </div>
                </div>
              )}
            </form>

            <div className="mt-auto pt-6 border-t border-gray-100 shrink-0 space-y-3">
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetPasswordLoading}
                className="w-full bg-orange-50 text-orange-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
              >
                {resetPasswordLoading ? (
                  <Loader className="animate-spin" size={18} />
                ) : (
                  <span>🔒</span>
                )}
                <span>Enviar Link de Redefinição de Senha</span>
              </button>
              <button
                form="user-dossier-form"
                type="submit"
                disabled={isSaving}
                className="w-full bg-gray-950 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg disabled:opacity-50"
              >
                {isSaving ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
