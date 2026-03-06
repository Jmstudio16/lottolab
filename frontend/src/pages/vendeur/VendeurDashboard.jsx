import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { 
  DollarSign, Ticket, TrendingUp, Bell, Clock, 
  Trophy, AlertCircle, CheckCircle, XCircle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const VendeurDashboard = () => {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
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
      
      // Fetch stats
      const [ticketsRes, resultsRes] = await Promise.all([
        axios.get(`${API_URL}/api/vendeur/mes-tickets?limit=5`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/results?limit=5`, { headers }).catch(() => ({ data: [] }))
      ]);

      const tickets = ticketsRes.data || [];
      setRecentTickets(tickets.slice(0, 5));

      // Calculate stats from tickets
      const today = new Date().toISOString().split('T')[0];
      const thisMonth = new Date().toISOString().slice(0, 7);
      
      const todayTickets = tickets.filter(t => t.created_at?.startsWith(today));
      const monthTickets = tickets.filter(t => t.created_at?.startsWith(thisMonth));
      
      setStats({
        ventesJour: todayTickets.reduce((sum, t) => sum + (t.total_amount || 0), 0),
        ventesMois: monthTickets.reduce((sum, t) => sum + (t.total_amount || 0), 0),
        commissions: monthTickets.reduce((sum, t) => sum + (t.total_amount || 0), 0) * 0.1,
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
    <div className="p-6 space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tableau de Bord</h1>
          <p className="text-slate-400">Bienvenue, {user?.full_name || 'Vendeur'}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">
            {new Date().toLocaleDateString('fr-FR', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Ventes Jour</p>
              <p className="text-xl font-bold text-white">{formatCurrency(stats.ventesJour)} HTG</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Ventes Mois</p>
              <p className="text-xl font-bold text-white">{formatCurrency(stats.ventesMois)} HTG</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Commissions</p>
              <p className="text-xl font-bold text-white">{formatCurrency(stats.commissions)} HTG</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Ticket className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Tickets Jour</p>
              <p className="text-xl font-bold text-white">{stats.ticketsJour}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Notifications */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            Notifications
          </h2>
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div 
                key={notif.id}
                className="flex items-start gap-3 p-3 bg-slate-700/30 rounded-lg"
              >
                {notif.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-sm text-white">{notif.message}</p>
                  <p className="text-xs text-slate-400">{notif.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Latest Results */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            Derniers Résultats
          </h2>
          <div className="space-y-3">
            {latestResults.length === 0 ? (
              <p className="text-slate-400 text-sm">Aucun résultat récent</p>
            ) : (
              latestResults.map((result, idx) => (
                <div 
                  key={result.result_id || idx}
                  className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-white">{result.lottery_name}</p>
                    <p className="text-xs text-slate-400">{result.draw_name} - {result.draw_date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg text-amber-400 font-bold">
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
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Ticket className="w-5 h-5 text-purple-400" />
          Activité Récente
        </h2>
        <div className="space-y-2">
          {recentTickets.length === 0 ? (
            <p className="text-slate-400 text-sm">Aucun ticket récent</p>
          ) : (
            recentTickets.map((ticket, idx) => (
              <div 
                key={ticket.ticket_id || idx}
                className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(ticket.status)}
                  <div>
                    <p className="font-medium text-white">{ticket.ticket_code || ticket.ticket_id}</p>
                    <p className="text-xs text-slate-400">{ticket.lottery_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">{formatCurrency(ticket.total_amount)} HTG</p>
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
