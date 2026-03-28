import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import { AdminLayout } from '@/components/AdminLayout';
import axios from 'axios';
import { toast } from 'sonner';
import { API_URL } from '@/config/api';
import { 
  Clock, Plus, Edit2, Trash2, Save, X, RefreshCw, Calendar,
  Sun, Moon, Sunrise, Sunset, Power, PowerOff, CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

/**
 * SuperAdminDrawTimesPage - Manage lottery draw times
 * CRUD interface for Super Admin only
 */
const SuperAdminDrawTimesPage = () => {
  const { token } = useAuth();
  const [drawTimes, setDrawTimes] = useState([]);
  const [lotteries, setLotteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDrawTime, setSelectedDrawTime] = useState(null);
  
  // Filter
  const [filterLottery, setFilterLottery] = useState('');
  
  // Form data
  const [formData, setFormData] = useState({
    lottery_id: '',
    draw_name: 'Soir',
    open_time: '06:00',
    close_time: '21:15',
    draw_time: '21:30',
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    is_active: true
  });

  const headers = { Authorization: `Bearer ${token}` };

  const drawNameOptions = [
    { value: 'Matin', label: 'Matin', icon: Sunrise, color: 'text-orange-400' },
    { value: 'Midi', label: 'Midi', icon: Sun, color: 'text-yellow-400' },
    { value: 'Soir', label: 'Soir', icon: Sunset, color: 'text-purple-400' },
    { value: 'Nuit', label: 'Nuit', icon: Moon, color: 'text-blue-400' }
  ];

  const daysOfWeek = [
    { value: 0, label: 'Lun' },
    { value: 1, label: 'Mar' },
    { value: 2, label: 'Mer' },
    { value: 3, label: 'Jeu' },
    { value: 4, label: 'Ven' },
    { value: 5, label: 'Sam' },
    { value: 6, label: 'Dim' }
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      const [drawTimesRes, lotteriesRes] = await Promise.all([
        axios.get(`${API_URL}/api/super/draw-times`, { 
          headers,
          params: { lottery_id: filterLottery || undefined }
        }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/results/lotteries`, { headers }).catch(() => ({ data: [] }))
      ]);
      setDrawTimes(Array.isArray(drawTimesRes.data) ? drawTimesRes.data : []);
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
  }, [filterLottery]);

  const handleAdd = async (e) => {
    e.preventDefault();
    
    if (!formData.lottery_id) {
      toast.error('Sélectionnez une loterie');
      return;
    }
    
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/super/draw-times`, formData, { headers });
      toast.success('Tirage créé avec succès');
      setShowAddModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (dt) => {
    setSelectedDrawTime(dt);
    setFormData({
      lottery_id: dt.lottery_id,
      draw_name: dt.draw_name,
      open_time: dt.open_time || '06:00',
      close_time: dt.close_time || '21:15',
      draw_time: dt.draw_time || '21:30',
      days_of_week: dt.days_of_week || [0, 1, 2, 3, 4, 5, 6],
      is_active: dt.is_active !== false
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!selectedDrawTime) return;
    
    setSaving(true);
    try {
      await axios.put(
        `${API_URL}/api/super/draw-times/${selectedDrawTime.schedule_id}`,
        formData,
        { headers }
      );
      toast.success('Tirage mis à jour');
      setShowEditModal(false);
      setSelectedDrawTime(null);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (scheduleId) => {
    if (!window.confirm('Supprimer ce tirage? Cette action est irréversible.')) {
      return;
    }
    
    try {
      await axios.delete(`${API_URL}/api/super/draw-times/${scheduleId}`, { headers });
      toast.success('Tirage supprimé');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const handleToggle = async (scheduleId, currentStatus) => {
    try {
      await axios.put(`${API_URL}/api/super/draw-times/${scheduleId}/toggle`, {}, { headers });
      toast.success(currentStatus ? 'Tirage désactivé' : 'Tirage activé');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };

  const handleBulkCreate = async (lotteryId) => {
    if (!window.confirm('Créer les tirages standards (Matin, Midi, Soir) pour cette loterie?')) {
      return;
    }
    
    try {
      const response = await axios.post(
        `${API_URL}/api/super/draw-times/bulk-create?lottery_id=${lotteryId}`,
        {},
        { headers }
      );
      toast.success(response.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };

  const resetForm = () => {
    setFormData({
      lottery_id: '',
      draw_name: 'Soir',
      open_time: '06:00',
      close_time: '21:15',
      draw_time: '21:30',
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      is_active: true
    });
  };

  const toggleDay = (day) => {
    const current = formData.days_of_week || [];
    if (current.includes(day)) {
      setFormData({ ...formData, days_of_week: current.filter(d => d !== day) });
    } else {
      setFormData({ ...formData, days_of_week: [...current, day].sort() });
    }
  };

  const getDrawIcon = (drawName) => {
    const option = drawNameOptions.find(o => o.value === drawName);
    if (option) {
      const Icon = option.icon;
      return <Icon className={`w-4 h-4 ${option.color}`} />;
    }
    return <Clock className="w-4 h-4 text-slate-400" />;
  };

  return (
    <AdminLayout role="SUPER_ADMIN">
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-xl">
              <Clock className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Heures de Tirage</h1>
              <p className="text-slate-400">Gestion exclusive des tirages (Super Admin)</p>
            </div>
          </div>
          
          <Button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
            data-testid="add-draw-time-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter Tirage
          </Button>
        </div>

        {/* Filter */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <select
              value={filterLottery}
              onChange={(e) => setFilterLottery(e.target.value)}
              className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              data-testid="lottery-filter"
            >
              <option value="">Toutes les loteries</option>
              {lotteries.map(lot => (
                <option key={lot.lottery_id} value={lot.lottery_id}>
                  {lot.lottery_name} ({lot.state_code})
                </option>
              ))}
            </select>
            
            <Button onClick={() => setFilterLottery('')} variant="outline" className="border-slate-600">
              Effacer
            </Button>
            
            <Button onClick={fetchData} variant="outline" className="border-slate-600">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Draw Times Table */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
          ) : drawTimes.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucun tirage trouvé</p>
              <p className="text-sm mt-2">Ajoutez des tirages manuellement</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 text-sm border-b border-slate-800 bg-slate-800/50">
                    <th className="px-4 py-3">Loterie</th>
                    <th className="px-4 py-3">Tirage</th>
                    <th className="px-4 py-3 text-center">Ouverture</th>
                    <th className="px-4 py-3 text-center">Fermeture</th>
                    <th className="px-4 py-3 text-center">Tirage</th>
                    <th className="px-4 py-3 text-center">Jours</th>
                    <th className="px-4 py-3 text-center">Actif</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drawTimes.map((dt) => (
                    <tr 
                      key={dt.schedule_id} 
                      className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{dt.lottery_name}</div>
                        <div className="text-xs text-slate-500">{dt.state_code}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getDrawIcon(dt.draw_name)}
                          <span className="text-white">{dt.draw_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded font-mono text-sm">
                          {dt.open_time}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded font-mono text-sm">
                          {dt.close_time}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded font-mono text-sm">
                          {dt.draw_time}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          {daysOfWeek.map(day => (
                            <span 
                              key={day.value}
                              className={`w-6 h-6 flex items-center justify-center rounded text-xs ${
                                (dt.days_of_week || []).includes(day.value)
                                  ? 'bg-purple-500/30 text-purple-300'
                                  : 'bg-slate-700/50 text-slate-500'
                              }`}
                            >
                              {day.label[0]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggle(dt.schedule_id, dt.is_active)}
                          className={`p-2 rounded-lg transition-colors ${
                            dt.is_active 
                              ? 'text-emerald-400 hover:bg-emerald-500/20' 
                              : 'text-slate-500 hover:bg-slate-700'
                          }`}
                        >
                          {dt.is_active ? (
                            <Power className="w-5 h-5" />
                          ) : (
                            <PowerOff className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(dt)}
                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(dt.schedule_id)}
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

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{drawTimes.length}</p>
            <p className="text-sm text-slate-400">Total Tirages</p>
          </div>
          <div className="bg-emerald-900/30 border border-emerald-700/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">
              {drawTimes.filter(dt => dt.is_active).length}
            </p>
            <p className="text-sm text-slate-400">Tirages Actifs</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">
              {new Set(drawTimes.map(dt => dt.lottery_id)).size}
            </p>
            <p className="text-sm text-slate-400">Loteries</p>
          </div>
          <div className="bg-purple-900/30 border border-purple-700/30 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-purple-400">{lotteries.length}</p>
            <p className="text-sm text-slate-400">Loteries Globales</p>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Clock className="w-6 h-6" />
                  Ajouter Tirage
                </h2>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="text-white/70 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleAdd} className="p-6 space-y-4">
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

              {/* Draw Name */}
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Nom du Tirage *</label>
                <div className="grid grid-cols-4 gap-2">
                  {drawNameOptions.map(option => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({...formData, draw_name: option.value})}
                        className={`p-3 rounded-lg border flex flex-col items-center gap-1 transition-colors ${
                          formData.draw_name === option.value
                            ? 'border-purple-500 bg-purple-500/20'
                            : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${option.color}`} />
                        <span className="text-sm text-white">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Times */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Ouverture</label>
                  <input
                    type="time"
                    value={formData.open_time}
                    onChange={(e) => setFormData({...formData, open_time: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Fermeture</label>
                  <input
                    type="time"
                    value={formData.close_time}
                    onChange={(e) => setFormData({...formData, close_time: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Tirage</label>
                  <input
                    type="time"
                    value={formData.draw_time}
                    onChange={(e) => setFormData({...formData, draw_time: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Days of Week */}
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Jours de la semaine</label>
                <div className="flex gap-2">
                  {daysOfWeek.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`w-10 h-10 rounded-lg border flex items-center justify-center text-sm font-medium transition-colors ${
                        formData.days_of_week.includes(day.value)
                          ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 border-slate-600"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Créer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedDrawTime && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Edit2 className="w-6 h-6" />
                  Modifier Tirage
                </h2>
                <button 
                  onClick={() => { setShowEditModal(false); setSelectedDrawTime(null); }}
                  className="text-white/70 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              {/* Display info */}
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-white font-medium">{selectedDrawTime.lottery_name}</p>
                <p className="text-slate-400 text-sm">{selectedDrawTime.state_code}</p>
              </div>

              {/* Draw Name */}
              <div className="grid grid-cols-4 gap-2">
                {drawNameOptions.map(option => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData({...formData, draw_name: option.value})}
                      className={`p-3 rounded-lg border flex flex-col items-center gap-1 transition-colors ${
                        formData.draw_name === option.value
                          ? 'border-blue-500 bg-blue-500/20'
                          : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${option.color}`} />
                      <span className="text-sm text-white">{option.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Times */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Ouverture</label>
                  <input
                    type="time"
                    value={formData.open_time}
                    onChange={(e) => setFormData({...formData, open_time: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Fermeture</label>
                  <input
                    type="time"
                    value={formData.close_time}
                    onChange={(e) => setFormData({...formData, close_time: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Tirage</label>
                  <input
                    type="time"
                    value={formData.draw_time}
                    onChange={(e) => setFormData({...formData, draw_time: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Days of Week */}
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Jours de la semaine</label>
                <div className="flex gap-2">
                  {daysOfWeek.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`w-10 h-10 rounded-lg border flex items-center justify-center text-sm font-medium transition-colors ${
                        formData.days_of_week.includes(day.value)
                          ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowEditModal(false); setSelectedDrawTime(null); }}
                  className="flex-1 border-slate-600"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? (
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

export default SuperAdminDrawTimesPage;
