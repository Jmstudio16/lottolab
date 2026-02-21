import React, { useState, useEffect } from 'react';
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
  Wifi,
  WifiOff,
  Monitor,
  Smartphone,
  Tablet,
  Printer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Logo from '@/components/Logo';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AgentSidebar = ({ isOpen, onClose }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/agent/dashboard', icon: Home, label: 'Tableau de bord' },
    { path: '/agent/new-ticket', icon: PlusCircle, label: 'Nouveau Ticket' },
    { path: '/agent/tickets', icon: Ticket, label: 'Mes Tickets' },
    { path: '/agent/results', icon: Trophy, label: 'Résultats' },
    { path: '/agent/reports', icon: BarChart3, label: 'Rapports' },
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
              <div>
                <p className="text-xs text-slate-400">Terminal Agent</p>
              </div>
            </div>
            <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Agent Info */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
          <p className="text-sm text-slate-400">Agent</p>
          <p className="font-semibold text-white truncate">{user?.name || 'Agent'}</p>
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

const AgentHeader = ({ onMenuClick, syncData }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
          {/* Sync indicator */}
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi size={16} className="text-emerald-400" />
            ) : (
              <WifiOff size={16} className="text-red-400" />
            )}
            <span className="text-xs text-slate-400 hidden sm:inline">
              {lastSync ? `Sync: ${new Date(lastSync).toLocaleTimeString()}` : 'Syncing...'}
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
  const { token } = useAuth();

  // Initial config load
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(`${API_URL}/api/device/config`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setSyncData(data);
        }
      } catch (error) {
        console.error('Config load error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      loadConfig();
    }
  }, [token]);

  // Real-time sync every 5 seconds
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
          setSyncData(prev => ({
            ...prev,
            ...data,
            lastSync: new Date().toISOString()
          }));
        }
      } catch (error) {
        console.error('Sync error:', error);
      }
    }, 5000);

    return () => clearInterval(syncInterval);
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={48} className="mx-auto text-emerald-400 animate-spin mb-4" />
          <p className="text-slate-400">Chargement du terminal...</p>
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

      <AgentSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-h-screen">
        <AgentHeader 
          onMenuClick={() => setSidebarOpen(true)} 
          syncData={syncData}
        />
        
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet context={{ syncData, setSyncData }} />
        </main>
      </div>
    </div>
  );
};

export default AgentLayout;
