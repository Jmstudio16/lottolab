import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Trophy, 
  DollarSign, 
  RefreshCw,
  Search,
  CheckCircle,
  Clock,
  Banknote,
  Ticket,
  Filter,
  Eye,
  CreditCard,
  AlertCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const CompanyWinningTicketsPage = () => {
  const [tickets, setTickets] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('winners'); // winners, payouts
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutData, setPayoutData] = useState({
    payout_method: 'CASH',
    notes: ''
  });
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetchData();
    fetchSummary();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [winnersRes, payoutsRes] = await Promise.all([
        apiClient.get('/company/winning-tickets'),
        apiClient.get('/company/payouts')
      ]);
      setTickets(winnersRes.data || []);
      setPayouts(payoutsRes.data || []);
    } catch (error) {
      toast.error('Échec du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await apiClient.get('/company/financial-summary?period=today');
      setSummary(response.data);
    } catch (error) {
      console.error('Failed to load summary');
    }
  };

  const handleCheckTicket = async (ticketCode) => {
    try {
      const response = await apiClient.post('/tickets/check', { ticket_code: ticketCode });
      setSelectedTicket(response.data);
      setShowTicketModal(true);
      fetchData(); // Refresh list
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la vérification');
    }
  };

  const handlePayout = async () => {
    if (!selectedTicket) return;
    
    try {
      await apiClient.post('/tickets/payout', {
        ticket_id: selectedTicket.ticket_id,
        ...payoutData
      });
      toast.success('Paiement effectué avec succès!');
      setShowPayoutModal(false);
      setShowTicketModal(false);
      setSelectedTicket(null);
      setPayoutData({ payout_method: 'CASH', notes: '' });
      fetchData();
      fetchSummary();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Échec du paiement');
    }
  };

  const openPayoutModal = (ticket) => {
    setSelectedTicket(ticket);
    setShowPayoutModal(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-HT', { 
      style: 'decimal',
      minimumFractionDigits: 2 
    }).format(amount || 0) + ' HTG';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('fr-HT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      (t.ticket_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.agent_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'WINNER':
        return { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: Trophy, label: 'Gagnant' };
      case 'PAID':
        return { color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle, label: 'Payé' };
      default:
        return { color: 'text-slate-400', bg: 'bg-slate-500/20', icon: Clock, label: status };
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="winning-tickets-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Trophy className="w-7 h-7 text-yellow-400" />
              Tickets Gagnants & Paiements
            </h1>
            <p className="text-slate-400 mt-1">Gérer les gains et effectuer les paiements</p>
          </div>
          <Button 
            onClick={() => { fetchData(); fetchSummary(); }} 
            variant="outline"
            className="border-slate-600 hover:bg-slate-700"
            data-testid="refresh-winners-btn"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <Ticket className="w-4 h-4" />
                Tickets Aujourd'hui
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-white">{summary?.total_tickets || 0}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Gagnants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-400">{summary?.winners_count || 0}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Gains
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-400">{formatCurrency(summary?.total_wins_amount)}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <Banknote className="w-4 h-4" />
                Payé
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(summary?.total_payouts)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700 pb-2">
          <Button
            variant={activeTab === 'winners' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('winners')}
            className={activeTab === 'winners' ? 'bg-yellow-500 text-black' : 'text-slate-400'}
          >
            <Trophy className="w-4 h-4 mr-2" />
            Tickets Gagnants ({tickets.filter(t => t.status === 'WINNER').length})
          </Button>
          <Button
            variant={activeTab === 'payouts' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('payouts')}
            className={activeTab === 'payouts' ? 'bg-green-500 text-black' : 'text-slate-400'}
          >
            <Banknote className="w-4 h-4 mr-2" />
            Historique Paiements ({payouts.length})
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Rechercher par code ou agent..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white"
              data-testid="search-tickets-input"
            />
          </div>
          {activeTab === 'winners' && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-slate-800 border-slate-700 text-white">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="WINNER">Gagnant (non payé)</SelectItem>
                <SelectItem value="PAID">Payé</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Content */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-slate-400" />
              <p className="text-slate-400 mt-2">Chargement...</p>
            </div>
          ) : activeTab === 'winners' ? (
            /* Winners Table */
            filteredTickets.length === 0 ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-slate-500" />
                <p className="text-slate-400 mt-2">Aucun ticket gagnant trouvé</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Ticket</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Loterie</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Agent</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Mise</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Gain</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Date</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {filteredTickets.map((ticket) => {
                      const status = getStatusBadge(ticket.status);
                      const StatusIcon = status.icon;
                      return (
                        <tr key={ticket.ticket_id} className="hover:bg-slate-700/30" data-testid={`winner-row-${ticket.ticket_id}`}>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-mono font-bold text-yellow-400">{ticket.ticket_code}</p>
                              <p className="text-xs text-slate-500">{ticket.verification_code}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-white">{ticket.lottery_name}</p>
                            <p className="text-xs text-slate-400">{ticket.draw_name} - {ticket.draw_date}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{ticket.agent_name}</td>
                          <td className="px-4 py-3 text-right font-mono text-white">
                            {formatCurrency(ticket.total_amount)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-green-400 font-bold">
                            {formatCurrency(ticket.win_amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-400">
                            {formatDate(ticket.created_at)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex gap-2 justify-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCheckTicket(ticket.ticket_code)}
                                className="border-slate-600 hover:bg-slate-700"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {ticket.status === 'WINNER' && (
                                <Button
                                  size="sm"
                                  onClick={() => openPayoutModal(ticket)}
                                  className="bg-green-600 hover:bg-green-700"
                                  data-testid={`payout-btn-${ticket.ticket_id}`}
                                >
                                  <Banknote className="w-4 h-4 mr-1" />
                                  Payer
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* Payouts Table */
            payouts.length === 0 ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-slate-500" />
                <p className="text-slate-400 mt-2">Aucun paiement enregistré</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">ID Paiement</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Ticket</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Montant</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Méthode</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Payé par</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {payouts.map((payout) => (
                      <tr key={payout.payout_id} className="hover:bg-slate-700/30" data-testid={`payout-row-${payout.payout_id}`}>
                        <td className="px-4 py-3 font-mono text-sm text-slate-400">{payout.payout_id}</td>
                        <td className="px-4 py-3 font-mono font-bold text-yellow-400">{payout.ticket_code}</td>
                        <td className="px-4 py-3 text-right font-mono text-green-400 font-bold">
                          {formatCurrency(payout.payout_amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                            <CreditCard className="w-3 h-3" />
                            {payout.payout_method}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{payout.paid_by_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-400">{formatDate(payout.paid_at)}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{payout.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        {/* Ticket Detail Modal */}
        <Dialog open={showTicketModal} onOpenChange={setShowTicketModal}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-yellow-400" />
                Détails du Ticket
              </DialogTitle>
            </DialogHeader>
            
            {selectedTicket && (
              <div className="space-y-4 mt-4">
                <div className="bg-slate-900/50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-mono font-bold text-yellow-400">{selectedTicket.ticket_code}</p>
                  <p className="text-sm text-slate-400">Code de vérification: {selectedTicket.verification_code}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Loterie</p>
                    <p className="text-white">{selectedTicket.lottery_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Tirage</p>
                    <p className="text-white">{selectedTicket.draw_name} - {selectedTicket.draw_date}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-slate-400">Numéros joués</p>
                  <div className="space-y-1">
                    {selectedTicket.numbers_played?.map((play, idx) => (
                      <div key={idx} className="flex justify-between bg-slate-900/30 px-3 py-2 rounded">
                        <span className="font-mono text-white">{play.numbers}</span>
                        <span className="text-slate-400">{play.bet_type}</span>
                        <span className="font-mono text-yellow-400">{formatCurrency(play.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedTicket.winning_numbers && (
                  <div className="bg-green-500/10 border border-green-500/30 p-3 rounded-lg">
                    <p className="text-xs text-green-400 mb-1">Numéros gagnants</p>
                    <p className="font-mono text-lg text-green-400">
                      {typeof selectedTicket.winning_numbers === 'object' 
                        ? Object.values(selectedTicket.winning_numbers).filter(Boolean).join(' - ')
                        : selectedTicket.winning_numbers}
                    </p>
                  </div>
                )}

                <div className={`p-4 rounded-lg text-center ${
                  selectedTicket.is_winner 
                    ? 'bg-green-500/20 border border-green-500/30' 
                    : 'bg-slate-700/50'
                }`}>
                  <p className="text-sm text-slate-400">Statut</p>
                  <p className={`text-xl font-bold ${
                    selectedTicket.is_winner ? 'text-green-400' : 'text-slate-400'
                  }`}>
                    {selectedTicket.message}
                  </p>
                  {selectedTicket.is_winner && (
                    <p className="text-2xl font-bold text-green-400 mt-2">
                      {formatCurrency(selectedTicket.payout_amount)}
                    </p>
                  )}
                </div>

                {selectedTicket.can_be_paid && (
                  <Button
                    onClick={() => {
                      setShowTicketModal(false);
                      openPayoutModal(selectedTicket);
                    }}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <Banknote className="w-4 h-4 mr-2" />
                    Procéder au Paiement
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Payout Modal */}
        <Dialog open={showPayoutModal} onOpenChange={setShowPayoutModal}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-green-400" />
                Paiement du Ticket
              </DialogTitle>
            </DialogHeader>
            
            {selectedTicket && (
              <div className="space-y-4 mt-4">
                <div className="bg-slate-900/50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-slate-400">Ticket</p>
                      <p className="font-mono font-bold text-yellow-400">{selectedTicket.ticket_code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Montant à payer</p>
                      <p className="text-2xl font-bold text-green-400">
                        {formatCurrency(selectedTicket.win_amount || selectedTicket.payout_amount)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Méthode de paiement</label>
                  <Select 
                    value={payoutData.payout_method} 
                    onValueChange={(v) => setPayoutData({...payoutData, payout_method: v})}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="CASH">Espèces</SelectItem>
                      <SelectItem value="TRANSFER">Virement</SelectItem>
                      <SelectItem value="CREDIT">Crédit Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Notes (optionnel)</label>
                  <Input
                    value={payoutData.notes}
                    onChange={(e) => setPayoutData({...payoutData, notes: e.target.value})}
                    className="bg-slate-900 border-slate-600 text-white"
                    placeholder="Ex: Paiement en espèces au bureau"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowPayoutModal(false)}
                    className="flex-1 border-slate-600"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handlePayout}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    data-testid="confirm-payout-btn"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirmer le Paiement
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default CompanyWinningTicketsPage;
