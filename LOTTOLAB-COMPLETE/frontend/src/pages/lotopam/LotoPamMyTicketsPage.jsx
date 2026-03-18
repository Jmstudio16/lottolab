import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLotoPamAuth } from '../../context/LotoPamAuthContext';
import LotoPamLayout from '../../layouts/LotoPamLayout';
import { 
  Ticket, Clock, CheckCircle, XCircle, Trophy, 
  Loader2, RefreshCw, Filter, Calendar
} from 'lucide-react';

const LotoPamMyTicketsPage = () => {
  const { t } = useTranslation();
  const { isAuthenticated, apiClient } = useLotoPamAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (isAuthenticated) {
      loadTickets();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, filter]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const response = await apiClient.get(`/api/online/tickets${params}`);
      setTickets(response.data.tickets || []);
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { icon: Clock, color: 'yellow', text: 'En attente' },
      won: { icon: Trophy, color: 'green', text: 'Gagnant' },
      lost: { icon: XCircle, color: 'red', text: 'Perdu' },
      paid: { icon: CheckCircle, color: 'emerald', text: 'Payé' },
      cancelled: { icon: XCircle, color: 'slate', text: 'Annulé' }
    };
    
    const badge = badges[status] || badges.pending;
    return (
      <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-${badge.color}-500/20 text-${badge.color}-400`}>
        <badge.icon className="w-3 h-3" />
        {badge.text}
      </span>
    );
  };

  if (!isAuthenticated) {
    return (
      <LotoPamLayout>
        <div className="max-w-2xl mx-auto py-20 text-center px-4">
          <Ticket className="w-20 h-20 mx-auto mb-6 text-yellow-400 opacity-50" />
          <h2 className="text-3xl font-bold text-white mb-4">Connectez-vous pour voir vos tickets</h2>
          <p className="text-slate-400 mb-8">Créez un compte pour jouer et suivre vos paris</p>
          <Link
            to="/lotopam/login"
            className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-slate-900 font-bold rounded-xl hover:shadow-xl transition-all"
          >
            Se Connecter
          </Link>
        </div>
      </LotoPamLayout>
    );
  }

  return (
    <LotoPamLayout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">{t('lotopam.myTickets')}</h1>
            <p className="text-slate-400">Historique de tous vos paris</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadTickets}
              className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              to="/lotopam/play"
              className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-slate-900 font-bold rounded-lg hover:shadow-lg transition-all"
            >
              Nouveau Pari
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
          <Filter className="w-5 h-5 text-slate-400" />
          {[
            { value: 'all', label: 'Tous' },
            { value: 'pending', label: 'En attente' },
            { value: 'won', label: 'Gagnants' },
            { value: 'lost', label: 'Perdus' }
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f.value
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                  : 'bg-slate-700/50 text-slate-300 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Tickets List */}
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-yellow-400 mx-auto" />
          </div>
        ) : tickets.length > 0 ? (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <div
                key={ticket.ticket_id}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-yellow-500/30 transition-colors"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-white text-lg">{ticket.game_name}</h3>
                      {getStatusBadge(ticket.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(ticket.created_at).toLocaleDateString('fr-FR')}
                      </span>
                      <span>{ticket.draw_type}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Mise totale</p>
                    <p className="text-xl font-bold text-white">{ticket.total_amount?.toLocaleString()} HTG</p>
                  </div>
                </div>

                {/* Plays */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                  {(ticket.plays || []).map((play, index) => (
                    <div
                      key={index}
                      className="p-3 bg-slate-900/50 border border-slate-700 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl font-mono font-bold text-yellow-400 tracking-wider">
                          {play.number}
                        </span>
                        <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-300">
                          {play.bet_type}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">Mise: {play.amount} HTG</p>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Ticket className="w-4 h-4" />
                    <span className="font-mono">{ticket.ticket_id?.slice(0, 16)}...</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Gain potentiel</p>
                      <p className="font-bold text-green-400">{ticket.potential_win?.toLocaleString()} HTG</p>
                    </div>
                    {ticket.status === 'won' && ticket.actual_win > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Gain réel</p>
                        <p className="font-bold text-emerald-400">{ticket.actual_win?.toLocaleString()} HTG</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-slate-700">
            <Ticket className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-xl font-bold text-white mb-2">Aucun ticket trouvé</h3>
            <p className="text-slate-400 mb-6">
              {filter === 'all' 
                ? "Vous n'avez pas encore placé de pari"
                : `Aucun ticket avec le statut "${filter}"`
              }
            </p>
            <Link
              to="/lotopam/play"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-slate-900 font-bold rounded-xl hover:shadow-xl transition-all"
            >
              Placer mon Premier Pari
            </Link>
          </div>
        )}
      </div>
    </LotoPamLayout>
  );
};

export default LotoPamMyTicketsPage;
