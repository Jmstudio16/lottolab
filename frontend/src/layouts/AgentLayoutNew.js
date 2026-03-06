import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { 
  Home, 
  PlusCircle, 
  Ticket, 
  Trophy, 
  BarChart3, 
  LogOut,
  Menu,
  X,
  Search,
  Clock,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Navigation items
const navItems = [
  { path: '/agent/dashboard', icon: Home, label: 'Dashboard' },
  { path: '/agent/pos', icon: PlusCircle, label: 'Nouvelle Vente' },
  { path: '/agent/my-tickets', icon: Ticket, label: 'Mes Tickets' },
  { path: '/agent/search-tickets', icon: Search, label: 'Rechercher' },
  { path: '/agent/available-draws', icon: Clock, label: 'Tirages' },
  { path: '/agent/results', icon: Trophy, label: 'Résultats' },
  { path: '/agent/my-sales', icon: BarChart3, label: 'Ventes' },
];

// Sidebar Component
const Sidebar = ({ isOpen, onClose, companyName, agentName }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800 transform transition-transform duration-300 lg:translate-x-0 lg:static",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                  <Ticket className="w-6 h-6 text-black" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">LOTTOLAB</p>
                  <p className="text-xs text-slate-400">Agent POS</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Agent Info */}
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{agentName || 'Agent'}</p>
                <p className="text-xs text-emerald-400 truncate">{companyName || 'Company'}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-yellow-500 text-black font-semibold shadow-lg shadow-yellow-500/20"
                    : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-slate-800">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Déconnexion
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};

// Main Layout
export const AgentLayoutNew = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncData, setSyncData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { token, user } = useAuth();

  // Load data
  const loadData = useCallback(async () => {
    if (!token) return;

    try {
      const response = await axios.get(`${API_URL}/api/device/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSyncData(response.data);
    } catch (error) {
      console.error('Config load error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Simple loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        companyName={syncData?.company?.name}
        agentName={user?.name}
      />

      <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="hidden sm:block">
                <p className="text-white font-medium">{syncData?.company?.name || 'Terminal'}</p>
                <p className="text-xs text-slate-400">
                  {syncData?.enabled_lotteries?.length || 0} loteries • 
                  {syncData?.schedules?.length || 0} tirages
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-slate-400 hidden sm:inline">Connecté</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet context={{ syncData, setSyncData, loadData }} />
        </main>
      </div>
    </div>
  );
};

export default AgentLayoutNew;
