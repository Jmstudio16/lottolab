import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  BarChart3, RefreshCw, Calendar, Filter, Download,
  Users, Ticket, DollarSign, TrendingUp, Percent
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(amount || 0);
};

export const SupervisorReportsPage = () => {
  const { token, user } = useAuth();
  const [reportData, setReportData] = useState([]);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [supervisorCommission, setSupervisorCommission] = useState(10);

  const headers = { Authorization: `Bearer ${token}` };

  // Set default dates (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
    setDateTo(today.toISOString().split('T')[0]);
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      
      // Get report from dedicated endpoint
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      
      const res = await axios.get(
        `${API_URL}/api/supervisor/sales-report?${params.toString()}`,
        { headers }
      );
      
      const data = res.data;
      setSupervisorCommission(data.supervisor_commission || 10);
      setReportData(data.agents || []);
      setTotals(data.totals || {});
      
    } catch (error) {
      console.error('Report error:', error);
      toast.error('Erreur lors du chargement du rapport');
      
      // Fallback: calculate locally if endpoint fails
      await fetchReportFallback();
    } finally {
      setLoading(false);
    }
  };

  const fetchReportFallback = async () => {
    try {
      // Get supervisor profile for commission
      try {
        const profileRes = await axios.get(`${API_URL}/api/supervisor/my-profile`, { headers });
        setSupervisorCommission(profileRes.data.commission_percent || 10);
      } catch (e) {
        // Use default
      }
      
      // Get agents
      const agentsRes = await axios.get(`${API_URL}/api/supervisor/agents`, { headers });
      const agents = agentsRes.data || [];
      
      // For each agent, get their tickets and calculate stats
      let agentsData = [];
      for (const agent of agents) {
        try {
          const ticketsRes = await axios.get(
            `${API_URL}/api/supervisor/agents/${agent.user_id}/tickets`,
            { headers }
          );
          const tickets = ticketsRes.data || [];
          
          // Filter by date if provided
          const filteredTickets = tickets.filter(t => {
            if (!dateFrom && !dateTo) return true;
            const ticketDate = t.created_at?.split('T')[0];
            if (dateFrom && ticketDate < dateFrom) return false;
            if (dateTo && ticketDate > dateTo) return false;
            return true;
          });
          
          const totalVentes = filteredTickets.reduce((sum, t) => sum + (t.total_amount || 0), 0);
          const totalPaye = filteredTickets.filter(t => t.status === 'WINNER')
            .reduce((sum, t) => sum + (t.winnings || t.payout_amount || 0), 0);
          const agentComm = agent.commission_percent || 10;
          const commAgent = (totalVentes * agentComm) / 100;
          const commSup = (totalVentes * supervisorCommission) / 100;
          
          agentsData.push({
            agent_id: agent.user_id,
            agent_name: agent.name || agent.full_name || 'Agent',
            total_tickets: filteredTickets.length,
            tickets_gagnants: filteredTickets.filter(t => t.status === 'WINNER').length,
            total_ventes: totalVentes,
            total_paye: totalPaye,
            pourcentage_agent: agentComm,
            comm_agent: commAgent,
            pp_sans_agent: totalVentes - totalPaye,
            pp_avec_agent: totalVentes - totalPaye - commAgent,
            pourcentage_sup: supervisorCommission,
            comm_sup: commSup,
            balance_final: totalVentes - totalPaye - commAgent - commSup
          });
        } catch (e) {
          // Skip agents without tickets access
        }
      }
      
      setReportData(agentsData);
      
      // Calculate totals
      const calcTotals = {
        total_tickets: agentsData.reduce((sum, a) => sum + a.total_tickets, 0),
        total_gagnants: agentsData.reduce((sum, a) => sum + a.tickets_gagnants, 0),
        total_ventes: agentsData.reduce((sum, a) => sum + a.total_ventes, 0),
        total_paye: agentsData.reduce((sum, a) => sum + a.total_paye, 0),
        total_comm_agent: agentsData.reduce((sum, a) => sum + a.comm_agent, 0),
        total_comm_sup: agentsData.reduce((sum, a) => sum + a.comm_sup, 0),
        balance_final: agentsData.reduce((sum, a) => sum + a.balance_final, 0)
      };
      
      setTotals(calcTotals);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    }
  };

  useEffect(() => {
    if (dateFrom && dateTo && token) {
      fetchReport();
    }
  }, [token, dateFrom, dateTo]);

  const handleFilter = () => {
    fetchReport();
  };

  return (
    <div className="space-y-6" data-testid="supervisor-reports-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-emerald-400" />
            Rapport de Ventes
          </h1>
          <p className="text-slate-400">Rapport détaillé avec commissions</p>
        </div>
        <Button onClick={fetchReport} className="bg-emerald-600 hover:bg-emerald-700">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
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
          <Button onClick={handleFilter} className="bg-blue-600 hover:bg-blue-700">
            <Filter className="w-4 h-4 mr-2" />
            Filtrer
          </Button>
        </div>
      </div>

      {/* My Commission Card */}
      <div className="bg-gradient-to-r from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="p-3 bg-purple-500/20 rounded-xl">
            <Percent className="w-8 h-8 text-purple-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-purple-300">Votre Commission Superviseur</p>
            <p className="text-3xl font-bold text-purple-400">{supervisorCommission}%</p>
            <p className="text-xs text-purple-300/70">
              Sur les ventes de vos {reportData.length} agents
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-purple-300">Vos Gains</p>
            <p className="text-2xl font-bold text-purple-400">
              HTG {formatCurrency(totals.total_comm_sup || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-sm">Agents</span>
          </div>
          <p className="text-2xl font-bold text-white">{reportData.length}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Ticket className="w-4 h-4" />
            <span className="text-sm">Tickets</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{totals.total_tickets || 0}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Total Ventes</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">HTG {formatCurrency(totals.total_ventes)}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">Gagnants</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{totals.total_gagnants || 0}</p>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-slate-900/80">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-bold text-slate-300 uppercase">No</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-slate-300 uppercase">Agent</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-slate-300 uppercase">Tfiche</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-slate-300 uppercase">Gagnants</th>
                <th className="px-3 py-3 text-right text-xs font-bold text-emerald-400 uppercase">Vente</th>
                <th className="px-3 py-3 text-right text-xs font-bold text-cyan-400 uppercase">A Payé</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-amber-400 uppercase">%Agent</th>
                <th className="px-3 py-3 text-right text-xs font-bold text-amber-300 uppercase">Comm. Agent</th>
                <th className="px-3 py-3 text-right text-xs font-bold text-slate-300 uppercase">P/P sans %</th>
                <th className="px-3 py-3 text-right text-xs font-bold text-slate-300 uppercase">P/P avec %</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-purple-400 uppercase">%Sup</th>
                <th className="px-3 py-3 text-right text-xs font-bold text-purple-400 uppercase">Comm. Sup</th>
                <th className="px-3 py-3 text-right text-xs font-bold text-green-400 uppercase">B.Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="13" className="px-4 py-12 text-center">
                    <RefreshCw className="w-8 h-8 mx-auto text-emerald-400 animate-spin" />
                  </td>
                </tr>
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan="13" className="px-4 py-12 text-center text-slate-400">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Aucune donnée pour cette période</p>
                  </td>
                </tr>
              ) : (
                reportData.map((agent, index) => (
                  <tr key={agent.agent_id} className="hover:bg-slate-700/30">
                    <td className="px-3 py-3 text-sm text-slate-400">{index + 1}</td>
                    <td className="px-3 py-3 text-sm text-white font-medium">{agent.agent_name}</td>
                    <td className="px-3 py-3 text-sm text-center text-blue-400">{agent.total_tickets}</td>
                    <td className="px-3 py-3 text-sm text-center text-amber-400 font-bold">{agent.tickets_gagnants}</td>
                    <td className="px-3 py-3 text-sm text-right text-emerald-400 font-medium">{formatCurrency(agent.total_ventes)}</td>
                    <td className="px-3 py-3 text-sm text-right text-cyan-400">{formatCurrency(agent.total_paye)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-bold">
                        {agent.pourcentage_agent}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-amber-300">{formatCurrency(agent.comm_agent)}</td>
                    <td className="px-3 py-3 text-sm text-right text-slate-300">{formatCurrency(agent.pp_sans_agent)}</td>
                    <td className="px-3 py-3 text-sm text-right text-slate-300">{formatCurrency(agent.pp_avec_agent)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-bold">
                        {agent.pourcentage_sup || supervisorCommission}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-purple-400 font-medium">{formatCurrency(agent.comm_sup)}</td>
                    <td className="px-3 py-3 text-sm text-right text-green-400 font-bold">{formatCurrency(agent.balance_final)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {reportData.length > 0 && (
              <tfoot className="bg-slate-900/80 border-t-2 border-emerald-500/50">
                <tr>
                  <td colSpan="2" className="px-3 py-3 text-sm font-bold text-white uppercase">TOTAL</td>
                  <td className="px-3 py-3 text-sm text-center text-blue-400 font-bold">{totals.total_tickets}</td>
                  <td className="px-3 py-3 text-sm text-center text-amber-400 font-bold">{totals.total_gagnants}</td>
                  <td className="px-3 py-3 text-sm text-right text-emerald-400 font-bold">{formatCurrency(totals.total_ventes)}</td>
                  <td className="px-3 py-3 text-sm text-right text-cyan-400 font-bold">{formatCurrency(totals.total_paye)}</td>
                  <td className="px-3 py-3 text-center">-</td>
                  <td className="px-3 py-3 text-sm text-right text-amber-300 font-bold">{formatCurrency(totals.total_comm_agent)}</td>
                  <td className="px-3 py-3 text-center">-</td>
                  <td className="px-3 py-3 text-center">-</td>
                  <td className="px-3 py-3 text-center">-</td>
                  <td className="px-3 py-3 text-sm text-right text-purple-400 font-bold">{formatCurrency(totals.total_comm_sup)}</td>
                  <td className="px-3 py-3 text-sm text-right text-green-400 font-bold">{formatCurrency(totals.balance_final)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <Button variant="outline" className="border-slate-700 text-slate-300">
          <Download className="w-4 h-4 mr-2" />
          Exporter en Excel
        </Button>
      </div>
    </div>
  );
};

export default SupervisorReportsPage;
