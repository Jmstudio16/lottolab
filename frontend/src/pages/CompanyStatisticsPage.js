import { API_URL } from '@/config/api';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  BarChart3, Users, Ban, TrendingUp, FileText, Clock, Shield, 
  RefreshCw, Calendar, ChevronRight, AlertTriangle, Trophy
} from 'lucide-react';
import CompanyLayout from '@/components/CompanyLayout';


export const CompanyStatisticsPage = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('agent-control');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('today');
  const [blockedNumbers, setBlockedNumbers] = useState([]);
  const [salesLimits, setSalesLimits] = useState([]);
  const [winningTickets, setWinningTickets] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchAgentControl = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/company/statistics/agent-control`, {
        headers,
        params: { period }
      });
      setData(res.data);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const fetchBlockedNumbers = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/company/blocked-numbers`, { headers });
      setBlockedNumbers(res.data);
    } catch (error) {
      toast.error('Erreur');
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesLimits = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/company/sales-limits`, { headers });
      setSalesLimits(res.data);
    } catch (error) {
      toast.error('Erreur');
    } finally {
      setLoading(false);
    }
  };

  const fetchWinningTickets = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/company/statistics/winning-tickets`, { headers });
      setWinningTickets(res.data);
    } catch (error) {
      toast.error('Erreur');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/company/statistics/tracability`, { headers });
      setAuditLogs(res.data);
    } catch (error) {
      toast.error('Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'agent-control') {
      fetchAgentControl();
    } else if (activeTab === 'blocked') {
      fetchBlockedNumbers();
    } else if (activeTab === 'limits') {
      fetchSalesLimits();
    } else if (activeTab === 'winning') {
      fetchWinningTickets();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, period]);

  const tabs = [
    { id: 'agent-control', label: 'Contrôle Agent', icon: Users },
    { id: 'blocked', label: 'Blocage Boule', icon: Ban },
    { id: 'limits', label: 'Limites', icon: Shield },
    { id: 'winning', label: 'Lots Gagnants', icon: Trophy },
    { id: 'audit', label: 'Traçabilité', icon: FileText },
  ];

  return (
    <CompanyLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl">
            <BarChart3 className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Statistiques</h1>
            <p className="text-slate-400">Analyse et contrôle</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-800 pb-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Agent Control */}
        {activeTab === 'agent-control' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="today">Aujourd'hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
              </select>
              <button
                onClick={fetchAgentControl}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
              </div>
            ) : data && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full" data-testid="agent-stats-table">
                  <thead>
                    <tr className="text-left text-slate-400 text-sm border-b border-slate-800">
                      <th className="px-6 py-4">Agent</th>
                      <th className="px-6 py-4">Username</th>
                      <th className="px-6 py-4">Statut</th>
                      <th className="px-6 py-4">Tickets</th>
                      <th className="px-6 py-4">Ventes</th>
                      <th className="px-6 py-4">POS Actifs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.agents?.map(agent => (
                      <tr key={agent.agent_id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="px-6 py-4 text-white font-medium">{agent.agent_name}</td>
                        <td className="px-6 py-4 text-slate-400 font-mono">{agent.username}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            agent.status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {agent.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-cyan-400 font-mono">{agent.total_tickets}</td>
                        <td className="px-6 py-4 text-amber-400 font-mono">
                          {agent.total_sales.toLocaleString()} HTG
                        </td>
                        <td className="px-6 py-4 text-slate-300">{agent.active_pos}</td>
                      </tr>
                    ))}
                    {(!data.agents || data.agents.length === 0) && (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                          Aucune donnée pour cette période
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Blocked Numbers */}
        {activeTab === 'blocked' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-slate-400">
                Numéros bloqués globalement ou par loterie
              </p>
              <button
                onClick={fetchBlockedNumbers}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full" data-testid="blocked-numbers-table">
                  <thead>
                    <tr className="text-left text-slate-400 text-sm border-b border-slate-800">
                      <th className="px-6 py-4">Numéro</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Limite Max</th>
                      <th className="px-6 py-4">Raison</th>
                      <th className="px-6 py-4">Expire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedNumbers.map(block => (
                      <tr key={block.block_id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-red-500/20 text-red-400 font-mono rounded">
                            {block.number}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300">{block.block_type}</td>
                        <td className="px-6 py-4 text-amber-400 font-mono">
                          {block.max_amount ? `${block.max_amount} HTG` : '-'}
                        </td>
                        <td className="px-6 py-4 text-slate-400">{block.reason || '-'}</td>
                        <td className="px-6 py-4 text-slate-400">{block.expires_at || 'Permanent'}</td>
                      </tr>
                    ))}
                    {blockedNumbers.length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                          Aucun numéro bloqué
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Sales Limits */}
        {activeTab === 'limits' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-slate-400">
                Limites de ventes configurées
              </p>
              <button
                onClick={fetchSalesLimits}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full" data-testid="sales-limits-table">
                  <thead>
                    <tr className="text-left text-slate-400 text-sm border-b border-slate-800">
                      <th className="px-6 py-4">Portée</th>
                      <th className="px-6 py-4">Numéro/Agent</th>
                      <th className="px-6 py-4">Montant Max</th>
                      <th className="px-6 py-4">Période</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesLimits.map(limit => (
                      <tr key={limit.limit_id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="px-6 py-4 text-white">
                          {limit.number ? 'Numéro' : limit.agent_id ? 'Agent' : 'Global'}
                        </td>
                        <td className="px-6 py-4 text-cyan-400 font-mono">
                          {limit.number || limit.agent_id || '-'}
                        </td>
                        <td className="px-6 py-4 text-amber-400 font-mono">
                          {limit.max_amount.toLocaleString()} HTG
                        </td>
                        <td className="px-6 py-4 text-slate-300">{limit.period}</td>
                      </tr>
                    ))}
                    {salesLimits.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-slate-400">
                          Aucune limite configurée
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Winning Tickets */}
        {activeTab === 'winning' && (
          <div className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
              </div>
            ) : winningTickets && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                    <div className="text-slate-400 text-sm mb-1">Total Gagnants</div>
                    <div className="text-3xl font-bold text-emerald-400">
                      {winningTickets.total_winners || 0}
                    </div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                    <div className="text-slate-400 text-sm mb-1">Total Payé</div>
                    <div className="text-3xl font-bold text-amber-400">
                      {(winningTickets.total_payout || 0).toLocaleString()} HTG
                    </div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                    <div className="text-slate-400 text-sm mb-1">Période</div>
                    <div className="text-lg text-white">
                      {winningTickets.date_from?.split('T')[0]} - {winningTickets.date_to?.split('T')[0]}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full" data-testid="winning-tickets-table">
                    <thead>
                      <tr className="text-left text-slate-400 text-sm border-b border-slate-800">
                        <th className="px-6 py-4">Code Ticket</th>
                        <th className="px-6 py-4">Loterie</th>
                        <th className="px-6 py-4">Agent</th>
                        <th className="px-6 py-4">Montant</th>
                        <th className="px-6 py-4">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {winningTickets.winners?.map(ticket => (
                        <tr key={ticket.ticket_id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="px-6 py-4 font-mono text-white">{ticket.ticket_code}</td>
                          <td className="px-6 py-4 text-slate-300">{ticket.lottery_name}</td>
                          <td className="px-6 py-4 text-slate-400">{ticket.agent_name}</td>
                          <td className="px-6 py-4 text-amber-400 font-mono">
                            {ticket.total_amount?.toLocaleString()} HTG
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              ticket.status === 'PAID'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {ticket.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(!winningTickets.winners || winningTickets.winners.length === 0) && (
                        <tr>
                          <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                            Aucun ticket gagnant
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Audit Logs */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-slate-400">
                Journal des actions (traçabilité complète)
              </p>
              <button
                onClick={fetchAuditLogs}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
              </div>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log, idx) => (
                  <div
                    key={log.log_id || idx}
                    className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded mr-2">
                          {log.action_type}
                        </span>
                        <span className="text-slate-400 text-sm">
                          {log.entity_type} • {log.entity_id?.slice(0, 20)}...
                        </span>
                      </div>
                      <div className="text-slate-500 text-sm flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(log.created_at).toLocaleString('fr-FR')}
                      </div>
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-2 text-slate-500 text-sm">
                        {JSON.stringify(log.metadata).slice(0, 100)}...
                      </div>
                    )}
                  </div>
                ))}
                {auditLogs.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    Aucun log disponible
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </CompanyLayout>
  );
};
