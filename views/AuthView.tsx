
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { UserRole, UserProfile, UserAddress } from '../types';
import { X, User, LogOut, ChevronRight, Mail, Lock, Loader, MapPin, Eye, EyeOff, UserPlus, Trash2, Edit2, Plus, Truck, Store, Calendar, AlertCircle, ShoppingBag, Wallet, Smartphone, Car } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AddressModal } from '../components/AddressModal';
import Logo from '../assets/Logo.png';
import Nome from '../assets/Nome.png';

// Ícone simples para o Google
const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.012,36.49,44,30.638,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
    </svg>
);

interface AuthViewProps {
    onClose: () => void;
}

type AuthMode = 'HUB' | 'LOGIN_EMAIL' | 'REGISTER_EMAIL' | 'REGISTER_PARTNER';

const formatCpfCnpj = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length <= 11) {
        return cleanValue
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})/, '$1-$2')
            .slice(0, 14);
    } else {
        return cleanValue
            .replace(/(\d{2})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1/$2')
            .replace(/(\d{4})(\d{1,2})/, '$1-$2')
            .slice(0, 18);
    }
};

export const AuthView: React.FC<AuthViewProps> = ({ onClose }) => {
  const { currentUserProfile, signOut, registerProfile, addAddress, updateAddress, deleteAddress, refreshData, setRole } = useAppStore();
  const [mode, setMode] = useState<AuthMode>('HUB');
  const [partnerType, setPartnerType] = useState<UserRole>(UserRole.DRIVER);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [vehicleType, setVehicleType] = useState('Moto');
  const [licensePlate, setLicensePlate] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [phone, setPhone] = useState('');
  const [regAddress, setRegAddress] = useState<Omit<UserAddress, 'id'> | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateFields = () => {
    const newErrors: Record<string, string> = {};
    
    if (mode === 'LOGIN_EMAIL') {
        if (!email) newErrors.email = "Informe seu e-mail";
        if (!password) newErrors.password = "Informe sua senha";
    } else { // REGISTER_EMAIL or REGISTER_PARTNER
        if (!name) newErrors.name = "O nome é obrigatório";
        if (!phone) newErrors.phone = "WhatsApp é obrigatório";
        if (!email) newErrors.email = "E-mail inválido";
        if (!password || password.length < 6) newErrors.password = "Senha muito curta (mín. 6)";
        
        if (mode === 'REGISTER_PARTNER') {
            if (partnerType === UserRole.DRIVER && (!cpf || cpf.replace(/\D/g, '').length < 11)) newErrors.cpf = "CPF incompleto";
            if (partnerType === UserRole.RESTAURANT && (!cnpj || cnpj.replace(/\D/g, '').length < 14)) newErrors.cnpj = "CNPJ incompleto";
            if (!pixKey) newErrors.pixKey = "Chave PIX necessária";
            if (partnerType === UserRole.DRIVER && vehicleType !== 'Bicicleta' && !licensePlate) newErrors.licensePlate = "Placa obrigatória";
            if (partnerType === UserRole.RESTAURANT && !regAddress) newErrors.address = "Localização obrigatória";
        }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
      if (!validateFields()) return;
      
      const isPartner = mode === 'REGISTER_PARTNER';
      setLoading(true);
      try {
          const { data, error } = await supabase.auth.signUp({ 
              email, 
              password, 
              options: { data: { name } } 
          });
          
          if (error) throw error;

          if (data.user) {
              const savedAddresses: UserAddress[] = [];
              if (regAddress) {
                  savedAddresses.push({ 
                      ...regAddress, 
                      id: `addr-${Date.now()}`,
                      label: isPartner && partnerType === UserRole.RESTAURANT ? 'Loja' : 'Principal' 
                  });
              }

              const roleToSet = isPartner ? partnerType : UserRole.CLIENT;

              await registerProfile({
                  id: data.user.id, 
                  email: email.toLowerCase(), 
                  name, 
                  role: roleToSet, 
                  cpf: (isPartner && partnerType === UserRole.DRIVER) || (mode === 'REGISTER_EMAIL') ? cpf.replace(/\D/g, '') : undefined,
                  cnpj: isPartner && partnerType === UserRole.RESTAURANT ? cnpj.replace(/\D/g, '') : undefined,
                  vehicleType: isPartner && partnerType === UserRole.DRIVER ? vehicleType : undefined,
                  licensePlate: isPartner && partnerType === UserRole.DRIVER && vehicleType !== 'Bicicleta' ? licensePlate : undefined,
                  phoneNumber: phone, 
                  pixKey: isPartner ? pixKey : undefined,
                  status: isPartner ? 'PENDING' : 'APPROVED', 
                  savedAddresses,
                  createdAt: Date.now(),
              });
              
              await refreshData();
              setRole(roleToSet);
              
              if (isPartner) {
                  alert("Solicitação de cadastro enviada com sucesso! Você será notificado após a análise da administração.");
              }
              onClose();
          }
      } catch (e: any) { 
          console.error("Erro no cadastro:", e);
          setErrors({ auth: e.message || "Erro desconhecido no cadastro." }); 
      }
      finally { setLoading(false); }
  };

  const handleEmailLogin = async () => {
      if (!validateFields()) return;
      setLoading(true);
      try {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          
          await refreshData();
          onClose();
      } catch (e: any) { 
          console.error("Erro no login:", e);
          setErrors({ auth: "E-mail ou senha incorretos ou erro de conexão." });
      }
      finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            }
        });
        if (error) throw error;
    } catch (e: any) {
        console.error("Erro no login com Google:", e);
        setErrors({ auth: "Não foi possível entrar com o Google." });
    } finally {
        setLoading(false);
    }
  };

  const handleAddressAction = async (addr: Omit<UserAddress, 'id'>) => {
    if (!addr.street || !addr.number) return;
    if (mode === 'REGISTER_EMAIL' || mode === 'REGISTER_PARTNER') { 
        setRegAddress(addr); 
        setErrors(prev => ({ ...prev, address: '' }));
        setShowAddressModal(false); 
        return; 
    }
    if (!currentUserProfile) return;
    if (editingAddress) await updateAddress({ ...addr, id: editingAddress.id });
    else await addAddress(addr);
    setShowAddressModal(false);
    setEditingAddress(null);
  };

  const InputError = ({ field }: { field: string }) => errors[field] ? (
    <p className="text-[10px] text-red-500 font-bold ml-2 mt-1 flex items-center gap-1">
        <AlertCircle size={10}/> {errors[field]}
    </p>
  ) : null;

  const changeMode = (newMode: AuthMode) => {
    setEmail('');
    setPassword('');
    setName('');
    setCpf('');
    setCnpj('');
    setPhone('');
    setPixKey('');
    setLicensePlate('');
    setErrors({});
    setLoading(false);
    setMode(newMode);
  };

  if (mode === 'HUB') {
      const safeProfile: UserProfile | null = currentUserProfile
        ? {
            ...currentUserProfile,
            savedAddresses: Array.isArray(currentUserProfile.savedAddresses)
              ? currentUserProfile.savedAddresses
              : [],
          }
        : null;

      return (
          <div className="flex flex-col h-full bg-gray-50 overflow-y-auto no-scrollbar">
              <div className="bg-white p-8 rounded-b-[3rem] shadow-sm relative">
                  <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition"><X size={20}/></button>
                  <div className="flex flex-col items-center">
                      <div className="w-24 h-24 rounded-[2.5rem] mb-4 flex items-center justify-center bg-gray-100 ring-4 ring-white shadow-xl overflow-hidden">
                          {safeProfile ? (
                            <span className="text-4xl font-black text-purple-600">{safeProfile.name?.charAt(0) || '?'}</span> 
                          ) : (
                            <User size={48} className="text-gray-300"/>
                          )}
                      </div>
                      {safeProfile ? (
                          <div className="text-center w-full">
                              <h2 className="text-2xl font-black text-gray-900">{safeProfile.name}</h2>
                              <p className="text-sm text-gray-500 mb-6">{safeProfile.email}</p>

                              <div className="text-left bg-gray-50 p-6 rounded-[2rem] border border-gray-100 mb-6">
                                  {(safeProfile.role === UserRole.DRIVER ||
                                    safeProfile.role === UserRole.RESTAURANT) && (
                                    <>
                                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">
                                        Dados do Perfil
                                      </h3>

                                      <div className="bg-white p-4 rounded-2xl flex flex-col gap-2 shadow-sm mb-6">
                                        {safeProfile.cpf && (
                                          <div className="flex justify-between">
                                            <span className="text-[9px] uppercase font-bold text-gray-400">CPF</span>
                                            <span className="text-xs font-black">{safeProfile.cpf}</span>
                                          </div>
                                        )}

                                        {safeProfile.cnpj && (
                                          <div className="flex justify-between">
                                            <span className="text-[9px] uppercase font-bold text-gray-400">CNPJ</span>
                                            <span className="text-xs font-black">{safeProfile.cnpj}</span>
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}

                                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">
                                    Endereços Salvos
                                  </h3>

                                  <div className="space-y-3">
                                    {safeProfile.savedAddresses.map(addr => (
                                      <div
                                        key={addr.id}
                                        className="bg-white p-3 rounded-2xl flex justify-between items-center shadow-sm"
                                      >
                                        <span className="text-xs font-bold text-gray-700 truncate">
                                          {addr.street}, {addr.number}
                                        </span>
                                      </div>
                                    ))}
                                  </div>

                                  <button
                                    onClick={signOut}
                                    className="mt-6 text-red-500 font-black text-xs uppercase py-4 border border-red-50 w-full rounded-2xl"
                                  >
                                    Sair da Conta
                                  </button>
                                </div>
                          </div>
                      ) : (
                          <div className="w-full max-w-xs space-y-3 mt-4">
                              <button onClick={handleGoogleLogin} className="w-full bg-white border-2 border-gray-200 text-gray-700 font-bold py-4 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-3">
                                <GoogleIcon /> Entrar com Google
                              </button>
                              <button onClick={() => changeMode('LOGIN_EMAIL')} className="w-full bg-orange-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all">Entrar com E-mail</button>
                              <button onClick={() => changeMode('REGISTER_EMAIL')} className="w-full bg-white border-2 border-gray-900 text-gray-900 font-black py-4 rounded-2xl active:scale-95 transition-all">Criar Nova Conta</button>
                          </div>
                      )}
                  </div>
              </div>
                {!safeProfile && (
                <div className="p-8 space-y-4">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2">Seja um Parceiro</h3>
                    <button onClick={() => { setPartnerType(UserRole.DRIVER); changeMode('REGISTER_PARTNER'); }} className="w-full bg-white p-5 rounded-[2rem] border border-gray-100 flex items-center justify-between hover:border-orange-200 transition group shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition shadow-inner"><Truck/></div>
                            <div className="text-left"><h4 className="font-black text-gray-900">Ser Entregador</h4><p className="text-[10px] text-gray-400 font-bold">Ganhe dinheiro nas entregas</p></div>
                        </div>
                        <ChevronRight className="text-gray-300" />
                    </button>
                    <button onClick={() => { setPartnerType(UserRole.RESTAURANT); changeMode('REGISTER_PARTNER'); }} className="w-full bg-white p-5 rounded-[2rem] border border-gray-100 flex items-center justify-between hover:border-orange-200 transition group shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition shadow-inner"><Store/></div>
                            <div className="text-left"><h4 className="font-black text-gray-900">Cadastrar Loja</h4><p className="text-[10px] text-gray-400 font-bold">Venda seus produtos online</p></div>
                        </div>
                        <ChevronRight className="text-gray-300" />
                    </button>
                </div>
              )}

              {showAddressModal && <AddressModal onClose={() => setShowAddressModal(false)} onSave={handleAddressAction} />}
          </div>
      );
  }

  // ... (o resto do código permanece o mesmo)

  return (
      <div className="h-full flex flex-col bg-white overflow-hidden">
          <div className="p-8 border-b flex justify-between items-center bg-gray-50/50">
              <h2 className="text-2xl font-black text-gray-900 tracking-tighter">
                  {mode === 'LOGIN_EMAIL' ? 'Bem-vindo!' : (mode === 'REGISTER_PARTNER' ? `Novo ${partnerType === UserRole.DRIVER ? 'Entregador' : 'Parceiro'}` : 'Criar Conta')}
              </h2>
              <button onClick={() => setMode('HUB')} className="p-2 bg-gray-100 rounded-full"><X/></button>
          </div>
          <div className="p-8 space-y-6 overflow-y-auto no-scrollbar flex-1 pb-32">
              
              {errors.auth && <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-red-600 text-xs font-bold text-center flex items-center gap-2 justify-center"><AlertCircle size={14}/> {errors.auth}</div>}

              {mode === 'LOGIN_EMAIL' ? (
                  <div className="space-y-4">
                      <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Seu E-mail</label>
                          <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none" placeholder="exemplo@email.com" />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Sua Senha</label>
                          <div className="relative">
                            <input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? "text" : "password"} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none" placeholder="••••••" />
                            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                          </div>
                      </div>
                  </div>
              ) : ( // REGISTER_EMAIL or REGISTER_PARTNER
                  <div className="space-y-6">
                      <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">{mode === 'REGISTER_PARTNER' && partnerType === UserRole.RESTAURANT ? "Nome da Loja" : "Nome Completo"}</label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18}/>
                            <input value={name} onChange={e => setName(e.target.value)} className="w-full p-4 pl-12 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none" />
                          </div>
                          <InputError field="name"/>
                      </div>
                      
                      {mode === 'REGISTER_PARTNER' && partnerType === UserRole.RESTAURANT && (
                          <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">CNPJ</label>
                              <input value={cnpj} onChange={e => setCnpj(formatCpfCnpj(e.target.value))} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none" placeholder="00.000.000/0000-00" />
                              <InputError field="cnpj"/>
                          </div>
                      )}

                      {mode === 'REGISTER_EMAIL' || (mode === 'REGISTER_PARTNER' && partnerType === UserRole.DRIVER) ? (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">
                                {mode === 'REGISTER_EMAIL' ? 'CPF (Opcional)' : 'CPF'}
                            </label>
                            <input value={cpf} onChange={e => setCpf(formatCpfCnpj(e.target.value))} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none" placeholder="000.000.000-00" />
                            <InputError field="cpf"/>
                        </div>
                      ) : null}

                      {mode === 'REGISTER_PARTNER' && partnerType === UserRole.DRIVER && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Veículo</label>
                                  <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none text-xs uppercase">
                                      <option>Moto</option>
                                      <option>Bicicleta</option>
                                      <option>Carro</option>
                                  </select>
                              </div>
                              {vehicleType !== 'Bicicleta' && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Placa</label>
                                    <div className="relative">
                                      <Car className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18}/>
                                      <input value={licensePlate} onChange={e => setLicensePlate(e.target.value.toUpperCase())} className="w-full p-4 pl-12 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none" placeholder="ABC-1234" />
                                    </div>
                                    <InputError field="licensePlate"/>
                                </div>
                              )}
                          </div>
                        </>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">WhatsApp</label>
                            <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none" placeholder="(66) 9 0000-0000" />
                            <InputError field="phone"/>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">E-mail</label>
                            <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none" placeholder="seu@email.com" />
                            <InputError field="email"/>
                        </div>
                      </div>

                      {mode === 'REGISTER_PARTNER' && (
                        <div className="p-6 bg-purple-50 rounded-[2.5rem] border border-purple-100 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Wallet className="text-purple-600" size={20}/>
                                <h4 className="font-black text-purple-900 text-xs uppercase tracking-widest">Repasses PIX</h4>
                            </div>
                            <div className="space-y-1">
                                <input value={pixKey} onChange={e => setPixKey(e.target.value)} className="w-full p-4 bg-white border border-purple-200 rounded-2xl font-bold outline-none" placeholder="Sua chave PIX" />
                                <InputError field="pixKey"/>
                            </div>
                        </div>
                      )}
                      
                      <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Crie sua Senha</label>
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18}/>
                            <input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? "text" : "password"} className="w-full p-4 pl-12 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none" />
                            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                          </div>
                          <InputError field="password"/>
                      </div>
                  </div>
              )}

              <button 
                  onClick={() => mode === 'LOGIN_EMAIL' ? handleEmailLogin() : handleRegister()} 
                  disabled={loading} 
                  className={`w-full py-5 rounded-[2rem] font-black text-white shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 ${loading ? 'bg-gray-300' : 'bg-orange-600 shadow-orange-100 hover:bg-orange-700'}`}
              >
                  {loading ? <Loader className="animate-spin" /> : (mode === 'LOGIN_EMAIL' ? 'Entrar Agora' : 'Finalizar Cadastro')}
              </button>
          </div>
          {showAddressModal && <AddressModal onSave={handleAddressAction} onClose={() => setShowAddressModal(false)} />}
      </div>
  );
};
