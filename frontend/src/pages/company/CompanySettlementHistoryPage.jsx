import React, { useState, useEffect } from 'react';
import { Calculator, Search, RefreshCw, Calendar, DollarSign, Ticket, Trophy, CheckCircle, Clock, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/api/auth';
import { API_URL } from '@/config/api';
import axios from 'axios';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/AdminLayout';

const CompanySettlementHistoryPage = () => {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState([]);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
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
      const res = await axios.get(`${API_URL}/api/settlement/company-history`, { headers });
      const data = res.data;
      
      setSettlements(data.settlements || []);
      setStats({
        total_settlements: data.total_settlements || 0,
        total_paid: data.total_paid || 0,
        total_winners: data.total_winners || 0
      });
    } catch (error) {
      console.error('Error fetching settlements:', error);
      // Use empty state if endpoint doesn't exist yet
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
    <AdminLayout 
      title="Historique des Règlements" 
      subtitle="Consultez les règlements de votre compagnie"
    >
      <div className="space-y-6">
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
                  <p className="text-sm text-amber-300">Gagnants Payés</p>
                  <p className="text-2xl font-bold text-white">{stats.total_winners}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Rechercher par loterie ou tirage..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-900/50 border-slate-700"
                />
              </div>
              
              <Button 
                variant="outline" 
                onClick={fetchSettlements}
                className="border-slate-600"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualiser
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Settlements List */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-400" />
              Règlements ({filteredSettlements.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-slate-400" />
                <p className="text-slate-400 mt-2">Chargement...</p>
              </div>
            ) : filteredSettlements.length === 0 ? (
              <div className="text-center py-8">
                <Calculator className="w-12 h-12 mx-auto text-slate-600 mb-2" />
                <p className="text-slate-400">Aucun règlement trouvé</p>
                <p className="text-sm text-slate-500 mt-1">Les règlements apparaîtront ici après la publication des résultats</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSettlements.map((settlement, index) => (
                  <div 
                    key={settlement.settlement_id || index}
                    className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors cursor-pointer"
                    onClick={() => setSelectedSettlement(selectedSettlement?.settlement_id === settlement.settlement_id ? null : settlement)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          settlement.status === 'COMPLETED' 
                            ? 'bg-emerald-500/20' 
                            : 'bg-amber-500/20'
                        }`}>
                          {settlement.status === 'COMPLETED' ? (
                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Clock className="w-5 h-5 text-amber-400" />
                          )}
                        </div>
                        
                        <div>
                          <p className="font-semibold text-white">
                            {settlement.lottery_name || 'Loterie'} - {settlement.draw_name || 'Tirage'}
                          </p>
                          <p className="text-sm text-slate-400">
                            Numéros: {settlement.winning_numbers || '-'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-emerald-400 font-bold">
                          {formatCurrency(settlement.total_paid)} HTG
                        </p>
                        <p className="text-sm text-slate-400">
                          {settlement.winners_count || 0} gagnant(s)
                        </p>
                      </div>
                      
                      <div className="ml-4">
                        {selectedSettlement?.settlement_id === settlement.settlement_id ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                    
                    {/* Expanded details */}
                    {selectedSettlement?.settlement_id === settlement.settlement_id && (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-slate-500">Date</p>
                            <p className="text-sm text-white">{formatDate(settlement.created_at)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Tickets traités</p>
                            <p className="text-sm text-white">{settlement.tickets_processed || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Tickets gagnants</p>
                            <p className="text-sm text-emerald-400">{settlement.winners_count || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Statut</p>
                            <p className={`text-sm ${
                              settlement.status === 'COMPLETED' ? 'text-emerald-400' : 'text-amber-400'
                            }`}>
                              {settlement.status === 'COMPLETED' ? 'Terminé' : 'En cours'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default CompanySettlementHistoryPage;
