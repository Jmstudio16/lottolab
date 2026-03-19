import { API_URL } from '@/config/api';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Trash2, RefreshCw, Search, Calendar, XCircle, Eye, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';


const VendeurFichesSupprimees = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState({ total_count: 0, total_cancelled_amount: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchDeletedTickets = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/vendeur/deleted-tickets`, { headers });
      setTickets(res.data.tickets || []);
      setSummary(res.data.summary || { total_count: 0, total_cancelled_amount: 0 });
    } catch (error) {
      toast.error('Erreur lors du chargement des fiches supprimées');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedTickets();
  }, [token]);

  const filteredTickets = tickets.filter(t => 
    t.ticket_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6" data-testid="vendeur-fiches-supprimees">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
            <Trash2 className="w-6 h-6 sm:w-7 sm:h-7 text-red-400" />
            Fiches Supprimées
          </h1>
          <p className="text-sm text-slate-400">Vos tickets annulés ou supprimés</p>
        </div>
        <Button onClick={fetchDeletedTickets} variant="outline" className="border-slate-700">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-sm text-red-400">Total Supprimées</p>
          <p className="text-2xl font-bold text-red-400">{summary.total_count}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-sm text-slate-400">Montant Annulé</p>
          <p className="text-2xl font-bold text-slate-300">{summary.total_cancelled_amount?.toLocaleString()} HTG</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          placeholder="Rechercher par code ticket ou loterie..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-slate-800 border-slate-700 text-white"
        />
      </div>

      {/* Tickets List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-red-400 animate-spin" />
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
          <Trash2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Aucune fiche supprimée trouvée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map(ticket => (
            <div 
              key={ticket.ticket_id}
              className="bg-slate-800/50 border border-red-500/20 rounded-xl p-4 hover:border-red-500/50 transition-all"
              data-testid={`deleted-ticket-${ticket.ticket_id}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono font-bold text-red-400 line-through">{ticket.ticket_code}</span>
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      Annulé
                    </span>
                  </div>
                  <p className="text-white font-medium">{ticket.lottery_name}</p>
                  <p className="text-sm text-slate-400">
                    {ticket.draw_date} • {ticket.draw_name || ticket.draw_time}
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Montant</p>
                    <p className="text-xl font-bold text-slate-400 line-through">{ticket.total_amount?.toLocaleString()} HTG</p>
                  </div>
                  <Button
                    onClick={() => setSelectedTicket(ticket)}
                    variant="outline"
                    size="sm"
                    className="border-slate-700"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {/* Cancellation reason if available */}
              {ticket.cancellation_reason && (
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Raison: {ticket.cancellation_reason}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-red-400" />
              Fiche Supprimée
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">Code Ticket (Annulé)</p>
                <p className="text-xl font-mono font-bold text-red-400 line-through">{selectedTicket.ticket_code}</p>
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
                  <p className="text-sm text-slate-400">Montant Annulé</p>
                  <p className="text-slate-400 line-through">{selectedTicket.total_amount?.toLocaleString()} HTG</p>
                </div>
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-slate-400">Statut</p>
                  <p className="text-red-400">{selectedTicket.status}</p>
                </div>
              </div>
              
              {selectedTicket.cancellation_reason && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400 mb-1">Raison de l'annulation</p>
                  <p className="text-white">{selectedTicket.cancellation_reason}</p>
                </div>
              )}
              
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-2">Numéros</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTicket.plays?.map((play, idx) => (
                    <span key={idx} className="px-3 py-2 bg-slate-600/50 text-slate-400 rounded font-mono line-through">
                      {play.numbers} - {play.bet_type}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            <Button
              onClick={() => setSelectedTicket(null)}
              variant="outline"
              className="w-full mt-6 border-slate-600"
            >
              Fermer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendeurFichesSupprimees;
