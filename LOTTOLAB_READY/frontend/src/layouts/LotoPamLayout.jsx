import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLotoPamAuth } from '../context/LotoPamAuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { 
  Home, Gamepad2, Ticket, Wallet, Trophy, User, 
  LogOut, Menu, X, HelpCircle, Shield
} from 'lucide-react';

const LotoPamLayout = ({ children }) => {
  const { t } = useTranslation();
  const { player, wallet, logout, isAuthenticated } = useLotoPamAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    // Load public settings
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/online/settings`)
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(console.error);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/lotopam');
  };

  const navLinks = isAuthenticated ? [
    { path: '/lotopam', icon: Home, label: t('nav.dashboard') },
    { path: '/lotopam/play', icon: Gamepad2, label: t('lotopam.playNow') },
    { path: '/lotopam/my-tickets', icon: Ticket, label: t('lotopam.myTickets') },
    { path: '/lotopam/wallet', icon: Wallet, label: t('lotopam.wallet') },
    { path: '/lotopam/results', icon: Trophy, label: t('results.latestResults') },
    { path: '/lotopam/kyc', icon: Shield, label: t('lotopam.kyc') },
    { path: '/lotopam/support', icon: HelpCircle, label: t('lotopam.support') },
  ] : [
    { path: '/lotopam', icon: Home, label: 'Akèy' },
    { path: '/lotopam/results', icon: Trophy, label: t('results.latestResults') },
    { path: '/lotopam/support', icon: HelpCircle, label: t('lotopam.support') },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/lotopam" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center text-xl font-bold text-slate-900 shadow-lg shadow-yellow-500/20">
                LP
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                {settings?.platform_name || 'LOTO PAM'}
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    location.pathname === link.path
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <link.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{link.label}</span>
                </Link>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              
              {isAuthenticated ? (
                <>
                  {/* Wallet Balance */}
                  <Link
                    to="/lotopam/wallet"
                    className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl"
                  >
                    <Wallet className="w-4 h-4 text-yellow-400" />
                    <span className="font-bold text-yellow-400">
                      {wallet?.balance?.toLocaleString() || 0} HTG
                    </span>
                  </Link>
                  
                  {/* Profile Menu */}
                  <div className="relative group">
                    <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700">
                      <User className="w-4 h-4 text-slate-300" />
                      <span className="hidden sm:inline text-sm text-slate-300">{player?.username}</span>
                    </button>
                    <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                      <Link to="/lotopam/profile" className="flex items-center gap-2 px-4 py-3 text-slate-300 hover:bg-slate-700">
                        <User className="w-4 h-4" />
                        {t('common.profile')}
                      </Link>
                      <button 
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-3 text-red-400 hover:bg-slate-700 w-full"
                      >
                        <LogOut className="w-4 h-4" />
                        {t('common.logout')}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/lotopam/login"
                    className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                  >
                    {t('auth.signIn')}
                  </Link>
                  <Link
                    to="/lotopam/register"
                    className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-yellow-500 to-orange-500 text-slate-900 rounded-lg hover:shadow-lg hover:shadow-yellow-500/20 transition-all"
                  >
                    {t('auth.signUp')}
                  </Link>
                </div>
              )}

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-slate-300 hover:bg-slate-800"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900/98 border-t border-slate-800">
            <nav className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    location.pathname === link.path
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <link.icon className="w-5 h-5" />
                  <span className="font-medium">{link.label}</span>
                </Link>
              ))}
              
              {isAuthenticated && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-slate-800 w-full"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">{t('common.logout')}</span>
                </button>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/80 border-t border-slate-800 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center text-sm font-bold text-slate-900">
                LP
              </div>
              <span className="text-slate-400">© 2026 LOTO PAM. Tous droits réservés.</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <Link to="/lotopam/support" className="hover:text-white transition-colors">Support</Link>
              <Link to="/lotopam/terms" className="hover:text-white transition-colors">Conditions</Link>
              <Link to="/lotopam/privacy" className="hover:text-white transition-colors">Confidentialité</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LotoPamLayout;
