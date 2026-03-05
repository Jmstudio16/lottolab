import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Ticket, 
  Search, 
  RefreshCw, 
  Clock,
  Filter,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Timer
} from 'lucide-react';
import CompanyLayout from '@/components/CompanyLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Composant de compte à rebours temps réel
const CountdownTimer = ({ openTime, closeTime, drawTime }) => {
  const [timeLeft, setTimeLeft] = useState(null);
  const [status, setStatus] = useState('closed');

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTime = currentHours * 60 + currentMinutes;

      // Parse times
      const parseTime = (timeStr) => {
        if (!timeStr) return null;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
      };

      const open = parseTime(openTime);
      const close = parseTime(closeTime);
      const draw = parseTime(drawTime);

      if (open === null || close === null) {
        setStatus('unknown');
        return;
      }

      // Determine status
      if (currentTime < open) {
        // Before opening
        setStatus('pending');
        const diff = open - currentTime;
        setTimeLeft({ hours: Math.floor(diff / 60), minutes: diff % 60, label: 'Ouverture' });
      } else if (currentTime >= open && currentTime < close) {
        // Open
        setStatus('open');
        const diff = close - currentTime;
        setTimeLeft({ hours: Math.floor(diff / 60), minutes: diff % 60, label: 'Fermeture' });
      } else if (currentTime >= close && currentTime < (draw || close + 5)) {
        // Closing soon
        setStatus('closing');
        setTimeLeft(null);
      } else {
        // Closed
        setStatus('closed');
        setTimeLeft(null);
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [openTime, closeTime, drawTime]);

  const statusConfig = {
    open: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: CheckCircle, label: 'OUVERT' },
    pending: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Clock, label: 'EN ATTENTE' },
    closing: { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: AlertTriangle, label: 'FERME BIENTÔT' },
    closed: { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle, label: 'FERMÉ' },
    unknown: { bg: 'bg-slate-500/20', text: 'text-slate-400', icon: Clock, label: 'N/A' }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg", config.bg)}>
      <Icon className={cn("w-4 h-4", config.text)} />
      <span className={cn("text-xs font-medium", config.text)}>{config.label}</span>
      {timeLeft && (
        <span className={cn("text-xs", config.text)}>
          ({timeLeft.hours}h {timeLeft.minutes}m)
        </span>
      )}
    </div>
  );
};

