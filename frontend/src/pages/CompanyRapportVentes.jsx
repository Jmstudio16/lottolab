import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  FileText, Calendar, Download, RefreshCw, User,
  Ticket, DollarSign, Percent, TrendingUp, Filter
} from 'lucide-react';
import CompanyLayout from '@/components/CompanyLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(amount || 0);
};

const CompanyRapportVentes = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState([]);
  const [totals, setTotals] = useState({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const headers = { Authorization: `Bearer ${token}` };

  // Set default dates (today)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setDateFrom(today);
    setDateTo(today);
  }, []);

  // Fetch report data
  const fetchReport = async () => {
    try {
      setLoading(true);
      
      // Build query params
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      
      const res = await axios.get(
        `${API_URL}/api/company/reports/ventes-detaillees?${params.toString()}`,
        { headers }
      );
      
      setReportData(res.data.agents || []);
      setTotals(res.data.totals || {});
    } catch (error) {
      toast.error('Erreur lors du chargement du rapport');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on mount and when dates change
  useEffect(() => {
    // Fetch immediately without waiting for dates
    fetchReport();
  }, [token]);

  const handleSearch = () => {
    fetchReport();
  };

  const exportToExcel = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    window.open(`${API_URL}/api/export/company/sales-report?token=${token}&${params.toString()}`, '_blank');
    toast.success('Téléchargement du fichier Excel en cours...');
  };

  // Calculate B.Final (Balance Final) for an agent
  const calculateBFinal = (agent) => {
    const vente = agent.total_ventes || 0;
    const paye = agent.total_paye || 0;
    const commAgent = (vente * (agent.pourcentage_agent || 10)) / 100;
    const commSup = (vente * (agent.pourcentage_superviseur || 10)) / 100;
    return vente - commAgent - commSup;
  };

  return (
    <CompanyLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
              <FileText className="w-6 h-6 md:w-7 md:h-7 text-emerald-400" />
              Rapport de Ventes
            </h1>
            <p className="text-slate-400 text-sm md:text-base">Rapport détaillé avec pourcentages agents et superviseurs</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={exportToExcel} 
              variant="outline"
              className="border-emerald-700 text-emerald-400 hover:bg-emerald-500/10"
              data-testid="export-excel-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button 
              onClick={handleSearch} 
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <Label className="text-slate-300 text-sm">Date Début</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white mt-1"
              />
            </div>
            <div className="flex-1">
              <Label className="text-slate-300 text-sm">Date Fin</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white mt-1"
              />
            </div>
            <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
              <Filter className="w-4 h-4 mr-2" />
              Filtrer
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 md:p-4">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <User className="w-4 h-4" />
              <span className="text-xs md:text-sm">Agents Actifs</span>
            </div>
            <p className="text-lg md:text-2xl font-bold text-white">{reportData.length}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 md:p-4">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Ticket className="w-4 h-4" />
              <span className="text-xs md:text-sm">Total Tickets</span>
            </div>
            <p className="text-lg md:text-2xl font-bold text-blue-400">{totals.total_tickets || 0}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 md:p-4">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs md:text-sm">Total Ventes</span>
            </div>
            <p className="text-lg md:text-2xl font-bold text-emerald-400">HTG {formatCurrency(totals.total_ventes)}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 md:p-4">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs md:text-sm">Total Gagnants</span>
            </div>
            <p className="text-lg md:text-2xl font-bold text-amber-400">{totals.total_gagnants || 0}</p>
          </div>
        </div>

        {/* Report Table */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-900/80">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-300 uppercase">No</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-300 uppercase">Agent</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-slate-300 uppercase">Tfiche</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-slate-300 uppercase">Tfiche Gagnant</th>
                  <th className="px-3 py-3 text-right text-xs font-bold text-slate-300 uppercase">Vente</th>
                  <th className="px-3 py-3 text-right text-xs font-bold text-slate-300 uppercase">A Payé</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-amber-400 uppercase">%Agent</th>
                  <th className="px-3 py-3 text-right text-xs font-bold text-slate-300 uppercase">P/P sans %agent</th>
                  <th className="px-3 py-3 text-right text-xs font-bold text-slate-300 uppercase">P/P avec %agent</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-purple-400 uppercase">%Sup</th>
                  <th className="px-3 py-3 text-right text-xs font-bold text-emerald-400 uppercase">B.Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="11" className="px-6 py-12 text-center">
                      <RefreshCw className="w-8 h-8 mx-auto text-emerald-400 animate-spin mb-2" />
                      <p className="text-slate-400">Chargement...</p>
                    </td>
                  </tr>
                ) : reportData.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="px-6 py-12 text-center text-slate-400">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Aucune donnée pour cette période</p>
                    </td>
                  </tr>
                ) : (
                  reportData.map((agent, index) => {
                    const vente = agent.total_ventes || 0;
                    const paye = agent.total_paye || 0;
                    const pctAgent = agent.pourcentage_agent || 10;
                    const pctSup = agent.pourcentage_superviseur || 10;
                    const commAgent = (vente * pctAgent) / 100;
                    const ppSansAgent = vente;
                    const ppAvecAgent = vente - commAgent;
                    const bFinal = vente - commAgent - ((vente * pctSup) / 100);
                    
                    return (
                      <tr key={agent.agent_id || index} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-3 py-3 text-sm text-slate-400">{index + 1}</td>
                        <td className="px-3 py-3 text-sm text-white font-medium">{agent.agent_name || 'Agent'}</td>
                        <td className="px-3 py-3 text-sm text-center text-blue-400">{agent.total_tickets || 0}</td>
                        <td className="px-3 py-3 text-sm text-center text-amber-400 font-bold">{agent.tickets_gagnants || 0}</td>
                        <td className="px-3 py-3 text-sm text-right text-emerald-400">{formatCurrency(vente)}</td>
                        <td className="px-3 py-3 text-sm text-right text-cyan-400">{formatCurrency(paye)}</td>
                        <td className="px-3 py-3 text-sm text-center">
                          <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-bold">
                            {pctAgent}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-slate-300">{formatCurrency(ppSansAgent)}</td>
                        <td className="px-3 py-3 text-sm text-right text-slate-300">{formatCurrency(ppAvecAgent)}</td>
                        <td className="px-3 py-3 text-sm text-center">
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-bold">
                            {pctSup}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-emerald-400 font-bold">{formatCurrency(bFinal)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {/* Totals Row */}
              {reportData.length > 0 && (
                <tfoot className="bg-slate-900/80 border-t-2 border-emerald-500/50">
                  <tr>
                    <td colSpan="2" className="px-3 py-3 text-sm font-bold text-white uppercase">TOTAL</td>
                    <td className="px-3 py-3 text-sm text-center text-blue-400 font-bold">{totals.total_tickets || 0}</td>
                    <td className="px-3 py-3 text-sm text-center text-amber-400 font-bold">{totals.total_gagnants || 0}</td>
                    <td className="px-3 py-3 text-sm text-right text-emerald-400 font-bold">{formatCurrency(totals.total_ventes)}</td>
                    <td className="px-3 py-3 text-sm text-right text-cyan-400 font-bold">{formatCurrency(totals.total_paye)}</td>
                    <td className="px-3 py-3 text-sm text-center text-amber-400">-</td>
                    <td className="px-3 py-3 text-sm text-right text-slate-300 font-bold">{formatCurrency(totals.total_ventes)}</td>
                    <td className="px-3 py-3 text-sm text-right text-slate-300 font-bold">{formatCurrency(totals.total_apres_commission)}</td>
                    <td className="px-3 py-3 text-sm text-center text-purple-400">-</td>
                    <td className="px-3 py-3 text-sm text-right text-emerald-400 font-bold">{formatCurrency(totals.balance_final)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Export Button */}
        <div className="flex justify-end">
          <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-700">
            <Download className="w-4 h-4 mr-2" />
            Exporter en Excel
          </Button>
        </div>
      </div>
    </CompanyLayout>
  );
};

export default CompanyRapportVentes;
