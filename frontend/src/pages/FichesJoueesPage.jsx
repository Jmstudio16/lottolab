import { API_URL } from '@/config/api';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Ticket, Search, RefreshCw, Calendar, Eye, Printer,
  CheckCircle, XCircle, Clock, Filter
} from 'lucide-react';
import { toast } from 'sonner';

const FichesJoueesPage = () => {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [searchCode, setSearchCode] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, active: 0, deleted: 0, winners: 0 });

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchTickets();
  }, [dateFilter, statusFilter]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/company/admin/fiches-jouees?period=${dateFilter}&status=${statusFilter}`, 
        { headers }
      );
      setTickets(res.data.tickets || []);
      setStats(res.data.stats || { total: 0, active: 0, deleted: 0, winners: 0 });
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setTickets([]);
    }
    setLoading(false);
  };

  const searchTicket = async () => {
    if (!searchCode.trim()) {
      toast.error('Entrez un code de ticket');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/company/admin/fiches-jouees/search?code=${searchCode}`, 
        { headers }
      );
      if (res.data) {
        setTickets([res.data]);
      } else {
        toast.error('Ticket non trouvé');
      }
    } catch (error) {
      toast.error('Ticket non trouvé');
    }
    setLoading(false);
  };

  const getStatusBadge = (ticket) => {
    if (ticket.deleted) {
      return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">Supprimé</span>;
    }
    if (ticket.is_winner) {
      return <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs">Gagnant</span>;
    }
    if (ticket.is_paid) {
      return <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">Payé</span>;
    }
    return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">Actif</span>;
  };

  const dateFilters = [
    { value: 'today', label: "Aujourd'hui" },
    { value: 'week', label: 'Cette semaine' },
    { value: 'month', label: 'Ce mois' },
    { value: 'all', label: 'Tout' }
  ];

  const statusFilters = [
    { value: 'all', label: 'Tous' },
    { value: 'active', label: 'Actifs' },
    { value: 'deleted', label: 'Supprimés' },
    { value: 'winner', label: 'Gagnants' }
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Ticket className="w-6 h-6 text-blue-400" />
            Fiches Jouées
          </h1>
          <p className="text-slate-400 text-sm">Voir tous les tickets imprimés par les vendeurs</p>
        </div>
        <Button onClick={fetchTickets} variant="outline" size="sm" className="border-slate-700">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Search */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Input
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="Rechercher par code ticket..."
              className="bg-slate-900 border-slate-700"
              onKeyPress={(e) => e.key === 'Enter' && searchTicket()}
            />
            <Button onClick={searchTicket} className="bg-blue-600 hover:bg-blue-700">
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-slate-400 text-xs">Total Fiches</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{stats.active}</p>
            <p className="text-slate-400 text-xs">Actifs</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{stats.deleted}</p>
            <p className="text-slate-400 text-xs">Supprimés</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{stats.winners}</p>
            <p className="text-slate-400 text-xs">Gagnants</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          {dateFilters.map(filter => (
            <Button
              key={filter.value}
              onClick={() => setDateFilter(filter.value)}
              variant={dateFilter === filter.value ? 'default' : 'outline'}
              className={dateFilter === filter.value ? 'bg-blue-600' : 'border-slate-700'}
              size="sm"
            >
              {filter.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          {statusFilters.map(filter => (
            <Button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              variant={statusFilter === filter.value ? 'default' : 'outline'}
              className={statusFilter === filter.value ? 'bg-emerald-600' : 'border-slate-700'}
              size="sm"
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Tickets List */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">Liste des Fiches</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              <Ticket className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucune fiche trouvée</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {tickets.map((ticket, index) => (
                <div
                  key={ticket.ticket_id || index}
                  className="p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-mono font-bold text-white">{ticket.ticket_code || ticket.ticket_id?.slice(0, 12)}</p>
                      <p className="text-xs text-slate-400">{ticket.lottery_name}</p>
                    </div>
                    {getStatusBadge(ticket)}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Vendeur:</span>
                      <span className="text-white ml-1">{ticket.agent_name || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Montant:</span>
                      <span className="text-emerald-400 ml-1 font-bold">{ticket.total_amount || 0} HTG</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Date:</span>
                      <span className="text-white ml-1">{new Date(ticket.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Heure:</span>
                      <span className="text-white ml-1">{new Date(ticket.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Plays */}
                  {ticket.plays && ticket.plays.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-700">
                      <p className="text-xs text-slate-500 mb-1">Numéros joués:</p>
                      <div className="flex flex-wrap gap-1">
                        {ticket.plays.map((play, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-700 rounded text-xs font-mono">
                            {play.numbers} ({play.amount} HTG)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FichesJoueesPage;
