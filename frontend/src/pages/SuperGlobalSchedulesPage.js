import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Calendar, Clock, Plus, Edit2, Trash2, Save, X, Filter, RefreshCw, Check
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DAYS_OF_WEEK = [
  { value: 0, label: 'Lundi' },
  { value: 1, label: 'Mardi' },
  { value: 2, label: 'Mercredi' },
  { value: 3, label: 'Jeudi' },
  { value: 4, label: 'Vendredi' },
  { value: 5, label: 'Samedi' },
  { value: 6, label: 'Dimanche' },
];

export const SuperGlobalSchedulesPage = () => {
  const { token } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [lotteries, setLotteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [filterLottery, setFilterLottery] = useState('');

  const [formData, setFormData] = useState({
    lottery_id: '',
    draw_name: '',
    days_of_week: [],
    open_time: '08:00',
    close_time: '12:00',
    draw_time: '12:30',
    is_active: true
  });

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [schedulesRes, lotteriesRes] = await Promise.all([
        axios.get(`${API_URL}/api/super/global-schedules`, { headers }),
        axios.get(`${API_URL}/api/super/lottery-catalog`, { headers })
      ]);
      setSchedules(schedulesRes.data);
      setLotteries(lotteriesRes.data);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSchedule) {
        await axios.put(
          `${API_URL}/api/super/global-schedules/${editingSchedule.schedule_id}`,
          formData,
          { headers }
        );
        toast.success('Schedule mis à jour');
      } else {
        await axios.post(`${API_URL}/api/super/global-schedules`, formData, { headers });
        toast.success('Schedule créé');
      }
      setShowAddModal(false);
      setEditingSchedule(null);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };

  const handleDelete = async (scheduleId) => {
    if (!window.confirm('Supprimer ce schedule?')) return;
    try {
      await axios.delete(`${API_URL}/api/super/global-schedules/${scheduleId}`, { headers });
      toast.success('Schedule supprimé');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setFormData({
      lottery_id: '',
      draw_name: '',
      days_of_week: [],
      open_time: '08:00',
      close_time: '12:00',
      draw_time: '12:30',
      is_active: true
    });
  };

  const openEditModal = (schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      lottery_id: schedule.lottery_id,
      draw_name: schedule.draw_name,
      days_of_week: schedule.days_of_week || [],
      open_time: schedule.open_time,
      close_time: schedule.close_time,
      draw_time: schedule.draw_time,
      is_active: schedule.is_active
    });
    setShowAddModal(true);
  };

  const toggleDay = (day) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day].sort()
    }));
  };

  const filteredSchedules = filterLottery
    ? schedules.filter(s => s.lottery_id === filterLottery)
    : schedules;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl">
              <Calendar className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Global Schedules</h1>
              <p className="text-slate-400">{schedules.length} schedules configurés</p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            data-testid="add-schedule-btn"
          >
            <Plus className="w-4 h-4" />
            Ajouter Schedule
          </button>
        </div>

        {/* Filters */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <select
              value={filterLottery}
              onChange={(e) => setFilterLottery(e.target.value)}
              className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              data-testid="filter-lottery"
            >
              <option value="">Toutes les loteries</option>
              {lotteries.map(lot => (
                <option key={lot.lottery_id} value={lot.lottery_id}>
                  {lot.lottery_name} ({lot.state_code})
                </option>
              ))}
            </select>
            <button
              onClick={fetchData}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Schedule List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full" data-testid="schedules-table">
              <thead>
                <tr className="text-left text-slate-400 text-sm border-b border-slate-800">
                  <th className="px-6 py-4">Loterie</th>
                  <th className="px-6 py-4">Draw</th>
                  <th className="px-6 py-4">Jours</th>
                  <th className="px-6 py-4">Ouverture</th>
                  <th className="px-6 py-4">Fermeture</th>
                  <th className="px-6 py-4">Tirage</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchedules.map(schedule => (
                  <tr key={schedule.schedule_id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{schedule.lottery_name || 'N/A'}</div>
                      <div className="text-slate-400 text-sm">{schedule.state_code}</div>
                    </td>
                    <td className="px-6 py-4 text-white">{schedule.draw_name}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {schedule.days_of_week?.length > 0 ? (
                          schedule.days_of_week.map(day => (
                            <span key={day} className="px-1.5 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">
                              {DAYS_OF_WEEK.find(d => d.value === day)?.label.slice(0, 3)}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 text-sm">Tous les jours</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-emerald-400 font-mono">{schedule.open_time}</td>
                    <td className="px-6 py-4 text-orange-400 font-mono">{schedule.close_time}</td>
                    <td className="px-6 py-4 text-cyan-400 font-mono">{schedule.draw_time}</td>
                    <td className="px-6 py-4">
                      {schedule.is_active ? (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <Check className="w-4 h-4" /> Actif
                        </span>
                      ) : (
                        <span className="text-red-400">Inactif</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(schedule)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                          data-testid={`edit-${schedule.schedule_id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(schedule.schedule_id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          data-testid={`delete-${schedule.schedule_id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSchedules.length === 0 && (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                      Aucun schedule trouvé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-lg mx-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  {editingSchedule ? 'Modifier Schedule' : 'Nouveau Schedule'}
                </h2>
                <button
                  onClick={() => { setShowAddModal(false); setEditingSchedule(null); }}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Loterie</label>
                  <select
                    value={formData.lottery_id}
                    onChange={(e) => setFormData({ ...formData, lottery_id: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    required
                    data-testid="lottery-select"
                  >
                    <option value="">Sélectionner une loterie</option>
                    {lotteries.map(lot => (
                      <option key={lot.lottery_id} value={lot.lottery_id}>
                        {lot.lottery_name} ({lot.state_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Nom du tirage</label>
                  <select
                    value={formData.draw_name}
                    onChange={(e) => setFormData({ ...formData, draw_name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    required
                    data-testid="draw-name-select"
                  >
                    <option value="">Sélectionner</option>
                    <option value="Midday">Midday (Midi)</option>
                    <option value="Evening">Evening (Soir)</option>
                    <option value="Night">Night (Nuit)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Jours (laisser vide pour tous)</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          formData.days_of_week.includes(day.value)
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Ouverture</label>
                    <input
                      type="time"
                      value={formData.open_time}
                      onChange={(e) => setFormData({ ...formData, open_time: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      required
                      data-testid="open-time"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Fermeture</label>
                    <input
                      type="time"
                      value={formData.close_time}
                      onChange={(e) => setFormData({ ...formData, close_time: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      required
                      data-testid="close-time"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Tirage</label>
                    <input
                      type="time"
                      value={formData.draw_time}
                      onChange={(e) => setFormData({ ...formData, draw_time: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      required
                      data-testid="draw-time"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="is_active" className="text-slate-300">Actif</label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); setEditingSchedule(null); }}
                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                    data-testid="save-schedule-btn"
                  >
                    <Save className="w-4 h-4" />
                    {editingSchedule ? 'Mettre à jour' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
