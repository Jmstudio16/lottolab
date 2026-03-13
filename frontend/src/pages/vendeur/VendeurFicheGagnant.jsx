import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Receipt, RefreshCw, CheckCircle, Calendar, DollarSign, Printer, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const VendeurFicheGagnant = () => {
  const { token } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPaid, setTotalPaid] = useState(0);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchPaidTickets = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/vendeur/paid-tickets`, { headers });
      setTickets(res.data.tickets || []);
      setTotalPaid(res.data.total_paid || 0);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPaidTickets();
  }, []);

  const printTicket = (ticketId) => {
    window.open(`${API_URL}/api/ticket/print/${ticketId}?token=${token}&format=thermal`, '_blank');
  };

  const exportToExcel = () => {
    window.open(`${API_URL}/api/export/vendeur/paid-tickets?token=${token}`, '_blank');
    toast.success('Téléchargement en cours...');
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
    <div className="space-y-6" data-testid="vendeur-fiche-gagnant">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
            <Receipt className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400" />
            Fiches Gagnants (Payés)
          </h1>
          <p className="text-sm text-slate-400">Historique des tickets gagnants payés</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToExcel} variant="outline" className="border-emerald-700 text-emerald-400 hover:bg-emerald-500/10">
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button onClick={fetchPaidTickets} variant="outline" className="border-slate-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Tickets Payés</p>
          <p className="text-2xl font-bold text-white">{tickets.length}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-emerald-500/30">
          <p className="text-slate-400 text-sm">Total Payé</p>
          <p className="text-2xl font-bold text-emerald-400">{totalPaid.toLocaleString()} HTG</p>
        </div>
      </div>

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
          <Receipt className="w-16 h-16 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 text-lg">Aucune fiche gagnant payée</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Ticket</th>
                  <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Loterie</th>
                  <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Numéros</th>
                  <th className="text-right text-slate-400 text-sm font-medium px-4 py-3">Gains</th>
                  <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Payé le</th>
                  <th className="text-center text-slate-400 text-sm font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {tickets.map((ticket) => (
                  <tr key={ticket.ticket_id} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span className="text-white font-mono">{ticket.ticket_code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{ticket.lottery_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-purple-400 font-mono">
                        {ticket.winning_plays?.map(p => p.numbers).join(', ') || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-emerald-400 font-bold">
                        {(ticket.winnings || 0).toLocaleString()} HTG
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {formatDate(ticket.paid_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => printTicket(ticket.ticket_id)}
                        className="text-slate-400 hover:text-blue-400"
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendeurFicheGagnant;
