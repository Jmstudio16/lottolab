import { API_URL } from '@/config/api';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/api/auth';
import CompanyLayout from '@/components/CompanyLayout';
import { 
  Trash2, Search, RefreshCw, Calendar, User, 
  Building, DollarSign, Clock, FileText, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';


const CompanyDeletedTicketsPage = () => {
  const { token } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState({ total_count: 0, total_amount: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchDeletedTickets();
  }, []);

  const fetchDeletedTickets = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/company/deleted-tickets`, { headers });
      setTickets(response.data.tickets || []);
      setSummary(response.data.summary || { total_count: 0, total_amount: 0 });
    } catch (error) {
      console.error('Error fetching deleted tickets:', error);
      toast.error('Erreur lors du chargement des tickets supprimés');
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = !searchQuery || 
      t.ticket_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.agent_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.succursale_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDate = !dateFilter || 
      t.voided_at?.startsWith(dateFilter) ||
      t.created_at?.startsWith(dateFilter);
    
    return matchesSearch && matchesDate;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <CompanyLayout>
      <div className="p-6 space-y-6" data-testid="deleted-tickets-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Trash2 className="w-7 h-7 text-red-400" />
              Fiche Supprimée
            </h1>
            <p className="text-slate-400 mt-1">Audit des tickets supprimés par les vendeurs</p>
          </div>
          <button
            onClick={fetchDeletedTickets}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-red-600/20 to-red-500/10 border border-red-500/30 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-red-400 text-sm">Tickets Supprimés</p>
                <p className="text-2xl font-bold text-white">{summary.total_count}</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-amber-600/20 to-amber-500/10 border border-amber-500/30 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-amber-400 text-sm">Montant Total</p>
                <p className="text-2xl font-bold text-white">{summary.total_amount?.toLocaleString() || 0} HTG</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par code, vendeur ou succursale..."
              className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              data-testid="search-input"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
          </div>
        </div>

        {/* Tickets Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/30 rounded-xl border border-slate-800">
            <FileText className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <p className="text-slate-400">Aucun ticket supprimé trouvé</p>
          </div>
        ) : (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800/50 border-b border-slate-700">
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Code Ticket</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Vendeur</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Succursale</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Numéros</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Montant</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Supprimé le</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Raison</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr 
                      key={ticket.ticket_id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <span className="font-mono font-bold text-white">{ticket.ticket_code}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-500" />
                          <span className="text-slate-300">{ticket.agent_name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-slate-500" />
                          <span className="text-slate-300">{ticket.succursale_name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-1 flex-wrap">
                          {ticket.plays?.map((play, idx) => (
                            <span key={idx} className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-sm font-mono">
                              {play.numbers}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-red-400 font-semibold">{ticket.total_amount?.toLocaleString() || 0} HTG</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                          <Clock className="w-4 h-4" />
                          {formatDate(ticket.voided_at || ticket.updated_at)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-slate-400 text-sm">
                          {ticket.void_reason || 'Supprimé par vendeur'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Warning Note */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 font-medium">Note de sécurité</p>
            <p className="text-amber-300/70 text-sm">
              Les vendeurs ne peuvent supprimer un ticket que dans les 5 minutes suivant la vente. 
              Après ce délai, seuls les superviseurs et administrateurs peuvent effectuer cette action.
            </p>
          </div>
        </div>
      </div>
    </CompanyLayout>
  );
};

export default CompanyDeletedTicketsPage;
