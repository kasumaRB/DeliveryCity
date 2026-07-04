import React, { useState } from 'react';
import { AppProvider, useAppStore } from './store';
// NOTA: imports ESTÁTICOS de propósito. O code-splitting com React.lazy (import()
// dinâmico) quebra no APK/Capacitor (o WebView não resolve os chunks e a tela fica
// presa no Suspense). Bundle único é seguro no nativo.
import { ClientView } from './views/ClientView';
import { RestaurantView } from './views/RestaurantView';
import { DriverView } from './views/DriverView';
import { AdminView } from './views/AdminView';
import { AuthView } from './views/AuthView';
import { UserRole } from './types';
import { Clock, LogOut, Phone, XCircle, RefreshCw, AlertTriangle, Loader } from 'lucide-react';
import { useAndroidBack } from './hooks/useAndroidBack';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    const isChunkError = /Loading chunk|Failed to fetch dynamically imported|Importing a module script failed/i.test(error.message);
    if (isChunkError) {
      window.location.reload();
      return { hasError: false, error: '' };
    }
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-white p-10 text-center">
          <div className="w-24 h-24 bg-red-50 text-red-500 rounded-[2.5rem] flex items-center justify-center mb-8 mx-auto">
            <AlertTriangle size={44} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-3">Algo deu errado</h1>
          <p className="text-gray-400 text-sm mb-8 max-w-sm">{this.state.error || 'Erro inesperado na aplicação.'}</p>
          <button
            onClick={() => { this.setState({ hasError: false, error: '' }); window.location.reload(); }}
            className="flex items-center gap-3 px-8 py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest"
          >
            <RefreshCw size={16} /> Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PendingApprovalView: React.FC<{ profile: any; onSignOut: () => void }> = ({ profile, onSignOut }) => (
  <div className="h-screen w-screen flex flex-col items-center justify-center bg-white p-10 text-center animate-in fade-in duration-700">
    <div className="w-28 h-28 bg-orange-50 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-xl shadow-orange-100">
      <Clock size={48} className="text-orange-600" />
    </div>
    <h1 className="text-4xl font-black mb-4 tracking-tighter">Análise em Andamento</h1>
    <p className="text-gray-500 max-w-sm mb-12 font-medium">
      Olá, {profile.name}. Seu cadastro como parceiro está sendo verificado pela nossa equipe.
      Isso garante a qualidade e segurança dos serviços na nossa cidade.
    </p>
    <div className="bg-gray-50 p-6 rounded-[2rem] w-full max-w-sm mb-12 flex items-center gap-6 border border-gray-100">
      <div className="bg-green-100 p-3 rounded-xl text-green-600"><Phone size={24} /></div>
      <div className="text-left">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Suporte via WhatsApp</p>
        <p className="text-lg font-black text-gray-900">{import.meta.env.VITE_SUPPORT_PHONE || '(00) 00000-0000'}</p>
      </div>
    </div>
    <button onClick={onSignOut} className="text-gray-500 font-black flex items-center gap-3 uppercase text-xs tracking-widest hover:bg-gray-100 px-8 py-4 rounded-2xl transition-all active:scale-95">
      <LogOut size={20} /> Sair
    </button>
  </div>
);

const BlockedView: React.FC<{ onSignOut: () => void }> = ({ onSignOut }) => (
  <div className="h-screen w-screen flex flex-col items-center justify-center bg-white p-10 text-center animate-in fade-in duration-500">
    <div className="w-28 h-28 bg-red-50 text-red-500 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-xl shadow-red-100">
      <XCircle size={48} />
    </div>
    <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter">Cadastro Não Aprovado</h1>
    <p className="text-gray-500 max-w-sm mb-12 font-medium">
      Após análise, seu cadastro como parceiro não foi aprovado. Se acredita que isso é um erro ou
      deseja mais informações, por favor, entre em contato com nosso suporte.
    </p>
    <div className="bg-gray-50 p-6 rounded-[2rem] w-full max-w-sm mb-12 flex items-center gap-6 border border-gray-100">
      <div className="bg-green-100 p-3 rounded-xl text-green-600"><Phone size={24} /></div>
      <div className="text-left">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Suporte via WhatsApp</p>
        <p className="text-lg font-black text-gray-900">{import.meta.env.VITE_SUPPORT_PHONE || '(00) 00000-0000'}</p>
      </div>
    </div>
    <button onClick={onSignOut} className="text-gray-500 font-black flex items-center gap-3 uppercase text-xs tracking-widest hover:bg-gray-100 px-8 py-4 rounded-2xl transition-all active:scale-95">
      <LogOut size={20} /> Sair
    </button>
  </div>
);

