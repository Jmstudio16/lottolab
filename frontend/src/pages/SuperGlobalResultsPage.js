import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Trophy, Plus, Edit2, Trash2, Save, X, Filter, RefreshCw, Calendar,
  Hash, Award
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const SuperGlobalResultsPage = () => {
  const { token } = useAuth();
  const [results, setResults] = useState([]);
  const [lotteries, setLotteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterLottery, setFilterLottery] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const [formData, setFormData] = useState({
    lottery_id: '',
    draw_date: new Date().toISOString().split('T')[0],
    draw_name: 'Midday',
    winning_numbers: '',
    winning_numbers_parsed: {},
    bonus_number: ''
  });

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resultsRes, lotteriesRes] = await Promise.all([
        axios.get(`${API_URL}/api/super/global-results`, { 
          headers,
          params: { 
            lottery_id: filterLottery || undefined,
            draw_date: filterDate || undefined
          }
        }),
        axios.get(`${API_URL}/api/super/lottery-catalog`, { headers })
      ]);
      setResults(resultsRes.data);
      setLotteries(lotteriesRes.data);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterLottery, filterDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Parse winning numbers into structured format
      const numbers = formData.winning_numbers.split(/[-,\s]+/).filter(n => n);
      const parsed = {};
      if (numbers[0]) parsed.first = numbers[0];
      if (numbers[1]) parsed.second = numbers[1];
      if (numbers[2]) parsed.third = numbers[2];

      const data = {
        ...formData,
        winning_numbers_parsed: parsed
      };

      await axios.post(`${API_URL}/api/super/global-results`, data, { headers });
      toast.success('Résultat enregistré');
      setShowAddModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };

  const handleDelete = async (resultId) => {
    if (!window.confirm('Supprimer ce résultat?')) return;
    try {
      await axios.delete(`${API_URL}/api/super/global-results/${resultId}`, { headers });
      toast.success('Résultat supprimé');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setFormData({
      lottery_id: '',
      draw_date: new Date().toISOString().split('T')[0],
      draw_name: 'Midday',
      winning_numbers: '',
      winning_numbers_parsed: {},
      bonus_number: ''
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl">
              <Trophy className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Résultats Globaux</h1>
              <p className="text-slate-400">{results.length} résultats enregistrés</p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
            data-testid="add-result-btn"
          >
            <Plus className="w-4 h-4" />
            Entrer Résultat
          </button>
        </div>

        {/* Filters */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <select
              value={filterLottery}
              onChange={(e) => setFilterLottery(e.target.value)}
              className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
              data-testid="filter-lottery"
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
              data-testid="filter-date"
            />
            <button
              onClick={() => { setFilterLottery(''); setFilterDate(''); }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              Effacer
            </button>
            <button
              onClick={fetchData}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Results List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
          </div>
        ) : (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full" data-testid="results-table">
              <thead>
                <tr className="text-left text-slate-400 text-sm border-b border-slate-800">
                  <th className="px-6 py-4">Loterie</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Tirage</th>
                  <th className="px-6 py-4">Numéros Gagnants</th>
                  <th className="px-6 py-4">Bonus</th>
                  <th className="px-6 py-4">Entré par</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map(result => (
                  <tr key={result.result_id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{result.lottery_name}</div>
                      <div className="text-slate-400 text-sm">{result.state_code}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-white">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {result.draw_date}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-700 text-slate-300 text-sm rounded">
                        {result.draw_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {result.winning_numbers.split(/[-,\s]+/).filter(n => n).map((num, idx) => (
                          <span
                            key={idx}
                            className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-lg ${
                              idx === 0 ? 'bg-amber-500 text-black' :
                              idx === 1 ? 'bg-slate-400 text-black' :
                              'bg-amber-700 text-white'
                            }`}
                          >
                            {num}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-cyan-400 font-mono">
                      {result.bonus_number || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {result.entered_by_name || 'System'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(result.result_id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        data-testid={`delete-${result.result_id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                      Aucun résultat trouvé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-lg mx-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Award className="w-6 h-6 text-amber-400" />
                  Entrer Résultat
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
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
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Date du tirage</label>
                    <input
                      type="date"
                      value={formData.draw_date}
                      onChange={(e) => setFormData({ ...formData, draw_date: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                      required
                      data-testid="draw-date"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Tirage</label>
                    <select
                      value={formData.draw_name}
                      onChange={(e) => setFormData({ ...formData, draw_name: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                      required
                      data-testid="draw-name"
                    >
                      <option value="Midday">Midday (Midi)</option>
                      <option value="Evening">Evening (Soir)</option>
                      <option value="Night">Night (Nuit)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Numéros Gagnants (séparés par tiret ou virgule)
                  </label>
                  <input
                    type="text"
                    value={formData.winning_numbers}
                    onChange={(e) => setFormData({ ...formData, winning_numbers: e.target.value })}
                    placeholder="Ex: 123-456-789 ou 123,456,789"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    required
                    data-testid="winning-numbers"
                  />
                  <p className="text-slate-500 text-sm mt-1">
                    1er = Or, 2ème = Argent, 3ème = Bronze
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Numéro Bonus (optionnel)
                  </label>
                  <input
                    type="text"
                    value={formData.bonus_number}
                    onChange={(e) => setFormData({ ...formData, bonus_number: e.target.value })}
                    placeholder="Ex: 77"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    data-testid="bonus-number"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                    data-testid="save-result-btn"
                  >
                    <Save className="w-4 h-4" />
                    Enregistrer
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
