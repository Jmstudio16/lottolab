import { API_URL } from '@/config/api';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  ArrowLeft, Building2, Check, X, Search, 
  Clock, RefreshCw, CheckCircle, Filter
} from 'lucide-react';
import CompanyLayout from '@/components/CompanyLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';


export const BranchLotteriesPage = () => {
  const { branchId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('');
  const [branchData, setBranchData] = useState(null);
  const [lotteries, setLotteries] = useState([]);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchBranchLotteries = useCallback(async () => {
    if (!branchId) return;
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_URL}/api/company/branches/${branchId}/lotteries`, 
        { headers }
      );
      setBranchData({
        branch_id: res.data.branch_id,
        branch_name: res.data.branch_name,
        company_id: res.data.company_id,
        total_lotteries: res.data.total_lotteries,
        enabled_count: res.data.enabled_count
      });
      setLotteries(res.data.lotteries || []);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [branchId, token]);

  useEffect(() => {
    fetchBranchLotteries();
  }, [fetchBranchLotteries]);

  const toggleLottery = async (lotteryId, currentEnabled) => {
    try {
      setSaving(true);
      const action = currentEnabled ? 'disable' : 'enable';
      await axios.post(
        `${API_URL}/api/company/branches/${branchId}/lotteries/${lotteryId}/${action}`,
        {},
        { headers }
      );
      
      // Update local state
      setLotteries(prev => 
        prev.map(lot => 
          lot.lottery_id === lotteryId 
            ? { ...lot, enabled_for_branch: !currentEnabled }
            : lot
        )
      );
      
      toast.success(currentEnabled ? 'Loterie désactivée' : 'Loterie activée');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const enableAll = async () => {
    try {
      setSaving(true);
      const lotteryIds = lotteries.map(l => l.lottery_id);
      await axios.post(
        `${API_URL}/api/company/branches/${branchId}/lotteries/bulk-update`,
        { lottery_ids: lotteryIds, enabled: true },
        { headers }
      );
      setLotteries(prev => prev.map(lot => ({ ...lot, enabled_for_branch: true })));
      toast.success('Toutes les loteries activées');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const disableAll = async () => {
    try {
      setSaving(true);
      const lotteryIds = lotteries.map(l => l.lottery_id);
      await axios.post(
        `${API_URL}/api/company/branches/${branchId}/lotteries/bulk-update`,
        { lottery_ids: lotteryIds, enabled: false },
        { headers }
      );
      setLotteries(prev => prev.map(lot => ({ ...lot, enabled_for_branch: false })));
      toast.success('Toutes les loteries désactivées');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  // Get unique states for filter
  const states = [...new Set(lotteries.map(l => l.state_code).filter(Boolean))].sort();

  // Filter lotteries
  const filteredLotteries = lotteries.filter(lot => {
    const matchesSearch = 
      lot.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lot.state_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesState = !filterState || lot.state_code === filterState;
    return matchesSearch && matchesState;
  });

  const enabledCount = lotteries.filter(l => l.enabled_for_branch).length;

  return (
    <CompanyLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/company/succursales')}
              className="text-slate-400 hover:text-white"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <Building2 className="w-6 h-6 text-blue-400" />
                Loteries - {branchData?.branch_name || 'Succursale'}
              </h1>
              <p className="text-slate-400 mt-1">
                Gérez les loteries disponibles pour cette succursale
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={fetchBranchLotteries}
              disabled={loading}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="refresh-btn"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button
              onClick={enableAll}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="enable-all-btn"
            >
              <Check className="w-4 h-4 mr-2" />
              Tout Activer
            </Button>
            <Button
              onClick={disableAll}
              disabled={saving}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
              data-testid="disable-all-btn"
            >
              <X className="w-4 h-4 mr-2" />
              Tout Désactiver
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <p className="text-sm text-slate-400">Loteries Totales</p>
            <p className="text-2xl font-bold text-white">{lotteries.length}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <p className="text-sm text-slate-400">Activées pour cette Succursale</p>
            <p className="text-2xl font-bold text-emerald-400">{enabledCount}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <p className="text-sm text-slate-400">Désactivées</p>
            <p className="text-2xl font-bold text-red-400">{lotteries.length - enabledCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher une loterie..."
              className="pl-10 bg-slate-800 border-slate-700 text-white"
              data-testid="search-input"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              data-testid="state-filter"
            >
              <option value="">Tous les États</option>
              {states.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lotteries Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLotteries.map((lottery) => (
              <div
                key={lottery.lottery_id}
                className={`p-4 rounded-xl border transition-all ${
                  lottery.enabled_for_branch
                    ? 'bg-slate-800/50 border-emerald-500/30 hover:border-emerald-500/50'
                    : 'bg-slate-900/50 border-slate-700 hover:border-slate-600 opacity-60'
                }`}
                data-testid={`lottery-card-${lottery.lottery_id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{lottery.lottery_name}</h3>
                    <span className="inline-block px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-300 mt-1">
                      {lottery.state_code}
                    </span>
                  </div>
                  <Switch
                    checked={lottery.enabled_for_branch}
                    onCheckedChange={() => toggleLottery(lottery.lottery_id, lottery.enabled_for_branch)}
                    disabled={saving}
                    data-testid={`toggle-${lottery.lottery_id}`}
                  />
                </div>
                
                {/* Draw Times */}
                {lottery.draw_times?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-700">
                    <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Tirages:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {lottery.draw_times.slice(0, 4).map((dt, idx) => (
                        <span 
                          key={idx}
                          className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded"
                        >
                          {dt}
                        </span>
                      ))}
                      {lottery.draw_times.length > 4 && (
                        <span className="text-xs text-slate-400">
                          +{lottery.draw_times.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Status Badge */}
                <div className="mt-3 flex items-center gap-2">
                  {lottery.enabled_for_branch ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle className="w-3 h-3" />
                      Activée
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <X className="w-3 h-3" />
                      Désactivée
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredLotteries.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Aucune loterie trouvée</p>
          </div>
        )}
      </div>
    </CompanyLayout>
  );
};

export default BranchLotteriesPage;
