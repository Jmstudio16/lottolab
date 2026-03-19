import { API_URL } from '@/config/api';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import VendeurLayout from '../layouts/VendeurLayout';
import { 
  Trophy, DollarSign, CheckCircle, AlertTriangle, Search, 
  Wallet, RefreshCw, ChevronRight, Clock, Receipt
} from 'lucide-react';
import { toast } from 'sonner';


const VendeurPayWinnersPage = () => {
  const { token } = useAuth();
  const [winningTickets, setWinningTickets] = useState([]);
  const [paidTickets, setPaidTickets] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payingTicket, setPayingTicket] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [searchCode, setSearchCode] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [winnersRes, paidRes, balanceRes] = await Promise.all([
        axios.get(`${API_URL}/api/vendeur/winning-tickets`, { headers }),
        axios.get(`${API_URL}/api/vendeur/paid-tickets`, { headers }),
        axios.get(`${API_URL}/api/vendeur/balance`, { headers })
      ]);

      // Handle different response formats
      const winnersData = winnersRes.data?.tickets || winnersRes.data || [];
      const unpaidWinners = Array.isArray(winnersData) 
        ? winnersData.filter(t => t.payment_status !== 'PAID')
        : [];
      
      setWinningTickets(unpaidWinners);
      setPaidTickets(paidRes.data?.tickets || paidRes.data || []);
      setBalance(balanceRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handlePayWinner = async (ticket) => {
    if (!window.confirm(`Confirmer le paiement de ${ticket.winnings?.toLocaleString() || 0} HTG pour le ticket #${ticket.ticket_code}?`)) {
      return;
    }

    setPayingTicket(ticket.ticket_id);
    try {
      const response = await axios.post(
        `${API_URL}/api/vendeur/pay-winner/${ticket.ticket_id}`,
        {},
        { headers }
      );

      toast.success(response.data.message || 'Ticket payé avec succès!');
      fetchData(); // Refresh data
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Erreur lors du paiement';
      toast.error(errorMsg);
    } finally {
      setPayingTicket(null);
    }
  };

  const filteredWinningTickets = winningTickets.filter(t => 
    !searchCode || 
    t.ticket_code?.toLowerCase().includes(searchCode.toLowerCase()) ||
    t.verification_code?.includes(searchCode)
  );

  const filteredPaidTickets = paidTickets.filter(t =>
    !searchCode ||
    t.ticket_code?.toLowerCase().includes(searchCode.toLowerCase())
  );

  return (
    <VendeurLayout>
      <div className="p-6 space-y-6" data-testid="pay-winners-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Trophy className="w-7 h-7 text-amber-400" />
              Paiement des Gagnants
            </h1>
            <p className="text-slate-400 mt-1">Payez les tickets gagnants à vos clients</p>
          </div>

          {/* Balance Card */}
          <div className="bg-gradient-to-r from-emerald-600/20 to-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 min-w-[250px]">
            <div className="flex items-center gap-3">
              <Wallet className="w-8 h-8 text-emerald-400" />
              <div>
                <p className="text-emerald-400 text-sm">Votre Solde</p>
                <p className="text-2xl font-bold text-white">
                  {balance?.available_balance?.toLocaleString() || 0} <span className="text-base font-normal">HTG</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
              activeTab === 'pending'
                ? 'bg-amber-500/20 text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-white'
            }`}
            data-testid="tab-pending"
          >
            <Trophy className="w-4 h-4 inline mr-2" />
            À Payer ({winningTickets.length})
          </button>
          <button
            onClick={() => setActiveTab('paid')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
              activeTab === 'paid'
                ? 'bg-emerald-500/20 text-emerald-400 border-b-2 border-emerald-400'
                : 'text-slate-400 hover:text-white'
            }`}
            data-testid="tab-paid"
          >
            <CheckCircle className="w-4 h-4 inline mr-2" />
            Payés ({paidTickets.length})
          </button>
        </div>

        {/* Search & Refresh */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="Rechercher par code ticket..."
              className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              data-testid="search-input"
            />
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2 transition-colors"
            data-testid="refresh-button"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Pending Winners Tab */}
            {activeTab === 'pending' && (
              <div className="space-y-4">
                {filteredWinningTickets.length === 0 ? (
                  <div className="text-center py-16 bg-slate-900/30 rounded-xl border border-slate-800">
                    <Trophy className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                    <p className="text-slate-400">Aucun ticket gagnant à payer</p>
                  </div>
                ) : (
                  filteredWinningTickets.map((ticket) => (
                    <div 
                      key={ticket.ticket_id}
                      className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-amber-500/50 transition-colors"
                      data-testid={`ticket-${ticket.ticket_id}`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Ticket Info */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-mono font-bold text-white">
                              #{ticket.ticket_code}
                            </span>
                            <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
                              GAGNANT
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                            <span>{ticket.lottery_name}</span>
                            <span>•</span>
                            <span>{ticket.draw_name} - {ticket.draw_date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">Numéros:</span>
                            {ticket.plays?.map((play, idx) => (
                              <span key={idx} className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded font-mono">
                                {play.numbers}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Amount & Pay Button */}
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-slate-400">Montant à payer</p>
                            <p className="text-2xl font-bold text-emerald-400">
                              {(ticket.winnings || 0).toLocaleString()} HTG
                            </p>
                          </div>
                          <button
                            onClick={() => handlePayWinner(ticket)}
                            disabled={payingTicket === ticket.ticket_id || (balance?.available_balance || 0) < (ticket.winnings || 0)}
                            className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                              (balance?.available_balance || 0) < (ticket.winnings || 0)
                                ? 'bg-red-500/20 text-red-400 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                            data-testid={`pay-button-${ticket.ticket_id}`}
                          >
                            {payingTicket === ticket.ticket_id ? (
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (balance?.available_balance || 0) < (ticket.winnings || 0) ? (
                              <>
                                <AlertTriangle className="w-5 h-5" />
                                Solde Insuffisant
                              </>
                            ) : (
                              <>
                                <DollarSign className="w-5 h-5" />
                                Payer
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Paid Tickets Tab */}
            {activeTab === 'paid' && (
              <div className="space-y-4">
                {filteredPaidTickets.length === 0 ? (
                  <div className="text-center py-16 bg-slate-900/30 rounded-xl border border-slate-800">
                    <Receipt className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                    <p className="text-slate-400">Aucun ticket payé</p>
                  </div>
                ) : (
                  filteredPaidTickets.map((ticket) => (
                    <div 
                      key={ticket.ticket_id}
                      className="bg-slate-900/50 border border-emerald-500/30 rounded-xl p-5"
                      data-testid={`paid-ticket-${ticket.ticket_id}`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-mono font-bold text-white">
                              #{ticket.ticket_code}
                            </span>
                            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              PAYÉ
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                            <span>{ticket.lottery_name}</span>
                            <span>•</span>
                            <span>Payé le {new Date(ticket.paid_at).toLocaleString('fr-FR')}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-400">Montant payé</p>
                          <p className="text-xl font-bold text-emerald-400">
                            {(ticket.paid_amount || ticket.winnings || 0).toLocaleString()} HTG
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* Balance Warning */}
        {balance && balance.available_balance < 5000 && (
          <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-amber-400 font-semibold">Solde faible</p>
              <p className="text-amber-300/70 text-sm">
                Votre solde est de {balance.available_balance.toLocaleString()} HTG. Contactez votre superviseur pour un dépôt.
              </p>
            </div>
          </div>
        )}
      </div>
    </VendeurLayout>
  );
};

export default VendeurPayWinnersPage;
