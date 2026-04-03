import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import { API_URL } from '@/config/api';
import axios from 'axios';
import { toast } from 'sonner';
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
  Trash2,
  Calculator,
  Bell,
  Volume2,
  VolumeX,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Logo from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const SupervisorSidebar = ({ isOpen, onClose }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/supervisor/dashboard', icon: Home, label: 'Tableau de bord' },
    { path: '/supervisor/notifications', icon: Bell, label: 'Notifications' },
    { path: '/supervisor/agents', icon: Users, label: 'Mes Agents' },
    { path: '/supervisor/tickets', icon: Ticket, label: 'Tickets' },
    { path: '/supervisor/fiches-jouees', icon: Ticket, label: 'Fiches Jouées' },
    { path: '/supervisor/reports', icon: BarChart3, label: 'Rapports' },
    { path: '/supervisor/results', icon: Trophy, label: 'Résultats' },
    { path: '/supervisor/lots-gagnants', icon: Trophy, label: 'Fiches Gagnants' },
    { path: '/supervisor/settlement-history', icon: Calculator, label: 'Historique Règlements' },
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
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/supervisor/notifications?limit=20`, { headers });
      const data = Array.isArray(res.data) ? res.data : (res.data.notifications || []);
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    } catch (e) {
      console.log('Notification fetch error');
    }
  }, [token]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await axios.put(`${API_URL}/api/notifications/${id}/read`, {}, { headers });
      setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {}
  };

  const markAllRead = async () => {
    try {
      await axios.put(`${API_URL}/api/notifications/mark-all-read`, {}, { headers });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('Toutes les notifications marquées comme lues');
    } catch (e) {}
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMins = Math.floor((now - date) / 60000);
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return date.toLocaleDateString('fr-FR');
  };

  const unreadNotifications = notifications.filter(n => !n.read);

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

        <div className="flex items-center gap-3">
          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="relative p-2 text-slate-400 hover:text-white transition-colors"
            >
              <Bell size={22} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50">
                <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                  <span className="font-semibold text-white">Notifications</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-slate-400 hover:text-white">
                      {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300">
                        Tout lu
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {unreadNotifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Aucune nouvelle notification</p>
                    </div>
                  ) : (
                    unreadNotifications.slice(0, 10).map((notif) => (
                      <div
                        key={notif.notification_id}
                        onClick={() => markAsRead(notif.notification_id)}
                        className="px-4 py-3 border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 animate-pulse" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white">{notif.title}</p>
                            <p className="text-xs text-slate-400 line-clamp-2">{notif.message}</p>
                            <p className="text-xs text-slate-500 mt-1">{formatTime(notif.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-slate-700">
                  <a href="/supervisor/notifications" className="block text-center text-sm text-blue-400 hover:text-blue-300 py-2">
                    Voir toutes les notifications
                  </a>
                </div>
              </div>
            )}
          </div>

          <LanguageSwitcher />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-slate-400">Connecté</span>
          </div>
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
