import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Ticket, 
  Plus, 
  Trash2, 
  Send, 
  Clock, 
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  Printer,
  Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ==================== COMPOSANTS ====================

// Composant pour afficher le statut d'un tirage (ouvert/fermé)
const DrawStatus = ({ schedule }) => {
  const [status, setStatus] = useState({ isOpen: false, timeLeft: null });

  useEffect(() => {
    const checkStatus = () => {
      if (!schedule) {
        setStatus({ isOpen: false, timeLeft: null });
        return;
      }

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const parseTime = (timeStr) => {
        if (!timeStr) return null;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
      };

      const openMin = parseTime(schedule.open_time) || 0;
      const closeMin = parseTime(schedule.close_time) || 24 * 60;

      const isOpen = currentMinutes >= openMin && currentMinutes < closeMin;
      let timeLeft = null;

      if (isOpen) {
        const diff = closeMin - currentMinutes;
        timeLeft = { hours: Math.floor(diff / 60), minutes: diff % 60 };
      }

      setStatus({ isOpen, timeLeft });
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [schedule]);

  if (!schedule) return null;

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium",
      status.isOpen 
        ? "bg-emerald-500/20 text-emerald-400" 
        : "bg-red-500/20 text-red-400"
    )}>
      {status.isOpen ? (
        <>
          <CheckCircle className="w-3 h-3" />
          <span>OUVERT</span>
          {status.timeLeft && (
            <span className="text-emerald-300">
              ({status.timeLeft.hours}h {status.timeLeft.minutes}m)
            </span>
          )}
        </>
      ) : (
        <>
          <XCircle className="w-3 h-3" />
          <span>FERMÉ</span>
        </>
      )}
    </div>
  );
};

