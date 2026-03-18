import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Trophy, RefreshCw, Search, DollarSign, CheckCircle, Clock, Eye, Printer, Building2, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const CompanyLotsGagnants = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState({ total_count: 0, total_win_amount: 0, paid_count: 0, pending_count: 0, by_branch: {} });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchWinningTickets = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/company/winning-tickets`, { headers });
      setTickets(res.data.tickets || []);
      setSummary(res.data.summary || { total_count: 0, total_win_amount: 0 });
    } catch (error) {
      toast.error('Erreur lors du chargement des lots gagnants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWinningTickets();
  }, [token]);

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      t.ticket_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.agent_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'paid' && t.status === 'PAID') ||
      (filterStatus === 'pending' && t.status !== 'PAID');
    return matchesSearch && matchesStatus;
  });

  const printTicket = (ticketId) => {
    window.open(`${API_URL}/api/ticket/print/${ticketId}?token=${token}&format=thermal`, '_blank');
  };

  const exportToExcel = () => {
    window.open(`${API_URL}/api/export/company/winning-tickets?token=${token}`, '_blank');
    toast.success('Téléchargement du fichier Excel en cours...');
  };

  return (
    <div className="p-6 space-y-6" data-testid="company-lots-gagnants">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
            <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400" />
            Lots Gagnants
          </h1>
          <p className="text-sm text-slate-400">Tous les tickets gagnants de votre entreprise</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToExcel} variant="outline" className="border-emerald-700 text-emerald-400 hover:bg-emerald-500/10" data-testid="export-excel-btn">
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button onClick={fetchWinningTickets} variant="outline" className="border-slate-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <p className="text-sm text-amber-400">Total Gagnants</p>
          <p className="text-2xl font-bold text-amber-400">{summary.total_count}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
          <p className="text-sm text-emerald-400">Montant Total</p>
          <p className="text-2xl font-bold text-emerald-400">{summary.total_win_amount?.toLocaleString()} HTG</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-sm text-blue-400">Payés</p>
          <p className="text-2xl font-bold text-blue-400">{summary.paid_count}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
          <p className="text-sm text-purple-400">En Attente</p>
          <p className="text-2xl font-bold text-purple-400">{summary.pending_count}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Rechercher par code, loterie, agent..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setFilterStatus('all')}
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            className={filterStatus === 'all' ? 'bg-amber-600' : 'border-slate-700'}
          >
            Tous
          </Button>
          <Button
            onClick={() => setFilterStatus('paid')}
            variant={filterStatus === 'paid' ? 'default' : 'outline'}
            className={filterStatus === 'paid' ? 'bg-emerald-600' : 'border-slate-700'}
          >
            Payés
          </Button>
          <Button
            onClick={() => setFilterStatus('pending')}
            variant={filterStatus === 'pending' ? 'default' : 'outline'}
            className={filterStatus === 'pending' ? 'bg-purple-600' : 'border-slate-700'}
          >
            En Attente
          </Button>
        </div>
      </div>

      {/* Tickets Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
          <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Aucun lot gagnant trouvé</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">Ticket</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">Loterie</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">Succursale</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">Agent</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-emerald-400">Gains</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredTickets.map(ticket => (
                  <tr key={ticket.ticket_id} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <p className="font-mono font-bold text-amber-400">{ticket.ticket_code}</p>
                      <p className="text-xs text-slate-500">{ticket.draw_date}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white">{ticket.lottery_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-300 text-sm">{ticket.succursale_name || '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-300">{ticket.agent_name || ticket.agent_id}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-emerald-400">{ticket.win_amount?.toLocaleString()} HTG</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        ticket.status === 'PAID' 
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {ticket.status === 'PAID' ? 'Payé' : 'En Attente'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setSelectedTicket(ticket)}
                          className="p-2 text-slate-400 hover:bg-slate-700 rounded-lg"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => printTicket(ticket.ticket_id)}
                          className="p-2 text-slate-400 hover:bg-slate-700 rounded-lg"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-400" />
              Fiche Gagnante
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-sm text-slate-400">Code Ticket</p>
                <p className="text-xl font-mono font-bold text-amber-400">{selectedTicket.ticket_code}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-slate-400">Loterie</p>
                  <p className="text-white">{selectedTicket.lottery_name}</p>
                </div>
                <div className="p-3 bg-emerald-500/20 rounded-lg">
                  <p className="text-sm text-emerald-400">Gains</p>
                  <p className="text-xl font-bold text-emerald-400">{selectedTicket.win_amount?.toLocaleString()} HTG</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button onClick={() => printTicket(selectedTicket.ticket_id)} className="flex-1 bg-blue-600">
                <Printer className="w-4 h-4 mr-2" />
                Imprimer
              </Button>
              <Button onClick={() => setSelectedTicket(null)} variant="outline" className="flex-1 border-slate-600">
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyLotsGagnants;
