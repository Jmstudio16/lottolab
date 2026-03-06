import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import { 
  Plus, 
  Trash2, 
  Printer, 
  CheckCircle, 
  AlertCircle,
  X,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  Ticket as TicketIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const BET_TYPES = [
  { value: 'BORLETTE', label: 'Borlette', digits: 2, description: '2 chiffres' },
  { value: 'LOTO3', label: 'Loto 3', digits: 3, description: '3 chiffres' },
  { value: 'LOTO4', label: 'Loto 4', digits: 4, description: '4 chiffres' },
  { value: 'LOTO5', label: 'Loto 5', digits: 5, description: '5 chiffres' },
  { value: 'MARIAGE', label: 'Mariage', digits: 4, description: '2x2 chiffres' },
];

const DEFAULT_PAYOUTS = {
  BORLETTE: 50,
  LOTO3: 500,
  LOTO4: 5000,
  LOTO5: 50000,
  MARIAGE: 1000
};

// ==================== LOTTERY STATUS CALCULATION ====================
// Use Haiti timezone (UTC-5) for lottery schedule calculation
const getHaitiTime = () => {
  const now = new Date();
  // Convert to Haiti time (UTC-5)
  const haitiOffset = -5 * 60; // -5 hours in minutes
  const localOffset = now.getTimezoneOffset(); // local offset in minutes
  const haitiTime = new Date(now.getTime() + (localOffset + haitiOffset) * 60000);
  return haitiTime;
};

const getLotteryStatus = (schedule, companyTimezone = 'America/Port-au-Prince') => {
  if (!schedule) return { status: 'CLOSED', label: 'Fermé', color: 'bg-red-500', canSell: false };
  
  // Use Haiti timezone for calculations
  const now = getHaitiTime();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const parseTime = (timeStr) => {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  };
  
  const openMin = parseTime(schedule.open_time);
  const closeMin = parseTime(schedule.close_time);
  
  if (openMin === null || closeMin === null) {
    return { status: 'UNKNOWN', label: 'Inconnu', color: 'bg-gray-500', canSell: false };
  }
  
  // Not yet open
  if (currentMinutes < openMin) {
    const diff = openMin - currentMinutes;
    return { 
      status: 'NOT_OPEN', 
      label: `Ouvre dans ${Math.floor(diff / 60)}h${diff % 60}m`,
      color: 'bg-blue-500',
      canSell: false
    };
  }
  
  // Already closed
  if (currentMinutes >= closeMin) {
    return { status: 'CLOSED', label: 'Fermé', color: 'bg-red-500', canSell: false };
  }
  
  // Open - calculate time remaining
  const remaining = closeMin - currentMinutes;
  
  if (remaining <= 15) {
    return { 
      status: 'CLOSING_SOON', 
      label: `Ferme dans ${remaining}min`,
      color: 'bg-orange-500',
      canSell: true,
      timeLeft: remaining
    };
  }
  
  if (remaining <= 60) {
    return { 
      status: 'OPEN', 
      label: `Ferme dans ${remaining}min`,
      color: 'bg-emerald-500',
      canSell: true,
      timeLeft: remaining
    };
  }
  
  const hours = Math.floor(remaining / 60);
  const mins = remaining % 60;
  return { 
    status: 'OPEN', 
    label: `Ouvert - ${hours}h${mins}m`,
    color: 'bg-emerald-500',
    canSell: true,
    timeLeft: remaining
  };
};

// ==================== LOTTERY CARD COMPONENT ====================
const LotteryCard = ({ lottery, schedule, isSelected, onSelect, disabled }) => {
  const [statusInfo, setStatusInfo] = useState(() => getLotteryStatus(schedule));
  
  // Update status every 30 seconds
  useEffect(() => {
    const updateStatus = () => setStatusInfo(getLotteryStatus(schedule));
    updateStatus();
    const interval = setInterval(updateStatus, 30000);
    return () => clearInterval(interval);
  }, [schedule]);
  
  const canSelect = statusInfo.canSell && !disabled;
  
  return (
    <div
      onClick={() => canSelect && onSelect()}
      className={cn(
        "relative p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer",
        isSelected 
          ? "border-emerald-500 bg-emerald-900/30 shadow-lg shadow-emerald-500/20" 
          : canSelect 
            ? "border-slate-600 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800" 
            : "border-slate-700 bg-slate-800/30 opacity-60 cursor-not-allowed"
      )}
      data-testid={`lottery-card-${lottery.lottery_id}`}
    >
      {/* Status Badge */}
      <div className="absolute top-2 right-2">
        <Badge className={cn("text-xs font-medium text-white", statusInfo.color)}>
          {statusInfo.label}
        </Badge>
      </div>
      
      {/* Lottery Info */}
      <div className="pr-24">
        <h3 className="font-bold text-white text-lg truncate">
          {lottery.lottery_name || lottery.name}
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          {lottery.state_code || lottery.region || 'Haiti'}
        </p>
      </div>
      
      {/* Schedule Info */}
      {schedule && (
        <div className="mt-3 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Clock size={14} />
            <span>{schedule.draw_name}</span>
          </div>
          <div className="text-slate-400">
            Tirage: {schedule.draw_time}
          </div>
        </div>
      )}
      
      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute bottom-2 right-2">
          <CheckCircle className="text-emerald-400" size={24} />
        </div>
      )}
    </div>
  );
};

