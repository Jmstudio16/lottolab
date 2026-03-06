import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import { 
  LayoutDashboard, ShoppingCart, Ticket, Search, Calendar,
  Trophy, BarChart3, User, LogOut, Menu, X, Store
} from 'lucide-react';

const VendeurLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: '/vendeur/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
    { path: '/vendeur/nouvelle-vente', icon: ShoppingCart, label: 'Nouvelle Vente' },
    { path: '/vendeur/mes-tickets', icon: Ticket, label: 'Mes Tickets' },
    { path: '/vendeur/recherche', icon: Search, label: 'Recherche Fiches' },
    { path: '/vendeur/tirages', icon: Calendar, label: 'Tirages Disponibles' },
    { path: '/vendeur/resultats', icon: Trophy, label: 'Résultats' },
    { path: '/vendeur/mes-ventes', icon: BarChart3, label: 'Mes Ventes' },
    { path: '/vendeur/profil', icon: User, label: 'Mon Profil' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Store className="w-8 h-8 text-emerald-400" />
          <span className="text-xl font-bold text-white">LOTO PAM</span>
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
          {/* Logo */}
          <div className="hidden lg:flex items-center gap-3 p-6 border-b border-slate-700">
            <Store className="w-10 h-10 text-emerald-400" />
            <div>
              <h1 className="text-xl font-bold text-white">LOTO PAM</h1>
              <p className="text-xs text-emerald-400">Espace Vendeur</p>
            </div>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <User className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{user?.full_name || 'Vendeur'}</p>
                <p className="text-xs text-slate-400">{user?.email}</p>
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
