import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import { 
  Ticket, 
  Search, 
  Filter, 
  Printer, 
  XCircle,
  RefreshCw,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AgentTicketsPage = () => {
  const { syncData } = useOutletContext();
  const { token } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/agent/tickets?limit=100`;
      if (statusFilter !== 'all') {
        url += `&status=${statusFilter}`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setTickets(data);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Erreur lors du chargement des tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTickets();
    }
  }, [token, statusFilter]);

  const handlePrint = (ticketId) => {
    window.open(`${API_URL}/api/ticket/print/${ticketId}`, '_blank');
  };

  const handleCancelClick = (ticket) => {
    setSelectedTicket(ticket);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async () => {
    if (!cancelReason.trim()) {
      toast.error('Veuillez indiquer une raison');
      return;
    }

    setIsCanceling(true);
    try {
      const response = await fetch(`${API_URL}/api/lottery/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticket_id: selectedTicket.ticket_id,
          reason: cancelReason
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Erreur lors de l\'annulation');
      }

      toast.success('Ticket annulé avec succès');
      setShowCancelModal(false);
      fetchTickets();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsCanceling(false);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        ticket.ticket_code?.toLowerCase().includes(search) ||
        ticket.lottery_name?.toLowerCase().includes(search) ||
        ticket.plays?.some(p => p.numbers?.includes(search))
      );
    }
    return true;
  });

  const getStatusBadge = (status) => {
    const styles = {
      'PENDING_RESULT': 'bg-amber-900/50 text-amber-400 border-amber-600',
      'WINNER': 'bg-emerald-900/50 text-emerald-400 border-emerald-600',
      'LOSER': 'bg-slate-700 text-slate-400 border-slate-600',
      'VOID': 'bg-red-900/50 text-red-400 border-red-600',
      'ACTIVE': 'bg-blue-900/50 text-blue-400 border-blue-600'
    };
    const labels = {
      'PENDING_RESULT': 'En attente',
      'WINNER': 'Gagnant',
      'LOSER': 'Non gagnant',
      'VOID': 'Annulé',
      'ACTIVE': 'Actif'
    };
    return (
      <span className={`px-2 py-1 rounded border text-xs font-medium ${styles[status] || 'bg-slate-700 text-slate-400'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const canCancel = (ticket) => {
    if (ticket.status === 'VOID') return false;
    if (ticket.status === 'WINNER' || ticket.status === 'LOSER') return false;
    
    // Check void window (5 minutes default)
    const voidMinutes = syncData?.configuration?.void_window_minutes || 5;
    const createdAt = new Date(ticket.created_at);
    const deadline = new Date(createdAt.getTime() + voidMinutes * 60000);
    return new Date() < deadline;
  };

  return (
    <div className="space-y-6" data-testid="tickets-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Mes Tickets</h1>
        <Button
          onClick={fetchTickets}
          variant="outline"
          className="border-slate-600 text-white hover:bg-slate-700"
        >
          <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input
                type="text"
                placeholder="Rechercher par code, loterie ou numéros..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <Filter size={16} className="mr-2" />
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="all" className="text-white">Tous les statuts</SelectItem>
                  <SelectItem value="PENDING_RESULT" className="text-white">En attente</SelectItem>
                  <SelectItem value="WINNER" className="text-white">Gagnants</SelectItem>
                  <SelectItem value="LOSER" className="text-white">Non gagnants</SelectItem>
                  <SelectItem value="VOID" className="text-white">Annulés</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={32} className="animate-spin text-emerald-400" />
        </div>
      ) : filteredTickets.length === 0 ? (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-12 text-center">
            <Ticket size={48} className="mx-auto text-slate-500 mb-4" />
            <p className="text-slate-400">Aucun ticket trouvé</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => (
            <Card key={ticket.ticket_id} className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Ticket Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-lg font-bold text-white">
                        {ticket.ticket_code}
                      </span>
                      {getStatusBadge(ticket.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <p className="text-slate-400">Loterie</p>
                        <p className="text-white">{ticket.lottery_name}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Tirage</p>
                        <p className="text-white">{ticket.draw_name} - {ticket.draw_date}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Total</p>
                        <p className="text-emerald-400 font-semibold">
                          {ticket.total_amount?.toLocaleString()} {ticket.currency}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Date</p>
                        <p className="text-white">
                          {new Date(ticket.created_at).toLocaleString('fr-FR')}
                        </p>
                      </div>
                    </div>

                    {/* Plays */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ticket.plays?.map((play, idx) => (
                        <span 
                          key={idx}
                          className="px-3 py-1 bg-slate-700 rounded-full text-sm"
                        >
                          <span className="font-mono font-bold text-white">{play.numbers}</span>
                          <span className="text-slate-400 ml-2">{play.bet_type}</span>
                          <span className="text-emerald-400 ml-2">{play.amount}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 lg:flex-col">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrint(ticket.ticket_id)}
                      className="flex-1 lg:flex-none border-slate-600 text-white hover:bg-slate-700"
                    >
                      <Printer size={16} className="mr-2" />
                      Imprimer
                    </Button>
                    
                    {canCancel(ticket) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelClick(ticket)}
                        className="flex-1 lg:flex-none border-red-700 text-red-400 hover:bg-red-900/30"
                      >
                        <XCircle size={16} className="mr-2" />
                        Annuler
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && selectedTicket && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="bg-slate-800 border-slate-700 max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-red-400 flex items-center gap-2">
                <AlertCircle size={24} />
                Annuler le Ticket
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <p className="text-sm text-slate-400">Code du ticket</p>
                <p className="font-mono font-bold text-white">{selectedTicket.ticket_code}</p>
                <p className="text-sm text-slate-400 mt-2">Montant</p>
                <p className="text-emerald-400 font-bold">
                  {selectedTicket.total_amount?.toLocaleString()} {selectedTicket.currency}
                </p>
              </div>

              <div>
                <label className="text-sm text-slate-300 mb-2 block">
                  Raison de l'annulation *
                </label>
                <Input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ex: Erreur de saisie"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleCancelConfirm}
                  disabled={isCanceling || !cancelReason.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {isCanceling ? (
                    <>
                      <RefreshCw className="animate-spin mr-2" size={16} />
                      Annulation...
                    </>
                  ) : (
                    'Confirmer l\'annulation'
                  )}
                </Button>
                <Button
                  onClick={() => setShowCancelModal(false)}
                  variant="outline"
                  className="flex-1 border-slate-600 text-white hover:bg-slate-700"
                >
                  Retour
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AgentTicketsPage;
