import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import { 
  BarChart3, 
  Calendar,
  RefreshCw,
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
  Ticket,
  DollarSign,
  Trophy,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AgentReportsPage = () => {
  const { syncData } = useOutletContext();
  const { token } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/agent/reports?start_date=${startDate}&end_date=${endDate}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setReport(data);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('Erreur lors du chargement du rapport');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchReport();
    }
  }, [token]);

  const handlePrint = () => {
    window.print();
  };

  const currency = syncData?.company?.currency || 'HTG';

  return (
    <div className="space-y-6" data-testid="reports-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Mes Rapports</h1>
        <div className="flex items-center gap-3">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="border-slate-600 text-white hover:bg-slate-700"
          >
            <Printer size={16} className="mr-2" />
            Imprimer
          </Button>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-end gap-4">
            <div className="flex-1">
              <label className="text-sm text-slate-400 mb-1 block">Date de début</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="text-sm text-slate-400 mb-1 block">Date de fin</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>
            <Button
              onClick={fetchReport}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
              Générer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {report && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 print:grid-cols-5">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Tickets</p>
                  <p className="text-2xl font-bold text-white">
                    {report.totals?.tickets_count || 0}
                  </p>
                </div>
                <div className="p-2 bg-blue-900/30 rounded-full">
                  <Ticket size={20} className="text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Ventes</p>
                  <p className="text-xl font-bold text-emerald-400">
                    {(report.totals?.total_sales || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">{currency}</p>
                </div>
                <div className="p-2 bg-emerald-900/30 rounded-full">
                  <DollarSign size={20} className="text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Gains</p>
                  <p className="text-xl font-bold text-amber-400">
                    {(report.totals?.total_wins || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">{currency}</p>
                </div>
                <div className="p-2 bg-amber-900/30 rounded-full">
                  <Trophy size={20} className="text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Annulés</p>
                  <p className="text-2xl font-bold text-red-400">
                    {report.totals?.voided_count || 0}
                  </p>
                </div>
                <div className="p-2 bg-red-900/30 rounded-full">
                  <AlertCircle size={20} className="text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-slate-700 ${(report.totals?.net_revenue || 0) >= 0 ? 'bg-emerald-900/30' : 'bg-red-900/30'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Net</p>
                  <p className={`text-xl font-bold ${(report.totals?.net_revenue || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(report.totals?.net_revenue || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">{currency}</p>
                </div>
                <div className={`p-2 rounded-full ${(report.totals?.net_revenue || 0) >= 0 ? 'bg-emerald-900/50' : 'bg-red-900/50'}`}>
                  {(report.totals?.net_revenue || 0) >= 0 ? (
                    <TrendingUp size={20} className="text-emerald-400" />
                  ) : (
                    <TrendingDown size={20} className="text-red-400" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Report */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 size={20} className="text-emerald-400" />
            Détails par Loterie
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw size={32} className="animate-spin text-emerald-400" />
            </div>
          ) : !report || !report.details || report.details.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle size={48} className="mx-auto text-slate-500 mb-4" />
              <p className="text-slate-400">Aucune donnée pour cette période</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Date</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Loterie</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Tickets</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Ventes</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Gagnants</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Gains</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Annulés</th>
                  </tr>
                </thead>
                <tbody>
                  {report.details.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-3 px-4 text-white">{row._id?.date}</td>
                      <td className="py-3 px-4 text-white">{row._id?.lottery_name}</td>
                      <td className="py-3 px-4 text-right text-white">{row.tickets_count}</td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-medium">
                        {row.total_sales?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-amber-400">{row.winners_count}</td>
                      <td className="py-3 px-4 text-right text-amber-400 font-medium">
                        {row.total_wins?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-red-400">{row.voided_count}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-700/50 font-bold">
                    <td className="py-3 px-4 text-white" colSpan="2">TOTAL</td>
                    <td className="py-3 px-4 text-right text-white">{report.totals?.tickets_count}</td>
                    <td className="py-3 px-4 text-right text-emerald-400">
                      {report.totals?.total_sales?.toLocaleString()} {currency}
                    </td>
                    <td className="py-3 px-4 text-right text-amber-400">{report.totals?.winners_count}</td>
                    <td className="py-3 px-4 text-right text-amber-400">
                      {report.totals?.total_wins?.toLocaleString()} {currency}
                    </td>
                    <td className="py-3 px-4 text-right text-red-400">{report.totals?.voided_count}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print Summary */}
      {report && (
        <Card className="bg-slate-800 border-slate-700 print:break-before-page">
          <CardHeader>
            <CardTitle className="text-white">Résumé du Rapport</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-400">Période</p>
                <p className="text-white font-medium">
                  {new Date(report.period?.start).toLocaleDateString('fr-FR')} - {new Date(report.period?.end).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Agent</p>
                <p className="text-white font-medium">{syncData?.agent?.name}</p>
              </div>
              <div>
                <p className="text-slate-400">Entreprise</p>
                <p className="text-white font-medium">{syncData?.company?.name}</p>
              </div>
              <div>
                <p className="text-slate-400">Généré le</p>
                <p className="text-white font-medium">{new Date().toLocaleString('fr-FR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .bg-slate-800, .bg-slate-700, .bg-slate-900 {
            background: white !important;
            border: 1px solid #ccc !important;
          }
          .text-white, .text-emerald-400, .text-amber-400, .text-slate-300, .text-slate-400 {
            color: black !important;
          }
          button, nav, header {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AgentReportsPage;
