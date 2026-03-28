import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import { AdminLayout } from '@/components/AdminLayout';
import axios from 'axios';
import { toast } from 'sonner';
import { API_URL } from '@/config/api';
import { 
  Shield, AlertTriangle, Lock, Unlock, Settings, RefreshCw,
  TrendingUp, Bell, ChevronRight, Search, Filter, Hash,
  Ban, CheckCircle, AlertCircle, Percent, DollarSign, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * SuperAdminLimitsPage - Intelligent Betting Limits Dashboard
 * Phase 3: Max bet per number, alerts, auto-blocking
 */
const SuperAdminLimitsPage = () => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [config, setConfig] = useState(null);
  const [blockedNumbers, setBlockedNumbers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [numbersStatus, setNumbersStatus] = useState(null);
  
  // Form states
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showCheckModal, setShowCheckModal] = useState(false);
  
  // Config form
  const [maxBetPerNumber, setMaxBetPerNumber] = useState('5000');
  const [maxBetPerTicket, setMaxBetPerTicket] = useState('50000');
  const [alertThreshold, setAlertThreshold] = useState('80');
  const [autoBlockEnabled, setAutoBlockEnabled] = useState(true);
  
  // Block form
  const [blockNumber, setBlockNumber] = useState('');
  const [blockLotteryId, setBlockLotteryId] = useState('');
  const [blockDrawName, setBlockDrawName] = useState('');
  const [blockDrawDate, setBlockDrawDate] = useState(new Date().toISOString().split('T')[0]);
  const [blockReason, setBlockReason] = useState('');
  
  // Status check filters
  const [statusLotteryId, setStatusLotteryId] = useState('');
  const [statusDrawName, setStatusDrawName] = useState('Midi');
  const [statusDrawDate, setStatusDrawDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Lotteries list
  const [lotteries, setLotteries] = useState([]);
  
  const headers = { Authorization: `Bearer ${token}` };
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, configRes, blockedRes, alertsRes, lotteriesRes] = await Promise.all([
        axios.get(`${API_URL}/api/limits/dashboard/stats`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/limits/config`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/limits/numbers/blocked`, { headers }).catch(() => ({ data: { blocked_numbers: [] } })),
        axios.get(`${API_URL}/api/limits/alerts?acknowledged=false&limit=20`, { headers }).catch(() => ({ data: { alerts: [] } })),
        axios.get(`${API_URL}/api/global-results/lotteries`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setStats(statsRes.data);
      setConfig(configRes.data);
      setBlockedNumbers(blockedRes.data?.blocked_numbers || []);
      setAlerts(alertsRes.data?.alerts || []);
      setLotteries(lotteriesRes.data || []);
      
      // Update form with config values
      if (configRes.data) {
        setMaxBetPerNumber(String(configRes.data.default_max_bet_per_number || 5000));
        setMaxBetPerTicket(String(configRes.data.default_max_bet_per_ticket || 50000));
        setAlertThreshold(String(configRes.data.alert_threshold_percentage || 80));
        setAutoBlockEnabled(configRes.data.auto_block_enabled !== false);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);
  
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);
  
  const handleUpdateConfig = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/api/limits/config`, {
        default_max_bet_per_number: parseFloat(maxBetPerNumber),
        default_max_bet_per_ticket: parseFloat(maxBetPerTicket),
        alert_threshold_percentage: parseFloat(alertThreshold),
        auto_block_enabled: autoBlockEnabled,
        block_duration_minutes: 0
      }, { headers });
      
      toast.success('Configuration mise à jour');
      setShowConfigModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    }
  };
  
  const handleBlockNumber = async (e) => {
    e.preventDefault();
    if (!blockNumber || !blockLotteryId || !blockDrawName) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    try {
      await axios.post(
        `${API_URL}/api/limits/numbers/block?number=${blockNumber}&lottery_id=${blockLotteryId}&draw_name=${blockDrawName}&draw_date=${blockDrawDate}&reason=${encodeURIComponent(blockReason || 'Blocage manuel')}`,
        {},
        { headers }
      );
      
      toast.success(`Numéro ${blockNumber} bloqué`);
      setShowBlockModal(false);
      setBlockNumber('');
      setBlockReason('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du blocage');
    }
  };
  
  const handleUnblock = async (blockId) => {
    try {
      await axios.delete(`${API_URL}/api/limits/numbers/block/${blockId}`, { headers });
      toast.success('Numéro débloqué');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du déblocage');
    }
  };
  
  const handleAcknowledgeAlert = async (alertId) => {
    try {
      await axios.post(`${API_URL}/api/limits/alerts/acknowledge`, {
        alert_id: alertId
      }, { headers });
      toast.success('Alerte acquittée');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };
  
  const handleAcknowledgeAll = async () => {
    try {
      await axios.post(`${API_URL}/api/limits/alerts/acknowledge-all`, {}, { headers });
      toast.success('Toutes les alertes acquittées');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };
  
  const handleFetchNumbersStatus = async () => {
    if (!statusLotteryId || !statusDrawName) {
      toast.error('Sélectionnez une loterie et un tirage');
      return;
    }
    
    try {
      const response = await axios.get(
        `${API_URL}/api/limits/numbers/status?lottery_id=${statusLotteryId}&draw_name=${statusDrawName}&draw_date=${statusDrawDate}`,
        { headers }
      );
      setNumbersStatus(response.data);
      setShowCheckModal(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la récupération');
    }
  };
  
  const formatMoney = (amount) => {
    return new Intl.NumberFormat('fr-HT', {
      style: 'currency',
      currency: 'HTG',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };
  
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-500 bg-red-500/20';
      case 'HIGH': return 'text-orange-500 bg-orange-500/20';
      case 'MEDIUM': return 'text-amber-500 bg-amber-500/20';
      default: return 'text-blue-500 bg-blue-500/20';
    }
  };
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'BLOCKED': return 'text-red-500 bg-red-500/20';
      case 'LIMIT_REACHED': return 'text-orange-500 bg-orange-500/20';
      case 'WARNING': return 'text-amber-500 bg-amber-500/20';
      default: return 'text-emerald-500 bg-emerald-500/20';
    }
  };
  
  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: Shield },
    { id: 'blocked', label: 'Numéros Bloqués', icon: Ban },
    { id: 'alerts', label: 'Alertes', icon: Bell },
    { id: 'status', label: 'Statut Numéros', icon: Eye }
  ];
  
  return (
    <AdminLayout role={user?.role}>
      <div className="p-4 sm:p-6 space-y-6" data-testid="limits-dashboard">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl">
              <Shield className="w-8 h-8 text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Limites Intelligentes</h1>
              <p className="text-slate-400">Contrôle des mises en temps réel</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={() => setShowConfigModal(true)}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="config-btn"
            >
              <Settings className="w-4 h-4 mr-2" />
              Configuration
            </Button>
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
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'alerts' && alerts.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-red-500 text-white">
                    {alerts.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-orange-900/50 to-orange-800/30 border border-orange-700/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-6 h-6 text-orange-400" />
                  <span className="text-xs text-orange-400 px-2 py-1 bg-orange-500/20 rounded">Max/Numéro</span>
                </div>
                <p className="text-2xl font-bold text-white">{formatMoney(config?.default_max_bet_per_number || 5000)}</p>
                <p className="text-sm text-slate-400">Limite par défaut</p>
              </div>
              
              <div className="bg-gradient-to-br from-red-900/50 to-red-800/30 border border-red-700/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <Ban className="w-6 h-6 text-red-400" />
                  <span className="text-xs text-red-400 px-2 py-1 bg-red-500/20 rounded">Bloqués</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats?.blocks?.active_total || 0}</p>
                <p className="text-sm text-slate-400">{stats?.blocks?.created_today || 0} aujourd'hui</p>
              </div>
              
              <div className="bg-gradient-to-br from-amber-900/50 to-amber-800/30 border border-amber-700/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                  <span className="text-xs text-amber-400 px-2 py-1 bg-amber-500/20 rounded">Alertes</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats?.alerts?.unacknowledged || 0}</p>
                <p className="text-sm text-slate-400">{stats?.alerts?.critical || 0} critiques</p>
              </div>
              
              <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border border-purple-700/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <Percent className="w-6 h-6 text-purple-400" />
                  <span className="text-xs text-purple-400 px-2 py-1 bg-purple-500/20 rounded">Seuil</span>
                </div>
                <p className="text-2xl font-bold text-white">{config?.alert_threshold_percentage || 80}%</p>
                <p className="text-sm text-slate-400">Seuil d'alerte</p>
              </div>
            </div>
            
            {/* Configuration Summary */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-400" />
                Configuration Actuelle
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-slate-400">Max par numéro</p>
                  <p className="text-xl font-bold text-white">{formatMoney(config?.default_max_bet_per_number)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Max par ticket</p>
                  <p className="text-xl font-bold text-white">{formatMoney(config?.default_max_bet_per_ticket)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Seuil d'alerte</p>
                  <p className="text-xl font-bold text-white">{config?.alert_threshold_percentage || 80}%</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Blocage auto</p>
                  <p className={`text-xl font-bold ${config?.auto_block_enabled ? 'text-emerald-400' : 'text-red-400'}`}>
                    {config?.auto_block_enabled ? 'Activé' : 'Désactivé'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                <h4 className="text-white font-medium mb-3">Actions Rapides</h4>
                <div className="space-y-2">
                  <Button 
                    onClick={() => setShowBlockModal(true)}
                    className="w-full justify-start bg-red-600/20 hover:bg-red-600/30 text-red-400"
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Bloquer un numéro
                  </Button>
                  <Button 
                    onClick={() => setActiveTab('status')}
                    className="w-full justify-start bg-blue-600/20 hover:bg-blue-600/30 text-blue-400"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Vérifier statut numéros
                  </Button>
                </div>
              </div>
              
              {/* Recent Alerts */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                <h4 className="text-white font-medium mb-3">Alertes Récentes</h4>
                {alerts.length === 0 ? (
                  <p className="text-slate-500 text-sm">Aucune alerte non acquittée</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {alerts.slice(0, 3).map((alert) => (
                      <div 
                        key={alert.alert_id}
                        className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`w-4 h-4 ${getSeverityColor(alert.severity).split(' ')[0]}`} />
                          <span className="text-sm text-white truncate max-w-[200px]">{alert.number}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs ${getSeverityColor(alert.severity)}`}>
                          {alert.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Blocked Numbers Tab */}
        {activeTab === 'blocked' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Numéros Bloqués</h3>
              <Button onClick={() => setShowBlockModal(true)} className="bg-red-600">
                <Ban className="w-4 h-4 mr-2" />
                Bloquer
              </Button>
            </div>
            
            {blockedNumbers.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-emerald-500 mb-4" />
                <h3 className="text-xl text-white mb-2">Aucun numéro bloqué</h3>
                <p className="text-slate-400">Tous les numéros sont disponibles pour les mises</p>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-slate-400 text-sm bg-slate-800/50">
                      <th className="px-4 py-3">Numéro</th>
                      <th className="px-4 py-3">Loterie</th>
                      <th className="px-4 py-3">Tirage</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Raison</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedNumbers.map((block) => (
                      <tr key={block.block_id} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <span className="text-2xl font-bold text-red-400">{block.number}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{block.lottery_id}</td>
                        <td className="px-4 py-3 text-white">{block.draw_name}</td>
                        <td className="px-4 py-3 text-slate-400">{block.draw_date}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            block.block_type === 'AUTOMATIC' 
                              ? 'bg-amber-500/20 text-amber-400' 
                              : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            {block.block_type === 'AUTOMATIC' ? 'Auto' : 'Manuel'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">{block.reason}</td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnblock(block.block_id)}
                            className="border-emerald-600 text-emerald-400 hover:bg-emerald-600/20"
                          >
                            <Unlock className="w-4 h-4 mr-1" />
                            Débloquer
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        
        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Alertes de Limites</h3>
              {alerts.length > 0 && (
                <Button onClick={handleAcknowledgeAll} variant="outline" className="border-slate-600">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Acquitter tout
                </Button>
              )}
            </div>
            
            {alerts.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
                <Bell className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                <h3 className="text-xl text-white mb-2">Aucune alerte</h3>
                <p className="text-slate-400">Toutes les alertes ont été acquittées</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div 
                    key={alert.alert_id}
                    className={`bg-slate-900/50 border rounded-xl p-4 ${
                      alert.severity === 'CRITICAL' ? 'border-red-500/50' :
                      alert.severity === 'HIGH' ? 'border-orange-500/50' :
                      'border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`w-5 h-5 mt-0.5 ${getSeverityColor(alert.severity).split(' ')[0]}`} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-medium">{alert.alert_type}</span>
                            <span className={`px-2 py-0.5 rounded text-xs ${getSeverityColor(alert.severity)}`}>
                              {alert.severity}
                            </span>
                          </div>
                          <p className="text-slate-300">{alert.message}</p>
                          <div className="flex gap-4 mt-2 text-sm text-slate-500">
                            <span>Numéro: <span className="text-white">{alert.number}</span></span>
                            <span>Tirage: <span className="text-white">{alert.draw_name}</span></span>
                            <span>{new Date(alert.created_at).toLocaleString('fr-FR')}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAcknowledgeAlert(alert.alert_id)}
                        className="border-slate-600"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Numbers Status Tab */}
        {activeTab === 'status' && (
          <div className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <h3 className="text-white font-medium mb-4">Vérifier le statut des numéros</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm text-slate-400">Loterie</label>
                  <select
                    value={statusLotteryId}
                    onChange={(e) => setStatusLotteryId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="">Sélectionner...</option>
                    {lotteries.map((l) => (
                      <option key={l.lottery_id} value={l.lottery_id}>{l.lottery_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Tirage</label>
                  <select
                    value={statusDrawName}
                    onChange={(e) => setStatusDrawName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="Matin">Matin</option>
                    <option value="Midi">Midi</option>
                    <option value="Soir">Soir</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Date</label>
                  <input
                    type="date"
                    value={statusDrawDate}
                    onChange={(e) => setStatusDrawDate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleFetchNumbersStatus} className="w-full bg-blue-600">
                    <Search className="w-4 h-4 mr-2" />
                    Vérifier
                  </Button>
                </div>
              </div>
            </div>
            
            {numbersStatus && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium">Résultats pour {numbersStatus.draw_name}</h4>
                    <p className="text-sm text-slate-400">{numbersStatus.total_count} numéros avec mises</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">
                      {numbersStatus.blocked_count} bloqués
                    </span>
                    <span className="px-2 py-1 rounded text-xs bg-amber-500/20 text-amber-400">
                      {numbersStatus.warning_count} attention
                    </span>
                    <span className="px-2 py-1 rounded text-xs bg-orange-500/20 text-orange-400">
                      {numbersStatus.limit_reached_count} limite
                    </span>
                  </div>
                </div>
                
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-slate-800">
                      <tr className="text-left text-slate-400 text-sm">
                        <th className="px-4 py-3">Numéro</th>
                        <th className="px-4 py-3">Total Mises</th>
                        <th className="px-4 py-3">Limite</th>
                        <th className="px-4 py-3">Restant</th>
                        <th className="px-4 py-3">%</th>
                        <th className="px-4 py-3">Tickets</th>
                        <th className="px-4 py-3">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {numbersStatus.numbers?.map((num) => (
                        <tr key={num.number} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <td className="px-4 py-3">
                            <span className="text-xl font-bold text-white">{num.number}</span>
                          </td>
                          <td className="px-4 py-3 text-white">{formatMoney(num.total_bets)}</td>
                          <td className="px-4 py-3 text-slate-400">{formatMoney(num.limit)}</td>
                          <td className="px-4 py-3">
                            <span className={num.remaining > 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {formatMoney(num.remaining)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${
                                    num.percentage >= 100 ? 'bg-red-500' :
                                    num.percentage >= 80 ? 'bg-amber-500' :
                                    'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(num.percentage, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm text-slate-400">{num.percentage}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-400">{num.ticket_count}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(num.status)}`}>
                              {num.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="bg-purple-600 p-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="w-6 h-6" />
                Configuration des Limites
              </h2>
            </div>
            
            <form onSubmit={handleUpdateConfig} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Max par numéro (HTG)</label>
                <input
                  type="number"
                  value={maxBetPerNumber}
                  onChange={(e) => setMaxBetPerNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-lg"
                  min="0"
                  step="100"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Max par ticket (HTG)</label>
                <input
                  type="number"
                  value={maxBetPerTicket}
                  onChange={(e) => setMaxBetPerTicket(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-lg"
                  min="0"
                  step="1000"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Seuil d'alerte (%)</label>
                <input
                  type="number"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-lg"
                  min="0"
                  max="100"
                />
              </div>
              
              <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                <span className="text-white">Blocage automatique</span>
                <button
                  type="button"
                  onClick={() => setAutoBlockEnabled(!autoBlockEnabled)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    autoBlockEnabled ? 'bg-emerald-500' : 'bg-slate-600'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    autoBlockEnabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 border-slate-600"
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1 bg-purple-600">
                  Enregistrer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Block Number Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="bg-red-600 p-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Ban className="w-6 h-6" />
                Bloquer un Numéro
              </h2>
            </div>
            
            <form onSubmit={handleBlockNumber} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Numéro *</label>
                <input
                  type="text"
                  value={blockNumber}
                  onChange={(e) => setBlockNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-2xl font-bold text-center"
                  placeholder="00"
                  maxLength={5}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Loterie *</label>
                <select
                  value={blockLotteryId}
                  onChange={(e) => setBlockLotteryId(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  required
                >
                  <option value="">Sélectionner...</option>
                  {lotteries.map((l) => (
                    <option key={l.lottery_id} value={l.lottery_id}>{l.lottery_name}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Tirage *</label>
                  <select
                    value={blockDrawName}
                    onChange={(e) => setBlockDrawName(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    required
                  >
                    <option value="">Sélectionner...</option>
                    <option value="Matin">Matin</option>
                    <option value="Midi">Midi</option>
                    <option value="Soir">Soir</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Date</label>
                  <input
                    type="date"
                    value={blockDrawDate}
                    onChange={(e) => setBlockDrawDate(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Raison</label>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  placeholder="Raison du blocage..."
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBlockModal(false)}
                  className="flex-1 border-slate-600"
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1 bg-red-600">
                  Bloquer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default SuperAdminLimitsPage;
