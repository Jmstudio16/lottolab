import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Trophy, Plus, Search, Calendar, Clock, Hash, 
  RefreshCw, Trash2, CheckCircle, Users, DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SuperAdminResultsPage = () => {
  const { token } = useAuth();
  const [results, setResults] = useState([]);
  const [lotteries, setLotteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
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
      // API returns array directly - extract only what we need
      const lotteryList = Array.isArray(res.data) ? res.data : (res.data.lotteries || []);
      // Map to simpler objects to avoid React rendering issues
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
      setFormData({
        lottery_id: '',
        lottery_name: '',
        draw_date: new Date().toISOString().split('T')[0],
        draw_time: 'Midi',
        winning_numbers: '',
        winning_numbers_second: '',
        winning_numbers_third: ''
      });
      setTimeout(fetchResults, 2000); // Refresh after processing
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la publication');
    }
  };

  const handleDelete = async (resultId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce résultat? Les tickets seront réinitialisés.')) {
      return;
    }
    
    try {
      await axios.delete(`${API_URL}/api/super-admin/results/${resultId}`, { headers });
      toast.success('Résultat supprimé');
      fetchResults();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const filteredResults = results.filter(r => 
    r.lottery_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.winning_numbers?.includes(searchTerm)
  );

  const drawTimes = ['Matin', 'Midi', 'Soir', 'Nuit'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Trophy className="w-7 h-7 text-amber-400" />
            Résultats des Loteries
          </h1>
          <p className="text-slate-400">Publiez les résultats et gérez les gagnants</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddModal(true)} className="bg-amber-600 hover:bg-amber-700">
            <Plus className="w-4 h-4 mr-2" />
            Publier Résultat
          </Button>
          <Button onClick={fetchResults} variant="outline" className="border-slate-700">
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
              placeholder="Rechercher par loterie ou numéros..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white"
            />
          </div>
        </div>
        <div>
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white"
          />
        </div>
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
                    Aucun résultat publié
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
                      <span className="text-amber-400 font-bold text-lg tracking-wider">
                        {typeof result.winning_numbers === 'object' 
                          ? result.winning_numbers.first || JSON.stringify(result.winning_numbers)
                          : result.winning_numbers}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">
                        Publié
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(result.result_id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
              Publier un Résultat
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Lottery Selection */}
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

            {/* Date and Time */}
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
                  required
                >
                  {drawTimes.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Winning Numbers */}
            <div>
              <Label className="text-slate-300 flex items-center gap-2">
                <Hash className="w-4 h-4 text-amber-400" />
                Numéros Gagnants (1er Prix) *
              </Label>
              <Input
                value={formData.winning_numbers}
                onChange={(e) => setFormData({...formData, winning_numbers: e.target.value})}
                className="bg-slate-800 border-slate-700 text-white text-lg font-bold tracking-wider"
                placeholder="Ex: 12-34-56 ou 1234"
                required
              />
              <p className="text-xs text-slate-500 mt-1">Format: 12-34-56 ou 123456</p>
            </div>

            {/* Secondary Prizes (optional) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">2ème Prix (optionnel)</Label>
                <Input
                  value={formData.winning_numbers_second}
                  onChange={(e) => setFormData({...formData, winning_numbers_second: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Ex: 78-90-12"
                />
              </div>
              <div>
                <Label className="text-slate-300">3ème Prix (optionnel)</Label>
                <Input
                  value={formData.winning_numbers_third}
                  onChange={(e) => setFormData({...formData, winning_numbers_third: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Ex: 34-56-78"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="border-slate-700">
                Annuler
              </Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-700">
                <CheckCircle className="w-4 h-4 mr-2" />
                Publier Résultat
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminResultsPage;
