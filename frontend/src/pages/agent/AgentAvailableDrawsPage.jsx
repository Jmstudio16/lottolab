import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import { 
  Clock, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AgentAvailableDrawsPage = () => {
  const { syncData } = useOutletContext();
  const { token } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const lotteries = syncData?.enabled_lotteries || syncData?.lotteries || [];
  const config = syncData?.configuration || syncData?.company_config || {};

  useEffect(() => {
    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      // Get schedules from syncData or fetch directly
      const syncSchedules = syncData?.schedules || [];
      
      if (syncSchedules.length > 0) {
        setSchedules(syncSchedules);
      } else {
        // Fallback: fetch directly
        const response = await fetch(`${API_URL}/api/lottery/schedules`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setSchedules(data);
        }
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast.error('Erreur lors du chargement des tirages');
    } finally {
      setLoading(false);
    }
  };

  const parseTime = (timeStr) => {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  };

  const getScheduleStatus = (schedule) => {
    const now = currentTime;
    const openTime = parseTime(schedule.opening_time);
    const closeTime = parseTime(schedule.closing_time);
    const drawTime = parseTime(schedule.draw_time);
    const stopMinutes = config.stop_sales_before_draw_minutes || 5;
    
    if (!closeTime || !drawTime) return { status: 'unknown', label: 'Inconnu', color: 'gray' };
    
    const cutoffTime = new Date(drawTime.getTime() - stopMinutes * 60000);
    
    if (openTime && now < openTime) {
      return { status: 'not_open', label: 'Pas encore ouvert', color: 'blue' };
    }
    
    if (now >= cutoffTime) {
      return { status: 'closed', label: 'FERMÉ', color: 'red' };
    }
    
    return { status: 'open', label: 'ACTIF', color: 'green' };
  };

  const getTimeRemaining = (schedule) => {
    const drawTime = parseTime(schedule.draw_time);
    const closeTime = parseTime(schedule.closing_time);
    const stopMinutes = config.stop_sales_before_draw_minutes || 5;
    
    if (!drawTime && !closeTime) return null;
    
    const targetTime = closeTime || new Date(drawTime.getTime() - stopMinutes * 60000);
    const diff = targetTime - currentTime;
    
    if (diff <= 0) return null;
    
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
  };

  // Group schedules by lottery
  const schedulesByLottery = {};
  const lotteryMap = {};
  lotteries.forEach(l => {
    lotteryMap[l.lottery_id] = l;
  });
  
  schedules.forEach(s => {
    if (!schedulesByLottery[s.lottery_id]) {
      schedulesByLottery[s.lottery_id] = [];
    }
    schedulesByLottery[s.lottery_id].push(s);
  });

  return (
    <div className="space-y-6" data-testid="available-draws-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tirages Disponibles</h1>
          <p className="text-slate-400 text-sm mt-1">
            Heure actuelle: {currentTime.toLocaleTimeString('fr-FR')}
          </p>
        </div>
        <Button
          onClick={fetchSchedules}
          variant="outline"
          className="border-slate-600 text-white hover:bg-slate-700"
        >
          <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          <span className="text-slate-400">Actif</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-slate-400">Fermé</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-slate-400">Pas encore ouvert</span>
        </div>
      </div>

      {/* Schedules Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={32} className="animate-spin text-emerald-400" />
        </div>
      ) : Object.keys(schedulesByLottery).length === 0 ? (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-12 text-center">
            <Calendar size={48} className="mx-auto text-slate-500 mb-4" />
            <p className="text-slate-400">Aucun tirage disponible</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(schedulesByLottery).map(([lotteryId, lotterySchedules]) => {
            const lottery = lotteryMap[lotteryId];
            if (!lottery) return null;
            
            return (
              <Card key={lotteryId} className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white flex items-center gap-2">
                    <span className="text-amber-400">{lottery.lottery_name}</span>
                    <span className="text-sm text-slate-500">({lottery.state_code})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-3 px-4 text-sm text-slate-400">Tirage</th>
                          <th className="text-left py-3 px-4 text-sm text-slate-400">Ouverture</th>
                          <th className="text-left py-3 px-4 text-sm text-slate-400">Fermeture</th>
                          <th className="text-left py-3 px-4 text-sm text-slate-400">Heure Tirage</th>
                          <th className="text-center py-3 px-4 text-sm text-slate-400">Statut</th>
                          <th className="text-right py-3 px-4 text-sm text-slate-400">Temps Restant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lotterySchedules.map((schedule) => {
                          const { status, label, color } = getScheduleStatus(schedule);
                          const timeRemaining = getTimeRemaining(schedule);
                          
                          return (
                            <tr key={schedule.schedule_id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                              <td className="py-3 px-4 text-white font-medium">
                                {schedule.draw_name}
                              </td>
                              <td className="py-3 px-4 text-slate-300">
                                {schedule.opening_time || '--:--'}
                              </td>
                              <td className="py-3 px-4 text-slate-300">
                                {schedule.closing_time || '--:--'}
                              </td>
                              <td className="py-3 px-4 text-slate-300">
                                {schedule.draw_time || '--:--'}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                                  color === 'green' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-600' :
                                  color === 'red' ? 'bg-red-900/50 text-red-400 border border-red-600' :
                                  color === 'blue' ? 'bg-blue-900/50 text-blue-400 border border-blue-600' :
                                  'bg-slate-700 text-slate-400'
                                }`}>
                                  {status === 'open' && <CheckCircle size={12} />}
                                  {status === 'closed' && <XCircle size={12} />}
                                  {label}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                {timeRemaining ? (
                                  <span className={`font-mono font-bold ${
                                    status === 'open' ? 'text-amber-400' : 'text-slate-500'
                                  }`}>
                                    {timeRemaining}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">--</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-400 mt-0.5" />
            <div className="text-sm text-slate-400">
              <p className="font-medium text-white mb-1">Information sur les ventes</p>
              <p>Les ventes sont arrêtées {config.stop_sales_before_draw_minutes || 5} minutes avant l'heure du tirage.</p>
              <p>Seules les loteries activées par votre entreprise sont affichées.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentAvailableDrawsPage;
