import { API_URL } from '@/config/api';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { 
  ShoppingCart, Search, Clock, CheckCircle, XCircle, AlertTriangle,
  Plus, Trash2, Printer, RefreshCw, DollarSign, Ticket, Timer, Flag, Bluetooth
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TicketPrintModal from '@/components/TicketPrintModal';
import PrinterManager from '@/components/PrinterManager';
import NetworkIndicator from '@/components/NetworkIndicator';
import { syncService } from '@/services/syncService';
import bluetoothPrinter from '@/utils/bluetoothPrinter';

// Countdown Timer Component
const CountdownTimer = ({ seconds, onExpire }) => {
  const [remaining, setRemaining] = useState(seconds || 0);
  
  useEffect(() => {
    if (!seconds || seconds <= 0) {
      setRemaining(0);
      return;
    }
    
    setRemaining(seconds);
    
    const timer = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onExpire) onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [seconds, onExpire]);
  
  if (remaining <= 0) return null;
  
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const secs = remaining % 60;
  
  const isUrgent = remaining < 300; // Less than 5 minutes
  
  return (
    <span className={`font-mono text-xs ${isUrgent ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
      {hours > 0 ? `${hours}:` : ''}{minutes.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
    </span>
  );
};

const VendeurNouvelleVente = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lotteries, setLotteries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFlag, setSelectedFlag] = useState('all');
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [cart, setCart] = useState([]);
  const [succursaleName, setSuccursaleName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [currentPlay, setCurrentPlay] = useState({
    numbers: '',
    numbers2: '',
    betType: 'BORLETTE',
    amount: ''
  });
  const [ticketResult, setTicketResult] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [minBetAmount, setMinBetAmount] = useState(1);
  const [maxBetAmount, setMaxBetAmount] = useState(999999);
  const [wsConnected, setWsConnected] = useState(false);
  const [serverTimezone, setServerTimezone] = useState('America/Port-au-Prince');
  const [betTypeLimits, setBetTypeLimits] = useState({});  // Company-specific bet type limits
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  
  const saleFormRef = useRef(null);
  const wsRef = useRef(null);
  const refreshTimerRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };
  
  // Listen for printer and network status
  useEffect(() => {
    const unsubPrinter = bluetoothPrinter.addListener((state) => {
      setPrinterConnected(state.isConnected);
    });
    
    const unsubSync = syncService.addListener((status) => {
      setIsOfflineMode(!status.isOnline);
    });
    
    // Check initial state
    setPrinterConnected(bluetoothPrinter.isConnected);
    setIsOfflineMode(!navigator.onLine);
    
    return () => {
      unsubPrinter();
      unsubSync();
    };
  }, []);

  // Map frontend bet types to backend keys
  const BET_TYPE_MAP = {
    'BORLETTE': 'BORLETTE',
    'LOTO3': 'LOTO3',
    'MARIAGE': 'MARIAGE',
    'LOTO4_OPT1': 'L4O1',
    'LOTO4_OPT2': 'L4O2',
    'LOTO4_OPT3': 'L4O3',
    'LOTO5_EXTRA1': 'L5O1',
    'LOTO5_EXTRA2': 'L5O2'
  };

  // Base bet types - will be filtered based on company limits
  const BASE_BET_TYPES = [
    { value: 'BORLETTE', label: 'Borlette', digits: '2-3', backendKey: 'BORLETTE' },
    { value: 'LOTO3', label: 'Loto 3', digits: '3', backendKey: 'LOTO3' },
    { value: 'MARIAGE', label: 'Mariage', digits: '4', backendKey: 'MARIAGE' },
    { value: 'LOTO4_OPT1', label: 'Loto 4 - Option 1', digits: '4', isLoto4: true, backendKey: 'L4O1' },
    { value: 'LOTO4_OPT2', label: 'Loto 4 - Option 2', digits: '4', isLoto4: true, backendKey: 'L4O2' },
    { value: 'LOTO4_OPT3', label: 'Loto 4 - Option 3', digits: '4', isLoto4: true, backendKey: 'L4O3' },
    { value: 'LOTO5_EXTRA1', label: 'Loto 5 - Extra 1', digits: '5', isLoto5: true, backendKey: 'L5O1' },
    { value: 'LOTO5_EXTRA2', label: 'Loto 5 - Extra 2', digits: '5', isLoto5: true, backendKey: 'L5O2' },
  ];

  // Filter bet types based on company limits (only show enabled types)
  const BET_TYPES = BASE_BET_TYPES.filter(bt => {
    const limitConfig = betTypeLimits[bt.backendKey];
    // If no limits loaded yet, show all
    if (!limitConfig) return true;
    // Only show if enabled
    return limitConfig.enabled !== false;
  }).map(bt => {
    // Add dynamic min/max from company limits
    const limitConfig = betTypeLimits[bt.backendKey] || {};
    return {
      ...bt,
      minAmount: limitConfig.min_bet || 1,
      maxAmount: limitConfig.max_bet || 1000
    };
  });

  const calculateMariagesGratis = (total) => {
    if (total >= 300) return 3;
    if (total >= 250) return 3;
    if (total >= 200) return 2;
    if (total >= 150) return 2;
    if (total >= 100) return 1;
    return 0;
  };

  const generateMariageNumbers = () => {
    const num1 = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const num2 = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `${num1}*${num2}`;  // Format: 29*08
  };

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch ONLY OPEN lotteries with cache support
  const fetchLotteries = useCallback(async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      
      // Try to use cached data first if offline
      if (!navigator.onLine) {
        const cachedLotteries = syncService.getCachedLotteries();
        const cachedLimits = syncService.getCachedBetLimits();
        const cachedConfig = syncService.getCachedConfig();
        
        if (cachedLotteries) {
          setLotteries(cachedLotteries);
          if (cachedLimits) setBetTypeLimits(cachedLimits);
          if (cachedConfig) {
            setSuccursaleName(cachedConfig.succursaleName || '');
            setCompanyName(cachedConfig.companyName || '');
          }
          setLoading(false);
          toast.info('Mode hors ligne - Données du cache');
          return;
        }
      }
      
      // Use the new endpoint that only returns open lotteries + bet type limits
      const [lotteriesRes, profileRes, limitsRes] = await Promise.all([
        axios.get(`${API_URL}/api/sync/vendeur/open-lotteries`, { headers }),
        axios.get(`${API_URL}/api/vendeur/profile`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/company/vendor/bet-type-limits`, { headers }).catch(() => ({ data: { limits: {} } }))
      ]);
      
      const openLotteries = lotteriesRes.data.lotteries || [];
      setLotteries(openLotteries);
      setServerTimezone(lotteriesRes.data.timezone || 'America/Port-au-Prince');
      
      // Cache the data for offline use
      syncService.cacheLotteries(openLotteries);
      
      // Set company-specific bet type limits
      if (limitsRes.data?.limits) {
        setBetTypeLimits(limitsRes.data.limits);
        syncService.cacheBetLimits(limitsRes.data.limits);
      }
      
      // If selected lottery is no longer open, deselect it
      if (selectedLottery) {
        const stillOpen = openLotteries.find(l => l.lottery_id === selectedLottery.lottery_id);
        if (!stillOpen) {
          toast.error('La loterie sélectionnée vient de fermer!');
          setSelectedLottery(null);
        }
      }
      
      // Get company configuration from device/config for bet limits
      const configRes = await axios.get(`${API_URL}/api/device/config`, { headers }).catch(() => null);
      if (configRes?.data?.configuration) {
        const config = configRes.data.configuration;
        setMinBetAmount(config.min_bet_amount || 1);
        setMaxBetAmount(config.max_bet_amount || 100000);
      }
      
      if (profileRes.data) {
        setSuccursaleName(profileRes.data?.succursale?.name || '');
        setCompanyName(profileRes.data?.company?.name || '');
        // Cache config
        syncService.cacheConfig({
          succursaleName: profileRes.data?.succursale?.name || '',
          companyName: profileRes.data?.company?.name || ''
        });
      }
    } catch (error) {
      console.error('[VendeurVente] Error fetching lotteries:', error);
      
      // Try to use cache on error
      const cachedLotteries = syncService.getCachedLotteries();
      if (cachedLotteries && cachedLotteries.length > 0) {
        setLotteries(cachedLotteries);
        const cachedLimits = syncService.getCachedBetLimits();
        if (cachedLimits) setBetTypeLimits(cachedLimits);
        toast.warning('Utilisation des données en cache');
        setLoading(false);
        return;
      }
      
      // Display actual error message instead of generic one
      const errorDetail = error.response?.data?.detail || error.message || t('vendeur.loadingError');
      toast.error(`Erreur: ${errorDetail}`);
      
      // Log debug info
      console.log('[VendeurVente] Debug - Token exists:', !!token);
      console.log('[VendeurVente] Debug - API URL:', API_URL);
    } finally {
      setLoading(false);
    }
  }, [token, selectedLottery, t]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!token) return;
    
    const wsUrl = `${API_URL.replace('http', 'ws')}/api/ws?token=${token}`;
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('[VendeurVente] WebSocket connected');
        setWsConnected(true);
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle lottery status changes
          if (['LOTTERY_STATUS_CHANGE', 'LOTTERY_TOGGLED', 'SCHEDULE_CHANGE', 'SYNC_REQUIRED'].includes(data.type)) {
            console.log('[VendeurVente] Received sync event:', data.type);
            fetchLotteries();
          }
          
          // Handle result publication
          if (data.type === 'RESULT_PUBLISHED') {
            toast.info(`Nouveau résultat: ${data.data?.lottery_name} - ${data.data?.winning_numbers}`);
          }
        } catch (err) {
          console.error('WS message error:', err);
        }
      };
      
      wsRef.current.onerror = () => {
        setWsConnected(false);
      };
      
      wsRef.current.onclose = () => {
        setWsConnected(false);
      };
    } catch (err) {
      console.warn('WebSocket not available');
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token, fetchLotteries]);

  // Initial fetch and periodic refresh (every 30 seconds)
  useEffect(() => {
    fetchLotteries();
    
    refreshTimerRef.current = setInterval(fetchLotteries, 30000);
    
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [fetchLotteries]);

  // Filter lotteries by search and flag
  const filteredLotteries = lotteries.filter(lot => {
    const matchesSearch = lot.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lot.state_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const flagType = lot.flag_type || 'USA';
    const matchesFlag = selectedFlag === 'all' || 
                       (selectedFlag === 'haiti' && flagType === 'HAITI') ||
                       (selectedFlag === 'usa' && flagType !== 'HAITI');
    return matchesSearch && matchesFlag;
  });

  // Sort: Haiti first, then by closing soon, then by name
  const sortedLotteries = [...filteredLotteries].sort((a, b) => {
    const flagA = a.flag_type || 'USA';
    const flagB = b.flag_type || 'USA';
    
    // Haiti first
    if (flagA === 'HAITI' && flagB !== 'HAITI') return -1;
    if (flagA !== 'HAITI' && flagB === 'HAITI') return 1;
    
    // Then by time until close (closing soon first for urgency)
    const timeA = a.time_until_close || Infinity;
    const timeB = b.time_until_close || Infinity;
    if (timeA < 600 && timeB >= 600) return -1; // Less than 10 min
    if (timeA >= 600 && timeB < 600) return 1;
    
    return (a.lottery_name || '').localeCompare(b.lottery_name || '');
  });

  const selectLottery = (lottery) => {
    if (!lottery.is_open) {
      toast.error('Cette loterie est fermée');
      return;
    }
    setSelectedLottery(lottery);
    
    setTimeout(() => {
      if (saleFormRef.current) {
        saleFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleLotteryExpired = (lottery) => {
    if (selectedLottery?.lottery_id === lottery.lottery_id) {
      toast.error(`La loterie ${lottery.lottery_name} vient de fermer!`);
      setSelectedLottery(null);
    }
    fetchLotteries();
  };

  const addToCart = () => {
    if (!currentPlay.numbers || !selectedLottery) {
      toast.error(t('vendeur.enterNumber'));
      return;
    }

    const betType = BET_TYPES.find(bt => bt.value === currentPlay.betType);
    if (!betType) {
      toast.error('Type de jeu non disponible');
      return;
    }
    
    if ((betType?.isLoto4 || betType?.isLoto5) && !currentPlay.numbers2) {
      toast.error(t('vendeur.enterSecondNumber'));
      return;
    }

    const amount = parseFloat(currentPlay.amount) || 0;
    
    // Only check positive amount - NO minimum limit
    if (amount <= 0) {
      toast.error('Montant invalide');
      return;
    }
    
    // Get bet type specific limits from company config
    const backendKey = BET_TYPE_MAP[currentPlay.betType] || currentPlay.betType;
    const typeLimit = betTypeLimits[backendKey] || {};
    const typeMaxBet = typeLimit.max_bet || 100000;
    
    // Validate max per bet type
    if (typeMaxBet && amount > typeMaxBet) {
      toast.error(`Mise maximum pour ${betType.label}: ${typeMaxBet} HTG`);
      return;
    }

    // Re-check if lottery is still in our open list
    const stillOpen = lotteries.find(l => l.lottery_id === selectedLottery.lottery_id);
    if (!stillOpen) {
      toast.error('Cette loterie vient de fermer!');
      setSelectedLottery(null);
      return;
    }

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

  // Auto-add mariages gratis
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
          toast.success(`🎁 ${newMariages.length} Mariage(s) Gratis ajouté(s)!`);
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
    const stillOpen = lotteries.find(l => l.lottery_id === selectedLottery?.lottery_id);
    if (!stillOpen && navigator.onLine) {
      toast.error('ERREUR: La loterie vient de fermer! Vente annulée.');
      setSelectedLottery(null);
      return;
    }

    try {
      setSubmitting(true);
      const today = new Date().toISOString().split('T')[0];
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

      let ticketData;
      
      // Check if we should use offline mode
      if (!navigator.onLine || syncService.shouldUseOfflineMode()) {
        // OFFLINE MODE - Save locally and print
        const offlineTicket = syncService.addPendingTicket(payload);
        
        ticketData = {
          ticket_id: offlineTicket.id,
          ticket_code: offlineTicket.id.toUpperCase(),
          total_amount: totalAmount,
          status: 'EN ATTENTE DE SYNC',
          plays: cart,
          created_at: new Date().toISOString(),
          offline: true
        };
        
        toast.warning('Mode hors ligne - Ticket sauvegardé localement');
      } else {
        // ONLINE MODE - Send to server
        const res = await axios.post(`${API_URL}/api/lottery/sell`, payload, { headers });
        ticketData = res.data;
      }
      
      setTicketResult(ticketData);
      setShowPrintModal(true);
      
      // AUTO PRINT via Bluetooth if connected
      if (printerConnected) {
        try {
          await bluetoothPrinter.printTicket({
            companyName: companyName || 'LOTTOLAB',
            branchName: succursaleName || '',
            ticketId: ticketData.ticket_code || ticketData.ticket_id,
            dateTime: new Date().toLocaleString('fr-FR'),
            vendorName: user?.name || 'Agent',
            lotteryName: selectedLottery?.lottery_name || '',
            plays: cart.map(item => ({
              numbers: item.numbers,
              betType: item.bet_type,
              amount: item.amount
            })),
            totalAmount: totalAmount,
            status: ticketData.offline ? 'EN ATTENTE' : 'VALIDÉ',
            footerMessage: ticketData.offline ? 'Sync en attente...' : 'Merci et bonne chance!'
          });
          toast.success('🖨️ Ticket imprimé automatiquement!');
        } catch (printError) {
          console.error('Auto print error:', printError);
          toast.info('Utilisez le bouton Imprimer pour réessayer');
        }
      }
      
      setCart([]);
      toast.success(ticketData.offline ? 'Ticket sauvegardé!' : 'Vente validée avec succès!');
    } catch (error) {
      // If network error, try offline mode
      if (!navigator.onLine || error.code === 'ERR_NETWORK') {
        const offlineTicket = syncService.addPendingTicket({
          lottery_id: cart[0].lottery_id,
          draw_date: new Date().toISOString().split('T')[0],
          plays: cart.map(item => ({
            numbers: item.numbers,
            bet_type: item.bet_type,
            amount: item.amount
          }))
        });
        
        setTicketResult({
          ticket_id: offlineTicket.id,
          ticket_code: offlineTicket.id.toUpperCase(),
          total_amount: totalAmount,
          status: 'HORS LIGNE',
          offline: true
        });
        setShowPrintModal(true);
        setCart([]);
        toast.warning('Connexion perdue - Ticket sauvegardé hors ligne');
        return;
      }
      
      toast.error(error.response?.data?.detail || 'Erreur lors de la vente');
    } finally {
      setSubmitting(false);
    }
  };

  const newSale = () => {
    setTicketResult(null);
    setShowPrintModal(false);
    setSelectedLottery(null);
    setCart([]);
  };

  // Success Modal
  if (ticketResult) {
    return (
      <div className="p-4 sm:p-6 pb-24 lg:pb-6">
        <TicketPrintModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          ticket={{ ...ticketResult, lottery_name: selectedLottery?.lottery_name }}
          token={token}
          onNewSale={newSale}
        />
        
        {!showPrintModal && (
          <div className="max-w-lg mx-auto bg-slate-800/50 border border-emerald-500/30 rounded-2xl p-4 sm:p-6 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Vente Validée!</h2>
            
            <div className="bg-slate-700/50 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm text-slate-400">Numéro de ticket</p>
              <p className="text-lg sm:text-xl font-mono font-bold text-emerald-400">{ticketResult.ticket_code}</p>
              
              <div className="mt-3 pt-3 border-t border-slate-600">
                <p className="text-sm text-slate-400">Montant total</p>
                <p className="text-lg sm:text-xl font-bold text-white">{ticketResult.total_amount} HTG</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setShowPrintModal(true)} className="flex-1 bg-blue-600 hover:bg-blue-700">
                <Printer className="w-4 h-4 mr-2" />
                {t('vendeur.print')}
              </Button>
              <Button onClick={newSale} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                {t('vendeur.newSale')}
              </Button>
            </div>
          </div>
        )}
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
            {t('vendeur.newSale')}
          </h1>
          <p className="text-sm text-slate-400">
            {t('vendeur.selectLotteryToStart')}
          </p>
          {succursaleName && (
            <p className="text-xs text-emerald-400 mt-1" data-testid="succursale-name-vente">
              📍 {succursaleName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Network Status Indicator */}
          <NetworkIndicator />
          
          {/* Printer Status/Connect Button */}
          <Button 
            onClick={() => setShowPrinterModal(true)} 
            variant="outline" 
            size="sm" 
            className={`border-slate-700 ${printerConnected ? 'text-emerald-400 border-emerald-500/50' : ''}`}
            data-testid="printer-btn"
          >
            {printerConnected ? (
              <Bluetooth className="w-4 h-4" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
          </Button>
          
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-xl border border-slate-700">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="text-white font-mono text-sm sm:text-lg">
              {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <Button onClick={fetchLotteries} variant="outline" size="sm" className="border-slate-700">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Open Lotteries Count */}
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span className="text-emerald-400 font-semibold">
            {sortedLotteries.length} loterie(s) ouverte(s)
          </span>
        </div>
      </div>

      {/* Search & Flag Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('vendeur.searchLottery')}
            className="pl-10 bg-slate-800 border-slate-700"
          />
        </div>
        <div className="flex gap-2">
          {[
            { key: 'all', label: t('vendeur.allLotteries') },
            { key: 'haiti', label: '🇭🇹' },
            { key: 'usa', label: '🇺🇸' }
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
        {/* Open Lotteries Grid - ONLY shows open lotteries now */}
        <div className="space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            {t('lottery.openLotteries')} ({sortedLotteries.length})
          </h2>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
          ) : sortedLotteries.length === 0 ? (
            <div className="p-6 bg-slate-800/30 rounded-xl text-center">
              <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">{t('lottery.noOpenLotteries')}</p>
              <p className="text-xs text-slate-500 mt-2">
                Toutes les loteries sont fermées pour le moment
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xs:grid-cols-3 gap-2 max-h-[350px] overflow-y-auto pr-1">
              {sortedLotteries.map(lottery => {
                const isSelected = selectedLottery?.lottery_id === lottery.lottery_id;
                const flagType = lottery.flag_type || 'USA';
                const isClosingSoon = lottery.time_until_close && lottery.time_until_close < 600;
                
                return (
                  <button
                    key={lottery.lottery_id}
                    onClick={() => selectLottery(lottery)}
                    data-testid={`lottery-${lottery.lottery_id}`}
                    className={`p-3 rounded-lg text-left transition-all ${
                      isSelected
                        ? 'bg-emerald-500/20 border-2 border-emerald-500'
                        : isClosingSoon
                          ? 'bg-red-500/10 border border-red-500/50 hover:border-red-500'
                          : 'bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50'
                    }`}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-sm">{flagType === 'HAITI' ? '🇭🇹' : '🇺🇸'}</span>
                      <span className="font-medium text-white text-xs truncate flex-1">{lottery.lottery_name}</span>
                    </div>
                    
                    {/* Open/Close times */}
                    <div className="text-xs text-slate-400 mb-1">
                      {lottery.open_time} - {lottery.close_time}
                    </div>
                    
                    {/* Countdown or status */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-emerald-400">Ouvert</span>
                      {lottery.time_until_close && (
                        <div className="flex items-center gap-1">
                          <Timer className="w-3 h-3 text-amber-400" />
                          <CountdownTimer 
                            seconds={lottery.time_until_close}
                            onExpire={() => handleLotteryExpired(lottery)}
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* Draw time */}
                    {lottery.draw_time && (
                      <div className="text-xs text-slate-500 mt-1">
                        Tirage: {lottery.draw_time}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sale Form */}
        <div ref={saleFormRef} className="space-y-4">
          {selectedLottery ? (
            <>
              <div className="bg-slate-800/50 border border-emerald-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-emerald-400 text-sm sm:text-base">
                      {selectedLottery.lottery_name}
                    </h3>
                    <div className="text-xs text-slate-400">
                      {selectedLottery.open_time} - {selectedLottery.close_time}
                      {selectedLottery.draw_time && ` | Tirage: ${selectedLottery.draw_time}`}
                    </div>
                  </div>
                  {selectedLottery.time_until_close && (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                      selectedLottery.time_until_close < 300 
                        ? 'bg-red-500/20 text-red-400 animate-pulse' 
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      <Timer className="w-3 h-3" />
                      <CountdownTimer 
                        seconds={selectedLottery.time_until_close}
                        onExpire={() => handleLotteryExpired(selectedLottery)}
                      />
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  {/* Number Input - Special handling for MARIAGE (format: 29*08) */}
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">
                      {t('vendeur.number')} *
                      {currentPlay.betType === 'MARIAGE' && (
                        <span className="text-amber-400 ml-2 text-xs">(Format: 29*08)</span>
                      )}
                    </label>
                    
                    {currentPlay.betType === 'MARIAGE' ? (
                      // Special MARIAGE input with auto * separator
                      <Input
                        value={currentPlay.numbers}
                        onChange={(e) => {
                          let val = e.target.value.replace(/[^0-9*]/g, ''); // Keep only numbers and *
                          
                          // Auto-add * after first 2 digits if not present
                          if (val.length === 2 && !val.includes('*')) {
                            val = val + '*';
                          }
                          
                          // Limit to format XX*XX (5 chars max)
                          if (val.length > 5) val = val.slice(0, 5);
                          
                          setCurrentPlay({...currentPlay, numbers: val});
                        }}
                        placeholder="29*08"
                        className="bg-slate-700 border-slate-600 text-lg sm:text-xl font-mono text-center tracking-widest"
                        maxLength={5}
                        data-testid="number-input"
                      />
                    ) : (
                      // Regular input for other bet types
                      <Input
                        value={currentPlay.numbers}
                        onChange={(e) => setCurrentPlay({...currentPlay, numbers: e.target.value.replace(/[^0-9]/g, '')})}
                        placeholder={t('vendeur.numberPlaceholder')}
                        className="bg-slate-700 border-slate-600 text-lg sm:text-xl font-mono"
                        maxLength={5}
                        data-testid="number-input"
                      />
                    )}
                    
                    {(BET_TYPES.find(bt => bt.value === currentPlay.betType)?.isLoto4 || 
                      BET_TYPES.find(bt => bt.value === currentPlay.betType)?.isLoto5) && (
                      <Input
                        value={currentPlay.numbers2}
                        onChange={(e) => setCurrentPlay({...currentPlay, numbers2: e.target.value.replace(/[^0-9]/g, '')})}
                        placeholder={`2ème ${t('vendeur.number')}`}
                        className="bg-slate-700 border-slate-600 text-lg sm:text-xl font-mono mt-2"
                        maxLength={5}
                        data-testid="number-input-2"
                      />
                    )}
                  </div>

                  {/* Bet Type */}
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">{t('vendeur.betType')}</label>
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
                    <label className="text-sm text-slate-400 mb-1 block">{t('vendeur.amount')} *</label>
                    <Input
                      type="number"
                      value={currentPlay.amount}
                      onChange={(e) => setCurrentPlay({...currentPlay, amount: e.target.value})}
                      placeholder={t('vendeur.amountPlaceholder')}
                      className="bg-slate-700 border-slate-600 text-lg font-semibold"
                      min="1"
                      step="1"
                      data-testid="amount-input"
                    />
                    
                    {totalAmount >= 50 && (
                      <div className="mt-2 p-2 bg-amber-500/20 border border-amber-500/30 rounded-lg">
                        <p className="text-amber-400 text-xs font-semibold">
                          🎁 {calculateMariagesGratis(totalAmount)} {t('vendeur.freeMarriage')}(s)
                        </p>
                      </div>
                    )}
                  </div>

                  <Button 
                    onClick={addToCart} 
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    data-testid="add-to-cart-btn"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('vendeur.addToCart')}
                  </Button>
                </div>
              </div>

              {/* Cart */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-purple-400" />
                  {t('vendeur.summary')} ({cart.length})
                </h3>

                {cart.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-4">{t('vendeur.emptyCart')}</p>
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
                    <span className="text-slate-400">{t('vendeur.total')}</span>
                    <span className="text-xl sm:text-2xl font-bold text-white">{totalAmount} HTG</span>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={clearCart} variant="outline" className="flex-1 border-slate-600">
                      {t('vendeur.clearCart')}
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
                      {t('vendeur.validateSale')}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 sm:p-8 text-center">
              <ShoppingCart className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">{t('vendeur.selectLotteryToStart')}</p>
              <p className="text-xs text-slate-500 mt-2">
                Seules les loteries ouvertes sont affichées
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Printer Manager Modal */}
      {showPrinterModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <PrinterManager onClose={() => setShowPrinterModal(false)} />
            <Button 
              onClick={() => setShowPrinterModal(false)} 
              variant="outline" 
              className="w-full mt-2 border-slate-700"
            >
              Fermer
            </Button>
          </div>
        </div>
      )}
      
      {/* Offline Mode Banner */}
      {isOfflineMode && (
        <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-80 bg-amber-500/20 border border-amber-500/50 rounded-xl p-3 text-amber-400 text-sm flex items-center gap-2 z-40">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Mode Hors Ligne</p>
            <p className="text-xs text-amber-400/70">Les tickets seront synchronisés automatiquement</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendeurNouvelleVente;
