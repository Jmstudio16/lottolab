import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import { 
  Monitor, 
  Ticket, 
  BarChart3, 
  LogOut,
  User
} from 'lucide-react';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_36e4b3a7-6dc6-43e8-b4c7-e0a52462b3df/artifacts/ztvthede_ChatGPT%20Image%2019%20f%C3%A9vr.%202026%2C%2020_13_22.png";

const AgentMenuItem = ({ to, icon: Icon, label, isActive }) => (
  <Link
    to={to}
    data-testid={`agent-menu-${label.toLowerCase().replace(/\s+/g, '-')}`}
    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
      isActive 
        ? 'bg-yellow-400/20 text-yellow-400 border-l-4 border-yellow-400' 
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
    }`}
  >
    <Icon className="w-5 h-5" />
    <span className="font-medium">{label}</span>
  </Link>
);

export const AgentLayout = ({ children, title, subtitle }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { to: '/agent/pos', icon: Monitor, label: 'POS Terminal' },
    { to: '/agent/my-tickets', icon: Ticket, label: 'My Tickets' },
    { to: '/agent/my-sales', icon: BarChart3, label: 'My Sales' },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-slate-800 fixed h-full">
        <div className="p-4">
          <div className="flex items-center justify-center mb-6">
            <img src={LOGO_URL} alt="LOTTOLAB" className="h-16" />
          </div>
          
          {/* Agent Badge */}
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/30 flex items-center justify-center">
                <User className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{user?.name}</p>
                <p className="text-xs text-blue-400 uppercase font-bold">Agent POS</p>
              </div>
            </div>
          </div>

          {/* Menu */}
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <AgentMenuItem 
                key={item.to}
                {...item} 
                isActive={location.pathname === item.to || location.pathname.startsWith(item.to + '/')}
              />
            ))}
          </nav>
        </div>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            data-testid="agent-logout-button"
            className="flex items-center gap-3 px-4 py-3 rounded-lg w-full text-red-400 hover:bg-red-900/20 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Header */}
        <header className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 sticky top-0 z-40 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-barlow font-bold uppercase tracking-tight text-white">
                {title}
              </h1>
              {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
