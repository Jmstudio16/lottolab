import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { Calendar, Clock, Trophy, RefreshCw, Save, Trash2, CheckCircle, XCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const SuperScheduledResultsPage = () => {
  const [scheduledResults, setScheduledResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lotteries, setLotteries] = useState([]);
  const [selectedLottery, setSelectedLottery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    lottery_id: '',
    draw_name: '',
    draw_date: new Date().toISOString().split('T')[0],
    draw_time: '12:00',
    winning_numbers: ''
  });

  useEffect(() => {
    fetchScheduledResults();
    fetchLotteries();
  }, []);

  const fetchScheduledResults = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/scheduled-results/list?limit=100');
      setScheduledResults(response.data.scheduled_results || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des résultats programmés');
    } finally {
      setLoading(false);
    }
  };

  const fetchLotteries = async () => {
    try {
      // Get Plop Plop and Loto Rapid lotteries
      const response = await apiClient.get('/saas/master-lotteries');
      const allLotteries = response.data || [];
      const filtered = allLotteries.filter(l => 
        l.lottery_name?.toLowerCase().includes('plop') || 
        l.lottery_name?.toLowerCase().includes('rapid')
      );
      setLotteries(filtered);
    } catch (error) {
      console.error('Error fetching lotteries:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.lottery_id || !formData.draw_name || !formData.winning_numbers) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    // Validate winning numbers format (XX-YY-ZZ)
    const numbersRegex = /^\d{2}-\d{2}-\d{2}$/;
    if (!numbersRegex.test(formData.winning_numbers)) {
      toast.error('Format des numéros invalide. Utilisez: XX-YY-ZZ (ex: 12-45-78)');
      return;
    }

    try {
      const lottery = lotteries.find(l => l.lottery_id === formData.lottery_id);
      await apiClient.post('/scheduled-results/program', {
        ...formData,
        lottery_name: lottery?.lottery_name,
        is_auto_generated: false
      });
      toast.success('Résultat programmé avec succès');
      setShowForm(false);
      setFormData({
        lottery_id: '',
        draw_name: '',
        draw_date: new Date().toISOString().split('T')[0],
        draw_time: '12:00',
        winning_numbers: ''
      });
      fetchScheduledResults();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la programmation');
    }
  };

  const deleteResult = async (resultId) => {
    if (!window.confirm('Voulez-vous annuler ce résultat programmé ?')) return;
    
    try {
      await apiClient.delete(`/scheduled-results/${resultId}`);
      toast.success('Résultat annulé');
      fetchScheduledResults();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'annulation');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SCHEDULED':
        return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs flex items-center gap-1"><Clock className="w-3 h-3" />Programmé</span>;
      case 'RELEASED':
        return <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3" />Publié</span>;
      case 'CANCELLED':
        return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs flex items-center gap-1"><XCircle className="w-3 h-3" />Annulé</span>;
      default:
        return <span className="px-2 py-1 bg-slate-500/20 text-slate-400 rounded text-xs">{status}</span>;
    }
  };

  // Generate draw names based on lottery type
  const getDrawNames = (lotteryId) => {
    const lottery = lotteries.find(l => l.lottery_id === lotteryId);
    if (!lottery) return [];
    
    if (lottery.lottery_name?.toLowerCase().includes('plop')) {
      // Plop Plop - hourly 8-21
      return Array.from({ length: 14 }, (_, i) => `Tirage ${(8 + i).toString().padStart(2, '0')}h00`);
    } else if (lottery.lottery_name?.toLowerCase().includes('rapid')) {
      // Loto Rapid - every 2 hours
      return [8, 10, 12, 14, 16, 18, 20].map(h => `Tirage ${h.toString().padStart(2, '0')}h00`);
    }
    return [];
  };

  return (
    <AdminLayout 
      title="Résultats Programmés" 
      subtitle="Programmez les résultats pour Plop Plop et Loto Rapid" 
      role="SUPER_ADMIN"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex justify-between items-center">
          <Button onClick={fetchScheduledResults} variant="outline" className="border-slate-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button onClick={() => setShowForm(!showForm)} className="bg-amber-600 hover:bg-amber-700">
            <Zap className="w-4 h-4 mr-2" />
            Programmer un Résultat
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Programmer un Nouveau Résultat
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Loterie</label>
                <select
                  value={formData.lottery_id}
                  onChange={(e) => setFormData({ ...formData, lottery_id: e.target.value, draw_name: '' })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  required
                >
                  <option value="">Sélectionner...</option>
                  {lotteries.map(l => (
                    <option key={l.lottery_id} value={l.lottery_id}>{l.lottery_name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tirage</label>
                <select
                  value={formData.draw_name}
                  onChange={(e) => {
                    const drawName = e.target.value;
                    const timeMatch = drawName.match(/(\d{2})h00/);
                    const time = timeMatch ? `${timeMatch[1]}:00` : '12:00';
                    setFormData({ ...formData, draw_name: drawName, draw_time: time });
                  }}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  required
                  disabled={!formData.lottery_id}
                >
                  <option value="">Sélectionner...</option>
                  {getDrawNames(formData.lottery_id).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Date</label>
                <Input
                  type="date"
                  value={formData.draw_date}
                  onChange={(e) => setFormData({ ...formData, draw_date: e.target.value })}
                  className="bg-slate-900 border-slate-700"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Heure</label>
                <Input
                  type="time"
                  value={formData.draw_time}
                  onChange={(e) => setFormData({ ...formData, draw_time: e.target.value })}
                  className="bg-slate-900 border-slate-700"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-400 mb-1">
                  Numéros Gagnants (Format: 1er-2ème-3ème, ex: 12-45-78)
                </label>
                <Input
                  type="text"
                  value={formData.winning_numbers}
                  onChange={(e) => setFormData({ ...formData, winning_numbers: e.target.value })}
                  placeholder="12-45-78"
                  pattern="\d{2}-\d{2}-\d{2}"
                  className="bg-slate-900 border-slate-700"
                  required
                />
              </div>
              
              <div className="md:col-span-3 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-slate-600">
                  Annuler
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                  <Save className="w-4 h-4 mr-2" />
                  Programmer
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <h4 className="font-bold text-blue-400 mb-2">Comment ça fonctionne ?</h4>
          <ul className="text-sm text-blue-300 space-y-1">
            <li>• <strong>Plop Plop</strong>: Résultats toutes les heures (8h-21h). Fermeture 55 min avant.</li>
            <li>• <strong>Loto Rapid</strong>: Résultats toutes les 2h (8h, 10h, 12h...). Fermeture 5 min avant.</li>
            <li>• Si aucun résultat n'est programmé, le système génère automatiquement des numéros aléatoires.</li>
            <li>• Les résultats programmés remplacent les résultats automatiques.</li>
          </ul>
        </div>

        {/* Results Table */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-lg font-bold text-white">Résultats Programmés ({scheduledResults.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">Loterie</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">Tirage</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">Date/Heure</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-amber-400">Numéros</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400">Source</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center">
                      <RefreshCw className="w-6 h-6 text-amber-400 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : scheduledResults.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                      Aucun résultat programmé
                    </td>
                  </tr>
                ) : (
                  scheduledResults.map(result => (
                    <tr key={result.scheduled_result_id} className="hover:bg-slate-700/30">
                      <td className="px-4 py-3">
                        <span className="text-white font-medium">{result.lottery_name}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{result.draw_name}</td>
                      <td className="px-4 py-3 text-slate-400 text-sm">
                        {result.draw_date} à {result.draw_time}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono font-bold text-amber-400 text-lg">{result.winning_numbers}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${
                          result.is_auto_generated 
                            ? 'bg-slate-500/20 text-slate-400' 
                            : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {result.is_auto_generated ? 'Auto' : 'Manuel'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(result.status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {result.status === 'SCHEDULED' && (
                          <button
                            onClick={() => deleteResult(result.scheduled_result_id)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                            title="Annuler"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SuperScheduledResultsPage;