export const CompanyLotteriesForAgentsPage = () => {
  const { token } = useAuth();
  const [lotteries, setLotteries] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedLottery, setExpandedLottery] = useState(null);
  const [stats, setStats] = useState({ total: 0, enabled: 0 });
  const [currentTime, setCurrentTime] = useState(new Date());

  const headers = { Authorization: `Bearer ${token}` };

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchLotteries = useCallback(async () => {
    try {
      setLoading(true);
      const [lotteriesRes, schedulesRes] = await Promise.all([
        axios.get(`${API_URL}/api/company/lotteries`, { headers }),
        axios.get(`${API_URL}/api/company/schedules`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setLotteries(lotteriesRes.data || []);
      setSchedules(schedulesRes.data || []);
      
      const total = lotteriesRes.data?.length || 0;
      const enabled = lotteriesRes.data?.filter(l => l.enabled)?.length || 0;
      setStats({ total, enabled });
    } catch (error) {
      toast.error('Erreur lors du chargement des loteries');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchLotteries();
  }, [fetchLotteries]);

  const toggleLottery = async (lotteryId, currentEnabled) => {
    setUpdating(prev => ({ ...prev, [lotteryId]: true }));
    
    try {
      await axios.put(
        `${API_URL}/api/company/lotteries/${lotteryId}/toggle?enabled=${!currentEnabled}`,
        {},
        { headers }
      );
      
      setLotteries(prev => prev.map(l => 
        l.lottery_id === lotteryId ? { ...l, enabled: !currentEnabled } : l
      ));
      
      setStats(prev => ({
        ...prev,
        enabled: currentEnabled ? prev.enabled - 1 : prev.enabled + 1
      }));
      
      toast.success(currentEnabled ? 'Loterie désactivée' : 'Loterie activée');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setUpdating(prev => ({ ...prev, [lotteryId]: false }));
    }
  };

  const enableAll = async () => {
    const disabledLotteries = lotteries.filter(l => !l.enabled);
    if (disabledLotteries.length === 0) {
      toast.info('Toutes les loteries sont déjà activées');
      return;
    }
    
    setLoading(true);
    try {
      // Process in batches of 20
      for (let i = 0; i < disabledLotteries.length; i += 20) {
        const batch = disabledLotteries.slice(i, i + 20);
        await Promise.all(
          batch.map(l => 
            axios.put(`${API_URL}/api/company/lotteries/${l.lottery_id}/toggle?enabled=true`, {}, { headers })
          )
        );
      }
      await fetchLotteries();
      toast.success(`${disabledLotteries.length} loteries activées`);
    } catch (error) {
      toast.error('Erreur lors de l\'activation');
    } finally {
      setLoading(false);
    }
  };

  const disableAll = async () => {
    const enabledLotteries = lotteries.filter(l => l.enabled);
    if (enabledLotteries.length === 0) {
      toast.info('Toutes les loteries sont déjà désactivées');
      return;
    }
    
    if (!window.confirm(`Désactiver ${enabledLotteries.length} loteries? Les agents ne pourront plus vendre.`)) return;
    
    setLoading(true);
    try {
      for (let i = 0; i < enabledLotteries.length; i += 20) {
        const batch = enabledLotteries.slice(i, i + 20);
        await Promise.all(
          batch.map(l => 
            axios.put(`${API_URL}/api/company/lotteries/${l.lottery_id}/toggle?enabled=false`, {}, { headers })
          )
        );
      }
      await fetchLotteries();
      toast.success('Toutes les loteries désactivées');
    } catch (error) {
      toast.error('Erreur lors de la désactivation');
    } finally {
      setLoading(false);
    }
  };

  const getSchedulesForLottery = (lotteryId) => {
    return schedules.filter(s => s.lottery_id === lotteryId);
  };

  const getLotteryStatus = (lotteryId) => {
    const lotterySchedules = getSchedulesForLottery(lotteryId);
    if (lotterySchedules.length === 0) return 'unknown';
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    for (const sch of lotterySchedules) {
      const open = sch.open_time?.split(':').map(Number) || [6, 0];
      const close = sch.close_time?.split(':').map(Number) || [23, 0];
      const openMin = open[0] * 60 + open[1];
      const closeMin = close[0] * 60 + close[1];
      
      if (currentMinutes >= openMin && currentMinutes < closeMin) {
        return 'open';
      }
    }
    return 'closed';
  };

  // Filter and group lotteries
  const filteredLotteries = useMemo(() => {
    let filtered = lotteries;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(l => 
        l.lottery_name?.toLowerCase().includes(query) ||
        l.state_code?.toLowerCase().includes(query)
      );
    }
    
    if (filterState === 'enabled') {
      filtered = filtered.filter(l => l.enabled);
    } else if (filterState === 'disabled') {
      filtered = filtered.filter(l => !l.enabled);
    }
    
    if (filterStatus === 'open') {
      filtered = filtered.filter(l => getLotteryStatus(l.lottery_id) === 'open');
    } else if (filterStatus === 'closed') {
      filtered = filtered.filter(l => getLotteryStatus(l.lottery_id) === 'closed');
    }
    
    return filtered;
  }, [lotteries, searchQuery, filterState, filterStatus, currentTime]);

  // Group by state code
  const groupedLotteries = useMemo(() => {
    const groups = {};
    filteredLotteries.forEach(l => {
      const state = l.state_code || 'OTHER';
      if (!groups[state]) groups[state] = [];
      groups[state].push(l);
    });
    // Sort by state code
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredLotteries]);

  return (
    <CompanyLayout>
      <div className="space-y-6" data-testid="lotteries-for-agents-page">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
              <Ticket className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-400" />
              Loteries pour Agents
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              Gérez les loteries disponibles pour vos agents • 
              <span className="text-emerald-400 ml-1">
                {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={enableAll}
              className="border-emerald-600 text-emerald-400 hover:bg-emerald-900/30 text-xs sm:text-sm"
              disabled={loading}
            >
              <ToggleRight className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Tout</span> Activer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={disableAll}
              className="border-red-600 text-red-400 hover:bg-red-900/30 text-xs sm:text-sm"
              disabled={loading}
            >
              <ToggleLeft className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Tout</span> Désactiver
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLotteries}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
              disabled={loading}
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 sm:p-4">
            <p className="text-slate-400 text-xs sm:text-sm">Total</p>
            <p className="text-xl sm:text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl p-3 sm:p-4">
            <p className="text-emerald-400 text-xs sm:text-sm">Activées</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-400">{stats.enabled}</p>
          </div>
          <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-3 sm:p-4">
            <p className="text-red-400 text-xs sm:text-sm">Désactivées</p>
            <p className="text-xl sm:text-2xl font-bold text-red-400">{stats.total - stats.enabled}</p>
          </div>
          <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-3 sm:p-4">
            <p className="text-blue-400 text-xs sm:text-sm">États</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-400">{groupedLotteries.length}</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white text-sm"
              data-testid="search-lotteries"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            {/* State filter */}
            {['all', 'enabled', 'disabled'].map(filter => (
              <Button
                key={filter}
                variant={filterState === filter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterState(filter)}
                className={cn(
                  "whitespace-nowrap text-xs",
                  filterState === filter 
                    ? 'bg-yellow-500 text-black hover:bg-yellow-600' 
                    : 'border-slate-600 text-slate-300 hover:bg-slate-800'
                )}
              >
                {filter === 'all' && 'Toutes'}
                {filter === 'enabled' && 'Activées'}
                {filter === 'disabled' && 'Désactivées'}
              </Button>
            ))}
            
            {/* Status filter */}
            {['all', 'open', 'closed'].map(filter => (
              <Button
                key={`status-${filter}`}
                variant={filterStatus === filter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus(filter)}
                className={cn(
                  "whitespace-nowrap text-xs",
                  filterStatus === filter 
                    ? 'bg-blue-500 text-white hover:bg-blue-600' 
                    : 'border-slate-600 text-slate-300 hover:bg-slate-800'
                )}
              >
                {filter === 'all' && <Filter className="w-3 h-3 mr-1" />}
                {filter === 'open' && <CheckCircle className="w-3 h-3 mr-1" />}
                {filter === 'closed' && <XCircle className="w-3 h-3 mr-1" />}
                {filter === 'all' && 'Statut'}
                {filter === 'open' && 'Ouvert'}
                {filter === 'closed' && 'Fermé'}
              </Button>
            ))}
          </div>
        </div>

        {/* Lotteries List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-8 h-8 text-yellow-400 animate-spin" />
          </div>
        ) : filteredLotteries.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Ticket className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucune loterie trouvée</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedLotteries.map(([state, stateLotteries]) => (
              <div key={state} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="bg-slate-700/50 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-base sm:text-lg font-bold text-yellow-400">{state}</span>
                    <span className="text-xs sm:text-sm text-slate-400">
                      {stateLotteries.filter(l => l.enabled).length}/{stateLotteries.length} actives
                    </span>
                  </div>
                </div>
                
                <div className="divide-y divide-slate-700">
                  {stateLotteries.map(lottery => {
                    const lotterySchedules = getSchedulesForLottery(lottery.lottery_id);
                    const isExpanded = expandedLottery === lottery.lottery_id;
                    const lotteryStatus = getLotteryStatus(lottery.lottery_id);
                    
                    return (
                      <div key={lottery.lottery_id} className="p-3 sm:p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                            <button
                              onClick={() => setExpandedLottery(isExpanded ? null : lottery.lottery_id)}
                              className="text-slate-400 hover:text-white flex-shrink-0"
                            >
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                            
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium text-sm sm:text-base truncate">
                                {lottery.lottery_name}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                {lotterySchedules.length > 0 && (
                                  <CountdownTimer 
                                    openTime={lotterySchedules[0].open_time}
                                    closeTime={lotterySchedules[0].close_time}
                                    drawTime={lotterySchedules[0].draw_time}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                            <span className={cn(
                              "text-xs px-2 py-1 rounded-full hidden sm:inline-block",
                              lottery.enabled 
                                ? "bg-emerald-500/20 text-emerald-400" 
                                : "bg-red-500/20 text-red-400"
                            )}>
                              {lottery.enabled ? 'Active' : 'Inactive'}
                            </span>
                            
                            <Switch
                              checked={lottery.enabled}
                              onCheckedChange={() => toggleLottery(lottery.lottery_id, lottery.enabled)}
                              disabled={updating[lottery.lottery_id]}
                              data-testid={`toggle-${lottery.lottery_id}`}
                            />
                          </div>
                        </div>
                        
                        {/* Expanded details with schedules */}
                        {isExpanded && lotterySchedules.length > 0 && (
                          <div className="mt-4 pl-6 sm:pl-10 space-y-2">
                            <p className="text-sm text-slate-400 font-medium flex items-center gap-2">
                              <Timer className="w-4 h-4" />
                              Horaires des tirages
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {lotterySchedules.map(schedule => (
                                <div 
                                  key={schedule.schedule_id}
                                  className="bg-slate-700/50 rounded-lg p-3"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-white font-medium">{schedule.draw_name}</p>
                                    <CountdownTimer 
                                      openTime={schedule.open_time}
                                      closeTime={schedule.close_time}
                                      drawTime={schedule.draw_time}
                                    />
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className="bg-slate-800 rounded p-2 text-center">
                                      <p className="text-slate-500">Ouverture</p>
                                      <p className="text-emerald-400 font-bold">{schedule.open_time || '06:00'}</p>
                                    </div>
                                    <div className="bg-slate-800 rounded p-2 text-center">
                                      <p className="text-slate-500">Fermeture</p>
                                      <p className="text-red-400 font-bold">{schedule.close_time || '23:00'}</p>
                                    </div>
                                    <div className="bg-slate-800 rounded p-2 text-center">
                                      <p className="text-slate-500">Tirage</p>
                                      <p className="text-yellow-400 font-bold">{schedule.draw_time}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
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
    </CompanyLayout>
  );
};

export default CompanyLotteriesForAgentsPage;
