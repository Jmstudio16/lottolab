import { API_URL } from '@/config/api';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Trophy, Plus, Search, Calendar, Clock, 
  RefreshCw, Trash2, Edit2, X, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';


const SuperAdminResultsPage = () => {
  const { token } = useAuth();
  const [results, setResults] = useState([]);
  const [lotteries, setLotteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingResult, setEditingResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  
  const [formData, setFormData] = useState({
    lottery_id: '',
    lottery_name: '',
    draw_date: new Date().toISOString().split('T')[0],
    draw_time: 'Midi',
    winning_numbers: '',
    winning_numbers_second: '',
    winning_numbers_third: ''
  });

  const headers = { Authorization: `Bearer ${token}` };

  const fetchResults = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterDate) params.append('draw_date', filterDate);
      
      const res = await axios.get(`${API_URL}/api/super-admin/results?${params}`, { headers });
      setResults(res.data.results || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des résultats');
    }
    setLoading(false);
  };

  const fetchLotteries = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/super/lottery-flags?limit=300`, { headers });
      const lotteryList = Array.isArray(res.data) ? res.data : (res.data.lotteries || []);
      const simpleLotteries = lotteryList.map(l => ({
        lottery_id: l.lottery_id,
        lottery_name: l.lottery_name,
        state_code: l.state_code,
        country: l.country
      }));
      setLotteries(simpleLotteries);
    } catch (error) {
      console.error('Error fetching lotteries:', error);
    }
  };

  useEffect(() => {
    fetchResults();
    fetchLotteries();
  }, [filterDate]);

  const handleLotterySelect = (e) => {
    const selectedId = e.target.value;
    const lottery = lotteries.find(l => l.lottery_id === selectedId);
    setFormData({
      ...formData,
      lottery_id: selectedId,
      lottery_name: lottery?.lottery_name || ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.lottery_id || !formData.winning_numbers) {
      toast.error('Veuillez sélectionner une loterie et entrer les numéros gagnants');
      return;
    }
    
    try {
      await axios.post(`${API_URL}/api/super-admin/results`, formData, { headers });
      toast.success('Résultat publié! Calcul des gagnants en cours...');
      setShowAddModal(false);
      resetForm();
      setTimeout(fetchResults, 2000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la publication');
    }
  };

  const handleEdit = (result) => {
    setEditingResult(result);
    setFormData({
      lottery_id: result.lottery_id,
      lottery_name: result.lottery_name,
      draw_date: result.draw_date,
      draw_time: result.draw_time || 'Midi',
      winning_numbers: typeof result.winning_numbers === 'object' 
        ? result.winning_numbers.first || '' 
        : result.winning_numbers || '',
      winning_numbers_second: typeof result.winning_numbers === 'object' 
        ? result.winning_numbers.second || '' 
        : '',
      winning_numbers_third: typeof result.winning_numbers === 'object' 
        ? result.winning_numbers.third || '' 
        : ''
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    if (!formData.winning_numbers) {
      toast.error('Veuillez entrer les numéros gagnants');
      return;
    }
    
    try {
      await axios.put(`${API_URL}/api/super-admin/results/${editingResult.result_id}`, {
        winning_numbers: formData.winning_numbers,
        winning_numbers_second: formData.winning_numbers_second,
        winning_numbers_third: formData.winning_numbers_third,
        draw_time: formData.draw_time
      }, { headers });
      toast.success('Résultat modifié! Recalcul des gagnants en cours...');
      setShowEditModal(false);
      setEditingResult(null);
      resetForm();
      setTimeout(fetchResults, 2000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la modification');
    }
  };

  const handleDelete = async (resultId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce résultat?\n\nLes tickets gagnants seront réinitialisés à leur état précédent.')) {
      return;
    }
    
    try {
      await axios.delete(`${API_URL}/api/super-admin/results/${resultId}`, { headers });
      toast.success('Résultat supprimé avec succès');
      fetchResults();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setFormData({
      lottery_id: '',
      lottery_name: '',
      draw_date: new Date().toISOString().split('T')[0],
      draw_time: 'Midi',
      winning_numbers: '',
      winning_numbers_second: '',
      winning_numbers_third: ''
    });
  };

  const filteredResults = results.filter(r => 
    r.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (typeof r.winning_numbers === 'string' && r.winning_numbers.includes(searchTerm))
  );

  const drawTimes = ['Matin', 'Midi', 'Soir', 'Nuit'];

  const formatWinningNumbers = (wn) => {
    if (!wn) return '--';
    if (typeof wn === 'object') {
      const nums = [wn.first, wn.second, wn.third].filter(n => n);
      return nums.join(' - ') || '--';
    }
    return wn;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Trophy className="w-7 h-7 text-amber-400" />
            Résultats des Loteries
          </h1>
          <p className="text-slate-400">Publiez et gérez les résultats officiels</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddModal(true)} className="bg-amber-600 hover:bg-amber-700">
            <Plus className="w-4 h-4 mr-2" />
            Publier Résultat
          </Button>
          <Button onClick={fetchResults} variant="outline" className="border-slate-700 text-white">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Rechercher une loterie..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white"
            />
          </div>
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white w-48"
          />
        </div>
        {filterDate && (
          <Button variant="outline" className="border-slate-700 text-slate-400" onClick={() => setFilterDate('')}>
            <X className="w-4 h-4 mr-1" /> Effacer
          </Button>
        )}
      </div>

      {/* Results Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Loterie</th>
                <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Date</th>
                <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Tirage</th>
                <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Numéros Gagnants</th>
                <th className="text-center text-slate-400 text-sm font-medium px-4 py-3">Statut</th>
                <th className="text-center text-slate-400 text-sm font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-slate-400 py-8">
                    {loading ? 'Chargement...' : 'Aucun résultat publié'}
                  </td>
                </tr>
              ) : (
                filteredResults.map((result) => (
                  <tr key={result.result_id} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <span className="text-white font-medium">{result.lottery_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300">{result.draw_date}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded-full">
                        {result.draw_time}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {(() => {
                          const nums = typeof result.winning_numbers === 'object'
                            ? [result.winning_numbers.first, result.winning_numbers.second, result.winning_numbers.third].filter(n => n)
                            : [result.winning_numbers];
                          return nums.map((num, idx) => (
                            <span 
                              key={idx}
                              className={`px-3 py-1 rounded-lg font-bold text-white ${
                                idx === 0 ? 'bg-emerald-500' : idx === 1 ? 'bg-amber-400 text-black' : 'bg-blue-500'
                              }`}
                            >
                              {num}
                            </span>
                          ));
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">
                        Publié
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(result)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(result.result_id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Result Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <Trophy className="w-5 h-5" />
              Publier un Nouveau Résultat
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-slate-300">Loterie *</Label>
              <select
                value={formData.lottery_id}
                onChange={handleLotterySelect}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white"
                required
              >
                <option value="">Sélectionner une loterie</option>
                {lotteries.map(lottery => (
                  <option key={lottery.lottery_id} value={lottery.lottery_id}>
                    {lottery.lottery_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Date du Tirage *
                </Label>
                <Input
                  type="date"
                  value={formData.draw_date}
                  onChange={(e) => setFormData({...formData, draw_date: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                  required
                />
              </div>
              <div>
                <Label className="text-slate-300 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Tirage *
                </Label>
                <select
                  value={formData.draw_time}
                  onChange={(e) => setFormData({...formData, draw_time: e.target.value})}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white"
                >
                  {drawTimes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-slate-300">1er Numéro Gagnant * (60x)</Label>
                <Input
                  placeholder="Ex: 555"
                  value={formData.winning_numbers}
                  onChange={(e) => setFormData({...formData, winning_numbers: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white text-lg font-bold"
                  required
                />
              </div>
              <div>
                <Label className="text-slate-300">2ème Numéro (20x) - Optionnel</Label>
                <Input
                  placeholder="Ex: 123"
                  value={formData.winning_numbers_second}
                  onChange={(e) => setFormData({...formData, winning_numbers_second: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">3ème Numéro (10x) - Optionnel</Label>
                <Input
                  placeholder="Ex: 789"
                  value={formData.winning_numbers_third}
                  onChange={(e) => setFormData({...formData, winning_numbers_third: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="bg-slate-800 p-3 rounded-lg text-sm text-slate-400">
              <strong className="text-amber-400">Note:</strong> La publication calculera automatiquement les gagnants avec les multiplicateurs: 1er=60x, 2ème=20x, 3ème=10x
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="border-slate-700 text-white">
                Annuler
              </Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-700">
                <Trophy className="w-4 h-4 mr-2" />
                Publier
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Result Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-400">
              <Edit2 className="w-5 h-5" />
              Modifier le Résultat
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="bg-slate-800 p-3 rounded-lg">
              <p className="text-slate-400 text-sm">Loterie</p>
              <p className="text-white font-bold">{editingResult?.lottery_name}</p>
              <p className="text-slate-400 text-sm mt-1">Date: {editingResult?.draw_date}</p>
            </div>

            <div>
              <Label className="text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Tirage
              </Label>
              <select
                value={formData.draw_time}
                onChange={(e) => setFormData({...formData, draw_time: e.target.value})}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white"
              >
                {drawTimes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-slate-300">1er Numéro Gagnant * (60x)</Label>
                <Input
                  placeholder="Ex: 555"
                  value={formData.winning_numbers}
                  onChange={(e) => setFormData({...formData, winning_numbers: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white text-lg font-bold"
                  required
                />
              </div>
              <div>
                <Label className="text-slate-300">2ème Numéro (20x) - Optionnel</Label>
                <Input
                  placeholder="Ex: 123"
                  value={formData.winning_numbers_second}
                  onChange={(e) => setFormData({...formData, winning_numbers_second: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">3ème Numéro (10x) - Optionnel</Label>
                <Input
                  placeholder="Ex: 789"
                  value={formData.winning_numbers_third}
                  onChange={(e) => setFormData({...formData, winning_numbers_third: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg text-sm text-amber-400">
              <strong>Attention:</strong> La modification recalculera automatiquement tous les gagnants.
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)} className="border-slate-700 text-white">
                Annuler
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" />
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminResultsPage;
