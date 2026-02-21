import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { AgentLayout } from '@/components/AgentLayout';
import { useAuth } from '@/api/auth';
import apiClient from '@/api/client';
import { toast } from 'sonner';
import { 
  Ticket, Clock, MapPin, Timer, AlertTriangle, Lock, 
  Play, RefreshCw, ChevronRight, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

// US States for lottery display
const US_STATES = {
  'GA': { name: 'Georgia', flag: '🍑' },
  'FL': { name: 'Florida', flag: '🌴' },
  'NY': { name: 'New York', flag: '🗽' },
  'TX': { name: 'Texas', flag: '⭐' },
  'TN': { name: 'Tennessee', flag: '🎸' },
  'CA': { name: 'California', flag: '🌞' },
  'IL': { name: 'Illinois', flag: '🌽' },
  'PA': { name: 'Pennsylvania', flag: '🔔' },
  'OH': { name: 'Ohio', flag: '🏈' },
  'MI': { name: 'Michigan', flag: '🚗' },
  'NC': { name: 'North Carolina', flag: '🐝' },
  'VA': { name: 'Virginia', flag: '🏛️' },
  'NJ': { name: 'New Jersey', flag: '🎡' },
};

// Get timezone offset
const getTimezoneOffset = (timezone) => {
  const tzMap = {
    'America/New_York': -5,
    'America/Chicago': -6,
    'America/Denver': -7,
    'America/Los_Angeles': -8,
    'America/Port-au-Prince': -5,
  };
  return tzMap[timezone] || -5;
};

// Convert time string to today's date with timezone
const timeToToday = (timeStr, timezone) => {
  if (!timeStr) return null;
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  const now = new Date();
  
  // Create date in local time first
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  
  return date;
};

// Calculate remaining time in seconds
const calculateRemainingSeconds = (closingTime, timezone) => {
  if (!closingTime) return null;
  
  const closeDate = timeToToday(closingTime, timezone);
  if (!closeDate) return null;
  
  const now = new Date();
  const diff = closeDate.getTime() - now.getTime();
  
  return Math.max(0, Math.floor(diff / 1000));
};

// Format seconds to HH:MM:SS
const formatCountdown = (seconds) => {
  if (seconds === null || seconds === undefined) return '--:--:--';
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// Get lottery status based on time
const getLotteryStatus = (openingTime, closingTime, timezone) => {
  const now = new Date();
  const openDate = timeToToday(openingTime, timezone);
  const closeDate = timeToToday(closingTime, timezone);
  
  if (!openDate || !closeDate) {
    return { status: 'UNKNOWN', color: 'gray' };
  }
  
  const remainingSeconds = calculateRemainingSeconds(closingTime, timezone);
  
  // Check if closed
  if (remainingSeconds <= 0) {
    return { status: 'CLOSED', color: 'red', label: 'FERMÉ' };
  }
  
  // Check if not yet open
  if (now < openDate) {
    return { status: 'NOT_OPEN', color: 'gray', label: 'PAS ENCORE OUVERT' };
  }
  
  // Closing soon (less than 5 minutes)
  if (remainingSeconds <= 300) {
    return { status: 'CLOSING_SOON', color: 'orange', label: 'FERMETURE IMMINENTE' };
  }
  
  // Closing within 15 minutes
  if (remainingSeconds <= 900) {
    return { status: 'CLOSING', color: 'yellow', label: 'DÉPÊCHEZ-VOUS' };
  }
  
  return { status: 'OPEN', color: 'green', label: 'OUVERT' };
};

// Lottery Card Component
const LotteryCard = ({ lottery, schedule, onSelect, remainingSeconds }) => {
  const state = US_STATES[lottery.state_code] || { name: lottery.state_code, flag: '🎱' };
  const status = getLotteryStatus(schedule?.opening_time, schedule?.closing_time, lottery.timezone);
  const isClickable = status.status === 'OPEN' || status.status === 'CLOSING_SOON' || status.status === 'CLOSING';
  
  const handleClick = () => {
    if (!isClickable) {
      if (status.status === 'CLOSED') {
        toast.error('Cette loterie est fermée');
      } else if (status.status === 'NOT_OPEN') {
        toast.error('Cette loterie n\'est pas encore ouverte');
      }
      return;
    }
    onSelect(lottery, schedule);
  };
  
  return (
    <Card 
      className={`relative overflow-hidden transition-all duration-300 cursor-pointer border-2 ${
        isClickable 
          ? 'hover:scale-[1.02] hover:shadow-lg hover:shadow-emerald-500/20 border-slate-700 hover:border-emerald-500/50' 
          : 'opacity-60 cursor-not-allowed border-slate-800'
      }`}
      onClick={handleClick}
      data-testid={`lottery-card-${lottery.lottery_id}`}
    >
      {/* Status Badge */}
      <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold ${
        status.status === 'OPEN' ? 'bg-green-500/20 text-green-400 border border-green-500/50' :
        status.status === 'CLOSING_SOON' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50 animate-pulse' :
        status.status === 'CLOSING' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' :
        status.status === 'CLOSED' ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
        'bg-slate-500/20 text-slate-400 border border-slate-500/50'
      }`}>
        {status.label}
      </div>
      
      {/* Closed Overlay */}
      {status.status === 'CLOSED' && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
          <div className="text-center">
            <Lock className="w-12 h-12 text-red-400 mx-auto mb-2" />
            <span className="text-red-400 font-bold text-xl">FERMÉ</span>
          </div>
        </div>
      )}
      
      <div className="p-5">
        {/* Header with Logo */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl flex items-center justify-center text-3xl shadow-lg">
            {state.flag}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-white text-lg">{lottery.lottery_name}</h3>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <MapPin className="w-3 h-3" />
              {state.name}
            </div>
          </div>
        </div>
        
        {/* Draw Info */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">Type de Tirage</div>
            <div className={`text-sm font-semibold ${
              schedule?.draw_name === 'Morning' ? 'text-orange-400' :
              schedule?.draw_name === 'Midday' ? 'text-yellow-400' :
              schedule?.draw_name === 'Evening' ? 'text-blue-400' :
              'text-purple-400'
            }`}>
              {schedule?.draw_name || 'N/A'}
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">Heure du Tirage</div>
            <div className="text-sm font-semibold text-white">
              {schedule?.draw_time || 'N/A'}
            </div>
          </div>
        </div>
        
        {/* Countdown Timer */}
        {(status.status === 'OPEN' || status.status === 'CLOSING_SOON' || status.status === 'CLOSING') && (
          <div className={`rounded-xl p-4 text-center mb-4 ${
            status.status === 'CLOSING_SOON' 
              ? 'bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-500/30' 
              : status.status === 'CLOSING'
              ? 'bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30'
              : 'bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/30'
          }`}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Timer className={`w-4 h-4 ${
                status.status === 'CLOSING_SOON' ? 'text-orange-400 animate-pulse' : 
                status.status === 'CLOSING' ? 'text-yellow-400' :
                'text-emerald-400'
              }`} />
              <span className="text-xs text-slate-300">FERME DANS</span>
            </div>
            <div className={`text-3xl font-mono font-bold ${
              status.status === 'CLOSING_SOON' ? 'text-orange-400' : 
              status.status === 'CLOSING' ? 'text-yellow-400' :
              'text-emerald-400'
            }`}>
              {formatCountdown(remainingSeconds)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Fermeture: {schedule?.closing_time}
            </div>
          </div>
        )}
        
        {/* Action Button */}
        <Button 
          className={`w-full font-semibold ${
            isClickable 
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white' 
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
          }`}
          disabled={!isClickable}
        >
          {isClickable ? (
            <>
              <Ticket className="w-4 h-4 mr-2" />
              CRÉER TICKET
              <ChevronRight className="w-4 h-4 ml-2" />
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 mr-2" />
              INDISPONIBLE
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};

// Main Component
export const AgentLotterySelectionPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [syncData, setSyncData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDrawType, setFilterDrawType] = useState('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [remainingTimes, setRemainingTimes] = useState({});
  
  // Fetch sync data
  const fetchSyncData = useCallback(async () => {
    try {
      const response = await apiClient.get('/device/config');
      setSyncData(response.data);
    } catch (error) {
      toast.error('Erreur de synchronisation');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Initial load
  useEffect(() => {
    fetchSyncData();
  }, [fetchSyncData]);
  
  // Auto-sync every 5 seconds
  useEffect(() => {
    const syncInterval = setInterval(fetchSyncData, 5000);
    return () => clearInterval(syncInterval);
  }, [fetchSyncData]);
  
  // Update timers every second
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setCurrentTime(new Date());
      
      // Update remaining times for each lottery
      if (syncData?.schedules && syncData?.lotteries) {
        const newRemainingTimes = {};
        
        syncData.schedules.forEach(schedule => {
          const lottery = syncData.lotteries.find(l => l.lottery_id === schedule.lottery_id);
          if (lottery && schedule.closing_time) {
            const key = `${schedule.lottery_id}-${schedule.draw_name}`;
            newRemainingTimes[key] = calculateRemainingSeconds(
              schedule.closing_time, 
              lottery.timezone
            );
          }
        });
        
        setRemainingTimes(newRemainingTimes);
      }
    }, 1000);
    
    return () => clearInterval(timerInterval);
  }, [syncData]);
  
  // Combine lotteries with their schedules
  const lotteriesWithSchedules = useMemo(() => {
    if (!syncData?.lotteries || !syncData?.schedules) return [];
    
    const result = [];
    
    syncData.schedules.forEach(schedule => {
      const lottery = syncData.lotteries.find(l => l.lottery_id === schedule.lottery_id);
      if (lottery) {
        result.push({
          lottery,
          schedule,
          key: `${schedule.lottery_id}-${schedule.draw_name}`
        });
      }
    });
    
    // Sort by closing time (most urgent first)
    return result.sort((a, b) => {
      const timeA = remainingTimes[a.key] ?? Infinity;
      const timeB = remainingTimes[b.key] ?? Infinity;
      return timeA - timeB;
    });
  }, [syncData, remainingTimes]);
  
  // Filter lotteries
  const filteredLotteries = useMemo(() => {
    return lotteriesWithSchedules.filter(({ lottery, schedule }) => {
      // Search filter
      const matchesSearch = 
        lottery.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lottery.state_code?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Draw type filter
      const matchesDrawType = 
        filterDrawType === 'all' || 
        schedule.draw_name?.toLowerCase() === filterDrawType.toLowerCase();
      
      return matchesSearch && matchesDrawType;
    });
  }, [lotteriesWithSchedules, searchTerm, filterDrawType]);
  
  // Handle lottery selection
  const handleSelectLottery = (lottery, schedule) => {
    // Navigate to ticket creation with selected lottery
    navigate('/agent/new-ticket', { 
      state: { 
        selectedLotteryId: lottery.lottery_id,
        selectedDrawName: schedule.draw_name 
      } 
    });
  };
  
  // Get counts for badges
  const openCount = filteredLotteries.filter(({ lottery, schedule }) => {
    const status = getLotteryStatus(schedule.opening_time, schedule.closing_time, lottery.timezone);
    return status.status === 'OPEN' || status.status === 'CLOSING' || status.status === 'CLOSING_SOON';
  }).length;
  
  const closingSoonCount = filteredLotteries.filter(({ lottery, schedule }) => {
    const status = getLotteryStatus(schedule.opening_time, schedule.closing_time, lottery.timezone);
    return status.status === 'CLOSING_SOON';
  }).length;
  
  return (
    <AgentLayout>
      <div className="space-y-6" data-testid="lottery-selection-page">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
              <Ticket className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Sélectionner une Loterie</h1>
              <p className="text-slate-400 text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Mise à jour automatique • {currentTime.toLocaleTimeString('fr-FR')}
              </p>
            </div>
          </div>
          <Button 
            onClick={fetchSyncData}
            variant="outline"
            className="border-slate-600"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Ticket className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{filteredLotteries.length}</p>
                <p className="text-xs text-slate-400">Loteries</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Play className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">{openCount}</p>
                <p className="text-xs text-slate-400">Ouvertes</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-400">{closingSoonCount}</p>
                <p className="text-xs text-slate-400">Fermeture Imminente</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{syncData?.schedules?.length || 0}</p>
                <p className="text-xs text-slate-400">Tirages Aujourd'hui</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Closing Soon Alert */}
        {closingSoonCount > 0 && (
          <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-500/30 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-orange-500/30 rounded-full animate-pulse">
              <Zap className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h3 className="text-orange-400 font-bold">Attention!</h3>
              <p className="text-orange-300 text-sm">
                {closingSoonCount} loterie(s) ferme(nt) dans moins de 5 minutes. Dépêchez-vous!
              </p>
            </div>
          </div>
        )}
        
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Input
              placeholder="Rechercher par nom ou état..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white pl-4"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'Morning', 'Midday', 'Evening', 'Night'].map(type => (
              <Button
                key={type}
                variant={filterDrawType === type ? 'default' : 'outline'}
                onClick={() => setFilterDrawType(type)}
                className={filterDrawType === type 
                  ? 'bg-emerald-500 hover:bg-emerald-600' 
                  : 'border-slate-600 text-slate-300'}
                size="sm"
              >
                {type === 'all' ? 'Tous' : type}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Lottery Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        ) : filteredLotteries.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
            <Ticket className="w-16 h-16 mx-auto text-slate-500 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Aucune loterie disponible</h3>
            <p className="text-slate-400">Veuillez réessayer plus tard ou contacter votre administrateur</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredLotteries.map(({ lottery, schedule, key }) => (
              <LotteryCard
                key={key}
                lottery={lottery}
                schedule={schedule}
                onSelect={handleSelectLottery}
                remainingSeconds={remainingTimes[key]}
              />
            ))}
          </div>
        )}
      </div>
    </AgentLayout>
  );
};

export default AgentLotterySelectionPage;
