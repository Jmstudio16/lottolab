import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, Download, Calendar, Filter, RefreshCw, 
  TrendingUp, TrendingDown, Users, Store, Ticket, Award,
  DollarSign, FileText, BarChart3, PieChart, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { API_URL } from '@/config/api';
import { useAuth } from '@/api/auth';

/**
 * CompanyReportsExportPage - ULTRA PRO Reports & Excel Export
 * Full reporting and export functionality for Company Admin
 */
const CompanyReportsExportPage = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [downloadingType, setDownloadingType] = useState(null);
  
  // Date filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  
  // Filter options
  const [selectedVendeur, setSelectedVendeur] = useState('');
  const [selectedSuccursale, setSelectedSuccursale] = useState('');
  const [selectedLottery, setSelectedLottery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPayment, setSelectedPayment] = useState('');
  
  // Data for filters
  const [vendeurs, setVendeurs] = useState([]);
  const [succursales, setSuccursales] = useState([]);
  const [lotteries, setLotteries] = useState([]);
  
  // Stats
  const [stats, setStats] = useState({
    totalTickets: 0,
    totalSales: 0,
    totalWinnings: 0,
    profit: 0
  });

  useEffect(() => {
    loadFilterOptions();
    loadStats();
  }, []);

  const loadFilterOptions = async () => {
    try {
      // Load vendeurs
      const vendeurRes = await axios.get(`${API_URL}/api/company/agents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (vendeurRes.data) {
        setVendeurs(Array.isArray(vendeurRes.data) ? vendeurRes.data : []);
      }

      // Load succursales
      const succRes = await axios.get(`${API_URL}/api/company/succursales`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (succRes.data) {
        setSuccursales(Array.isArray(succRes.data) ? succRes.data : []);
      }

      // Load lotteries
      const lottRes = await axios.get(`${API_URL}/api/company/lotteries`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (lottRes.data) {
        setLotteries(Array.isArray(lottRes.data) ? lottRes.data.filter(l => l.enabled) : []);
      }
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const loadStats = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/company/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data) {
        setStats({
          totalTickets: res.data.tickets_today || 0,
          totalSales: res.data.sales_today || 0,
          totalWinnings: res.data.winnings_today || 0,
          profit: (res.data.sales_today || 0) - (res.data.winnings_today || 0)
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    if (selectedVendeur) params.append('vendeur_id', selectedVendeur);
    if (selectedSuccursale) params.append('succursale_id', selectedSuccursale);
    if (selectedLottery) params.append('lottery_id', selectedLottery);
    if (selectedStatus) params.append('status', selectedStatus);
    if (selectedPayment) params.append('payment_status', selectedPayment);
    return params.toString();
  };

  const handleDownload = async (type, endpoint, filename) => {
    setDownloadingType(type);
    try {
      const queryParams = buildQueryParams();
      const url = `${API_URL}${endpoint}?${queryParams}`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);

      toast.success('Rapport téléchargé avec succès');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erreur lors du téléchargement');
    } finally {
      setDownloadingType(null);
    }
  };

  const reportTypes = [
    {
      id: 'tickets',
      title: 'Historique Complet des Tickets',
      description: 'Tous les tickets avec détails: numéros, vendeur, succursale, gains, statut',
      icon: Ticket,
      color: 'blue',
      endpoint: '/api/reports/tickets/excel',
      filename: 'historique_tickets'
    },
    {
      id: 'sales-day',
      title: 'Ventes par Jour',
      description: 'Résumé quotidien: ventes, gains, profit, nombre de tickets',
      icon: Calendar,
      color: 'emerald',
      endpoint: '/api/reports/sales-by-day/excel',
      filename: 'ventes_par_jour'
    },
    {
      id: 'sales-agent',
      title: 'Ventes par Vendeur',
      description: 'Performance de chaque vendeur: tickets, ventes, commission',
      icon: Users,
      color: 'purple',
      endpoint: '/api/reports/sales-by-agent/excel',
      filename: 'ventes_par_vendeur'
    },
    {
      id: 'sales-branch',
      title: 'Ventes par Succursale',
      description: 'Performance par succursale: vendeurs, tickets, ventes, marge',
      icon: Store,
      color: 'amber',
      endpoint: '/api/reports/sales-by-branch/excel',
      filename: 'ventes_par_succursale'
    },
    {
      id: 'sales-lottery',
      title: 'Ventes par Loterie',
      description: 'Performance par type de loterie: tickets, ventes, taux de gain',
      icon: PieChart,
      color: 'pink',
      endpoint: '/api/reports/sales-by-lottery/excel',
      filename: 'ventes_par_loterie'
    },
    {
      id: 'winners',
      title: 'Tickets Gagnants',
      description: 'Liste des gagnants: montants, statut paiement, date',
      icon: Award,
      color: 'green',
      endpoint: '/api/reports/winners/excel',
      filename: 'tickets_gagnants'
    },
    {
      id: 'profit-loss',
      title: 'Gains et Pertes',
      description: 'Résumé financier: ventes totales, gains payés, profit net, marge',
      icon: DollarSign,
      color: 'cyan',
      endpoint: '/api/reports/profit-loss/excel',
      filename: 'gains_pertes'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      pink: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      green: 'bg-green-500/20 text-green-400 border-green-500/30',
      cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400" />
            Rapports & Export Excel
          </h1>
          <p className="text-sm text-slate-400">Téléchargez vos rapports professionnels en Excel</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Ticket className="w-4 h-4" />
            Tickets Aujourd'hui
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalTickets.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            Ventes
          </div>
          <p className="text-2xl font-bold text-emerald-400">{stats.totalSales.toLocaleString()} HTG</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <TrendingDown className="w-4 h-4" />
            Gains Payés
          </div>
          <p className="text-2xl font-bold text-amber-400">{stats.totalWinnings.toLocaleString()} HTG</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            Profit
          </div>
          <p className={`text-2xl font-bold ${stats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {stats.profit.toLocaleString()} HTG
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Filtres avant Export</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Range */}
          <div className="space-y-2">
            <label className="text-sm text-slate-400 flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Date début
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-400 flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Date fin
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            />
          </div>

          {/* Vendeur */}
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Vendeur</label>
            <select
              value={selectedVendeur}
              onChange={(e) => setSelectedVendeur(e.target.value)}
              className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            >
              <option value="">Tous les vendeurs</option>
              {vendeurs.map(v => (
                <option key={v.user_id} value={v.user_id}>
                  {v.name || v.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Succursale */}
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Succursale</label>
            <select
              value={selectedSuccursale}
              onChange={(e) => setSelectedSuccursale(e.target.value)}
              className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            >
              <option value="">Toutes les succursales</option>
              {succursales.map(s => (
                <option key={s.succursale_id || s.branch_id} value={s.succursale_id || s.branch_id}>
                  {s.nom_succursale || s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Lottery */}
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Loterie</label>
            <select
              value={selectedLottery}
              onChange={(e) => setSelectedLottery(e.target.value)}
              className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            >
              <option value="">Toutes les loteries</option>
              {lotteries.map(l => (
                <option key={l.lottery_id} value={l.lottery_id}>
                  {l.lottery_name}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Statut Ticket</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            >
              <option value="">Tous les statuts</option>
              <option value="VALIDATED">En attente</option>
              <option value="WINNER">Gagnant</option>
              <option value="LOSER">Perdant</option>
              <option value="VOID">Annulé</option>
            </select>
          </div>

          {/* Payment Status */}
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Statut Paiement</label>
            <select
              value={selectedPayment}
              onChange={(e) => setSelectedPayment(e.target.value)}
              className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            >
              <option value="">Tous</option>
              <option value="PAID">Payé</option>
              <option value="UNPAID">Non payé</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <Button
              onClick={() => {
                setSelectedVendeur('');
                setSelectedSuccursale('');
                setSelectedLottery('');
                setSelectedStatus('');
                setSelectedPayment('');
                const d = new Date();
                d.setDate(d.getDate() - 30);
                setDateFrom(d.toISOString().split('T')[0]);
                setDateTo(new Date().toISOString().split('T')[0]);
              }}
              variant="outline"
              className="w-full border-slate-600"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Réinitialiser
            </Button>
          </div>
        </div>
      </div>

      {/* Report Types */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-400" />
          Types de Rapports Disponibles
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTypes.map((report) => (
            <div
              key={report.id}
              className={`bg-slate-800/50 border rounded-xl p-4 hover:border-slate-500 transition-colors ${getColorClasses(report.color).split(' ')[2]}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg ${getColorClasses(report.color).split(' ').slice(0, 2).join(' ')} flex items-center justify-center`}>
                  <report.icon className="w-5 h-5" />
                </div>
                <Button
                  onClick={() => handleDownload(report.id, report.endpoint, report.filename)}
                  disabled={downloadingType === report.id}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  data-testid={`download-${report.id}-btn`}
                >
                  {downloadingType === report.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <h3 className="text-white font-semibold mb-1">{report.title}</h3>
              <p className="text-sm text-slate-400">{report.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <h3 className="text-blue-400 font-semibold mb-1">Format des Rapports</h3>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>• Tous les rapports sont générés au format Excel (.xlsx)</li>
              <li>• Les en-têtes sont professionnels et colorés</li>
              <li>• Les montants sont formatés avec séparateurs de milliers</li>
              <li>• Les filtres appliqués sont notés dans le rapport</li>
              <li>• Limite: 50,000 lignes par export</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyReportsExportPage;
