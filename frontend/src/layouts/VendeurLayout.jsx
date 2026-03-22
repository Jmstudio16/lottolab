import { API_URL } from '@/config/api';
import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { 
  LayoutDashboard, ShoppingCart, Ticket, Search, Calendar,
  Trophy, BarChart3, User, LogOut, Menu, X, Store, Building2, Trash2,
  Banknote, Receipt
} from 'lucide-react';


const VendeurLayout = () => {
  const { user, token, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [companyInfo, setCompanyInfo] = useState(null);

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
          companyLogo: res.data.company?.logo_url,
          succursaleName: res.data.succursale?.name || '',
          vendeurName: res.data.vendeur?.name || user?.full_name || 'Vendeur'
        });
      } catch (e) {
        // Fallback to user data
        setCompanyInfo({
          companyName: user?.company_name || 'Compagnie',
          companyLogo: null,
          succursaleName: user?.succursale_name || '',
          vendeurName: user?.full_name || 'Vendeur'
        });
      }
    };
    fetchInfo();
  }, [token, user]);

  const menuItems = [
    { path: '/vendeur/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
    { path: '/vendeur/nouvelle-vente', icon: ShoppingCart, label: 'Nouvelle Vente' },
    { path: '/vendeur/mes-tickets', icon: Ticket, label: 'Mes Tickets' },
    { path: '/vendeur/recherche', icon: Search, label: 'Recherche Fiches' },
    { path: '/vendeur/tirages', icon: Calendar, label: 'Tirages Disponibles' },
    { path: '/vendeur/resultats', icon: Trophy, label: 'Résultats' },
    { path: '/vendeur/fiches-gagnants', icon: Trophy, label: 'Fiches Gagnants', highlight: 'amber' },
    { path: '/vendeur/fiches-supprimees', icon: Trash2, label: 'Fiches Supprimées', highlight: 'red' },
    { path: '/vendeur/mes-ventes', icon: BarChart3, label: 'Mes Ventes' },
    { path: '/vendeur/rapport', icon: BarChart3, label: 'Rapport', highlight: 'blue' },
    { path: '/vendeur/profil', icon: User, label: 'Mon Profil' },
  ];

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
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-slate-400 hover:text-white"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
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
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <User className="w-5 h-5 text-emerald-400" />
              </div>
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
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 p-2 flex justify-around">
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
