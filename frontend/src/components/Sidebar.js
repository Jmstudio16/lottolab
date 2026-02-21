import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Package, 
  Activity, 
  Settings,
  UserCircle,
  Monitor,
  Ticket,
  CalendarClock,
  Trophy,
  BarChart3,
  FileText,
  LogOut,
  Globe,
  Clock,
  Award,
  Store,
  Sliders,
  ChartLine,
  ShoppingBag,
  Image,
  Wallet,
  Banknote
} from 'lucide-react';
import { useAuth } from '@/api/auth';
import Logo from './Logo';

const SuperAdminMenu = [
  { path: '/super/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/super/lottery-catalog', label: 'Lottery Catalog', icon: Globe },
  { path: '/super/global-schedules', label: 'Global Schedules', icon: Clock },
  { path: '/super/result-management', label: 'RESULT MANAGEMENT', icon: Trophy },
  { path: '/super/companies', label: 'Companies', icon: Building2 },
  { path: '/super/users', label: 'Users', icon: Users },
  { path: '/super/plans', label: 'Plans & Licenses', icon: Package },
  { path: '/super/activity-logs', label: 'Activity Logs', icon: Activity },
  { path: '/super/settings', label: 'Settings', icon: Settings },
];

const CompanyAdminMenu = [
  { path: '/company/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/company/branches', label: 'Succursales', icon: Building2 },
  { path: '/company/agents', label: 'Agents', icon: UserCircle },
  { path: '/company/agent-balances', label: 'Soldes Agents', icon: Wallet },
  { path: '/company/pos-devices', label: 'POS Devices', icon: Monitor },
  { path: '/company/lotteries', label: 'Lottery Catalog', icon: Ticket },
  { path: '/company/schedules', label: 'Schedules (View)', icon: CalendarClock },
  { path: '/company/results', label: 'Results (View)', icon: Trophy },
  { path: '/company/tickets', label: 'Tickets', icon: FileText },
  { path: '/company/winning-tickets', label: 'Gagnants & Paiements', icon: Banknote },
  { path: '/company/configuration', label: 'Configuration', icon: Sliders },
  { path: '/company/statistics', label: 'Statistiques', icon: ChartLine },
  { path: '/company/daily-reports', label: 'Journalier', icon: BarChart3 },
  { path: '/company/users', label: 'Company Users', icon: Users },
  { path: '/company/activity-logs', label: 'Activity Logs', icon: Activity },
  { path: '/company/profile-settings', label: 'Logo & Profil', icon: Image },
  { path: '/company/settings', label: 'Settings', icon: Settings },
];

export const Sidebar = ({ role }) => {
  const location = useLocation();
  const { logout, user } = useAuth();
  
  const menu = role === 'SUPER_ADMIN' ? SuperAdminMenu : CompanyAdminMenu;
  
  return (
    <div className="w-64 h-screen bg-[#020617] border-r border-slate-800 flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b border-slate-800">
        <Logo 
          size="xl" 
          className="mx-auto justify-center"
          useSystemLogo={role === 'SUPER_ADMIN'}
        />
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {menu.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`sidebar-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              className={`sidebar-link flex items-center gap-3 px-4 py-3 mb-2 rounded-lg text-sm transition-all ${
                isActive 
                  ? 'active bg-yellow-400/10 text-yellow-400 border-l-4 border-yellow-400' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      
      {/* User Section */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-slate-900 font-bold">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
        <button
          onClick={logout}
          data-testid="sidebar-logout-button"
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-colors text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
      
      {/* Footer */}
      <div className="p-4 text-center text-xs text-slate-500 border-t border-slate-800">
        © JM STUDIO
      </div>
    </div>
  );
};