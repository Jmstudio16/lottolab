import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LotoPamLayout from '../../layouts/LotoPamLayout';
import { 
  Trophy, Clock, Calendar, RefreshCw, Search, 
  Filter, Loader2, ArrowLeft, ArrowRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';

const LotoPamResultsPage = () => {
  const { t } = useTranslation();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/online/results?limit=100`);
      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Failed to load results:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredResults = results.filter(result => {
    const matchesSearch = !search || 
      result.lottery_name?.toLowerCase().includes(search.toLowerCase()) ||
      result.state_code?.toLowerCase().includes(search.toLowerCase());
    
    const matchesDate = !selectedDate || 
      result.draw_date?.startsWith(selectedDate) ||
      result.created_at?.startsWith(selectedDate);
    
    return matchesSearch && matchesDate;
  });

  // Group results by date
  const groupedResults = filteredResults.reduce((groups, result) => {
    const date = (result.draw_date || result.created_at || '').split('T')[0];
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(result);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedResults).sort((a, b) => new Date(b) - new Date(a));

  return (
    <LotoPamLayout>
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
          <h1 className="text-4xl font-bold text-white mb-2">{t('results.latestResults')}</h1>
          <p className="text-slate-400">Consultez les derniers résultats de toutes les loteries</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-8 p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-900 border-slate-600 text-white"
              placeholder="Rechercher une loterie..."
            />
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-slate-400" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-900 border-slate-600 text-white"
            />
          </div>
          <button
            onClick={() => {
              setSearch('');
              setSelectedDate('');
            }}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            Effacer
          </button>
          <button
            onClick={loadResults}
            className="p-2 bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-yellow-400 mx-auto" />
          </div>
        ) : sortedDates.length > 0 ? (
          <div className="space-y-8">
            {sortedDates.map((date) => (
              <div key={date}>
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="w-5 h-5 text-yellow-400" />
                  <h2 className="text-xl font-bold text-white">
                    {new Date(date).toLocaleDateString('fr-FR', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </h2>
                  <span className="px-3 py-1 bg-slate-700 rounded-full text-sm text-slate-300">
                    {groupedResults[date].length} résultat(s)
                  </span>
                </div>

                {/* Results Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedResults[date].map((result, index) => {
                    // Parse winning_numbers - could be string, array, or object
                    let numbers = [];
                    if (Array.isArray(result.winning_numbers)) {
                      numbers = result.winning_numbers;
                    } else if (typeof result.winning_numbers === 'string') {
                      numbers = result.winning_numbers.split(/[-,\s]+/).filter(n => n.trim());
                    } else if (result.winning_numbers_parsed) {
                      numbers = Object.values(result.winning_numbers_parsed);
                    }
                    
                    return (
                      <div
                        key={result.result_id || index}
                        className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-yellow-500/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="font-bold text-white">{result.lottery_name}</h3>
                            <p className="text-sm text-slate-400">{result.state_code}</p>
                          </div>
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs font-medium rounded">
                            {result.draw_type}
                          </span>
                        </div>

                        {/* Winning Numbers */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {numbers.slice(0, 6).map((num, i) => (
                            <div
                              key={i}
                              className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-slate-900 font-bold text-lg shadow-lg shadow-yellow-500/20"
                            >
                              {num}
                            </div>
                          ))}
                          {numbers.length === 0 && (
                            <span className="text-slate-500">Numéros non disponibles</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-4 h-4" />
                            {result.draw_time || '--:--'}
                          </span>
                          {result.created_at && (
                            <span className="text-slate-500">
                              {new Date(result.created_at).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-slate-700">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-xl font-bold text-white mb-2">Aucun résultat trouvé</h3>
            <p className="text-slate-400">
              {search || selectedDate 
                ? "Modifiez vos critères de recherche"
                : "Les résultats seront disponibles après les tirages"
              }
            </p>
          </div>
        )}
      </div>
    </LotoPamLayout>
  );
};

export default LotoPamResultsPage;