// Composant Select personnalisé stable
const StableSelect = ({ value, onChange, options, placeholder, disabled, testId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(opt => 
      opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" data-testid={testId}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-all",
          "bg-slate-800 border-slate-600 text-white",
          disabled ? "opacity-50 cursor-not-allowed" : "hover:border-yellow-500 cursor-pointer",
          isOpen && "border-yellow-500 ring-2 ring-yellow-500/20"
        )}
      >
        <span className={selectedOption ? "text-white" : "text-slate-400"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <>
          {/* Overlay pour fermer */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-80 overflow-hidden">
            {/* Search */}
            {options.length > 10 && (
              <div className="p-2 border-b border-slate-700">
                <Input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white text-sm"
                  autoFocus
                />
              </div>
            )}
            
            {/* Options */}
            <div className="max-h-60 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-3 text-slate-400 text-center">
                  Aucun résultat
                </div>
              ) : (
                filteredOptions.map((opt, idx) => (
                  <button
                    key={opt.value || idx}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    disabled={opt.disabled}
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors flex items-center justify-between",
                      opt.disabled 
                        ? "text-slate-500 cursor-not-allowed" 
                        : "text-white hover:bg-slate-700",
                      value === opt.value && "bg-yellow-500/20 text-yellow-400"
                    )}
                  >
                    <div>
                      <div className="font-medium">{opt.label}</div>
                      {opt.sublabel && (
                        <div className="text-xs text-slate-400">{opt.sublabel}</div>
                      )}
                    </div>
                    {opt.status && (
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        opt.status === 'open' ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                      )}>
                        {opt.status === 'open' ? 'Ouvert' : 'Fermé'}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ==================== PAGE PRINCIPALE ====================

export const AgentPOSPageNew = () => {
  const { token, user } = useAuth();
  
  // États de données
  const [lotteries, setLotteries] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // États de formulaire
  const [selectedLotteryId, setSelectedLotteryId] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [plays, setPlays] = useState([{ numbers: '', betType: 'BORLETTE', amount: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTicket, setLastTicket] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  // Charger les données
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${API_URL}/api/device/config`, { headers });
      const data = response.data;
      
      setLotteries(data.enabled_lotteries || []);
      setSchedules(data.schedules || []);
      setConfig(data.configuration || data.company_config || {});
      
      console.log('Data loaded:', {
        lotteries: data.enabled_lotteries?.length || 0,
        schedules: data.schedules?.length || 0
      });
    } catch (err) {
      console.error('Load error:', err);
      setError('Erreur de chargement. Veuillez réessayer.');
      toast.error('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [loadData, token]);

  // Loterie sélectionnée
  const selectedLottery = useMemo(() => 
    lotteries.find(l => l.lottery_id === selectedLotteryId),
    [lotteries, selectedLotteryId]
  );

  // Schedules disponibles pour la loterie sélectionnée
  const availableSchedules = useMemo(() => {
    if (!selectedLotteryId) return [];
    return schedules.filter(s => s.lottery_id === selectedLotteryId);
  }, [schedules, selectedLotteryId]);

  // Schedule sélectionné
  const selectedSchedule = useMemo(() => 
    schedules.find(s => s.schedule_id === selectedScheduleId),
    [schedules, selectedScheduleId]
  );

  // Vérifier si le schedule est ouvert
  const isScheduleOpen = useCallback((schedule) => {
    if (!schedule) return false;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const parseTime = (t) => t ? t.split(':').map(Number).reduce((h, m) => h * 60 + m) : 0;
    const openMin = parseTime(schedule.open_time) || 0;
    const closeMin = parseTime(schedule.close_time) || 24 * 60;
    return currentMinutes >= openMin && currentMinutes < closeMin;
  }, []);

  // Options pour les selects
  const lotteryOptions = useMemo(() => 
    lotteries.map(l => ({
      value: l.lottery_id,
      label: `${l.lottery_name} (${l.state_code || 'N/A'})`,
      sublabel: l.state_code
    })),
    [lotteries]
  );

  const scheduleOptions = useMemo(() => 
    availableSchedules.map(s => {
      const open = isScheduleOpen(s);
      return {
        value: s.schedule_id,
        label: `${s.draw_name} - ${s.draw_time}`,
        sublabel: `Ouv: ${s.open_time || '06:00'} | Ferm: ${s.close_time || '23:00'}`,
        status: open ? 'open' : 'closed',
        disabled: !open
      };
    }),
    [availableSchedules, isScheduleOpen]
  );

  // Handlers
  const handleLotteryChange = (lotteryId) => {
    setSelectedLotteryId(lotteryId);
    setSelectedScheduleId('');
  };

  const handleAddPlay = () => {
    setPlays([...plays, { numbers: '', betType: 'BORLETTE', amount: '' }]);
  };

  const handleRemovePlay = (index) => {
    if (plays.length > 1) {
      setPlays(plays.filter((_, i) => i !== index));
    }
  };

  const handlePlayChange = (index, field, value) => {
    const newPlays = [...plays];
    newPlays[index][field] = value;
    setPlays(newPlays);
  };

  const totalAmount = useMemo(() => 
    plays.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
    [plays]
  );

  const handleSubmit = async () => {
    // Validations
    if (!selectedLotteryId) {
      toast.error('Sélectionnez une loterie');
      return;
    }
    if (!selectedScheduleId) {
      toast.error('Sélectionnez un tirage');
      return;
    }
    if (!isScheduleOpen(selectedSchedule)) {
      toast.error('Ce tirage est fermé. Impossible de vendre.');
      return;
    }

    const validPlays = plays.filter(p => p.numbers && p.amount);
    if (validPlays.length === 0) {
      toast.error('Ajoutez au moins un numéro avec un montant');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await axios.post(
        `${API_URL}/api/pos/sell`,
        {
          lottery_id: selectedLotteryId,
          schedule_id: selectedScheduleId,
          plays: validPlays.map(p => ({
            numbers: p.numbers,
            bet_type: p.betType,
            amount: parseFloat(p.amount)
          })),
          total_amount: totalAmount
        },
        { headers }
      );

      setLastTicket(response.data);
      toast.success('Ticket créé avec succès!');
      
      // Reset form
      setPlays([{ numbers: '', betType: 'BORLETTE', amount: '' }]);
      setSelectedScheduleId('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la création du ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-yellow-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Chargement des loteries...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="bg-red-900/20 border-red-700/50 max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-400 mb-4">{error}</p>
            <Button onClick={loadData} variant="outline" className="border-red-500 text-red-400">
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto" data-testid="agent-pos-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
            <Ticket className="w-6 h-6 text-yellow-400" />
            Nouvelle Vente
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {lotteries.length} loteries disponibles • {schedules.length} tirages
          </p>
        </div>
        
        <Button 
          onClick={loadData} 
          variant="outline" 
          size="sm"
          className="border-slate-600 text-slate-300"
        >
          Actualiser
        </Button>
      </div>

      {/* Formulaire */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">Sélection du Tirage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sélection Loterie */}
          <div className="space-y-2">
            <Label className="text-slate-300 flex items-center gap-2">
              <Ticket className="w-4 h-4" />
              Loterie
            </Label>
            <StableSelect
              value={selectedLotteryId}
              onChange={handleLotteryChange}
              options={lotteryOptions}
              placeholder="Choisir une loterie..."
              testId="lottery-select"
            />
            {selectedLottery && (
              <p className="text-xs text-slate-400">
                État: {selectedLottery.state_code} • ID: {selectedLottery.lottery_id?.slice(-8)}
              </p>
            )}
          </div>

          {/* Sélection Tirage */}
          <div className="space-y-2">
            <Label className="text-slate-300 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Tirage
            </Label>
            <StableSelect
              value={selectedScheduleId}
              onChange={setSelectedScheduleId}
              options={scheduleOptions}
              placeholder="Choisir un tirage..."
              disabled={!selectedLotteryId || availableSchedules.length === 0}
              testId="schedule-select"
            />
            {selectedSchedule && (
              <div className="flex items-center gap-3 mt-2">
                <DrawStatus schedule={selectedSchedule} />
                <span className="text-xs text-slate-400">
                  Tirage à {selectedSchedule.draw_time}
                </span>
              </div>
            )}
            {selectedLotteryId && availableSchedules.length === 0 && (
              <p className="text-xs text-amber-400">Aucun tirage disponible pour cette loterie</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Numéros */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white text-lg">Numéros à Jouer</CardTitle>
          <Button 
            onClick={handleAddPlay}
            size="sm"
            className="bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            <Plus className="w-4 h-4 mr-1" />
            Ajouter
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {plays.map((play, index) => (
            <div 
              key={index} 
              className="grid grid-cols-12 gap-3 items-end p-3 bg-slate-700/50 rounded-lg"
            >
              {/* Numéros */}
              <div className="col-span-4 sm:col-span-3">
                <Label className="text-slate-400 text-xs">Numéro</Label>
                <Input
                  type="text"
                  value={play.numbers}
                  onChange={(e) => handlePlayChange(index, 'numbers', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder="1234"
                  maxLength={4}
                  className="bg-slate-800 border-slate-600 text-white text-center text-lg font-mono"
                />
              </div>

              {/* Type */}
              <div className="col-span-4 sm:col-span-4">
                <Label className="text-slate-400 text-xs">Type</Label>
                <select
                  value={play.betType}
                  onChange={(e) => handlePlayChange(index, 'betType', e.target.value)}
                  className="w-full h-10 px-3 bg-slate-800 border border-slate-600 rounded-md text-white text-sm"
                >
                  <option value="BORLETTE">Borlette</option>
                  <option value="LOTO3">Loto 3</option>
                  <option value="LOTO4">Loto 4</option>
                  <option value="LOTO5">Loto 5</option>
                  <option value="MARIAGE">Mariage</option>
                </select>
              </div>

              {/* Montant */}
              <div className="col-span-3 sm:col-span-4">
                <Label className="text-slate-400 text-xs">Montant</Label>
                <Input
                  type="number"
                  value={play.amount}
                  onChange={(e) => handlePlayChange(index, 'amount', e.target.value)}
                  placeholder="100"
                  min="1"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>

              {/* Supprimer */}
              <div className="col-span-1 flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemovePlay(index)}
                  disabled={plays.length === 1}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {/* Total */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-700">
            <div className="flex items-center gap-2 text-slate-400">
              <DollarSign className="w-5 h-5" />
              <span>Total</span>
            </div>
            <div className="text-2xl font-bold text-yellow-400">
              {totalAmount.toLocaleString()} HTG
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedLotteryId || !selectedScheduleId || totalAmount === 0}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Création...
            </>
          ) : (
            <>
              <Send className="w-5 h-5 mr-2" />
              Créer Ticket ({totalAmount.toLocaleString()} HTG)
            </>
          )}
        </Button>
      </div>

      {/* Dernier Ticket */}
      {lastTicket && (
        <Card className="bg-emerald-900/20 border-emerald-700/50">
          <CardHeader>
            <CardTitle className="text-emerald-400 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Ticket Créé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-400">Code</p>
                <p className="text-white font-mono">{lastTicket.ticket_code || lastTicket.verification_code}</p>
              </div>
              <div>
                <p className="text-slate-400">Montant</p>
                <p className="text-white">{lastTicket.total_amount?.toLocaleString()} HTG</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4 border-emerald-600 text-emerald-400"
              onClick={() => window.print()}
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimer
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AgentPOSPageNew;
