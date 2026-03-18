import React, { useEffect, useState, useMemo } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Ticket, ToggleLeft, ToggleRight, Search, Filter, 
  ChevronLeft, ChevronRight, MapPin, Clock, Globe,
  CheckCircle, XCircle, RefreshCw
} from 'lucide-react';

// US States with emoji flags
const US_STATES = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia',
  'HT': 'Haiti', 'MULTI': 'Multi-State'
};

const ITEMS_PER_PAGE = 24;

export const CompanyLotteriesPage = () => {
  const [lotteries, setLotteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    fetchLotteries();
  }, []);

  const fetchLotteries = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/company/lottery-catalog');
      setLotteries(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des loteries');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (lotteryId, currentStatus) => {
    try {
      await apiClient.put(`/company/lottery-catalog/${lotteryId}/toggle`, null, {
        params: { enabled: !currentStatus }
      });
      toast.success(`Loterie ${!currentStatus ? 'activée' : 'désactivée'}`);
      fetchLotteries();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du changement de statut');
    }
  };

  const handleBulkToggle = async (enable) => {
    try {
      for (const lotteryId of selectedIds) {
        await apiClient.put(`/company/lottery-catalog/${lotteryId}/toggle`, null, {
          params: { enabled: enable }
        });
      }
      toast.success(`${selectedIds.length} loteries ${enable ? 'activées' : 'désactivées'}`);
      setSelectedIds([]);
      setBulkMode(false);
      fetchLotteries();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour en lot');
    }
  };

  // Get unique states from lotteries
  const availableStates = useMemo(() => {
    const states = new Set();
    lotteries.forEach(l => {
      if (l.state_code) states.add(l.state_code);
      if (l.region) states.add(l.region);
    });
    return Array.from(states).sort();
  }, [lotteries]);

  // Filter and paginate lotteries
  const filteredLotteries = useMemo(() => {
    return lotteries.filter(lottery => {
      const matchesSearch = 
        lottery.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lottery.state_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lottery.region?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lottery.game_type?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesState = stateFilter === 'all' || 
        lottery.state_code === stateFilter || 
        lottery.region === stateFilter;
      
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'enabled' && lottery.enabled) ||
        (statusFilter === 'disabled' && !lottery.enabled);
      
      return matchesSearch && matchesState && matchesStatus;
    });
  }, [lotteries, searchTerm, stateFilter, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredLotteries.length / ITEMS_PER_PAGE);
  const paginatedLotteries = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLotteries.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLotteries, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, stateFilter, statusFilter]);

  const toggleSelect = (lotteryId) => {
    if (selectedIds.includes(lotteryId)) {
      setSelectedIds(selectedIds.filter(id => id !== lotteryId));
    } else {
      setSelectedIds([...selectedIds, lotteryId]);
    }
  };

  const selectAll = () => {
    const ids = paginatedLotteries.map(l => l.lottery_id);
    setSelectedIds([...new Set([...selectedIds, ...ids])]);
  };

  const deselectAll = () => {
    const ids = paginatedLotteries.map(l => l.lottery_id);
    setSelectedIds(selectedIds.filter(id => !ids.includes(id)));
  };

  if (loading) {
    return (
      <AdminLayout title="Catalogue Loteries" subtitle="Gérez les loteries de votre entreprise" role="COMPANY_ADMIN">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Catalogue Loteries" subtitle="Gérez les loteries de votre entreprise" role="COMPANY_ADMIN">
      <div className="space-y-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Globe className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{lotteries.length}</p>
                <p className="text-xs text-slate-400">Total Loteries</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">{lotteries.filter(l => l.enabled).length}</p>
                <p className="text-xs text-slate-400">Activées</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-500/20 rounded-lg">
                <XCircle className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-400">{lotteries.filter(l => !l.enabled).length}</p>
                <p className="text-xs text-slate-400">Désactivées</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <MapPin className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-400">{availableStates.length}</p>
                <p className="text-xs text-slate-400">Régions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Rechercher par nom, état, type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white pl-10"
              data-testid="lottery-search"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            {/* State Filter */}
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              data-testid="state-filter"
            >
              <option value="all">Tous les États ({lotteries.length})</option>
              {availableStates.map(state => (
                <option key={state} value={state}>
                  {US_STATES[state] || state} ({lotteries.filter(l => l.state_code === state || l.region === state).length})
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
              className={statusFilter === 'all' ? 'bg-blue-600' : 'border-slate-600 text-slate-300'}
              data-testid="filter-all"
            >
              Toutes ({lotteries.length})
            </Button>
            <Button
              variant={statusFilter === 'enabled' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('enabled')}
              className={statusFilter === 'enabled' ? 'bg-green-600' : 'border-slate-600 text-slate-300'}
              data-testid="filter-enabled"
            >
              Activées ({lotteries.filter(l => l.enabled).length})
            </Button>
            <Button
              variant={statusFilter === 'disabled' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('disabled')}
              className={statusFilter === 'disabled' ? 'bg-slate-600' : 'border-slate-600 text-slate-300'}
              data-testid="filter-disabled"
            >
              Désactivées ({lotteries.filter(l => !l.enabled).length})
            </Button>

            {/* Bulk Mode Toggle */}
            <Button
              variant={bulkMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setBulkMode(!bulkMode);
                setSelectedIds([]);
              }}
              className={bulkMode ? 'bg-purple-600' : 'border-slate-600 text-slate-300'}
            >
              <Filter className="w-4 h-4 mr-1" />
              Mode Lot
            </Button>

            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLotteries}
              className="border-slate-600 text-slate-300"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Bulk Actions */}
        {bulkMode && (
          <div className="bg-purple-900/20 border border-purple-700/50 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-purple-300">
                {selectedIds.length} loterie(s) sélectionnée(s)
              </span>
              <Button size="sm" variant="outline" onClick={selectAll} className="border-purple-500 text-purple-300">
                Tout sélectionner
              </Button>
              <Button size="sm" variant="outline" onClick={deselectAll} className="border-slate-600 text-slate-300">
                Désélectionner
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleBulkToggle(true)}
                disabled={selectedIds.length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Activer
              </Button>
              <Button
                size="sm"
                onClick={() => handleBulkToggle(false)}
                disabled={selectedIds.length === 0}
                className="bg-red-600 hover:bg-red-700"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Désactiver
              </Button>
            </div>
          </div>
        )}

        {/* Results Count */}
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>
            Affichage de {paginatedLotteries.length} sur {filteredLotteries.length} loteries
          </span>
          <span>
            Page {currentPage} sur {totalPages || 1}
          </span>
        </div>

        {/* Lottery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedLotteries.map((lottery) => (
            <div
              key={lottery.lottery_id}
              className={`bg-card border rounded-xl p-4 transition-all relative ${
                lottery.enabled
                  ? 'border-green-700/50 bg-green-950/10'
                  : 'border-slate-700/50 opacity-70'
              } ${bulkMode && selectedIds.includes(lottery.lottery_id) ? 'ring-2 ring-purple-500' : ''}`}
              onClick={() => bulkMode && toggleSelect(lottery.lottery_id)}
              style={{ cursor: bulkMode ? 'pointer' : 'default' }}
              data-testid={`lottery-card-${lottery.lottery_id}`}
            >
              {/* Selection Checkbox */}
              {bulkMode && (
                <div className="absolute top-2 left-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(lottery.lottery_id)}
                    onChange={() => toggleSelect(lottery.lottery_id)}
                    className="w-5 h-5 accent-purple-500"
                  />
                </div>
              )}

              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-white text-sm leading-tight">
                    {lottery.lottery_name}
                  </h3>
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-400">
                      {US_STATES[lottery.state_code] || lottery.region || lottery.state_code}
                    </span>
                  </div>
                </div>
                {!bulkMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(lottery.lottery_id, lottery.enabled);
                    }}
                    data-testid={`toggle-lottery-${lottery.lottery_id}`}
                    className="ml-2"
                  >
                    {lottery.enabled ? (
                      <ToggleRight className="w-8 h-8 text-green-400" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-600" />
                    )}
                  </button>
                )}
              </div>
              
              {/* Game Type Badge */}
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">
                  {lottery.game_type || 'Pick 3'}
                </span>
                {lottery.draw_times?.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    {lottery.draw_times.length} tirages
                  </span>
                )}
              </div>

              {lottery.description && (
                <p className="text-xs text-slate-400 mb-2 line-clamp-2">{lottery.description}</p>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase border ${
                  lottery.enabled
                    ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}>
                  {lottery.enabled ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {filteredLotteries.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Ticket className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Aucune loterie ne correspond à vos critères de recherche.</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="border-slate-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className={currentPage === pageNum ? 'bg-blue-600' : 'border-slate-600'}
                >
                  {pageNum}
                </Button>
              );
            })}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="border-slate-600"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
