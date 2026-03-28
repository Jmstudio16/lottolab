import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import { AdminLayout } from '@/components/AdminLayout';
import axios from 'axios';
import { toast } from 'sonner';
import { API_URL } from '@/config/api';
import { 
  Wallet, TrendingUp, TrendingDown, RefreshCw, DollarSign,
  CreditCard, ArrowUpRight, ArrowDownRight, Clock, Calendar,
  Users, AlertTriangle, CheckCircle, Banknote, PiggyBank,
  FileSpreadsheet, ChevronRight, Lock, Unlock
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * FinancialDashboardPage - Complete financial management dashboard
 * Features: Cash register, reconciliation, agent credits, reports
 */
const FinancialDashboardPage = () => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [currentRegister, setCurrentRegister] = useState(null);
  const [registerHistory, setRegisterHistory] = useState([]);
  const [agentBalances, setAgentBalances] = useState([]);
  const [reconciliationReports, setReconciliationReports] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showAgentTxnModal, setShowAgentTxnModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  
  // Form data
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  const [cashCounted, setCashCounted] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [txnAmount, setTxnAmount] = useState('');
  const [txnType, setTxnType] = useState('CREDIT');
  const [txnNotes, setTxnNotes] = useState('');
  
  const headers = { Authorization: `Bearer ${token}` };
  const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user?.role);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, registerRes, historyRes] = await Promise.all([
        axios.get(`${API_URL}/api/financial/dashboard/stats`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/financial/cash-register/current`, { headers }).catch(() => ({ data: { is_open: false } })),
        axios.get(`${API_URL}/api/financial/cash-register/history?limit=10`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setStats(statsRes.data);
      setCurrentRegister(registerRes.data);
      setRegisterHistory(historyRes.data || []);
      
      if (isAdmin) {
        const [balancesRes, reconRes] = await Promise.all([
          axios.get(`${API_URL}/api/financial/agents/balances`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/api/financial/reconciliation/reports?limit=10`, { headers }).catch(() => ({ data: [] }))
        ]);
        setAgentBalances(balancesRes.data || []);
        setReconciliationReports(reconRes.data || []);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const handleOpenRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/api/financial/cash-register/open`, {
        opening_balance: parseFloat(openingBalance)
      }, { headers });
      toast.success(response.data.message);
      setShowOpenModal(false);
      setOpeningBalance('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'ouverture');
    }
  };

  const handleCloseRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/api/financial/cash-register/close`, {
        closing_balance: parseFloat(closingBalance),
        cash_counted: parseFloat(cashCounted),
        notes: closingNotes
      }, { headers });
      toast.success(response.data.message);
      setShowCloseModal(false);
      setClosingBalance('');
      setCashCounted('');
      setClosingNotes('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la fermeture');
    }
  };

  const handleAgentTransaction = async (e) => {
    e.preventDefault();
    if (!selectedAgent) return;
    
    try {
      const response = await axios.post(`${API_URL}/api/financial/agent/transaction`, {
        agent_id: selectedAgent.agent_id,
        amount: parseFloat(txnAmount),
        transaction_type: txnType,
        notes: txnNotes
      }, { headers });
      toast.success(response.data.message);
      setShowAgentTxnModal(false);
      setTxnAmount('');
      setTxnNotes('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la transaction');
    }
  };

  const handleGenerateReconciliation = async () => {
    const date = new Date().toISOString().split('T')[0];
    try {
      const response = await axios.post(`${API_URL}/api/financial/reconciliation/generate`, {
        date
      }, { headers });
      toast.success('Rapport de réconciliation généré');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('fr-HT', {
      style: 'currency',
      currency: 'HTG',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: Wallet },
    { id: 'register', label: 'Caisse', icon: CreditCard },
    ...(isAdmin ? [
      { id: 'agents', label: 'Agents', icon: Users },
      { id: 'reconciliation', label: 'Réconciliation', icon: FileSpreadsheet }
    ] : [])
  ];

  return (
    <AdminLayout role={user?.role}>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl">
              <Wallet className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Gestion Financière</h1>
              <p className="text-slate-400">Dashboard temps réel</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {!currentRegister?.is_open ? (
              <Button
                onClick={() => setShowOpenModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700"
                data-testid="open-register-btn"
              >
                <Unlock className="w-4 h-4 mr-2" />
                Ouvrir Caisse
              </Button>
            ) : (
              <Button
                onClick={() => setShowCloseModal(true)}
                className="bg-amber-600 hover:bg-amber-700"
                data-testid="close-register-btn"
              >
                <Lock className="w-4 h-4 mr-2" />
                Fermer Caisse
              </Button>
            )}
            
            <Button onClick={fetchData} variant="outline" className="border-slate-600">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-emerald-900/50 to-emerald-800/30 border border-emerald-700/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                  <span className="text-xs text-emerald-400 px-2 py-1 bg-emerald-500/20 rounded">Aujourd'hui</span>
                </div>
                <p className="text-2xl font-bold text-white">{formatMoney(stats.today?.sales)}</p>
                <p className="text-sm text-slate-400">{stats.today?.tickets || 0} tickets</p>
              </div>
              
              <div className="bg-gradient-to-br from-red-900/50 to-red-800/30 border border-red-700/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <TrendingDown className="w-6 h-6 text-red-400" />
                  <span className="text-xs text-red-400 px-2 py-1 bg-red-500/20 rounded">Paiements</span>
                </div>
                <p className="text-2xl font-bold text-white">{formatMoney(stats.today?.payouts)}</p>
                <p className="text-sm text-slate-400">{stats.today?.payout_count || 0} payés</p>
              </div>
              
              <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border border-blue-700/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-6 h-6 text-blue-400" />
                  <span className="text-xs text-blue-400 px-2 py-1 bg-blue-500/20 rounded">Profit</span>
                </div>
                <p className={`text-2xl font-bold ${stats.today?.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatMoney(stats.today?.profit)}
                </p>
                <p className="text-sm text-slate-400">Net aujourd'hui</p>
              </div>
              
              <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border border-purple-700/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="w-6 h-6 text-purple-400" />
                  <span className="text-xs text-purple-400 px-2 py-1 bg-purple-500/20 rounded">Ce mois</span>
                </div>
                <p className="text-2xl font-bold text-white">{formatMoney(stats.month?.sales)}</p>
                <p className="text-sm text-slate-400">{stats.month?.tickets || 0} tickets</p>
              </div>
            </div>

            {/* Operations Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                  <h3 className="text-white font-medium">Caisses Ouvertes</h3>
                </div>
                <p className="text-3xl font-bold text-amber-400">{stats.operations?.open_registers || 0}</p>
              </div>
              
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <h3 className="text-white font-medium">Gains Non Payés</h3>
                </div>
                <p className="text-3xl font-bold text-red-400">{formatMoney(stats.operations?.pending_payouts_amount)}</p>
                <p className="text-sm text-slate-400">{stats.operations?.pending_payouts_count || 0} tickets</p>
              </div>
              
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <PiggyBank className="w-5 h-5 text-purple-400" />
                  <h3 className="text-white font-medium">Avances en Cours</h3>
                </div>
                <p className="text-3xl font-bold text-purple-400">{formatMoney(stats.operations?.outstanding_advances)}</p>
              </div>
            </div>

            {/* Monthly Summary */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Résumé du Mois
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-slate-400">Ventes Totales</p>
                  <p className="text-xl font-bold text-white">{formatMoney(stats.month?.sales)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Paiements Totaux</p>
                  <p className="text-xl font-bold text-white">{formatMoney(stats.month?.payouts)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Profit Brut</p>
                  <p className={`text-xl font-bold ${stats.month?.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatMoney(stats.month?.profit)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Tickets Vendus</p>
                  <p className="text-xl font-bold text-white">{stats.month?.tickets || 0}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cash Register Tab */}
        {activeTab === 'register' && (
          <div className="space-y-6">
            {/* Current Register Status */}
            {currentRegister?.is_open && currentRegister.register && (
              <div className="bg-emerald-900/30 border border-emerald-700/30 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Caisse Ouverte
                  </h3>
                  <span className="text-sm text-slate-400">
                    Depuis {new Date(currentRegister.register.opened_at).toLocaleString('fr-FR')}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Solde Initial</p>
                    <p className="text-lg font-bold text-white">{formatMoney(currentRegister.register.opening_balance)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Ventes</p>
                    <p className="text-lg font-bold text-emerald-400">+{formatMoney(currentRegister.register.total_sales)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Paiements</p>
                    <p className="text-lg font-bold text-red-400">-{formatMoney(currentRegister.register.total_payouts)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Dépôts</p>
                    <p className="text-lg font-bold text-blue-400">+{formatMoney(currentRegister.register.total_deposits)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Solde Attendu</p>
                    <p className="text-lg font-bold text-white">{formatMoney(currentRegister.register.expected_balance)}</p>
                  </div>
                </div>
              </div>
            )}

            {!currentRegister?.is_open && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
                <Lock className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                <h3 className="text-xl text-white mb-2">Caisse Fermée</h3>
                <p className="text-slate-400 mb-4">Ouvrez la caisse pour commencer les opérations</p>
                <Button onClick={() => setShowOpenModal(true)} className="bg-emerald-600">
                  <Unlock className="w-4 h-4 mr-2" />
                  Ouvrir Caisse
                </Button>
              </div>
            )}

            {/* History */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-white font-medium">Historique des Caisses</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-slate-400 text-sm bg-slate-800/50">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Opérateur</th>
                      <th className="px-4 py-3">Ouverture</th>
                      <th className="px-4 py-3">Ventes</th>
                      <th className="px-4 py-3">Paiements</th>
                      <th className="px-4 py-3">Fermeture</th>
                      <th className="px-4 py-3">Écart</th>
                      <th className="px-4 py-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registerHistory.map((reg) => (
                      <tr key={reg.register_id} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-white">{reg.date}</td>
                        <td className="px-4 py-3 text-slate-300">{reg.opened_by_name}</td>
                        <td className="px-4 py-3 text-white">{formatMoney(reg.opening_balance)}</td>
                        <td className="px-4 py-3 text-emerald-400">{formatMoney(reg.total_sales)}</td>
                        <td className="px-4 py-3 text-red-400">{formatMoney(reg.total_payouts)}</td>
                        <td className="px-4 py-3 text-white">{formatMoney(reg.closing_balance)}</td>
                        <td className="px-4 py-3">
                          <span className={`${
                            reg.variance > 0 ? 'text-emerald-400' : 
                            reg.variance < 0 ? 'text-red-400' : 'text-slate-400'
                          }`}>
                            {reg.variance > 0 ? '+' : ''}{formatMoney(reg.variance)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            reg.status === 'OPEN' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {reg.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Agents Tab */}
        {activeTab === 'agents' && isAdmin && (
          <div className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-white font-medium">Soldes des Agents</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-slate-400 text-sm bg-slate-800/50">
                      <th className="px-4 py-3">Agent</th>
                      <th className="px-4 py-3">Limite Crédit</th>
                      <th className="px-4 py-3">Disponible</th>
                      <th className="px-4 py-3">Avances</th>
                      <th className="px-4 py-3">Total Ventes</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentBalances.map((agent) => (
                      <tr key={agent.agent_id} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-white font-medium">{agent.name}</p>
                            <p className="text-xs text-slate-500">{agent.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white">{formatMoney(agent.credit_limit)}</td>
                        <td className="px-4 py-3">
                          <span className={agent.available_balance < agent.credit_limit * 0.2 ? 'text-red-400' : 'text-emerald-400'}>
                            {formatMoney(agent.available_balance)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-amber-400">{formatMoney(agent.outstanding_advances)}</td>
                        <td className="px-4 py-3 text-white">{formatMoney(agent.total_sales)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            agent.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {agent.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setSelectedAgent(agent); setShowAgentTxnModal(true); }}
                            className="border-slate-600 text-slate-300"
                          >
                            Transaction
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Reconciliation Tab */}
        {activeTab === 'reconciliation' && isAdmin && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={handleGenerateReconciliation} className="bg-blue-600">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Générer Rapport
              </Button>
            </div>
            
            <div className="space-y-4">
              {reconciliationReports.map((report) => (
                <div 
                  key={report.report_id}
                  className={`bg-slate-900/50 border rounded-xl p-4 ${
                    report.status === 'NEEDS_REVIEW' ? 'border-amber-500/50' : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-slate-400" />
                      <h3 className="text-white font-medium">{report.date}</h3>
                      <span className={`px-2 py-1 rounded text-xs ${
                        report.status === 'OK' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {report.status === 'OK' ? 'OK' : 'À Vérifier'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">
                      {report.register_count} caisse(s)
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-slate-400">Ventes Système</p>
                      <p className="text-lg font-bold text-white">{formatMoney(report.system_totals?.total_sales)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Ventes Caisses</p>
                      <p className="text-lg font-bold text-white">{formatMoney(report.register_totals?.total_sales)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Paiements</p>
                      <p className="text-lg font-bold text-red-400">{formatMoney(report.system_totals?.total_payouts)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Écart Total</p>
                      <p className={`text-lg font-bold ${
                        report.register_totals?.total_variance > 0 ? 'text-emerald-400' :
                        report.register_totals?.total_variance < 0 ? 'text-red-400' : 'text-slate-400'
                      }`}>
                        {formatMoney(report.register_totals?.total_variance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Profit Net</p>
                      <p className={`text-lg font-bold ${report.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatMoney(report.net_profit)}
                      </p>
                    </div>
                  </div>
                  
                  {report.anomalies?.length > 0 && (
                    <div className="border-t border-slate-700 pt-3">
                      <p className="text-sm text-amber-400 mb-2">Anomalies détectées:</p>
                      {report.anomalies.map((anomaly, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span className="text-slate-300">{anomaly.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Open Register Modal */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="bg-emerald-600 p-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Unlock className="w-6 h-6" />
                Ouvrir Caisse
              </h2>
            </div>
            
            <form onSubmit={handleOpenRegister} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Solde d'ouverture (HTG) *</label>
                <input
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-lg"
                  placeholder="0.00"
                  required
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowOpenModal(false)}
                  className="flex-1 border-slate-600"
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1 bg-emerald-600">
                  Ouvrir
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Register Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="bg-amber-600 p-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Lock className="w-6 h-6" />
                Fermer Caisse
              </h2>
            </div>
            
            <form onSubmit={handleCloseRegister} className="p-6 space-y-4">
              {currentRegister?.register && (
                <div className="bg-slate-800 rounded-lg p-3 mb-4">
                  <p className="text-slate-400 text-sm">Solde attendu:</p>
                  <p className="text-2xl font-bold text-white">{formatMoney(currentRegister.register.expected_balance)}</p>
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Espèces comptées (HTG) *</label>
                <input
                  type="number"
                  value={cashCounted}
                  onChange={(e) => setCashCounted(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-lg"
                  placeholder="0.00"
                  required
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Solde de fermeture (HTG) *</label>
                <input
                  type="number"
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-lg"
                  placeholder="0.00"
                  required
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Notes (optionnel)</label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  rows={2}
                />
              </div>
              
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCloseModal(false)}
                  className="flex-1 border-slate-600"
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1 bg-amber-600">
                  Fermer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Agent Transaction Modal */}
      {showAgentTxnModal && selectedAgent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="bg-blue-600 p-4">
              <h2 className="text-xl font-bold text-white">Transaction Agent</h2>
              <p className="text-blue-200">{selectedAgent.name}</p>
            </div>
            
            <form onSubmit={handleAgentTransaction} className="p-6 space-y-4">
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-slate-400 text-sm">Solde disponible:</p>
                <p className="text-xl font-bold text-emerald-400">{formatMoney(selectedAgent.available_balance)}</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Type de transaction *</label>
                <select
                  value={txnType}
                  onChange={(e) => setTxnType(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  <option value="CREDIT">Crédit (+)</option>
                  <option value="DEBIT">Débit (-)</option>
                  <option value="ADVANCE">Avance (+)</option>
                  <option value="REPAYMENT">Remboursement (-)</option>
                  <option value="DEPOSIT">Dépôt (+)</option>
                  <option value="WITHDRAWAL">Retrait (-)</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Montant (HTG) *</label>
                <input
                  type="number"
                  value={txnAmount}
                  onChange={(e) => setTxnAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-lg"
                  placeholder="0.00"
                  required
                  min="1"
                  step="0.01"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Notes</label>
                <input
                  type="text"
                  value={txnNotes}
                  onChange={(e) => setTxnNotes(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  placeholder="Raison de la transaction..."
                />
              </div>
              
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowAgentTxnModal(false); setSelectedAgent(null); }}
                  className="flex-1 border-slate-600"
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1 bg-blue-600">
                  Confirmer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default FinancialDashboardPage;
