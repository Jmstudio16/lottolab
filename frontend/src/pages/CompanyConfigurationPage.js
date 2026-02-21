import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Settings, Save, DollarSign, Users, Percent, Clock, Printer, FileText,
  Shield, RefreshCw
} from 'lucide-react';
import CompanyLayout from '@/components/CompanyLayout';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const CompanyConfigurationPage = () => {
  const { token } = useAuth();
  const [config, setConfig] = useState(null);
  const [primeConfigs, setPrimeConfigs] = useState([]);
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
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
    { id: 'receipt', label: 'Reçu', icon: Printer },
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

        {/* Receipt Config */}
        {activeTab === 'receipt' && config && (
          <form onSubmit={handleConfigUpdate} className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                Personnalisation du reçu
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    En-tête du reçu
                  </label>
                  <textarea
                    value={config.receipt_header || ''}
                    onChange={(e) => setConfig({ ...config, receipt_header: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Texte affiché en haut du reçu..."
                    data-testid="receipt-header"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Pied de page du reçu
                  </label>
                  <textarea
                    value={config.receipt_footer || ''}
                    onChange={(e) => setConfig({ ...config, receipt_footer: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Texte affiché en bas du reçu..."
                    data-testid="receipt-footer"
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
      </div>
    </CompanyLayout>
  );
};