const AppContent: React.FC = () => {
  const { isLoading, currentUserProfile, currentRole, signOut, session, refreshData } = useAppStore();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [stuckTooLong, setStuckTooLong] = useState(false);
  const hasAutoRetried = React.useRef(false);

  // Ref para acessar o perfil atual dentro de callbacks assíncronos
  const currentUserProfileRef = React.useRef(currentUserProfile);
  React.useEffect(() => {
    currentUserProfileRef.current = currentUserProfile;
    if (currentUserProfile) {
      hasAutoRetried.current = false;
      setLoadFailed(false);
    }
  }, [currentUserProfile]);

  // Uma única tentativa automática silenciosa após carregamento inicial falhar
  React.useEffect(() => {
    if (!session || isLoading || currentUserProfile || hasAutoRetried.current) return;
    hasAutoRetried.current = true;
    const t = setTimeout(async () => {
      try { await refreshData(); } catch (_) {}
      // Aguarda React commitar o novo estado antes de decidir
      setTimeout(() => {
        if (!currentUserProfileRef.current) setLoadFailed(true);
      }, 300);
    }, 1500);
    return () => clearTimeout(t);
  }, [session, isLoading, currentUserProfile]);

  // Saída de emergência: se ficar preso na tela "Sincronizando..." por muito tempo
  // (ex.: isLoading travado em true após deploy), revela o botão de reconectar.
  const isOnLoadingScreen = isLoading || (!!session && !currentUserProfile && !loadFailed);
  React.useEffect(() => {
    if (currentUserProfile) { setStuckTooLong(false); return; }
    if (!isOnLoadingScreen) { setStuckTooLong(false); return; }
    // 5s: tempo suficiente para distinguir travamento real de conexão lenta normal.
    const t = setTimeout(() => setStuckTooLong(true), 5000);
    return () => clearTimeout(t);
  }, [isOnLoadingScreen, currentUserProfile]);

  useAndroidBack(() => {
    if (showProfileModal) { setShowProfileModal(false); return true; }
    return false; // minimiza app
  });

  // Sessão existe mas perfil não carregou e retry já foi feito — mostra tela de erro
  if (session && !isLoading && !currentUserProfile && loadFailed) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F8F9FC] p-8 text-center animate-in fade-in duration-500">
        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl shadow-orange-100 flex flex-col items-center max-w-sm w-full">
          <div className="w-16 h-16 bg-orange-50 rounded-[1.5rem] flex items-center justify-center mb-6">
            <RefreshCw size={28} className="text-orange-600" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2 tracking-tight">Erro ao carregar</h2>
          <p className="text-gray-400 text-xs font-bold mb-8 leading-relaxed">
            Não foi possível carregar seu perfil. Verifique sua conexão e tente novamente.
          </p>
          <button
            onClick={async () => {
              setIsRetrying(true);
              setLoadFailed(false);
              hasAutoRetried.current = false;
              try { await refreshData(); } catch (_) {}
              finally { setIsRetrying(false); }
            }}
            disabled={isRetrying}
            className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 transition shadow-xl shadow-orange-100 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isRetrying
              ? <><Loader size={14} className="animate-spin" /> Carregando...</>
              : <><RefreshCw size={14} /> Tentar novamente</>
            }
          </button>
          <button
            onClick={async () => {
              // Limpa todo o cache local e força novo login
              ['deliverycity_cache_restaurants', 'deliverycity_cache_orders', 'deliverycity_cache_profiles', 'deliverycity_cache_version'].forEach(k => localStorage.removeItem(k));
              await signOut();
            }}
            className="mt-3 w-full text-gray-400 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition active:scale-95 flex items-center justify-center gap-2"
          >
            <LogOut size={14} /> Reconectar (limpar cache)
          </button>
        </div>
      </div>
    );
  }
  // Sem sessão e sem loading = não logado
  if (!session && !isLoading) {
    return (
      <div className="bg-[#F8F9FC] min-h-screen">
        <ClientView onOpenProfile={() => setShowProfileModal(true)} />
        {showProfileModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center animate-in fade-in duration-300" onClick={() => setShowProfileModal(false)}>
            <div className="w-full h-[92dvh] md:h-[85vh] md:max-w-xl bg-white shadow-2xl rounded-t-[3rem] md:rounded-[3rem] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-500" onClick={e => e.stopPropagation()}>
              <AuthView onClose={() => setShowProfileModal(false)} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Carregando (inicial ou aguardando retry silencioso)
  if (isLoading || (session && !currentUserProfile && !loadFailed)) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F8F9FC] animate-in fade-in duration-500">
        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl shadow-orange-100 flex flex-col items-center">
          <div className="relative mb-8">
            <div className="w-16 h-16 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] text-center">Sincronizando...</p>
        </div>

        {/* Saída de emergência: aparece se travar carregando por muito tempo */}
        {stuckTooLong && (
          <div className="mt-8 flex flex-col items-center gap-3 animate-in fade-in duration-500 max-w-xs w-full px-8">
            <p className="text-[11px] font-bold text-gray-400 text-center leading-relaxed">
              Está demorando mais que o normal. Se não carregar, toque abaixo para reconectar.
            </p>
            <button
              onClick={async () => {
                ['deliverycity_cache_restaurants', 'deliverycity_cache_orders', 'deliverycity_cache_profiles', 'deliverycity_cache_version'].forEach(k => localStorage.removeItem(k));
                await signOut();
              }}
              className="w-full bg-white border-2 border-gray-100 text-gray-500 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition active:scale-95 flex items-center justify-center gap-2 shadow-sm"
            >
              <LogOut size={14} /> Reconectar (limpar cache)
            </button>
          </div>
        )}
      </div>
    );
  }

  // Verificação de role/status — dados sempre vêm do banco
  if (currentUserProfile && session && currentUserProfile.id === session.user.id) {
    const dbRole       = currentUserProfile.role;
    const verifiedStatus = currentUserProfile.status;
    // RoleSwitcher (admin/superuser) pode sobrescrever a view via currentRole.
    // Para segurança, só aplica a troca se o usuário real é ADMIN ou o superusuário.
    const isSuperUser  = currentUserProfile.email?.toLowerCase() === 'wendelbaracho@hotmail.com';
    const verifiedRole = (currentRole && (dbRole === UserRole.ADMIN || isSuperUser))
      ? currentRole
      : dbRole;

    if (verifiedRole !== UserRole.CLIENT && verifiedRole !== UserRole.ADMIN && verifiedStatus === 'PENDING') {
      return <PendingApprovalView profile={currentUserProfile} onSignOut={signOut} />;
    }
    if (verifiedRole !== UserRole.CLIENT && verifiedRole !== UserRole.ADMIN && verifiedStatus === 'BLOCKED') {
      return <BlockedView onSignOut={signOut} />;
    }
    if (verifiedRole === UserRole.ADMIN && verifiedStatus === 'APPROVED') return <AdminView />;
    if (verifiedRole === UserRole.RESTAURANT && verifiedStatus === 'APPROVED') return <RestaurantView />;
    if (verifiedRole === UserRole.DRIVER && verifiedStatus === 'APPROVED') return <DriverView />;
  }

  // Fallback: CLIENT ou estado inesperado
  return (
    <div className="bg-[#F8F9FC] min-h-screen">
      <ClientView onOpenProfile={() => setShowProfileModal(true)} />
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center animate-in fade-in duration-300" onClick={() => setShowProfileModal(false)}>
          <div className="w-full h-[90vh] md:h-auto md:max-w-xl bg-white shadow-2xl rounded-t-[3rem] md:rounded-[3rem] overflow-hidden animate-in slide-in-from-bottom duration-500" onClick={e => e.stopPropagation()}>
            <AuthView onClose={() => setShowProfileModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <AppProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </AppProvider>
  </ErrorBoundary>
);

export default App;
