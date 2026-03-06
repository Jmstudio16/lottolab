import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Calendar, Clock, RefreshCw, ShoppingCart, Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const VendeurTirages = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lotteries, setLotteries] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');

  const headers = { Authorization: `Bearer ${token}` };

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

  // Get draw status
  const getDrawStatus = (schedule) => {
    const now = new Date();
    if (schedule.close_time) {
      const [closeHour, closeMin] = schedule.close_time.split(':').map(Number);
      const closeTime = new Date();
      closeTime.setHours(closeHour, closeMin, 0, 0);
      
      if (now < closeTime) {
        const diffMs = closeTime - now;
        const diffMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        
        return { 
          status: 'open', 
          text: hours > 0 ? `Ferme dans ${hours}h${mins}m` : `Ferme dans ${mins}min`,
          color: diffMins <= 30 ? 'text-amber-400' : 'text-emerald-400',
          bgColor: diffMins <= 30 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30'
        };
      }
    }
    return { status: 'closed', text: 'Fermé', color: 'text-red-400', bgColor: 'bg-red-500/10 border-red-500/30' };
  };

  // Build draws list
  const draws = schedules.map(schedule => {
    const lottery = lotteries.find(l => l.lottery_id === schedule.lottery_id);
    const status = getDrawStatus(schedule);
    return {
      ...schedule,
      lottery_name: lottery?.lottery_name || schedule.lottery_id,
      state_code: lottery?.state_code || '',
      ...status
    };
  }).sort((a, b) => {
    if (a.status === 'open' && b.status !== 'open') return -1;
    if (a.status !== 'open' && b.status === 'open') return 1;
    return 0;
  });

  const filteredDraws = draws.filter(draw => {
    if (filterStatus === 'open') return draw.status === 'open';
    if (filterStatus === 'closed') return draw.status === 'closed';
    return true;
  });

  const goToSell = (lotteryId) => {
    navigate('/vendeur/nouvelle-vente');
  };

  return (
    <div className="p-6 pb-24 lg:pb-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Calendar className="w-7 h-7 text-blue-400" />
            Tirages Disponibles
          </h1>
          <p className="text-slate-400">{draws.filter(d => d.status === 'open').length} tirage(s) ouvert(s)</p>
        </div>
        <Button onClick={fetchData} variant="outline" className="border-slate-700">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: 'Tous' },
          { value: 'open', label: 'Ouverts' },
          { value: 'closed', label: 'Fermés' }
        ].map(opt => (
          <Button
            key={opt.value}
            onClick={() => setFilterStatus(opt.value)}
            variant={filterStatus === opt.value ? 'default' : 'outline'}
            size="sm"
            className={filterStatus === opt.value ? 'bg-blue-600' : 'border-slate-700'}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Draws List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : filteredDraws.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Aucun tirage disponible</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDraws.slice(0, 50).map((draw, idx) => (
            <div
              key={`${draw.schedule_id || idx}`}
              className={`border rounded-xl p-4 transition-all ${draw.bgColor}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-white">{draw.lottery_name}</p>
                  <p className="text-xs text-slate-400">{draw.state_code} • {draw.draw_type}</p>
                </div>
                <span className={`text-sm font-medium ${draw.color}`}>
                  {draw.text}
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm text-slate-400 mb-4">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {draw.open_time} - {draw.close_time}
                </span>
              </div>

              {draw.status === 'open' && (
                <Button
                  onClick={() => goToSell(draw.lottery_id)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  size="sm"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Vendre
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VendeurTirages;
