import { API_URL } from '@/config/api';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  BarChart3, TrendingUp, Ticket, DollarSign, Calendar,
  RefreshCw, Download, Filter, Trophy, Clock, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

const VendeurRapportPage = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [dateFilter, setDateFilter] = useState('today');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [useCustomDate, setUseCustomDate] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchReport();
  }, [dateFilter, useCustomDate]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/vendeur/report`;
      if (useCustomDate) {
        url += `?start_date=${startDate}&end_date=${endDate}`;
      } else {
        url += `?period=${dateFilter}`;
      }
      const res = await axios.get(url, { headers });
      setReport(res.data);
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('Erreur lors du chargement du rapport');
      setReport({
        period: dateFilter,
        total_sales: 0,
        total_tickets: 0,
        total_commission: 0,
        winning_tickets: 0,
        paid_tickets: 0,
        unpaid_tickets: 0,
        tickets_by_lottery: [],
        daily_stats: []
      });
    }
    setLoading(false);
  };

  const handleCustomDateSearch = () => {
    setUseCustomDate(true);
    fetchReport();
  };

  const dateFilters = [
    { value: 'today', label: "Aujourd'hui" },
    { value: 'yesterday', label: 'Hier' },
    { value: 'week', label: 'Cette semaine' },
    { value: 'month', label: 'Ce mois' },
    { value: 'all', label: 'Tout' }
  ];

  const handlePresetFilter = (value) => {
    setUseCustomDate(false);
    setDateFilter(value);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6" data-testid="vendeur-rapport-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            Mon Rapport
          </h1>
          <p className="text-slate-400 text-sm">Statistiques et performance de ventes</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={fetchReport} 
            variant="outline" 
            size="sm" 
            className="border-slate-700"
            data-testid="refresh-report-btn"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Date Filters */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4 space-y-4">
          {/* Preset Filters */}
          <div className="flex gap-2 flex-wrap">
            {dateFilters.map(filter => (
              <Button
                key={filter.value}
                onClick={() => handlePresetFilter(filter.value)}
                variant={!useCustomDate && dateFilter === filter.value ? 'default' : 'outline'}
                className={!useCustomDate && dateFilter === filter.value ? 'bg-blue-600' : 'border-slate-700'}
                size="sm"
                data-testid={`filter-${filter.value}`}
              >
                {filter.label}
              </Button>
            ))}
          </div>

          {/* Custom Date Range */}
          <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-700">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Dates personnalisées:</span>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40 bg-slate-900 border-slate-700 text-white"
                data-testid="start-date"
              />
              <span className="text-slate-400">à</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40 bg-slate-900 border-slate-700 text-white"
                data-testid="end-date"
              />
              <Button 
                onClick={handleCustomDateSearch}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                data-testid="search-custom-date"
              >
                <Filter className="w-4 h-4 mr-1" />
                Rechercher
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-300 text-xs">Ventes Totales</p>
                <p className="text-2xl font-bold text-white">{(report?.total_sales || 0).toLocaleString()} HTG</p>
              </div>
              <DollarSign className="w-10 h-10 text-emerald-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-300 text-xs">Tickets Vendus</p>
                <p className="text-2xl font-bold text-white">{report?.total_tickets || 0}</p>
              </div>
              <Ticket className="w-10 h-10 text-blue-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-300 text-xs">Tickets Gagnants</p>
                <p className="text-2xl font-bold text-white">{report?.winning_tickets || 0}</p>
              </div>
              <Trophy className="w-10 h-10 text-amber-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        {/* Only show commission if > 0 */}
        {(report?.total_commission || 0) > 0 ? (
          <Card className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 border-purple-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-300 text-xs">Commission</p>
                  <p className="text-2xl font-bold text-emerald-400">{(report?.total_commission || 0).toLocaleString()} HTG</p>
                </div>
                <TrendingUp className="w-10 h-10 text-purple-400 opacity-80" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gradient-to-br from-slate-500/20 to-slate-500/5 border-slate-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-300 text-xs">Période</p>
                  <p className="text-lg font-bold text-white">
                    {useCustomDate ? `${startDate} - ${endDate}` : dateFilters.find(f => f.value === dateFilter)?.label}
                  </p>
                </div>
                <Calendar className="w-10 h-10 text-slate-400 opacity-80" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Payment Status */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Ticket className="w-5 h-5 text-blue-400" />
            Statut des Paiements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
              <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-emerald-400">{report?.paid_tickets || 0}</p>
              <p className="text-sm text-slate-400">Tickets Payés</p>
            </div>
            <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg text-center">
              <Clock className="w-6 h-6 text-orange-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-orange-400">{report?.unpaid_tickets || 0}</p>
              <p className="text-sm text-slate-400">En Attente</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lottery Breakdown */}
      {report?.tickets_by_lottery && report.tickets_by_lottery.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Ventes par Loterie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.tickets_by_lottery.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                  <div>
                    <p className="text-white font-medium">{item.lottery_name}</p>
                    <p className="text-slate-400 text-sm">{item.count} tickets</p>
                  </div>
                  <p className="text-emerald-400 font-bold">{item.amount?.toLocaleString()} HTG</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-8">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      )}
    </div>
  );
};

export default VendeurRapportPage;
