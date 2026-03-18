import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Search, CheckCircle, XCircle, Clock, AlertTriangle, Ticket, Calendar, DollarSign, Hash } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PublicVerifyPage = () => {
  const { ticketCode: paramCode } = useParams();
  const [searchParams] = useSearchParams();
  const [ticketCode, setTicketCode] = useState(paramCode || searchParams.get('code') || '');
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (paramCode) {
      verifyTicket(paramCode);
    }
  }, [paramCode]);

  const verifyTicket = async (code) => {
    if (!code || code.trim() === '') {
      setError('Veuillez entrer un code de ticket');
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const response = await axios.get(`${API_URL}/api/ticket/verify/${code.trim()}`);
      setTicket(response.data);
    } catch (err) {
      setTicket(null);
      if (err.response?.status === 404) {
        setError('Ticket non trouvé. Vérifiez le code et réessayez.');
      } else {
        setError('Erreur lors de la vérification. Veuillez réessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    verifyTicket(ticketCode);
  };

  const getStatusConfig = (status, displayStatus) => {
    switch (status) {
      case 'WINNER':
        return {
          icon: CheckCircle,
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/20 border-emerald-500/50',
          label: displayStatus || 'GAGNANT'
        };
      case 'LOSER':
        return {
          icon: XCircle,
          color: 'text-red-400',
          bg: 'bg-red-500/20 border-red-500/50',
          label: displayStatus || 'PERDANT'
        };
      case 'VALIDATED':
      case 'PENDING':
      case 'PENDING_RESULT':
        return {
          icon: Clock,
          color: 'text-amber-400',
          bg: 'bg-amber-500/20 border-amber-500/50',
          label: displayStatus || 'EN ATTENTE'
        };
      case 'VOID':
      case 'DELETED':
      case 'CANCELLED':
        return {
          icon: AlertTriangle,
          color: 'text-gray-400',
          bg: 'bg-gray-500/20 border-gray-500/50',
          label: displayStatus || 'ANNULÉ'
        };
      default:
        return {
          icon: Clock,
          color: 'text-slate-400',
          bg: 'bg-slate-500/20 border-slate-500/50',
          label: status || 'INCONNU'
        };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="bg-slate-900/80 border-b border-slate-800 py-6">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">
            🎰 Vérification de Ticket
          </h1>
          <p className="text-slate-400">
            Entrez votre code de ticket pour vérifier son statut
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Search Form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={ticketCode}
                onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
                placeholder="Code du ticket (ex: ABC123XYZ)"
                className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-lg font-mono"
                data-testid="ticket-code-input"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
              data-testid="verify-button"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              Vérifier
            </button>
          </div>
        </form>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6 text-center" data-testid="error-message">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Ticket Result */}
        {ticket && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden" data-testid="ticket-result">
            {/* Status Header */}
            {(() => {
              const statusConfig = getStatusConfig(ticket.status, ticket.display_status);
              const StatusIcon = statusConfig.icon;
              return (
                <div className={`p-6 ${statusConfig.bg} border-b border-slate-800`}>
                  <div className="flex items-center justify-center gap-3">
                    <StatusIcon className={`w-10 h-10 ${statusConfig.color}`} />
                    <span className={`text-3xl font-bold ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                  {ticket.is_winner && ticket.winnings > 0 && (
                    <div className="text-center mt-4">
                      <p className="text-emerald-400 text-4xl font-bold">
                        {ticket.winnings.toLocaleString()} HTG
                      </p>
                      <p className="text-slate-400 mt-1">Montant du gain</p>
                      {ticket.payment_status === 'PAID' && (
                        <span className="inline-block mt-2 px-3 py-1 bg-emerald-600/30 text-emerald-300 rounded-full text-sm">
                          ✓ Payé le {new Date(ticket.paid_at).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Ticket Details */}
            <div className="p-6 space-y-4">
              {/* Code */}
              <div className="flex items-center justify-between py-3 border-b border-slate-800">
                <span className="text-slate-400 flex items-center gap-2">
                  <Ticket className="w-4 h-4" />
                  Code Ticket
                </span>
                <span className="text-white font-mono font-bold text-lg">{ticket.ticket_code}</span>
              </div>

              {/* Lottery */}
              <div className="flex items-center justify-between py-3 border-b border-slate-800">
                <span className="text-slate-400">Loterie</span>
                <span className="text-white font-semibold">{ticket.lottery_name}</span>
              </div>

              {/* Draw */}
              <div className="flex items-center justify-between py-3 border-b border-slate-800">
                <span className="text-slate-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Tirage
                </span>
                <span className="text-white">
                  {ticket.draw_name} - {new Date(ticket.draw_date).toLocaleDateString('fr-FR')}
                </span>
              </div>

              {/* Amount Played */}
              <div className="flex items-center justify-between py-3 border-b border-slate-800">
                <span className="text-slate-400 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Montant Joué
                </span>
                <span className="text-white font-semibold">{ticket.total_amount?.toLocaleString()} HTG</span>
              </div>

              {/* Numbers Played */}
              <div className="py-3">
                <span className="text-slate-400 block mb-3">Numéros Joués</span>
                <div className="space-y-2">
                  {ticket.plays?.map((play, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-mono font-bold text-emerald-400">{play.numbers}</span>
                        <span className="text-slate-500 text-sm uppercase">{play.bet_type}</span>
                      </div>
                      <span className="text-white">{play.amount?.toLocaleString()} HTG</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Winning Numbers if available */}
              {ticket.winning_numbers && (
                <div className="py-3 border-t border-slate-800">
                  <span className="text-slate-400 block mb-3">Numéros Gagnants</span>
                  <div className="flex gap-3 justify-center">
                    {typeof ticket.winning_numbers === 'object' ? (
                      <>
                        <span className="w-14 h-14 flex items-center justify-center bg-emerald-500/20 border-2 border-emerald-500 rounded-full text-emerald-400 text-xl font-bold">
                          {ticket.winning_numbers.first || '-'}
                        </span>
                        <span className="w-14 h-14 flex items-center justify-center bg-amber-500/20 border-2 border-amber-500 rounded-full text-amber-400 text-xl font-bold">
                          {ticket.winning_numbers.second || '-'}
                        </span>
                        <span className="w-14 h-14 flex items-center justify-center bg-blue-500/20 border-2 border-blue-500 rounded-full text-blue-400 text-xl font-bold">
                          {ticket.winning_numbers.third || '-'}
                        </span>
                      </>
                    ) : (
                      <span className="text-white font-mono text-xl">{ticket.winning_numbers}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!ticket && !error && searched && (
          <div className="text-center py-12 text-slate-500">
            <Ticket className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Aucun ticket trouvé</p>
          </div>
        )}

        {/* Instructions */}
        {!searched && (
          <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-6 text-center">
            <Ticket className="w-12 h-12 mx-auto mb-4 text-slate-500" />
            <h3 className="text-white font-semibold mb-2">Comment vérifier votre ticket?</h3>
            <ol className="text-slate-400 text-sm space-y-2 text-left max-w-md mx-auto">
              <li>1. Trouvez le code sur votre ticket imprimé</li>
              <li>2. Entrez le code dans le champ ci-dessus</li>
              <li>3. Cliquez sur "Vérifier" pour voir le statut</li>
            </ol>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 border-t border-slate-800 py-4">
        <p className="text-center text-slate-500 text-sm">
          LottoLab © 2026 - Système de loterie sécurisé
        </p>
      </div>
    </div>
  );
};

export default PublicVerifyPage;
