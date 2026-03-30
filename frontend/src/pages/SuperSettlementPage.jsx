import React, { useState, useEffect } from 'react';
import { API_URL } from '@/config/api';
import { useAuth } from '@/api/auth';
import { AdminLayout } from '@/components/AdminLayout';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Trophy, Play, CheckCircle, XCircle, RefreshCw, Calendar, 
  Hash, Award, DollarSign, Users, FileText, Clock, AlertTriangle,
  ArrowRight, TrendingUp, Filter, Eye, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const DRAW_NAMES = [
  { value: 'Matin', label: 'Matin' },
  { value: 'Midi', label: 'Midi' },
  { value: 'Soir', label: 'Soir' },
  { value: 'Nuit', label: 'Nuit' },
  { value: 'Midday', label: 'Midday' },
  { value: 'Evening', label: 'Evening' },
];

// Status badge component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    COMPLETED: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Terminé' },
    PROCESSING: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'En cours' },
    PENDING: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'En attente' },
    FAILED: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Échoué' },
    PARTIAL: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Partiel' },
  };
  
  const config = statusConfig[status] || statusConfig.PENDING;
  
  return (
    <Badge className={`${config.bg} ${config.text} border-0`}>
      {config.label}
    </Badge>
  );
};

// Winning numbers display
const WinningNumbersDisplay = ({ numbers }) => {
  if (!numbers) return <span className="text-zinc-500">-</span>;
  
  return (
    <div className="flex gap-2">
      {numbers.first && (
        <span className="bg-amber-500/20 text-amber-400 px-2 py-1 rounded font-mono font-bold">
          1er: {numbers.first}
        </span>
      )}
      {numbers.second && (
        <span className="bg-zinc-500/20 text-zinc-300 px-2 py-1 rounded font-mono">
          2e: {numbers.second}
        </span>
      )}
      {numbers.third && (
        <span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded font-mono">
          3e: {numbers.third}
        </span>
      )}
    </div>
  );
};

