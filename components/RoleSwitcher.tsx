
import React from 'react';
import { useAppStore } from '../store';
import { UserRole } from '../types';
import { Smartphone, Store, Bike, LayoutDashboard, ShieldAlert } from 'lucide-react';

const SUPERUSER_EMAIL = 'wendelbaracho@hotmail.com';

export const RoleSwitcher: React.FC = () => {
  const { currentRole, setRole, currentUserProfile } = useAppStore();

  // O seletor de papéis agora é visível se o usuário logado for ADMIN OU se for o e-mail do Wendel
  const isSuperUser = currentUserProfile?.email?.toLowerCase() === SUPERUSER_EMAIL.toLowerCase();
  const isAdmin = currentUserProfile?.role === UserRole.ADMIN;

  if (!isAdmin && !isSuperUser) return null;

  const roles = [
    { id: UserRole.CLIENT, label: 'Cliente', icon: Smartphone, color: 'text-blue-500' },
    { id: UserRole.RESTAURANT, label: 'Loja', icon: Store, color: 'text-orange-500' },
    { id: UserRole.DRIVER, label: 'Entregador', icon: Bike, color: 'text-green-500' },
    { id: UserRole.ADMIN, label: 'Painel Admin', icon: LayoutDashboard, color: 'text-purple-500' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 flex justify-around items-center z-50 md:top-0 md:bottom-auto md:justify-center md:gap-8 md:p-4 shadow-lg">
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-[8px] text-white font-black px-2 py-0.5 rounded-full flex items-center gap-1">
        <ShieldAlert size={8}/> MODO DESENVOLVEDOR (WENDEL)
      </div>
      {roles.map((role) => (
        <button
          key={role.id}
          onClick={() => setRole(role.id)}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
            currentRole === role.id ? 'bg-purple-50 scale-105' : 'opacity-60 hover:opacity-100'
          }`}
        >
          <role.icon className={`w-6 h-6 ${role.color}`} />
          <span className="text-[10px] font-medium md:text-sm">{role.label}</span>
        </button>
      ))}
    </div>
  );
};
