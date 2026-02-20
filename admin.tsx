import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminView } from './views/AdminView';
import { AuthView } from './views/AuthView';
import { AppProvider, useAppStore } from './store';
import { UserRole } from './types';
import { ShieldOff } from 'lucide-react';

// Componente que lida com a lógica de roteamento do Admin
const AdminAppContent: React.FC = () => {
  const { isLoading, session, currentUserProfile } = useAppStore();

  // 1. Tela de Carregamento
  if (isLoading || (session && !currentUserProfile)) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 2. Se não estiver logado, mostra a tela de Login
  if (!session) {
    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white shadow-2xl rounded-3xl overflow-hidden">
                <AuthView onClose={() => {}} />
            </div>
        </div>
    );
  }

  // 3. Se estiver logado, mas não for ADMIN, mostra Acesso Negado
  if (currentUserProfile && currentUserProfile.role !== UserRole.ADMIN) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center">
          <ShieldOff size={48} className="text-red-500 mb-6"/>
          <h1 className="text-2xl font-bold mb-2">Acesso Negado</h1>
          <p className="text-gray-400">Você não tem permissão para acessar esta área.</p>
      </div>
    );
  }

  // 4. Se estiver logado e for ADMIN, mostra o painel
  return <AdminView />;
};

const container = document.getElementById('root');

if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <AppProvider>
        <AdminAppContent />
      </AppProvider>
    </React.StrictMode>
  );
} else {
  console.error('Root container not found. Make sure you have a <div id="root"></div> in your admin.html');
}
