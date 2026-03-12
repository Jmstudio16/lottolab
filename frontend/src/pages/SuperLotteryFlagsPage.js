import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Flag, RefreshCw, Search, Save, CheckCircle, XCircle,
  ArrowRight, ToggleLeft, ToggleRight, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SuperLotteryFlagsPage = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lotteries, setLotteries] = useState([]);
  const [stats, setStats] = useState({ total: 0, haiti: 0, usa: 0, active: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFlag, setFilterFlag] = useState('all');
  const [changes, setChanges] = useState({});

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [lotteriesRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/super/lottery-flags`, { headers }),
        axios.get(`${API_URL}/api/super/lottery-flags/stats`, { headers })
      ]);
      setLotteries(lotteriesRes.data || []);
      setStats(statsRes.data || { total: 0, haiti: 0, usa: 0, active: 0 });
      setChanges({});
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleFlagChange = (lotteryId, newFlag) => {
    setChanges(prev => ({
      ...prev,
      [lotteryId]: {
        ...prev[lotteryId],
        flag_type: newFlag
      }
    }));
  };

  const handleToggleActive = async (lotteryId) => {
    try {
      const res = await axios.post(
        `${API_URL}/api/super/lottery-flags/toggle/${lotteryId}`,
        {},
        { headers }
      );
      
      setLotteries(prev => prev.map(lot => 
        lot.lottery_id === lotteryId 
          ? { ...lot, is_active_global: res.data.is_active }
          : lot
      ));
      
      toast.success(res.data.is_active ? `${res.data.lottery_name} activée` : `${res.data.lottery_name} désactivée`);
    } catch (error) {
      toast.error('Erreur lors de la modification');
    }
  };

  const saveChanges = async () => {
    try {
      setSaving(true);
      
      const assignments = Object.entries(changes).map(([lottery_id, data]) => ({
        lottery_id,
        flag_type: data.flag_type,
        is_active: data.is_active !== undefined ? data.is_active : true
      }));
      
      if (assignments.length === 0) {
        toast.info('Aucun changement à sauvegarder');
        return;
      }
      
      await axios.post(
        `${API_URL}/api/super/lottery-flags`,
        { assignments },
        { headers }
      );
      
      toast.success(`${assignments.length} loterie(s) mise(s) à jour`);
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const filteredLotteries = lotteries.filter(lot => {
    const matchesSearch = 
      lot.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lot.state_code?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const currentFlag = changes[lot.lottery_id]?.flag_type || lot.flag_type || 'USA';
    const matchesFilter = filterFlag === 'all' || currentFlag === filterFlag;
    
    return matchesSearch && matchesFilter;
  });

  // Group by flag
  const haitiLotteries = filteredLotteries.filter(l => (changes[l.lottery_id]?.flag_type || l.flag_type) === 'HAITI');
  const usaLotteries = filteredLotteries.filter(l => (changes[l.lottery_id]?.flag_type || l.flag_type) !== 'HAITI');

  const hasChanges = Object.keys(changes).length > 0;

  return (
    <div className="p-4 sm:p-6 space-y-6" data-testid="super-lottery-flags-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
            <Globe className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400" />
            Configuration des Drapeaux
          </h1>
          <p className="text-sm text-slate-400">
            Assignez les loteries aux drapeaux 🇭🇹 LOTERIE HAITI ou 🇺🇸 LOTERIE USA
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" className="border-slate-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          {hasChanges && (
            <Button onClick={saveChanges} className="bg-amber-600 hover:bg-amber-700" disabled={saving}>
              <Save className={`w-4 h-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
              Sauvegarder ({Object.keys(changes).length})
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Rechercher une loterie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white"
            data-testid="search-lotteries"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setFilterFlag('all')}
            variant={filterFlag === 'all' ? 'default' : 'outline'}
            className={filterFlag === 'all' ? 'bg-amber-600' : 'border-slate-700'}
          >
            Tous
          </Button>
          <Button
            onClick={() => setFilterFlag('HAITI')}
            variant={filterFlag === 'HAITI' ? 'default' : 'outline'}
            className={filterFlag === 'HAITI' ? 'bg-red-600' : 'border-slate-700'}
          >
            🇭🇹 Haiti
          </Button>
          <Button
            onClick={() => setFilterFlag('USA')}
            variant={filterFlag === 'USA' ? 'default' : 'outline'}
            className={filterFlag === 'USA' ? 'bg-blue-600' : 'border-slate-700'}
          >
            🇺🇸 USA
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-sm text-slate-400">Total</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-sm text-red-400">🇭🇹 LOTERIE HAITI</p>
          <p className="text-2xl font-bold text-red-400">{stats.haiti}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-sm text-blue-400">🇺🇸 LOTERIE USA</p>
          <p className="text-2xl font-bold text-blue-400">{stats.usa}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
          <p className="text-sm text-emerald-400">Actives</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.active}</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <p className="text-sm text-amber-400">Modifiées</p>
          <p className="text-2xl font-bold text-amber-400">{Object.keys(changes).length}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Haiti Section */}
          {(filterFlag === 'all' || filterFlag === 'HAITI') && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-red-500/30 pb-2">
                <span className="text-2xl">🇭🇹</span>
                LOTERIE HAITI ({haitiLotteries.length})
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {haitiLotteries.map(lottery => (
                  <LotteryCard
                    key={lottery.lottery_id}
                    lottery={lottery}
                    currentFlag={changes[lottery.lottery_id]?.flag_type || lottery.flag_type || 'HAITI'}
                    onFlagChange={(flag) => handleFlagChange(lottery.lottery_id, flag)}
                    onToggle={() => handleToggleActive(lottery.lottery_id)}
                    hasChange={!!changes[lottery.lottery_id]}
                  />
                ))}
                {haitiLotteries.length === 0 && (
                  <p className="text-slate-400 col-span-4 py-4">Aucune loterie dans ce drapeau</p>
                )}
              </div>
            </div>
          )}

          {/* USA Section */}
          {(filterFlag === 'all' || filterFlag === 'USA') && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-blue-500/30 pb-2">
                <span className="text-2xl">🇺🇸</span>
                LOTERIE USA ({usaLotteries.length})
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[600px] overflow-y-auto">
                {usaLotteries.map(lottery => (
                  <LotteryCard
                    key={lottery.lottery_id}
                    lottery={lottery}
                    currentFlag={changes[lottery.lottery_id]?.flag_type || lottery.flag_type || 'USA'}
                    onFlagChange={(flag) => handleFlagChange(lottery.lottery_id, flag)}
                    onToggle={() => handleToggleActive(lottery.lottery_id)}
                    hasChange={!!changes[lottery.lottery_id]}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const LotteryCard = ({ lottery, currentFlag, onFlagChange, onToggle, hasChange }) => {
  const isActive = lottery.is_active_global !== false;
  const schedule = lottery.schedule || {};
  
  return (
    <div className={`bg-slate-800/50 border rounded-xl p-3 transition-all ${
      hasChange ? 'border-amber-500 ring-1 ring-amber-500/50' : 
      !isActive ? 'border-red-500/30 opacity-60' : 'border-slate-700'
    }`} data-testid={`lottery-card-${lottery.lottery_id}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white text-sm truncate">{lottery.lottery_name}</h3>
          <p className="text-xs text-slate-400">
            {lottery.state_code}
            {lottery.draw_time && ` • Tirage: ${lottery.draw_time}`}
          </p>
        </div>
        <button
          onClick={onToggle}
          className={`p-1 rounded-lg transition-colors ${
            isActive ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-red-400 hover:bg-red-500/10'
          }`}
          title={isActive ? 'Désactiver globalement' : 'Activer globalement'}
        >
          {isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
        </button>
      </div>
      
      {/* Status */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`px-2 py-0.5 rounded text-xs ${
          isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {isActive ? 'Actif' : 'Inactif'}
        </span>
        {hasChange && (
          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs">
            Modifié
          </span>
        )}
      </div>
      
      {/* Flag Selection */}
      <div className="flex items-center justify-between p-1.5 bg-slate-900/50 rounded-lg">
        <button
          onClick={() => onFlagChange('HAITI')}
          className={`flex-1 py-1.5 rounded-lg transition-all text-xs ${
            currentFlag === 'HAITI'
              ? 'bg-red-500/30 text-red-300 ring-1 ring-red-500'
              : 'text-slate-400 hover:bg-slate-700'
          }`}
        >
          🇭🇹 Haiti
        </button>
        <ArrowRight className="w-3 h-3 text-slate-600 mx-1" />
        <button
          onClick={() => onFlagChange('USA')}
          className={`flex-1 py-1.5 rounded-lg transition-all text-xs ${
            currentFlag === 'USA'
              ? 'bg-blue-500/30 text-blue-300 ring-1 ring-blue-500'
              : 'text-slate-400 hover:bg-slate-700'
          }`}
        >
          🇺🇸 USA
        </button>
      </div>
    </div>
  );
};

export default SuperLotteryFlagsPage;
