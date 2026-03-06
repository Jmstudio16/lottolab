import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  ShoppingCart, Search, Clock, CheckCircle, XCircle,
  Plus, Trash2, Printer, RefreshCw, DollarSign, Ticket
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

  const headers = { Authorization: `Bearer ${token}` };

  const BET_TYPES = [
    { value: 'BORLETTE', label: 'Borlette', digits: '2-3' },
    { value: 'LOTO3', label: 'Loto 3', digits: '3' },
    { value: 'LOTO4', label: 'Loto 4', digits: '4' },
    { value: 'LOTO5', label: 'Loto 5', digits: '5' },
    { value: 'MARIAGE', label: 'Mariage', digits: '4' },
  ];

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

  // Get lottery status based on schedule
  const getLotteryStatus = (lottery) => {
    const now = new Date();
    const lotterySchedules = schedules.filter(s => s.lottery_id === lottery.lottery_id);
    
    for (const schedule of lotterySchedules) {
      if (schedule.close_time) {
        const [closeHour, closeMin] = schedule.close_time.split(':').map(Number);
        const closeTime = new Date();
        closeTime.setHours(closeHour, closeMin, 0, 0);
        
        if (now < closeTime) {
          const diffMs = closeTime - now;
          const diffMins = Math.floor(diffMs / 60000);
          
          if (diffMins <= 60) {
            return { status: 'closing', text: `Ferme dans ${diffMins}min`, color: 'text-amber-400' };
          }
          return { status: 'open', text: 'Ouvert', color: 'text-emerald-400' };
        }
      }
    }
    return { status: 'closed', text: 'Fermé', color: 'text-red-400' };
  };

  // Filter lotteries
  const filteredLotteries = lotteries.filter(lot => {
    const matchesSearch = lot.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lot.state_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || 
                           (selectedCategory === 'haiti' && lot.state_code === 'HT') ||
                           (selectedCategory === 'usa' && lot.state_code !== 'HT');
    return matchesSearch && matchesCategory;
  });

  const selectLottery = (lottery) => {
    setSelectedLottery(lottery);
    const lotterySchedules = schedules.filter(s => s.lottery_id === lottery.lottery_id);
    if (lotterySchedules.length > 0) {
      setSelectedDraw(lotterySchedules[0]);
    }
  };

  const addToCart = () => {
    if (!currentPlay.numbers || !selectedLottery) {
      toast.error('Veuillez entrer un numéro');
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

    try {
      setSubmitting(true);
      const today = new Date().toISOString().split('T')[0];
      
      const payload = {
        lottery_id: cart[0].lottery_id,
        draw_date: today,
        draw_name: selectedDraw?.draw_type || 'Midday',
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
      window.open(`${API_URL}/api/ticket/print/${ticketResult.ticket_id}?auto=true`, '_blank');
    }
  };

  const newSale = () => {
    setTicketResult(null);
    setSelectedLottery(null);
    setSelectedDraw(null);
    setCart([]);
  };

  // Success Modal
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
            <div className="mt-3 pt-3 border-t border-slate-600">
              <p className="text-sm text-slate-400">Montant total</p>
              <p className="text-lg font-bold text-white">{ticketResult.total_amount} HTG</p>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-600">
              <p className="text-sm text-slate-400">Gain potentiel</p>
              <p className="text-lg font-bold text-amber-400">{ticketResult.potential_win?.toLocaleString()} HTG</p>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ShoppingCart className="w-7 h-7 text-emerald-400" />
            Nouvelle Vente
          </h1>
          <p className="text-slate-400">Sélectionnez une loterie et créez un ticket</p>
        </div>
        <Button onClick={fetchData} variant="outline" className="border-slate-700">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
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
          <h2 className="text-lg font-semibold text-white">Loteries Disponibles ({filteredLotteries.length})</h2>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-2">
              {filteredLotteries.slice(0, 50).map(lottery => {
                const status = getLotteryStatus(lottery);
                const isSelected = selectedLottery?.lottery_id === lottery.lottery_id;
                
                return (
                  <button
                    key={lottery.lottery_id}
                    onClick={() => status.status !== 'closed' && selectLottery(lottery)}
                    disabled={status.status === 'closed'}
                    className={`p-3 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-emerald-500/20 border-2 border-emerald-500'
                        : status.status === 'closed'
                        ? 'bg-slate-800/30 border border-slate-700 opacity-50 cursor-not-allowed'
                        : 'bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50'
                    }`}
                  >
                    <p className="font-medium text-white text-sm truncate">{lottery.lottery_name}</p>
                    <p className="text-xs text-slate-400">{lottery.state_code}</p>
                    <p className={`text-xs mt-1 ${status.color}`}>{status.text}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sale Form */}
        <div className="space-y-4">
          {selectedLottery ? (
            <>
              <div className="bg-slate-800/50 border border-emerald-500/30 rounded-xl p-4">
                <h3 className="font-semibold text-emerald-400 mb-3">
                  {selectedLottery.lottery_name}
                </h3>
                
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
              <p className="text-slate-400">Sélectionnez une loterie pour commencer</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendeurNouvelleVente;
