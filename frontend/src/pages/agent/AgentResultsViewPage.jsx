import React, { useState, useEffect, useCallback } from 'react';
import { AgentLayout } from '@/components/AgentLayout';
import apiClient from '@/api/client';
import { toast } from 'sonner';
import { 
  Trophy, RefreshCw, Calendar, Clock, MapPin, Search, Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// US States with lottery info
const US_STATES = [
  { code: 'GA', name: 'Georgia', flag: '🍑' },
  { code: 'FL', name: 'Florida', flag: '🌴' },
  { code: 'NY', name: 'New York', flag: '🗽' },
  { code: 'TX', name: 'Texas', flag: '⭐' },
  { code: 'TN', name: 'Tennessee', flag: '🎸' },
  { code: 'CA', name: 'California', flag: '🌞' },
  { code: 'IL', name: 'Illinois', flag: '🌽' },
  { code: 'PA', name: 'Pennsylvania', flag: '🔔' },
  { code: 'OH', name: 'Ohio', flag: '🏈' },
  { code: 'MI', name: 'Michigan', flag: '🚗' },
  { code: 'NC', name: 'North Carolina', flag: '🐝' },
  { code: 'VA', name: 'Virginia', flag: '🏛️' },
  { code: 'AZ', name: 'Arizona', flag: '🌵' },
  { code: 'MA', name: 'Massachusetts', flag: '📚' },
  { code: 'MD', name: 'Maryland', flag: '🦀' },
  { code: 'IN', name: 'Indiana', flag: '🏎️' },
  { code: 'WA', name: 'Washington', flag: '🍎' },
  { code: 'CO', name: 'Colorado', flag: '⛰️' },
  { code: 'WI', name: 'Wisconsin', flag: '🧀' },
  { code: 'MN', name: 'Minnesota', flag: '❄️' },
  { code: 'MO', name: 'Missouri', flag: '🌉' },
  { code: 'SC', name: 'South Carolina', flag: '🌙' },
  { code: 'AL', name: 'Alabama', flag: '🌺' },
  { code: 'LA', name: 'Louisiana', flag: '⚜️' },
  { code: 'KY', name: 'Kentucky', flag: '🐎' },
  { code: 'OR', name: 'Oregon', flag: '🌲' },
  { code: 'CT', name: 'Connecticut', flag: '🎃' },
  { code: 'IA', name: 'Iowa', flag: '🌾' },
  { code: 'KS', name: 'Kansas', flag: '🌻' },
  { code: 'AR', name: 'Arkansas', flag: '💎' },
  { code: 'MS', name: 'Mississippi', flag: '🛶' },
  { code: 'NV', name: 'Nevada', flag: '🎰' },
  { code: 'NJ', name: 'New Jersey', flag: '🎡' }
];

const DRAW_TYPES = ['Morning', 'Midday', 'Evening', 'Night'];

// Helper to parse winning numbers from either string or object format
const getWinningNumbersArray = (result) => {
  const wn = result.winning_numbers;
  if (!wn) return [];
  
  // If it's an object (from new API)
  if (typeof wn === 'object' && !Array.isArray(wn)) {
    const nums = [];
    if (wn.first) nums.push(wn.first);
    if (wn.second) nums.push(wn.second);
    if (wn.third) nums.push(wn.third);
    if (wn.borlette && wn.borlette !== wn.first) nums.push(wn.borlette);
    return nums;
  }
  
  // If it's a string (from legacy API)
  if (typeof wn === 'string') {
    return wn.split(/[-,\s]+/).filter(n => n.trim());
  }
  
  return [];
};

export const AgentResultsViewPage = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [filterState, setFilterState] = useState('');
  const [filterDraw, setFilterDraw] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchResults = useCallback(async () => {
    try {
      const response = await apiClient.get('/device/results');
      setResults(response.data || []);
      setLastUpdate(new Date());
    } catch (error) {
      // Silent fail for auto-refresh
      if (loading) {
        toast.error('Erreur lors du chargement des résultats');
      }
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Initial load
  useEffect(() => {
    fetchResults();
  }, []);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchResults, 5000);
    return () => clearInterval(interval);
  }, [fetchResults]);

  // Filter results
  const filteredResults = results.filter(r => {
    const matchesSearch = 
      (r.lottery_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.state_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.winning_numbers || '').includes(searchTerm);
    const matchesState = !filterState || r.state_code === filterState;
    const matchesDraw = !filterDraw || r.draw_name === filterDraw;
    return matchesSearch && matchesState && matchesDraw;
  });

  // Group by lottery for display
  const groupedByLottery = filteredResults.reduce((acc, result) => {
    const key = result.lottery_id;
    if (!acc[key]) {
      acc[key] = {
        lottery_name: result.lottery_name,
        state_code: result.state_code,
        draws: []
      };
    }
    acc[key].draws.push(result);
    return acc;
  }, {});

  // Today's date for highlighting
  const today = new Date().toISOString().split('T')[0];

  const getStateInfo = (stateCode) => {
    return US_STATES.find(s => s.code === stateCode) || { flag: '🎱', name: stateCode };
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <AgentLayout>
      <div className="space-y-6" data-testid="agent-results-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
              <Trophy className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Résultats Officiels</h1>
              <p className="text-slate-400 text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Mise à jour automatique
                {lastUpdate && (
                  <span className="text-slate-500">
                    - Dernière: {formatTime(lastUpdate)}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button 
            onClick={fetchResults}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-900 border-slate-600 text-white"
              />
            </div>
            <Select value={filterState} onValueChange={setFilterState}>
              <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Tous les États" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 max-h-[250px]">
                <SelectItem value="all">Tous les États</SelectItem>
                {US_STATES.map(state => (
                  <SelectItem key={state.code} value={state.code}>
                    {state.flag} {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterDraw} onValueChange={setFilterDraw}>
              <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                <Clock className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Tous les tirages" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">Tous les tirages</SelectItem>
                {DRAW_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Grid */}
        {loading && results.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
          </div>
        ) : Object.keys(groupedByLottery).length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
            <Trophy className="w-16 h-16 mx-auto text-slate-500 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Aucun résultat disponible</h3>
            <p className="text-slate-400">Les résultats apparaîtront ici dès leur publication</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.entries(groupedByLottery).map(([lotteryId, data]) => {
              const state = getStateInfo(data.state_code);
              const todayDraws = data.draws.filter(d => d.draw_date === today);
              const otherDraws = data.draws.filter(d => d.draw_date !== today);
              
              return (
                <div 
                  key={lotteryId} 
                  className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden"
                  data-testid={`lottery-results-${lotteryId}`}
                >
                  {/* Lottery Header */}
                  <div className="bg-slate-900/50 px-4 py-3 border-b border-slate-700 flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center text-xl">
                      {state.flag}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{data.lottery_name}</h3>
                      <p className="text-sm text-slate-400">{state.name}</p>
                    </div>
                  </div>

                  {/* Draw Results */}
                  <div className="divide-y divide-slate-700/50">
                    {/* Today's Results First */}
                    {todayDraws.length > 0 && (
                      <div className="bg-amber-500/5">
                        <div className="px-4 py-2 bg-amber-500/10">
                          <span className="text-xs font-medium text-amber-400">AUJOURD'HUI</span>
                        </div>
                        {todayDraws.map(result => (
                          <div key={result.result_id} className="px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                result.draw_name === 'Morning' ? 'bg-orange-500/20 text-orange-400' :
                                result.draw_name === 'Midday' ? 'bg-yellow-500/20 text-yellow-400' :
                                result.draw_name === 'Evening' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-purple-500/20 text-purple-400'
                              }`}>
                                {result.draw_name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {getWinningNumbersArray(result).map((num, idx) => (
                                <div
                                  key={idx}
                                  className={`w-10 h-10 flex items-center justify-center rounded-full font-bold ${
                                    idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black' :
                                    idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-black' :
                                    'bg-gradient-to-br from-amber-600 to-amber-800 text-white'
                                  }`}
                                >
                                  {num}
                                </div>
                              ))}
                              {result.bonus_number && (
                                <div className="w-10 h-10 flex items-center justify-center rounded-full font-bold bg-gradient-to-br from-cyan-400 to-cyan-600 text-black ml-1">
                                  {result.bonus_number}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Other Results */}
                    {otherDraws.slice(0, 3).map(result => (
                      <div key={result.result_id} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            result.draw_name === 'Morning' ? 'bg-orange-500/20 text-orange-400' :
                            result.draw_name === 'Midday' ? 'bg-yellow-500/20 text-yellow-400' :
                            result.draw_name === 'Evening' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-purple-500/20 text-purple-400'
                          }`}>
                            {result.draw_name}
                          </span>
                          <span className="text-xs text-slate-500">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {result.draw_date}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getWinningNumbersArray(result).map((num, idx) => (
                            <div
                              key={idx}
                              className={`w-9 h-9 flex items-center justify-center rounded-full font-bold text-sm ${
                                idx === 0 ? 'bg-amber-500/80 text-black' :
                                idx === 1 ? 'bg-slate-400/80 text-black' :
                                'bg-amber-700/80 text-white'
                              }`}
                            >
                              {num}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AgentLayout>
  );
};

export default AgentResultsViewPage;
