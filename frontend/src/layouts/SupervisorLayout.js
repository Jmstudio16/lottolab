import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import { 
  Home, 
  Users, 
  Ticket, 
  BarChart3, 
  LogOut,
  Menu,
  X,
  Clock,
  CheckCircle,
  Trophy,
  CalendarClock,
  Flag,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Logo from '@/components/Logo';
import { API_URL } from '@/config/api';

const SupervisorSidebar = ({ isOpen, onClose }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/supervisor/dashboard', icon: Home, label: 'Tableau de bord' },
    { path: '/supervisor/agents', icon: Users, label: 'Mes Agents' },
    { path: '/supervisor/tickets', icon: Ticket, label: 'Tickets' },
    { path: '/supervisor/reports', icon: BarChart3, label: 'Rapports' },
    { path: '/supervisor/results', icon: Trophy, label: 'Résultats' },
    { path: '/supervisor/lots-gagnants', icon: Trophy, label: 'Lots Gagnants' },
    { path: '/supervisor/fiches-supprimees', icon: Trash2, label: 'Fiches Supprimées' },
    { path: '/supervisor/lottery-schedules', icon: CalendarClock, label: 'Horaires Loteries' },
    { path: '/supervisor/lottery-flags', icon: Flag, label: 'Configuration Drapeaux' },
  ];

  return (
    <aside 
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <Logo size="md" />
            <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
          <p className="text-xs text-slate-400 uppercase">Superviseur</p>
          <p className="font-semibold text-white truncate">{user?.name || 'Superviseur'}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )
              }
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-700">
          <Button
            variant="ghost"
            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-900/20"
            onClick={handleLogout}
          >
            <LogOut size={20} className="mr-3" />
            Déconnexion
          </Button>
        </div>
      </div>
    </aside>
  );
};

const SupervisorHeader = ({ onMenuClick }) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-800 border-b border-slate-700 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-slate-400 hover:text-white"
          >
            <Menu size={24} />
          </button>
          <span className="text-slate-400 text-sm">Espace Superviseur</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-slate-400">Connecté</span>
        </div>
      </div>
    </header>
  );
};

export const SupervisorLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <SupervisorSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <SupervisorHeader onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SupervisorLayout;
