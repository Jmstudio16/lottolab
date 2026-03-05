import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Ticket, 
  Search, 
  RefreshCw, 
  Check, 
  X,
  Clock,
  Filter,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import CompanyLayout from '@/components/CompanyLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const CompanyLotteriesForAgentsPage = () => {
  const { token } = useAuth();
  const [lotteries, setLotteries] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [expandedLottery, setExpandedLottery] = useState(null);
  const [stats, setStats] = useState({ total: 0, enabled: 0 });

  const headers = { Authorization: `Bearer ${token}` };

  const fetchLotteries = async () => {
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
  };

  useEffect(() => {
    fetchLotteries();
  }, [token]);

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
    if (disabledLotteries.length === 0) return;
    
    setLoading(true);
    try {
      await Promise.all(
        disabledLotteries.map(l => 
          axios.put(`${API_URL}/api/company/lotteries/${l.lottery_id}/toggle?enabled=true`, {}, { headers })
        )
      );
      await fetchLotteries();
      toast.success('Toutes les loteries activées');
    } catch (error) {
      toast.error('Erreur lors de l\'activation');
    } finally {
      setLoading(false);
    }
  };

  const disableAll = async () => {
    const enabledLotteries = lotteries.filter(l => l.enabled);
    if (enabledLotteries.length === 0) return;
    
    setLoading(true);
    try {
      await Promise.all(
        enabledLotteries.map(l => 
          axios.put(`${API_URL}/api/company/lotteries/${l.lottery_id}/toggle?enabled=false`, {}, { headers })
        )
      );
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

  // Filter and group lotteries by state
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
    
    return filtered;
  }, [lotteries, searchQuery, filterState]);

  // Group by state code
  const groupedLotteries = useMemo(() => {
    const groups = {};
    filteredLotteries.forEach(l => {
      const state = l.state_code || 'OTHER';
      if (!groups[state]) groups[state] = [];
      groups[state].push(l);
    });
    return groups;
  }, [filteredLotteries]);

  return (
    <CompanyLayout>
      <div className="space-y-6" data-testid="lotteries-for-agents-page">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Ticket className="w-7 h-7 text-yellow-400" />
              Loteries pour Agents
            </h1>
            <p className="text-slate-400 mt-1">
              Sélectionnez les loteries disponibles pour vos agents
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={enableAll}
              className="border-emerald-600 text-emerald-400 hover:bg-emerald-900/30"
              disabled={loading}
            >
              <ToggleRight className="w-4 h-4 mr-2" />
              Tout Activer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={disableAll}
              className="border-red-600 text-red-400 hover:bg-red-900/30"
              disabled={loading}
            >
              <ToggleLeft className="w-4 h-4 mr-2" />
              Tout Désactiver
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Total Loteries</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl p-4">
            <p className="text-emerald-400 text-sm">Activées</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.enabled}</p>
          </div>
          <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4">
            <p className="text-red-400 text-sm">Désactivées</p>
            <p className="text-2xl font-bold text-red-400">{stats.total - stats.enabled}</p>
          </div>
          <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-4">
            <p className="text-blue-400 text-sm">États</p>
            <p className="text-2xl font-bold text-blue-400">{Object.keys(groupedLotteries).length}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <Input
              placeholder="Rechercher par nom ou état..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white"
              data-testid="search-lotteries"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'enabled', 'disabled'].map(filter => (
              <Button
                key={filter}
                variant={filterState === filter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterState(filter)}
                className={cn(
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
            {Object.entries(groupedLotteries).map(([state, stateLotteries]) => (
              <div key={state} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="bg-slate-700/50 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-yellow-400">{state}</span>
                    <span className="text-sm text-slate-400">
                      {stateLotteries.filter(l => l.enabled).length}/{stateLotteries.length} actives
                    </span>
                  </div>
                </div>
                
                <div className="divide-y divide-slate-700">
                  {stateLotteries.map(lottery => {
                    const lotterySchedules = getSchedulesForLottery(lottery.lottery_id);
                    const isExpanded = expandedLottery === lottery.lottery_id;
                    
                    return (
                      <div key={lottery.lottery_id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <button
                              onClick={() => setExpandedLottery(isExpanded ? null : lottery.lottery_id)}
                              className="text-slate-400 hover:text-white"
                            >
                              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                            
                            <div className="flex-1">
                              <p className="text-white font-medium">{lottery.lottery_name}</p>
                              {lotterySchedules.length > 0 && (
                                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {lotterySchedules.map(s => s.draw_name).join(' / ')}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <span className={cn(
                              "text-xs px-2 py-1 rounded-full",
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
                        
                        {/* Expanded details */}
                        {isExpanded && lotterySchedules.length > 0 && (
                          <div className="mt-4 pl-10 space-y-2">
                            <p className="text-sm text-slate-400 font-medium">Horaires des tirages:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {lotterySchedules.map(schedule => (
                                <div 
                                  key={schedule.schedule_id}
                                  className="bg-slate-700/50 rounded-lg p-3 flex items-center justify-between"
                                >
                                  <div>
                                    <p className="text-white font-medium">{schedule.draw_name}</p>
                                    <p className="text-xs text-slate-400">
                                      Ouverture: {schedule.open_time || 'N/A'} - 
                                      Fermeture: {schedule.close_time || 'N/A'}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-yellow-400 font-bold">{schedule.draw_time}</p>
                                    <p className="text-xs text-slate-400">Tirage</p>
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
