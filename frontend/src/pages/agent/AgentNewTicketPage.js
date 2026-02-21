import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import { 
  Plus, 
  Trash2, 
  Printer, 
  CheckCircle, 
  AlertCircle,
  X,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const BET_TYPES = [
  { value: 'BORLETTE', label: 'Borlette (2 chiffres)', digits: 2 },
  { value: 'LOTO3', label: 'Loto 3 (3 chiffres)', digits: 3 },
  { value: 'LOTO4', label: 'Loto 4 (4 chiffres)', digits: 4 },
  { value: 'LOTO5', label: 'Loto 5 (5 chiffres)', digits: 5 },
  { value: 'MARIAGE', label: 'Mariage (2x2 chiffres)', digits: 4 },
];

export const AgentNewTicketPage = () => {
  const { syncData } = useOutletContext();
  const { token } = useAuth();
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [plays, setPlays] = useState([{ numbers: '', bet_type: 'BORLETTE', amount: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTicket, setLastTicket] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const numberInputRef = useRef(null);

  const lotteries = syncData?.lotteries || [];
  const schedules = syncData?.schedules || [];
  const config = syncData?.configuration || {};
  const primeConfigs = syncData?.prime_configs || [];

  // Get available schedules for selected lottery
  const availableSchedules = selectedLottery 
    ? schedules.filter(s => s.lottery_id === selectedLottery.lottery_id)
    : [];

  // Calculate total amount
  const totalAmount = plays.reduce((sum, play) => sum + (parseFloat(play.amount) || 0), 0);

  // Calculate potential win
  const calculatePotentialWin = () => {
    let total = 0;
    plays.forEach(play => {
      const amount = parseFloat(play.amount) || 0;
      const primeConfig = primeConfigs.find(p => p.bet_type === play.bet_type);
      if (primeConfig && primeConfig.payout_formula) {
        const firstPayout = parseFloat(primeConfig.payout_formula.split('|')[0]) || 50;
        total += amount * firstPayout;
      } else {
        // Default payouts
        const defaults = { BORLETTE: 50, LOTO3: 500, LOTO4: 5000, LOTO5: 50000, MARIAGE: 1000 };
        total += amount * (defaults[play.bet_type] || 50);
      }
    });
    return total;
  };

  const addPlay = () => {
    setPlays([...plays, { numbers: '', bet_type: 'BORLETTE', amount: '' }]);
  };

  const removePlay = (index) => {
    if (plays.length > 1) {
      setPlays(plays.filter((_, i) => i !== index));
    }
  };

  const updatePlay = (index, field, value) => {
    const updated = [...plays];
    updated[index][field] = value;
    setPlays(updated);
  };

  const validatePlay = (play) => {
    const betType = BET_TYPES.find(b => b.value === play.bet_type);
    if (!betType) return false;
    
    const numbers = play.numbers.replace(/\D/g, '');
    if (numbers.length !== betType.digits) return false;
    
    const amount = parseFloat(play.amount);
    if (isNaN(amount) || amount < (config.min_bet_amount || 10)) return false;
    if (amount > (config.max_bet_amount || 10000)) return false;
    
    return true;
  };

  const handleSubmit = async () => {
    if (!selectedLottery || !selectedSchedule) {
      toast.error('Sélectionnez une loterie et un tirage');
      return;
    }

    // Validate all plays
    const invalidPlays = plays.filter(p => !validatePlay(p));
    if (invalidPlays.length > 0) {
      toast.error('Vérifiez vos numéros et montants');
      return;
    }

    if (totalAmount < (config.min_bet_amount || 10)) {
      toast.error(`Montant minimum: ${config.min_bet_amount || 10}`);
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
      setShowPrintModal(true);
      toast.success('Ticket vendu avec succès!');

      // Reset form
      setPlays([{ numbers: '', bet_type: 'BORLETTE', amount: '' }]);
      
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    if (lastTicket) {
      window.open(`${API_URL}/api/ticket/print/${lastTicket.ticket_id}?auto=true`, '_blank');
    }
  };

  // Quick number buttons for touch interface
  const QuickNumberPad = ({ onInsert }) => {
    const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    return (
      <div className="grid grid-cols-5 gap-2 mt-2">
        {numbers.map(n => (
          <Button
            key={n}
            type="button"
            variant="outline"
            className="h-12 text-lg font-bold bg-slate-700 border-slate-600 hover:bg-slate-600"
            onClick={() => onInsert(n)}
          >
            {n}
          </Button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="new-ticket-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Nouvelle Vente</h1>
        <div className="text-right">
          <p className="text-sm text-slate-400">Gain potentiel</p>
          <p className="text-xl font-bold text-amber-400">
            {calculatePotentialWin().toLocaleString()} {syncData?.company?.currency || 'HTG'}
          </p>
        </div>
      </div>

      {/* Lottery Selection */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white">Sélection du Tirage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Loterie</Label>
              <Select 
                value={selectedLottery?.lottery_id || ''} 
                onValueChange={(v) => {
                  const lottery = lotteries.find(l => l.lottery_id === v);
                  setSelectedLottery(lottery);
                  setSelectedSchedule(null);
                }}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Choisir une loterie" />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  {lotteries.map(l => (
                    <SelectItem key={l.lottery_id} value={l.lottery_id} className="text-white">
                      {l.lottery_name} ({l.state_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300">Tirage</Label>
              <Select 
                value={selectedSchedule?.schedule_id || ''} 
                onValueChange={(v) => {
                  const schedule = availableSchedules.find(s => s.schedule_id === v);
                  setSelectedSchedule(schedule);
                }}
                disabled={!selectedLottery}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Choisir un tirage" />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  {availableSchedules.map(s => (
                    <SelectItem key={s.schedule_id} value={s.schedule_id} className="text-white">
                      {s.draw_name} - {s.draw_time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plays */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white flex items-center justify-between">
            <span>Numéros à jouer</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPlay}
              className="bg-emerald-900/30 border-emerald-700 text-emerald-400 hover:bg-emerald-900/50"
            >
              <Plus size={16} className="mr-1" />
              Ajouter
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {plays.map((play, index) => (
            <div key={index} className="p-4 bg-slate-700/50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Jeu #{index + 1}</span>
                {plays.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removePlay(index)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-slate-300 text-xs">Type de pari</Label>
                  <Select 
                    value={play.bet_type} 
                    onValueChange={(v) => updatePlay(index, 'bet_type', v)}
                  >
                    <SelectTrigger className="bg-slate-600 border-slate-500 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {BET_TYPES.map(bt => (
                        <SelectItem key={bt.value} value={bt.value} className="text-white">
                          {bt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-slate-300 text-xs">Numéros</Label>
                  <Input
                    type="text"
                    value={play.numbers}
                    onChange={(e) => updatePlay(index, 'numbers', e.target.value.replace(/\D/g, ''))}
                    placeholder={`${BET_TYPES.find(b => b.value === play.bet_type)?.digits || 2} chiffres`}
                    className="bg-slate-600 border-slate-500 text-white text-lg font-mono tracking-widest"
                    maxLength={BET_TYPES.find(b => b.value === play.bet_type)?.digits || 2}
                  />
                </div>

                <div>
                  <Label className="text-slate-300 text-xs">Montant ({syncData?.company?.currency || 'HTG'})</Label>
                  <Input
                    type="number"
                    value={play.amount}
                    onChange={(e) => updatePlay(index, 'amount', e.target.value)}
                    placeholder={`Min: ${config.min_bet_amount || 10}`}
                    className="bg-slate-600 border-slate-500 text-white text-lg"
                    min={config.min_bet_amount || 10}
                    max={config.max_bet_amount || 10000}
                  />
                </div>
              </div>

              {/* Validation feedback */}
              {play.numbers && play.amount && (
                <div className="flex items-center gap-2 text-sm">
                  {validatePlay(play) ? (
                    <CheckCircle size={16} className="text-emerald-400" />
                  ) : (
                    <AlertCircle size={16} className="text-red-400" />
                  )}
                  <span className={validatePlay(play) ? 'text-emerald-400' : 'text-red-400'}>
                    {validatePlay(play) ? 'Valide' : 'Vérifiez les données'}
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* Quick amount buttons */}
          <div className="pt-4 border-t border-slate-600">
            <Label className="text-slate-300 text-xs mb-2 block">Montants rapides</Label>
            <div className="flex flex-wrap gap-2">
              {[25, 50, 100, 250, 500, 1000].map(amount => (
                <Button
                  key={amount}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                  onClick={() => {
                    const lastIndex = plays.length - 1;
                    updatePlay(lastIndex, 'amount', amount.toString());
                  }}
                >
                  {amount}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary and Submit */}
      <Card className="bg-emerald-900/30 border-emerald-700">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm text-emerald-300">Total à payer</p>
              <p className="text-3xl font-bold text-white">
                {totalAmount.toLocaleString()} {syncData?.company?.currency || 'HTG'}
              </p>
            </div>
            
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedLottery || !selectedSchedule || plays.some(p => !validatePlay(p))}
              className="h-14 px-8 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              data-testid="submit-ticket-btn"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="animate-spin mr-2" />
                  Traitement...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2" />
                  Valider la Vente
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Print Modal */}
      {showPrintModal && lastTicket && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="bg-slate-800 border-slate-700 max-w-md w-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-emerald-400 flex items-center gap-2">
                  <CheckCircle size={24} />
                  Ticket Créé!
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPrintModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-700/50 p-4 rounded-lg text-center">
                <p className="text-sm text-slate-400">Code du ticket</p>
                <p className="text-2xl font-mono font-bold text-white tracking-wider">
                  {lastTicket.ticket_code}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">Loterie</p>
                  <p className="text-white">{lastTicket.lottery_name}</p>
                </div>
                <div>
                  <p className="text-slate-400">Tirage</p>
                  <p className="text-white">{lastTicket.draw_name}</p>
                </div>
                <div>
                  <p className="text-slate-400">Total</p>
                  <p className="text-emerald-400 font-bold">
                    {lastTicket.total_amount?.toLocaleString()} {lastTicket.currency}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Gain potentiel</p>
                  <p className="text-amber-400 font-bold">
                    {lastTicket.potential_win?.toLocaleString()} {lastTicket.currency}
                  </p>
                </div>
              </div>

              {lastTicket.qr_code && (
                <div className="flex justify-center">
                  <img 
                    src={`data:image/png;base64,${lastTicket.qr_code}`} 
                    alt="QR Code" 
                    className="w-32 h-32"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={handlePrint}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Printer className="mr-2" size={18} />
                  Imprimer
                </Button>
                <Button
                  onClick={() => setShowPrintModal(false)}
                  variant="outline"
                  className="flex-1 border-slate-600 text-white hover:bg-slate-700"
                >
                  Nouvelle Vente
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AgentNewTicketPage;