export const SuperSettlementPage = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [settlements, setSettlements] = useState([]);
  const [lotteries, setLotteries] = useState([]);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [settlementReport, setSettlementReport] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  
  // Form state for publishing results
  const [formData, setFormData] = useState({
    lottery_id: '',
    lottery_name: '',
    draw_date: new Date().toISOString().split('T')[0],
    draw_name: 'Midi',
    first: '',
    second: '',
    third: '',
    auto_settle: true
  });
  
  // Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  // Fetch lotteries for dropdown
  const fetchLotteries = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/results/lotteries`, { headers });
      setLotteries(res.data?.lotteries || res.data || []);
    } catch (error) {
      console.error('Error fetching lotteries:', error);
    }
  };

  // Fetch settlements list
  const fetchSettlements = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterDate) params.draw_date = filterDate;
      if (filterStatus) params.status = filterStatus;
      
      const res = await axios.get(`${API_URL}/api/settlement/list`, { 
        headers, 
        params: { ...params, limit: 50 }
      });
      setSettlements(res.data.settlements || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des settlements');
    } finally {
      setLoading(false);
    }
  };

  // Fetch settlement report
  const fetchSettlementReport = async (settlementId) => {
    try {
      const res = await axios.get(`${API_URL}/api/settlement/report/${settlementId}`, { headers });
      setSettlementReport(res.data);
    } catch (error) {
      toast.error('Erreur lors du chargement du rapport');
    }
  };

  useEffect(() => {
    fetchLotteries();
    fetchSettlements();
  }, [filterDate, filterStatus]);

  // Handle lottery selection
  const handleLotteryChange = (lotteryId) => {
    const lottery = lotteries.find(l => l.lottery_id === lotteryId);
    setFormData({
      ...formData,
      lottery_id: lotteryId,
      lottery_name: lottery?.lottery_name || ''
    });
  };

  // Publish result and trigger settlement
  const handlePublish = async (e) => {
    e.preventDefault();
    
    if (!formData.lottery_id || !formData.first) {
      toast.error('Veuillez sélectionner une loterie et saisir le 1er lot');
      return;
    }
    
    try {
      setPublishing(true);
      
      const response = await axios.post(`${API_URL}/api/settlement/publish`, formData, { headers });
      
      if (response.data.success) {
        const settlement = response.data.settlement;
        toast.success(
          `Résultat publié! ${settlement?.winning_tickets || 0} gagnants, ${(settlement?.total_payout || 0).toLocaleString()} HTG`
        );
        
        // Reset form
        setFormData({
          ...formData,
          first: '',
          second: '',
          third: ''
        });
        
        // Refresh settlements list
        fetchSettlements();
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Erreur lors de la publication';
      toast.error(message);
    } finally {
      setPublishing(false);
    }
  };

  // Run manual settlement
  const handleManualSettlement = async (resultId) => {
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/api/settlement/run/${resultId}`, {}, { headers });
      if (res.data.success) {
        toast.success('Règlement effectué avec succès');
        fetchSettlements();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du règlement');
    } finally {
      setLoading(false);
    }
  };

  // Toggle row expansion
  const toggleRowExpansion = async (settlementId) => {
    if (expandedRow === settlementId) {
      setExpandedRow(null);
      setSettlementReport(null);
    } else {
      setExpandedRow(settlementId);
      await fetchSettlementReport(settlementId);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="settlement-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Trophy className="h-7 w-7 text-amber-500" />
              Moteur de Règlement
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Publiez les résultats et gérez les settlements automatiques
            </p>
          </div>
          <Button 
            onClick={fetchSettlements}
            variant="outline"
            className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {/* Publish Result Card */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Play className="h-5 w-5 text-green-500" />
              Publier un Résultat
            </CardTitle>
            <CardDescription>
              Entrez les numéros gagnants pour déclencher le settlement automatique
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePublish} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Lottery Selection */}
                <div className="lg:col-span-2">
                  <Label className="text-zinc-300">Loterie</Label>
                  <Select 
                    value={formData.lottery_id} 
                    onValueChange={handleLotteryChange}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      {lotteries.map(lottery => (
                        <SelectItem 
                          key={lottery.lottery_id} 
                          value={lottery.lottery_id}
                          className="text-white hover:bg-zinc-700"
                        >
                          {lottery.lottery_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date */}
                <div>
                  <Label className="text-zinc-300">Date</Label>
                  <Input
                    type="date"
                    value={formData.draw_date}
                    onChange={(e) => setFormData({ ...formData, draw_date: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>

                {/* Draw Name */}
                <div>
                  <Label className="text-zinc-300">Tirage</Label>
                  <Select 
                    value={formData.draw_name} 
                    onValueChange={(v) => setFormData({ ...formData, draw_name: v })}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      {DRAW_NAMES.map(dn => (
                        <SelectItem key={dn.value} value={dn.value} className="text-white">
                          {dn.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Winning Numbers */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                <div>
                  <Label className="text-amber-400 font-semibold">1er Lot (Borlette)</Label>
                  <Input
                    placeholder="ex: 142"
                    value={formData.first}
                    onChange={(e) => setFormData({ ...formData, first: e.target.value })}
                    className="bg-zinc-800 border-amber-500/50 text-white text-lg font-mono"
                    maxLength={5}
                    required
                  />
                </div>
                <div>
                  <Label className="text-zinc-400">2ème Lot</Label>
                  <Input
                    placeholder="ex: 15"
                    value={formData.second}
                    onChange={(e) => setFormData({ ...formData, second: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 text-white text-lg font-mono"
                    maxLength={2}
                  />
                </div>
                <div>
                  <Label className="text-zinc-400">3ème Lot</Label>
                  <Input
                    placeholder="ex: 88"
                    value={formData.third}
                    onChange={(e) => setFormData({ ...formData, third: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 text-white text-lg font-mono"
                    maxLength={2}
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    type="submit" 
                    disabled={publishing || !formData.lottery_id || !formData.first}
                    className="w-full bg-green-600 hover:bg-green-700"
                    data-testid="publish-result-btn"
                  >
                    {publishing ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Publier & Régler
                  </Button>
                </div>
              </div>

              {/* Auto-settle option */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="auto_settle"
                  checked={formData.auto_settle}
                  onChange={(e) => setFormData({ ...formData, auto_settle: e.target.checked })}
                  className="rounded bg-zinc-800 border-zinc-600"
                />
                <label htmlFor="auto_settle" className="text-sm text-zinc-400">
                  Déclencher le settlement automatiquement après publication
                </label>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-zinc-500" />
            <span className="text-sm text-zinc-500">Filtrer:</span>
          </div>
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white w-40"
            placeholder="Date"
          />
          <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white w-40">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              <SelectItem value="all" className="text-white">Tous</SelectItem>
              <SelectItem value="COMPLETED" className="text-white">Terminé</SelectItem>
              <SelectItem value="PROCESSING" className="text-white">En cours</SelectItem>
              <SelectItem value="FAILED" className="text-white">Échoué</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Settlements List */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Historique des Settlements ({settlements.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-zinc-500" />
              </div>
            ) : settlements.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                Aucun settlement trouvé
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left py-3 px-4 text-zinc-400 font-medium">Date</th>
                      <th className="text-left py-3 px-4 text-zinc-400 font-medium">Loterie</th>
                      <th className="text-left py-3 px-4 text-zinc-400 font-medium">Tirage</th>
                      <th className="text-left py-3 px-4 text-zinc-400 font-medium">Numéros</th>
                      <th className="text-right py-3 px-4 text-zinc-400 font-medium">Tickets</th>
                      <th className="text-right py-3 px-4 text-zinc-400 font-medium">Gagnants</th>
                      <th className="text-right py-3 px-4 text-zinc-400 font-medium">Paiements</th>
                      <th className="text-center py-3 px-4 text-zinc-400 font-medium">Statut</th>
                      <th className="text-right py-3 px-4 text-zinc-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map((settlement) => (
                      <React.Fragment key={settlement.settlement_id}>
                        <tr 
                          className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer"
                          onClick={() => toggleRowExpansion(settlement.settlement_id)}
                        >
                          <td className="py-3 px-4 text-white font-medium">
                            {settlement.draw_date}
                          </td>
                          <td className="py-3 px-4 text-zinc-300">
                            {settlement.lottery_id?.split('_').slice(-1)[0] || 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-zinc-300">
                            {settlement.draw_name}
                          </td>
                          <td className="py-3 px-4">
                            <WinningNumbersDisplay numbers={settlement.winning_numbers} />
                          </td>
                          <td className="py-3 px-4 text-right text-white">
                            {settlement.total_tickets_scanned || 0}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-bold ${(settlement.total_winning_tickets || 0) > 0 ? 'text-green-400' : 'text-zinc-500'}`}>
                              {settlement.total_winning_tickets || 0}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-amber-400 font-semibold">
                            {(settlement.total_payout_amount || 0).toLocaleString()} HTG
                          </td>
                          <td className="py-3 px-4 text-center">
                            <StatusBadge status={settlement.status} />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-zinc-400 hover:text-white"
                            >
                              {expandedRow === settlement.settlement_id ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </td>
                        </tr>
                        
                        {/* Expanded Row - Report Details */}
                        {expandedRow === settlement.settlement_id && settlementReport && (
                          <tr className="bg-zinc-800/30">
                            <td colSpan={9} className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {/* Stats Cards */}
                                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-700">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Users className="h-4 w-4 text-blue-500" />
                                    <span className="text-zinc-400 text-sm">Tickets Scannés</span>
                                  </div>
                                  <div className="text-2xl font-bold text-white">
                                    {settlementReport.statistics?.total_tickets_scanned || 0}
                                  </div>
                                </div>
                                
                                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-700">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Trophy className="h-4 w-4 text-green-500" />
                                    <span className="text-zinc-400 text-sm">Gagnants</span>
                                  </div>
                                  <div className="text-2xl font-bold text-green-400">
                                    {settlementReport.statistics?.total_winning_tickets || 0}
                                  </div>
                                </div>
                                
                                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-700">
                                  <div className="flex items-center gap-2 mb-2">
                                    <DollarSign className="h-4 w-4 text-amber-500" />
                                    <span className="text-zinc-400 text-sm">Total Payé</span>
                                  </div>
                                  <div className="text-2xl font-bold text-amber-400">
                                    {(settlementReport.statistics?.total_payout_amount || 0).toLocaleString()} HTG
                                  </div>
                                </div>
                                
                                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-700">
                                  <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp className="h-4 w-4 text-purple-500" />
                                    <span className="text-zinc-400 text-sm">Profit/Perte</span>
                                  </div>
                                  <div className={`text-2xl font-bold ${(settlementReport.statistics?.profit_loss || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {(settlementReport.statistics?.profit_loss || 0).toLocaleString()} HTG
                                  </div>
                                </div>
                              </div>
                              
                              {/* Winners by Rank */}
                              <div className="mt-4 grid grid-cols-3 gap-4">
                                <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/30">
                                  <div className="text-amber-400 text-sm">1er Lot (x60)</div>
                                  <div className="text-xl font-bold text-white">
                                    {settlementReport.statistics?.winners_by_rank?.[1] || settlementReport.statistics?.winners_by_rank?.['1'] || 0} gagnants
                                  </div>
                                </div>
                                <div className="bg-zinc-500/10 rounded-lg p-3 border border-zinc-500/30">
                                  <div className="text-zinc-400 text-sm">2ème Lot (x20)</div>
                                  <div className="text-xl font-bold text-white">
                                    {settlementReport.statistics?.winners_by_rank?.[2] || settlementReport.statistics?.winners_by_rank?.['2'] || 0} gagnants
                                  </div>
                                </div>
                                <div className="bg-orange-500/10 rounded-lg p-3 border border-orange-500/30">
                                  <div className="text-orange-400 text-sm">3ème Lot (x10)</div>
                                  <div className="text-xl font-bold text-white">
                                    {settlementReport.statistics?.winners_by_rank?.[3] || settlementReport.statistics?.winners_by_rank?.['3'] || 0} gagnants
                                  </div>
                                </div>
                              </div>

                              {/* Winning Tickets List */}
                              {settlementReport.winning_tickets?.length > 0 && (
                                <div className="mt-4">
                                  <h4 className="text-sm font-medium text-zinc-400 mb-2">
                                    Tickets Gagnants ({settlementReport.winning_tickets.length})
                                  </h4>
                                  <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {settlementReport.winning_tickets.slice(0, 10).map((ticket) => (
                                      <div 
                                        key={ticket.ticket_id}
                                        className="flex items-center justify-between bg-zinc-900 rounded p-2 border border-zinc-700"
                                      >
                                        <div>
                                          <span className="text-white font-mono">{ticket.ticket_code}</span>
                                          <span className="text-zinc-500 text-sm ml-2">
                                            Agent: {ticket.agent_name || 'N/A'}
                                          </span>
                                        </div>
                                        <div className="text-green-400 font-bold">
                                          +{(ticket.win_amount || 0).toLocaleString()} HTG
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default SuperSettlementPage;
