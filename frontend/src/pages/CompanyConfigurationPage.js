import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Settings, Save, DollarSign, Users, Percent, Clock, Printer, FileText,
  Shield, RefreshCw, BarChart3, Ban, TrendingUp, Calendar
} from 'lucide-react';
import CompanyLayout from '@/components/CompanyLayout';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const CompanyConfigurationPage = () => {
  const { token } = useAuth();
  const [config, setConfig] = useState(null);
  const [primeConfigs, setPrimeConfigs] = useState([]);
  const [blockedNumbers, setBlockedNumbers] = useState([]);
  const [newBlockedNumber, setNewBlockedNumber] = useState('');
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [configRes, primesRes] = await Promise.all([
        axios.get(`${API_URL}/api/company/configuration`, { headers }),
        axios.get(`${API_URL}/api/company/prime-configs`, { headers })
      ]);
      setConfig(configRes.data);
      setPrimeConfigs(primesRes.data);
      
      // Set blocked numbers from config
      if (configRes.data.blocked_numbers) {
        setBlockedNumbers(configRes.data.blocked_numbers);
      }
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const [dashRes, ticketsRes] = await Promise.all([
        axios.get(`${API_URL}/api/company/dashboard`, { headers }),
        axios.get(`${API_URL}/api/company/tickets?limit=1000`, { headers })
      ]);
      
      // Calculate statistics
      const tickets = ticketsRes.data.tickets || [];
      const winners = tickets.filter(t => t.status === 'WINNER' || t.status === 'WON');
      const losers = tickets.filter(t => t.status === 'LOST' || t.status === 'LOSER');
      const totalSales = tickets.reduce((sum, t) => sum + (t.total_amount || 0), 0);
      const totalWinnings = winners.reduce((sum, t) => sum + (t.winnings || 0), 0);
      
      setStatistics({
        ...dashRes.data,
        totalTickets: tickets.length,
        winnersCount: winners.length,
        losersCount: losers.length,
        pendingCount: tickets.filter(t => t.status === 'VALIDATED' || t.status === 'PENDING').length,
        totalSales,
        totalWinnings,
        profitLoss: totalSales - totalWinnings
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'statistics') {
      fetchStatistics();
    }
  }, [activeTab]);

  const handleConfigUpdate = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await axios.put(`${API_URL}/api/company/configuration`, config, { headers });
      toast.success('Configuration mise à jour');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handlePrimeUpdate = async (primeId, newFormula) => {
    try {
      await axios.put(`${API_URL}/api/company/prime-configs/${primeId}`, {
        payout_formula: newFormula
      }, { headers });
      toast.success('Prime mise à jour');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const seedDefaults = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/company/prime-configs/seed-defaults`, {}, { headers });
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error('Erreur lors du seed');
    }
  };

  const addBlockedNumber = async () => {
    if (!newBlockedNumber.trim()) return;
    
    const updatedBlocked = [...blockedNumbers, newBlockedNumber.trim()];
    try {
      await axios.put(`${API_URL}/api/company/configuration`, {
        ...config,
        blocked_numbers: updatedBlocked
      }, { headers });
      setBlockedNumbers(updatedBlocked);
      setConfig({ ...config, blocked_numbers: updatedBlocked });
      setNewBlockedNumber('');
      toast.success(`Numéro ${newBlockedNumber} bloqué`);
    } catch (error) {
      toast.error('Erreur lors du blocage');
    }
  };

  const removeBlockedNumber = async (number) => {
    const updatedBlocked = blockedNumbers.filter(n => n !== number);
    try {
      await axios.put(`${API_URL}/api/company/configuration`, {
        ...config,
        blocked_numbers: updatedBlocked
      }, { headers });
      setBlockedNumbers(updatedBlocked);
      setConfig({ ...config, blocked_numbers: updatedBlocked });
      toast.success(`Numéro ${number} débloqué`);
    } catch (error) {
      toast.error('Erreur lors du déblocage');
    }
  };

  if (loading) {
    return (
      <CompanyLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      </CompanyLayout>
    );
  }

  const tabs = [
    { id: 'general', label: 'Général', icon: Settings },
    { id: 'primes', label: 'Table des Primes', icon: DollarSign },
    { id: 'limits', label: 'Limites', icon: Shield },
    { id: 'marriage', label: 'Mariage', icon: Users },
    { id: 'statistics', label: 'Statistiques', icon: BarChart3 },
    { id: 'blocked', label: 'Blocage Boule', icon: Ban },
  ];

  return (
    <CompanyLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl">
            <Settings className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Configuration</h1>
            <p className="text-slate-400">Paramètres de votre entreprise</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-800 pb-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* General Settings */}
        {activeTab === 'general' && config && (
          <form onSubmit={handleConfigUpdate} className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-400" />
                Paramètres de vente
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Arrêt ventes avant tirage (minutes)
                  </label>
                  <input
                    type="number"
                    value={config.stop_sales_before_draw_minutes}
                    onChange={(e) => setConfig({ ...config, stop_sales_before_draw_minutes: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    data-testid="stop-sales-minutes"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Fenêtre d'annulation (minutes)
                  </label>
                  <input
                    type="number"
                    value={config.void_window_minutes}
                    onChange={(e) => setConfig({ ...config, void_window_minutes: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    data-testid="void-window"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="allow_void"
                    checked={config.allow_ticket_void}
                    onChange={(e) => setConfig({ ...config, allow_ticket_void: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="allow_void" className="text-slate-300">
                    Autoriser l'annulation de tickets
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="auto_print"
                    checked={config.auto_print_ticket}
                    onChange={(e) => setConfig({ ...config, auto_print_ticket: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="auto_print" className="text-slate-300">
                    Impression automatique des tickets
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Percent className="w-5 h-5 text-emerald-400" />
                Commission des agents
              </h3>
              
              <div className="max-w-xs">
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Pourcentage de commission
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={config.agent_commission_percent}
                    onChange={(e) => setConfig({ ...config, agent_commission_percent: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    data-testid="agent-commission"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white rounded-lg transition-colors"
              data-testid="save-config-btn"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        )}

        {/* Prime Table */}
        {activeTab === 'primes' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-slate-400">
                Configuration des gains (primes) par type de pari
              </p>
              <button
                onClick={seedDefaults}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                data-testid="seed-primes-btn"
              >
                <RefreshCw className="w-4 h-4" />
                Charger les défauts
              </button>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full" data-testid="primes-table">
                <thead>
                  <tr className="text-left text-slate-400 text-sm border-b border-slate-800">
                    <th className="px-6 py-4">Code</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Nom</th>
                    <th className="px-6 py-4">Prime (Payout)</th>
                    <th className="px-6 py-4">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {primeConfigs.map(prime => (
                    <tr key={prime.prime_id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-6 py-4 font-mono text-cyan-400">{prime.bet_code}</td>
                      <td className="px-6 py-4 text-slate-300">{prime.bet_type}</td>
                      <td className="px-6 py-4 text-white">{prime.bet_name}</td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          defaultValue={prime.payout_formula}
                          onBlur={(e) => {
                            if (e.target.value !== prime.payout_formula) {
                              handlePrimeUpdate(prime.prime_id, e.target.value);
                            }
                          }}
                          className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-amber-400 font-mono focus:outline-none focus:border-emerald-500"
                          data-testid={`prime-${prime.bet_code}`}
                        />
                        <span className="text-slate-500 text-sm ml-2">
                          {prime.payout_formula.includes('|') ? '1er|2ème|3ème' : 'fixe'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {prime.is_active ? (
                          <span className="text-emerald-400">Actif</span>
                        ) : (
                          <span className="text-red-400">Inactif</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {primeConfigs.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                        Aucune configuration de prime. Cliquez sur "Charger les défauts" pour commencer.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Limits */}
        {activeTab === 'limits' && config && (
          <form onSubmit={handleConfigUpdate} className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Limites de mise</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Mise minimum par ticket
                  </label>
                  <input
                    type="number"
                    value={config.min_bet_amount}
                    onChange={(e) => setConfig({ ...config, min_bet_amount: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    data-testid="min-bet"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Mise maximum par ticket
                  </label>
                  <input
                    type="number"
                    value={config.max_bet_amount}
                    onChange={(e) => setConfig({ ...config, max_bet_amount: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    data-testid="max-bet"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Mise maximum par numéro
                  </label>
                  <input
                    type="number"
                    value={config.max_bet_per_number}
                    onChange={(e) => setConfig({ ...config, max_bet_per_number: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    data-testid="max-per-number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Mise maximum par agent (journalière)
                  </label>
                  <input
                    type="number"
                    value={config.max_bet_per_agent}
                    onChange={(e) => setConfig({ ...config, max_bet_per_agent: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    data-testid="max-per-agent"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        )}

        {/* Marriage Config */}
        {activeTab === 'marriage' && config && (
          <form onSubmit={handleConfigUpdate} className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Configuration Mariage</h3>
              
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="marriage_enabled"
                    checked={config.marriage_enabled}
                    onChange={(e) => setConfig({ ...config, marriage_enabled: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="marriage_enabled" className="text-slate-300">
                    Activer les paris Mariage
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Mise minimum Mariage
                    </label>
                    <input
                      type="number"
                      value={config.marriage_min_amount}
                      onChange={(e) => setConfig({ ...config, marriage_min_amount: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      disabled={!config.marriage_enabled}
                      data-testid="marriage-min"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Mise maximum Mariage
                    </label>
                    <input
                      type="number"
                      value={config.marriage_max_amount}
                      onChange={(e) => setConfig({ ...config, marriage_max_amount: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      disabled={!config.marriage_enabled}
                      data-testid="marriage-max"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        )}

        {/* Statistics */}
        {activeTab === 'statistics' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-slate-400">Statistiques globales de votre entreprise</p>
              <button
                onClick={fetchStatistics}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
              >
                <RefreshCw className="w-4 h-4" />
                Actualiser
              </button>
            </div>

            {statistics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <BarChart3 className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-blue-300">Total Tickets</p>
                      <p className="text-2xl font-bold text-white">{statistics.totalTickets || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <TrendingUp className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm text-emerald-300">Ventes Totales</p>
                      <p className="text-2xl font-bold text-white">{(statistics.totalSales || 0).toLocaleString()} HTG</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                      <DollarSign className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm text-amber-300">Gains Payés</p>
                      <p className="text-2xl font-bold text-white">{(statistics.totalWinnings || 0).toLocaleString()} HTG</p>
                    </div>
                  </div>
                </div>

                <div className={`bg-gradient-to-br ${statistics.profitLoss >= 0 ? 'from-green-500/20 to-green-600/10 border-green-500/30' : 'from-red-500/20 to-red-600/10 border-red-500/30'} border rounded-xl p-4`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 ${statistics.profitLoss >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'} rounded-lg`}>
                      <TrendingUp className={`w-6 h-6 ${statistics.profitLoss >= 0 ? 'text-green-400' : 'text-red-400 rotate-180'}`} />
                    </div>
                    <div>
                      <p className={`text-sm ${statistics.profitLoss >= 0 ? 'text-green-300' : 'text-red-300'}`}>Profit/Perte</p>
                      <p className="text-2xl font-bold text-white">{(statistics.profitLoss || 0).toLocaleString()} HTG</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                Chargement des statistiques...
              </div>
            )}

            {statistics && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Détails des tickets</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-3xl font-bold text-amber-400">{statistics.winnersCount || 0}</p>
                    <p className="text-slate-400">Tickets Gagnants</p>
                  </div>
                  <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-3xl font-bold text-red-400">{statistics.losersCount || 0}</p>
                    <p className="text-slate-400">Tickets Perdants</p>
                  </div>
                  <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-3xl font-bold text-blue-400">{statistics.pendingCount || 0}</p>
                    <p className="text-slate-400">En Attente</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Blocked Numbers */}
        {activeTab === 'blocked' && (
          <div className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Ban className="w-5 h-5 text-red-400" />
                Blocage de Numéros
              </h3>
              <p className="text-slate-400 mb-4">
                Les numéros bloqués ne peuvent pas être joués par les vendeurs.
              </p>
              
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newBlockedNumber}
                  onChange={(e) => setNewBlockedNumber(e.target.value)}
                  placeholder="Ex: 555"
                  className="flex-1 max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                  onKeyDown={(e) => e.key === 'Enter' && addBlockedNumber()}
                />
                <button
                  onClick={addBlockedNumber}
                  disabled={!newBlockedNumber.trim()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white rounded-lg flex items-center gap-2"
                >
                  <Ban className="w-4 h-4" />
                  Bloquer
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-slate-400">Numéros actuellement bloqués:</p>
                {blockedNumbers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {blockedNumbers.map((num) => (
                      <div key={num} className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-lg">
                        <span className="text-red-400 font-mono font-bold">{num}</span>
                        <button
                          onClick={() => removeBlockedNumber(num)}
                          className="text-red-400 hover:text-red-300"
                          title="Débloquer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 italic">Aucun numéro bloqué</p>
                )}
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <p className="text-amber-400 text-sm">
                <strong>Note:</strong> Les numéros bloqués seront automatiquement appliqués à tous les superviseurs et vendeurs de votre entreprise.
              </p>
            </div>
          </div>
        )}
      </div>
    </CompanyLayout>
  );
};
