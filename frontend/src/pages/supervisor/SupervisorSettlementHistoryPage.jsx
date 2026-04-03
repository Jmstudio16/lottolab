import React, { useState, useEffect } from 'react';
import { Calculator, Search, RefreshCw, Calendar, DollarSign, Ticket, Trophy, CheckCircle, Clock, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/api/auth';
import { API_URL } from '@/config/api';
import axios from 'axios';

const SupervisorSettlementHistoryPage = () => {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState([]);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    total_settlements: 0,
    total_paid: 0,
    total_winners: 0
  });

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchSettlements();
  }, [token]);

  const fetchSettlements = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/settlement/supervisor-history`, { headers });
      const data = res.data;
      
      setSettlements(data.settlements || []);
      setStats({
        total_settlements: data.total_settlements || 0,
        total_paid: data.total_paid || 0,
        total_winners: data.total_winners || 0
      });
    } catch (error) {
      console.error('Error fetching settlements:', error);
      setSettlements([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR').format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredSettlements = settlements.filter(s => {
    const matchesSearch = !searchTerm || 
      s.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.draw_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  return (
      <div className="p-4 sm:p-6 space-y-6" data-testid="supervisor-settlement-history-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
              <Calculator className="w-6 h-6 sm:w-7 sm:h-7 text-purple-400" />
              Historique Règlements
            </h1>
            <p className="text-sm text-slate-400">
              Consultez les règlements de vos agents
            </p>
          </div>
          <Button onClick={fetchSettlements} variant="outline" className="border-slate-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Calculator className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-blue-300">Total Règlements</p>
                  <p className="text-2xl font-bold text-white">{stats.total_settlements}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-emerald-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <DollarSign className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-emerald-300">Total Payé</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(stats.total_paid)} HTG</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Trophy className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-amber-300">Tickets Gagnants</p>
                  <p className="text-2xl font-bold text-white">{stats.total_winners}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Rechercher par loterie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white"
            data-testid="search-settlements"
          />
        </div>

        {/* Settlements List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : filteredSettlements.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
            <Calculator className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Aucun règlement trouvé</p>
            <p className="text-sm text-slate-500 mt-2">
              Les règlements apparaîtront ici après publication des résultats
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSettlements.map((settlement) => (
              <Card 
                key={settlement.settlement_id} 
                className="bg-slate-800/50 border-slate-700 hover:border-purple-500/50 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${
                        settlement.status === 'COMPLETED' ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                      }`}>
                        {settlement.status === 'COMPLETED' ? (
                          <CheckCircle className="w-6 h-6 text-emerald-400" />
                        ) : (
                          <Clock className="w-6 h-6 text-amber-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{settlement.lottery_name}</h3>
                        <p className="text-sm text-slate-400">
                          {settlement.draw_date} - {settlement.draw_name}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <span className="text-slate-400">
                            <Ticket className="w-3 h-3 inline mr-1" />
                            {settlement.total_tickets_scanned || 0} tickets
                          </span>
                          <span className="text-emerald-400">
                            <Trophy className="w-3 h-3 inline mr-1" />
                            {settlement.total_winning_tickets || 0} gagnants
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Ventes</p>
                        <p className="font-semibold text-white">
                          {formatCurrency(settlement.total_sales_amount)} HTG
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Payé</p>
                        <p className="font-semibold text-emerald-400">
                          {formatCurrency(settlement.total_payout_amount)} HTG
                        </p>
                      </div>
                      <Button
                        onClick={() => setSelectedSettlement(
                          selectedSettlement?.settlement_id === settlement.settlement_id ? null : settlement
                        )}
                        variant="ghost"
                        size="sm"
                        className="text-slate-400"
                      >
                        {selectedSettlement?.settlement_id === settlement.settlement_id ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {selectedSettlement?.settlement_id === settlement.settlement_id && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-slate-400">ID Règlement</p>
                          <p className="text-white font-mono text-xs">{settlement.settlement_id}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Numéros Gagnants</p>
                          <p className="text-emerald-400 font-mono">
                            {settlement.winning_numbers?.first || '-'} / {settlement.winning_numbers?.second || '-'} / {settlement.winning_numbers?.third || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Gagnants 1er Lot</p>
                          <p className="text-white">{settlement.winners_by_rank?.rank_1 || 0}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Gagnants 2ème Lot</p>
                          <p className="text-white">{settlement.winners_by_rank?.rank_2 || 0}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Gagnants 3ème Lot</p>
                          <p className="text-white">{settlement.winners_by_rank?.rank_3 || 0}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Créé</p>
                          <p className="text-white">{formatDate(settlement.created_at)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Complété</p>
                          <p className="text-white">{formatDate(settlement.completed_at)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Statut</p>
                          <span className={`px-2 py-1 rounded text-xs ${
                            settlement.status === 'COMPLETED' 
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {settlement.status === 'COMPLETED' ? 'Terminé' : settlement.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
  );
};

export default SupervisorSettlementHistoryPage;
