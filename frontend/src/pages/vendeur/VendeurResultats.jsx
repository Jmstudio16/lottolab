import { API_URL } from '@/config/api';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { Trophy, RefreshCw, Search, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';


// Lottery logo and flag mapping
const getLotteryInfo = (lotteryName) => {
  if (!lotteryName) return { flag: '🎰', color: 'from-purple-500 to-purple-700' };
  const nameLower = lotteryName.toLowerCase();
  
  if (nameLower.includes('ny') || nameLower.includes('new york')) 
    return { flag: '🗽', color: 'from-blue-600 to-blue-800' };
  if (nameLower.includes('florida') || nameLower.includes('fl')) 
    return { flag: '🌴', color: 'from-orange-500 to-orange-700' };
  if (nameLower.includes('georgia') || nameLower.includes('ga')) 
    return { flag: '🍑', color: 'from-red-500 to-red-700' };
  if (nameLower.includes('california') || nameLower.includes('ca')) 
    return { flag: '☀️', color: 'from-yellow-500 to-yellow-600' };
  if (nameLower.includes('texas') || nameLower.includes('tx')) 
    return { flag: '🤠', color: 'from-red-600 to-red-800' };
  if (nameLower.includes('michigan') || nameLower.includes('mi')) 
    return { flag: '🏔️', color: 'from-blue-500 to-green-600' };
  if (nameLower.includes('illinois') || nameLower.includes('il')) 
    return { flag: '🏙️', color: 'from-blue-600 to-blue-700' };
  if (nameLower.includes('pennsylvania') || nameLower.includes('pa')) 
    return { flag: '🔔', color: 'from-blue-700 to-yellow-600' };
  if (nameLower.includes('ohio') || nameLower.includes('oh')) 
    return { flag: '⭐', color: 'from-red-600 to-blue-700' };
  if (nameLower.includes('arkansas') || nameLower.includes('ar')) 
    return { flag: '💎', color: 'from-red-500 to-blue-600' };
  if (nameLower.includes('connecticut') || nameLower.includes('ct')) 
    return { flag: '🌲', color: 'from-blue-600 to-blue-700' };
  
  return { flag: '🎰', color: 'from-purple-500 to-purple-700' };
};

// Parse winning numbers
const parseWinningNumbers = (wn) => {
  if (!wn) return ['--', '--', '--'];
  if (Array.isArray(wn)) {
    const nums = wn.slice(0, 3);
    while (nums.length < 3) nums.push('--');
    return nums;
  }
  if (typeof wn === 'object') {
    return [wn.first || '--', wn.second || '--', wn.third || '--'];
  }
  if (typeof wn === 'string') {
    const nums = wn.split(/[-,\s]+/).filter(n => n.trim());
    while (nums.length < 3) nums.push('--');
    return nums.slice(0, 3);
  }
  return ['--', '--', '--'];
};

// Number box component with animation
const NumberBox = ({ number, position, isNew }) => {
  const colors = ['bg-emerald-500', 'bg-amber-400', 'bg-blue-500'];
  return (
    <div 
      className={`${colors[position] || 'bg-slate-500'} w-11 h-13 sm:w-14 sm:h-16 flex items-center justify-center rounded-lg shadow-lg transform hover:scale-110 transition-all duration-300 ${isNew ? 'animate-bounce' : ''}`}
      style={{ animationDelay: `${position * 100}ms` }}
    >
      <span className="text-white font-bold text-lg sm:text-xl drop-shadow">{number}</span>
    </div>
  );
};

// Lottery result card with animation
const LotteryResultCard = ({ result, index }) => {
  const { flag, color } = getLotteryInfo(result.lottery_name);
  const numbers = parseWinningNumbers(result.winning_numbers);
  const drawTime = result.draw_time || result.draw_name || 'Tirage';
  const drawDate = result.draw_date;
  const isNew = result.is_new || false;
  
  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr === today) return "Aujourd'hui";
    if (dateStr === yesterday) return "Hier";
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };
  
  return (
    <div 
      className={`bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200 hover:shadow-xl transition-all duration-300 hover:border-blue-300 hover:-translate-y-1 ${isNew ? 'ring-2 ring-amber-400 animate-pulse' : ''}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="p-4">
        {/* Header with logo/flag and lottery name */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-14 h-14 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center text-2xl shadow-md transform hover:rotate-12 transition-transform`}>
            {flag}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 text-sm truncate">{result.lottery_name}</h3>
            <p className="text-xs text-slate-500">
              {formatDate(drawDate)} • {drawTime}
            </p>
            {isNew && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 animate-pulse">
                ✨ Nouveau
              </span>
            )}
          </div>
        </div>
        
        {/* Winning numbers with animation */}
        <div className="flex gap-2 justify-center">
          {numbers.map((num, idx) => (
            <NumberBox key={idx} number={num} position={idx} isNew={isNew} />
          ))}
        </div>
      </div>
    </div>
  );
};

const VendeurResultats = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [ticketToVerify, setTicketToVerify] = useState('');
  const [verifyingTicket, setVerifyingTicket] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/results?limit=100`, { headers });
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

  const verifyTicket = async () => {
    if (!ticketToVerify.trim()) return;
    setVerifyingTicket(true);
    try {
      const res = await axios.get(`${API_URL}/api/ticket/verify/${ticketToVerify.trim()}`, { headers });
      if (res.data.status === 'WINNER' || res.data.status === 'WON') {
        toast.success(`🎉 Ticket GAGNANT! Gains: ${res.data.winnings?.toLocaleString()} HTG`);
      } else if (res.data.status === 'LOST' || res.data.status === 'LOSER') {
        toast.info('Ce ticket n\'est pas gagnant');
      } else {
        toast.info(`Statut: ${res.data.status || 'En attente du tirage'}`);
      }
    } catch (error) {
      toast.error('Ticket non trouvé');
    } finally {
      setVerifyingTicket(false);
    }
  };

  // Filter results by search
  const filteredResults = results.filter(r => 
    !searchTerm || 
    r.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.draw_date?.includes(searchTerm)
  );

  // Group by date
  const groupedResults = {};
  filteredResults.forEach(result => {
    const date = result.draw_date || 'unknown';
    if (!groupedResults[date]) groupedResults[date] = [];
    groupedResults[date].push(result);
  });

  const sortedDates = Object.keys(groupedResults).sort((a, b) => b.localeCompare(a));

  const formatDateHeader = (dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr === today) return "Aujourd'hui";
    if (dateStr === yesterday) return "Hier";
    return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Derniers Résultats</h1>
                <p className="text-sm text-slate-500">Résultats officiels des loteries</p>
              </div>
            </div>
            <Button 
              onClick={fetchResults} 
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
          
          {/* Search and Verify */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Rechercher une loterie..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Vérifier un ticket..."
                value={ticketToVerify}
                onChange={(e) => setTicketToVerify(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && verifyTicket()}
              />
              <Button 
                onClick={verifyTicket} 
                disabled={verifyingTicket || !ticketToVerify.trim()}
                className="bg-emerald-500 hover:bg-emerald-600"
              >
                <CheckCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Results grouped by date */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-500">Chargement des résultats...</p>
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
            <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Aucun résultat disponible</p>
          </div>
        ) : (
          sortedDates.map(date => (
            <div key={date} className="space-y-4">
              <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2 capitalize">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                {formatDateHeader(date)}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {groupedResults[date].map((result, idx) => (
                  <LotteryResultCard key={result.result_id || idx} result={result} index={idx} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VendeurResultats;
