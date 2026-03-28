import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  FileSpreadsheet,
  Wallet,
  Banknote,
  Flag,
  Trash2,
  Zap,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/api/auth';
import Logo from './Logo';
import UserAvatar from './UserAvatar';

// Menu items will be generated with translation keys
const getSuperAdminMenu = (t) => [
  { path: '/super/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
  { path: '/super/lottery-catalog', label: t('nav.lotteryCatalog'), icon: Globe },
  { path: '/super/lottery-flags', label: t('nav.lotteryFlags', 'Config Drapeaux'), icon: Flag },
  { path: '/super/global-schedules', label: t('nav.globalSchedules'), icon: Clock },
  { path: '/super/draw-times', label: t('nav.drawTimes', 'Heures de Tirage'), icon: CalendarClock },
  { path: '/super/security', label: t('nav.security', 'Sécurité'), icon: Shield },
  { path: '/super/limits', label: t('nav.limits', 'Limites Intelligentes'), icon: AlertTriangle },
  { path: '/admin/financial', label: t('nav.financial', 'Gestion Financière'), icon: Wallet },
  { path: '/super/publish-results', label: t('nav.publishResults', 'Publier Résultats'), icon: Trophy },
  { path: '/super/scheduled-results', label: t('nav.scheduledResults', 'Résultats Programmés'), icon: Zap },
  { path: '/super/companies', label: t('nav.companies'), icon: Building2 },
  { path: '/super/users', label: t('nav.users'), icon: Users },
  { path: '/super/plans', label: t('nav.plans'), icon: Package },
  { path: '/super/activity-logs', label: t('nav.activityLogs'), icon: Activity },
  { path: '/super/settings', label: t('nav.settings'), icon: Settings },
  { divider: true, label: 'LOTO PAM Online' },
  { path: '/super/online/dashboard', label: t('nav.lotopamDashboard', 'LOTO PAM Dashboard'), icon: Store },
  { path: '/super/online/players', label: t('nav.onlinePlayers', 'Joueurs Online'), icon: Users },
  { path: '/super/online/deposits', label: t('financial.deposit'), icon: Wallet },
  { path: '/super/online/withdrawals', label: t('financial.withdraw'), icon: Banknote },
  { path: '/super/online/tickets', label: t('nav.onlineTickets', 'Tickets Online'), icon: Ticket },
  { path: '/super/online/kyc', label: t('lotopam.kyc'), icon: Award },
  { path: '/super/online/settings', label: t('nav.lotopamConfig', 'Config LOTO PAM'), icon: Sliders },
];

const getCompanyAdminMenu = (t) => [
  { path: '/company/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
  { path: '/company/succursales', label: t('nav.branches'), icon: Store },
  { path: '/company/lotteries', label: t('nav.lotteryCatalog'), icon: Ticket },
  { path: '/company/lottery-flags', label: t('nav.lotteryFlags', 'Config Drapeaux'), icon: Flag },
  { path: '/company/schedules', label: t('nav.schedules'), icon: CalendarClock },
  { path: '/company/results', label: t('nav.results'), icon: Trophy },
  { path: '/company/tickets', label: t('nav.tickets'), icon: FileText },
  { path: '/company/lots-gagnants', label: t('nav.winningTickets'), icon: Trophy },
  { path: '/company/deleted-tickets', label: t('nav.deletedTickets', 'Fiche Supprimée'), icon: Trash2 },
  { path: '/company/winning-tickets', label: t('nav.winnersPayments', 'Gagnants & Paiements'), icon: Banknote },
  { path: '/company/balance-management', label: t('nav.balanceManagement', 'Gestion Soldes'), icon: Wallet },
  { path: '/company/exports', label: t('nav.exports', 'Exports & Config'), icon: FileSpreadsheet },
  { path: '/company/configuration', label: t('nav.configuration', 'Configuration'), icon: Sliders },
  { path: '/company/statistics', label: t('nav.statistics', 'Statistiques'), icon: ChartLine },
  { path: '/company/rapport-ventes', label: t('nav.salesReport', 'Rapport de Ventes'), icon: BarChart3 },
  { path: '/company/daily-reports', label: t('nav.dailyReports', 'Rapports Journaliers'), icon: BarChart3 },
  { path: '/company/users', label: t('nav.users'), icon: Users },
  { path: '/company/activity-logs', label: t('nav.activityLogs'), icon: Activity },
  { path: '/company/profile-settings', label: t('nav.logoProfile', 'Logo & Profil'), icon: Image },
  { path: '/company/ticket-config', label: 'Config. Ticket', icon: FileText },
  { path: '/company/printer-config', label: 'Config. Imprimante', icon: Monitor },
  { path: '/company/reports-export', label: 'Rapports Excel', icon: FileSpreadsheet },
  { path: '/company/settings', label: t('nav.settings'), icon: Settings },
];

export const Sidebar = ({ role, onNavigate }) => {
  const location = useLocation();
  const { logout, user } = useAuth();
  const { t } = useTranslation();
  
  const menu = role === 'SUPER_ADMIN' ? getSuperAdminMenu(t) : getCompanyAdminMenu(t);
  
  const handleClick = () => {
    if (onNavigate) onNavigate();
  };
  
  return (
    <div className="w-64 h-screen bg-[#020617] border-r border-slate-800 flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="p-4 lg:p-6 border-b border-slate-800">
        <Logo 
          size="xl" 
          className="mx-auto justify-center"
          useSystemLogo={role === 'SUPER_ADMIN'}
        />
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 lg:px-3">
        {menu.map((item, index) => {
          // Handle divider
          if (item.divider) {
            return (
              <div key={`divider-${index}`} className="mt-4 mb-2 px-4">
                <p className="text-xs font-bold text-yellow-500 uppercase tracking-wider">{item.label}</p>
                <div className="mt-2 border-t border-slate-700"></div>
              </div>
            );
          }
          
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleClick}
              data-testid={`sidebar-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              className={`sidebar-link flex items-center gap-3 px-3 lg:px-4 py-2.5 lg:py-3 mb-1 lg:mb-2 rounded-lg text-sm transition-all ${
                isActive 
                  ? 'active bg-yellow-400/10 text-yellow-400 border-l-4 border-yellow-400' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      
      {/* User Section */}
      <div className="p-3 lg:p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-3">
          <UserAvatar 
            photoUrl={user?.photo_url || user?.profile_image_url}
            name={user?.name}
            size="md"
          />
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
          Déconnexion
        </button>
      </div>
      
      {/* Footer */}
      <div className="p-3 lg:p-4 text-center text-xs text-slate-500 border-t border-slate-800">
        © LOTTOLAB
      </div>
    </div>
  );
};