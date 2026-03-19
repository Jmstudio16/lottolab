import { API_URL } from '@/config/api';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Calendar, Clock, RefreshCw, ShoppingCart, Filter, Timer, AlertTriangle,
  CheckCircle, XCircle, Bell
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';


const VendeurTirages = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lotteries, setLotteries] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFlag, setFilterFlag] = useState('all');
  const [currentTime, setCurrentTime] = useState(new Date());

  const headers = { Authorization: `Bearer ${token}` };

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/device/config`, { headers });
      setLotteries(res.data.enabled_lotteries || []);
      setSchedules(res.data.schedules || []);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get draw status with countdown
  // SYNCHRONIZED with VendeurNouvelleVente.jsx - same logic
  const getDrawStatus = (schedule) => {
    const now = currentTime;
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentSec = now.getSeconds();
    const currentTimeMinutes = currentHour * 60 + currentMin;

    const closeTime = schedule.close_time;
    const openTime = schedule.open_time;
    
    // If no close_time defined, lottery is always open (24h mode)
    if (!closeTime) {
      return { 
        status: 'open', 
        text: 'Ouvert 24h', 
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10 border-emerald-500/30',
        canSell: true,
        countdown: 0
      };
    }

    // Parse open time (default: 06:00)
    let openTimeMinutes = 6 * 60;
    if (openTime) {
      const [openHour, openMin] = openTime.split(':').map(Number);
      openTimeMinutes = openHour * 60 + openMin;
    }

    // Parse close time
    const [closeHour, closeMin] = closeTime.split(':').map(Number);
    const closeTimeMinutes = closeHour * 60 + closeMin;
    
    // Before opening
    if (currentTimeMinutes < openTimeMinutes) {
      const diffMins = openTimeMinutes - currentTimeMinutes;
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      const timeStr = hours > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : `${mins}min`;
      return { 
        status: 'not_open', 
        text: `Ouvre dans ${timeStr}`, 
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10 border-blue-500/30',
        canSell: false,
        countdown: diffMins * 60
      };
    }
    
    // After closing
    if (currentTimeMinutes >= closeTimeMinutes) {
      return { 
        status: 'closed', 
        text: 'Fermé', 
        color: 'text-red-400',
        bgColor: 'bg-red-500/10 border-red-500/30',
        canSell: false,
        countdown: 0
      };
    }
    
    // Currently open - calculate time remaining
    const diffMins = closeTimeMinutes - currentTimeMinutes;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (diffMins <= 5) {
      // Less than 5 minutes - show countdown with seconds
      const totalSecs = (diffMins - 1) * 60 + (59 - currentSec);
      const displayMins = Math.floor(totalSecs / 60);
      const displaySecs = totalSecs % 60;
      return { 
        status: 'closing_soon', 
        text: `Ferme dans ${displayMins}:${displaySecs.toString().padStart(2, '0')}`, 
        color: 'text-red-400 animate-pulse',
        bgColor: 'bg-red-500/20 border-red-500/50',
        canSell: true,
        urgent: true,
        countdown: totalSecs
      };
    } else if (diffMins <= 30) {
      const timeStr = hours > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : `${mins}min`;
      return { 
        status: 'closing', 
        text: `Ferme dans ${timeStr}`, 
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10 border-amber-500/30',
        canSell: true,
        countdown: diffMins * 60
      };
    }
    
    // More than 30 mins remaining
    const timeStr = hours > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : `${mins}min`;
    return { 
      status: 'open', 
      text: `Ouvert (${timeStr})`, 
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/30',
      canSell: true,
      countdown: diffMins * 60
    };
  };

  // Build draws list - use lotteries directly with their integrated schedules
  const draws = lotteries.map(lottery => {
    // Each lottery now has its own draw_time, open_time, close_time
    const schedule = {
      lottery_id: lottery.lottery_id,
      open_time: lottery.open_time,
      close_time: lottery.close_time,
      draw_time: lottery.draw_time,
      draw_name: lottery.draw_name
    };
    
    const status = getDrawStatus(schedule);
    return {
      ...schedule,
      lottery_id: lottery.lottery_id,
      lottery_name: lottery.lottery_name,
      state_code: lottery.state_code || '',
      flag_type: lottery.flag_type,
      ...status
    };
  }).filter(Boolean).sort((a, b) => {
    // Sort: urgent first, then open, then not_open, then closed
    const order = { 'closing_soon': 0, 'closing': 1, 'open': 2, 'not_open': 3, 'closed': 4 };
    return (order[a.status] || 5) - (order[b.status] || 5);
  });

  const filteredDraws = draws.filter(draw => {
    // Filter by status
    if (filterStatus === 'open' && !draw.canSell) return false;
    if (filterStatus === 'closed' && draw.canSell) return false;
    
    // Filter by flag
    if (filterFlag === 'haiti' && draw.flag_type !== 'HAITI') return false;
    if (filterFlag === 'usa' && draw.flag_type === 'HAITI') return false;
    
    return true;
  });

  const openCount = draws.filter(d => d.canSell).length;
  const closedCount = draws.filter(d => !d.canSell).length;
  const haitiCount = draws.filter(d => d.flag_type === 'HAITI').length;
  const usaCount = draws.filter(d => d.flag_type !== 'HAITI').length;

  const goToSell = (lotteryId) => {
    navigate('/vendeur/nouvelle-vente');
  };

  return (
    <div className="p-6 pb-24 lg:pb-6 space-y-6">
      {/* Header with time */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Calendar className="w-7 h-7 text-blue-400" />
            Tirages Disponibles
          </h1>
          <p className="text-slate-400">
            {openCount} ouvert(s) • {closedCount} fermé(s)
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Current Time */}
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl border border-slate-700">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-white font-mono text-lg">
              {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <Button onClick={fetchData} variant="outline" className="border-slate-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Status Filters */}
        <Button
          onClick={() => setFilterStatus('all')}
          variant={filterStatus === 'all' ? 'default' : 'outline'}
          size="sm"
          className={filterStatus === 'all' ? 'bg-blue-600' : 'border-slate-700'}
        >
          Tous ({draws.length})
        </Button>
        <Button
          onClick={() => setFilterStatus('open')}
          variant={filterStatus === 'open' ? 'default' : 'outline'}
          size="sm"
          className={filterStatus === 'open' ? 'bg-emerald-600' : 'border-slate-700'}
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          Ouverts ({openCount})
        </Button>
        <Button
          onClick={() => setFilterStatus('closed')}
          variant={filterStatus === 'closed' ? 'default' : 'outline'}
          size="sm"
          className={filterStatus === 'closed' ? 'bg-red-600' : 'border-slate-700'}
        >
          <XCircle className="w-4 h-4 mr-1" />
          Fermés ({closedCount})
        </Button>
        
        {/* Separator */}
        <div className="w-px h-8 bg-slate-700 mx-2 hidden sm:block" />
        
        {/* Flag Filters */}
        <Button
          onClick={() => setFilterFlag('all')}
          variant={filterFlag === 'all' ? 'default' : 'outline'}
          size="sm"
          className={filterFlag === 'all' ? 'bg-purple-600' : 'border-slate-700'}
        >
          Tous Drapeaux
        </Button>
        <Button
          onClick={() => setFilterFlag('haiti')}
          variant={filterFlag === 'haiti' ? 'default' : 'outline'}
          size="sm"
          className={filterFlag === 'haiti' ? 'bg-red-600' : 'border-slate-700'}
        >
          🇭🇹 Haiti ({haitiCount})
        </Button>
        <Button
          onClick={() => setFilterFlag('usa')}
          variant={filterFlag === 'usa' ? 'default' : 'outline'}
          size="sm"
          className={filterFlag === 'usa' ? 'bg-blue-600' : 'border-slate-700'}
        >
          🇺🇸 USA ({usaCount})
        </Button>
      </div>

      {/* Urgent Alert */}
      {draws.some(d => d.urgent) && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex items-center gap-3 animate-pulse">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          <div>
            <p className="text-red-400 font-semibold">Tirages qui ferment bientôt!</p>
            <p className="text-red-300 text-sm">
              {draws.filter(d => d.urgent).map(d => d.lottery_name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Draws List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : filteredDraws.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">
            {filterStatus === 'open' ? 'Aucun tirage ouvert actuellement' :
             filterStatus === 'closed' ? 'Aucun tirage fermé' :
             'Aucun tirage disponible'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDraws.map((draw, idx) => (
            <div
              key={`${draw.schedule_id || draw.lottery_id}_${idx}`}
              className={`border rounded-xl p-4 transition-all ${draw.bgColor}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-white">{draw.lottery_name}</p>
                  <p className="text-xs text-slate-400">{draw.state_code} • {draw.draw_type || draw.draw_name}</p>
                </div>
                {draw.urgent && <Timer className="w-5 h-5 text-red-400 animate-pulse" />}
              </div>

              {/* Status Badge */}
              <div className={`text-sm font-medium mb-3 ${draw.color}`}>
                {draw.text}
              </div>

              {/* Schedule Times */}
              <div className="flex items-center gap-4 text-sm text-slate-400 mb-4">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {draw.open_time || '07:00'} - {draw.close_time || '22:00'}
                </span>
              </div>

              {/* Sell Button */}
              {draw.canSell ? (
                <Button
                  onClick={() => goToSell(draw.lottery_id)}
                  className={`w-full ${draw.urgent ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                  size="sm"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {draw.urgent ? 'Vendre Maintenant!' : 'Vendre'}
                </Button>
              ) : (
                <div className="w-full py-2 text-center text-slate-500 text-sm bg-slate-800/50 rounded-lg">
                  {draw.status === 'not_open' ? 'Pas encore ouvert' : 'Ventes fermées'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VendeurTirages;
