import { API_URL } from '@/config/api';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Ticket, RefreshCw, Search, Eye, Filter, Calendar,
  DollarSign, CheckCircle, XCircle, Clock, Printer, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';


const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

export const SupervisorTicketsPage = () => {
  const { token } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      setLoading(true);
      // Get agents first
      const agentsRes = await axios.get(`${API_URL}/api/supervisor/agents`, { headers });
      const agentsList = agentsRes.data || [];
      setAgents(agentsList);
      
      // Fetch tickets for all agents in parallel
      const ticketPromises = agentsList.map(async (agent) => {
        try {
          const ticketsRes = await axios.get(
            `${API_URL}/api/supervisor/agents/${agent.user_id}/tickets`,
            { headers }
          );
          return (ticketsRes.data || []).map(t => ({
            ...t,
            agent_name: agent.name || agent.full_name || 'Agent',
            agent_commission: agent.commission_percent || 10
          }));
        } catch (e) {
          return [];
        }
      });
      
      const ticketArrays = await Promise.all(ticketPromises);
      let allTickets = ticketArrays.flat();
      
      // Sort by date descending
      allTickets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setTickets(allTickets);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const getStatusBadge = (status) => {
    const styles = {
      'WINNER': 'bg-emerald-500/20 text-emerald-400',
      'LOSER': 'bg-slate-500/20 text-slate-400',
      'PENDING_RESULT': 'bg-yellow-500/20 text-yellow-400',
      'ACTIVE': 'bg-blue-500/20 text-blue-400',
      'VOID': 'bg-red-500/20 text-red-400',
      'PAID': 'bg-purple-500/20 text-purple-400'
    };
    const labels = {
      'WINNER': 'Gagnant',
      'LOSER': 'Perdant',
      'PENDING_RESULT': 'En attente',
      'ACTIVE': 'Actif',
      'VOID': 'Annulé',
      'PAID': 'Payé'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-bold ${styles[status] || styles['ACTIVE']}`}>
        {labels[status] || status}
      </span>
    );
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      t.ticket_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.agent_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesAgent = agentFilter === 'all' || t.agent_id === agentFilter;
    return matchesSearch && matchesStatus && matchesAgent;
  });

  const stats = {
    total: tickets.length,
    totalAmount: tickets.reduce((sum, t) => sum + (t.total_amount || 0), 0),
    winners: tickets.filter(t => t.status === 'WINNER').length,
    pending: tickets.filter(t => t.status === 'PENDING_RESULT' || t.status === 'ACTIVE').length
  };

  const handlePrint = async (ticket) => {
    try {
      const printUrl = `${API_URL}/api/ticket/print/${ticket.ticket_id}?token=${token}`;
      window.open(printUrl, '_blank');
    } catch (error) {
      toast.error('Erreur lors de l\'impression');
    }
  };

  const exportToExcel = () => {
    window.open(`${API_URL}/api/export/supervisor/tickets?token=${token}`, '_blank');
    toast.success('Téléchargement du fichier Excel en cours...');
  };

  return (
    <div className="space-y-6" data-testid="supervisor-tickets-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Ticket className="w-7 h-7 text-purple-400" />
            Tickets
          </h1>
          <p className="text-slate-400">Tous les tickets de vos agents</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToExcel} variant="outline" className="border-emerald-700 text-emerald-400 hover:bg-emerald-500/10" data-testid="export-excel-btn">
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button onClick={fetchData} variant="outline" className="border-slate-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total Tickets</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total Ventes</p>
          <p className="text-2xl font-bold text-emerald-400">HTG {formatCurrency(stats.totalAmount)}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Gagnants</p>
          <p className="text-2xl font-bold text-amber-400">{stats.winners}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">En Attente</p>
          <p className="text-2xl font-bold text-blue-400">{stats.pending}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Rechercher par code ou agent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white"
          />
        </div>
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white min-w-[150px]"
        >
          <option value="all">Tous les agents</option>
          {agents.map(agent => (
            <option key={agent.user_id} value={agent.user_id}>
              {agent.name || agent.full_name || 'Agent'}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white min-w-[150px]"
        >
          <option value="all">Tous les statuts</option>
          <option value="WINNER">Gagnants</option>
          <option value="LOSER">Perdants</option>
          <option value="PENDING_RESULT">En attente</option>
          <option value="ACTIVE">Actifs</option>
          <option value="VOID">Annulés</option>
        </select>
      </div>

      {/* Tickets Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Agent</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-amber-400 uppercase">% Agent</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Loterie</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase">Montant</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center">
                    <RefreshCw className="w-8 h-8 mx-auto text-purple-400 animate-spin" />
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-slate-400">
                    <Ticket className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Aucun ticket trouvé</p>
                  </td>
                </tr>
              ) : (
                filteredTickets.slice(0, 100).map((ticket) => (
                  <tr key={ticket.ticket_id || ticket.transaction_id} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-mono text-sm text-white">{ticket.ticket_code}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{ticket.agent_name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-bold">
                        {ticket.agent_commission || 10}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{ticket.lottery_name || '-'}</td>
                    <td className="px-4 py-3 text-right text-sm text-emerald-400 font-medium">
                      HTG {formatCurrency(ticket.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(ticket.status)}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{formatDate(ticket.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedTicket(ticket)}
                          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePrint(ticket)}
                          className="p-2 text-emerald-400 hover:bg-emerald-500/20 rounded-lg"
                          title="Imprimer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredTickets.length > 100 && (
          <div className="p-4 text-center text-slate-400 text-sm border-t border-slate-700">
            Affichage limité aux 100 premiers tickets. Utilisez les filtres pour affiner votre recherche.
          </div>
        )}
      </div>

      {/* Ticket Detail Modal */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Ticket className="w-5 h-5 text-purple-400" />
              Détails du Ticket
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-800 rounded-lg">
                <p className="text-xs text-slate-400">Code du Ticket</p>
                <p className="font-mono text-lg text-white">{selectedTicket.ticket_code}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 p-3 rounded-lg">
                  <p className="text-xs text-slate-400">Agent</p>
                  <p className="text-white font-medium">{selectedTicket.agent_name}</p>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg">
                  <p className="text-xs text-slate-400">Commission Agent</p>
                  <p className="text-amber-400 font-bold">{selectedTicket.agent_commission || 10}%</p>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg">
                  <p className="text-xs text-slate-400">Loterie</p>
                  <p className="text-white">{selectedTicket.lottery_name || '-'}</p>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg">
                  <p className="text-xs text-slate-400">Montant</p>
                  <p className="text-emerald-400 font-bold">HTG {formatCurrency(selectedTicket.total_amount)}</p>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg">
                  <p className="text-xs text-slate-400">Statut</p>
                  <div className="mt-1">{getStatusBadge(selectedTicket.status)}</div>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg">
                  <p className="text-xs text-slate-400">Date</p>
                  <p className="text-white text-sm">{formatDate(selectedTicket.created_at)}</p>
                </div>
              </div>

              {selectedTicket.status === 'WINNER' && selectedTicket.winnings > 0 && (
                <div className="p-4 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
                  <p className="text-xs text-emerald-300">Gains</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    HTG {formatCurrency(selectedTicket.winnings || selectedTicket.payout_amount)}
                  </p>
                </div>
              )}

              {selectedTicket.selections && selectedTicket.selections.length > 0 && (
                <div>
                  <p className="text-sm text-slate-400 mb-2">Numéros joués</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTicket.selections.map((sel, idx) => (
                      <div key={idx} className="bg-slate-800 px-3 py-2 rounded-lg text-sm">
                        <span className="text-slate-400">{sel.bet_type}: </span>
                        <span className="text-white font-mono">{sel.numbers?.join(', ')}</span>
                        <span className="text-emerald-400 ml-2">{sel.amount} HTG</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={() => handlePrint(selectedTicket)} 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimer
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedTicket(null)}
                  className="flex-1 border-slate-700"
                >
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupervisorTicketsPage;
