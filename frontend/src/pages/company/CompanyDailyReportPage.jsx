import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import { API_URL } from '@/config/api';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  BarChart3, Calendar, RefreshCw, Download, FileText, Printer,
  Users, DollarSign, TrendingUp, TrendingDown, Filter, Search, FileDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminLayout } from '@/components/AdminLayout';

const CompanyDailyReportPage = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/reports/daily-summary?start_date=${startDate}&end_date=${endDate}`,
        { headers }
      );
      setReport(res.data);
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('Erreur lors du chargement du rapport');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const filteredAgents = report?.agents?.filter(agent =>
    agent.agent_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const exportToCSV = () => {
    if (!filteredAgents.length) return;
    
    const headers = ['No', 'Agent', 'Tfiche', 'Vente', 'A payé', '%Agent', 'P/P sans %agent', 'P/P avec %agent', '%Sup', 'B.Final'];
    const rows = filteredAgents.map(a => [
      a.no, a.agent_name, a.tfiche, a.vente, a.a_paye, a.pct_agent, a.pp_sans_agent, a.pp_avec_agent, a.pct_sup, a.b_final
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rapport_journalier_${startDate}_${endDate}.csv`;
    link.click();
  };

  const exportToPDF = () => {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    
    fetch(`${API_URL}/api/export/reports/daily/pdf?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport_journalier_${startDate}_${endDate}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast.success('PDF téléchargé avec succès!');
      })
      .catch(() => toast.error('Erreur lors du téléchargement du PDF'));
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  return (
    <AdminLayout 
      title="Rapport Journalier" 
      subtitle="Rapport détaillé des ventes et profits par agent"
    >
      <div className="space-y-6" data-testid="daily-report-page">
        {/* Date Filters */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <span className="text-white font-medium">Période:</span>
                </div>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40 bg-slate-900 border-slate-700 text-white"
                />
                <span className="text-slate-400">à</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40 bg-slate-900 border-slate-700 text-white"
                />
                <Button 
                  onClick={fetchReport}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4 mr-1" />}
                  Filtrer
                </Button>
              </div>
              
              {/* Export Buttons */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="border-red-700 text-red-400 hover:bg-red-500/10" onClick={exportToPDF} data-testid="export-pdf-btn">
                  <FileDown className="w-4 h-4 mr-1" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" className="border-slate-700" onClick={exportToCSV}>
                  <FileText className="w-4 h-4 mr-1" />
                  CSV
                </Button>
                <Button variant="outline" size="sm" className="border-slate-700" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-1" />
                  Imprimer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {report && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-blue-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-300 text-xs">Total POS</p>
                    <p className="text-2xl font-bold text-white">{report.total_pos}</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-400 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-emerald-300 text-xs">Total Vente</p>
                    <p className="text-2xl font-bold text-white">{formatCurrency(report.totals?.total_vente)} HTG</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-emerald-400 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-300 text-xs">Total Payé (Gains)</p>
                    <p className="text-2xl font-bold text-white">{formatCurrency(report.totals?.total_paye)} HTG</p>
                  </div>
                  <TrendingDown className="w-8 h-8 text-amber-400 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card className={`bg-gradient-to-br ${report.totals?.total_balance >= 0 ? 'from-green-500/20 to-green-500/5 border-green-500/30' : 'from-red-500/20 to-red-500/5 border-red-500/30'}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-xs ${report.totals?.total_balance >= 0 ? 'text-green-300' : 'text-red-300'}`}>Balance Finale</p>
                    <p className={`text-2xl font-bold ${report.totals?.total_balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(report.totals?.total_balance)} HTG
                    </p>
                  </div>
                  {report.totals?.total_balance >= 0 ? (
                    <TrendingUp className="w-8 h-8 text-green-400 opacity-80" />
                  ) : (
                    <TrendingDown className="w-8 h-8 text-red-400 opacity-80" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Agents Table */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Agents
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Rechercher agent..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-slate-900 border-slate-700 text-white"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
                <p className="text-slate-400 mt-2">Chargement...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-900/50">
                      <th className="text-left p-3 text-slate-400 font-medium">No</th>
                      <th className="text-left p-3 text-slate-400 font-medium">Agent</th>
                      <th className="text-right p-3 text-slate-400 font-medium">Tfiche</th>
                      <th className="text-right p-3 text-slate-400 font-medium">Vente</th>
                      <th className="text-right p-3 text-slate-400 font-medium">A payé</th>
                      <th className="text-right p-3 text-slate-400 font-medium">%Agent</th>
                      <th className="text-right p-3 text-slate-400 font-medium">P/P sans %agent</th>
                      <th className="text-right p-3 text-slate-400 font-medium">P/P avec %agent</th>
                      <th className="text-right p-3 text-slate-400 font-medium">%Sup</th>
                      <th className="text-right p-3 text-slate-400 font-medium">B.Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgents.map((agent) => (
                      <tr 
                        key={agent.agent_id}
                        className={`border-b border-slate-700/50 hover:bg-slate-700/30 ${agent.is_negative ? 'bg-red-500/10' : ''}`}
                      >
                        <td className="p-3 text-slate-300">{agent.no}</td>
                        <td className="p-3 text-white font-medium">{agent.agent_name}</td>
                        <td className="p-3 text-right text-slate-300">{agent.tfiche}</td>
                        <td className="p-3 text-right text-emerald-400">{formatCurrency(agent.vente)}</td>
                        <td className="p-3 text-right text-amber-400">{formatCurrency(agent.a_paye)}</td>
                        <td className="p-3 text-right text-slate-400">{agent.pct_agent.toFixed(2)}</td>
                        <td className={`p-3 text-right ${agent.pp_sans_agent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(agent.pp_sans_agent)}
                        </td>
                        <td className={`p-3 text-right ${agent.pp_avec_agent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(agent.pp_avec_agent)}
                        </td>
                        <td className="p-3 text-right text-slate-400">{agent.pct_sup.toFixed(2)}</td>
                        <td className={`p-3 text-right font-bold ${agent.b_final >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(agent.b_final)}
                        </td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    {report && (
                      <tr className="bg-slate-900/80 font-bold border-t-2 border-slate-600">
                        <td className="p-3 text-white" colSpan={2}>TOTAL</td>
                        <td className="p-3 text-right text-white">{report.totals?.total_tickets}</td>
                        <td className="p-3 text-right text-emerald-400">{formatCurrency(report.totals?.total_vente)}</td>
                        <td className="p-3 text-right text-amber-400">{formatCurrency(report.totals?.total_paye)}</td>
                        <td className="p-3 text-right text-slate-400">-</td>
                        <td className={`p-3 text-right ${report.totals?.total_profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(report.totals?.total_profit_loss)}
                        </td>
                        <td className="p-3 text-right text-slate-400">-</td>
                        <td className="p-3 text-right text-slate-400">-</td>
                        <td className={`p-3 text-right ${report.totals?.total_balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(report.totals?.total_balance)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            
            {!loading && filteredAgents.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                Aucun agent trouvé pour cette période
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default CompanyDailyReportPage;
