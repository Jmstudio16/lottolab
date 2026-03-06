import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Clock, RefreshCw, Search, Calendar, 
  CheckCircle, XCircle, AlertCircle, Play, Pause
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const SupervisorLotterySchedulesPage = () => {
  const { token } = useAuth();
  const [lotteries, setLotteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchLotteries = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/supervisor/lottery-schedules`, { headers });
      setLotteries(res.data || []);
    } catch (error) {
      console.error('Error fetching lotteries:', error);
      toast.error('Erreur lors du chargement des loteries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLotteries();
  }, [token]);

  const filteredLotteries = lotteries.filter(l =>
    l.lottery_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.state_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by state
  const groupedByState = filteredLotteries.reduce((acc, lottery) => {
    const state = lottery.state_code || 'Autre';
    if (!acc[state]) acc[state] = [];
    acc[state].push(lottery);
    return acc;
  }, {});

  const formatTime = (time) => {
    if (!time) return '-';
    return time;
  };

  const isCurrentlyOpen = (lottery) => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const openTime = lottery.open_time || '09:00';
    const closeTime = lottery.close_time || '20:00';
    return currentTime >= openTime && currentTime <= closeTime;
  };

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="supervisor-lottery-schedules-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <Clock className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" />
            Horaires des Loteries
          </h1>
          <p className="text-sm text-slate-400">Heures d'ouverture et fermeture (lecture seule)</p>
        </div>
        <Button onClick={fetchLotteries} variant="outline" className="border-slate-700 w-fit">
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
              Seul le Super Admin peut modifier les heures de tirage et activer/désactiver les loteries.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-slate-400">Total Loteries</p>
          <p className="text-xl sm:text-2xl font-bold text-white">{lotteries.length}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-emerald-400">Actives</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-400">
            {lotteries.filter(l => l.is_enabled && !l.disabled_by_super_admin).length}
          </p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 sm:p-4 col-span-2 sm:col-span-1">
          <p className="text-xs sm:text-sm text-blue-400">Ouvertes Maintenant</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-400">
            {lotteries.filter(l => l.is_enabled && isCurrentlyOpen(l)).length}
          </p>
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

      {/* Lotteries by State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : Object.keys(groupedByState).length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Clock className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Aucune loterie disponible</p>
          <p className="text-sm mt-2">Les loteries actives apparaîtront ici</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByState)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([state, stateLotteries]) => (
              <div key={state} className="space-y-3">
                {/* State Header */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-400">{state.slice(0, 2)}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-white">{state}</h2>
                  <span className="text-sm text-slate-400">({stateLotteries.length} loterie{stateLotteries.length > 1 ? 's' : ''})</span>
                </div>

                {/* Lotteries Grid */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {stateLotteries.map((lottery, idx) => {
                    const isOpen = isCurrentlyOpen(lottery);
                    const isActive = lottery.is_enabled && !lottery.disabled_by_super_admin;

                    return (
                      <div
                        key={lottery.lottery_id || idx}
                        className={`bg-slate-800/50 border rounded-xl p-4 transition-colors ${
                          !isActive 
                            ? 'border-red-500/30 opacity-60' 
                            : isOpen 
                              ? 'border-emerald-500/30' 
                              : 'border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-white truncate">{lottery.lottery_name}</h3>
                            <p className="text-xs text-slate-400">{lottery.state_code}</p>
                          </div>
                          {isActive ? (
                            isOpen ? (
                              <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 rounded-full">
                                <Play className="w-3 h-3 text-emerald-400" />
                                <span className="text-xs text-emerald-400">Ouvert</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 px-2 py-1 bg-slate-700 rounded-full">
                                <Pause className="w-3 h-3 text-slate-400" />
                                <span className="text-xs text-slate-400">Fermé</span>
                              </div>
                            )
                          ) : (
                            <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 rounded-full">
                              <XCircle className="w-3 h-3 text-red-400" />
                              <span className="text-xs text-red-400">Désactivé</span>
                            </div>
                          )}
                        </div>

                        {/* Schedule */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-emerald-400" />
                              <span className="text-sm text-slate-300">Ouverture</span>
                            </div>
                            <span className="font-mono text-sm text-emerald-400 font-medium">
                              {formatTime(lottery.open_time)}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-400" />
                              <span className="text-sm text-slate-300">Fermeture</span>
                            </div>
                            <span className="font-mono text-sm text-red-400 font-medium">
                              {formatTime(lottery.close_time)}
                            </span>
                          </div>
                        </div>

                        {/* Draw Times */}
                        {lottery.draws && lottery.draws.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-700">
                            <p className="text-xs text-slate-400 mb-2">Tirages</p>
                            <div className="flex flex-wrap gap-2">
                              {lottery.draws.slice(0, 4).map((draw, dIdx) => (
                                <span 
                                  key={dIdx}
                                  className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs"
                                >
                                  {draw.name || draw.draw_time || draw}
                                </span>
                              ))}
                              {lottery.draws.length > 4 && (
                                <span className="px-2 py-1 bg-slate-700 text-slate-400 rounded text-xs">
                                  +{lottery.draws.length - 4}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Draw Times Alternative */}
                        {lottery.draw_times && lottery.draw_times.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-700">
                            <p className="text-xs text-slate-400 mb-2">Heures de Tirage</p>
                            <div className="flex flex-wrap gap-2">
                              {lottery.draw_times.slice(0, 4).map((time, tIdx) => (
                                <span 
                                  key={tIdx}
                                  className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-mono"
                                >
                                  {time}
                                </span>
                              ))}
                              {lottery.draw_times.length > 4 && (
                                <span className="px-2 py-1 bg-slate-700 text-slate-400 rounded text-xs">
                                  +{lottery.draw_times.length - 4}
                                </span>
                              )}
                            </div>
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

export default SupervisorLotterySchedulesPage;
