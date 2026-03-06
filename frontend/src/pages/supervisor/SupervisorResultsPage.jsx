import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Trophy, RefreshCw, Calendar, Search, Clock,
  CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Format winning numbers
const formatWinningNumbers = (wn) => {
  if (!wn) return '-';
  if (typeof wn === 'object') {
    const nums = [];
    if (wn.first) nums.push(wn.first);
    if (wn.second) nums.push(wn.second);
    if (wn.third) nums.push(wn.third);
    if (wn.bonus) nums.push(`(${wn.bonus})`);
    return nums.join(' - ');
  }
  if (Array.isArray(wn)) {
    return wn.join(' - ');
  }
  return String(wn);
};

export const SupervisorResultsPage = () => {
  const { token } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchResults = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/supervisor/results?limit=100`, { headers });
      setResults(res.data || []);
    } catch (error) {
      console.error('Error fetching results:', error);
      // Try fallback to company results
      try {
        const fallback = await axios.get(`${API_URL}/api/results?limit=100`, { headers });
        setResults(fallback.data || []);
      } catch (e) {
        toast.error('Erreur lors du chargement des résultats');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [token]);

  const filteredResults = results.filter(r =>
    r.lottery_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.draw_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.state_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group results by date
  const groupedByDate = filteredResults.reduce((acc, result) => {
    const date = result.draw_date || result.created_at?.split('T')[0] || 'Inconnu';
    if (!acc[date]) acc[date] = [];
    acc[date].push(result);
    return acc;
  }, {});

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="supervisor-results-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400" />
            Résultats des Tirages
          </h1>
          <p className="text-sm text-slate-400">Consultation des résultats (lecture seule)</p>
        </div>
        <Button onClick={fetchResults} variant="outline" className="border-slate-700 w-fit">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-blue-300 font-medium">Mode Lecture Seule</p>
            <p className="text-xs text-blue-300/70 mt-1">
              Seul le Super Admin peut ajouter ou modifier les résultats des tirages.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          placeholder="Rechercher une loterie..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-slate-800 border-slate-700 text-white"
        />
      </div>

      {/* Results by Date */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : Object.keys(groupedByDate).length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Trophy className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Aucun résultat disponible</p>
          <p className="text-sm mt-2">Les résultats apparaîtront ici après les tirages</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, dateResults]) => (
              <div key={date} className="space-y-3">
                {/* Date Header */}
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  <h2 className="text-lg font-semibold text-white">{formatDate(date)}</h2>
                  <span className="text-sm text-slate-400">({dateResults.length} résultat{dateResults.length > 1 ? 's' : ''})</span>
                </div>

                {/* Results Grid */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {dateResults.map((result, idx) => (
                    <div
                      key={result.result_id || idx}
                      className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-amber-500/30 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-white truncate">{result.lottery_name}</h3>
                          <p className="text-xs text-slate-400">{result.draw_name || result.state_code}</p>
                        </div>
                        {result.status === 'PUBLISHED' || result.is_official ? (
                          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Clock className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        )}
                      </div>

                      {/* Winning Numbers */}
                      <div className="bg-gradient-to-r from-amber-500/20 to-amber-600/10 rounded-lg p-3 mb-3">
                        <p className="text-xs text-amber-300 mb-1">Numéros Gagnants</p>
                        <p className="text-xl sm:text-2xl font-bold font-mono text-amber-400">
                          {formatWinningNumbers(result.winning_numbers)}
                        </p>
                      </div>

                      {/* Time */}
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Clock className="w-4 h-4" />
                        <span>Tirage: {result.draw_time || formatTime(result.created_at) || '-'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default SupervisorResultsPage;
