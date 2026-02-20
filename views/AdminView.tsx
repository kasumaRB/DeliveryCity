import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import {
  Users, Shield, Search, LogOut, LayoutDashboard, Eye, Save, DollarSign, RefreshCw, Loader, Play, X, Clock, Store, Bike, Terminal, Menu, Trash2
} from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import Logo from '../assets/Logo.png';

const AdminSidebar: React.FC<{ activeTab: string; onTabClick: (tab: any) => void; onSignOut: () => void; profiles: UserProfile[] }> = ({ activeTab, onTabClick, onSignOut, profiles }) => (
  <aside className="bg-gray-900 flex flex-col h-full">
    <div className="p-8 flex items-center justify-center">
        <img src={Logo} alt="Logo" className="h-16 md:h-20 w-auto object-contain" />
    </div>
    <nav className="flex-1 px-4 space-y-2">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'users', label: 'Usuários', icon: Users },
          { id: 'requests', label: 'Solicitações', icon: Clock, badge: profiles.filter(p => p.status === 'PENDING').length },
          { id: 'partners', label: 'Parceiros', icon: Store },
          { id: 'system', label: 'Status & Logs', icon: Terminal },
        ].map(item => (
            <button
                key={item.id}
                onClick={() => onTabClick(item.id as any)}
                className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === item.id ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-400 hover:bg-white/5'}`}
            >
                <div className="flex items-center gap-4"><item.icon size={20} /> {item.label}</div>
                {item.badge > 0 && <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full">{item.badge}</span>}
            </button>
        ))}
    </nav>
    <div className="p-6 border-t border-gray-800">
        <button onClick={onSignOut} className="w-full flex items-center gap-4 text-gray-500 font-black text-sm p-4 hover:text-red-400 transition-colors">
            <LogOut size={20} /> Sair
        </button>
    </div>
  </aside>
);

