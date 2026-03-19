import { API_URL } from '@/config/api';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Flag, RefreshCw, Search, Save, CheckCircle, XCircle,
  Clock, ArrowRight, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';


// Flag images
const HAITI_FLAG = "🇭🇹";
const USA_FLAG = "🇺🇸";

const CompanyLotteryFlagsPage = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lotteries, setLotteries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFlag, setFilterFlag] = useState('all');
  const [changes, setChanges] = useState({});

  const headers = { Authorization: `Bearer ${token}` };

  const fetchLotteries = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/company/available-lotteries`, { headers });
      setLotteries(res.data || []);
      setChanges({});
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLotteries();
  }, [token]);

  const handleFlagChange = (lotteryId, newFlag) => {
    setChanges(prev => ({
      ...prev,
      [lotteryId]: newFlag
    }));
  };

  const saveChanges = async () => {
    try {
      setSaving(true);
      
      const assignments = Object.entries(changes).map(([lottery_id, flag_type]) => ({
        lottery_id,
        flag_type
      }));
      
      if (assignments.length === 0) {
        toast.info('Aucun changement à sauvegarder');
        return;
      }
      
      await axios.post(
        `${API_URL}/api/company/bulk-assign-flags`,
        { assignments },
        { headers }
      );
      
      toast.success(`${assignments.length} loterie(s) mise(s) à jour`);
      fetchLotteries();
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
    
    const currentFlag = changes[lot.lottery_id] || lot.flag_type || 'USA';
    const matchesFilter = filterFlag === 'all' || currentFlag === filterFlag;
    
    return matchesSearch && matchesFilter;
  });

  // Group by flag
  const haitiLotteries = filteredLotteries.filter(l => (changes[l.lottery_id] || l.flag_type) === 'HAITI');
  const usaLotteries = filteredLotteries.filter(l => (changes[l.lottery_id] || l.flag_type) !== 'HAITI');

  const hasChanges = Object.keys(changes).length > 0;

  return (
    <div className="p-4 sm:p-6 space-y-6" data-testid="company-lottery-flags-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
            <Flag className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" />
            Configuration des Drapeaux
          </h1>
          <p className="text-sm text-slate-400">Assignez les loteries aux drapeaux 🇭🇹 LOTERIE HAITI ou 🇺🇸 LOTERIE USA</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchLotteries} variant="outline" className="border-slate-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          {hasChanges && (
            <Button onClick={saveChanges} className="bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
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
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setFilterFlag('all')}
            variant={filterFlag === 'all' ? 'default' : 'outline'}
            className={filterFlag === 'all' ? 'bg-blue-600' : 'border-slate-700'}
          >
            Tous
          </Button>
          <Button
            onClick={() => setFilterFlag('HAITI')}
            variant={filterFlag === 'HAITI' ? 'default' : 'outline'}
            className={filterFlag === 'HAITI' ? 'bg-red-600' : 'border-slate-700'}
          >
            {HAITI_FLAG} Haïti
          </Button>
          <Button
            onClick={() => setFilterFlag('USA')}
            variant={filterFlag === 'USA' ? 'default' : 'outline'}
            className={filterFlag === 'USA' ? 'bg-blue-600' : 'border-slate-700'}
          >
            {USA_FLAG} USA
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-sm text-slate-400">Total</p>
          <p className="text-2xl font-bold text-white">{lotteries.length}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-sm text-red-400">🇭🇹 LOTERIE HAITI</p>
          <p className="text-2xl font-bold text-red-400">{haitiLotteries.length}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-sm text-blue-400">🇺🇸 LOTERIE USA</p>
          <p className="text-2xl font-bold text-blue-400">{usaLotteries.length}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
          <p className="text-sm text-emerald-400">Modifiées</p>
          <p className="text-2xl font-bold text-emerald-400">{Object.keys(changes).length}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
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
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {haitiLotteries.map(lottery => (
                  <LotteryCard
                    key={lottery.lottery_id}
                    lottery={lottery}
                    currentFlag={changes[lottery.lottery_id] || lottery.flag_type || 'HAITI'}
                    onFlagChange={(flag) => handleFlagChange(lottery.lottery_id, flag)}
                    hasChange={!!changes[lottery.lottery_id]}
                  />
                ))}
                {haitiLotteries.length === 0 && (
                  <p className="text-slate-400 col-span-3 py-4">Aucune loterie dans ce drapeau</p>
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
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {usaLotteries.slice(0, 30).map(lottery => (
                  <LotteryCard
                    key={lottery.lottery_id}
                    lottery={lottery}
                    currentFlag={changes[lottery.lottery_id] || lottery.flag_type || 'USA'}
                    onFlagChange={(flag) => handleFlagChange(lottery.lottery_id, flag)}
                    hasChange={!!changes[lottery.lottery_id]}
                  />
                ))}
                {usaLotteries.length > 30 && (
                  <p className="text-slate-400 col-span-3 text-center py-2">
                    Affichage limité à 30 loteries. Utilisez la recherche pour trouver d'autres.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const LotteryCard = ({ lottery, currentFlag, onFlagChange, hasChange }) => {
  const draws = lottery.draws || [];
  
  return (
    <div className={`bg-slate-800/50 border rounded-xl p-4 transition-all ${
      hasChange ? 'border-emerald-500 ring-1 ring-emerald-500/50' : 'border-slate-700'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white truncate">{lottery.lottery_name}</h3>
          <p className="text-xs text-slate-400">{lottery.state_code}</p>
        </div>
        {hasChange && (
          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">
            Modifié
          </span>
        )}
      </div>
      
      {/* Draws */}
      {draws.length > 0 && (
        <div className="mb-3 space-y-1">
          <p className="text-xs text-slate-400">Tirages:</p>
          <div className="flex flex-wrap gap-1">
            {draws.map((draw, idx) => (
              <span key={idx} className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                {draw.name} {draw.time}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Flag Selection */}
      <div className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg">
        <button
          onClick={() => onFlagChange('HAITI')}
          className={`flex-1 py-2 rounded-lg transition-all ${
            currentFlag === 'HAITI'
              ? 'bg-red-500/30 text-red-300 ring-1 ring-red-500'
              : 'text-slate-400 hover:bg-slate-700'
          }`}
        >
          🇭🇹 Haïti
        </button>
        <ArrowRight className="w-4 h-4 text-slate-600 mx-2" />
        <button
          onClick={() => onFlagChange('USA')}
          className={`flex-1 py-2 rounded-lg transition-all ${
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

export default CompanyLotteryFlagsPage;
