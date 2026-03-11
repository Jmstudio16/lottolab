import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  ShoppingCart, Search, Clock, CheckCircle, XCircle, AlertTriangle,
  Plus, Trash2, Printer, RefreshCw, DollarSign, Ticket, Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const VendeurNouvelleVente = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lotteries, setLotteries] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [selectedDraw, setSelectedDraw] = useState(null);
  const [cart, setCart] = useState([]);
  const [currentPlay, setCurrentPlay] = useState({
    numbers: '',
    betType: 'BORLETTE',
    amount: 50
  });
  const [ticketResult, setTicketResult] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const headers = { Authorization: `Bearer ${token}` };

  const BET_TYPES = [
    { value: 'BORLETTE', label: 'Borlette', digits: '2-3' },
    { value: 'LOTO3', label: 'Loto 3', digits: '3' },
    { value: 'LOTO4', label: 'Loto 4', digits: '4' },
    { value: 'LOTO5', label: 'Loto 5', digits: '5' },
    { value: 'MARIAGE', label: 'Mariage', digits: '4' },
    { value: 'MARIAGE_GRATIS', label: 'Mariage Gratis', digits: '4', free: true },
  ];

  // Update time every second for countdown
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
      toast.error('Erreur lors du chargement des loteries');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get lottery status based on schedule - IMPROVED with countdown
  const getLotteryStatus = (lottery) => {
    const now = currentTime;
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMin;
    
    const lotterySchedules = schedules.filter(s => s.lottery_id === lottery.lottery_id);
    
    if (lotterySchedules.length === 0) {
      // No schedule = always open (during business hours)
      if (currentHour >= 7 && currentHour < 22) {
        return { status: 'open', text: 'Ouvert', color: 'text-emerald-400', canSell: true };
      }
      return { status: 'closed', text: 'Fermé (hors horaires)', color: 'text-red-400', canSell: false };
    }
    
    for (const schedule of lotterySchedules) {
      // Parse open time
      let openTimeMinutes = 7 * 60; // Default 7:00 AM
      if (schedule.open_time) {
        const [openHour, openMin] = schedule.open_time.split(':').map(Number);
        openTimeMinutes = openHour * 60 + openMin;
      }
      
      // Parse close time
      if (schedule.close_time) {
        const [closeHour, closeMin] = schedule.close_time.split(':').map(Number);
        const closeTimeMinutes = closeHour * 60 + closeMin;
        
        // Check if we're before opening
        if (currentTimeMinutes < openTimeMinutes) {
          const diffMins = openTimeMinutes - currentTimeMinutes;
          const hours = Math.floor(diffMins / 60);
          const mins = diffMins % 60;
          const timeStr = hours > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : `${mins}min`;
          return { 
            status: 'not_open', 
            text: `Ouvre dans ${timeStr}`, 
            color: 'text-blue-400', 
            canSell: false,
            openTime: schedule.open_time,
            closeTime: schedule.close_time
          };
        }
        
        // Check if we're within open hours
        if (currentTimeMinutes >= openTimeMinutes && currentTimeMinutes < closeTimeMinutes) {
          const diffMins = closeTimeMinutes - currentTimeMinutes;
          const hours = Math.floor(diffMins / 60);
          const mins = diffMins % 60;
          const seconds = 59 - now.getSeconds();
          
          if (diffMins <= 5) {
            // Less than 5 minutes - show seconds countdown
            return { 
              status: 'closing_soon', 
              text: `Ferme dans ${mins}:${seconds.toString().padStart(2, '0')}`, 
              color: 'text-red-400 animate-pulse', 
              canSell: true,
              urgent: true,
              closeTime: schedule.close_time
            };
          } else if (diffMins <= 30) {
            const timeStr = hours > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : `${mins}min`;
            return { 
              status: 'closing', 
              text: `Ferme dans ${timeStr}`, 
              color: 'text-amber-400', 
              canSell: true,
              closeTime: schedule.close_time
            };
          }
          
          return { 
            status: 'open', 
            text: 'Ouvert', 
            color: 'text-emerald-400', 
            canSell: true,
            closeTime: schedule.close_time
          };
        }
      }
    }
    
    return { status: 'closed', text: 'Fermé', color: 'text-red-400', canSell: false };
  };

  // Filter lotteries by search and flag_type
  const filteredLotteries = lotteries.filter(lot => {
    const matchesSearch = lot.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lot.state_code?.toLowerCase().includes(searchTerm.toLowerCase());
    // Use flag_type from backend (HAITI or USA), fallback to state_code check
    const flagType = lot.flag_type || (lot.state_code?.includes('-HT') ? 'HAITI' : 'USA');
    const matchesCategory = selectedCategory === 'all' || 
                           (selectedCategory === 'haiti' && flagType === 'HAITI') ||
                           (selectedCategory === 'usa' && flagType !== 'HAITI');
    return matchesSearch && matchesCategory;
  });

  // Separate open and closed lotteries
  const openLotteries = filteredLotteries.filter(lot => getLotteryStatus(lot).canSell);
  const closedLotteries = filteredLotteries.filter(lot => !getLotteryStatus(lot).canSell);

  // Get available draws for selected lottery
  const getAvailableDraws = (lottery) => {
    if (!lottery) return [];
    // First check lottery.draws
    if (lottery.draws && lottery.draws.length > 0) {
      return lottery.draws;
    }
    // Fallback to schedules
    const lotterySchedules = schedules.filter(s => s.lottery_id === lottery.lottery_id);
    return lotterySchedules.map(s => ({
      name: s.draw_name,
      time: s.draw_time,
      close_time: s.close_time
    }));
  };

  const selectLottery = (lottery) => {
    const status = getLotteryStatus(lottery);
    if (!status.canSell) {
      toast.error(`Cette loterie ${status.status === 'not_open' ? "n'est pas encore ouverte" : 'est fermée'}`);
      return;
    }
    setSelectedLottery(lottery);
    
    // Get available draws
    const draws = getAvailableDraws(lottery);
    if (draws.length > 0) {
      // Auto-select first open draw
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const openDraw = draws.find(d => d.close_time > currentTime) || draws[0];
      setSelectedDraw(openDraw);
    } else {
      setSelectedDraw(null);
    }
  };

  const addToCart = () => {
    if (!currentPlay.numbers || !selectedLottery) {
      toast.error('Veuillez entrer un numéro');
      return;
    }

    // Re-check if lottery is still open
    const status = getLotteryStatus(selectedLottery);
    if (!status.canSell) {
      toast.error('Cette loterie vient de fermer!');
      setSelectedLottery(null);
      return;
    }

    const newItem = {
      id: Date.now(),
      lottery_id: selectedLottery.lottery_id,
      lottery_name: selectedLottery.lottery_name,
      numbers: currentPlay.numbers,
      bet_type: currentPlay.betType,
      amount: currentPlay.amount
    };

    setCart([...cart, newItem]);
    setCurrentPlay({ ...currentPlay, numbers: '' });
    toast.success('Numéro ajouté au panier');
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedLottery(null);
    setSelectedDraw(null);
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.amount, 0);

  const submitSale = async () => {
    if (cart.length === 0) {
      toast.error('Le panier est vide');
      return;
    }

    // Final check - is lottery still open?
    const status = getLotteryStatus(selectedLottery);
    if (!status.canSell) {
      toast.error('ERREUR: La loterie vient de fermer! Vente annulée.');
      return;
    }

    try {
      setSubmitting(true);
      const today = new Date().toISOString().split('T')[0];
      
      const payload = {
        lottery_id: cart[0].lottery_id,
        draw_date: today,
        draw_name: selectedDraw?.name || 'Midi',
        draw_time: selectedDraw?.time || '',
        plays: cart.map(item => ({
          numbers: item.numbers,
          bet_type: item.bet_type,
          amount: item.bet_type === 'MARIAGE_GRATIS' ? 0 : item.amount
        }))
      };

      const res = await axios.post(`${API_URL}/api/lottery/sell`, payload, { headers });
      
      setTicketResult(res.data);
      setCart([]);
      toast.success('Vente validée avec succès!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la vente');
    } finally {
      setSubmitting(false);
    }
  };

  const printTicket = () => {
    if (ticketResult?.ticket_id) {
      window.open(`${API_URL}/api/ticket/print/${ticketResult.ticket_id}?token=${token}&format=thermal`, '_blank');
    }
  };

  const newSale = () => {
    setTicketResult(null);
    setSelectedLottery(null);
    setSelectedDraw(null);
    setCart([]);
  };

  // Success Modal - Clean display without "En attente" and "Gains potentiels"
  if (ticketResult) {
    return (
      <div className="p-6 pb-24 lg:pb-6">
        <div className="max-w-lg mx-auto bg-slate-800/50 border border-emerald-500/30 rounded-2xl p-6 text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Vente Validée!</h2>
          <p className="text-slate-400 mb-6">Ticket créé avec succès</p>
          
          <div className="bg-slate-700/50 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm text-slate-400">Numéro de ticket</p>
            <p className="text-xl font-mono font-bold text-emerald-400">{ticketResult.ticket_code}</p>
            
            {/* Lottery & Draw info */}
            <div className="mt-3 pt-3 border-t border-slate-600">
              <p className="text-sm text-slate-400">Loterie</p>
              <p className="text-lg font-semibold text-white">{selectedLottery?.lottery_name}</p>
            </div>
            
            {selectedDraw && (
              <div className="mt-2">
                <p className="text-sm text-slate-400">Tirage</p>
                <p className="text-lg font-semibold text-amber-400">{selectedDraw.name} - {selectedDraw.time}</p>
              </div>
            )}
            
            <div className="mt-3 pt-3 border-t border-slate-600">
              <p className="text-sm text-slate-400">Montant total</p>
              <p className="text-xl font-bold text-white">{ticketResult.total_amount} HTG</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={printTicket} className="flex-1 bg-blue-600 hover:bg-blue-700">
              <Printer className="w-4 h-4 mr-2" />
              Imprimer
            </Button>
            <Button onClick={newSale} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle Vente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 pb-24 lg:pb-6 space-y-6">
      {/* Header with current time */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ShoppingCart className="w-7 h-7 text-emerald-400" />
            Nouvelle Vente
          </h1>
          <p className="text-slate-400">Sélectionnez une loterie ouverte</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Current Time Display */}
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl border border-slate-700">
            <Clock className="w-4 h-4 text-emerald-400" />
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

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher une loterie..."
            className="pl-10 bg-slate-800 border-slate-700"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'haiti', 'usa'].map(cat => (
            <Button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              className={selectedCategory === cat ? 'bg-emerald-600' : 'border-slate-700'}
            >
              {cat === 'all' ? 'Toutes' : cat === 'haiti' ? '🇭🇹 Haïti' : '🇺🇸 USA'}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Lotteries Grid */}
        <div className="space-y-4">
          {/* Open Lotteries */}
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Loteries Ouvertes ({openLotteries.length})
            </h2>
            
            {loading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              </div>
            ) : openLotteries.length === 0 ? (
              <div className="p-6 bg-slate-800/30 rounded-xl text-center">
                <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400">Aucune loterie ouverte actuellement</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2">
                {openLotteries.map(lottery => {
                  const status = getLotteryStatus(lottery);
                  const isSelected = selectedLottery?.lottery_id === lottery.lottery_id;
                  
                  return (
                    <button
                      key={lottery.lottery_id}
                      onClick={() => selectLottery(lottery)}
                      className={`p-3 rounded-xl text-left transition-all ${
                        isSelected
                          ? 'bg-emerald-500/20 border-2 border-emerald-500'
                          : 'bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50'
                      }`}
                    >
                      <p className="font-medium text-white text-sm truncate">{lottery.lottery_name}</p>
                      <p className="text-xs text-slate-400">{lottery.state_code}</p>
                      <div className={`flex items-center gap-1 text-xs mt-1 ${status.color}`}>
                        {status.urgent && <Timer className="w-3 h-3" />}
                        {status.text}
                      </div>
                      {status.closeTime && (
                        <p className="text-xs text-slate-500">Ferme à {status.closeTime}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Closed/Not Yet Open Lotteries */}
          {closedLotteries.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-400 flex items-center gap-2 mb-3">
                <XCircle className="w-5 h-5 text-slate-500" />
                Non disponibles ({closedLotteries.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[200px] overflow-y-auto pr-2">
                {closedLotteries.slice(0, 20).map(lottery => {
                  const status = getLotteryStatus(lottery);
                  
                  return (
                    <div
                      key={lottery.lottery_id}
                      className="p-3 rounded-xl bg-slate-800/30 border border-slate-700 opacity-60"
                    >
                      <p className="font-medium text-slate-400 text-sm truncate">{lottery.lottery_name}</p>
                      <p className="text-xs text-slate-500">{lottery.state_code}</p>
                      <p className={`text-xs mt-1 ${status.color}`}>{status.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sale Form */}
        <div className="space-y-4">
          {selectedLottery ? (
            <>
              <div className="bg-slate-800/50 border border-emerald-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-emerald-400">
                    {selectedLottery.lottery_name}
                  </h3>
                  {(() => {
                    const status = getLotteryStatus(selectedLottery);
                    return (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        status.urgent 
                          ? 'bg-red-500/20 text-red-400 animate-pulse' 
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {status.text}
                      </span>
                    );
                  })()}
                </div>
                
                {/* Draw Selection - REQUIRED */}
                {getAvailableDraws(selectedLottery).length > 0 && (
                  <div className="mb-4">
                    <label className="text-sm text-slate-400 mb-2 block">Sélectionnez le Tirage *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {getAvailableDraws(selectedLottery).map((draw, idx) => {
                        const isSelected = selectedDraw?.name === draw.name;
                        const now = new Date();
                        const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
                        const isOpen = draw.close_time ? currentTime < draw.close_time : true;
                        
                        return (
                          <button
                            key={idx}
                            onClick={() => isOpen && setSelectedDraw(draw)}
                            disabled={!isOpen}
                            className={`p-3 rounded-lg text-center transition-all ${
                              isSelected
                                ? 'bg-amber-500/30 border-2 border-amber-500 text-amber-400'
                                : isOpen
                                  ? 'bg-slate-700 border border-slate-600 text-slate-300 hover:border-amber-500/50'
                                  : 'bg-slate-800 border border-slate-700 text-slate-500 opacity-50 cursor-not-allowed'
                            }`}
                          >
                            <p className="font-semibold text-sm">{draw.name}</p>
                            <p className="text-xs">{draw.time}</p>
                            {!isOpen && <p className="text-xs text-red-400">Fermé</p>}
                          </button>
                        );
                      })}
                    </div>
                    {selectedDraw && (
                      <p className="text-xs text-amber-400 mt-2">
                        Tirage sélectionné: {selectedDraw.name} à {selectedDraw.time}
                      </p>
                    )}
                  </div>
                )}
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">Numéro</label>
                    <Input
                      value={currentPlay.numbers}
                      onChange={(e) => setCurrentPlay({...currentPlay, numbers: e.target.value.replace(/[^0-9]/g, '')})}
                      placeholder="Ex: 123, 4567"
                      className="bg-slate-700 border-slate-600 text-xl font-mono"
                      maxLength={5}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">Type de mise</label>
                    <div className="grid grid-cols-3 gap-2">
                      {BET_TYPES.map(type => (
                        <button
                          key={type.value}
                          onClick={() => setCurrentPlay({...currentPlay, betType: type.value})}
                          className={`p-2 rounded-lg text-xs transition-all ${
                            currentPlay.betType === type.value
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">Montant (HTG)</label>
                    {currentPlay.betType === 'MARIAGE_GRATIS' ? (
                      <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg text-center">
                        <p className="text-amber-400 font-semibold">Mariage Gratis - 0 HTG</p>
                        <p className="text-xs text-amber-300/70">Combinaison offerte au client</p>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {[25, 50, 100, 200, 500].map(amount => (
                          <button
                            key={amount}
                            onClick={() => setCurrentPlay({...currentPlay, amount})}
                            className={`flex-1 py-2 rounded-lg text-sm transition-all ${
                              currentPlay.amount === amount
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {amount}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button onClick={addToCart} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter au Panier
                  </Button>
                </div>
              </div>

              {/* Cart */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-purple-400" />
                  Récapitulatif ({cart.length})
                </h3>

                {cart.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-4">Panier vide</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg">
                        <div>
                          <p className="text-white font-mono">{item.numbers}</p>
                          <p className="text-xs text-slate-400">{item.bet_type} - {item.lottery_name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-semibold">{item.amount} HTG</span>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1 text-red-400 hover:bg-red-500/10 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-slate-600">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-slate-400">Total</span>
                    <span className="text-2xl font-bold text-white">{totalAmount} HTG</span>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={clearCart} variant="outline" className="flex-1 border-slate-600">
                      Effacer
                    </Button>
                    <Button 
                      onClick={submitSale} 
                      disabled={cart.length === 0 || submitting}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      {submitting ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Valider
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
              <ShoppingCart className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Sélectionnez une loterie ouverte pour commencer</p>
              <p className="text-xs text-slate-500 mt-2">
                Les loteries fermées ou pas encore ouvertes ne sont pas sélectionnables
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendeurNouvelleVente;
