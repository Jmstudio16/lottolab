import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import { 
  Search, 
  Ticket, 
  Copy, 
  Calendar,
  RefreshCw,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AgentSearchTicketsPage = () => {
  const { syncData } = useOutletContext();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lotteryFilter, setLotteryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const lotteries = syncData?.enabled_lotteries || syncData?.lotteries || [];

  const fetchTickets = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/agent/tickets?limit=200`;
      
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
  }, [token]);

  const filteredTickets = tickets.filter(ticket => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchSearch = 
        ticket.ticket_code?.toLowerCase().includes(search) ||
        ticket.verification_code?.toLowerCase().includes(search) ||
        ticket.lottery_name?.toLowerCase().includes(search) ||
        ticket.plays?.some(p => p.numbers?.includes(search));
      if (!matchSearch) return false;
    }
    
    // Lottery filter
    if (lotteryFilter !== 'all' && ticket.lottery_id !== lotteryFilter) {
      return false;
    }
    
    // Date filter
    if (dateFilter && ticket.draw_date !== dateFilter) {
      return false;
    }
    
    return true;
  });

  const handleDuplicate = (ticket) => {
    // Store ticket data for duplication
    sessionStorage.setItem('duplicateTicket', JSON.stringify({
      lottery_id: ticket.lottery_id,
      draw_name: ticket.draw_name,
      plays: ticket.plays
    }));
    toast.success('Ticket copié! Redirection vers Nouvelle Vente...');
    navigate('/agent/pos?duplicate=true');
  };

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

  return (
    <div className="space-y-6" data-testid="search-tickets-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Rechercher mes Fiches</h1>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input
                type="text"
                placeholder="Rechercher par code, numéros, loterie..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-700 border-slate-600 text-white"
              />
            </div>
            
            <div>
              <Select value={lotteryFilter} onValueChange={setLotteryFilter}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Loterie" />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="all" className="text-white">Toutes les loteries</SelectItem>
                  {lotteries.map(l => (
                    <SelectItem key={l.lottery_id} value={l.lottery_id} className="text-white">
                      {l.lottery_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
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
          <p className="text-sm text-slate-400">{filteredTickets.length} ticket(s) trouvé(s)</p>
          
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
                          {new Date(ticket.created_at).toLocaleDateString('fr-FR')}
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

                  {/* Duplicate Button */}
                  <div>
                    <Button
                      onClick={() => handleDuplicate(ticket)}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white"
                      data-testid={`duplicate-${ticket.ticket_id}`}
                    >
                      <Copy size={16} className="mr-2" />
                      Dupliquer / Revendre
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentSearchTicketsPage;
