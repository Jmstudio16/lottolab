import { API_URL } from '@/config/api';
import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import { useTranslation } from 'react-i18next';
import { useWebSocketContext, useWebSocketEvent, WSEventType } from '@/context/WebSocketContext';
import { WebSocketIndicatorCompact } from '@/components/WebSocketIndicator';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  LayoutDashboard, ShoppingCart, Ticket, Search, Calendar,
  Trophy, BarChart3, User, LogOut, Menu, X, Store, Building2, Trash2,
  Banknote, Receipt, Wifi, Bell, Volume2, VolumeX
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import UserAvatar from '@/components/UserAvatar';


const VendeurLayout = () => {
  const { user, token, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isConnected } = useWebSocketContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [vendeurPhoto, setVendeurPhoto] = useState(null);

  // Fetch company and succursale info
  useEffect(() => {
    const fetchInfo = async () => {
      if (!token) return;
      try {
        const res = await axios.get(`${API_URL}/api/vendeur/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCompanyInfo({
          companyName: res.data.company?.name || 'Compagnie',
          companyLogo: res.data.company?.logo_url || res.data.company?.company_logo_url,
          succursaleName: res.data.succursale?.name || '',
          vendeurName: res.data.vendeur?.name || user?.full_name || 'Vendeur'
        });
        setVendeurPhoto(res.data.vendeur?.photo_url || res.data.vendeur?.profile_image_url);
      } catch (e) {
        // Fallback to user data
        setCompanyInfo({
          companyName: user?.company_name || 'Compagnie',
          companyLogo: null,
          succursaleName: user?.succursale_name || '',
          vendeurName: user?.full_name || 'Vendeur'
        });
        setVendeurPhoto(user?.photo_url);
      }
    };
    fetchInfo();
  }, [token, user]);

  const menuItems = [
    { path: '/vendeur/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/vendeur/notifications', icon: Bell, label: 'Notifications' },
    { path: '/vendeur/nouvelle-vente', icon: ShoppingCart, label: t('vendeur.newSale') },
    { path: '/vendeur/mes-tickets', icon: Ticket, label: t('vendeur.myTickets') },
    { path: '/vendeur/recherche', icon: Search, label: t('nav.searchTickets', 'Recherche Fiches') },
    { path: '/vendeur/tirages', icon: Calendar, label: t('nav.availableDraws', 'Tirages Disponibles') },
    { path: '/vendeur/resultats', icon: Trophy, label: t('nav.results') },
    { path: '/vendeur/fiches-gagnants', icon: Trophy, label: t('nav.winningTickets', 'Lots Gagnants'), highlight: 'amber' },
    { path: '/vendeur/fiches-supprimees', icon: Trash2, label: t('nav.deletedTickets', 'Fiches Supprimées'), highlight: 'red' },
    { path: '/vendeur/mes-ventes', icon: BarChart3, label: t('nav.mySales') },
    { path: '/vendeur/rapport', icon: BarChart3, label: t('nav.reports', 'Mon Rapport'), highlight: 'blue' },
    { path: '/vendeur/imprimante', icon: Receipt, label: 'Config. Imprimante', highlight: 'cyan' },
    { path: '/vendeur/profil', icon: User, label: t('common.profile') },
  ];
  
  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/vendeur/notifications?limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = Array.isArray(res.data) ? res.data : (res.data.notifications || []);
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    } catch (e) {}
  }, [token]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await axios.put(`${API_URL}/api/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {}
  };

  const markAllRead = async () => {
    try {
      await axios.put(`${API_URL}/api/notifications/mark-all-read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
    return `${Math.floor(diffMins / 60)}h`;
  };

  const unreadNotifications = notifications.filter(n => !n.read);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName = companyInfo?.companyName || 'Compagnie';
  const succursaleName = companyInfo?.succursaleName;
  const companyLogo = companyInfo?.companyLogo;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-3">
          {companyLogo ? (
            <img 
              src={`${API_URL}${companyLogo}`} 
              alt="Logo" 
              className="w-10 h-10 object-contain rounded-lg bg-slate-700 p-1"
            />
          ) : (
            <Store className="w-8 h-8 text-emerald-400" />
          )}
          <div>
            <span className="text-lg font-bold text-white block">{displayName}</span>
            {succursaleName && (
              <span className="text-xs text-emerald-400">{succursaleName}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className="relative p-2 text-slate-400 hover:text-white"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50">
                <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                  <span className="font-semibold text-white text-sm">Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-blue-400">Tout lu</button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {unreadNotifications.length === 0 ? (
                    <div className="py-6 text-center text-slate-400">
                      <Bell className="w-6 h-6 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Aucune notification</p>
                    </div>
                  ) : (
                    unreadNotifications.slice(0, 8).map((notif) => (
                      <div
                        key={notif.notification_id}
                        onClick={() => markAsRead(notif.notification_id)}
                        className="px-3 py-2 border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer"
                      >
                        <p className="text-xs font-medium text-white">{notif.title}</p>
                        <p className="text-xs text-slate-400 line-clamp-1">{notif.message}</p>
                        <p className="text-xs text-slate-500 mt-1">{formatTime(notif.created_at)}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-slate-700">
                  <a href="/vendeur/notifications" className="block text-center text-xs text-blue-400 py-1">
                    Voir tout
                  </a>
                </div>
              </div>
            )}
          </div>
          <LanguageSwitcher />
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-slate-400 hover:text-white"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-slate-800/95 backdrop-blur-sm border-r border-slate-700
          transform transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          {/* Logo / Company Info */}
          <div className="hidden lg:block p-5 border-b border-slate-700">
            <div className="flex items-center gap-3">
              {companyLogo ? (
                <img 
                  src={`${API_URL}${companyLogo}`} 
                  alt="Logo" 
                  className="w-12 h-12 object-contain rounded-xl bg-slate-700 p-1"
                />
              ) : (
                <div className="p-2 bg-emerald-500/20 rounded-xl">
                  <Building2 className="w-8 h-8 text-emerald-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-white truncate">{displayName}</h1>
                {succursaleName && (
                  <p className="text-xs text-emerald-400 truncate">{succursaleName}</p>
                )}
                <p className="text-xs text-slate-500">Espace Vendeur</p>
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <UserAvatar 
                photoUrl={vendeurPhoto}
                name={companyInfo?.vendeurName || user?.full_name}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {companyInfo?.vendeurName || user?.full_name || 'Vendeur'}
                </p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500">Langue</span>
              <LanguageSwitcher />
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Déconnexion</span>
            </button>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-screen lg:ml-0">
          <Outlet />
        </main>
      </div>

      {/* Quick Actions Bar (Mobile) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 p-2 flex justify-around items-center">
        <Link to="/vendeur/nouvelle-vente" className="flex flex-col items-center p-2 text-emerald-400">
          <ShoppingCart className="w-6 h-6" />
          <span className="text-xs mt-1">Vente</span>
        </Link>
        <Link to="/vendeur/mes-tickets" className="flex flex-col items-center p-2 text-slate-400">
          <Ticket className="w-6 h-6" />
          <span className="text-xs mt-1">Tickets</span>
        </Link>
        <Link to="/vendeur/resultats" className="flex flex-col items-center p-2 text-slate-400">
          <Trophy className="w-6 h-6" />
          <span className="text-xs mt-1">Résultats</span>
        </Link>
        <Link to="/vendeur/profil" className="flex flex-col items-center p-2 text-slate-400">
          <User className="w-6 h-6" />
          <span className="text-xs mt-1">Profil</span>
        </Link>
      </div>
    </div>
  );
};

export default VendeurLayout;
