
import React, { useState, useEffect } from 'react';
import { AppProvider, useAppStore } from './store';
import { ClientView } from './views/ClientView';
import { RestaurantView } from './views/RestaurantView';
import { DriverView } from './views/DriverView';
import { AuthView } from './views/AuthView';
import { UserRole } from './types';
import { Loader, Clock, LogOut, Phone, AlertCircle, RefreshCw, ServerCrash, XCircle } from 'lucide-react';

// Tela para usuários parceiros (Entregador/Lojista) aguardando aprovação.
const PendingApprovalView: React.FC<{ profile: any; onSignOut: () => void }> = ({ profile, onSignOut }) => {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-white p-10 text-center animate-in fade-in duration-700">
      <div className="w-28 h-28 bg-orange-50 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-xl shadow-orange-100">
        <Clock size={48} className="text-orange-600" />
      </div>
      <h1 className="text-4xl font-black mb-4 tracking-tighter">Análise em Andamento</h1>
      <p className="text-gray-500 max-w-sm mb-12 font-medium">Olá, {profile.name}. Seu cadastro como parceiro está sendo verificado pela nossa equipe. Isso garante a qualidade e segurança dos serviços na nossa cidade.</p>
      
      <div className="bg-gray-50 p-6 rounded-[2rem] w-full max-w-sm mb-12 flex items-center gap-6 border border-gray-100">
        <div className="bg-green-100 p-3 rounded-xl text-green-600"><Phone size={24}/></div>
        <div className="text-left">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Suporte via WhatsApp</p>
          <p className="text-lg font-black text-gray-900">(66) 99999-0000</p>
        </div>
      </div>

      <button onClick={onSignOut} className="text-gray-500 font-black flex items-center gap-3 uppercase text-xs tracking-widest hover:bg-gray-100 px-8 py-4 rounded-2xl transition-all active:scale-95"><LogOut size={20}/> Sair</button>
    </div>
  );
};

// Tela para usuários parceiros que tiveram o cadastro negado/bloqueado.
const BlockedView: React.FC<{ onSignOut: () => void }> = ({ onSignOut }) => {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-white p-10 text-center animate-in fade-in duration-500">
        <div className="w-28 h-28 bg-red-50 text-red-500 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-xl shadow-red-100">
            <XCircle size={48} />
        </div>
        <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter">Cadastro Não Aprovado</h1>
        <p className="text-gray-500 max-w-sm mb-12 font-medium">Após análise, seu cadastro como parceiro não foi aprovado. Se acredita que isso é um erro ou deseja mais informações, por favor, entre em contato com nosso suporte.</p>
        
        <div className="bg-gray-50 p-6 rounded-[2rem] w-full max-w-sm mb-12 flex items-center gap-6 border border-gray-100">
            <div className="bg-green-100 p-3 rounded-xl text-green-600"><Phone size={24}/></div>
            <div className="text-left">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Suporte via WhatsApp</p>
                <p className="text-lg font-black text-gray-900">(66) 99999-0000</p>
            </div>
        </div>

        <button onClick={onSignOut} className="text-gray-500 font-black flex items-center gap-3 uppercase text-xs tracking-widest hover:bg-gray-100 px-8 py-4 rounded-2xl transition-all active:scale-95"><LogOut size={20}/> Sair</button>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { currentRole, isLoading, currentUserProfile, signOut, session, refreshData, setRole } = useAppStore();
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Se não há sessão e o app não está carregando, o usuário não está logado.
  if (!session && !isLoading) {
    return (
      <div className="bg-[#F8F9FC] min-h-screen">
        <ClientView onOpenProfile={() => setShowProfileModal(true)} />
        
        {showProfileModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center animate-in fade-in duration-300">
             <div className="w-full h-[90vh] md:h-auto md:max-w-xl bg-white shadow-2xl rounded-t-[3rem] md:rounded-[3rem] overflow-hidden animate-in slide-in-from-bottom duration-500">
                 <AuthView onClose={() => setShowProfileModal(false)} />
             </div>
          </div>
        )}
      </div>
    );
  }

  // Tela de carregamento enquanto a sessão e o perfil são validados.
  if (isLoading || !currentUserProfile) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F8F9FC] animate-in fade-in duration-500">
        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl shadow-orange-100 flex flex-col items-center">
            <div className="relative mb-8">
                <div className="w-16 h-16 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse"></div>
                </div>
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] text-center">
              Sincronizando...
            </p>
        </div>
      </div>
    );
  }

  // Roteamento baseado no status e papel do usuário
  if (currentUserProfile && currentUserProfile.role && currentUserProfile.status) {
    // Se for parceiro (não cliente) e o status for PENDING, mostra a tela de espera.
    if (currentUserProfile.role !== UserRole.CLIENT && currentUserProfile.status === 'PENDING') {
      return <PendingApprovalView profile={currentUserProfile} onSignOut={signOut} />;
    }
    
    // Se for parceiro (não cliente) e o status for BLOCKED, mostra a tela de bloqueio.
    if (currentUserProfile.role !== UserRole.CLIENT && currentUserProfile.status === 'BLOCKED') {
      return <BlockedView onSignOut={signOut} />;
    }

    // Se o status for APPROVED, renderiza a view correta para o papel.
    if (currentRole === UserRole.RESTAURANT) return <RestaurantView />;
    if (currentRole === UserRole.DRIVER) return <DriverView />;
  }

  // O fallback final é a ClientView (para usuários com papel CLIENT ou qualquer estado inesperado).
  return (
    <div className="bg-[#F8F9FC] min-h-screen">
      <ClientView onOpenProfile={() => setShowProfileModal(true)} />
      
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center animate-in fade-in duration-300">
           <div className="w-full h-[90vh] md:h-auto md:max-w-xl bg-white shadow-2xl rounded-t-[3rem] md:rounded-[3rem] overflow-hidden animate-in slide-in-from-bottom duration-500">
               <AuthView onClose={() => setShowProfileModal(false)} />
           </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
