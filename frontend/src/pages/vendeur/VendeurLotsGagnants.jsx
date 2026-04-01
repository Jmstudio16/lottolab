import { API_URL } from '@/config/api';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import { useWebSocketContext, useWebSocketEvent, WSEventType } from '@/context/WebSocketContext';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Trophy, RefreshCw, Search, Calendar, DollarSign, 
  CheckCircle, Clock, Eye, Printer, Filter, Download, Star, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import WinningNumberBadge from '@/components/WinningNumberBadge';
import WinningTicketDetail from '@/components/WinningTicketDetail';


const VendeurLotsGagnants = () => {
  const { token } = useAuth();
  const { isConnected } = useWebSocketContext();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState({ total_count: 0, total_win_amount: 0, paid_count: 0, pending_count: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [highlightedTicketId, setHighlightedTicketId] = useState(null);
  const [newWinnerAnimation, setNewWinnerAnimation] = useState(false);
  // Date filters
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchWinningTickets = useCallback(async () => {
    try {
      setLoading(true);
      let url = `${API_URL}/api/vendeur/winning-tickets`;
      const params = [];
      
      // Add date filter
      if (dateFilter === 'today') {
        const today = new Date().toISOString().split('T')[0];
        params.push(`date_from=${today}`);
        params.push(`date_to=${today}`);
      } else if (dateFilter === 'custom') {
        params.push(`date_from=${startDate}`);
        params.push(`date_to=${endDate}`);
      }
      
      if (params.length > 0) {
        url += '?' + params.join('&');
      }
      
      const res = await axios.get(url, { headers });
      setTickets(res.data.tickets || []);
      setSummary(res.data.summary || { total_count: 0, total_win_amount: 0 });
    } catch (error) {
      toast.error('Erreur lors du chargement des lots gagnants');
    } finally {
      setLoading(false);
    }
  }, [token, dateFilter, startDate, endDate]);

  useEffect(() => {
    fetchWinningTickets();
  }, [token, dateFilter]);

  // WebSocket: Listen for new winners
  useWebSocketEvent(WSEventType.TICKET_WINNER, useCallback((data) => {
    console.log('[WS] New winner detected:', data);
    
    // Trigger animation
    setNewWinnerAnimation(true);
    setTimeout(() => setNewWinnerAnimation(false), 3000);
    
    // Add the new winning ticket to the list
    const newTicket = {
      ticket_id: data.data?.ticket_id,
      ticket_code: data.data?.ticket_code,
      lottery_name: data.data?.lottery_name,
      win_amount: data.data?.win_amount,
      status: 'WINNER',
      created_at: new Date().toISOString(),
      draw_date: new Date().toISOString().split('T')[0]
    };
    
    setTickets(prev => [newTicket, ...prev]);
    setSummary(prev => ({
      ...prev,
      total_count: prev.total_count + 1,
      total_win_amount: prev.total_win_amount + (data.data?.win_amount || 0),
      pending_count: prev.pending_count + 1
    }));
    
    // Highlight the new ticket
    setHighlightedTicketId(data.data?.ticket_id);
    setTimeout(() => setHighlightedTicketId(null), 5000);
  }, []));

  // WebSocket: Listen for ticket paid
  useWebSocketEvent(WSEventType.TICKET_PAID, useCallback((data) => {
    console.log('[WS] Ticket paid:', data);
    
    setTickets(prev => prev.map(t => 
      t.ticket_code === data.data?.ticket_code 
        ? { ...t, status: 'PAID' }
        : t
    ));
    
    setSummary(prev => ({
      ...prev,
      paid_count: prev.paid_count + 1,
      pending_count: Math.max(0, prev.pending_count - 1)
    }));
  }, []));

  // WebSocket: Listen for new results (might create new winners)
  useWebSocketEvent(WSEventType.RESULT_PUBLISHED, useCallback((data) => {
    console.log('[WS] Result published, refreshing winners:', data);
    // Refresh the list to check for new winners
    setTimeout(() => fetchWinningTickets(), 2000);
  }, [fetchWinningTickets]));

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      t.ticket_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'paid' && t.status === 'PAID') ||
      (filterStatus === 'pending' && t.status !== 'PAID');
    return matchesSearch && matchesStatus;
  });

  const printTicket = (ticketId) => {
    window.open(`${API_URL}/api/ticket/print/${ticketId}?token=${token}&format=thermal`, '_blank');
  };

  const exportToExcel = () => {
    window.open(`${API_URL}/api/export/vendeur/winning-tickets?token=${token}`, '_blank');
    toast.success('Téléchargement du fichier Excel en cours...');
  };

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6" data-testid="vendeur-lots-gagnants">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
            <Trophy className={`w-6 h-6 sm:w-7 sm:h-7 text-amber-400 ${newWinnerAnimation ? 'animate-bounce' : ''}`} />
            Lots Gagnants
            {newWinnerAnimation && (
              <span className="text-sm bg-emerald-500 text-white px-2 py-1 rounded-full animate-pulse flex items-center gap-1">
                <Sparkles className="w-4 h-4" />
                Nouveau!
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-400">Vos tickets gagnants</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={exportToExcel} variant="outline" className="border-emerald-700 text-emerald-400 hover:bg-emerald-500/10" data-testid="export-excel-btn">
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button onClick={fetchWinningTickets} variant="outline" className="border-slate-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 transition-all duration-500 ${newWinnerAnimation ? 'ring-2 ring-amber-500 animate-pulse' : ''}`}>
          <p className="text-sm text-amber-400">Total Gagnants</p>
          <p className="text-2xl font-bold text-amber-400">{summary.total_count}</p>
        </div>
        <div className={`bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 transition-all duration-500 ${newWinnerAnimation ? 'ring-2 ring-emerald-500 animate-pulse' : ''}`}>
          <p className="text-sm text-emerald-400">Montant Total</p>
          <p className="text-2xl font-bold text-emerald-400">{summary.total_win_amount?.toLocaleString()} HTG</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-sm text-blue-400">Payés</p>
          <p className="text-2xl font-bold text-blue-400">{summary.paid_count}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
          <p className="text-sm text-purple-400">En Attente</p>
          <p className="text-2xl font-bold text-purple-400">{summary.pending_count}</p>
        </div>
      </div>

      {/* Live indicator */}
      {isConnected && (
        <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          Mise à jour en temps réel - Les nouveaux gagnants apparaîtront automatiquement
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-4">
        {/* Date Filters */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <span className="text-white font-medium">Filtrer par date:</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => setDateFilter('all')}
                variant={dateFilter === 'all' ? 'default' : 'outline'}
                className={dateFilter === 'all' ? 'bg-amber-600' : 'border-slate-700'}
                size="sm"
              >
                Tout
              </Button>
              <Button
                onClick={() => setDateFilter('today')}
                variant={dateFilter === 'today' ? 'default' : 'outline'}
                className={dateFilter === 'today' ? 'bg-blue-600' : 'border-slate-700'}
                size="sm"
              >
                Aujourd'hui
              </Button>
              <Button
                onClick={() => setDateFilter('custom')}
                variant={dateFilter === 'custom' ? 'default' : 'outline'}
                className={dateFilter === 'custom' ? 'bg-purple-600' : 'border-slate-700'}
                size="sm"
              >
                Personnalisé
              </Button>
            </div>
            {dateFilter === 'custom' && (
              <div className="flex gap-2 items-center">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-36 bg-slate-900 border-slate-700 text-white text-sm"
                />
                <span className="text-slate-400">à</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-36 bg-slate-900 border-slate-700 text-white text-sm"
                />
                <Button 
                  onClick={fetchWinningTickets}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Search and Status Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Rechercher par code ticket ou loterie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setFilterStatus('all')}
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            className={filterStatus === 'all' ? 'bg-amber-600' : 'border-slate-700'}
          >
            Tous
          </Button>
          <Button
            onClick={() => setFilterStatus('paid')}
            variant={filterStatus === 'paid' ? 'default' : 'outline'}
            className={filterStatus === 'paid' ? 'bg-emerald-600' : 'border-slate-700'}
          >
            Payés
          </Button>
          <Button
            onClick={() => setFilterStatus('pending')}
            variant={filterStatus === 'pending' ? 'default' : 'outline'}
            className={filterStatus === 'pending' ? 'bg-purple-600' : 'border-slate-700'}
          >
            En Attente
          </Button>
        </div>
      </div>
      </div>

      {/* Tickets List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
          <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Aucun lot gagnant trouvé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map(ticket => (
            <div 
              key={ticket.ticket_id}
              className={`bg-slate-800/50 border rounded-xl p-4 transition-all duration-500 ${
                highlightedTicketId === ticket.ticket_id 
                  ? 'border-emerald-500 ring-2 ring-emerald-500/50 bg-emerald-500/10 animate-pulse' 
                  : 'border-slate-700 hover:border-amber-500/50'
              }`}
              data-testid={`winning-ticket-${ticket.ticket_id}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono font-bold text-amber-400">{ticket.ticket_code}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      ticket.status === 'PAID' || ticket.payment_status === 'PAID'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : ticket.status === 'WINNER'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {ticket.status === 'PAID' || ticket.payment_status === 'PAID' 
                        ? 'Payé' 
                        : ticket.status === 'WINNER' 
                        ? 'Validé - À Payer' 
                        : 'En Attente'}
                    </span>
                    {highlightedTicketId === ticket.ticket_id && (
                      <span className="px-2 py-0.5 rounded text-xs bg-emerald-500 text-white animate-bounce flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Nouveau!
                      </span>
                    )}
                  </div>
                  <p className="text-white font-medium">{ticket.lottery_name}</p>
                  <p className="text-sm text-slate-400">
                    {ticket.draw_date} • {ticket.draw_name || ticket.draw_time}
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Gains</p>
                    <p className={`text-xl font-bold text-emerald-400 ${highlightedTicketId === ticket.ticket_id ? 'animate-bounce' : ''}`}>
                      {ticket.win_amount?.toLocaleString()} HTG
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setSelectedTicket(ticket)}
                      variant="outline"
                      size="sm"
                      className="border-slate-700"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => printTicket(ticket.ticket_id)}
                      variant="outline"
                      size="sm"
                      className="border-slate-700"
                    >
                      <Printer className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Winning Numbers with GLOW Animation */}
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400 animate-spin" />
                  Numéros gagnants:
                </p>
                <div className="flex flex-wrap gap-2">
                  {ticket.winning_plays?.length > 0 ? (
                    ticket.winning_plays.map((wp, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center gap-2 bg-gradient-to-r from-amber-500/30 to-emerald-500/30 border-2 border-amber-400 rounded-lg px-3 py-2 shadow-lg shadow-amber-500/30 animate-pulse"
                        style={{
                          animation: 'glow 1.5s ease-in-out infinite alternate',
                          boxShadow: '0 0 20px rgba(245, 158, 11, 0.5), 0 0 40px rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        <WinningNumberBadge 
                          number={wp.played_number} 
                          position={wp.winning_lot} 
                          animate={true}
                        />
                        <div className="text-xs">
                          <p className="text-amber-400 font-bold text-base">{wp.winning_lot === 1 ? '1er' : wp.winning_lot === 2 ? '2e' : '3e'} Lot</p>
                          <p className="text-emerald-400 font-bold">×{wp.multiplier} = {wp.gain?.toLocaleString()} HTG</p>
                        </div>
                      </div>
                    ))
                  ) : ticket.plays?.filter(p => p.is_winner).length > 0 ? (
                    ticket.plays.filter(p => p.is_winner).map((play, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center gap-2 bg-gradient-to-r from-amber-500/30 to-emerald-500/30 border-2 border-amber-400 rounded-lg px-4 py-3 shadow-lg shadow-amber-500/50"
                        style={{
                          animation: 'glow 1.5s ease-in-out infinite alternate',
                          boxShadow: '0 0 20px rgba(245, 158, 11, 0.5), 0 0 40px rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        <span className="font-mono font-bold text-2xl text-amber-400 animate-bounce">{play.numbers}</span>
                        <span className="text-sm text-emerald-400 font-bold bg-emerald-500/20 px-2 py-1 rounded">GAGNANT!</span>
                      </div>
                    ))
                  ) : (
                    ticket.plays?.map((play, idx) => (
                      <span key={idx} className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded font-mono text-sm">
                        {play.numbers} ({play.bet_type})
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-400" />
              Fiche Gagnante
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-sm text-slate-400">Code Ticket</p>
                <p className="text-xl font-mono font-bold text-amber-400">{selectedTicket.ticket_code}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-slate-400">Loterie</p>
                  <p className="text-white font-medium">{selectedTicket.lottery_name}</p>
                </div>
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-slate-400">Date</p>
                  <p className="text-white">{selectedTicket.draw_date}</p>
                </div>
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-slate-400">Mise</p>
                  <p className="text-white">{selectedTicket.total_amount?.toLocaleString()} HTG</p>
                </div>
                <div className="p-3 bg-emerald-500/20 rounded-lg">
                  <p className="text-sm text-emerald-400">Gains</p>
                  <p className="text-xl font-bold text-emerald-400">{selectedTicket.win_amount?.toLocaleString()} HTG</p>
                </div>
              </div>
              
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-2">Numéros</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTicket.plays?.map((play, idx) => (
                    <span key={idx} className="px-3 py-2 bg-amber-500/20 text-amber-400 rounded font-mono">
                      {play.numbers} - {play.bet_type} ({play.amount} HTG)
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => printTicket(selectedTicket.ticket_id)}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimer
              </Button>
              <Button
                onClick={() => setSelectedTicket(null)}
                variant="outline"
                className="flex-1 border-slate-600"
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendeurLotsGagnants;
