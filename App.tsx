import React, { useState } from 'react';
import { AppProvider, useAppStore } from './store';
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
  const { isLoading, currentUserProfile, signOut, session, refreshData } = useAppStore();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useAndroidBack(() => {
    if (showProfileModal) { setShowProfileModal(false); return true; }
    return false; // minimiza app
  });

  // FIX: sessão existe mas perfil não carregou — fetchData falhou (rede/timing)
  // Mostra retry em vez de cair silenciosamente na ClientView genérica (loop de login)
  if (session && !isLoading && !currentUserProfile) {
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
              await refreshData();
              setIsRetrying(false);
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
            onClick={signOut}
            className="mt-3 w-full text-gray-400 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition active:scale-95 flex items-center justify-center gap-2"
          >
            <LogOut size={14} /> Sair
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

  // Carregando
  if (isLoading) {
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
      </div>
    );
  }

  // Verificação de role/status — dados sempre vêm do banco
  if (currentUserProfile && session && currentUserProfile.id === session.user.id) {
    const verifiedRole   = currentUserProfile.role;
    const verifiedStatus = currentUserProfile.status;

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
