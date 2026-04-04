import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLotoPamAuth } from '../../context/LotoPamAuthContext';
import LotoPamLayout from '../../layouts/LotoPamLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Gamepad2, Clock, Plus, Trash2, ArrowRight, 
  Loader2, AlertTriangle, Wallet, Check, ChevronDown, ChevronUp, Timer
} from 'lucide-react';

// Countdown Timer Component
const CountdownTimer = ({ initialSeconds, onExpire }) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  
  useEffect(() => {
    if (seconds <= 0) {
      onExpire?.();
      return;
    }
    
    const timer = setInterval(() => {
      setSeconds(s => s - 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [seconds, onExpire]);
  
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const isUrgent = seconds < 300; // Less than 5 minutes
  
  return (
    <div className={`flex items-center gap-2 ${isUrgent ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>
      <Timer className="w-4 h-4" />
      <span className="font-mono font-bold">
        {hours > 0 && `${hours}:`}
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
      {isUrgent && <span className="text-xs">Ferme bientôt!</span>}
    </div>
  );
};

const LotoPamLotteryPlayPage = () => {
  const { t } = useTranslation();
  const { lotteryId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, player, wallet, refreshWallet, apiClient } = useLotoPamAuth();
  
  const [lotteries, setLotteries] = useState([]);
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showLotteryList, setShowLotteryList] = useState(!lotteryId);
  const [drawClosed, setDrawClosed] = useState(false);
  
  // Betting state
  const [plays, setPlays] = useState([
    { number: '', bet_type: 'straight', amount: 50 }
  ]);

  const betTypes = [
    { value: 'straight', label: 'Dirèk (Straight)', multiplier: 500 },
    { value: 'box', label: 'Bwat (Box)', multiplier: 80 },
    { value: 'combo', label: 'Konbinezon (Combo)', multiplier: 100 }
  ];

  useEffect(() => {
    if (isAuthenticated) {
      loadLotteries();
      
      // Refresh lottery data every minute for countdown updates
      const interval = setInterval(loadLotteries, 60000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadLotteries = async () => {
    try {
      const response = await apiClient.get('/api/online/lotteries');
      const data = response.data.lotteries || [];
      setLotteries(data);
      
      if (lotteryId) {
        const lottery = data.find(l => l.lottery_id === lotteryId);
        if (lottery) {
          setSelectedLottery(lottery);
          if (lottery.schedules?.length > 0) {
            // Select first open schedule
            const openSchedule = lottery.schedules.find(s => s.is_open) || lottery.schedules[0];
            setSelectedSchedule(openSchedule);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load lotteries:', error);
      toast.error('Erreur lors du chargement des loteries');
    } finally {
      setLoading(false);
    }
  };

  const selectLottery = (lottery) => {
    setSelectedLottery(lottery);
    if (lottery.schedules?.length > 0) {
      setSelectedSchedule(lottery.schedules[0]);
    }
    setShowLotteryList(false);
  };

  const addPlay = () => {
    setPlays([...plays, { number: '', bet_type: 'straight', amount: 50 }]);
  };

  const removePlay = (index) => {
    if (plays.length > 1) {
      setPlays(plays.filter((_, i) => i !== index));
    }
  };

  const updatePlay = (index, field, value) => {
    const newPlays = [...plays];
    newPlays[index][field] = value;
    setPlays(newPlays);
  };

  const getTotalAmount = () => {
    return plays.reduce((sum, play) => sum + (parseFloat(play.amount) || 0), 0);
  };

  const getPotentialWin = () => {
    return plays.reduce((sum, play) => {
      const betType = betTypes.find(b => b.value === play.bet_type);
      return sum + ((parseFloat(play.amount) || 0) * (betType?.multiplier || 0));
    }, 0);
  };

  const validatePlays = () => {
    for (const play of plays) {
      if (!play.number || play.number.length < 2 || play.number.length > 5) {
        return 'Chaque numéro doit avoir entre 2 et 5 chiffres';
      }
      if (!/^\d+$/.test(play.number)) {
        return 'Les numéros doivent contenir uniquement des chiffres';
      }
      if (play.amount < 1) {
        return 'Mise minimum: 1 HTG';
      }
      if (play.amount > 1000) {
        return 'Mise maximum: 1000 HTG';
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!selectedLottery || !selectedSchedule) {
      toast.error('Sélectionnez une loterie et un tirage');
      return;
    }
    
    // Check if draw is still open
    if (!selectedSchedule.is_open || drawClosed) {
      toast.error('Ce tirage est fermé. Sélectionnez un autre tirage.');
      return;
    }

    const validationError = validatePlays();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const total = getTotalAmount();
    if (total > (wallet?.balance || 0)) {
      toast.error('Solde insuffisant. Veuillez déposer de l\'argent.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.post('/api/online/tickets/create', {
        game_id: selectedLottery.lottery_id,
        schedule_id: selectedSchedule.schedule_id,
        plays: plays.map(p => ({
          number: p.number,
          bet_type: p.bet_type,
          amount: parseFloat(p.amount)
        }))
      });

      toast.success('Ticket créé avec succès!');
      refreshWallet();
      
      // Reset form
      setPlays([{ number: '', bet_type: 'straight', amount: 50 }]);
      
      // Navigate to tickets
      navigate('/lotopam/my-tickets');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création du ticket');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <LotoPamLayout>
        <div className="max-w-2xl mx-auto py-20 text-center px-4">
          <Gamepad2 className="w-20 h-20 mx-auto mb-6 text-yellow-400 opacity-50" />
          <h2 className="text-3xl font-bold text-white mb-4">Connectez-vous pour jouer</h2>
          <p className="text-slate-400 mb-8">Créez un compte gratuit et déposez de l'argent pour commencer à jouer</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/lotopam/register"
              className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-slate-900 font-bold rounded-xl hover:shadow-xl transition-all"
            >
              Créer un Compte
            </Link>
            <Link
              to="/lotopam/login"
              className="px-8 py-3 bg-slate-800 border border-slate-600 text-white font-medium rounded-xl hover:border-yellow-500/50 transition-all"
            >
              Se Connecter
            </Link>
          </div>
        </div>
      </LotoPamLayout>
    );
  }

  if (loading) {
    return (
      <LotoPamLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-12 h-12 animate-spin text-yellow-400" />
        </div>
      </LotoPamLayout>
    );
  }

  return (
    <LotoPamLayout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{t('lotopam.lottery')}</h1>
          <p className="text-slate-400">Sélectionnez une loterie et placez vos paris</p>
        </div>

        {/* Balance Warning */}
        {wallet?.balance < 50 && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-4">
            <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-yellow-400 font-medium">Solde faible</p>
              <p className="text-sm text-slate-400">Votre solde est de {wallet?.balance?.toLocaleString() || 0} HTG</p>
            </div>
            <Link to="/lotopam/wallet" className="px-4 py-2 bg-yellow-500 text-slate-900 font-bold rounded-lg">
              Déposer
            </Link>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Lottery Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Lottery Selector */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <button
                onClick={() => setShowLotteryList(!showLotteryList)}
                className="w-full flex items-center justify-between"
              >
                <div>
                  <h3 className="text-lg font-bold text-white">{t('lottery.selectLottery')}</h3>
                  {selectedLottery && (
                    <p className="text-yellow-400 mt-1">{selectedLottery.lottery_name} ({selectedLottery.state_code})</p>
                  )}
                </div>
                {showLotteryList ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>

              {showLotteryList && (
                <div className="mt-4 max-h-80 overflow-y-auto space-y-2">
                  {lotteries.map((lottery) => (
                    <button
                      key={lottery.lottery_id}
                      onClick={() => selectLottery(lottery)}
                      className={`w-full p-4 rounded-xl text-left transition-all ${
                        selectedLottery?.lottery_id === lottery.lottery_id
                          ? 'bg-yellow-500/20 border-2 border-yellow-500'
                          : 'bg-slate-900/50 border border-slate-700 hover:border-yellow-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white">{lottery.lottery_name}</p>
                          <p className="text-sm text-slate-400">{lottery.state_code}</p>
                        </div>
                        {lottery.schedules?.length > 0 && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                            {lottery.schedules.length} tirage(s)
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                  {lotteries.length === 0 && (
                    <p className="text-center py-8 text-slate-400">Aucune loterie disponible</p>
                  )}
                </div>
              )}
            </div>

            {/* Schedule Selection */}
            {selectedLottery && selectedLottery.schedules?.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Sélectionner le Tirage</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {selectedLottery.schedules.map((schedule) => (
                    <button
                      key={schedule.schedule_id}
                      onClick={() => {
                        if (schedule.is_open) {
                          setSelectedSchedule(schedule);
                          setDrawClosed(false);
                        } else {
                          toast.error('Ce tirage est fermé');
                        }
                      }}
                      disabled={!schedule.is_open}
                      className={`p-4 rounded-xl text-left transition-all ${
                        !schedule.is_open
                          ? 'bg-slate-900/30 border border-slate-800 opacity-50 cursor-not-allowed'
                          : selectedSchedule?.schedule_id === schedule.schedule_id
                            ? 'bg-yellow-500/20 border-2 border-yellow-500'
                            : 'bg-slate-900/50 border border-slate-700 hover:border-yellow-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Clock className={`w-5 h-5 ${schedule.is_open ? 'text-yellow-400' : 'text-slate-500'}`} />
                          <div>
                            <p className={`font-medium ${schedule.is_open ? 'text-white' : 'text-slate-500'}`}>
                              {schedule.draw_type || schedule.draw_name}
                            </p>
                            <p className="text-sm text-slate-400">{schedule.draw_time}</p>
                          </div>
                        </div>
                        {schedule.is_open && schedule.seconds_until_close > 0 ? (
                          <CountdownTimer 
                            initialSeconds={schedule.seconds_until_close} 
                            onExpire={() => {
                              if (selectedSchedule?.schedule_id === schedule.schedule_id) {
                                setDrawClosed(true);
                                toast.warning('Ce tirage est maintenant fermé');
                              }
                            }}
                          />
                        ) : (
                          <span className="text-xs text-red-400 font-medium">FERMÉ</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Plays Section */}
            {selectedLottery && selectedSchedule && !drawClosed && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Vos Paris</h3>
                  <Button
                    onClick={addPlay}
                    variant="outline"
                    size="sm"
                    className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter
                  </Button>
                </div>

                <div className="space-y-4">
                  {plays.map((play, index) => (
                    <div
                      key={index}
                      className="p-4 bg-slate-900/50 border border-slate-700 rounded-xl space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-400">Pari #{index + 1}</span>
                        {plays.length > 1 && (
                          <button
                            onClick={() => removePlay(index)}
                            className="p-1 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm text-slate-400 mb-1">Numéro</label>
                          <Input
                            type="text"
                            value={play.number}
                            onChange={(e) => updatePlay(index, 'number', e.target.value.replace(/\D/g, '').slice(0, 5))}
                            className="bg-slate-800 border-slate-600 text-white text-center text-xl tracking-widest font-mono"
                            placeholder="123"
                            maxLength={5}
                            data-testid={`play-number-${index}`}
                          />
                        </div>

                        <div>
                          <label className="block text-sm text-slate-400 mb-1">Type</label>
                          <select
                            value={play.bet_type}
                            onChange={(e) => updatePlay(index, 'bet_type', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                          >
                            {betTypes.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm text-slate-400 mb-1">Montant (HTG)</label>
                          <Input
                            type="number"
                            value={play.amount}
                            onChange={(e) => updatePlay(index, 'amount', e.target.value)}
                            className="bg-slate-800 border-slate-600 text-white"
                            min={10}
                            data-testid={`play-amount-${index}`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Gain potentiel:</span>
                        <span className="text-green-400 font-bold">
                          {((parseFloat(play.amount) || 0) * (betTypes.find(b => b.value === play.bet_type)?.multiplier || 0)).toLocaleString()} HTG
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Résumé</h3>

              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3 text-slate-300">
                  <Wallet className="w-5 h-5 text-yellow-400" />
                  <span>Solde: <strong className="text-yellow-400">{wallet?.balance?.toLocaleString() || 0} HTG</strong></span>
                </div>

                {selectedLottery && (
                  <div className="p-3 bg-slate-900/50 rounded-lg">
                    <p className="text-sm text-slate-400">Loterie</p>
                    <p className="font-medium text-white">{selectedLottery.lottery_name}</p>
                  </div>
                )}

                {selectedSchedule && (
                  <div className="p-3 bg-slate-900/50 rounded-lg">
                    <p className="text-sm text-slate-400">Tirage</p>
                    <p className="font-medium text-white">{selectedSchedule.draw_type} - {selectedSchedule.draw_time}</p>
                  </div>
                )}

                <div className="p-3 bg-slate-900/50 rounded-lg">
                  <p className="text-sm text-slate-400">Nombre de paris</p>
                  <p className="font-medium text-white">{plays.length}</p>
                </div>

                <div className="border-t border-slate-700 pt-4">
                  <div className="flex justify-between text-lg">
                    <span className="text-slate-300">Total:</span>
                    <span className="font-bold text-white">{getTotalAmount().toLocaleString()} HTG</span>
                  </div>
                  <div className="flex justify-between text-lg mt-2">
                    <span className="text-slate-300">Gain potentiel:</span>
                    <span className="font-bold text-green-400">{getPotentialWin().toLocaleString()} HTG</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting || !selectedLottery || !selectedSchedule || plays.some(p => !p.number)}
                className="w-full h-14 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-slate-900 font-bold text-lg disabled:opacity-50"
                data-testid="submit-ticket"
              >
                {submitting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Confirmer le Pari
                  </>
                )}
              </Button>

              <p className="text-xs text-slate-500 text-center mt-3">
                En confirmant, vous acceptez les conditions de jeu
              </p>
            </div>
          </div>
        </div>
      </div>
    </LotoPamLayout>
  );
};

export default LotoPamLotteryPlayPage;
