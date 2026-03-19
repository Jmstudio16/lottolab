import { API_URL } from '@/config/api';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/api/auth';
import CompanyLayout from '@/components/CompanyLayout';
import { 
  FileSpreadsheet, FileText, Download, Calendar, User, 
  Filter, RefreshCw, Ban, Plus, Trash2, Settings,
  Upload, Image, AlertTriangle, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';


const CompanyExportsPage = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('export');
  const [loading, setLoading] = useState(false);
  const [blockedNumbers, setBlockedNumbers] = useState([]);
  const [betLimits, setBetLimits] = useState(null);
  const [lotteries, setLotteries] = useState([]);
  const [ticketSettings, setTicketSettings] = useState(null);
  
  // Export filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [vendeurId, setVendeurId] = useState('');
  const [lotteryId, setLotteryId] = useState('');
  const [status, setStatus] = useState('');
  
  // Blocked number form
  const [blockLotteryId, setBlockLotteryId] = useState('');
  const [blockDate, setBlockDate] = useState('');
  const [blockNumbers, setBlockNumbers] = useState('');
  const [blockReason, setBlockReason] = useState('');
  
  // Bet limits form
  const [limitLotteryId, setLimitLotteryId] = useState('');
  const [minBet, setMinBet] = useState(10);
  const [maxBet, setMaxBet] = useState(10000);
  const [maxPerNumber, setMaxPerNumber] = useState(5000);
  const [maxTotal, setMaxTotal] = useState(50000);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchLotteries();
    fetchBlockedNumbers();
    fetchBetLimits();
    fetchTicketSettings();
  }, []);

  const fetchLotteries = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/company/lotteries`, { headers });
      setLotteries(res.data || []);
    } catch (error) {
      console.error('Error fetching lotteries:', error);
    }
  };

  const fetchBlockedNumbers = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/export/blocked-numbers`, { headers });
      setBlockedNumbers(res.data || []);
    } catch (error) {
      console.error('Error fetching blocked numbers:', error);
    }
  };

  const fetchBetLimits = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/export/bet-limits`, { headers });
      setBetLimits(res.data);
    } catch (error) {
      console.error('Error fetching bet limits:', error);
    }
  };

  const fetchTicketSettings = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/export/company/ticket-settings`, { headers });
      setTicketSettings(res.data);
    } catch (error) {
      console.error('Error fetching ticket settings:', error);
    }
  };

  const handleExportExcel = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (vendeurId) params.append('vendeur_id', vendeurId);
      if (lotteryId) params.append('lottery_id', lotteryId);
      if (status) params.append('status', status);

      const res = await axios.get(`${API_URL}/api/export/tickets/excel?${params}`, {
        headers,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `tickets_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Export Excel téléchargé');
    } catch (error) {
      toast.error('Erreur lors de l\'export Excel');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (vendeurId) params.append('vendeur_id', vendeurId);
      if (lotteryId) params.append('lottery_id', lotteryId);
      if (status) params.append('status', status);

      const res = await axios.get(`${API_URL}/api/export/tickets/pdf?${params}`, {
        headers,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rapport_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Export PDF téléchargé');
    } catch (error) {
      toast.error('Erreur lors de l\'export PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBlockedNumbers = async () => {
    if (!blockLotteryId || !blockDate || !blockNumbers) {
      toast.error('Remplissez tous les champs requis');
      return;
    }

    try {
      const numbersArray = blockNumbers.split(',').map(n => n.trim()).filter(n => n);
      await axios.post(`${API_URL}/api/export/blocked-numbers`, {
        lottery_id: blockLotteryId,
        draw_date: blockDate,
        blocked_numbers: numbersArray,
        reason: blockReason || 'Blocage manuel'
      }, { headers });

      toast.success('Numéros bloqués ajoutés');
      setBlockNumbers('');
      setBlockReason('');
      fetchBlockedNumbers();
    } catch (error) {
      toast.error('Erreur lors du blocage');
    }
  };

  const handleRemoveBlock = async (blockedId) => {
    if (!window.confirm('Supprimer ce blocage?')) return;

    try {
      await axios.delete(`${API_URL}/api/export/blocked-numbers/${blockedId}`, { headers });
      toast.success('Blocage supprimé');
      fetchBlockedNumbers();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleSaveBetLimits = async () => {
    try {
      await axios.post(`${API_URL}/api/export/bet-limits`, {
        lottery_id: limitLotteryId || null,
        min_bet: parseFloat(minBet),
        max_bet: parseFloat(maxBet),
        max_bet_per_number: parseFloat(maxPerNumber),
        max_total_per_ticket: parseFloat(maxTotal)
      }, { headers });

      toast.success('Limites de mise enregistrées');
      fetchBetLimits();
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API_URL}/api/export/company/logo`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Logo uploadé');
      fetchTicketSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur upload');
    }
  };

  return (
    <CompanyLayout>
      <div className="p-6 space-y-6" data-testid="exports-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Settings className="w-7 h-7 text-emerald-400" />
              Exports & Configuration
            </h1>
            <p className="text-slate-400 mt-1">Exports, numéros bloqués, limites de mise</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-2">
          {[
            { id: 'export', label: 'Export Excel/PDF', icon: FileSpreadsheet },
            { id: 'blocked', label: 'Numéros Bloqués', icon: Ban },
            { id: 'limits', label: 'Limites de Mise', icon: AlertTriangle },
            { id: 'ticket', label: 'Logo & Ticket', icon: Image }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-t-lg font-medium flex items-center gap-2 transition-colors ${
                activeTab === tab.id
                  ? 'bg-emerald-500/20 text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Filtres d'Export</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Date début</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Date fin</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Loterie</label>
                  <select
                    value={lotteryId}
                    onChange={(e) => setLotteryId(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="">Toutes les loteries</option>
                    {lotteries.map(lot => (
                      <option key={lot.lottery_id} value={lot.lottery_id}>{lot.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Statut</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="">Tous les statuts</option>
                    <option value="VALIDATED">Validé</option>
                    <option value="WINNER">Gagnant</option>
                    <option value="LOSER">Perdant</option>
                    <option value="VOID">Annulé</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleExportExcel}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                  {loading ? 'Export...' : 'Export Excel'}
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold"
                >
                  <FileText className="w-5 h-5" />
                  {loading ? 'Export...' : 'Export PDF'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Blocked Numbers Tab */}
        {activeTab === 'blocked' && (
          <div className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Bloquer des Numéros</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Loterie *</label>
                  <select
                    value={blockLotteryId}
                    onChange={(e) => setBlockLotteryId(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="">Sélectionner...</option>
                    {lotteries.map(lot => (
                      <option key={lot.lottery_id} value={lot.lottery_id}>{lot.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Date du tirage *</label>
                  <input
                    type="date"
                    value={blockDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Numéros à bloquer * (séparés par virgule)</label>
                  <input
                    type="text"
                    value={blockNumbers}
                    onChange={(e) => setBlockNumbers(e.target.value)}
                    placeholder="123, 456, 789"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Raison</label>
                  <input
                    type="text"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="Ex: Limite atteinte"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <button
                onClick={handleAddBlockedNumbers}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
              >
                <Ban className="w-4 h-4" />
                Bloquer ces numéros
              </button>
            </div>

            {/* List of blocked numbers */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Numéros Actuellement Bloqués</h3>
              
              {blockedNumbers.length === 0 ? (
                <p className="text-slate-400">Aucun numéro bloqué</p>
              ) : (
                <div className="space-y-3">
                  {blockedNumbers.map((block) => (
                    <div key={block.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                      <div>
                        <p className="text-white font-medium">
                          {lotteries.find(l => l.lottery_id === block.lottery_id)?.name || block.lottery_id}
                        </p>
                        <p className="text-slate-400 text-sm">
                          Date: {block.draw_date} | Numéros: {block.blocked_numbers?.join(', ')}
                        </p>
                        <p className="text-slate-500 text-xs">{block.reason}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveBlock(block.id)}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bet Limits Tab */}
        {activeTab === 'limits' && (
          <div className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Configurer les Limites de Mise</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Loterie (vide = global)</label>
                  <select
                    value={limitLotteryId}
                    onChange={(e) => setLimitLotteryId(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="">Toutes les loteries (Global)</option>
                    {lotteries.map(lot => (
                      <option key={lot.lottery_id} value={lot.lottery_id}>{lot.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Mise minimum (HTG)</label>
                  <input
                    type="number"
                    value={minBet}
                    onChange={(e) => setMinBet(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Mise maximum par numéro (HTG)</label>
                  <input
                    type="number"
                    value={maxPerNumber}
                    onChange={(e) => setMaxPerNumber(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Mise maximum par ticket (HTG)</label>
                  <input
                    type="number"
                    value={maxTotal}
                    onChange={(e) => setMaxTotal(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveBetLimits}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold"
              >
                <CheckCircle className="w-5 h-5" />
                Enregistrer les limites
              </button>
            </div>

            {/* Current limits */}
            {betLimits && betLimits.global_limits && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Limites Actuelles (Global)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-emerald-400">{betLimits.global_limits.min_bet}</p>
                    <p className="text-slate-400 text-sm">Mise Min</p>
                  </div>
                  <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-amber-400">{betLimits.global_limits.max_bet_per_number}</p>
                    <p className="text-slate-400 text-sm">Max/Numéro</p>
                  </div>
                  <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-400">{betLimits.global_limits.max_total_per_ticket}</p>
                    <p className="text-slate-400 text-sm">Max/Ticket</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Logo & Ticket Tab */}
        {activeTab === 'ticket' && (
          <div className="space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Logo de l'entreprise</h3>
              
              <div className="flex items-center gap-6">
                <div className="w-32 h-32 bg-slate-800 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-600">
                  {ticketSettings?.logo_exists ? (
                    <CheckCircle className="w-12 h-12 text-emerald-400" />
                  ) : (
                    <Image className="w-12 h-12 text-slate-500" />
                  )}
                </div>
                <div>
                  <p className="text-slate-400 mb-3">
                    {ticketSettings?.logo_exists ? 'Logo configuré' : 'Aucun logo uploadé'}
                  </p>
                  <label className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Uploader un logo
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  <p className="text-slate-500 text-xs mt-2">Format: PNG, JPG (max 500KB)</p>
                </div>
              </div>
            </div>

            {ticketSettings && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Informations sur le ticket</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-400 text-sm">Nom entreprise</p>
                    <p className="text-white">{ticketSettings.company_name || 'Non configuré'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Adresse</p>
                    <p className="text-white">{ticketSettings.company_address || 'Non configuré'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Téléphone</p>
                    <p className="text-white">{ticketSettings.company_phone || 'Non configuré'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">QR Code</p>
                    <p className="text-white">{ticketSettings.show_qr_code ? 'Activé' : 'Désactivé'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </CompanyLayout>
  );
};

export default CompanyExportsPage;
