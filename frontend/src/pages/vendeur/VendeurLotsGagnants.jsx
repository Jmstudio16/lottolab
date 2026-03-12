import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Trophy, RefreshCw, Search, Calendar, DollarSign, 
  CheckCircle, Clock, Eye, Printer, Filter, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const VendeurLotsGagnants = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState({ total_count: 0, total_win_amount: 0, paid_count: 0, pending_count: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchWinningTickets = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/vendeur/winning-tickets`, { headers });
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
      t.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'paid' && t.status === 'PAID') ||
      (filterStatus === 'pending' && t.status !== 'PAID');
    return matchesSearch && matchesStatus;
  });

  const printTicket = (ticketId) => {
    window.open(`${API_URL}/api/ticket/print/${ticketId}?token=${token}&format=thermal`, '_blank');
  };

  const exportToExcel = () => {
    window.open(`${API_URL}/api/export/vendeur/winning-tickets?token=${token}`, '_blank');
    toast.success('Téléchargement du fichier Excel en cours...');
  };

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6" data-testid="vendeur-lots-gagnants">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
            <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400" />
            Lots Gagnants
          </h1>
          <p className="text-sm text-slate-400">Vos tickets gagnants</p>
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
            placeholder="Rechercher par code ticket ou loterie..."
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

      {/* Tickets List */}
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
        <div className="space-y-3">
          {filteredTickets.map(ticket => (
            <div 
              key={ticket.ticket_id}
              className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-amber-500/50 transition-all"
              data-testid={`winning-ticket-${ticket.ticket_id}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono font-bold text-amber-400">{ticket.ticket_code}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      ticket.status === 'PAID' 
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {ticket.status === 'PAID' ? 'Payé' : 'En Attente'}
                    </span>
                  </div>
                  <p className="text-white font-medium">{ticket.lottery_name}</p>
                  <p className="text-sm text-slate-400">
                    {ticket.draw_date} • {ticket.draw_name || ticket.draw_time}
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Gains</p>
                    <p className="text-xl font-bold text-emerald-400">{ticket.win_amount?.toLocaleString()} HTG</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setSelectedTicket(ticket)}
                      variant="outline"
                      size="sm"
                      className="border-slate-700"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => printTicket(ticket.ticket_id)}
                      variant="outline"
                      size="sm"
                      className="border-slate-700"
                    >
                      <Printer className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Numbers */}
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-xs text-slate-500 mb-1">Numéros gagnants:</p>
                <div className="flex flex-wrap gap-2">
                  {ticket.plays?.map((play, idx) => (
                    <span key={idx} className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded font-mono text-sm">
                      {play.numbers} ({play.bet_type})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
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
                  <p className="text-white font-medium">{selectedTicket.lottery_name}</p>
                </div>
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-slate-400">Date</p>
                  <p className="text-white">{selectedTicket.draw_date}</p>
                </div>
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-slate-400">Mise</p>
                  <p className="text-white">{selectedTicket.total_amount?.toLocaleString()} HTG</p>
                </div>
                <div className="p-3 bg-emerald-500/20 rounded-lg">
                  <p className="text-sm text-emerald-400">Gains</p>
                  <p className="text-xl font-bold text-emerald-400">{selectedTicket.win_amount?.toLocaleString()} HTG</p>
                </div>
              </div>
              
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-2">Numéros</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTicket.plays?.map((play, idx) => (
                    <span key={idx} className="px-3 py-2 bg-amber-500/20 text-amber-400 rounded font-mono">
                      {play.numbers} - {play.bet_type} ({play.amount} HTG)
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => printTicket(selectedTicket.ticket_id)}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimer
              </Button>
              <Button
                onClick={() => setSelectedTicket(null)}
                variant="outline"
                className="flex-1 border-slate-600"
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendeurLotsGagnants;
