import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import { AdminLayout } from '@/components/AdminLayout';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Globe, Search, Plus, Edit2, Trash2, ChevronDown, ChevronRight,
  MapPin, Filter, RefreshCw, Check, X, Database, ToggleLeft, ToggleRight,
  Building2, Power
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const SuperLotteryCatalogPage = () => {
  const { token } = useAuth();
  const [lotteries, setLotteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterGameType, setFilterGameType] = useState('');
  const [expandedStates, setExpandedStates] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLottery, setEditingLottery] = useState(null);
  const [togglingLotteries, setTogglingLotteries] = useState({});

  const headers = { Authorization: `Bearer ${token}` };

  const fetchLotteries = async () => {
    try {
      setLoading(true);
      // Use new SaaS core endpoint for master lotteries
      const res = await axios.get(`${API_URL}/api/saas/master-lotteries`, { headers });
      setLotteries(res.data);
    } catch (error) {
      toast.error('Erreur lors du chargement du catalogue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLotteries();
  }, []);

  const toggleGlobalStatus = async (lotteryId, currentStatus) => {
    try {
      setTogglingLotteries(prev => ({ ...prev, [lotteryId]: true }));
      const newStatus = !currentStatus;
      await axios.put(
        `${API_URL}/api/saas/master-lotteries/${lotteryId}/toggle-global?is_active=${newStatus}`,
        {},
        { headers }
      );
      toast.success(newStatus ? 'Loterie activée globalement' : 'Loterie désactivée pour toutes les companies');
      fetchLotteries();
    } catch (error) {
      toast.error('Erreur lors du changement de statut');
    } finally {
      setTogglingLotteries(prev => ({ ...prev, [lotteryId]: false }));
    }
  };

  const toggleState = (stateCode) => {
    setExpandedStates(prev => ({
      ...prev,
      [stateCode]: !prev[stateCode]
    }));
  };

  // Group by state
  const groupedLotteries = lotteries.reduce((acc, lot) => {
    const state = lot.state_code;
    if (!acc[state]) {
      acc[state] = { name: lot.state_name, country: lot.country, lotteries: [] };
    }
    acc[state].lotteries.push(lot);
    return acc;
  }, {});

  const filteredStates = Object.entries(groupedLotteries).filter(([code, data]) => {
    if (filterState && code !== filterState) return false;
    if (searchTerm) {
      const match = data.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        data.lotteries.some(l => l.lottery_name.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!match) return false;
    }
    return true;
  });

  const gameTypes = [...new Set(lotteries.map(l => l.game_type))].sort();
  const states = [...new Set(lotteries.map(l => l.state_code))].sort();
  
  // Stats
  const totalActive = lotteries.filter(l => l.is_active_global).length;
  const totalInactive = lotteries.length - totalActive;

  return (
    <AdminLayout role="SUPER_ADMIN">
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-xl">
              <Globe className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Catalogue Global des Loteries</h1>
              <p className="text-slate-400">{lotteries.length} loteries • Source Centralisée</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchLotteries}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
              data-testid="refresh-btn"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Total Loteries</p>
            <p className="text-2xl font-bold text-white">{lotteries.length}</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Actives Globalement</p>
            <p className="text-2xl font-bold text-emerald-400">{totalActive}</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Désactivées</p>
            <p className="text-2xl font-bold text-red-400">{totalInactive}</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">États/Régions</p>
            <p className="text-2xl font-bold text-blue-400">{states.length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher une loterie..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                data-testid="search-input"
              />
            </div>
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              data-testid="filter-state"
            >
              <option value="">Tous les États</option>
              {states.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
            <select
              value={filterGameType}
              onChange={(e) => setFilterGameType(e.target.value)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              data-testid="filter-game-type"
            >
              <option value="">Tous les Types</option>
              {gameTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Power className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <p className="text-blue-400 font-medium">Contrôle Global Super Admin</p>
              <p className="text-slate-400 text-sm">
                Désactiver une loterie ici la désactive automatiquement pour TOUTES les companies. 
                Les Company Admins ne peuvent pas réactiver une loterie désactivée globalement.
              </p>
            </div>
          </div>
        </div>

        {/* Lottery List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredStates.map(([stateCode, data]) => (
              <div key={stateCode} className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleState(stateCode)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                  data-testid={`state-${stateCode}`}
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-emerald-400" />
                    <span className="text-lg font-semibold text-white">{data.name}</span>
                    <span className="text-sm text-slate-400">({stateCode})</span>
                    {data.country && data.country !== 'USA' && (
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                        {data.country}
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full">
                      {data.lotteries.length} jeux
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                      {data.lotteries.filter(l => l.is_active_global).length} actifs
                    </span>
                  </div>
                  {expandedStates[stateCode] ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                </button>
                
                {expandedStates[stateCode] && (
                  <div className="border-t border-slate-800">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-slate-400 text-sm border-b border-slate-800">
                          <th className="px-4 py-3">Nom</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Catégorie</th>
                          <th className="px-4 py-3 text-center">Statut Global</th>
                          <th className="px-4 py-3 text-center">Toggle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.lotteries
                          .filter(l => !filterGameType || l.game_type === filterGameType)
                          .map(lottery => (
                          <tr key={lottery.lottery_id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                            <td className="px-4 py-3 text-white font-medium">{lottery.lottery_name}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">
                                {lottery.game_type}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                lottery.category === 'PREMIUM' 
                                  ? 'bg-yellow-500/20 text-yellow-400' 
                                  : 'bg-slate-700 text-slate-300'
                              }`}>
                                {lottery.category || 'STANDARD'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {lottery.is_active_global ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                                  <Check className="w-3 h-3" /> Actif
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                                  <X className="w-3 h-3" /> Inactif
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Switch
                                checked={lottery.is_active_global}
                                onCheckedChange={() => toggleGlobalStatus(lottery.lottery_id, lottery.is_active_global)}
                                disabled={togglingLotteries[lottery.lottery_id]}
                                data-testid={`toggle-${lottery.lottery_id}`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}

            {filteredStates.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                Aucune loterie trouvée
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
