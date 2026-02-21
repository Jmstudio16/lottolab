import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import { 
  Trophy, 
  Search, 
  Calendar,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AgentResultsPage = () => {
  const { syncData } = useOutletContext();
  const { token } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/results/latest?date=${selectedDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
      toast.error('Erreur lors du chargement des résultats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchResults();
    }
  }, [token, selectedDate]);

  // Group results by lottery
  const groupedResults = results.reduce((acc, result) => {
    const key = result.lottery_name;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(result);
    return acc;
  }, {});

  return (
    <div className="space-y-6" data-testid="results-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Résultats des Tirages</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 bg-slate-700 border-slate-600 text-white w-44"
            />
          </div>
          <Button
            onClick={fetchResults}
            variant="outline"
            className="border-slate-600 text-white hover:bg-slate-700"
          >
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Live Results from Sync */}
      {syncData?.results && syncData.results.length > 0 && (
        <Card className="bg-gradient-to-r from-amber-900/30 to-slate-800 border-amber-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-400 flex items-center gap-2">
              <Trophy size={20} />
              Derniers Résultats (Live)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {syncData.results.slice(0, 6).map((result, idx) => (
                <div 
                  key={result.result_id || idx}
                  className="bg-slate-800/50 rounded-lg p-4 border border-amber-700/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{result.lottery_name}</span>
                    <span className="text-xs text-slate-400">{result.draw_name}</span>
                  </div>
                  <div className="text-center py-4">
                    <span className="text-3xl font-mono font-bold text-amber-400 tracking-widest">
                      {result.winning_numbers}
                    </span>
                  </div>
                  <div className="text-center text-xs text-slate-400">
                    {result.draw_date}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Results */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">
            Résultats du {new Date(selectedDate).toLocaleDateString('fr-FR', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long',
              year: 'numeric'
            })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw size={32} className="animate-spin text-emerald-400" />
            </div>
          ) : Object.keys(groupedResults).length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle size={48} className="mx-auto text-slate-500 mb-4" />
              <p className="text-slate-400">Aucun résultat pour cette date</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedResults).map(([lotteryName, lotteryResults]) => (
                <div key={lotteryName} className="border-b border-slate-700 pb-4 last:border-0">
                  <h3 className="text-lg font-semibold text-white mb-3">{lotteryName}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {lotteryResults.map((result, idx) => (
                      <div 
                        key={result.result_id || idx}
                        className="bg-slate-700/50 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="px-2 py-1 bg-slate-600 rounded text-xs text-slate-300">
                            {result.draw_name}
                          </span>
                          <span className="text-xs text-slate-400">
                            {result.state_code || ''}
                          </span>
                        </div>
                        
                        <div className="text-center py-3">
                          <span className="text-2xl font-mono font-bold text-emerald-400 tracking-widest">
                            {result.winning_numbers}
                          </span>
                        </div>

                        {result.winning_numbers_parsed && Object.keys(result.winning_numbers_parsed).length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-600">
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              {result.winning_numbers_parsed.first && (
                                <div>
                                  <p className="text-slate-400">1er</p>
                                  <p className="font-mono font-bold text-amber-400">
                                    {result.winning_numbers_parsed.first}
                                  </p>
                                </div>
                              )}
                              {result.winning_numbers_parsed.second && (
                                <div>
                                  <p className="text-slate-400">2ème</p>
                                  <p className="font-mono font-bold text-slate-300">
                                    {result.winning_numbers_parsed.second}
                                  </p>
                                </div>
                              )}
                              {result.winning_numbers_parsed.third && (
                                <div>
                                  <p className="text-slate-400">3ème</p>
                                  <p className="font-mono font-bold text-slate-400">
                                    {result.winning_numbers_parsed.third}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {result.bonus_number && (
                          <div className="mt-2 text-center">
                            <span className="text-xs text-slate-400">Bonus: </span>
                            <span className="font-mono text-purple-400">{result.bonus_number}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentResultsPage;
