import React, { useEffect, useState } from 'react';
import apiClient from '@/api/client';
import { useAuth } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Ticket, 
  Clock, 
  Plus, 
  Trash2,
  Check,
  LogOut,
  Search,
  DollarSign
} from 'lucide-react';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_36e4b3a7-6dc6-43e8-b4c7-e0a52462b3df/artifacts/ztvthede_ChatGPT%20Image%2019%20f%C3%A9vr.%202026%2C%2020_13_22.png";

export const POSPage = () => {
  const { user, logout } = useAuth();
  const [lotteries, setLotteries] = useState([]);
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [cart, setCart] = useState([]);
  const [numberInput, setNumberInput] = useState('');
  const [betType, setBetType] = useState('STRAIGHT');
  const [amount, setAmount] = useState('10');
  const [dailySummary, setDailySummary] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOpenLotteries();
    fetchDailySummary();
  }, []);

  const fetchOpenLotteries = async () => {
    try {
      const response = await apiClient.get('/pos/lotteries/open');
      setLotteries(response.data);
    } catch (error) {
      toast.error('Failed to load lotteries');
    }
  };

  const fetchDailySummary = async () => {
    try {
      const response = await apiClient.get('/pos/summary/daily');
      setDailySummary(response.data);
    } catch (error) {
      console.error('Failed to load daily summary');
    }
  };

  const addToCart = () => {
    if (!selectedLottery) {
      toast.error('Please select a lottery');
      return;
    }
    if (!numberInput || numberInput.length < 2) {
      toast.error('Please enter a valid number');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const play = {
      numbers: numberInput,
      bet_type: betType,
      amount: parseFloat(amount),
    };

    setCart([...cart, play]);
    setNumberInput('');
    setAmount('10');
    toast.success('Added to cart');
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
    toast.info('Removed from cart');
  };

  const submitTicket = async () => {
    if (!selectedLottery) {
      toast.error('Please select a lottery');
      return;
    }
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    setLoading(true);
    try {
      const ticketData = {
        lottery_id: selectedLottery.lottery_id,
        draw_datetime: selectedLottery.next_draw,
        plays: cart,
      };

      const response = await apiClient.post('/pos/tickets', ticketData);
      toast.success('Ticket created successfully!');
      
      // Show ticket details
      const ticket = response.data;
      toast.success(
        <div>
          <p className="font-bold">Ticket: {ticket.ticket_code}</p>
          <p className="text-xs font-mono">Verification: {ticket.verification_code}</p>
        </div>,
        { duration: 5000 }
      );

      // Reset
      setCart([]);
      setSelectedLottery(null);
      fetchDailySummary();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = cart.reduce((sum, play) => sum + play.amount, 0);

  const filteredLotteries = lotteries.filter(lottery =>
    lottery.lottery_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 sticky top-0 z-50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="LOTTOLAB" className="h-12" />
            <div>
              <h1 className="text-xl font-barlow font-bold uppercase tracking-tight text-white">
                POS Terminal
              </h1>
              <p className="text-xs text-slate-400">{user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {dailySummary && (
              <div className="text-right">
                <p className="text-xs text-slate-400">Today's Sales</p>
                <p className="text-lg font-bold text-green-400">
                  {dailySummary.total_sales.toFixed(2)} HTG
                </p>
                <p className="text-xs text-slate-500">{dailySummary.tickets_count} tickets</p>
              </div>
            )}
            <Button 
              onClick={logout} 
              variant="ghost" 
              size="sm"
              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
              data-testid="pos-logout-button"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main POS Interface */}
      <div className="grid grid-cols-12 gap-4 p-4 h-[calc(100vh-80px)]">
        {/* Left: Lottery Selection */}
        <div className="col-span-3 bg-card border border-slate-700/50 rounded-xl p-4 overflow-y-auto">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search lottery..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-950 border-slate-700 text-white"
                data-testid="pos-search-lottery-input"
              />
            </div>
          </div>
          <h2 className="text-sm font-bold text-slate-400 uppercase mb-3">Open Lotteries ({filteredLotteries.length})</h2>
          <div className="space-y-2">
            {filteredLotteries.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Clock className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No lotteries open</p>
              </div>
            ) : (
              filteredLotteries.map((lottery) => (
                <button
                  key={lottery.lottery_id}
                  onClick={() => setSelectedLottery(lottery)}
                  data-testid={`lottery-select-${lottery.lottery_id}`}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    selectedLottery?.lottery_id === lottery.lottery_id
                      ? 'border-yellow-400 bg-yellow-400/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-900/30'
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{lottery.lottery_name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Draw: {new Date(lottery.next_draw).toLocaleTimeString()}
                  </p>
                  <p className="text-xs text-green-400 mt-1">
                    Closes: {new Date(lottery.closes_at).toLocaleTimeString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Center: Number Input */}
        <div className="col-span-6 bg-card border border-slate-700/50 rounded-xl p-6">
          {selectedLottery ? (
            <div className="space-y-6">
              <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-4">
                <h3 className="text-xl font-barlow font-bold text-yellow-400 uppercase">
                  {selectedLottery.lottery_name}
                </h3>
                <p className="text-sm text-slate-400 mt-1">{selectedLottery.game_type}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Number</label>
                <Input
                  type="text"
                  value={numberInput}
                  onChange={(e) => setNumberInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Enter numbers"
                  className="text-4xl font-mono text-center h-20 tracking-[0.5em] bg-black border-2 border-slate-700 focus:border-yellow-400 text-white"
                  data-testid="pos-number-input"
                  maxLength={4}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Bet Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {['STRAIGHT', 'BOX', 'COMBO'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setBetType(type)}
                      data-testid={`bet-type-${type.toLowerCase()}`}
                      className={`py-3 rounded-lg font-semibold transition-all ${
                        betType === type
                          ? 'bg-yellow-400 text-slate-900'
                          : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-700'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Amount (HTG)</label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="text-2xl font-mono text-center h-16 bg-slate-950 border-slate-700 focus:border-yellow-400 text-white"
                  data-testid="pos-amount-input"
                  min="1"
                  step="1"
                />
              </div>

              <Button
                onClick={addToCart}
                data-testid="pos-add-to-cart-button"
                className="w-full button-primary h-14 text-lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add to Cart
              </Button>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center text-slate-500">
              <div>
                <Ticket className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Select a lottery to start</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Cart & Checkout */}
        <div className="col-span-3 bg-card border border-slate-700/50 rounded-xl p-4 flex flex-col">
          <h2 className="text-sm font-bold text-slate-400 uppercase mb-3">Cart ({cart.length})</h2>
          
          <div className="flex-1 overflow-y-auto space-y-2 mb-4">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p className="text-sm">Cart is empty</p>
              </div>
            ) : (
              cart.map((play, index) => (
                <div key={index} className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-lg font-mono font-bold text-white">{play.numbers}</p>
                      <p className="text-xs text-slate-400">{play.bet_type}</p>
                    </div>
                    <button
                      onClick={() => removeFromCart(index)}
                      className="text-red-400 hover:text-red-300 p-1"
                      data-testid={`remove-cart-item-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-green-400">{play.amount} HTG</p>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-700 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Total Amount</span>
              <span className="text-2xl font-barlow font-bold text-yellow-400">
                {totalAmount.toFixed(2)} HTG
              </span>
            </div>
            <Button
              onClick={submitTicket}
              disabled={cart.length === 0 || loading}
              data-testid="pos-submit-ticket-button"
              className="w-full button-primary h-12"
            >
              {loading ? (
                'Processing...'
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Create Ticket
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};