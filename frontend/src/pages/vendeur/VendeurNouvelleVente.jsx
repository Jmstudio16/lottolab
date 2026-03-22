import { API_URL } from '@/config/api';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  ShoppingCart, Search, Clock, CheckCircle, XCircle, AlertTriangle,
  Plus, Trash2, Printer, RefreshCw, DollarSign, Ticket, Timer, Flag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';


const VendeurNouvelleVente = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lotteries, setLotteries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFlag, setSelectedFlag] = useState('all');
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [cart, setCart] = useState([]);
  const [currentPlay, setCurrentPlay] = useState({
    numbers: '',
    numbers2: '', // Second number for Loto4/Loto5
    betType: 'BORLETTE',
    amount: ''
  });
  const [ticketResult, setTicketResult] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mariageGratisCount, setMariageGratisCount] = useState(0); // Auto mariages gratis

  const headers = { Authorization: `Bearer ${token}` };

  const BET_TYPES = [
    { value: 'BORLETTE', label: 'Borlette', digits: '2-3' },
    { value: 'LOTO3', label: 'Loto 3', digits: '3' },
    { value: 'MARIAGE', label: 'Mariage', digits: '4' },
    { value: 'LOTO4_OPT1', label: 'Loto 4 - Option 1', digits: '4', isLoto4: true, maxAmount: 20 },
    { value: 'LOTO4_OPT2', label: 'Loto 4 - Option 2', digits: '4', isLoto4: true, maxAmount: 20 },
    { value: 'LOTO4_OPT3', label: 'Loto 4 - Option 3', digits: '4', isLoto4: true, maxAmount: 20 },
    { value: 'LOTO5_EXTRA1', label: 'Loto 5 - Extra 1 (1+2)', digits: '5', isLoto5: true, minAmount: 20, maxAmount: 250 },
    { value: 'LOTO5_EXTRA2', label: 'Loto 5 - Extra 2 (1+3)', digits: '5', isLoto5: true, minAmount: 20, maxAmount: 250 },
  ];

  // Calculate mariages gratis based on total - CORRECTED THRESHOLDS
  // 100 HTG = 1, 150 HTG = 2, 200 HTG = 2, 250 HTG = 3, 300 HTG = 3
  const calculateMariagesGratis = (total) => {
    if (total >= 300) return 3;
    if (total >= 250) return 3;
    if (total >= 200) return 2;
    if (total >= 150) return 2;
    if (total >= 100) return 1;
    return 0;
  };

  // Generate random marriage numbers (system chooses, not vendor)
  const generateMariageNumbers = () => {
    const num1 = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const num2 = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `${num1}-${num2}`;
  };

  // Update time every second
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
    } catch (error) {
      toast.error('Erreur lors du chargement des loteries');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get lottery status based on its integrated schedule
  // SYNCHRONIZED with VendeurTirages.jsx - same logic
  const getLotteryStatus = (lottery) => {
    const now = currentTime;
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentSec = now.getSeconds();
    const currentTimeMinutes = currentHour * 60 + currentMin;
    
    // Each lottery has open_time, close_time, draw_time
    const openTime = lottery.open_time;
    const closeTime = lottery.close_time;
    const drawTime = lottery.draw_time;
    
    // If no close_time defined, lottery is always open (24h mode)
    if (!closeTime) {
      return { status: 'open', text: 'Ouvert 24h', color: 'text-emerald-400', canSell: true, drawTime };
    }
    
    // Parse open time (default: 06:00)
    let openTimeMinutes = 6 * 60;
    if (openTime) {
      const [h, m] = openTime.split(':').map(Number);
      openTimeMinutes = h * 60 + m;
    }
    
    // Parse close time
    const [closeH, closeM] = closeTime.split(':').map(Number);
    const closeTimeMinutes = closeH * 60 + closeM;
    
    // Before opening
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
        drawTime
      };
    }
    
    // After closing
    if (currentTimeMinutes >= closeTimeMinutes) {
      return { 
        status: 'closed', 
        text: 'Fermé', 
        color: 'text-red-400', 
        canSell: false,
        drawTime
      };
    }
    
    // Currently open - calculate time remaining
    const diffMins = closeTimeMinutes - currentTimeMinutes;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (diffMins <= 5) {
      // Less than 5 minutes - show countdown with seconds
      const totalSecs = (diffMins - 1) * 60 + (59 - currentSec);
      const displayMins = Math.floor(totalSecs / 60);
      const displaySecs = totalSecs % 60;
      return { 
        status: 'closing_soon', 
        text: `Ferme dans ${displayMins}:${displaySecs.toString().padStart(2, '0')}`, 
        color: 'text-red-400 animate-pulse', 
        canSell: true,
        urgent: true,
        drawTime
      };
    } else if (diffMins <= 30) {
      const timeStr = hours > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : `${mins}min`;
      return { 
        status: 'closing', 
        text: `Ferme dans ${timeStr}`, 
        color: 'text-amber-400', 
        canSell: true,
        drawTime
      };
    }
    
    // More than 30 mins remaining
    const timeStr = hours > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : `${mins}min`;
    return { 
      status: 'open', 
      text: `Ouvert (${timeStr})`, 
      color: 'text-emerald-400', 
      canSell: true,
      drawTime
    };
  };

  // Filter lotteries by search and flag_type
  const filteredLotteries = lotteries.filter(lot => {
    const matchesSearch = lot.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lot.state_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const flagType = lot.flag_type || 'USA';
    const matchesFlag = selectedFlag === 'all' || 
                       (selectedFlag === 'haiti' && flagType === 'HAITI') ||
                       (selectedFlag === 'usa' && flagType !== 'HAITI');
    return matchesSearch && matchesFlag;
  });

  // Separate open and closed lotteries, sort Haiti first
  const sortByFlag = (a, b) => {
    const flagA = a.flag_type || 'USA';
    const flagB = b.flag_type || 'USA';
    const nameA = a.lottery_name || '';
    const nameB = b.lottery_name || '';
    
    // Haiti flag first
    if (flagA === 'HAITI' && flagB !== 'HAITI') return -1;
    if (flagA !== 'HAITI' && flagB === 'HAITI') return 1;
    
    // Within Haiti, put "Haiti" named ones first
    if (flagA === 'HAITI' && flagB === 'HAITI') {
      const isHaitiNameA = nameA.startsWith('Haiti');
      const isHaitiNameB = nameB.startsWith('Haiti');
      if (isHaitiNameA && !isHaitiNameB) return -1;
      if (!isHaitiNameA && isHaitiNameB) return 1;
    }
    
    return nameA.localeCompare(nameB);
  };
  const openLotteries = filteredLotteries.filter(lot => getLotteryStatus(lot).canSell).sort(sortByFlag);
  const closedLotteries = filteredLotteries.filter(lot => !getLotteryStatus(lot).canSell).sort(sortByFlag);

  const selectLottery = (lottery) => {
    const status = getLotteryStatus(lottery);
    if (!status.canSell) {
      toast.error(`Cette loterie ${status.status === 'not_open' ? "n'est pas encore ouverte" : 'est fermée'}`);
      return;
    }
    setSelectedLottery(lottery);
  };

  const addToCart = () => {
    if (!currentPlay.numbers || !selectedLottery) {
      toast.error('Veuillez entrer un numéro');
      return;
    }

    // For Loto4 and Loto5 options, require second number
    const betType = BET_TYPES.find(bt => bt.value === currentPlay.betType);
    if ((betType?.isLoto4 || betType?.isLoto5) && !currentPlay.numbers2) {
      toast.error('Veuillez entrer le deuxième numéro');
      return;
    }

    const amount = parseFloat(currentPlay.amount) || 0;
    
    // Minimum 1 HTG for all bet types (except Loto5 which has 20 HTG minimum)
    if (amount < 1) {
      toast.error('Montant minimum: 1 HTG');
      return;
    }
    
    // Validate Loto4 max limit (20 HTG)
    if (betType?.isLoto4) {
      if (amount > 20) {
        toast.error('Montant maximum pour Loto 4: 20 HTG');
        return;
      }
    }
    
    // Validate Loto5 min/max (min 20 HTG, max 250 HTG)
    if (betType?.isLoto5) {
      if (amount < 20) {
        toast.error('Montant minimum pour Loto 5: 20 HTG');
        return;
      }
      if (amount > 250) {
        toast.error('Montant maximum pour Loto 5: 250 HTG');
        return;
      }
    }

    // Re-check if lottery is still open
    const status = getLotteryStatus(selectedLottery);
    if (!status.canSell) {
      toast.error('Cette loterie vient de fermer!');
      setSelectedLottery(null);
      return;
    }

    // Combine numbers for Loto4/Loto5
    let finalNumbers = currentPlay.numbers;
    if (betType?.isLoto4 || betType?.isLoto5) {
      finalNumbers = `${currentPlay.numbers}-${currentPlay.numbers2}`;
    }

    const newItem = {
      id: Date.now(),
      lottery_id: selectedLottery.lottery_id,
      lottery_name: selectedLottery.lottery_name,
      numbers: finalNumbers,
      bet_type: currentPlay.betType,
      amount: amount
    };

    setCart([...cart, newItem]);
    setCurrentPlay({ ...currentPlay, numbers: '', numbers2: '', amount: '' });
    toast.success('Numéro ajouté au panier');
  };

  // Auto-add mariages gratis when total reaches thresholds
  const addMariagesGratisToCart = (newCart) => {
    const total = newCart.filter(item => item.bet_type !== 'MARIAGE_GRATIS').reduce((sum, item) => sum + item.amount, 0);
    const requiredMariages = calculateMariagesGratis(total);
    const currentMariages = newCart.filter(item => item.bet_type === 'MARIAGE_GRATIS').length;
    
    if (requiredMariages > currentMariages && selectedLottery) {
      const newMariages = [];
      for (let i = currentMariages; i < requiredMariages; i++) {
        newMariages.push({
          id: Date.now() + i,
          lottery_id: selectedLottery.lottery_id,
          lottery_name: selectedLottery.lottery_name,
          numbers: generateMariageNumbers(),
          bet_type: 'MARIAGE_GRATIS',
          amount: 0,
          isAutoGenerated: true
        });
      }
      if (newMariages.length > 0) {
        toast.success(`🎁 ${newMariages.length} Mariage(s) Gratis ajouté(s) automatiquement!`);
      }
      return [...newCart, ...newMariages];
    }
    return newCart;
  };

  // Watch cart changes to add mariages gratis
  useEffect(() => {
    if (cart.length > 0 && selectedLottery) {
      const total = cart.filter(item => item.bet_type !== 'MARIAGE_GRATIS').reduce((sum, item) => sum + item.amount, 0);
      const requiredMariages = calculateMariagesGratis(total);
      const currentMariages = cart.filter(item => item.bet_type === 'MARIAGE_GRATIS').length;
      
      if (requiredMariages > currentMariages) {
        const newMariages = [];
        for (let i = currentMariages; i < requiredMariages; i++) {
          newMariages.push({
            id: Date.now() + Math.random(),
            lottery_id: selectedLottery.lottery_id,
            lottery_name: selectedLottery.lottery_name,
            numbers: generateMariageNumbers(),
            bet_type: 'MARIAGE_GRATIS',
            amount: 0,
            isAutoGenerated: true
          });
        }
        if (newMariages.length > 0) {
          toast.success(`🎁 ${newMariages.length} Mariage(s) Gratis ajouté(s) automatiquement!`);
          setCart([...cart, ...newMariages]);
        }
      }
    }
  }, [cart.length, selectedLottery]);

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedLottery(null);
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
      
      // Extract draw_name from lottery_name (e.g., "Tennessee Matin 10h15" -> "Matin")
      const drawName = selectedLottery.draw_name || 'Midi';
      
      const payload = {
        lottery_id: cart[0].lottery_id,
        draw_date: today,
        draw_name: drawName,
        draw_time: selectedLottery.draw_time || '',
        plays: cart.map(item => ({
          numbers: item.numbers,
          bet_type: item.bet_type,
          amount: item.amount
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
    setCart([]);
  };

  // Success Modal
  if (ticketResult) {
    return (
      <div className="p-4 sm:p-6 pb-24 lg:pb-6">
        <div className="max-w-lg mx-auto bg-slate-800/50 border border-emerald-500/30 rounded-2xl p-4 sm:p-6 text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Vente Validée!</h2>
          <p className="text-slate-400 mb-6">Ticket créé avec succès</p>
          
          <div className="bg-slate-700/50 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm text-slate-400">Numéro de ticket</p>
            <p className="text-lg sm:text-xl font-mono font-bold text-emerald-400">{ticketResult.ticket_code}</p>
            
            <div className="mt-3 pt-3 border-t border-slate-600">
              <p className="text-sm text-slate-400">Loterie</p>
              <p className="text-base sm:text-lg font-semibold text-white">{selectedLottery?.lottery_name}</p>
            </div>
            
            <div className="mt-3 pt-3 border-t border-slate-600">
              <p className="text-sm text-slate-400">Montant total</p>
              <p className="text-lg sm:text-xl font-bold text-white">{ticketResult.total_amount} HTG</p>
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
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <ShoppingCart className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400" />
            Nouvelle Vente
          </h1>
          <p className="text-sm text-slate-400">Sélectionnez une loterie</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-xl border border-slate-700">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="text-white font-mono text-sm sm:text-lg">
              {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm" className="border-slate-700">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Search & Flag Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
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
          {[
            { key: 'all', label: 'Toutes', icon: null },
            { key: 'haiti', label: '🇭🇹', icon: null },
            { key: 'usa', label: '🇺🇸', icon: null }
          ].map(flag => (
            <Button
              key={flag.key}
              onClick={() => setSelectedFlag(flag.key)}
              variant={selectedFlag === flag.key ? 'default' : 'outline'}
              className={`px-4 ${selectedFlag === flag.key ? 'bg-emerald-600' : 'border-slate-700'}`}
              data-testid={`flag-${flag.key}`}
            >
              {flag.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Lotteries Grid */}
        <div className="space-y-4">
          {/* Open Lotteries */}
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2 mb-3">
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
                <p className="text-slate-400 text-sm">Aucune loterie ouverte actuellement</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-2 max-h-[200px] overflow-y-auto pr-1">
                {openLotteries.map(lottery => {
                  const status = getLotteryStatus(lottery);
                  const isSelected = selectedLottery?.lottery_id === lottery.lottery_id;
                  const flagType = lottery.flag_type || 'USA';
                  
                  return (
                    <button
                      key={lottery.lottery_id}
                      onClick={() => selectLottery(lottery)}
                      data-testid={`lottery-${lottery.lottery_id}`}
                      className={`p-2 rounded-lg text-left transition-all ${
                        isSelected
                          ? 'bg-emerald-500/20 border-2 border-emerald-500'
                          : 'bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50'
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-sm">{flagType === 'HAITI' ? '🇭🇹' : '🇺🇸'}</span>
                        <span className="font-medium text-white text-xs truncate">{lottery.lottery_name}</span>
                      </div>
                      <span className={`text-xs px-1 py-0.5 rounded ${status.urgent ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {status.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sale Form */}
        <div className="space-y-4">
          {selectedLottery ? (
            <>
              <div className="bg-slate-800/50 border border-emerald-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-emerald-400 text-sm sm:text-base">
                      {selectedLottery.lottery_name}
                    </h3>
                    {selectedLottery.draw_time && (
                      <p className="text-xs text-slate-400">Tirage à {selectedLottery.draw_time}</p>
                    )}
                  </div>
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
                
                <div className="space-y-4">
                  {/* Number Input */}
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">Numéro *</label>
                    <Input
                      value={currentPlay.numbers}
                      onChange={(e) => setCurrentPlay({...currentPlay, numbers: e.target.value.replace(/[^0-9]/g, '')})}
                      placeholder="Ex: 123, 4567"
                      className="bg-slate-700 border-slate-600 text-lg sm:text-xl font-mono"
                      maxLength={5}
                      data-testid="number-input"
                    />
                    
                    {/* Second number input for Loto4/Loto5 */}
                    {(BET_TYPES.find(bt => bt.value === currentPlay.betType)?.isLoto4 || 
                      BET_TYPES.find(bt => bt.value === currentPlay.betType)?.isLoto5) && (
                      <Input
                        value={currentPlay.numbers2}
                        onChange={(e) => setCurrentPlay({...currentPlay, numbers2: e.target.value.replace(/[^0-9]/g, '')})}
                        placeholder="2ème numéro"
                        className="bg-slate-700 border-slate-600 text-lg sm:text-xl font-mono mt-2"
                        maxLength={5}
                        data-testid="number-input-2"
                      />
                    )}
                  </div>

                  {/* Bet Type */}
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Type de mise</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {BET_TYPES.map(type => (
                        <button
                          key={type.value}
                          onClick={() => setCurrentPlay({...currentPlay, betType: type.value, numbers2: ''})}
                          data-testid={`bet-type-${type.value}`}
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

                  {/* Amount Input */}
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">Montant (HTG) *</label>
                    <Input
                      type="number"
                      value={currentPlay.amount}
                      onChange={(e) => setCurrentPlay({...currentPlay, amount: e.target.value})}
                      placeholder="Entrez le montant (ex: 50, 100, 500...)"
                      className="bg-slate-700 border-slate-600 text-lg font-semibold"
                      min="0"
                      step="1"
                      data-testid="amount-input"
                    />
                    <p className="text-xs text-slate-500 mt-1">Montant libre - Aucune limite</p>
                    
                    {/* Mariages Gratis indicator */}
                    {totalAmount >= 50 && (
                      <div className="mt-2 p-2 bg-amber-500/20 border border-amber-500/30 rounded-lg">
                        <p className="text-amber-400 text-xs font-semibold">
                          🎁 {calculateMariagesGratis(totalAmount)} Mariage(s) Gratis disponible(s)
                        </p>
                        <p className="text-amber-300/70 text-xs">Automatique selon total: 50HTG=1, 100HTG=2, 150HTG=3</p>
                      </div>
                    )}
                  </div>

                  <Button 
                    onClick={addToCart} 
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    data-testid="add-to-cart-btn"
                  >
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
                          <p className="text-white font-mono text-sm sm:text-base">{item.numbers}</p>
                          <p className="text-xs text-slate-400">{item.bet_type}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-semibold text-sm">{item.amount} HTG</span>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1 text-red-400 hover:bg-red-500/10 rounded"
                            data-testid={`remove-item-${item.id}`}
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
                    <span className="text-xl sm:text-2xl font-bold text-white">{totalAmount} HTG</span>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={clearCart} variant="outline" className="flex-1 border-slate-600">
                      Effacer
                    </Button>
                    <Button 
                      onClick={submitSale} 
                      disabled={cart.length === 0 || submitting}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      data-testid="validate-sale-btn"
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
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 sm:p-8 text-center">
              <ShoppingCart className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Sélectionnez une loterie ouverte pour commencer</p>
              <p className="text-xs text-slate-500 mt-2">
                Chaque loterie a son propre tirage (Matin, Midi, Soir, Nuit)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendeurNouvelleVente;
