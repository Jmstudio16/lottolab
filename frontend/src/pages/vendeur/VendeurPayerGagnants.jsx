import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Banknote, Trophy, RefreshCw, CheckCircle, User, Calendar,
  DollarSign, Ticket, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const VendeurPayerGagnants = () => {
  const { token } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalToPay, setTotalToPay] = useState(0);
  const [payingTicket, setPayingTicket] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchTicketsToPay = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/vendeur/tickets-to-pay`, { headers });
      setTickets(res.data.tickets || []);
      setTotalToPay(res.data.total_to_pay || 0);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTicketsToPay();
  }, []);

  const handlePayWinner = async (ticketId, ticketCode, winnings) => {
    if (!window.confirm(`Confirmez le paiement de ${winnings.toLocaleString()} HTG pour le ticket ${ticketCode}?`)) {
      return;
    }
    
    setPayingTicket(ticketId);
    try {
      await axios.post(`${API_URL}/api/vendeur/pay-winner`, { ticket_id: ticketId }, { headers });
      toast.success(`Ticket ${ticketCode} payé avec succès!`);
      fetchTicketsToPay();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du paiement');
    }
    setPayingTicket(null);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6" data-testid="vendeur-payer-gagnants">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
            <Banknote className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400" />
            Tickets à Payer
          </h1>
          <p className="text-sm text-slate-400">Gérez les paiements des tickets gagnants</p>
        </div>
        <Button onClick={fetchTicketsToPay} variant="outline" className="border-slate-700">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Stats Card */}
      <div className="bg-gradient-to-r from-emerald-600/20 to-amber-600/20 rounded-xl p-6 border border-emerald-500/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">Total à Payer</p>
            <p className="text-3xl font-bold text-emerald-400">{totalToPay.toLocaleString()} HTG</p>
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-sm">Tickets Gagnants</p>
            <p className="text-3xl font-bold text-amber-400">{tickets.length}</p>
          </div>
        </div>
      </div>

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
          <Trophy className="w-16 h-16 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 text-lg">Aucun ticket à payer</p>
          <p className="text-slate-500 text-sm mt-1">Les tickets gagnants apparaîtront ici</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <div 
              key={ticket.ticket_id}
              className="bg-slate-800/50 rounded-xl border border-amber-500/30 p-4 hover:border-amber-500/50 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Ticket Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-bold">
                      GAGNANT
                    </span>
                    <span className="text-white font-mono font-bold">{ticket.ticket_code}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">Loterie:</span>
                      <p className="text-white">{ticket.lottery_name}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Tirage:</span>
                      <p className="text-white">{ticket.draw_name || ticket.draw_time || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Numéros:</span>
                      <p className="text-purple-400 font-mono">
                        {ticket.winning_plays?.map(p => p.numbers).join(', ') || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Date:</span>
                      <p className="text-white">{formatDate(ticket.created_at)}</p>
                    </div>
                  </div>
                </div>

                {/* Winnings & Pay Button */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-slate-400 text-xs">À Payer</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {(ticket.winnings || 0).toLocaleString()} HTG
                    </p>
                  </div>
                  <Button
                    onClick={() => handlePayWinner(ticket.ticket_id, ticket.ticket_code, ticket.winnings)}
                    disabled={payingTicket === ticket.ticket_id}
                    className="bg-emerald-600 hover:bg-emerald-700 min-w-[120px]"
                    data-testid={`pay-btn-${ticket.ticket_id}`}
                  >
                    {payingTicket === ticket.ticket_id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Payer
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Winning Details */}
              {ticket.winning_plays && ticket.winning_plays.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-slate-400 text-xs mb-2">Détails des gains:</p>
                  <div className="flex flex-wrap gap-2">
                    {ticket.winning_plays.map((play, idx) => (
                      <div key={idx} className="px-3 py-1 bg-slate-700/50 rounded text-sm">
                        <span className="text-purple-400 font-mono">{play.numbers}</span>
                        <span className="text-slate-400 mx-2">→</span>
                        <span className="text-emerald-400 font-bold">{(play.winnings || 0).toLocaleString()} HTG</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VendeurPayerGagnants;
