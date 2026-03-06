import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  BarChart3, Calendar, TrendingUp, RefreshCw, Download, DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const VendeurMesVentes = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const [stats, setStats] = useState({
    totalVentes: 0,
    totalTickets: 0,
    moyenneTicket: 0,
    commission: 0
  });
  const [salesByLottery, setSalesByLottery] = useState([]);
  const [dailySales, setDailySales] = useState([]);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/vendeur/mes-tickets`, { headers });
      const tickets = res.data || [];

      // Filter by period
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const monthStart = now.toISOString().slice(0, 7);

      let filteredTickets = tickets;
      if (period === 'today') {
        filteredTickets = tickets.filter(t => t.created_at?.startsWith(today));
      } else if (period === 'week') {
        filteredTickets = tickets.filter(t => t.created_at >= weekAgo);
      } else if (period === 'month') {
        filteredTickets = tickets.filter(t => t.created_at?.startsWith(monthStart));
      }

      // Calculate stats
      const totalVentes = filteredTickets.reduce((sum, t) => sum + (t.total_amount || 0), 0);
      const totalTickets = filteredTickets.length;
      const moyenneTicket = totalTickets > 0 ? totalVentes / totalTickets : 0;
      const commission = totalVentes * 0.1;

      setStats({ totalVentes, totalTickets, moyenneTicket, commission });

      // Sales by lottery
      const byLottery = {};
      filteredTickets.forEach(t => {
        const name = t.lottery_name || 'Inconnu';
        if (!byLottery[name]) {
          byLottery[name] = { name, amount: 0, count: 0 };
        }
        byLottery[name].amount += t.total_amount || 0;
        byLottery[name].count += 1;
      });
      setSalesByLottery(Object.values(byLottery).sort((a, b) => b.amount - a.amount));

      // Daily sales
      const byDay = {};
      tickets.forEach(t => {
        const day = t.created_at?.split('T')[0] || 'Inconnu';
        if (!byDay[day]) byDay[day] = 0;
        byDay[day] += t.total_amount || 0;
      });
      setDailySales(Object.entries(byDay).slice(-7).map(([date, amount]) => ({ date, amount })));

    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (amount) => new Intl.NumberFormat('fr-FR').format(amount || 0);

  const maxDailySale = Math.max(...dailySales.map(d => d.amount), 1);

  return (
    <div className="p-6 pb-24 lg:pb-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-emerald-400" />
            Mes Ventes
          </h1>
          <p className="text-slate-400">Analyse de vos performances</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" className="border-slate-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Period Filter */}
      <div className="flex gap-2">
        {[
          { value: 'today', label: "Aujourd'hui" },
          { value: 'week', label: 'Cette semaine' },
          { value: 'month', label: 'Ce mois' },
          { value: 'all', label: 'Tout' }
        ].map(opt => (
          <Button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            variant={period === opt.value ? 'default' : 'outline'}
            size="sm"
            className={period === opt.value ? 'bg-emerald-600' : 'border-slate-700'}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Ventes</p>
              <p className="text-xl font-bold text-white">{formatCurrency(stats.totalVentes)} HTG</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Tickets Vendus</p>
              <p className="text-xl font-bold text-white">{stats.totalTickets}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Moyenne/Ticket</p>
              <p className="text-xl font-bold text-white">{formatCurrency(stats.moyenneTicket)} HTG</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Commission (10%)</p>
              <p className="text-xl font-bold text-white">{formatCurrency(stats.commission)} HTG</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Daily Chart */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            Ventes par Jour
          </h3>
          {dailySales.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Aucune donnée</p>
          ) : (
            <div className="space-y-3">
              {dailySales.map((day, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-20">
                    {new Date(day.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </span>
                  <div className="flex-1 h-6 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                      style={{ width: `${(day.amount / maxDailySale) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-white font-medium w-24 text-right">
                    {formatCurrency(day.amount)} HTG
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Lottery */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Ventes par Loterie
          </h3>
          {salesByLottery.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Aucune donnée</p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {salesByLottery.map((lot, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <div>
                    <p className="font-medium text-white">{lot.name}</p>
                    <p className="text-xs text-slate-400">{lot.count} ticket(s)</p>
                  </div>
                  <span className="text-emerald-400 font-semibold">{formatCurrency(lot.amount)} HTG</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendeurMesVentes;