export const AdminView: React.FC = () => {
  const {
    profiles, updateUserProfile, deleteUserProfile,
    isSupabaseConnected, signOut, refreshData, loginAsTestUser,
    orders, restaurants
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'requests' | 'partners' | 'system'>('dashboard');
  const [userSearch, setUserSearch] = useState('');
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleUpdateStatus = async (userId: string, status: 'APPROVED' | 'BLOCKED') => {
      try {
          await updateUserProfile(userId, { status });
          alert(`Usuário ${status === 'APPROVED' ? 'aprovado' : 'bloqueado'} com sucesso!`);
          refreshData();
      } catch (e: any) { alert(e.message); }
  };

  const handleUpdateDossier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingUser) return;
    setIsSaving(true);
    try {
        const formData = new FormData(e.currentTarget as HTMLFormElement);
        const updateData: Partial<UserProfile> = {
            name: formData.get('name') as string,
            cpf: formData.get('cpf') as string,
            cnpj: formData.get('cnpj') as string,
            licensePlate: formData.get('licensePlate') as string,
            phoneNumber: formData.get('phone') as string,
            status: formData.get('status') as any,
            passwordPlain: formData.get('passwordPlain') as string,
            pagseguroRecipientId: formData.get('pagseguroRecipientId') as string,
        };
        await updateUserProfile(viewingUser.id, updateData);
        alert("Alterações salvas!");
        setViewingUser(null);
    } catch (e: any) { alert(e.message); }
    finally { setIsSaving(false); }
  };

  const handleTabSelection = (tab: any) => {
    setActiveTab(tab);
    setIsMenuOpen(false);
  }

  const filteredProfiles = useMemo(() => {
      return profiles.filter(p => p.name.toLowerCase().includes(userSearch.toLowerCase()) || p.email.toLowerCase().includes(userSearch.toLowerCase()));
  }, [profiles, userSearch]);

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex font-sans">
      <div className="w-72 hidden md:block h-screen sticky top-0">
        <AdminSidebar activeTab={activeTab} onTabClick={handleTabSelection} onSignOut={signOut} profiles={profiles} />
      </div>

      {isMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
          <div className="relative w-72 h-full bg-gray-900 shadow-xl animate-in slide-in-from-left duration-300">
            <AdminSidebar activeTab={activeTab} onTabClick={handleTabSelection} onSignOut={signOut} profiles={profiles} />
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col md:h-screen overflow-hidden">
        <header className="h-20 bg-white border-b flex items-center justify-between px-6 md:px-10">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-2 text-gray-500">
                  <Menu size={24}/>
              </button>
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{activeTab}</h2>
            </div>
            <button onClick={() => refreshData()} className="p-3 text-gray-400 hover:text-purple-600 bg-gray-50 rounded-xl transition-all">
                <RefreshCw size={18}/>
            </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 no-scrollbar pb-32">
            {activeTab === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in">
                    <h3 className="text-2xl font-black text-gray-900 tracking-tighter">Dashboard</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-6">
                            <div className="w-16 h-16 rounded-3xl bg-purple-50 text-purple-600 flex items-center justify-center"><Users size={28}/></div>
                            <div>
                                <p className="text-4xl font-black">{profiles.length}</p>
                                <p className="text-sm font-bold text-gray-400">Total de Usuários</p>
                            </div>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-6">
                            <div className="w-16 h-16 rounded-3xl bg-orange-50 text-orange-600 flex items-center justify-center"><Store size={28}/></div>
                            <div>
                                <p className="text-4xl font-black">{restaurants.length}</p>
                                <p className="text-sm font-bold text-gray-400">Restaurantes</p>
                            </div>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-6">
                            <div className="w-16 h-16 rounded-3xl bg-green-50 text-green-600 flex items-center justify-center"><Bike size={28}/></div>
                            <div>
                                <p className="text-4xl font-black">{profiles.filter(p => p.role === 'DRIVER').length}</p>
                                <p className="text-sm font-bold text-gray-400">Entregadores</p>
                            </div>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-6">
                            <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center"><LayoutDashboard size={28}/></div>
                            <div>
                                <p className="text-4xl font-black">{orders.length}</p>
                                <p className="text-sm font-bold text-gray-400">Total de Pedidos</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <h3 className="text-2xl font-black text-gray-900 tracking-tighter">Gestão de Contas</h3>
                        <div className="relative w-full md:max-w-md">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                            <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Pesquisar usuários..." className="w-full p-5 pl-14 bg-white border border-gray-100 rounded-2xl font-bold shadow-sm outline-none" />
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-x-auto shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50/70 border-b border-gray-100">
                                <tr>
                                    <th className="px-8 py-5 font-black text-gray-400 text-xs uppercase tracking-widest">Usuário</th>
                                    <th className="px-8 py-5 font-black text-gray-400 text-xs uppercase tracking-widest">Papel</th>
                                    <th className="px-8 py-5 font-black text-gray-400 text-xs uppercase tracking-widest text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredProfiles.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="font-black text-gray-900">{p.name}</div>
                                            <div className="text-[10px] text-gray-500 font-bold">{p.email}</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${p.role === UserRole.RESTAURANT ? 'bg-orange-50 text-orange-600' : p.role === UserRole.DRIVER ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>{p.role}</span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex justify-center gap-3">
                                                <button onClick={() => setViewingUser(p)} className="p-3 text-gray-400 bg-gray-100 rounded-xl hover:text-purple-600 transition-all"><Eye size={18}/></button>
                                                <button onClick={() => loginAsTestUser(p.id)} className="p-3 text-blue-400 bg-blue-50 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Play size={18}/></button>
                                                <button onClick={() => { if(window.confirm('Apagar usuário?')) deleteUserProfile(p.id); }} disabled={p.role === UserRole.ADMIN} className="p-3 text-red-400 bg-red-50 rounded-xl hover:bg-red-600 hover:text-white transition-all disabled:opacity-20"><Trash2 size={18}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'requests' && ( <div className="space-y-6 animate-in fade-in"><h3 className="text-2xl font-black text-gray-900 tracking-tighter">Fila de Aprovação</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{profiles.filter(p => p.status === 'PENDING').length === 0 ? (<div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100 text-gray-300 font-black uppercase tracking-widest text-xs">Nenhuma solicitação pendente</div>) : (profiles.filter(p => p.status === 'PENDING').map(p => (<div key={p.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm"><div className="flex justify-between items-start mb-6"><div className="flex items-center gap-4"><div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${p.role === UserRole.RESTAURANT ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>{p.role === UserRole.RESTAURANT ? <Store/> : <Bike/>}</div><div><h4 className="font-black text-gray-900 text-lg">{p.name}</h4><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{p.role} • {p.email}</p></div></div></div><div className="grid grid-cols-2 gap-4 mb-8"><div className="bg-gray-50 p-4 rounded-2xl"><p className="text-[8px] font-black text-gray-400 uppercase mb-1">Documento</p><p className="font-black text-xs">{p.cpf || p.cnpj || '---'}</p></div><div className="bg-gray-50 p-4 rounded-2xl"><p className="text-[8px] font-black text-gray-400 uppercase mb-1">WhatsApp</p><p className="font-black text-xs">{p.phoneNumber || '---'}</p></div></div><div className="flex gap-3"><button onClick={() => handleUpdateStatus(p.id, 'APPROVED')} className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">Aprovar</button><button onClick={() => handleUpdateStatus(p.id, 'BLOCKED')} className="px-6 bg-red-50 text-red-600 rounded-2xl font-black text-xs uppercase transition-all"><X size={18}/></button></div></div>)))}</div></div> )}
            
            {activeTab === 'partners' && (
                <div className="space-y-6 animate-in fade-in">
                    <h3 className="text-2xl font-black text-gray-900 tracking-tighter">Parceiros Aprovados</h3>
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-x-auto shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50/70 border-b border-gray-100">
                                <tr>
                                    <th className="px-8 py-5 font-black text-gray-400 text-xs uppercase tracking-widest">Parceiro</th>
                                    <th className="px-8 py-5 font-black text-gray-400 text-xs uppercase tracking-widest">Contato</th>
                                    <th className="px-8 py-5 font-black text-gray-400 text-xs uppercase tracking-widest">ID PagSeguro</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {profiles.filter(p => p.status === 'APPROVED' && (p.role === 'RESTAURANT' || p.role === 'DRIVER')).map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="font-black text-gray-900">{p.name}</div>
                                            <div className="text-[10px] text-gray-500 font-bold">{p.role}</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="font-bold text-gray-700">{p.email}</div>
                                            <div className="text-[10px] text-gray-500 font-bold">{p.phoneNumber || 'N/A'}</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="font-mono text-xs bg-gray-100 p-2 rounded-lg">{p.pagseguroRecipientId || 'NÃO DEFINIDO'}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'system' && (
              <div className="space-y-6 animate-in fade-in">
                <h3 className="text-2xl font-black text-gray-900 tracking-tighter">Status do Sistema</h3>
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
                    <div className="flex items-center gap-4">
                        <div className={`w-4 h-4 rounded-full ${isSupabaseConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <p className="font-bold">Conexão com Supabase: <span className={isSupabaseConnected ? 'text-green-600' : 'text-red-600'}>{isSupabaseConnected ? 'Ativa' : 'Desconectado'}</span></p>
                    </div>
                    {isSupabaseConnected === false && <p className="text-red-500 mt-4">Falha na conexão. Verifique o console de desenvolvedor (F12) e a sua conexão com a internet.</p>}
                </div>
              </div>
            )}
        </div>
      </main>

      {viewingUser && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] p-8 md:p-12 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tighter">Editando Dossiê</h3>
                <p className="text-sm text-gray-500">Usuário: {viewingUser.name}</p>
              </div>
              <button onClick={() => setViewingUser(null)} className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition"><X size={20}/></button>
            </div>
            
            <form id="user-dossier-form" onSubmit={handleUpdateDossier} className="flex-1 overflow-y-auto no-scrollbar space-y-6 pr-4 -mr-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Nome</label>
                  <input name="name" defaultValue={viewingUser.name} className="w-full mt-1 p-4 bg-gray-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-purple-500"/>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Status</label>
                  <select name="status" defaultValue={viewingUser.status} className="w-full mt-1 p-4 bg-gray-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-purple-500 appearance-none">
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="BLOCKED">BLOCKED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                  <DollarSign size={12} /> ID de Recebedor PagSeguro
                </label>
                <input 
                  name="pagseguroRecipientId" 
                  defaultValue={viewingUser.pagseguroRecipientId || ''}
                  placeholder="ID da conta que receberá os pagamentos"
                  className="w-full mt-1 p-4 bg-gray-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">CPF</label>
                  <input name="cpf" defaultValue={viewingUser.cpf || ''} className="w-full mt-1 p-4 bg-gray-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-purple-500"/>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">CNPJ</label>
                  <input name="cnpj" defaultValue={viewingUser.cnpj || ''} className="w-full mt-1 p-4 bg-gray-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-purple-500"/>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Celular (WhatsApp)</label>
                  <input name="phone" defaultValue={viewingUser.phoneNumber || ''} className="w-full mt-1 p-4 bg-gray-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-purple-500"/>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Placa do Veículo</label>
                  <input name="licensePlate" defaultValue={viewingUser.licensePlate || ''} className="w-full mt-1 p-4 bg-gray-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-purple-500"/>
                </div>
              </div>
               <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Nova Senha (deixar em branco para não alterar)</label>
                  <input name="passwordPlain" type="password" placeholder="••••••••" className="w-full mt-1 p-4 bg-gray-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-purple-500"/>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-100 flex-shrink-0">
              <button 
                form="user-dossier-form"
                type="submit" 
                disabled={isSaving}
                className="w-full bg-gray-950 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader className="animate-spin" size={18}/> : <Save size={18}/>}
                <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};