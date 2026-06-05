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
  TrendingUp,
  TrendingDown,
  Award,
  Filter,
  Star,
  Phone,
  RotateCcw,
  Package,
  CheckCircle,
} from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import Logo from '../assets/Logo.png';

// ────────────────────────────────────────────────────────────
// SettingsTab: componente próprio para evitar violação das
// Rules of Hooks (useState/useEffect não podem ficar em IIFEs)
// ────────────────────────────────────────────────────────────
const SettingsTab: React.FC = () => {
  const { profiles, updateUserProfile } = useAppStore();
  const [settings, setSettings] = useState({
    platform_fee_pct: 15,
    driver_fee_pct: 40,
    restaurant_fee_pct: 10,
    min_delivery_fee: 4.0,
    min_order_value: 15.0,
    service_fee: 4.0,
    support_whatsapp: '',
    city_cep: '',
  });
  const [simSubtotal, setSimSubtotal] = useState(20);
  const [simDelivery, setSimDelivery] = useState(8);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('platform_settings').select('*').maybeSingle();
        if (data) setSettings({
          platform_fee_pct: data.platform_fee_pct ?? 15,
          driver_fee_pct: data.driver_fee_pct ?? 40,
          restaurant_fee_pct: data.restaurant_fee_pct ?? 10,
          min_delivery_fee: data.min_delivery_fee ?? 4.0,
          min_order_value: data.min_order_value ?? 15.0,
          service_fee: data.service_fee ?? 4.0,
          support_whatsapp: data.support_whatsapp ?? '',
          city_cep: data.city_cep ?? '',
        });
      } catch {
        // falha silenciosa — usa valores padrão
      } finally {
        setSettingsLoading(false);
      }
    })();
  }, []);

  const handleSaveSettings = async () => {
    const usersWithCustomFee = profiles.filter(p => p.customFeePct !== undefined && p.customFeePct !== null);
    if (usersWithCustomFee.length > 0) {
      const resetCustomFees = window.confirm(
        'Existem usuários com taxas específicas configuradas. Deseja redefinir as taxas deles para o valor geral? (OK = Redefinir todos para o geral, Cancelar = Manter as taxas específicas)'
      );
      if (resetCustomFees) {
        for (const user of usersWithCustomFee) {
          try {
            await updateUserProfile(user.id, { customFeePct: null as any });
          } catch(e) {
            console.error('Erro ao limpar taxa do user', user.id, e);
          }
        }
      }
    }

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

  // A plataforma_fee_pct em si não é usada nos cálculos do app, mas a mantemos no estado por compatibilidade com a tabela.

  if (settingsLoading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin" /></div>;
  }

  // Simulador ao vivo
  const PIX_TRANSFER_COST = 1.99;
  const simKmExcess       = Math.max(0, simDelivery - settings.min_delivery_fee);
  const simPlatformKmPct  = settings.driver_fee_pct / 100;
  const simDriverGets     = settings.min_delivery_fee + simKmExcess * (1 - simPlatformKmPct);
  const simRestaurantGets = simSubtotal * (1 - settings.restaurant_fee_pct / 100);
  const simPlatformGross  = (simSubtotal * settings.restaurant_fee_pct / 100)
                          + (simKmExcess * simPlatformKmPct)
                          + settings.service_fee;
  const simTotal          = simSubtotal + simDelivery + settings.service_fee;
  const simTransferCost   = PIX_TRANSFER_COST * 2;
  const simAsaasPix       = simTotal * 0.01 + simTransferCost;
  const simAsaasCard      = simTotal * 0.0299 + simTransferCost;
  const simNetPix         = simPlatformGross - simAsaasPix;
  const simNetCard        = simPlatformGross - simAsaasCard;
  const fmt = (v: number) => `${v < 0 ? '-' : ''}R$ ${Math.abs(v).toFixed(2).replace('.', ',')}`;

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in space-y-6">
      <div>
        <h3 className="text-2xl font-black text-gray-900 tracking-tighter mb-1">Configurações da Plataforma</h3>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Comissões, limites e contato</p>
      </div>

      {/* Comissões */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h4 className="font-black text-gray-800 flex items-center gap-2">
          <DollarSign size={16} className="text-purple-500" /> Comissões
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2 block">
              Lojista — sobre produtos
            </label>
            <div className="relative">
              <input
                type="number" min="0" max="100" step="0.5"
                value={settings.restaurant_fee_pct}
                onChange={e => setSettings(s => ({ ...s, restaurant_fee_pct: parseFloat(e.target.value) || 0 }))}
                className="w-full p-4 pr-10 bg-orange-50 rounded-xl font-black text-2xl outline-none border border-orange-100 focus:border-orange-400 transition-all text-orange-700"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-400 font-black text-lg">%</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Lojista recebe {(100 - settings.restaurant_fee_pct).toFixed(1)}% do subtotal</p>
          </div>
          <div>
            <label className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2 block">
              Sua % do excesso por km
            </label>
            <div className="relative">
              <input
                type="number" min="0" max="100" step="5"
                value={settings.driver_fee_pct}
                onChange={e => setSettings(s => ({ ...s, driver_fee_pct: parseFloat(e.target.value) || 0 }))}
                className="w-full p-4 pr-10 bg-green-50 rounded-xl font-black text-2xl outline-none border border-green-100 focus:border-green-400 transition-all text-green-700"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-green-400 font-black text-lg">%</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Entregador: R$ {settings.min_delivery_fee} fixo + {(100 - settings.driver_fee_pct).toFixed(0)}% do km extra
            </p>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
          Taxa individual por lojista pode ser ajustada no perfil de cada um — substitui a geral acima.
        </p>
      </div>

      {/* Simulador ao vivo */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h4 className="font-black text-gray-800 flex items-center gap-2">
          <span className="text-purple-500">🧮</span> Simulador — quanto você recebe por pedido
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Subtotal (produtos)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">R$</span>
              <input
                type="number" min="0" step="5"
                value={simSubtotal}
                onChange={e => setSimSubtotal(parseFloat(e.target.value) || 0)}
                className="w-full p-3 pl-9 bg-gray-50 rounded-xl font-bold outline-none border border-gray-200 focus:border-purple-300 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Taxa de entrega</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">R$</span>
              <input
                type="number" min="0" step="1"
                value={simDelivery}
                onChange={e => setSimDelivery(parseFloat(e.target.value) || 0)}
                className="w-full p-3 pl-9 bg-gray-50 rounded-xl font-bold outline-none border border-gray-200 focus:border-purple-300 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-1">
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
            <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">Lojista recebe</p>
            <p className="text-lg font-black text-orange-700">{fmt(simRestaurantGets)}</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
            <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-1">Entregador recebe</p>
            <p className="text-lg font-black text-green-700">{fmt(simDriverGets)}</p>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
            <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-1">Plataforma (bruto)</p>
            <p className="text-lg font-black text-purple-700">{fmt(simPlatformGross)}</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400 font-medium">Taxa de serviço (vai pra você)</span>
            <span className="font-bold text-gray-600">+ {fmt(settings.service_fee)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400 font-medium">2 transferências PIX (Asaas)</span>
            <span className="font-bold text-red-400">− {fmt(simTransferCost)}</span>
          </div>
          <div className="h-px bg-gray-200 my-1.5" />
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Seu lucro líquido por pedido</p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 font-medium">Se pagar no PIX</span>
            <span className={`font-black ${simNetPix < 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(simNetPix)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 font-medium">Se pagar no cartão</span>
            <span className={`font-black ${simNetCard < 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(simNetCard)}</span>
          </div>
          {simNetPix < 0 && (
            <p className="text-[10px] text-red-500 font-bold mt-2">⚠️ Prejuízo neste cenário — aumente a taxa de serviço ou o pedido mínimo.</p>
          )}
        </div>
      </div>

      {/* Taxa de serviço + Limites mínimos */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <h4 className="font-black text-gray-800 mb-1">Taxa de Serviço</h4>
          <p className="text-[11px] text-gray-400 font-medium">Cobrada do cliente em todo pedido e repassada 100% para você. Serve para cobrir o custo das transferências PIX (~R$ 4 por pedido).</p>
        </div>
        <div className="max-w-[220px]">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">R$</span>
            <input
              type="number" min="0" step="0.5"
              value={settings.service_fee}
              onChange={e => setSettings(s => ({ ...s, service_fee: parseFloat(e.target.value) || 0 }))}
              className="w-full p-4 pl-9 bg-purple-50 rounded-xl font-black text-xl outline-none border border-purple-100 focus:border-purple-400 transition-all text-purple-700"
            />
          </div>
        </div>

        <h4 className="font-black text-gray-800 pt-4 border-t border-gray-100">Limites Mínimos</h4>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'min_delivery_fee', label: 'Taxa de entrega mínima', help: 'Quando não há taxa definida no restaurante' },
            { key: 'min_order_value', label: 'Pedido mínimo', help: 'Valor mínimo para o cliente fazer um pedido' },
          ].map(field => (
            <div key={field.key}>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">{field.label}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">R$</span>
                <input
                  type="number" min="0" step="0.5"
                  value={(settings as any)[field.key]}
                  onChange={e => setSettings(s => ({ ...s, [field.key]: parseFloat(e.target.value) || 0 }))}
                  className="w-full p-4 pl-9 bg-gray-50 rounded-xl font-black outline-none border border-gray-200 focus:border-purple-300 transition-all"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{field.help}</p>
            </div>
          ))}
        </div>
      </div>

      {/* WhatsApp de suporte */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-4">
        <h4 className="font-black text-gray-700 flex items-center gap-2">
          <span className="text-green-600">📱</span> Contato de Suporte
        </h4>
        <p className="text-xs text-gray-400 font-medium">Número exibido para clientes e entregadores ao acessar a aba de suporte. Use somente dígitos (ex: 66999990000).</p>
        <input
          type="tel"
          value={settings.support_whatsapp}
          onChange={e => setSettings(s => ({ ...s, support_whatsapp: e.target.value.replace(/\D/g, '') }))}
          placeholder="66999990000"
          className="w-full p-4 bg-gray-50 rounded-xl font-black outline-none border border-gray-200 focus:border-green-400 transition-all"
        />
        {settings.support_whatsapp && (
          <a
            href={`https://wa.me/55${settings.support_whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-green-600 font-bold text-xs hover:underline"
          >
            ✓ Testar link: wa.me/55{settings.support_whatsapp}
          </a>
        )}
      </div>

      {/* CEP da cidade */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-4">
        <h4 className="font-black text-gray-700 flex items-center gap-2">
          <span className="text-blue-600">📍</span> CEP da Cidade
        </h4>
        <p className="text-xs text-gray-400 font-medium">
          Cidades pequenas têm um CEP único para todos os endereços. Ele será preenchido
          automaticamente quando o cliente cadastrar o endereço. Ex: Apiacás-MT = 78595-000.
        </p>
        <input
          type="text"
          inputMode="numeric"
          maxLength={9}
          value={settings.city_cep}
          onChange={e => {
            const d = e.target.value.replace(/\D/g, '').slice(0, 8);
            const f = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
            setSettings(s => ({ ...s, city_cep: f }));
          }}
          placeholder="78595-000"
          className="w-full p-4 bg-gray-50 rounded-xl font-black outline-none border border-gray-200 focus:border-blue-400 transition-all"
        />
      </div>

      {settingsMsg && (
        <div className={`p-4 rounded-xl text-sm font-bold text-center ${
          settingsMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>{settingsMsg}</div>
      )}

      <button
        onClick={handleSaveSettings}
        disabled={settingsSaving}
        className="w-full py-4 bg-purple-600 text-white rounded-xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-3 hover:bg-purple-700 transition-all disabled:opacity-50"
      >
        {settingsSaving
          ? <><div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Salvando...</>
          : <><Save size={18} /> Salvar Configurações</>}
      </button>
    </div>
  );
};



const AdminSidebar: React.FC<{
  activeTab: string;
  onTabClick: (tab: any) => void;
  onSignOut: () => void;
  profiles: UserProfile[];
  failureCount?: number;
}> = ({ activeTab, onTabClick, onSignOut, profiles, failureCount = 0 }) => (
  <aside className="bg-white flex flex-col h-full border-r border-gray-100">
    <div className="p-6 flex items-center justify-center border-b border-gray-100">
      <img src={Logo} alt="Logo" className="h-12 md:h-14 w-auto object-contain" />
    </div>
    <nav className="flex-1 py-4 space-y-1">
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
        { id: 'support', label: 'Suporte', icon: MessageSquare, badge: undefined },
        { id: 'failures', label: 'Devoluções', icon: AlertTriangle, badge: failureCount || undefined },
        { id: 'reviews', label: 'Avaliações', icon: Star },
        { id: 'settings', label: 'Configurações', icon: DollarSign },
        { id: 'system', label: 'Status & Logs', icon: Terminal },
      ].map(item => (
        <button
          key={item.id}
          onClick={() => onTabClick(item.id as any)}
          className={`w-full flex items-center justify-between px-4 py-3 border-l-4 text-sm transition-all ${
            activeTab === item.id
              ? 'border-purple-600 bg-purple-50 text-purple-700 font-black'
              : 'border-transparent text-gray-500 hover:bg-gray-50 font-medium'
          }`}
        >
          <div className="flex items-center gap-3">
            <item.icon size={18} /> {item.label}
          </div>
          {(item.badge ?? 0) > 0 && (
            <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full">
              {item.badge}
            </span>
          )}
        </button>
      ))}
    </nav>
    <div className="p-4 border-t border-gray-100">
      <button
        onClick={onSignOut}
        className="w-full flex items-center gap-3 text-gray-400 font-medium text-sm px-4 py-3 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
      >
        <LogOut size={18} /> Sair
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
    sendAdminMessage,
    restaurants,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'users' | 'requests' | 'partners' | 'support' | 'reviews' | 'settings' | 'system' | 'orders' | 'failures'
  >('dashboard');
  const [userSearch, setUserSearch] = useState('');
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [supportFilter, setSupportFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('OPEN');
  const [supportRoleFilter, setSupportRoleFilter] = useState<'ALL' | 'RESTAURANT' | 'DRIVER' | 'CLIENT'>('ALL');
  const [supportLoading, setSupportLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyNote, setReplyNote] = useState('');
  const [approvalLoading, setApprovalLoading] = useState<
    Record<string, 'approving' | 'blocking' | null>
  >({});
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [authorizingReturnId, setAuthorizingReturnId] = useState<string | null>(null);
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<string>('ALL');
  const [messagingOrderId, setMessagingOrderId] = useState<string | null>(null);
  const [messageTarget, setMessageTarget] = useState<'client' | 'driver' | 'restaurant' | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    if (activeTab === 'support') {
      fetchSupportTickets();
    }
  }, [activeTab]);

  const fetchSupportTickets = async () => {
    setSupportLoading(true);
    try {
      const { data } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setSupportTickets(data);
    } catch (err) {
      console.error('Erro ao buscar tickets:', err);
    } finally {
      setSupportLoading(false);
    }
  };

  const handleUpdateDossier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingUser) return;
    setIsSaving(true);
    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement);
      const customFeeRaw = formData.get('customFeePct') as string;
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
        asaasAccountId: formData.get('asaasAccountId') as string,
        customFeePct: customFeeRaw !== '' && customFeeRaw !== null ? parseFloat(customFeeRaw) : null,
      } as any);
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
    <div className="h-screen bg-gray-50 flex font-sans overflow-hidden">
      <div className="w-64 hidden md:block h-screen sticky top-0">
        <AdminSidebar
          activeTab={activeTab}
          onTabClick={t => setActiveTab(t)}
          onSignOut={signOut}
          profiles={profiles}
          failureCount={orders.filter(o => o.status === 'DELIVERY_FAILED').length}
        />
      </div>

      {isMenuOpen && (
        <div className="fixed inset-0 z-[110] md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
          ></div>
          <div className="relative w-64 h-full bg-white shadow-xl animate-in slide-in-from-left duration-300">
            <AdminSidebar
              activeTab={activeTab}
              onTabClick={t => {
                setActiveTab(t);
                setIsMenuOpen(false);
              }}
              onSignOut={signOut}
              profiles={profiles}
              failureCount={orders.filter(o => o.status === 'DELIVERY_FAILED').length}
            />
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 md:px-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-2 text-gray-500">
              <Menu size={22} />
            </button>
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
              {activeTab}
            </h2>
          </div>
          <button
            onClick={() => refreshData()}
            className="p-2.5 text-gray-400 hover:text-purple-600 bg-gray-50 rounded-xl transition-all border border-gray-100"
          >
            <RefreshCw size={16} />
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
                      className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest animate-pulse"
                    >
                      <span className="w-2 h-2 bg-amber-500 rounded-full" />
                      {pendingApprovals} aprovação{pendingApprovals > 1 ? 'ões' : ''} pendente{pendingApprovals > 1 ? 's' : ''}
                    </button>
                  )}
                </div>

                {/* KPIs - Linha 1: Contadores */}
                <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-gray-100">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-px">
                    {[
                      { icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', value: profiles.length, label: 'Usuários Cadastrados' },
                      { icon: Store, color: 'text-orange-600', bg: 'bg-orange-50', value: restaurants.length, label: 'Lojas Ativas' },
                      { icon: Bike, color: 'text-green-600', bg: 'bg-green-50', value: profiles.filter(p => p.role === 'DRIVER').length, label: 'Entregadores' },
                      { icon: LayoutDashboard, color: 'text-blue-600', bg: 'bg-blue-50', value: todayOrders.length, label: 'Pedidos Hoje' },
                    ].map((kpi, i) => (
                      <div key={i} className="bg-white p-5">
                        <div className={`w-10 h-10 rounded-xl ${kpi.bg} ${kpi.color} flex items-center justify-center mb-3`}>
                          <kpi.icon size={20} />
                        </div>
                        <p className="text-3xl font-black text-gray-900">{kpi.value}</p>
                        <p className="text-xs font-bold text-gray-400 mt-1">{kpi.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* KPIs - Linha 2: Financeiro */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    <div className="p-8">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">GMV Total (Volume)</p>
                      <p className="text-4xl font-black text-green-600">{fmt(totalRevenue)}</p>
                      <p className="text-gray-400 text-xs font-bold mt-2">{deliveredOrders.length} pedidos entregues</p>
                    </div>
                    <div className="p-8">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Receita Plataforma</p>
                      <p className="text-4xl font-black text-purple-600">{fmt(platformRevenue)}</p>
                      <p className="text-gray-400 text-xs font-bold mt-2">Taxa de 15% sobre subtotal</p>
                    </div>
                    <div className="p-8">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Ticket Médio</p>
                          <p className="text-4xl font-black text-gray-900">{fmt(avgTicket)}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                          <TrendingUp size={18} />
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
                </div>

                {/* Pedidos recentes */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                    <h4 className="text-base font-black text-gray-900">Pedidos Recentes</h4>
                    <button onClick={() => setActiveTab('orders')} className="text-xs font-black text-purple-600 uppercase tracking-widest hover:underline">
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
                        DELIVERY_FAILED: {label:'Não entregue', color:'text-red-700 bg-red-100'},
                        RETURNING: {label:'Devolvendo', color:'text-orange-600 bg-orange-50'},
                        RETURNED: {label:'Devolvido', color:'text-gray-500 bg-gray-100'},
                      };
                      const s = statusMap[o.status] || {label: o.status, color:'text-gray-500 bg-gray-100'};
                      return (
                        <div key={o.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                          <div>
                            <p className="font-black text-gray-900 text-sm">{o.restaurantName}</p>
                            <p className="text-gray-400 text-xs">{o.customerName} • #{o.id.slice(-6)}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg ${s.color}`}>{s.label}</span>
                            <span className="font-black text-gray-900 text-sm">{fmt(o.total)}</span>
                          </div>
                        </div>
                      );
                    })}
                    {orders.length === 0 && (
                      <p className="px-6 py-8 text-gray-400 text-sm font-bold text-center">Nenhum pedido ainda.</p>
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
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    size={16}
                  />
                  <input
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="Pesquisar..."
                    className="w-full p-3 pl-11 bg-white border border-gray-200 rounded-xl font-medium shadow-sm outline-none focus:border-purple-300 transition-all"
                  />
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 font-black text-gray-400 text-[10px] uppercase tracking-widest">
                        Usuário / Negócio
                      </th>
                      <th className="px-6 py-4 font-black text-gray-400 text-[10px] uppercase tracking-widest">
                        Papel
                      </th>
                      <th className="px-6 py-4 font-black text-gray-400 text-[10px] uppercase tracking-widest">
                        Status
                      </th>
                      <th className="px-6 py-4 font-black text-gray-400 text-[10px] uppercase tracking-widest text-center">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles
                      .filter(p =>
                        activeTab === 'users'
                          ? p.role === UserRole.CLIENT
                          : p.role !== UserRole.CLIENT
                      )
                      .map(p => (
                        <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-5">
                            <div className="font-black text-gray-900">
                              {p.businessName || p.name}
                            </div>
                            <div className="text-[10px] text-gray-500 font-bold">{p.email}</div>
                          </td>
                          <td className="px-6 py-5">
                            <span
                              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${p.role === UserRole.RESTAURANT ? 'bg-orange-50 text-orange-600' : p.role === UserRole.DRIVER ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}
                            >
                              {p.role}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <span
                              className={`font-bold text-[10px] ${p.status === 'APPROVED' ? 'text-green-600' : 'text-orange-500'}`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => setViewingUser(p)}
                                className="p-2.5 text-gray-400 bg-gray-100 rounded-xl hover:text-purple-600 hover:bg-purple-50 transition-all"
                                title="Ver dossiê"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                disabled={p.role === UserRole.ADMIN || !!approvalLoading[p.id]}
                                onClick={async () => {
                                  const newStatus = p.status === 'BLOCKED' ? 'APPROVED' : 'BLOCKED';
                                  const msg = newStatus === 'BLOCKED' ? 'Bloquear este usuário?' : 'Desbloquear este usuário?';
                                  if (!window.confirm(msg)) return;
                                  setApprovalLoading(prev => ({ ...prev, [p.id]: 'blocking' }));
                                  try { await updateUserProfile(p.id, { status: newStatus as any }); }
                                  catch (e: any) { alert('Erro: ' + e.message); }
                                  finally { setApprovalLoading(prev => ({ ...prev, [p.id]: null })); }
                                }}
                                className={`p-2.5 rounded-xl border transition-all disabled:opacity-20 ${
                                  p.status === 'BLOCKED'
                                    ? 'text-green-600 bg-green-50 border-green-100 hover:bg-green-600 hover:text-white'
                                    : 'text-orange-500 bg-orange-50 border-orange-100 hover:bg-orange-500 hover:text-white'
                                }`}
                                title={p.status === 'BLOCKED' ? 'Desbloquear' : 'Bloquear'}
                              >
                                {approvalLoading[p.id] === 'blocking'
                                  ? <Loader size={16} className="animate-spin" />
                                  : p.status === 'BLOCKED' ? <Shield size={16} /> : <Shield size={16} />
                                }
                              </button>
                              <button
                                onClick={async () => {
                                  if (!window.confirm(`Excluir permanentemente ${p.name}? Esta ação não pode ser desfeita.`)) return;
                                  try { await deleteUserProfile(p.id); }
                                  catch (e: any) { alert('Erro ao excluir: ' + e.message); }
                                }}
                                disabled={p.role === UserRole.ADMIN}
                                className="p-2.5 text-red-400 bg-red-50 border border-red-100 rounded-xl hover:bg-red-600 hover:text-white transition-all disabled:opacity-20"
                                title="Excluir conta"
                              >
                                <Trash2 size={16} />
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
                <div className="flex items-center gap-2 text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 border border-green-100 px-4 py-2 rounded-xl">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block"></span>
                  Tempo Real
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {profiles.filter(p => p.status === 'PENDING').length === 0 ? (
                  <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-gray-100 text-gray-300 font-black uppercase tracking-widest text-xs">
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
                              const { error: activateErr } = await supabase
                                .from('restaurants')
                                .update({ is_active: true })
                                .eq('id', restaurantId);
                              if (activateErr) throw new Error(`Perfil aprovado, mas loja não ativada: ${activateErr.message}`);
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
                          className="bg-white p-6 rounded-2xl border border-orange-100 shadow-sm animate-in zoom-in-95 relative overflow-hidden"
                        >
                          {/* Badge NOVO piscando */}
                          <span className="absolute top-4 right-4 bg-orange-500 text-white text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest animate-pulse">
                            Novo
                          </span>

                          <div className="flex items-center gap-4 mb-6">
                            <div
                              className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${p.role === UserRole.RESTAURANT ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}
                            >
                              {p.role === UserRole.RESTAURANT ? (
                                <Store size={22} />
                              ) : (
                                <Bike size={22} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-black text-gray-900 text-base truncate">
                                {p.businessName || p.name}
                              </h4>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                {p.role === UserRole.RESTAURANT ? 'Lojista' : 'Entregador'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mb-6">
                            <div className="p-3 border-b border-gray-100">
                              <p className="text-[8px] font-black text-gray-400 uppercase mb-1">
                                Nome
                              </p>
                              <p className="font-black text-xs truncate">{p.name || '---'}</p>
                            </div>
                            <div className="p-3 border-b border-gray-100">
                              <p className="text-[8px] font-black text-gray-400 uppercase mb-1">
                                WhatsApp
                              </p>
                              <p className="font-black text-xs">{p.phoneNumber || '---'}</p>
                            </div>
                            <div className="p-3">
                              <p className="text-[8px] font-black text-gray-400 uppercase mb-1">
                                Documento
                              </p>
                              <p className="font-black text-xs truncate">
                                {p.cpf || p.cnpj || '---'}
                              </p>
                            </div>
                            <div className="p-3">
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
                              className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                              {approvalLoading[p.id] === 'approving' ? (
                                <Loader size={14} className="animate-spin" />
                              ) : null}
                              Aprovar
                            </button>
                            <button
                              onClick={() => handleApproval('BLOCKED')}
                              disabled={isProcessing}
                              className="px-5 bg-red-50 text-red-600 border border-red-100 rounded-xl font-black text-xs uppercase transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center"
                            >
                              {approvalLoading[p.id] === 'blocking' ? (
                                <Loader size={14} className="animate-spin" />
                              ) : (
                                <X size={16} />
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

          {activeTab === 'support' && (() => {
            const openCount = supportTickets.filter(t => t.status === 'OPEN').length;
            const filtered = supportTickets.filter(t => {
              const statusOk = supportFilter === 'ALL' || t.status === supportFilter;
              const roleOk = supportRoleFilter === 'ALL' || t.user_role === supportRoleFilter;
              return statusOk && roleOk;
            });

            const resolveTicket = async (id: string) => {
              await supabase.from('support_tickets').update({
                status: 'RESOLVED',
                admin_note: replyNote,
                resolved_at: new Date().toISOString(),
              }).eq('id', id);
              setReplyingTo(null);
              setReplyNote('');
              fetchSupportTickets();
            };

            const deleteTicket = async (id: string) => {
              if (!window.confirm('Excluir este ticket?')) return;
              await supabase.from('support_tickets').delete().eq('id', id);
              fetchSupportTickets();
            };

            const roleColors: Record<string, string> = {
              RESTAURANT: 'bg-orange-50 text-orange-600',
              DRIVER: 'bg-green-50 text-green-600',
              CLIENT: 'bg-blue-50 text-blue-600',
              ADMIN: 'bg-purple-50 text-purple-600',
            };

            return (
              <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-gray-900 tracking-tighter">Tickets de Suporte</h3>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">
                      {openCount} aberto{openCount !== 1 ? 's' : ''} · {supportTickets.length} total
                    </p>
                  </div>
                  <button onClick={fetchSupportTickets} className="p-2.5 bg-gray-100 rounded-xl hover:bg-gray-200 transition border border-gray-100">
                    <RefreshCw size={15} className={supportLoading ? 'animate-spin' : ''} />
                  </button>
                </div>

                {/* Filters */}
                <div className="space-y-2">
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {(['ALL', 'OPEN', 'RESOLVED'] as const).map(f => (
                      <button key={f} onClick={() => setSupportFilter(f)}
                        className={`shrink-0 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                          supportFilter === f ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}>
                        {f === 'ALL' ? 'Todos' : f === 'OPEN' ? 'Abertos' : 'Resolvidos'}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {(['ALL', 'RESTAURANT', 'DRIVER', 'CLIENT'] as const).map(r => (
                      <button key={r} onClick={() => setSupportRoleFilter(r)}
                        className={`shrink-0 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                          supportRoleFilter === r ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}>
                        {r === 'ALL' ? 'Todos' : r === 'RESTAURANT' ? '🏪 Lojista' : r === 'DRIVER' ? '🏍️ Entregador' : '👤 Cliente'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ticket list */}
                {supportLoading ? (
                  <div className="flex justify-center py-16"><Loader className="animate-spin text-purple-500" size={32} /></div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                    <MessageSquare size={40} className="mx-auto mb-4 text-gray-200" />
                    <p className="font-black text-gray-400">Nenhum ticket encontrado</p>
                    <p className="text-gray-300 text-sm mt-1">Tudo resolvido por aqui 🎉</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {filtered.map((ticket, idx) => (
                      <div key={ticket.id} className={`p-5 border-b border-gray-100 transition-all ${idx === filtered.length - 1 ? 'border-b-0' : ''} ${
                        ticket.status === 'OPEN' ? 'bg-white' : 'bg-gray-50/50'
                      }`}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest ${
                              roleColors[ticket.user_role] || 'bg-gray-100 text-gray-500'
                            }`}>
                              {ticket.user_role}
                            </span>
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase ${
                              ticket.status === 'OPEN' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                            }`}>
                              {ticket.status === 'OPEN' ? '● Aberto' : '✓ Resolvido'}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-bold">
                            {new Date(ticket.created_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}
                          </span>
                        </div>

                        <div className="mb-3">
                          <p className="font-black text-gray-900">{ticket.user_name}</p>
                          {ticket.user_email && <p className="text-xs text-gray-400">{ticket.user_email}</p>}
                        </div>

                        <p className="text-sm text-gray-700 font-medium leading-relaxed mb-3">
                          {ticket.message}
                        </p>

                        {ticket.admin_note && (
                          <div className="mt-2 mb-3 bg-purple-50 border border-purple-100 p-3 rounded-xl">
                            <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-1">Nota interna</p>
                            <p className="text-sm text-purple-800 font-medium">{ticket.admin_note}</p>
                          </div>
                        )}

                        {replyingTo === ticket.id && (
                          <div className="mt-2 mb-3">
                            <textarea
                              value={replyNote}
                              onChange={e => setReplyNote(e.target.value)}
                              rows={3}
                              className="w-full p-3 bg-gray-50 rounded-xl text-sm font-medium outline-none border border-purple-200 focus:border-purple-400 resize-none"
                              placeholder="Nota interna ou observação sobre a resolução..."
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          {ticket.status === 'OPEN' && (
                            replyingTo === ticket.id ? (
                              <>
                                <button
                                  onClick={() => resolveTicket(ticket.id)}
                                  className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-purple-500 transition"
                                >✓ Confirmar Resolução</button>
                                <button
                                  onClick={() => { setReplyingTo(null); setReplyNote(''); }}
                                  className="px-4 py-2 border border-gray-200 text-gray-500 rounded-xl text-xs font-black uppercase"
                                >Cancelar</button>
                              </>
                            ) : (
                              <button
                                onClick={() => setReplyingTo(ticket.id)}
                                className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-purple-500 transition"
                              >Marcar Resolvido</button>
                            )
                          )}
                          <button
                            onClick={() => deleteTicket(ticket.id)}
                            className="ml-auto p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                          ><Trash2 size={15} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {activeTab === 'reviews' && (() => {
            const ratedOrders = orders
              .filter(o => o.rating)
              .sort((a, b) => b.timestamp - a.timestamp);

            const byRestaurant = restaurants.map(r => {
              const restOrders = ratedOrders.filter(o => o.restaurantId === r.id);
              const avg = restOrders.length
                ? restOrders.reduce((s, o) => s + ((o.rating as any)?.storeStars ?? 0), 0) / restOrders.length
                : 0;
              return { restaurant: r, orders: restOrders, avg };
            }).filter(x => x.orders.length > 0).sort((a, b) => b.avg - a.avg);

            const globalAvg = ratedOrders.length
              ? ratedOrders.reduce((s, o) => s + ((o.rating as any)?.storeStars ?? 0), 0) / ratedOrders.length
              : 0;

            return (
              <div className="space-y-8 animate-in fade-in">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tighter">Avaliações</h3>
                  <p className="text-sm text-gray-400 font-medium mt-1">{ratedOrders.length} avaliações no total</p>
                </div>

                {/* KPIs globais */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                    {[
                      { label: 'Média Geral', value: globalAvg.toFixed(1) + ' ⭐', color: 'text-amber-500' },
                      { label: 'Total de Avaliações', value: ratedOrders.length, color: 'text-purple-600' },
                      { label: 'Restaurantes Avaliados', value: byRestaurant.length, color: 'text-blue-600' },
                    ].map(k => (
                      <div key={k.label} className="p-5 text-center">
                        <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{k.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ranking por restaurante */}
                {byRestaurant.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-2">
                      <Award size={15} className="text-gray-400" />
                      <h4 className="font-black text-sm uppercase tracking-widest text-gray-400">Ranking de Restaurantes</h4>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {byRestaurant.map(({ restaurant: r, orders: ro, avg }, idx) => (
                        <div key={r.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                          <span className="text-base font-black text-gray-300 w-6 text-center">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-gray-800 text-sm truncate">{r.name}</p>
                            <p className="text-xs text-gray-400 font-medium">{ro.length} avaliações</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} size={12} className={s <= Math.round(avg) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                            ))}
                            <span className="text-sm font-black text-gray-700 ml-2">{avg.toFixed(1)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feed de todas as avaliações */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-2">
                    <MessageSquare size={15} className="text-gray-400" />
                    <h4 className="font-black text-sm uppercase tracking-widest text-gray-400">Todas as Avaliações</h4>
                  </div>
                  {ratedOrders.length === 0 ? (
                    <p className="text-gray-400 text-sm font-medium text-center py-8">Nenhuma avaliação ainda.</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {ratedOrders.map(order => {
                        const r = order.rating as any;
                        const storeStars: number = r?.storeStars ?? 0;
                        const driverStars: number = r?.driverStars ?? 0;
                        return (
                          <div key={order.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div className="min-w-0">
                                <p className="font-black text-gray-800 text-sm truncate">{order.customerName}</p>
                                <p className="text-xs text-gray-400 font-medium truncate">{order.restaurantName}</p>
                              </div>
                              <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap">
                                {new Date(order.timestamp).toLocaleDateString('pt-BR')}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-3 mb-2">
                              {/* Estrelas restaurante */}
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-1">Loja</span>
                                {[1,2,3,4,5].map(s => (
                                  <Star key={s} size={11} className={s <= storeStars ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                                ))}
                              </div>
                              {/* Estrelas entregador */}
                              {driverStars > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-1">Entregador</span>
                                  {[1,2,3,4,5].map(s => (
                                    <Star key={s} size={11} className={s <= driverStars ? 'fill-blue-400 text-blue-400' : 'text-gray-200'} />
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Badges produto/embalagem */}
                            <div className="flex gap-2 mb-2">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${r?.productOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                {r?.productOk ? '✓ Produto OK' : '✗ Produto com problema'}
                              </span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${r?.packagingOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                {r?.packagingOk ? '✓ Embalagem OK' : '✗ Embalagem com problema'}
                              </span>
                            </div>

                            {r?.comment && (
                              <p className="text-sm text-gray-600 italic">"{r.comment}"</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {activeTab === 'failures' && (() => {
            const failedOrders = orders.filter(o =>
              ['DELIVERY_FAILED', 'RETURNING', 'RETURNED'].includes(o.status)
            ).sort((a, b) => b.timestamp - a.timestamp);

            return (
              <div className="space-y-6 animate-in fade-in">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tighter">Devoluções</h3>
                  <p className="text-gray-400 text-sm mt-1">Acompanhe as entregas não concluídas e autorize devoluções.</p>
                </div>

                {failedOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                    <CheckCircle size={40} className="mx-auto mb-4 text-green-400" />
                    <p className="font-black text-gray-700 text-lg">Nenhuma falha de entrega</p>
                    <p className="text-gray-400 text-sm mt-1">Todas as entregas estão em ordem.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {failedOrders.map(order => {
                      const driver = profiles.find(p => p.id === order.driverId);
                      const restaurant = restaurants.find(r => r.id === order.restaurantId);
                      const restaurantOwner = profiles.find(p => p.id === restaurant?.ownerId);
                      const statusColors: Record<string, string> = {
                        DELIVERY_FAILED: 'border-red-200',
                        RETURNING: 'border-orange-200',
                        RETURNED: 'border-gray-200',
                      };
                      const statusLabels: Record<string, string> = {
                        DELIVERY_FAILED: '⚠️ Não entregue',
                        RETURNING: '🔄 Devolvendo',
                        RETURNED: '📦 Devolvido',
                      };
                      const isMessaging = messagingOrderId === order.id;

                      return (
                        <div key={order.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${statusColors[order.status] || 'border-gray-100'}`}>
                          {/* Header */}
                          <div className="px-6 py-4 flex items-start justify-between gap-4 border-b border-gray-100">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${
                                  order.status === 'DELIVERY_FAILED' ? 'bg-red-100 text-red-700'
                                  : order.status === 'RETURNING' ? 'bg-orange-100 text-orange-700'
                                  : 'bg-gray-100 text-gray-500'
                                }`}>{statusLabels[order.status] || order.status}</span>
                                <span className="text-gray-400 text-xs">#{order.id.slice(-6)}</span>
                              </div>
                              <p className="font-black text-gray-900">{order.restaurantName}</p>
                              <p className="text-gray-500 text-sm">{new Date(order.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-black text-gray-900 text-lg">R$ {order.total.toFixed(2)}</p>
                              <p className="text-gray-400 text-xs">a reembolsar</p>
                            </div>
                          </div>

                          {/* Motivo */}
                          {order.failureReason && (
                            <div className="px-6 pt-3">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Motivo relatado</p>
                              <p className="text-gray-700 text-sm font-medium bg-gray-50 rounded-xl px-3 py-2">{order.failureReason}</p>
                            </div>
                          )}

                          {/* Contatos das 3 partes */}
                          <div className="px-6 pt-4 pb-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Cliente */}
                            <div className="bg-gray-50 rounded-xl p-3">
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">👤 Cliente</p>
                              <p className="font-black text-gray-900 text-sm">{order.customerName}</p>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                <button
                                  onClick={() => {
                                    setMessagingOrderId(order.id);
                                    setMessageTarget('client');
                                    setMessageText('');
                                  }}
                                  className="flex items-center gap-1 text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-1 rounded-lg hover:bg-purple-100 transition-all"
                                >
                                  <MessageSquare size={10} /> Chat
                                </button>
                                {order.customerPhone && <>
                                  <a href={`tel:${order.customerPhone.replace(/\D/g, '')}`}
                                    className="flex items-center gap-1 text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100 transition-all">
                                    <Phone size={10} /> Ligar
                                  </a>
                                  <a href={`https://wa.me/55${order.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${order.customerName}! Suporte DeliveryCity. Seu pedido de ${order.restaurantName} não pôde ser entregue. Como posso ajudar?`)}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[10px] font-black text-green-700 bg-green-50 px-2 py-1 rounded-lg hover:bg-green-100 transition-all">
                                    <MessageSquare size={10} /> WhatsApp
                                  </a>
                                </>}
                              </div>
                            </div>

                            {/* Entregador */}
                            <div className="bg-gray-50 rounded-xl p-3">
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">🏍️ Entregador</p>
                              <p className="font-black text-gray-900 text-sm">{driver?.name || order.driverName || '—'}</p>
                              {driver && (
                                <div className="flex items-center gap-1 mt-1">
                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${(driver.driverScore ?? 100) >= 80 ? 'bg-green-100 text-green-700' : (driver.driverScore ?? 100) >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                    Score {driver.driverScore ?? 100}
                                  </span>
                                </div>
                              )}
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {driver && (
                                  <button
                                    onClick={() => {
                                      setMessagingOrderId(order.id);
                                      setMessageTarget('driver');
                                      setMessageText('');
                                    }}
                                    className="flex items-center gap-1 text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-1 rounded-lg hover:bg-purple-100 transition-all"
                                  >
                                    <MessageSquare size={10} /> Chat
                                  </button>
                                )}
                                {driver?.phoneNumber && (
                                  <a href={`tel:${driver.phoneNumber.replace(/\D/g, '')}`}
                                    className="flex items-center gap-1 text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100 transition-all">
                                    <Phone size={10} /> Ligar
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Restaurante */}
                            <div className="bg-gray-50 rounded-xl p-3">
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">🏪 Restaurante</p>
                              <p className="font-black text-gray-900 text-sm">{order.restaurantName}</p>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {restaurantOwner && (
                                  <button
                                    onClick={() => {
                                      setMessagingOrderId(order.id);
                                      setMessageTarget('restaurant');
                                      setMessageText('');
                                    }}
                                    className="flex items-center gap-1 text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-1 rounded-lg hover:bg-purple-100 transition-all"
                                  >
                                    <MessageSquare size={10} /> Chat
                                  </button>
                                )}
                                {restaurant?.phoneNumber && (
                                  <a href={`tel:${restaurant.phoneNumber.replace(/\D/g, '')}`}
                                    className="flex items-center gap-1 text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100 transition-all">
                                    <Phone size={10} /> Ligar
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Painel de mensagem interna */}
                          {isMessaging && messageTarget && (
                            <div className="px-6 pb-4">
                              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-xs font-black text-purple-700 uppercase tracking-widest">
                                    Mensagem para {messageTarget === 'client' ? order.customerName : messageTarget === 'driver' ? (driver?.name || 'entregador') : order.restaurantName}
                                  </p>
                                  <button onClick={() => { setMessagingOrderId(null); setMessageTarget(null); }} className="text-gray-400 hover:text-gray-600">
                                    <X size={14} />
                                  </button>
                                </div>
                                <textarea
                                  value={messageText}
                                  onChange={e => setMessageText(e.target.value)}
                                  placeholder="Digite sua mensagem..."
                                  rows={3}
                                  className="w-full text-sm border border-purple-200 rounded-xl p-3 outline-none focus:border-purple-400 resize-none font-medium"
                                />
                                <div className="flex gap-2 mt-2">
                                  {['Seu pedido não foi entregue. Tentamos contato.', 'Por favor, aguarde. Estamos resolvendo.', 'Devolução autorizada. O entregador levará o pedido ao restaurante.'].map(preset => (
                                    <button key={preset} onClick={() => setMessageText(preset)}
                                      className="text-[10px] font-bold text-purple-600 bg-white border border-purple-200 px-2 py-1 rounded-lg hover:bg-purple-50 transition-all">
                                      {preset.slice(0, 28)}...
                                    </button>
                                  ))}
                                </div>
                                <button
                                  disabled={!messageText.trim() || sendingMessage}
                                  onClick={async () => {
                                    setSendingMessage(true);
                                    try {
                                      let toUserId = '';
                                      let toName = '';
                                      let toRole = '';
                                      if (messageTarget === 'client' && order.customerId) {
                                        toUserId = order.customerId; toName = order.customerName; toRole = 'CLIENT';
                                      } else if (messageTarget === 'driver' && order.driverId) {
                                        toUserId = order.driverId; toName = driver?.name || 'Entregador'; toRole = 'DRIVER';
                                      } else if (messageTarget === 'restaurant' && restaurantOwner?.id) {
                                        toUserId = restaurantOwner.id; toName = order.restaurantName; toRole = 'RESTAURANT';
                                      }
                                      if (toUserId) {
                                        await sendAdminMessage(toUserId, toName, toRole, messageText, order.id);
                                        setMessageText('');
                                        setMessagingOrderId(null);
                                        setMessageTarget(null);
                                      }
                                    } catch (e: any) {
                                      alert('Erro: ' + e.message);
                                    } finally {
                                      setSendingMessage(false);
                                    }
                                  }}
                                  className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 text-white rounded-xl font-black text-sm disabled:opacity-40 active:scale-95 transition-all"
                                >
                                  {sendingMessage ? <><Loader size={14} className="animate-spin" /> Enviando...</> : <><MessageSquare size={14} /> Enviar mensagem</>}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Protocolo de escalação — só para DELIVERY_FAILED */}
                          {order.status === 'DELIVERY_FAILED' && (
                            <div className="px-6 pb-5">
                              <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                                <p className="text-xs font-black text-orange-800 mb-3">📋 Protocolo de atendimento</p>
                                <div className="space-y-1.5 text-xs text-orange-700 font-medium mb-4">
                                  <p>1. Envie mensagem pelo chat interno (botão "Chat")</p>
                                  <p>2. Se não responder → ligue para o cliente</p>
                                  <p>3. Sem resposta → envie WhatsApp</p>
                                  <p>4. Sem comunicação → autorize a devolução abaixo</p>
                                </div>
                                <button
                                  disabled={authorizingReturnId === order.id}
                                  onClick={async () => {
                                    setAuthorizingReturnId(order.id);
                                    try {
                                      // 1. Processa o reembolso imediatamente
                                      await supabase.functions.invoke('refund-asaas-payment', { body: { orderId: order.id } });

                                      // 2. Notifica o cliente que o reembolso foi aprovado
                                      if (order.customerId) {
                                        supabase.functions.invoke('send-push-notification', {
                                          body: {
                                            userId: order.customerId,
                                            title: '💚 Reembolso aprovado',
                                            body: 'O suporte aprovou seu reembolso. O valor será creditado em breve.',
                                            data: { orderId: order.id, type: 'REFUND_APPROVED' },
                                          },
                                        }).catch(() => {});
                                      }

                                      // 3. Notifica o entregador para devolver o pedido
                                      if (order.driverId) {
                                        supabase.functions.invoke('send-push-notification', {
                                          body: {
                                            userId: order.driverId,
                                            title: '✅ Devolução autorizada',
                                            body: `Leve o pedido #${order.id.slice(-4)} ao restaurante ${order.restaurantName}. Peça o código de devolução.`,
                                            data: { orderId: order.id, type: 'RETURN_AUTHORIZED' },
                                          },
                                        }).catch(() => {});
                                      }

                                      // 4. Registra o evento
                                      supabase.from('support_tickets').insert({
                                        user_id: order.driverId || order.customerId,
                                        user_name: driver?.name || 'Admin',
                                        user_role: 'DRIVER',
                                        message: `[ADMIN] Devolução autorizada + reembolso processado — Pedido #${order.id}. Motivo: ${order.failureReason || 'não informado'}`,
                                        status: 'RESOLVED',
                                        from_admin: true,
                                        order_id: order.id,
                                        created_at: new Date().toISOString(),
                                      }).then(null, () => {});

                                      setAuthorizingReturnId(null);
                                    } catch (e: any) {
                                      alert('Erro ao processar reembolso: ' + (e?.message || 'tente novamente'));
                                      setAuthorizingReturnId(null);
                                    }
                                  }}
                                  className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-orange-600 text-white rounded-xl font-black text-sm disabled:opacity-50 active:scale-95 transition-all"
                                >
                                  {authorizingReturnId === order.id
                                    ? <><Loader size={14} className="animate-spin" /> Processando reembolso...</>
                                    : <><RotateCcw size={14} /> Autorizar devolução + reembolsar cliente</>
                                  }
                                </button>
                              </div>
                            </div>
                          )}

                          {order.status === 'RETURNING' && (
                            <div className="px-6 pb-5">
                              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-3">
                                <RotateCcw size={16} className="text-blue-500 animate-spin" style={{ animationDuration: '3s' }} />
                                <div>
                                  <p className="text-sm font-bold text-blue-700">Entregador a caminho do restaurante</p>
                                  <p className="text-xs text-blue-500">O restaurante gerará um código de devolução e o entregador confirmará no app.</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {order.status === 'RETURNED' && (
                            <div className="px-6 pb-5">
                              <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-center gap-3">
                                <Package size={16} className="text-green-500" />
                                <div>
                                  <p className="text-sm font-bold text-green-700">Devolução concluída ✓</p>
                                  <p className="text-xs text-green-500">Entregador confirmou via código. Reembolso já foi processado na autorização.</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {activeTab === 'orders' && (() => {
            const statusOptions = [
              { value: 'ALL', label: 'Todos' },
              { value: 'PENDING', label: 'Pendentes' },
              { value: 'PREPARING', label: 'Preparando' },
              { value: 'READY', label: 'Prontos' },
              { value: 'OUT_FOR_DELIVERY', label: 'Em Entrega' },
              { value: 'DELIVERED', label: 'Entregues' },
              { value: 'CANCELLED', label: 'Cancelados' },
              { value: 'DELIVERY_FAILED', label: 'Não entregues' },
              { value: 'RETURNING', label: 'Devolvendo' },
              { value: 'RETURNED', label: 'Devolvidos' },
            ];
            const statusMap: Record<string, { label: string; color: string }> = {
              PENDING: { label: 'Aguardando', color: 'text-yellow-600 bg-yellow-50' },
              PENDING_PAYMENT: { label: 'Aguard. Pgto', color: 'text-orange-600 bg-orange-50' },
              PREPARING: { label: 'Preparando', color: 'text-blue-600 bg-blue-50' },
              READY: { label: 'Pronto', color: 'text-green-600 bg-green-50' },
              OUT_FOR_DELIVERY: { label: 'Em Entrega', color: 'text-purple-600 bg-purple-50' },
              DELIVERED: { label: 'Entregue', color: 'text-gray-600 bg-gray-100' },
              CANCELLED: { label: 'Cancelado', color: 'text-red-600 bg-red-50' },
              DELIVERY_FAILED: { label: 'Não entregue', color: 'text-red-700 bg-red-100' },
              RETURNING: { label: 'Devolvendo', color: 'text-orange-600 bg-orange-50' },
              RETURNED: { label: 'Devolvido', color: 'text-gray-500 bg-gray-100' },
            };
            const filtered = ordersStatusFilter === 'ALL'
              ? orders
              : orders.filter(o => o.status === ordersStatusFilter);

            return (
              <div className="space-y-6 animate-in fade-in">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <h3 className="text-2xl font-black text-gray-900 tracking-tighter">Todos os Pedidos</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {statusOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setOrdersStatusFilter(opt.value)}
                        className={`text-xs font-black px-3 py-1.5 rounded-xl transition-all ${
                          ordersStatusFilter === opt.value
                            ? 'bg-purple-600 text-white'
                            : 'bg-white text-gray-500 border border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        {opt.label}
                        {opt.value !== 'ALL' && (
                          <span className="ml-1 opacity-60">
                            ({orders.filter(o => o.status === opt.value).length})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="divide-y divide-gray-50">
                    {filtered.slice(0, 50).map(o => {
                      const s = statusMap[o.status] || { label: o.status, color: 'text-gray-500 bg-gray-100' };
                      const driver = profiles.find(p => p.id === o.driverId);
                      return (
                        <div key={o.id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-black text-gray-900 text-sm">{o.restaurantName}</p>
                              <span className="text-gray-300 text-xs">#{o.id.slice(-6)}</span>
                            </div>
                            <p className="text-gray-400 text-xs mt-0.5">
                              {o.customerName}
                              {driver && <span className="text-gray-300"> · 🏍️ {driver.name}</span>}
                              {' · '}{new Date(o.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {o.failureReason && (
                              <p className="text-red-400 text-[10px] mt-0.5 italic">Motivo: {o.failureReason}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg ${s.color}`}>{s.label}</span>
                            <span className="font-black text-gray-900 text-sm">R$ {o.total.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                    {filtered.length === 0 && (
                      <p className="px-6 py-12 text-center text-gray-400 font-bold">Nenhum pedido com esse status.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === 'settings' && <SettingsTab />}

          {activeTab === 'system' && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-2xl font-black text-gray-900 tracking-tighter">
                Integridade do Sistema
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
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
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
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
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-center px-8 py-5 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tighter">
                  Dossiê do Usuário
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{viewingUser.email}</p>
              </div>
              <button
                onClick={() => setViewingUser(null)}
                className="p-2.5 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form
              id="user-dossier-form"
              onSubmit={handleUpdateDossier}
              className="flex-1 overflow-y-auto no-scrollbar space-y-5 px-8 py-6 pb-10"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 tracking-widest">
                    Nome Completo
                  </label>
                  <input
                    name="name"
                    defaultValue={viewingUser.name}
                    className="w-full mt-1.5 p-3.5 bg-white rounded-xl font-bold border border-gray-200 focus:border-purple-400 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 tracking-widest">
                    Status da Conta
                  </label>
                  <select
                    name="status"
                    defaultValue={viewingUser.status}
                    className="w-full mt-1.5 p-3.5 bg-white rounded-xl font-bold border border-gray-200 focus:border-purple-400 outline-none appearance-none transition-all"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="BLOCKED">BLOCKED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 tracking-widest flex items-center gap-2">
                    <DollarSign size={11} /> ID Subconta Asaas
                  </label>
                  <input
                    name="asaasAccountId"
                    defaultValue={viewingUser.asaasAccountId || ''}
                    className="w-full mt-1.5 p-3.5 bg-white rounded-xl font-bold border border-gray-200 outline-none transition-all"
                    readOnly
                    placeholder="Gerado automaticamente"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 tracking-widest flex items-center gap-2">
                    <Wallet size={11} /> Chave PIX
                  </label>
                  <input
                    name="pixKey"
                    defaultValue={viewingUser.pixKey || ''}
                    className="w-full mt-1.5 p-3.5 bg-white rounded-xl font-bold border border-gray-200 focus:border-purple-400 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 tracking-widest">
                    CPF / CNPJ
                  </label>
                  <input
                    name="cpf"
                    defaultValue={viewingUser.cpf || viewingUser.cnpj || ''}
                    className="w-full mt-1.5 p-3.5 bg-white rounded-xl font-bold border border-gray-200 focus:border-purple-400 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 tracking-widest">
                    WhatsApp
                  </label>
                  <input
                    name="phone"
                    defaultValue={viewingUser.phoneNumber || ''}
                    className="w-full mt-1.5 p-3.5 bg-white rounded-xl font-bold border border-gray-200 focus:border-purple-400 outline-none transition-all"
                  />
                </div>
              </div>

              {viewingUser.role === UserRole.RESTAURANT && (
                <div className="space-y-5 pt-4 border-t border-gray-100">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 tracking-widest">
                      Nome da Loja
                    </label>
                    <input
                      name="businessName"
                      defaultValue={viewingUser.businessName || ''}
                      className="w-full mt-1.5 p-3.5 bg-orange-50 rounded-xl font-black border border-orange-100 focus:border-purple-400 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 tracking-widest">
                      Horário de Funcionamento
                    </label>
                    <input
                      name="workingHours"
                      defaultValue={viewingUser.workingHours || ''}
                      className="w-full mt-1.5 p-3.5 bg-orange-50 rounded-xl font-black border border-orange-100 focus:border-purple-400 outline-none transition-all"
                    />
                  </div>
                   <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 tracking-widest">
                      Descrição
                    </label>
                    <textarea
                      name="description"
                      defaultValue={viewingUser.description || ''}
                      className="w-full mt-1.5 p-3.5 bg-orange-50 rounded-xl font-black border border-orange-100 focus:border-purple-400 outline-none h-24 resize-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-orange-600 uppercase ml-1 tracking-widest flex items-center gap-2">
                      <DollarSign size={11} /> Taxa Personalizada do Lojista (%)
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        name="customFeePct"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={(viewingUser as any).customFeePct ?? ''}
                        placeholder="Deixe vazio para usar a taxa global"
                        className="w-full p-3.5 pr-10 bg-orange-50 rounded-xl font-black border border-orange-100 focus:border-orange-400 outline-none transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-500 font-black">%</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 ml-1">Se preenchido, sobrescreve a taxa global de lojistas para esta loja específica</p>
                  </div>
                </div>
              )}

              {viewingUser.role === UserRole.DRIVER && (
                <div className="space-y-5 pt-4 border-t border-gray-100">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 tracking-widest">
                      Placa do Veículo
                    </label>
                    <input
                      name="licensePlate"
                      defaultValue={viewingUser.licensePlate || ''}
                      className="w-full mt-1.5 p-3.5 bg-green-50 rounded-xl font-black border border-green-100 focus:border-purple-400 outline-none uppercase transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-green-600 uppercase ml-1 tracking-widest flex items-center gap-2">
                      <DollarSign size={11} /> Taxa Personalizada do Entregador (%)
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        name="customFeePct"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={viewingUser.customFeePct ?? ''}
                        placeholder="Deixe vazio para usar a taxa global"
                        className="w-full p-3.5 pr-10 bg-green-50 rounded-xl font-black border border-green-100 focus:border-green-400 outline-none transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500 font-black">%</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 ml-1">Se preenchido, sobrescreve a taxa global de entregadores para este parceiro</p>
                  </div>
                </div>
              )}
            </form>

            <div className="px-8 py-5 border-t border-gray-100 shrink-0 space-y-3">
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetPasswordLoading}
                className="w-full bg-red-50 text-red-600 border border-red-100 py-3 rounded-xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
              >
                {resetPasswordLoading ? (
                  <Loader className="animate-spin" size={16} />
                ) : (
                  <span>🔒</span>
                )}
                <span>Enviar Link de Redefinição de Senha</span>
              </button>
              <button
                form="user-dossier-form"
                type="submit"
                disabled={isSaving}
                className="w-full bg-purple-600 text-white py-4 rounded-xl font-black text-sm flex items-center justify-center gap-3 active:scale-95 transition-all shadow-sm disabled:opacity-50"
              >
                {isSaving ? <Loader className="animate-spin" size={16} /> : <Save size={16} />}
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
