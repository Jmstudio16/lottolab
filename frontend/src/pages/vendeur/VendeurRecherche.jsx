import { API_URL } from '@/config/api';
import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Search, RefreshCw, Filter, Calendar, Ticket
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';


const VendeurRecherche = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [searchParams, setSearchParams] = useState({
    ticketNumber: '',
    numberPlayed: '',
    lotteryId: '',
    dateStart: '',
    dateEnd: '',
    status: ''
  });
  const [lotteries, setLotteries] = useState([]);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    // Load lotteries for dropdown
    const loadLotteries = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/device/config`, { headers });
        setLotteries(res.data.enabled_lotteries || []);
      } catch (e) {}
    };
    loadLotteries();
  }, []);

  const search = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/vendeur/mes-tickets`, { headers });
      let tickets = res.data || [];

      // Filter locally
      if (searchParams.ticketNumber) {
        tickets = tickets.filter(t => 
          t.ticket_code?.toLowerCase().includes(searchParams.ticketNumber.toLowerCase()) ||
          t.ticket_id?.toLowerCase().includes(searchParams.ticketNumber.toLowerCase())
        );
      }
      if (searchParams.numberPlayed) {
        tickets = tickets.filter(t => 
          t.plays?.some(p => p.numbers?.includes(searchParams.numberPlayed))
        );
      }
      if (searchParams.lotteryId) {
        tickets = tickets.filter(t => t.lottery_id === searchParams.lotteryId);
      }
      if (searchParams.dateStart) {
        tickets = tickets.filter(t => t.created_at >= searchParams.dateStart);
      }
      if (searchParams.dateEnd) {
        tickets = tickets.filter(t => t.created_at <= searchParams.dateEnd + 'T23:59:59');
      }
      if (searchParams.status) {
        tickets = tickets.filter(t => t.status === searchParams.status);
      }

      setResults(tickets);
      toast.success(`${tickets.length} résultat(s) trouvé(s)`);
    } catch (error) {
      toast.error('Erreur lors de la recherche');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSearchParams({
      ticketNumber: '',
      numberPlayed: '',
      lotteryId: '',
      dateStart: '',
      dateEnd: '',
      status: ''
    });
    setResults([]);
  };

  return (
    <div className="p-6 pb-24 lg:pb-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Search className="w-7 h-7 text-blue-400" />
          Recherche Fiches
        </h1>
        <p className="text-slate-400">Recherchez vos tickets par critères</p>
      </div>

      {/* Search Form */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Numéro de ticket</label>
            <Input
              value={searchParams.ticketNumber}
              onChange={(e) => setSearchParams({...searchParams, ticketNumber: e.target.value})}
              placeholder="Ex: TKT-240306..."
              className="bg-slate-700 border-slate-600"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Numéro joué</label>
            <Input
              value={searchParams.numberPlayed}
              onChange={(e) => setSearchParams({...searchParams, numberPlayed: e.target.value})}
              placeholder="Ex: 123"
              className="bg-slate-700 border-slate-600"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Loterie</label>
            <select
              value={searchParams.lotteryId}
              onChange={(e) => setSearchParams({...searchParams, lotteryId: e.target.value})}
              className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-white"
            >
              <option value="">Toutes les loteries</option>
              {lotteries.map(l => (
                <option key={l.lottery_id} value={l.lottery_id}>{l.lottery_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Statut</label>
            <select
              value={searchParams.status}
              onChange={(e) => setSearchParams({...searchParams, status: e.target.value})}
              className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-white"
            >
              <option value="">Tous les statuts</option>
              <option value="PENDING">En attente</option>
              <option value="WINNER">Gagnant</option>
              <option value="LOST">Perdu</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Date début</label>
            <Input
              type="date"
              value={searchParams.dateStart}
              onChange={(e) => setSearchParams({...searchParams, dateStart: e.target.value})}
              className="bg-slate-700 border-slate-600"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Date fin</label>
            <Input
              type="date"
              value={searchParams.dateEnd}
              onChange={(e) => setSearchParams({...searchParams, dateEnd: e.target.value})}
              className="bg-slate-700 border-slate-600"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={search} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            Rechercher
          </Button>
          <Button onClick={reset} variant="outline" className="border-slate-600">
            Réinitialiser
          </Button>
        </div>
      </div>

      {/* Results */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-white mb-4">
          Résultats ({results.length})
        </h3>
        
        {results.length === 0 ? (
          <p className="text-slate-400 text-center py-8">Aucun résultat. Lancez une recherche.</p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {results.map((ticket, idx) => (
              <div key={ticket.ticket_id || idx} className="p-3 bg-slate-700/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono font-semibold text-white">{ticket.ticket_code}</p>
                    <p className="text-sm text-slate-400">{ticket.lottery_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">{ticket.total_amount?.toLocaleString()} HTG</p>
                    <span className={`text-xs ${
                      ticket.status === 'WINNER' ? 'text-amber-400' :
                      ticket.status === 'LOST' ? 'text-red-400' :
                      'text-blue-400'
                    }`}>
                      {ticket.status === 'WINNER' ? 'Gagnant' : 
                       ticket.status === 'LOST' ? 'Perdu' : 'En attente'}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {ticket.plays?.map((play, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-600/50 rounded text-xs text-slate-300">
                      {play.numbers} ({play.bet_type})
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendeurRecherche;
