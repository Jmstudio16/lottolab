import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/api/auth';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  Ticket, Clock, Trophy, XCircle, CheckCircle,
  Loader2, RefreshCw, User, Calendar, Filter
} from 'lucide-react';

const SuperOnlineTicketsPage = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [total, setTotal] = useState(0);
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    loadTickets();
  }, [statusFilter]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter) params.append('status', statusFilter);

      const response = await fetch(`${API_URL}/api/online-admin/tickets?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setTickets(data.tickets || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to load tickets:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { icon: Clock, color: 'yellow', text: 'En attente' },
      won: { icon: Trophy, color: 'green', text: 'Gagnant' },
      lost: { icon: XCircle, color: 'red', text: 'Perdu' },
      paid: { icon: CheckCircle, color: 'emerald', text: 'Payé' }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-${badge.color}-500/20 text-${badge.color}-400`}>
        <badge.icon className="w-3 h-3" />
        {badge.text}
      </span>
    );
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Ticket className="w-6 h-6 text-purple-400" />
              {t('admin.onlineTickets')}
            </h1>
            <p className="text-slate-400">Tous les tickets de la plateforme LOTO PAM</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-medium">
              {total} tickets
            </span>
            <button
              onClick={loadTickets}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
          <Filter className="w-5 h-5 text-slate-400" />
          {[
            { value: '', label: 'Tous' },
            { value: 'pending', label: 'En attente' },
            { value: 'won', label: 'Gagnants' },
            { value: 'lost', label: 'Perdus' },
            { value: 'paid', label: 'Payés' }
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilter === f.value
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                  : 'bg-slate-700/50 text-slate-300 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Tickets Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
          </div>
        ) : tickets.length > 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Ticket ID</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Joueur</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Loterie</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Numéros</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Mise</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-400">Statut</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {tickets.map((ticket) => (
                    <tr key={ticket.ticket_id} className="hover:bg-slate-700/30">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-slate-400">
                          {ticket.ticket_id?.slice(0, 12)}...
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="text-white">{ticket.player?.username || ticket.player?.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-white">{ticket.game_name}</p>
                          <p className="text-xs text-slate-400">{ticket.draw_type}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(ticket.plays || []).slice(0, 3).map((play, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-mono rounded"
                            >
                              {play.number}
                            </span>
                          ))}
                          {ticket.plays?.length > 3 && (
                            <span className="text-xs text-slate-400">+{ticket.plays.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium text-white">{ticket.total_amount?.toLocaleString()} HTG</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(ticket.status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-slate-400">
                          {new Date(ticket.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700">
            <Ticket className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-xl font-bold text-white mb-2">Aucun ticket trouvé</h3>
            <p className="text-slate-400">
              {statusFilter ? `Aucun ticket avec le statut "${statusFilter}"` : 'Aucun ticket n\'a été créé'}
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default SuperOnlineTicketsPage;