// ==================== PLAY ROW COMPONENT ====================
const PlayRow = ({ play, index, onUpdate, onRemove, canRemove, config, currency }) => {
  const betType = BET_TYPES.find(b => b.value === play.bet_type) || BET_TYPES[0];
  const minBet = config?.min_bet_amount || 10;
  const maxBet = config?.max_bet_amount || 10000;
  
  const isValid = useMemo(() => {
    const numbers = play.numbers.replace(/\D/g, '');
    if (numbers.length !== betType.digits) return false;
    const amount = parseFloat(play.amount);
    if (isNaN(amount) || amount < minBet || amount > maxBet) return false;
    return true;
  }, [play.numbers, play.amount, betType.digits, minBet, maxBet]);
  
  return (
    <div className="p-4 bg-slate-700/50 rounded-xl border border-slate-600">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-300">Jeu #{index + 1}</span>
        <div className="flex items-center gap-2">
          {play.numbers && play.amount && (
            <span className={cn("text-xs px-2 py-0.5 rounded-full", 
              isValid ? "bg-emerald-900/50 text-emerald-400" : "bg-red-900/50 text-red-400"
            )}>
              {isValid ? 'Valide' : 'Invalide'}
            </span>
          )}
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/30"
            >
              <Trash2 size={16} />
            </Button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Bet Type */}
        <div>
          <Label className="text-xs text-slate-400 mb-1.5 block">Type de pari</Label>
          <div className="flex flex-wrap gap-1.5">
            {BET_TYPES.map(bt => (
              <button
                key={bt.value}
                type="button"
                onClick={() => onUpdate('bet_type', bt.value)}
                className={cn(
                  "px-2.5 py-1.5 text-xs rounded-lg font-medium transition-all",
                  play.bet_type === bt.value
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-600 text-slate-300 hover:bg-slate-500"
                )}
              >
                {bt.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Numbers */}
        <div>
          <Label className="text-xs text-slate-400 mb-1.5 block">
            Numéros ({betType.digits} chiffres)
          </Label>
          <Input
            type="text"
            inputMode="numeric"
            value={play.numbers}
            onChange={(e) => onUpdate('numbers', e.target.value.replace(/\D/g, '').slice(0, betType.digits))}
            placeholder={`${'0'.repeat(betType.digits)}`}
            className="bg-slate-600 border-slate-500 text-white text-xl font-mono tracking-[0.3em] text-center h-12"
            maxLength={betType.digits}
            data-testid={`play-numbers-${index}`}
          />
        </div>
        
        {/* Amount */}
        <div>
          <Label className="text-xs text-slate-400 mb-1.5 block">
            Montant ({currency})
          </Label>
          <Input
            type="number"
            inputMode="numeric"
            value={play.amount}
            onChange={(e) => onUpdate('amount', e.target.value)}
            placeholder={`Min: ${minBet}`}
            className="bg-slate-600 border-slate-500 text-white text-xl font-bold text-center h-12"
            min={minBet}
            max={maxBet}
            data-testid={`play-amount-${index}`}
          />
        </div>
      </div>
    </div>
  );
};

// ==================== SUCCESS MODAL ====================
const SuccessModal = ({ ticket, onClose, onPrint, currency }) => {
  if (!ticket) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="bg-slate-800 border-slate-700 max-w-md w-full animate-in zoom-in-95 duration-200">
        <CardHeader className="pb-3 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <CardTitle className="text-emerald-400 flex items-center gap-2">
              <CheckCircle size={24} />
              Ticket Créé avec Succès!
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Ticket Code */}
          <div className="bg-slate-900 p-4 rounded-xl text-center border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Code du ticket</p>
            <p className="text-2xl font-mono font-bold text-white tracking-wider">
              {ticket.ticket_code}
            </p>
          </div>
          
          {/* Details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-700/50 p-3 rounded-lg">
              <p className="text-slate-400 text-xs">Loterie</p>
              <p className="text-white font-medium truncate">{ticket.lottery_name}</p>
            </div>
            <div className="bg-slate-700/50 p-3 rounded-lg">
              <p className="text-slate-400 text-xs">Tirage</p>
              <p className="text-white font-medium">{ticket.draw_name}</p>
            </div>
            <div className="bg-slate-700/50 p-3 rounded-lg">
              <p className="text-slate-400 text-xs">Total Payé</p>
              <p className="text-emerald-400 font-bold text-lg">
                {ticket.total_amount?.toLocaleString()} {currency}
              </p>
            </div>
            <div className="bg-slate-700/50 p-3 rounded-lg">
              <p className="text-slate-400 text-xs">Gain Potentiel</p>
              <p className="text-amber-400 font-bold text-lg">
                {ticket.potential_win?.toLocaleString()} {currency}
              </p>
            </div>
          </div>
          
          {/* QR Code */}
          {ticket.qr_code && (
            <div className="flex justify-center">
              <img 
                src={`data:image/png;base64,${ticket.qr_code}`} 
                alt="QR Code" 
                className="w-28 h-28 rounded-lg"
              />
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={onPrint}
              className="flex-1 bg-blue-600 hover:bg-blue-700 h-12"
            >
              <Printer className="mr-2" size={18} />
              Imprimer
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-slate-600 text-white hover:bg-slate-700 h-12"
            >
              <Plus className="mr-2" size={18} />
              Nouveau
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
export const AgentNewSalePage = () => {
  const { syncData } = useOutletContext() || {};
  const { token } = useAuth();
  
  // Core state
  const [selectedLotteryId, setSelectedLotteryId] = useState(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [plays, setPlays] = useState([{ numbers: '', bet_type: 'BORLETTE', amount: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTicket, setLastTicket] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Extract data from syncData with stable defaults
  const lotteries = useMemo(() => syncData?.enabled_lotteries || [], [syncData?.enabled_lotteries]);
  const schedules = useMemo(() => syncData?.schedules || [], [syncData?.schedules]);
  const config = useMemo(() => syncData?.configuration || {}, [syncData?.configuration]);
  const primeConfigs = useMemo(() => syncData?.prime_configs || [], [syncData?.prime_configs]);
  const currency = syncData?.company?.currency || 'HTG';
  
  // Update time every minute for status updates
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);
  
  // Get selected lottery and schedule
  const selectedLottery = useMemo(() => 
    lotteries.find(l => l.lottery_id === selectedLotteryId),
    [lotteries, selectedLotteryId]
  );
  
  const availableSchedules = useMemo(() => 
    selectedLotteryId 
      ? schedules.filter(s => s.lottery_id === selectedLotteryId)
      : [],
    [schedules, selectedLotteryId]
  );
  
  const selectedSchedule = useMemo(() => 
    availableSchedules.find(s => s.schedule_id === selectedScheduleId),
    [availableSchedules, selectedScheduleId]
  );
  
  // Auto-select first schedule when lottery changes
  useEffect(() => {
    if (availableSchedules.length > 0) {
      // Find first open schedule
      const openSchedule = availableSchedules.find(s => {
        const status = getLotteryStatus(s);
        return status.canSell;
      });
      if (openSchedule) {
        console.log('Auto-selecting open schedule:', openSchedule.schedule_id);
        setSelectedScheduleId(openSchedule.schedule_id);
      } else if (availableSchedules[0]) {
        console.log('Auto-selecting first schedule:', availableSchedules[0].schedule_id);
        setSelectedScheduleId(availableSchedules[0].schedule_id);
      }
    } else {
      setSelectedScheduleId(null);
    }
  }, [availableSchedules.length, selectedLotteryId]); // Added selectedLotteryId as dependency
  
  // Calculate totals
  const totalAmount = useMemo(() => 
    plays.reduce((sum, play) => sum + (parseFloat(play.amount) || 0), 0),
    [plays]
  );
  
  const potentialWin = useMemo(() => {
    let total = 0;
    plays.forEach(play => {
      const amount = parseFloat(play.amount) || 0;
      const primeConfig = primeConfigs.find(p => p.bet_type === play.bet_type);
      if (primeConfig?.payout_formula) {
        const firstPayout = parseFloat(primeConfig.payout_formula.split('|')[0]) || DEFAULT_PAYOUTS[play.bet_type];
        total += amount * firstPayout;
      } else {
        total += amount * (DEFAULT_PAYOUTS[play.bet_type] || 50);
      }
    });
    return total;
  }, [plays, primeConfigs]);
  
  // Handlers
  const handleSelectLottery = useCallback((lotteryId) => {
    setSelectedLotteryId(lotteryId);
    
    // Immediately find and select the first open schedule for this lottery
    const lotterySchedules = schedules.filter(s => s.lottery_id === lotteryId);
    if (lotterySchedules.length > 0) {
      const openSchedule = lotterySchedules.find(s => {
        const status = getLotteryStatus(s);
        return status.canSell;
      });
      if (openSchedule) {
        setSelectedScheduleId(openSchedule.schedule_id);
      } else {
        setSelectedScheduleId(lotterySchedules[0].schedule_id);
      }
    } else {
      setSelectedScheduleId(null);
    }
  }, [schedules]);
  
  const handleAddPlay = useCallback(() => {
    setPlays(prev => [...prev, { numbers: '', bet_type: 'BORLETTE', amount: '' }]);
  }, []);
  
  const handleRemovePlay = useCallback((index) => {
    setPlays(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  }, []);
  
  const handleUpdatePlay = useCallback((index, field, value) => {
    setPlays(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);
  
  const validatePlay = useCallback((play) => {
    const betType = BET_TYPES.find(b => b.value === play.bet_type);
    if (!betType) return false;
    const numbers = play.numbers.replace(/\D/g, '');
    if (numbers.length !== betType.digits) return false;
    const amount = parseFloat(play.amount);
    const minBet = config.min_bet_amount || 10;
    const maxBet = config.max_bet_amount || 10000;
    if (isNaN(amount) || amount < minBet || amount > maxBet) return false;
    return true;
  }, [config]);
  
  const allPlaysValid = useMemo(() => 
    plays.every(p => validatePlay(p)),
    [plays, validatePlay]
  );
  
  const canSubmit = useMemo(() => {
    if (!selectedLottery || !selectedSchedule) return false;
    const status = getLotteryStatus(selectedSchedule);
    if (!status.canSell) return false;
    if (!allPlaysValid) return false;
    if (totalAmount < (config.min_bet_amount || 10)) return false;
    return true;
  }, [selectedLottery, selectedSchedule, allPlaysValid, totalAmount, config]);
  
  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;
    
    // Re-check status before submit
    const status = getLotteryStatus(selectedSchedule);
    if (!status.canSell) {
      toast.error('Ce tirage est fermé. Impossible de vendre.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await fetch(`${API_URL}/api/lottery/sell`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lottery_id: selectedLottery.lottery_id,
          draw_date: today,
          draw_name: selectedSchedule.draw_name,
          plays: plays.map(p => ({
            numbers: p.numbers.replace(/\D/g, ''),
            bet_type: p.bet_type,
            amount: parseFloat(p.amount)
          }))
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Erreur lors de la vente');
      }
      
      setLastTicket(data);
      setShowModal(true);
      toast.success('Ticket vendu avec succès!');
      
      // Reset form
      setPlays([{ numbers: '', bet_type: 'BORLETTE', amount: '' }]);
      
    } catch (error) {
      toast.error(error.message || 'Erreur lors de la vente');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handlePrint = () => {
    if (lastTicket) {
      window.open(`${API_URL}/api/ticket/print/${lastTicket.ticket_id}?auto=true`, '_blank');
    }
  };
  
  // ==================== RENDER ====================
  
  // Loading state
  if (!syncData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-400">Chargement des données...</p>
        <p className="text-xs text-slate-500 mt-2">Si ce message persiste, rafraîchissez la page</p>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          className="mt-4 border-slate-600 text-white"
        >
          Rafraîchir
        </Button>
      </div>
    );
  }
  
  // No lotteries available - with detailed debug and reload button
  if (lotteries.length === 0) {
    const handleForceReload = () => {
      // Clear all caches
      localStorage.removeItem('agent_config_cache');
      sessionStorage.clear();
      // Force reload
      window.location.reload();
    };
    
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-6">
          <AlertTriangle className="w-10 h-10 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Aucune loterie disponible</h2>
        <p className="text-slate-400 max-w-md mb-2">
          Les données n'ont pas été chargées correctement.
        </p>
        
        {/* Debug info */}
        <div className="bg-slate-800/50 rounded-lg p-4 mb-6 text-left max-w-md w-full">
          <p className="text-xs text-slate-500 mb-2">Informations de débogage:</p>
          <p className="text-xs text-slate-400">syncData: {syncData ? 'présent' : 'null'}</p>
          <p className="text-xs text-slate-400">enabled_lotteries: {syncData?.enabled_lotteries?.length || 0}</p>
          <p className="text-xs text-slate-400">schedules: {syncData?.schedules?.length || 0}</p>
          <p className="text-xs text-slate-400">company: {syncData?.company?.name || 'N/A'}</p>
        </div>
        
        <Button
          onClick={handleForceReload}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Loader2 className="w-4 h-4 mr-2" />
          Forcer le rechargement
        </Button>
        <p className="text-xs text-slate-500 mt-4">
          Si le problème persiste, déconnectez-vous et reconnectez-vous.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 pb-24" data-testid="agent-new-sale-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Nouvelle Vente</h1>
          <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
            <span>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <span className="text-emerald-400 font-medium">
              {getHaitiTime().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} (Haiti)
            </span>
          </div>
        </div>
        <div className="bg-slate-800/80 backdrop-blur rounded-xl px-4 py-3 border border-slate-700">
          <p className="text-xs text-slate-400">Gain potentiel</p>
          <p className="text-xl font-bold text-amber-400">
            {potentialWin.toLocaleString()} {currency}
          </p>
        </div>
      </div>
      
      {/* Step 1: Lottery Selection */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-sm flex items-center justify-center">1</span>
            Sélectionnez une loterie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lotteries.map(lottery => {
              // Find first schedule for this lottery
              const lotterySchedules = schedules.filter(s => s.lottery_id === lottery.lottery_id);
              const firstSchedule = lotterySchedules[0];
              
              return (
                <LotteryCard
                  key={lottery.lottery_id}
                  lottery={lottery}
                  schedule={firstSchedule}
                  isSelected={selectedLotteryId === lottery.lottery_id}
                  onSelect={() => handleSelectLottery(lottery.lottery_id)}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Step 2: Schedule Selection (if multiple) */}
      {selectedLottery && availableSchedules.length > 1 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-sm flex items-center justify-center">2</span>
              Sélectionnez un tirage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableSchedules.map(schedule => {
                const status = getLotteryStatus(schedule);
                return (
                  <button
                    key={schedule.schedule_id}
                    onClick={() => status.canSell && setSelectedScheduleId(schedule.schedule_id)}
                    disabled={!status.canSell}
                    className={cn(
                      "p-4 rounded-xl border-2 text-left transition-all",
                      selectedScheduleId === schedule.schedule_id
                        ? "border-emerald-500 bg-emerald-900/30"
                        : status.canSell
                          ? "border-slate-600 bg-slate-700/50 hover:border-slate-500"
                          : "border-slate-700 bg-slate-800/30 opacity-50 cursor-not-allowed"
                    )}
                    data-testid={`schedule-${schedule.schedule_id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">{schedule.draw_name}</span>
                      <Badge className={cn("text-xs", status.color)}>
                        {status.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      Tirage: {schedule.draw_time} | Ferme: {schedule.close_time}
                    </p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Step 3: Plays */}
      {selectedLottery && selectedSchedule && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-sm flex items-center justify-center">
                  {availableSchedules.length > 1 ? '3' : '2'}
                </span>
                Numéros à jouer
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddPlay}
                className="bg-emerald-900/30 border-emerald-600 text-emerald-400 hover:bg-emerald-900/50"
              >
                <Plus size={16} className="mr-1" />
                Ajouter
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {plays.map((play, index) => (
              <PlayRow
                key={index}
                play={play}
                index={index}
                onUpdate={(field, value) => handleUpdatePlay(index, field, value)}
                onRemove={() => handleRemovePlay(index)}
                canRemove={plays.length > 1}
                config={config}
                currency={currency}
              />
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Summary and Submit - Fixed at bottom */}
      {selectedLottery && selectedSchedule && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-slate-900/95 backdrop-blur border-t border-slate-700 p-4 z-30">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-slate-400">Total à payer</p>
                <p className="text-2xl font-bold text-white">
                  {totalAmount.toLocaleString()} {currency}
                </p>
              </div>
              <div className="hidden sm:block">
                <p className="text-xs text-slate-400">Gain potentiel</p>
                <p className="text-xl font-bold text-amber-400">
                  {potentialWin.toLocaleString()} {currency}
                </p>
              </div>
            </div>
            
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className={cn(
                "h-14 px-8 text-lg font-bold transition-all",
                canSubmit 
                  ? "bg-emerald-600 hover:bg-emerald-700" 
                  : "bg-slate-600 cursor-not-allowed"
              )}
              data-testid="submit-sale-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={20} />
                  Traitement...
                </>
              ) : (
                <>
                  <TicketIcon className="mr-2" size={20} />
                  Valider la Vente
                </>
              )}
            </Button>
          </div>
        </div>
      )}
      
      {/* Success Modal */}
      {showModal && (
        <SuccessModal
          ticket={lastTicket}
          onClose={() => setShowModal(false)}
          onPrint={handlePrint}
          currency={currency}
        />
      )}
    </div>
  );
};

export default AgentNewSalePage;
