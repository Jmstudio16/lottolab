import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Trophy, Search, RefreshCw, CheckCircle, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const VendeurResultats = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [ticketToVerify, setTicketToVerify] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/results`, { headers });
      setResults(res.data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const formatWinningNumbers = (wn) => {
    if (!wn) return '-';
    if (typeof wn === 'object') {
      const nums = [];
      if (wn.first) nums.push(wn.first);
      if (wn.second) nums.push(wn.second);
      if (wn.third) nums.push(wn.third);
      return nums;
    }
    if (typeof wn === 'string') {
      return wn.split(/[-,\s]+/).filter(n => n.trim());
    }
    return [];
  };

  const verifyTicket = async () => {
    if (!ticketToVerify) {
      toast.error('Entrez un numéro de ticket');
      return;
    }
    try {
      const res = await axios.get(`${API_URL}/api/verify-ticket/${ticketToVerify}`);
      if (res.data.status === 'WINNER' || res.data.status === 'WON') {
        toast.success(`Ticket GAGNANT! Gain: ${res.data.win_amount?.toLocaleString()} HTG`);
      } else if (res.data.status === 'LOST') {
        toast.error('Ticket perdant');
      } else {
        toast.info('Résultats en attente');
      }
    } catch (error) {
      toast.error('Ticket non trouvé');
    }
  };

  const filteredResults = results.filter(r => 
    r.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.state_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group by date
  const groupedResults = filteredResults.reduce((groups, result) => {
    const date = result.draw_date || 'Inconnu';
    if (!groups[date]) groups[date] = [];
    groups[date].push(result);
    return groups;
  }, {});

  return (
    <div className="p-6 pb-24 lg:pb-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Trophy className="w-7 h-7 text-amber-400" />
            Résultats
          </h1>
          <p className="text-slate-400">Derniers résultats des tirages</p>
        </div>
        <Button onClick={fetchResults} variant="outline" className="border-slate-700">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Quick Verify */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-white mb-3">Vérification Rapide</h3>
        <div className="flex gap-3">
          <Input
            value={ticketToVerify}
            onChange={(e) => setTicketToVerify(e.target.value.toUpperCase())}
            placeholder="Numéro de ticket..."
            className="flex-1 bg-slate-700 border-slate-600"
          />
          <Button onClick={verifyTicket} className="bg-amber-600 hover:bg-amber-700">
            <CheckCircle className="w-4 h-4 mr-2" />
            Vérifier
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher une loterie..."
          className="pl-10 bg-slate-800 border-slate-700"
        />
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : Object.keys(groupedResults).length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
          <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Aucun résultat disponible</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedResults).sort((a, b) => b[0].localeCompare(a[0])).map(([date, dateResults]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-slate-400" />
                <h3 className="text-lg font-semibold text-white">
                  {new Date(date).toLocaleDateString('fr-FR', { 
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
                  })}
                </h3>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dateResults.map((result, idx) => {
                  const numbers = formatWinningNumbers(result.winning_numbers);
                  return (
                    <div
                      key={result.result_id || idx}
                      className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-amber-500/50 transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-white">{result.lottery_name}</p>
                          <p className="text-xs text-slate-400">{result.state_code} • {result.draw_name}</p>
                        </div>
                        <span className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">
                          Publié
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-center gap-2 py-3">
                        {Array.isArray(numbers) ? numbers.map((num, i) => (
                          <div
                            key={i}
                            className={`w-12 h-12 flex items-center justify-center rounded-full font-bold text-lg ${
                              i === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black' :
                              i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-black' :
                              'bg-gradient-to-br from-amber-600 to-amber-800 text-white'
                            }`}
                          >
                            {num}
                          </div>
                        )) : (
                          <span className="text-2xl font-mono text-amber-400">{numbers}</span>
                        )}
                      </div>

                      {result.winners_count > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-700 text-center">
                          <span className="text-sm text-emerald-400">
                            {result.winners_count} gagnant(s) • {result.total_payouts?.toLocaleString()} HTG
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VendeurResultats;
