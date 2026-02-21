import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import { AdminLayout } from '@/components/AdminLayout';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Globe, Search, Plus, Edit2, Trash2, ChevronDown, ChevronRight,
  MapPin, Filter, RefreshCw, Check, X, Database
} from 'lucide-react';

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

  const headers = { Authorization: `Bearer ${token}` };

  const fetchLotteries = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/super/lottery-catalog`, { headers });
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

  const seedCatalog = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/super/seed-lottery-catalog`, {}, { headers });
      toast.success(res.data.message);
      fetchLotteries();
    } catch (error) {
      toast.error('Erreur lors du seed');
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
      acc[state] = { name: lot.state_name, lotteries: [] };
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

  const gameTypes = [...new Set(lotteries.map(l => l.game_type))];
  const states = [...new Set(lotteries.map(l => l.state_code))].sort();

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
              <p className="text-slate-400">{lotteries.length} loteries au total</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={seedCatalog}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              data-testid="seed-catalog-btn"
            >
              <Database className="w-4 h-4" />
              Seed Catalog
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              data-testid="add-lottery-btn"
            >
              <Plus className="w-4 h-4" />
              Ajouter
            </button>
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
            <button
              onClick={fetchLotteries}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
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
                    <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full">
                      {data.lotteries.length} jeux
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
                          <th className="px-4 py-3">Statut</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.lotteries
                          .filter(l => !filterGameType || l.game_type === filterGameType)
                          .map(lottery => (
                          <tr key={lottery.lottery_id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                            <td className="px-4 py-3 text-white">{lottery.lottery_name}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">
                                {lottery.game_type}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {lottery.is_active ? (
                                <span className="flex items-center gap-1 text-emerald-400">
                                  <Check className="w-4 h-4" /> Actif
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-red-400">
                                  <X className="w-4 h-4" /> Inactif
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => setEditingLottery(lottery)}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                                data-testid={`edit-${lottery.lottery_id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
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
                Aucune loterie trouvée
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
