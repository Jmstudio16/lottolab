import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { toast } from 'sonner';
import { Trophy, Calendar, RefreshCw, Search } from 'lucide-react';

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

// Number box component
const NumberBox = ({ number, position }) => {
  const colors = ['bg-emerald-500', 'bg-amber-400', 'bg-blue-500'];
  return (
    <div className={`${colors[position] || 'bg-slate-500'} w-11 h-13 sm:w-14 sm:h-16 flex items-center justify-center rounded-lg shadow-lg transform hover:scale-105 transition-transform`}>
      <span className="text-white font-bold text-lg sm:text-xl drop-shadow">{number}</span>
    </div>
  );
};

// Lottery result card
const LotteryResultCard = ({ result }) => {
  const { flag, color } = getLotteryInfo(result.lottery_name);
  const numbers = parseWinningNumbers(result.winning_numbers);
  const drawTime = result.draw_time || result.draw_name || 'Tirage';
  const drawDate = result.draw_date;
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr === today) return "Aujourd'hui";
    if (dateStr === yesterday) return "Hier";
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };
  
  return (
    <div className="bg-slate-800/50 rounded-xl shadow-lg overflow-hidden border border-slate-700 hover:border-amber-500/50 transition-all duration-300">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-14 h-14 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center text-2xl shadow-md`}>
            {flag}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-sm truncate">{result.lottery_name}</h3>
            <p className="text-xs text-slate-400">
              {formatDate(drawDate)} • {drawTime}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2 justify-center">
          {numbers.map((num, idx) => (
            <NumberBox key={idx} number={num} position={idx} />
          ))}
        </div>
      </div>
    </div>
  );
};

// READ-ONLY Results page for Company Admin
export const CompanyResultsPage = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchResults();
  }, [filterDate]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (filterDate) params.draw_date = filterDate;
      const res = await apiClient.get('/company/results', { params });
      setResults(res.data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des résultats');
    } finally {
      setLoading(false);
    }
  };

  // Filter results
  const filteredResults = results.filter(r => 
    !searchTerm || 
    r.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase())
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
    <AdminLayout title="Résultats Officiels" subtitle="Résultats des tirages publiés par le Super Admin" role="COMPANY_ADMIN">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Derniers Résultats</h1>
                <p className="text-sm text-slate-400">{results.length} résultats disponibles</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500 w-48"
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              {filterDate && (
                <button
                  onClick={() => setFilterDate('')}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white text-sm"
                >
                  Effacer
                </button>
              )}
              <button
                onClick={fetchResults}
                disabled={loading}
                className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading && results.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-12 h-12 text-amber-500 animate-spin" />
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700">
            <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Aucun résultat disponible</p>
          </div>
        ) : (
          sortedDates.map(date => (
            <div key={date} className="space-y-4">
              <h2 className="text-lg font-bold text-slate-300 flex items-center gap-2 capitalize">
                <Calendar className="w-5 h-5 text-amber-500" />
                {formatDateHeader(date)}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {groupedResults[date].map((result, idx) => (
                  <LotteryResultCard key={result.result_id || idx} result={result} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  );
};
