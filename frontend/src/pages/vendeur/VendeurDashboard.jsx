import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { 
  DollarSign, Ticket, TrendingUp, Bell, Clock, 
  Trophy, AlertCircle, CheckCircle, XCircle, Percent
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const VendeurDashboard = () => {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [commissionRate, setCommissionRate] = useState(10);
  const [stats, setStats] = useState({
    ventesJour: 0,
    ventesMois: 0,
    commissions: 0,
    ticketsJour: 0
  });
  const [recentTickets, setRecentTickets] = useState([]);
  const [latestResults, setLatestResults] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch profile to get commission rate, tickets, and results in parallel
      const [profileRes, ticketsRes, resultsRes] = await Promise.all([
        axios.get(`${API_URL}/api/vendeur/profile`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/vendeur/mes-tickets?limit=5`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/results?limit=5`, { headers }).catch(() => ({ data: [] }))
      ]);

      // Get commission rate from profile
      const profileCommission = profileRes.data?.vendeur?.commission_rate || 10;
      setCommissionRate(profileCommission);

      const tickets = ticketsRes.data || [];
      setRecentTickets(tickets.slice(0, 5));

      // Calculate stats from tickets with real commission
      const today = new Date().toISOString().split('T')[0];
      const thisMonth = new Date().toISOString().slice(0, 7);
      
      const todayTickets = tickets.filter(t => t.created_at?.startsWith(today));
      const monthTickets = tickets.filter(t => t.created_at?.startsWith(thisMonth));
      
      const ventesMois = monthTickets.reduce((sum, t) => sum + (t.total_amount || 0), 0);
      
      setStats({
        ventesJour: todayTickets.reduce((sum, t) => sum + (t.total_amount || 0), 0),
        ventesMois: ventesMois,
        commissions: ventesMois * (profileCommission / 100),
        ticketsJour: todayTickets.length
      });

      // Results
      const results = resultsRes.data || [];
      setLatestResults(results.slice(0, 5));

      // Notifications
      setNotifications([
        { id: 1, type: 'info', message: 'Nouveau tirage LOTTO 3 ce soir 20h', time: 'Il y a 1h' },
        { id: 2, type: 'success', message: 'Résultats SUPER 6 disponibles', time: 'Il y a 2h' },
      ]);

    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR').format(amount || 0);
  };

  const getStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case 'WINNER':
      case 'WON':
        return <Trophy className="w-4 h-4 text-amber-400" />;
      case 'LOST':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-blue-400" />;
    }
  };

  const getStatusText = (status) => {
    switch (status?.toUpperCase()) {
      case 'WINNER':
      case 'WON':
        return 'Gagnant';
      case 'LOST':
        return 'Perdu';
      default:
        return 'En attente';
    }
  };

  // Parse winning numbers
  const formatWinningNumbers = (wn) => {
    if (!wn) return '-';
    if (typeof wn === 'object') {
      const nums = [];
      if (wn.first) nums.push(wn.first);
      if (wn.second) nums.push(wn.second);
      if (wn.third) nums.push(wn.third);
      return nums.join(' - ');
    }
    return wn;
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 pb-24 lg:pb-6" data-testid="vendeur-dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Tableau de Bord</h1>
          <p className="text-sm text-slate-400">Bienvenue, {user?.full_name || 'Vendeur'}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs sm:text-sm text-slate-400">
            {new Date().toLocaleDateString('fr-FR', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long'
            })}
          </p>
        </div>
      </div>

      {/* Stats Cards - 2x2 grid on mobile */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-emerald-500/20 rounded-lg flex-shrink-0">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-slate-400">Ventes Jour</p>
              <p className="text-base sm:text-xl font-bold text-white truncate">{formatCurrency(stats.ventesJour)} <span className="text-xs">HTG</span></p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-blue-500/20 rounded-lg flex-shrink-0">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-slate-400">Ventes Mois</p>
              <p className="text-base sm:text-xl font-bold text-white truncate">{formatCurrency(stats.ventesMois)} <span className="text-xs">HTG</span></p>
            </div>
          </div>
        </div>

        {/* Commission Card with real rate */}
        <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-amber-500/20 rounded-lg flex-shrink-0">
              <Percent className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-amber-300">Commission ({commissionRate}%)</p>
              <p className="text-base sm:text-xl font-bold text-amber-400 truncate">{formatCurrency(stats.commissions)} <span className="text-xs">HTG</span></p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-purple-500/20 rounded-lg flex-shrink-0">
              <Ticket className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-slate-400">Tickets Jour</p>
              <p className="text-base sm:text-xl font-bold text-white">{stats.ticketsJour}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Notifications */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
          <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            Notifications
          </h2>
          <div className="space-y-2 sm:space-y-3">
            {notifications.map((notif) => (
              <div 
                key={notif.id}
                className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-slate-700/30 rounded-lg"
              >
                {notif.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-white">{notif.message}</p>
                  <p className="text-xs text-slate-400">{notif.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Latest Results */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
          <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            Derniers Résultats
          </h2>
          <div className="space-y-2 sm:space-y-3">
            {latestResults.length === 0 ? (
              <p className="text-slate-400 text-sm">Aucun résultat récent</p>
            ) : (
              latestResults.map((result, idx) => (
                <div 
                  key={result.result_id || idx}
                  className="flex items-center justify-between p-2 sm:p-3 bg-slate-700/30 rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white text-sm sm:text-base truncate">{result.lottery_name}</p>
                    <p className="text-xs text-slate-400 truncate">{result.draw_name} - {result.draw_date}</p>
                  </div>
                  <div className="text-right ml-2">
                    <p className="font-mono text-sm sm:text-lg text-amber-400 font-bold">
                      {formatWinningNumbers(result.winning_numbers)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Tickets */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
        <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
          Activité Récente
        </h2>
        <div className="space-y-2">
          {recentTickets.length === 0 ? (
            <p className="text-slate-400 text-sm">Aucun ticket récent</p>
          ) : (
            recentTickets.map((ticket, idx) => (
              <div 
                key={ticket.ticket_id || idx}
                className="flex items-center justify-between p-2 sm:p-3 bg-slate-700/30 rounded-lg"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  {getStatusIcon(ticket.status)}
                  <div className="min-w-0">
                    <p className="font-medium text-white text-sm sm:text-base truncate">{ticket.ticket_code || ticket.ticket_id}</p>
                    <p className="text-xs text-slate-400 truncate">{ticket.lottery_name}</p>
                  </div>
                </div>
                <div className="text-right ml-2">
                  <p className="font-semibold text-white text-sm sm:text-base">{formatCurrency(ticket.total_amount)} <span className="text-xs">HTG</span></p>
                  <p className={`text-xs ${
                    ticket.status === 'WINNER' ? 'text-amber-400' :
                    ticket.status === 'LOST' ? 'text-red-400' :
                    'text-blue-400'
                  }`}>
                    {getStatusText(ticket.status)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default VendeurDashboard;
