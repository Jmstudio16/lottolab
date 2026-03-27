import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import { AdminLayout } from '@/components/AdminLayout';
import axios from 'axios';
import { toast } from 'sonner';
import { API_URL } from '@/config/api';
import { 
  Trophy, Plus, Edit2, Trash2, Save, X, RefreshCw, Calendar,
  Hash, Award, Calculator, Users, AlertTriangle, CheckCircle,
  Clock, DollarSign, Target, Zap, Eye, Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

/**
 * SuperAdminResultsPage - ULTRA PRO Results Management
 * Features: Publish results, Auto-calculate winnings (60/20/10), Recalculate
 */
const SuperAdminResultsPage = () => {
  const { token } = useAuth();
  const [results, setResults] = useState([]);
  const [lotteries, setLotteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [recalculating, setRecalculating] = useState(null);
  
  // Modal states
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  
  // Filters
  const [filterLottery, setFilterLottery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  
  // Form data for publishing
  const [formData, setFormData] = useState({
    lottery_id: '',
    draw_date: new Date().toISOString().split('T')[0],
    draw_name: 'Soir',
    first_prize: '',  // 3 chiffres
    second_prize: '', // 2 chiffres
    third_prize: '',  // 2 chiffres
    official_source: '',
    notes: ''
  });

  const headers = { Authorization: `Bearer ${token}` };

  const drawTimes = [
    { value: 'Matin', label: 'Matin (10:30 AM)' },
    { value: 'Midday', label: 'Midi (13:00)' },
    { value: 'Soir', label: 'Soir (21:00)' },
    { value: 'Nuit', label: 'Nuit (23:30)' }
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resultsRes, lotteriesRes] = await Promise.all([
        axios.get(`${API_URL}/api/results`, { 
          headers,
          params: { 
            lottery_id: filterLottery || undefined,
            date: filterDate || undefined,
            limit: 100
          }
        }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/results/lotteries`, { headers }).catch(() => ({ data: [] }))
      ]);
      setResults(Array.isArray(resultsRes.data) ? resultsRes.data : []);
      setLotteries(Array.isArray(lotteriesRes.data) ? lotteriesRes.data : []);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterLottery, filterDate]);

  const handlePublish = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.lottery_id) {
      toast.error('Sélectionnez une loterie');
      return;
    }
    if (!formData.first_prize || formData.first_prize.length !== 3) {
      toast.error('1er lot doit avoir 3 chiffres');
      return;
    }
    if (!formData.second_prize || formData.second_prize.length !== 2) {
      toast.error('2ème lot doit avoir 2 chiffres');
      return;
    }
    if (!formData.third_prize || formData.third_prize.length !== 2) {
      toast.error('3ème lot doit avoir 2 chiffres');
      return;
    }
    
    setPublishing(true);
    try {
      // Convert to API format
      const data = {
        lottery_id: formData.lottery_id,
        draw_date: formData.draw_date,
        draw_name: formData.draw_name,
        winning_numbers: {
          first: formData.first_prize,
          second: formData.second_prize,
          third: formData.third_prize,
          // Borlette = last 2 digits of first prize
          borlette: formData.first_prize.slice(-2)
        },
        official_source: formData.official_source || 'Manual Entry',
        notes: formData.notes
      };

      const response = await axios.post(`${API_URL}/api/results/publish`, data, { headers });
      
      toast.success(
        <div>
          <p className="font-bold">Résultats publiés!</p>
          <p>Tickets traités: {response.data.tickets_processed}</p>
          <p>Gagnants: {response.data.winners_count}</p>
          <p>Total gains: {response.data.total_payouts?.toLocaleString()} HTG</p>
        </div>,
        { duration: 8000 }
      );
      
      setShowPublishModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Publish error:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la publication');
    } finally {
      setPublishing(false);
    }
  };

  const handleRecalculate = async (resultId) => {
    if (!window.confirm('Recalculer tous les gains pour ce tirage? Cette action peut prendre quelques secondes.')) {
      return;
    }
    
    setRecalculating(resultId);
    try {
      const response = await axios.post(
        `${API_URL}/api/results/${resultId}/recalculate`,
        {},
        { headers }
      );
      
      toast.success(
        <div>
          <p className="font-bold">Recalcul terminé!</p>
          <p>Tickets traités: {response.data.tickets_processed}</p>
          <p>Gagnants: {response.data.winners_count}</p>
          <p>Total: {response.data.total_payouts?.toLocaleString()} HTG</p>
        </div>,
        { duration: 6000 }
      );
      
      fetchData();
    } catch (error) {
      console.error('Recalculate error:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors du recalcul');
    } finally {
      setRecalculating(null);
    }
  };

  const handleDelete = async (resultId) => {
    if (!window.confirm('Supprimer ce résultat? Les gains calculés seront également annulés.')) {
      return;
    }
    
    try {
      await axios.delete(`${API_URL}/api/results/${resultId}`, { headers });
      toast.success('Résultat supprimé');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const handleEdit = (result) => {
    setSelectedResult(result);
    const wn = result.winning_numbers || {};
    setFormData({
      lottery_id: result.lottery_id,
      draw_date: result.draw_date,
      draw_name: result.draw_name,
      first_prize: wn.first || '',
      second_prize: wn.second || '',
      third_prize: wn.third || '',
      official_source: result.official_source || '',
      notes: result.notes || ''
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!selectedResult) return;
    
    setPublishing(true);
    try {
      const data = {
        winning_numbers: {
          first: formData.first_prize,
          second: formData.second_prize,
          third: formData.third_prize,
          borlette: formData.first_prize.slice(-2)
        },
        official_source: formData.official_source,
        notes: formData.notes
      };

      await axios.put(`${API_URL}/api/results/${selectedResult.result_id}`, data, { headers });
      
      toast.success('Résultat mis à jour');
      setShowEditModal(false);
      setSelectedResult(null);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    } finally {
      setPublishing(false);
    }
  };

  const resetForm = () => {
    setFormData({
      lottery_id: '',
      draw_date: new Date().toISOString().split('T')[0],
      draw_name: 'Soir',
      first_prize: '',
      second_prize: '',
      third_prize: '',
      official_source: '',
      notes: ''
    });
  };

  const formatWinningNumbers = (wn) => {
    if (!wn) return '-';
    if (typeof wn === 'object') {
      return `${wn.first || '---'} | ${wn.second || '--'} | ${wn.third || '--'}`;
    }
    return String(wn);
  };

  return (
    <AdminLayout role="SUPER_ADMIN">
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl">
              <Trophy className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Publication Résultats</h1>
              <p className="text-slate-400">Calcul automatique des gains (60/20/10)</p>
            </div>
          </div>
          
          <Button
            onClick={() => { resetForm(); setShowPublishModal(true); }}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
            data-testid="publish-result-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Publier Résultat
          </Button>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-amber-900/30 to-amber-800/20 border border-amber-700/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <Award className="w-5 h-5" />
              <span className="font-semibold">1er LOT</span>
            </div>
            <p className="text-2xl font-bold text-white">x60</p>
            <p className="text-sm text-slate-400">3 chiffres (Borlette = 2 derniers)</p>
          </div>
          
          <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-700/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <Target className="w-5 h-5" />
              <span className="font-semibold">2ème LOT</span>
            </div>
            <p className="text-2xl font-bold text-white">x20</p>
            <p className="text-sm text-slate-400">2 chiffres</p>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 border border-emerald-700/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <Hash className="w-5 h-5" />
              <span className="font-semibold">3ème LOT</span>
            </div>
            <p className="text-2xl font-bold text-white">x10</p>
            <p className="text-sm text-slate-400">2 chiffres</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <select
              value={filterLottery}
              onChange={(e) => setFilterLottery(e.target.value)}
              className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
            >
              <option value="">Toutes les loteries</option>
              {lotteries.map(lot => (
                <option key={lot.lottery_id} value={lot.lottery_id}>
                  {lot.lottery_name} ({lot.state_code})
                </option>
              ))}
            </select>
            
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
            />
            
            <Button
              onClick={() => { setFilterLottery(''); setFilterDate(''); }}
              variant="outline"
              className="border-slate-600"
            >
              Effacer
            </Button>
            
            <Button onClick={fetchData} variant="outline" className="border-slate-600">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucun résultat trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 text-sm border-b border-slate-800 bg-slate-800/50">
                    <th className="px-4 py-3">Loterie</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Tirage</th>
                    <th className="px-4 py-3 text-center">1er | 2ème | 3ème</th>
                    <th className="px-4 py-3 text-center">Gagnants</th>
                    <th className="px-4 py-3 text-right">Total Gains</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr 
                      key={result.result_id} 
                      className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{result.lottery_name}</div>
                        <div className="text-xs text-slate-500">{result.state_code}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{result.draw_date}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm">
                          {result.draw_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded font-mono font-bold">
                            {result.winning_numbers?.first || '---'}
                          </span>
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded font-mono">
                            {result.winning_numbers?.second || '--'}
                          </span>
                          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded font-mono">
                            {result.winning_numbers?.third || '--'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-amber-400 font-semibold">
                          {result.winners_count || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-semibold">
                        {(result.total_payouts || 0).toLocaleString()} HTG
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(result)}
                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRecalculate(result.result_id)}
                            disabled={recalculating === result.result_id}
                            className="p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Recalculer gains"
                          >
                            {recalculating === result.result_id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Calculator className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(result.result_id)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Trophy className="w-6 h-6" />
                  Publier Résultat
                </h2>
                <button 
                  onClick={() => setShowPublishModal(false)}
                  className="text-white/70 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <form onSubmit={handlePublish} className="p-6 space-y-4">
              {/* Lottery Selection */}
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Loterie *</label>
                <select
                  value={formData.lottery_id}
                  onChange={(e) => setFormData({...formData, lottery_id: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  required
                >
                  <option value="">Sélectionner...</option>
                  {lotteries.map(lot => (
                    <option key={lot.lottery_id} value={lot.lottery_id}>
                      {lot.lottery_name} ({lot.state_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Draw Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Date *</label>
                  <input
                    type="date"
                    value={formData.draw_date}
                    onChange={(e) => setFormData({...formData, draw_date: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Tirage *</label>
                  <select
                    value={formData.draw_name}
                    onChange={(e) => setFormData({...formData, draw_name: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    required
                  >
                    {drawTimes.map(dt => (
                      <option key={dt.value} value={dt.value}>{dt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Winning Numbers */}
              <div className="space-y-3">
                <label className="text-sm text-slate-400 font-medium">Numéros Gagnants *</label>
                
                <div className="grid grid-cols-3 gap-3">
                  {/* 1er LOT */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-amber-400 text-xs font-medium">
                      <Award className="w-3 h-3" />
                      1er LOT (x60)
                    </div>
                    <input
                      type="text"
                      value={formData.first_prize}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                        setFormData({...formData, first_prize: val});
                      }}
                      placeholder="123"
                      maxLength={3}
                      className="w-full px-3 py-3 bg-amber-500/10 border-2 border-amber-500/50 rounded-lg text-white text-center text-2xl font-mono font-bold placeholder:text-amber-700/50"
                      required
                    />
                    <p className="text-xs text-slate-500 text-center">3 chiffres</p>
                  </div>
                  
                  {/* 2ème LOT */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-blue-400 text-xs font-medium">
                      <Target className="w-3 h-3" />
                      2ème LOT (x20)
                    </div>
                    <input
                      type="text"
                      value={formData.second_prize}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                        setFormData({...formData, second_prize: val});
                      }}
                      placeholder="45"
                      maxLength={2}
                      className="w-full px-3 py-3 bg-blue-500/10 border-2 border-blue-500/50 rounded-lg text-white text-center text-2xl font-mono font-bold placeholder:text-blue-700/50"
                      required
                    />
                    <p className="text-xs text-slate-500 text-center">2 chiffres</p>
                  </div>
                  
                  {/* 3ème LOT */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                      <Hash className="w-3 h-3" />
                      3ème LOT (x10)
                    </div>
                    <input
                      type="text"
                      value={formData.third_prize}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                        setFormData({...formData, third_prize: val});
                      }}
                      placeholder="67"
                      maxLength={2}
                      className="w-full px-3 py-3 bg-emerald-500/10 border-2 border-emerald-500/50 rounded-lg text-white text-center text-2xl font-mono font-bold placeholder:text-emerald-700/50"
                      required
                    />
                    <p className="text-xs text-slate-500 text-center">2 chiffres</p>
                  </div>
                </div>
                
                {/* Borlette Preview */}
                {formData.first_prize.length >= 2 && (
                  <div className="bg-slate-800 rounded-lg p-3 text-center">
                    <span className="text-slate-400 text-sm">Borlette (2 derniers) = </span>
                    <span className="text-amber-400 font-mono font-bold text-lg">
                      {formData.first_prize.slice(-2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Source & Notes */}
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Source officielle</label>
                <input
                  type="text"
                  value={formData.official_source}
                  onChange={(e) => setFormData({...formData, official_source: e.target.value})}
                  placeholder="Ex: New York Lottery Official"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              {/* Alert */}
              <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-200">
                  <p className="font-semibold">Calcul automatique</p>
                  <p className="text-amber-300/70">
                    En publiant, le système calculera automatiquement les gains de tous les tickets correspondants.
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPublishModal(false)}
                  className="flex-1 border-slate-600"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={publishing}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600"
                >
                  {publishing ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Publier & Calculer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedResult && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Edit2 className="w-6 h-6" />
                  Modifier Résultat
                </h2>
                <button 
                  onClick={() => { setShowEditModal(false); setSelectedResult(null); }}
                  className="text-white/70 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              {/* Display info */}
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-white font-medium">{selectedResult.lottery_name}</p>
                <p className="text-slate-400 text-sm">
                  {selectedResult.draw_date} - {selectedResult.draw_name}
                </p>
              </div>

              {/* Winning Numbers */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <div className="text-amber-400 text-xs font-medium">1er LOT</div>
                  <input
                    type="text"
                    value={formData.first_prize}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                      setFormData({...formData, first_prize: val});
                    }}
                    maxLength={3}
                    className="w-full px-3 py-3 bg-amber-500/10 border-2 border-amber-500/50 rounded-lg text-white text-center text-xl font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-blue-400 text-xs font-medium">2ème LOT</div>
                  <input
                    type="text"
                    value={formData.second_prize}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                      setFormData({...formData, second_prize: val});
                    }}
                    maxLength={2}
                    className="w-full px-3 py-3 bg-blue-500/10 border-2 border-blue-500/50 rounded-lg text-white text-center text-xl font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-emerald-400 text-xs font-medium">3ème LOT</div>
                  <input
                    type="text"
                    value={formData.third_prize}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                      setFormData({...formData, third_prize: val});
                    }}
                    maxLength={2}
                    className="w-full px-3 py-3 bg-emerald-500/10 border-2 border-emerald-500/50 rounded-lg text-white text-center text-xl font-mono font-bold"
                  />
                </div>
              </div>

              {/* Alert */}
              <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-200">
                  Après modification, utilisez le bouton "Recalculer" pour mettre à jour les gains.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowEditModal(false); setSelectedResult(null); }}
                  className="flex-1 border-slate-600"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={publishing}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {publishing ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Sauvegarder
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default SuperAdminResultsPage;
