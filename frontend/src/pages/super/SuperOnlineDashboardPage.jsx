import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/api/auth';
import AdminLayout from '@/components/AdminLayout';
import { 
  Users, Wallet, ArrowUpCircle, ArrowDownCircle, 
  Ticket, Shield, AlertTriangle, TrendingUp, 
  DollarSign, Clock, Loader2, RefreshCw
} from 'lucide-react';

const SuperOnlineDashboardPage = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/online-admin/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: t('admin.onlinePlayers'),
      value: stats?.total_players || 0,
      subtitle: `${stats?.active_players || 0} actifs`,
      icon: Users,
      color: 'blue',
      link: '/super/online/players'
    },
    {
      title: 'KYC en Attente',
      value: stats?.pending_kyc || 0,
      subtitle: 'À vérifier',
      icon: Shield,
      color: 'yellow',
      link: '/super/online/kyc'
    },
    {
      title: t('financial.pendingDeposits'),
      value: stats?.pending_deposits?.count || 0,
      subtitle: `${(stats?.pending_deposits?.total_amount || 0).toLocaleString()} HTG`,
      icon: ArrowUpCircle,
      color: 'green',
      link: '/super/online/deposits'
    },
    {
      title: t('financial.pendingWithdrawals'),
      value: stats?.pending_withdrawals?.count || 0,
      subtitle: `${(stats?.pending_withdrawals?.total_amount || 0).toLocaleString()} HTG`,
      icon: ArrowDownCircle,
      color: 'red',
      link: '/super/online/withdrawals'
    },
    {
      title: 'Tickets Aujourd\'hui',
      value: stats?.today?.tickets_count || 0,
      subtitle: `${(stats?.today?.bets_amount || 0).toLocaleString()} HTG misés`,
      icon: Ticket,
      color: 'purple',
      link: '/super/online/tickets'
    },
    {
      title: t('admin.fraudAlerts'),
      value: stats?.fraud_alerts || 0,
      subtitle: 'À examiner',
      icon: AlertTriangle,
      color: 'orange',
      link: '/super/online/players'
    }
  ];

  const quickActions = [
    { label: 'Gestion Joueurs', icon: Users, path: '/super/online/players', color: 'blue' },
    { label: 'Approuver Dépôts', icon: ArrowUpCircle, path: '/super/online/deposits', color: 'green' },
    { label: 'Traiter Retraits', icon: ArrowDownCircle, path: '/super/online/withdrawals', color: 'red' },
    { label: 'Vérifier KYC', icon: Shield, path: '/super/online/kyc', color: 'yellow' },
    { label: 'Tickets En Ligne', icon: Ticket, path: '/super/online/tickets', color: 'purple' },
    { label: 'Paramètres', icon: TrendingUp, path: '/super/online/settings', color: 'slate' }
  ];

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center text-lg font-bold text-slate-900">
                LP
              </span>
              {t('nav.onlinePlatform')}
            </h1>
            <p className="text-slate-400 mt-1">Tableau de bord de la plateforme LOTO PAM</p>
          </div>
          <button
            onClick={loadStats}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {statCards.map((card, index) => (
              <Link
                key={index}
                to={card.link}
                className={`bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-${card.color}-500/50 transition-all group`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">{card.title}</p>
                    <p className="text-3xl font-bold text-white mt-1">{card.value}</p>
                    <p className={`text-sm text-${card.color}-400 mt-1`}>{card.subtitle}</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-${card.color}-500/20 group-hover:bg-${card.color}-500/30 transition-colors`}>
                    <card.icon className={`w-6 h-6 text-${card.color}-400`} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Today's Summary */}
        {stats?.today && (
          <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-yellow-500/30 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              Résumé Aujourd'hui
            </h2>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">{stats.today.tickets_count}</p>
                <p className="text-sm text-slate-400">Tickets Vendus</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-400">{stats.today.bets_amount?.toLocaleString()}</p>
                <p className="text-sm text-slate-400">HTG Misés</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-400">{stats.today.winnings_amount?.toLocaleString()}</p>
                <p className="text-sm text-slate-400">HTG Gagnés</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4">Actions Rapides</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickActions.map((action, index) => (
              <Link
                key={index}
                to={action.path}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center hover:border-yellow-500/50 hover:bg-slate-800 transition-all group"
              >
                <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-${action.color}-500/20 flex items-center justify-center group-hover:bg-${action.color}-500/30 transition-colors`}>
                  <action.icon className={`w-6 h-6 text-${action.color}-400`} />
                </div>
                <p className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  {action.label}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SuperOnlineDashboardPage;
