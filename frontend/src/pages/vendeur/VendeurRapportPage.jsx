import { API_URL } from '@/config/api';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, TrendingUp, Ticket, DollarSign, Calendar,
  RefreshCw, Download, Filter
} from 'lucide-react';
import { toast } from 'sonner';

const VendeurRapportPage = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [dateFilter, setDateFilter] = useState('today');

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchReport();
  }, [dateFilter]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/vendeur/report?period=${dateFilter}`, { headers });
      setReport(res.data);
    } catch (error) {
      console.error('Error fetching report:', error);
      // Use mock data if API fails
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

  const dateFilters = [
    { value: 'today', label: "Aujourd'hui" },
    { value: 'week', label: 'Cette semaine' },
    { value: 'month', label: 'Ce mois' },
    { value: 'all', label: 'Tout' }
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            Mon Rapport
          </h1>
          <p className="text-slate-400 text-sm">Statistiques et performance de ventes</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchReport} variant="outline" size="sm" className="border-slate-700">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Date Filter */}
      <div className="flex gap-2 flex-wrap">
        {dateFilters.map(filter => (
          <Button
            key={filter.value}
            onClick={() => setDateFilter(filter.value)}
            variant={dateFilter === filter.value ? 'default' : 'outline'}
            className={dateFilter === filter.value ? 'bg-blue-600' : 'border-slate-700'}
            size="sm"
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs">Ventes Totales</p>
                <p className="text-xl font-bold text-white">{report?.total_sales || 0} HTG</p>
              </div>
              <DollarSign className="w-8 h-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs">Tickets Vendus</p>
                <p className="text-xl font-bold text-white">{report?.total_tickets || 0}</p>
              </div>
              <Ticket className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs">Commission</p>
                <p className="text-xl font-bold text-emerald-400">{report?.total_commission || 0} HTG</p>
              </div>
              <TrendingUp className="w-8 h-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs">Tickets Gagnants</p>
                <p className="text-xl font-bold text-amber-400">{report?.winning_tickets || 0}</p>
              </div>
              <Calendar className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Status */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">Status des Paiements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
              <p className="text-2xl font-bold text-emerald-400">{report?.paid_tickets || 0}</p>
              <p className="text-sm text-slate-400">Tickets Payés</p>
            </div>
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-400">{report?.unpaid_tickets || 0}</p>
              <p className="text-sm text-slate-400">En Attente</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">Activité Récente</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : (
            <div className="text-center text-slate-400 py-8">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Les statistiques détaillées seront affichées ici</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VendeurRapportPage;
