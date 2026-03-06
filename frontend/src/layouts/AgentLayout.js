import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import { useLogoContext } from '@/contexts/LogoContext';
import { 
  Home, 
  PlusCircle, 
  Ticket, 
  Trophy, 
  BarChart3, 
  LogOut,
  Menu,
  X,
  RefreshCw,
  Monitor,
  Smartphone,
  Tablet,
  Search,
  Clock,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Logo from '@/components/Logo';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AgentSidebar = ({ isOpen, onClose, companyName }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/agent/dashboard', icon: Home, label: 'Tableau de bord' },
    { path: '/agent/pos', icon: PlusCircle, label: 'Nouvelle Vente' },
    { path: '/agent/my-tickets', icon: Ticket, label: 'Mes Tickets' },
    { path: '/agent/search-tickets', icon: Search, label: 'Rechercher Fiches' },
    { path: '/agent/available-draws', icon: Clock, label: 'Tirages Disponibles' },
    { path: '/agent/results', icon: Trophy, label: 'Résultats' },
    { path: '/agent/my-sales', icon: BarChart3, label: 'Mes Ventes' },
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
            <div className="flex items-center gap-2">
              <Logo size="md" />
            </div>
            <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Agent Info */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
          <p className="text-xs text-slate-400 uppercase">Agent</p>
          <p className="font-semibold text-white truncate">{user?.name || 'Agent'}</p>
          {companyName && (
            <p className="text-xs text-emerald-400 mt-1">{companyName}</p>
          )}
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
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
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

const AgentHeader = ({ onMenuClick, syncData, isConnected }) => {
  const getDeviceIcon = () => {
    const width = window.innerWidth;
    if (width < 768) return <Smartphone size={16} />;
    if (width < 1024) return <Tablet size={16} />;
    return <Monitor size={16} />;
  };

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
          
          <div className="flex items-center gap-2 text-slate-400">
            {getDeviceIcon()}
            <span className="text-sm hidden sm:inline">
              {syncData?.company?.name || 'Terminal'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection Status - Simple green dot when connected */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-emerald-400" : "bg-yellow-400"
            )} />
            <span className="text-xs text-slate-400 hidden sm:inline">
              {isConnected ? "Connecté" : "Connexion..."}
            </span>
          </div>

          {/* Balance display */}
          {syncData?.daily_stats && (
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div className="bg-emerald-900/30 px-3 py-1 rounded-full">
                <span className="text-emerald-400 font-medium">
                  {syncData.daily_stats.sales?.toLocaleString() || 0} {syncData.company?.currency || 'HTG'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export const AgentLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncData, setSyncData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const { token } = useAuth();

  // Load config on mount - fast and immediate
  const loadConfig = useCallback(async () => {
    if (!token) return;
    
    try {
      console.log('[AgentLayout] Loading config...');
      const response = await fetch(`${API_URL}/api/device/config`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[AgentLayout] Config loaded:', {
          lotteries: data.enabled_lotteries?.length || 0,
          schedules: data.schedules?.length || 0
        });
        setSyncData(data);
        setIsConnected(true);
        
        // Store in localStorage for instant load next time
        localStorage.setItem('agent_config_cache', JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      } else {
        console.error('[AgentLayout] Config load failed:', response.status);
        // Clear bad cache
        localStorage.removeItem('agent_config_cache');
      }
    } catch (error) {
      console.error('[AgentLayout] Config load error:', error);
      // Try to use cached data
      const cached = localStorage.getItem('agent_config_cache');
      if (cached) {
        const { data } = JSON.parse(cached);
        setSyncData(data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Initial load with cache fallback
  useEffect(() => {
    // Try cache first for instant display
    const cached = localStorage.getItem('agent_config_cache');
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        // Use cache if less than 5 minutes old
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          setSyncData(data);
          setIsConnected(true);
          setIsLoading(false);
        }
      } catch (e) {
        // Invalid cache, ignore
      }
    }
    
    // Always fetch fresh data
    loadConfig();
  }, [loadConfig]);

  // Background sync every 30 seconds (not 5) - less aggressive
  useEffect(() => {
    if (!token) return;

    const syncInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/api/device/sync`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setIsConnected(true);
          setSyncData(prev => ({
            ...prev,
            ...data,
            lastSync: new Date().toISOString()
          }));
        } else {
          setIsConnected(false);
        }
      } catch (error) {
        setIsConnected(false);
      }
    }, 30000); // 30 seconds instead of 5

    return () => clearInterval(syncInterval);
  }, [token]);

  // Simple loading screen - very fast
  if (isLoading && !syncData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AgentSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        companyName={syncData?.company?.name}
      />

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <AgentHeader 
          onMenuClick={() => setSidebarOpen(true)} 
          syncData={syncData}
          isConnected={isConnected}
        />
        
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet context={{ syncData, setSyncData }} />
        </main>
      </div>
    </div>
  );
};

export default AgentLayout;
