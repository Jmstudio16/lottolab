import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Ticket, Search, Filter, Printer, Eye, Clock,
  CheckCircle, XCircle, Trophy, RefreshCw, Download, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const VendeurMesTickets = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/vendeur/mes-tickets`, { headers });
      setTickets(res.data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const getStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case 'WINNER':
      case 'WON':
        return <Trophy className="w-5 h-5 text-amber-400" />;
      case 'LOST':
      case 'LOSER':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'VOID':
      case 'DELETED':
        return <Trash2 className="w-5 h-5 text-slate-500" />;
      default:
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toUpperCase()) {
      case 'WINNER':
      case 'WON':
        return <span className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded-full">Gagnant</span>;
      case 'LOST':
      case 'LOSER':
        return <span className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-full">Perdu</span>;
      case 'VOID':
      case 'DELETED':
        return <span className="px-2 py-1 text-xs bg-slate-500/20 text-slate-400 rounded-full">Supprimé</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">Validé</span>;
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    // Exclude voided/deleted tickets from main list
    if (ticket.status === 'VOID' || ticket.status === 'DELETED' || ticket.status === 'VOIDED' || ticket.status === 'CANCELLED') {
      return false;
    }
    
    const matchesSearch = 
      ticket.ticket_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.ticket_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'winner' && (ticket.status === 'WINNER' || ticket.status === 'WON')) ||
      (filterStatus === 'lost' && ticket.status === 'LOST') ||
      (filterStatus === 'pending' && (!ticket.status || ticket.status === 'PENDING'));
    return matchesSearch && matchesStatus;
  });

  // Check if ticket can be deleted (within 5 minutes)
  const canDeleteTicket = (ticket) => {
    if (!ticket.created_at) return true;
    try {
      const createdAt = new Date(ticket.created_at);
      const now = new Date();
      const diffMinutes = (now - createdAt) / 1000 / 60;
      return diffMinutes <= 5;
    } catch {
      return true;
    }
  };

  const getDeleteButtonTitle = (ticket) => {
    if (!canDeleteTicket(ticket)) {
      return "Délai de 5 minutes dépassé - Contactez votre superviseur";
    }
    return "Supprimer (dans les 5 minutes)";
  };

  const printTicket = (ticketId) => {
    // Pass token as query param for authentication
    window.open(`${API_URL}/api/ticket/print/${ticketId}?token=${token}&format=thermal`, '_blank');
  };

  const deleteTicket = async (ticketId, ticketCode) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le ticket ${ticketCode}?`)) {
      return;
    }
    
    try {
      await axios.delete(`${API_URL}/api/vendeur/ticket/${ticketId}`, { headers });
      toast.success('Ticket supprimé avec succès');
      fetchTickets(); // Refresh the list
    } catch (error) {
      const msg = error.response?.data?.detail || 'Erreur lors de la suppression';
      toast.error(msg);
    }
  };

  const exportToExcel = () => {
    window.open(`${API_URL}/api/export/vendeur/tickets?token=${token}`, '_blank');
    toast.success('Téléchargement du fichier Excel en cours...');
  };

  return (
    <div className="p-6 pb-24 lg:pb-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Ticket className="w-7 h-7 text-purple-400" />
            Mes Tickets
          </h1>
          <p className="text-slate-400">{tickets.length} ticket(s) au total</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToExcel} variant="outline" className="border-emerald-700 text-emerald-400 hover:bg-emerald-500/10" data-testid="export-excel-btn">
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button onClick={fetchTickets} variant="outline" className="border-slate-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par numéro de ticket..."
            className="pl-10 bg-slate-800 border-slate-700"
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'Tous' },
            { value: 'winner', label: 'Gagnants' },
            { value: 'lost', label: 'Perdus' },
            { value: 'pending', label: 'En attente' }
          ].map(opt => (
            <Button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              variant={filterStatus === opt.value ? 'default' : 'outline'}
              size="sm"
              className={filterStatus === opt.value ? 'bg-purple-600' : 'border-slate-700'}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Tickets List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
          <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Aucun ticket trouvé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => (
            <div
              key={ticket.ticket_id}
              className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-purple-500/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {getStatusIcon(ticket.status)}
                  <div>
                    <p className="font-mono font-semibold text-white">{ticket.ticket_code || ticket.ticket_id}</p>
                    <p className="text-sm text-slate-400">{ticket.lottery_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-white">{ticket.total_amount?.toLocaleString()} HTG</p>
                    {getStatusBadge(ticket.status)}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedTicket(ticket)}
                      className="text-slate-400 hover:text-white"
                      title="Voir détails"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => printTicket(ticket.ticket_id)}
                      className="text-slate-400 hover:text-blue-400"
                      title="Imprimer"
                    >
                      <Printer className="w-4 h-4" />
                    </Button>
                    {ticket.status !== 'VOID' && ticket.status !== 'DELETED' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteTicket(ticket.ticket_id, ticket.ticket_code)}
                        className={`${canDeleteTicket(ticket) ? 'text-slate-400 hover:text-red-400' : 'text-slate-600 cursor-not-allowed'}`}
                        title={getDeleteButtonTitle(ticket)}
                        data-testid={`delete-ticket-${ticket.ticket_id}`}
                        disabled={!canDeleteTicket(ticket)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Plays */}
              <div className="mt-3 pt-3 border-t border-slate-700">
                <div className="flex flex-wrap gap-2">
                  {ticket.plays?.map((play, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-slate-700/50 rounded-full text-sm"
                    >
                      <span className="font-mono text-white">{play.numbers}</span>
                      <span className="text-slate-400 ml-2">{play.bet_type}</span>
                      <span className="text-emerald-400 ml-2">{play.amount} HTG</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Win Amount */}
              {(ticket.status === 'WINNER' || ticket.status === 'WON') && ticket.win_amount > 0 && (
                <div className="mt-3 pt-3 border-t border-amber-500/30 flex items-center justify-between">
                  <span className="text-amber-400">Gain</span>
                  <span className="text-xl font-bold text-amber-400">{ticket.win_amount?.toLocaleString()} HTG</span>
                </div>
              )}

              <div className="mt-2 text-xs text-slate-500">
                Créé le {new Date(ticket.created_at).toLocaleString('fr-FR')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Détails du Ticket</h3>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Numéro</span>
                <span className="font-mono text-white">{selectedTicket.ticket_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Loterie</span>
                <span className="text-white">{selectedTicket.lottery_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tirage</span>
                <span className="text-white">{selectedTicket.draw_name} - {selectedTicket.draw_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Montant</span>
                <span className="text-white">{selectedTicket.total_amount?.toLocaleString()} HTG</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Statut</span>
                {getStatusBadge(selectedTicket.status)}
              </div>
              {selectedTicket.win_amount > 0 && (
                <div className="flex justify-between pt-3 border-t border-slate-700">
                  <span className="text-amber-400">Gain</span>
                  <span className="font-bold text-amber-400">{selectedTicket.win_amount?.toLocaleString()} HTG</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
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

export default VendeurMesTickets;
