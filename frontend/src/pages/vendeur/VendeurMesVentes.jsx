import { API_URL } from '@/config/api';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  BarChart3, Calendar, TrendingUp, RefreshCw, Download, DollarSign, Percent
} from 'lucide-react';
import { Button } from '@/components/ui/button';


const VendeurMesVentes = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const [commissionRate, setCommissionRate] = useState(0); // DEFAULT TO 0 - Only show if configured by admin
  const [stats, setStats] = useState({
    totalVentes: 0,
    totalTickets: 0,
    moyenneTicket: 0,
    commission: 0
  });
  const [salesByLottery, setSalesByLottery] = useState([]);
  const [dailySales, setDailySales] = useState([]);

  const headers = { Authorization: `Bearer ${token}` };

  // Fetch commission rate from profile - Only if explicitly configured
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/vendeur/profile`, { headers });
        // Only set commission if it's explicitly configured (not 0 or undefined)
        const rate = res.data?.vendeur?.commission_rate;
        if (rate && rate > 0) {
          setCommissionRate(rate);
        } else {
          setCommissionRate(0);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        setCommissionRate(0);
      }
    };
    fetchProfile();
  }, [token]);

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

      // Calculate stats with real commission rate
      const totalVentes = filteredTickets.reduce((sum, t) => sum + (t.total_amount || 0), 0);
      const totalTickets = filteredTickets.length;
      const moyenneTicket = totalTickets > 0 ? totalVentes / totalTickets : 0;
      const commission = totalVentes * (commissionRate / 100);

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
  }, [token, period, commissionRate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (amount) => new Intl.NumberFormat('fr-FR').format(amount || 0);

  const maxDailySale = Math.max(...dailySales.map(d => d.amount), 1);

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-4 sm:space-y-6" data-testid="vendeur-mes-ventes">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400" />
            Mes Ventes
          </h1>
          <p className="text-sm text-slate-400">Analyse de vos performances</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" className="border-slate-700 w-fit">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Period Filter - Scrollable on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        {[
          { value: 'today', label: "Aujourd'hui" },
          { value: 'week', label: 'Semaine' },
          { value: 'month', label: 'Mois' },
          { value: 'all', label: 'Tout' }
        ].map(opt => (
          <Button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            variant={period === opt.value ? 'default' : 'outline'}
            size="sm"
            className={`whitespace-nowrap ${period === opt.value ? 'bg-emerald-600' : 'border-slate-700'}`}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-emerald-500/20 rounded-lg">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-slate-400">Total Ventes</p>
              <p className="text-lg sm:text-xl font-bold text-white truncate">{formatCurrency(stats.totalVentes)} HTG</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-blue-500/20 rounded-lg">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-slate-400">Tickets</p>
              <p className="text-lg sm:text-xl font-bold text-white">{stats.totalTickets}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-purple-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-slate-400">Moyenne</p>
              <p className="text-lg sm:text-xl font-bold text-white truncate">{formatCurrency(stats.moyenneTicket)} HTG</p>
            </div>
          </div>
        </div>

        {/* Commission Card - Only show if commission rate > 0 */}
        {commissionRate > 0 && (
          <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-amber-500/20 rounded-lg">
                <Percent className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-amber-300">Commission ({commissionRate}%)</p>
                <p className="text-lg sm:text-xl font-bold text-amber-400 truncate">{formatCurrency(stats.commission)} HTG</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Daily Chart */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
          <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            Ventes par Jour
          </h3>
          {dailySales.length === 0 ? (
            <p className="text-slate-400 text-center py-6 sm:py-8 text-sm">Aucune donnée</p>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {dailySales.map((day, idx) => (
                <div key={idx} className="flex items-center gap-2 sm:gap-3">
                  <span className="text-xs text-slate-400 w-12 sm:w-20 flex-shrink-0">
                    {new Date(day.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </span>
                  <div className="flex-1 h-5 sm:h-6 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                      style={{ width: `${(day.amount / maxDailySale) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs sm:text-sm text-white font-medium w-16 sm:w-24 text-right flex-shrink-0">
                    {formatCurrency(day.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Lottery */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
          <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            Ventes par Loterie
          </h3>
          {salesByLottery.length === 0 ? (
            <p className="text-slate-400 text-center py-6 sm:py-8 text-sm">Aucune donnée</p>
          ) : (
            <div className="space-y-2 sm:space-y-3 max-h-[250px] sm:max-h-[300px] overflow-y-auto">
              {salesByLottery.map((lot, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 sm:p-3 bg-slate-700/30 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white text-sm sm:text-base truncate">{lot.name}</p>
                    <p className="text-xs text-slate-400">{lot.count} ticket(s)</p>
                  </div>
                  <span className="text-emerald-400 font-semibold text-sm sm:text-base ml-2">{formatCurrency(lot.amount)} HTG</span>
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
