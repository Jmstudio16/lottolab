import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  FileText, Calendar, RefreshCw, Download, TrendingUp, Users, 
  DollarSign, BarChart3, Clock, Plus
} from 'lucide-react';
import CompanyLayout from '@/components/CompanyLayout';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const CompanyDailyReportsPage = () => {
  const { token } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [generateDate, setGenerateDate] = useState(new Date().toISOString().split('T')[0]);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/company/daily-reports`, { headers });
      setReports(res.data);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const generateReport = async () => {
    try {
      setGenerating(true);
      const res = await axios.post(`${API_URL}/api/company/daily-reports/generate`, null, {
        headers,
        params: { report_date: generateDate }
      });
      toast.success('Rapport généré');
      setSelectedReport(res.data);
      fetchReports();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <CompanyLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl">
              <FileText className="w-8 h-8 text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Rapports Journaliers</h1>
              <p className="text-slate-400">{reports.length} rapports disponibles</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={generateDate}
              onChange={(e) => setGenerateDate(e.target.value)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
              data-testid="generate-date"
            />
            <button
              onClick={generateReport}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50 text-white rounded-lg transition-colors"
              data-testid="generate-report-btn"
            >
              {generating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Générer Rapport
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Reports List */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-white font-medium">Rapports Récents</span>
                <button
                  onClick={fetchReports}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
                </div>
              ) : (
                <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto">
                  {reports.map(report => (
                    <button
                      key={report.report_id}
                      onClick={() => setSelectedReport(report)}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-800/50 transition-colors ${
                        selectedReport?.report_id === report.report_id ? 'bg-slate-800/50 border-l-2 border-orange-500' : ''
                      }`}
                      data-testid={`report-${report.report_date}`}
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-orange-400" />
                        <div>
                          <div className="text-white font-medium">{report.report_date}</div>
                          <div className="text-slate-400 text-sm">
                            {report.total_tickets} tickets • {report.total_sales?.toLocaleString()} HTG
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                  {reports.length === 0 && (
                    <div className="px-4 py-12 text-center text-slate-400">
                      Aucun rapport. Générez votre premier rapport.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Report Detail */}
          <div className="lg:col-span-2">
            {selectedReport ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                      <FileText className="w-4 h-4" />
                      Tickets
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {selectedReport.total_tickets?.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                      <DollarSign className="w-4 h-4" />
                      Ventes
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {selectedReport.total_sales?.toLocaleString()} HTG
                    </div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                      <TrendingUp className="w-4 h-4" />
                      Gagnants
                    </div>
                    <div className="text-2xl font-bold text-amber-400">
                      {selectedReport.winning_tickets_count || 0}
                    </div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                      <BarChart3 className="w-4 h-4" />
                      Annulés
                    </div>
                    <div className="text-2xl font-bold text-red-400">
                      {selectedReport.voided_tickets_count || 0}
                    </div>
                  </div>
                </div>

                {/* Sales by Lottery */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-orange-400" />
                    Ventes par Loterie
                  </h3>
                  {selectedReport.sales_by_lottery?.length > 0 ? (
                    <div className="space-y-3">
                      {selectedReport.sales_by_lottery.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 text-sm font-bold">
                              {idx + 1}
                            </div>
                            <span className="text-white">{item.lottery_name || item._id}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-amber-400 font-mono">
                              {item.sales?.toLocaleString()} HTG
                            </div>
                            <div className="text-slate-500 text-sm">
                              {item.tickets} tickets
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-center py-6">
                      Aucune vente
                    </div>
                  )}
                </div>

                {/* Sales by Agent */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-orange-400" />
                    Ventes par Agent
                  </h3>
                  {selectedReport.sales_by_agent?.length > 0 ? (
                    <div className="space-y-3">
                      {selectedReport.sales_by_agent.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-sm font-bold">
                              {idx + 1}
                            </div>
                            <span className="text-white">{item.agent_name || item._id}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-amber-400 font-mono">
                              {item.sales?.toLocaleString()} HTG
                            </div>
                            <div className="text-slate-500 text-sm">
                              {item.tickets} tickets
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-center py-6">
                      Aucune vente
                    </div>
                  )}
                </div>

                {/* Report Metadata */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Clock className="w-4 h-4" />
                    Généré le {new Date(selectedReport.generated_at).toLocaleString('fr-FR')}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 flex flex-col items-center justify-center">
                <FileText className="w-16 h-16 text-slate-700 mb-4" />
                <p className="text-slate-400 text-center">
                  Sélectionnez un rapport pour voir les détails<br />
                  ou générez un nouveau rapport
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </CompanyLayout>
  );
};
