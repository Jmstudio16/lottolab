import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw,
  Search,
  CreditCard,
  DollarSign,
  Users,
  AlertCircle,
  CheckCircle,
  Plus,
  Minus
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const CompanyAgentBalancesPage = () => {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [adjustmentData, setAdjustmentData] = useState({
    adjustment_type: 'CREDIT_ADD',
    amount: 0,
    reason: ''
  });
  const [summary, setSummary] = useState({
    total_credit_limit: 0,
    total_current_balance: 0,
    total_available: 0,
    agents_count: 0
  });

  useEffect(() => {
    fetchBalances();
  }, []);

  const fetchBalances = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/company/agent-balances');
      const data = response.data || [];
      setBalances(data);
      
      // Calculate summary
      const totals = data.reduce((acc, bal) => ({
        total_credit_limit: acc.total_credit_limit + (bal.credit_limit || 0),
        total_current_balance: acc.total_current_balance + (bal.current_balance || 0),
        total_available: acc.total_available + (bal.available_balance || 0),
        agents_count: acc.agents_count + 1
      }), { total_credit_limit: 0, total_current_balance: 0, total_available: 0, agents_count: 0 });
      
      setSummary(totals);
    } catch (error) {
      toast.error('Échec du chargement des soldes');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustBalance = async () => {
    if (!selectedAgent || !adjustmentData.amount || !adjustmentData.reason) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    try {
      await apiClient.put(`/company/agent-balances/${selectedAgent.agent_id}/adjust`, {
        agent_id: selectedAgent.agent_id,
        ...adjustmentData
      });
      toast.success('Solde ajusté avec succès');
      setShowAdjustModal(false);
      setSelectedAgent(null);
      setAdjustmentData({ adjustment_type: 'CREDIT_ADD', amount: 0, reason: '' });
      fetchBalances();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Échec de l\'ajustement');
    }
  };

  const openAdjustModal = (agent) => {
    setSelectedAgent(agent);
    setShowAdjustModal(true);
  };

  const filteredBalances = balances.filter(bal => 
    (bal.agent_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (bal.agent_email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-HT', { 
      style: 'decimal',
      minimumFractionDigits: 2 
    }).format(amount || 0) + ' HTG';
  };

  const getBalanceStatus = (balance) => {
    const ratio = balance.available_balance / balance.credit_limit;
    if (ratio > 0.5) return { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Bon' };
    if (ratio > 0.2) return { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Attention' };
    return { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Critique' };
  };

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="agent-balances-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Wallet className="w-7 h-7 text-yellow-400" />
              Soldes des Agents
            </h1>
            <p className="text-slate-400 mt-1">Gérer les crédits et soldes des agents</p>
          </div>
          <Button 
            onClick={fetchBalances} 
            variant="outline"
            className="border-slate-600 hover:bg-slate-700"
            data-testid="refresh-balances-btn"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-white">{summary.agents_count}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Crédit Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-400">{formatCurrency(summary.total_credit_limit)}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Ventes Dues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-400">{formatCurrency(summary.total_current_balance)}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Crédit Disponible
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(summary.total_available)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Rechercher un agent..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white"
            data-testid="search-agents-input"
          />
        </div>

        {/* Balances Table */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-slate-400" />
              <p className="text-slate-400 mt-2">Chargement...</p>
            </div>
          ) : filteredBalances.length === 0 ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-slate-500" />
              <p className="text-slate-400 mt-2">Aucun solde agent trouvé</p>
              <p className="text-slate-500 text-sm">Les soldes sont créés automatiquement lors de la première vente</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Agent</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Limite Crédit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Solde Actuel</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Disponible</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Total Ventes</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Total Paiements</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredBalances.map((balance) => {
                    const status = getBalanceStatus(balance);
                    return (
                      <tr key={balance.agent_id} className="hover:bg-slate-700/30" data-testid={`agent-balance-row-${balance.agent_id}`}>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-white">{balance.agent_name || 'N/A'}</p>
                            <p className="text-sm text-slate-400">{balance.agent_email || ''}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-blue-400">
                          {formatCurrency(balance.credit_limit)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-orange-400">
                          {formatCurrency(balance.current_balance)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-green-400">
                          {formatCurrency(balance.available_balance)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-white">
                          {formatCurrency(balance.total_sales)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-purple-400">
                          {formatCurrency(balance.total_payouts)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAdjustModal(balance)}
                            className="border-slate-600 hover:bg-slate-700"
                            data-testid={`adjust-balance-btn-${balance.agent_id}`}
                          >
                            Ajuster
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Adjust Balance Modal */}
        <Dialog open={showAdjustModal} onOpenChange={setShowAdjustModal}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-yellow-400" />
                Ajuster le Solde - {selectedAgent?.agent_name}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              {/* Current Balance Info */}
              {selectedAgent && (
                <div className="bg-slate-900/50 p-3 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Limite actuelle:</span>
                    <span className="text-blue-400 font-mono">{formatCurrency(selectedAgent.credit_limit)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Solde actuel:</span>
                    <span className="text-orange-400 font-mono">{formatCurrency(selectedAgent.current_balance)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Disponible:</span>
                    <span className="text-green-400 font-mono">{formatCurrency(selectedAgent.available_balance)}</span>
                  </div>
                </div>
              )}

              {/* Adjustment Type */}
              <div className="space-y-2">
                <Label className="text-slate-300">Type d'ajustement</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={adjustmentData.adjustment_type === 'CREDIT_ADD' ? 'default' : 'outline'}
                    onClick={() => setAdjustmentData({...adjustmentData, adjustment_type: 'CREDIT_ADD'})}
                    className={adjustmentData.adjustment_type === 'CREDIT_ADD' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'border-slate-600'}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Ajouter
                  </Button>
                  <Button
                    type="button"
                    variant={adjustmentData.adjustment_type === 'CREDIT_REMOVE' ? 'default' : 'outline'}
                    onClick={() => setAdjustmentData({...adjustmentData, adjustment_type: 'CREDIT_REMOVE'})}
                    className={adjustmentData.adjustment_type === 'CREDIT_REMOVE' 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'border-slate-600'}
                  >
                    <Minus className="w-4 h-4 mr-1" />
                    Retirer
                  </Button>
                  <Button
                    type="button"
                    variant={adjustmentData.adjustment_type === 'BALANCE_RESET' ? 'default' : 'outline'}
                    onClick={() => setAdjustmentData({...adjustmentData, adjustment_type: 'BALANCE_RESET'})}
                    className={adjustmentData.adjustment_type === 'BALANCE_RESET' 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'border-slate-600'}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Reset
                  </Button>
                </div>
              </div>

              {/* Amount */}
              {adjustmentData.adjustment_type !== 'BALANCE_RESET' && (
                <div className="space-y-2">
                  <Label className="text-slate-300">Montant (HTG)</Label>
                  <Input
                    type="number"
                    value={adjustmentData.amount}
                    onChange={(e) => setAdjustmentData({...adjustmentData, amount: parseFloat(e.target.value) || 0})}
                    className="bg-slate-900 border-slate-600 text-white"
                    placeholder="0.00"
                    min="0"
                    step="100"
                  />
                </div>
              )}

              {/* Reason */}
              <div className="space-y-2">
                <Label className="text-slate-300">Raison</Label>
                <Input
                  value={adjustmentData.reason}
                  onChange={(e) => setAdjustmentData({...adjustmentData, reason: e.target.value})}
                  className="bg-slate-900 border-slate-600 text-white"
                  placeholder="Ex: Augmentation limite mensuelle"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAdjustModal(false)}
                  className="flex-1 border-slate-600"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleAdjustBalance}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black"
                  data-testid="confirm-adjust-btn"
                >
                  Confirmer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default CompanyAgentBalancesPage;
