import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import { AdminLayout } from '@/components/AdminLayout';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Trophy, Plus, Edit2, Trash2, Save, X, Filter, RefreshCw, Calendar,
  Hash, Award, Search, Clock, MapPin, CheckCircle, AlertCircle, Globe
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// US States with lottery info
const US_STATES = [
  { code: 'GA', name: 'Georgia', flag: '🍑' },
  { code: 'FL', name: 'Florida', flag: '🌴' },
  { code: 'NY', name: 'New York', flag: '🗽' },
  { code: 'TX', name: 'Texas', flag: '⭐' },
  { code: 'TN', name: 'Tennessee', flag: '🎸' },
  { code: 'CA', name: 'California', flag: '🌞' },
  { code: 'IL', name: 'Illinois', flag: '🌽' },
  { code: 'PA', name: 'Pennsylvania', flag: '🔔' },
  { code: 'OH', name: 'Ohio', flag: '🏈' },
  { code: 'MI', name: 'Michigan', flag: '🚗' },
  { code: 'NC', name: 'North Carolina', flag: '🐝' },
  { code: 'VA', name: 'Virginia', flag: '🏛️' },
  { code: 'AZ', name: 'Arizona', flag: '🌵' },
  { code: 'MA', name: 'Massachusetts', flag: '📚' },
  { code: 'MD', name: 'Maryland', flag: '🦀' },
  { code: 'IN', name: 'Indiana', flag: '🏎️' },
  { code: 'WA', name: 'Washington', flag: '🍎' },
  { code: 'CO', name: 'Colorado', flag: '⛰️' },
  { code: 'WI', name: 'Wisconsin', flag: '🧀' },
  { code: 'MN', name: 'Minnesota', flag: '❄️' },
  { code: 'MO', name: 'Missouri', flag: '🌉' },
  { code: 'SC', name: 'South Carolina', flag: '🌙' },
  { code: 'AL', name: 'Alabama', flag: '🌺' },
  { code: 'LA', name: 'Louisiana', flag: '⚜️' },
  { code: 'KY', name: 'Kentucky', flag: '🐎' },
  { code: 'OR', name: 'Oregon', flag: '🌲' },
  { code: 'CT', name: 'Connecticut', flag: '🎃' },
  { code: 'IA', name: 'Iowa', flag: '🌾' },
  { code: 'KS', name: 'Kansas', flag: '🌻' },
  { code: 'AR', name: 'Arkansas', flag: '💎' },
  { code: 'MS', name: 'Mississippi', flag: '🛶' },
  { code: 'NV', name: 'Nevada', flag: '🎰' },
  { code: 'MT', name: 'Montana', flag: '🦌' },
  { code: 'ID', name: 'Idaho', flag: '🥔' },
  { code: 'ME', name: 'Maine', flag: '🦞' },
  { code: 'NH', name: 'New Hampshire', flag: '🏔️' },
  { code: 'RI', name: 'Rhode Island', flag: '⚓' },
  { code: 'DE', name: 'Delaware', flag: '🦃' },
  { code: 'SD', name: 'South Dakota', flag: '🗿' },
  { code: 'ND', name: 'North Dakota', flag: '🦬' },
  { code: 'WV', name: 'West Virginia', flag: '⛏️' },
  { code: 'WY', name: 'Wyoming', flag: '🤠' },
  { code: 'UT', name: 'Utah', flag: '🏜️' },
  { code: 'NM', name: 'New Mexico', flag: '🌶️' },
  { code: 'NE', name: 'Nebraska', flag: '🌽' },
  { code: 'OK', name: 'Oklahoma', flag: '🪶' },
  { code: 'VT', name: 'Vermont', flag: '🍁' },
  { code: 'AK', name: 'Alaska', flag: '🐻' },
  { code: 'HI', name: 'Hawaii', flag: '🌺' },
  { code: 'NJ', name: 'New Jersey', flag: '🎡' }
];

const DRAW_TYPES = ['Morning', 'Midday', 'Evening', 'Night'];

export const SuperResultManagementPage = () => {
  const { token } = useAuth();
  const [results, setResults] = useState([]);
  const [lotteries, setLotteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  
  // Filters
  const [filterLottery, setFilterLottery] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    lottery_id: '',
    draw_date: new Date().toISOString().split('T')[0],
    draw_name: 'Midday',
    winning_numbers: '',
    bonus_number: '',
    jackpot_amount: '',
    notes: ''
  });

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterLottery) params.lottery_id = filterLottery;
      if (filterDate) params.draw_date = filterDate;

      const [resultsRes, lotteriesRes] = await Promise.all([
        axios.get(`${API_URL}/api/results`, { headers, params }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/results/lotteries`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setResults(resultsRes.data || []);
      setLotteries(lotteriesRes.data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [token, filterLottery, filterDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData({
      lottery_id: '',
      draw_date: new Date().toISOString().split('T')[0],
      draw_name: 'Midday',
      winning_numbers: '',
      bonus_number: '',
      jackpot_amount: '',
      notes: ''
    });
    setEditMode(false);
    setSelectedResult(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (result) => {
    setSelectedResult(result);
    setFormData({
      lottery_id: result.lottery_id,
      draw_date: result.draw_date,
      draw_name: result.draw_name,
      winning_numbers: typeof result.winning_numbers === 'object'
        ? Object.values(result.winning_numbers).filter(Boolean).join('-')
        : result.winning_numbers,
      bonus_number: result.bonus_number || '',
      jackpot_amount: result.jackpot_amount || '',
      notes: result.notes || ''
    });
    setEditMode(true);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.lottery_id || !formData.winning_numbers) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      // Parse winning numbers into structured format
      const numbers = formData.winning_numbers.split(/[-,\s]+/).filter(n => n.trim());
      const parsed = {};
      if (numbers[0]) parsed.first = numbers[0].trim();
      if (numbers[1]) parsed.second = numbers[1].trim();
      if (numbers[2]) parsed.third = numbers[2].trim();

      if (editMode && selectedResult) {
        // Update existing result via legacy endpoint
        const data = {
          lottery_id: formData.lottery_id,
          draw_date: formData.draw_date,
          draw_name: formData.draw_name,
          winning_numbers: formData.winning_numbers,
          winning_numbers_parsed: parsed,
          bonus_number: formData.bonus_number || null,
          jackpot_amount: formData.jackpot_amount ? parseFloat(formData.jackpot_amount) : null,
          notes: formData.notes || null
        };
        await axios.put(
          `${API_URL}/api/super/global-results/${selectedResult.result_id}`,
          data,
          { headers }
        );
        toast.success('Résultat mis à jour avec succès!');
      } else {
        // Publish NEW result via the new results API with automatic winner detection
        const publishData = {
          lottery_id: formData.lottery_id,
          draw_date: formData.draw_date,
          draw_name: formData.draw_name,
          winning_numbers: parsed,
          official_source: formData.notes || 'Manual Entry',
          notes: formData.notes || null
        };
        
        const response = await axios.post(`${API_URL}/api/results/publish`, publishData, { headers });
        
        // Show detailed success message with winner info
        const { winners_count, losers_count, total_payouts, tickets_processed } = response.data;
        if (tickets_processed > 0) {
          toast.success(
            `Résultat publié! ${tickets_processed} tickets traités: ${winners_count} gagnant(s), ${losers_count} perdant(s). Total gains: ${total_payouts?.toLocaleString() || 0} HTG`,
            { duration: 6000 }
          );
        } else {
          toast.success('Résultat publié avec succès! Aucun ticket en attente pour ce tirage.');
        }
      }
      
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'enregistrement');
    }
  };

  const handleDelete = async (resultId, lotteryName) => {
    if (!window.confirm(`Supprimer le résultat de ${lotteryName}?`)) return;
    try {
      await axios.delete(`${API_URL}/api/super/global-results/${resultId}`, { headers });
      toast.success('Résultat supprimé');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  // Filter results
  const filteredResults = results.filter(r => {
    // Convert winning_numbers to string for search
    let wnStr = '';
    if (typeof r.winning_numbers === 'object') {
      wnStr = Object.values(r.winning_numbers).filter(Boolean).join('-');
    } else if (r.winning_numbers) {
      wnStr = String(r.winning_numbers);
    }
    
    const matchesSearch = 
      (r.lottery_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.state_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      wnStr.includes(searchTerm);
    const matchesState = !filterState || r.state_code === filterState;
    return matchesSearch && matchesState;
  });

  // Group results by date for better display
  const groupedByDate = filteredResults.reduce((acc, result) => {
    const date = result.draw_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(result);
    return acc;
  }, {});

  const getLotteryLogo = (lottery) => {
    const state = US_STATES.find(s => s.code === lottery?.state_code);
    return state?.flag || '🎱';
  };

  const getSelectedLottery = () => {
    return lotteries.find(l => l.lottery_id === formData.lottery_id);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Helper to parse winning numbers from either string or object format
  const getWinningNumbersArray = (result) => {
    const wn = result.winning_numbers;
    if (!wn) return [];
    
    // If it's an object (from new API)
    if (typeof wn === 'object' && !Array.isArray(wn)) {
      const nums = [];
      if (wn.first) nums.push(wn.first);
      if (wn.second) nums.push(wn.second);
      if (wn.third) nums.push(wn.third);
      if (wn.borlette && wn.borlette !== wn.first) nums.push(wn.borlette);
      return nums;
    }
    
    // If it's a string (from legacy API)
    if (typeof wn === 'string') {
      return wn.split(/[-,\s]+/).filter(n => n.trim());
    }
    
    return [];
  };

  return (
    <AdminLayout role="SUPER_ADMIN">
      <div className="space-y-6" data-testid="result-management-page">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                LOTTERY RESULT MANAGEMENT
              </h1>
              <p className="text-slate-400">SUPER ADMIN - Publication officielle des résultats</p>
            </div>
          </div>
          <Button
            onClick={openAddModal}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg"
            data-testid="publish-result-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            PUBLIER UN RÉSULTAT
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-400" />
              <div>
                <p className="text-2xl font-bold text-white">{results.length}</p>
                <p className="text-sm text-slate-400">Résultats Publiés</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Globe className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-white">{lotteries.length}</p>
                <p className="text-sm text-slate-400">Loteries Actives</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Award className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-white">
                  {results.reduce((sum, r) => sum + (r.winners_count || 0), 0)}
                </p>
                <p className="text-sm text-slate-400">Tickets Gagnants</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Hash className="w-8 h-8 text-purple-400" />
              <div>
                <p className="text-2xl font-bold text-white">
                  {results.reduce((sum, r) => sum + (r.tickets_processed || 0), 0)}
                </p>
                <p className="text-sm text-slate-400">Tickets Traités</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-cyan-400" />
              <div>
                <p className="text-2xl font-bold text-white">
                  {results.filter(r => r.draw_date === new Date().toISOString().split('T')[0]).length}
                </p>
                <p className="text-sm text-slate-400">Aujourd'hui</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Rechercher par loterie, état ou numéros..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-900 border-slate-600 text-white"
              />
            </div>
            <Select value={filterState} onValueChange={setFilterState}>
              <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Tous les États" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 max-h-[300px]">
                <SelectItem value="all">Tous les États</SelectItem>
                {US_STATES.map(state => (
                  <SelectItem key={state.code} value={state.code}>
                    {state.flag} {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-slate-900 border-slate-600 text-white"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { 
                  setFilterLottery(''); 
                  setFilterState(''); 
                  setFilterDate(''); 
                  setSearchTerm('');
                }}
                className="flex-1 border-slate-600"
              >
                Effacer
              </Button>
              <Button
                variant="outline"
                onClick={fetchData}
                className="border-slate-600"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Results List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
          </div>
        ) : Object.keys(groupedByDate).length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
            <AlertCircle className="w-16 h-16 mx-auto text-slate-500 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Aucun résultat trouvé</h3>
            <p className="text-slate-400 mb-6">Commencez par publier votre premier résultat de loterie</p>
            <Button onClick={openAddModal} className="bg-amber-500 hover:bg-amber-600">
              <Plus className="w-4 h-4 mr-2" />
              Publier un résultat
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByDate)
              .sort(([a], [b]) => new Date(b) - new Date(a))
              .map(([date, dateResults]) => (
                <div key={date} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="bg-slate-900/50 px-6 py-3 border-b border-slate-700 flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-amber-400" />
                    <h3 className="text-lg font-semibold text-white capitalize">
                      {formatDate(date)}
                    </h3>
                    <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                      {dateResults.length} résultat(s)
                    </span>
                  </div>
                  
                  <div className="divide-y divide-slate-700/50">
                    {dateResults.map(result => {
                      const lottery = lotteries.find(l => l.lottery_id === result.lottery_id);
                      const state = US_STATES.find(s => s.code === result.state_code);
                      
                      return (
                        <div 
                          key={result.result_id} 
                          className="p-4 hover:bg-slate-700/20 transition-colors"
                          data-testid={`result-row-${result.result_id}`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            {/* Lottery Info */}
                            <div className="flex items-center gap-4 min-w-[250px]">
                              <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center text-2xl">
                                {state?.flag || '🎱'}
                              </div>
                              <div>
                                <h4 className="font-semibold text-white">{result.lottery_name}</h4>
                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                  <MapPin className="w-3 h-3" />
                                  {state?.name || result.state_code}
                                </div>
                              </div>
                            </div>

                            {/* Draw Type */}
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-slate-400" />
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                result.draw_name === 'Morning' ? 'bg-orange-500/20 text-orange-400' :
                                result.draw_name === 'Midday' ? 'bg-yellow-500/20 text-yellow-400' :
                                result.draw_name === 'Evening' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-purple-500/20 text-purple-400'
                              }`}>
                                {result.draw_name}
                              </span>
                            </div>

                            {/* Winning Numbers */}
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 text-sm mr-2">Numéros:</span>
                              {getWinningNumbersArray(result).map((num, idx) => (
                                <div
                                  key={idx}
                                  className={`w-11 h-11 flex items-center justify-center rounded-full font-bold text-lg shadow-lg ${
                                    idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black' :
                                    idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-black' :
                                    'bg-gradient-to-br from-amber-600 to-amber-800 text-white'
                                  }`}
                                >
                                  {num}
                                </div>
                              ))}
                              {result.bonus_number && (
                                <div className="w-11 h-11 flex items-center justify-center rounded-full font-bold text-lg bg-gradient-to-br from-cyan-400 to-cyan-600 text-black shadow-lg ml-2">
                                  {result.bonus_number}
                                </div>
                              )}
                            </div>

                            {/* Verification Badge */}
                            <div className="flex items-center gap-2">
                              {result.winners_processed ? (
                                <>
                                  <CheckCircle className="w-5 h-5 text-green-400" />
                                  <span className="text-sm text-green-400">
                                    {result.winners_count > 0 
                                      ? `${result.winners_count} gagnant(s)` 
                                      : 'Traité'}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-5 h-5 text-amber-400" />
                                  <span className="text-sm text-amber-400">En attente</span>
                                </>
                              )}
                            </div>

                            {/* Winner Stats (if available) */}
                            {result.tickets_processed > 0 && (
                              <div className="flex items-center gap-3 text-xs">
                                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                                  {result.tickets_processed} traités
                                </span>
                                {result.total_payouts > 0 && (
                                  <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">
                                    {result.total_payouts?.toLocaleString()} HTG
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditModal(result)}
                                className="border-slate-600 hover:bg-slate-700"
                                data-testid={`edit-${result.result_id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(result.result_id, result.lottery_name)}
                                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                                data-testid={`delete-${result.result_id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Add/Edit Result Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Trophy className="w-6 h-6 text-amber-400" />
                </div>
                {editMode ? 'Modifier le Résultat' : 'Publier un Nouveau Résultat'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {/* Lottery Selector */}
              <div className="space-y-2">
                <Label className="text-slate-300">Loterie *</Label>
                <Select 
                  value={formData.lottery_id} 
                  onValueChange={(v) => setFormData({...formData, lottery_id: v})}
                >
                  <SelectTrigger className="bg-slate-900 border-slate-600 text-white h-12">
                    <SelectValue placeholder="Sélectionner une loterie">
                      {formData.lottery_id && (
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getLotteryLogo(getSelectedLottery())}</span>
                          <span>{getSelectedLottery()?.lottery_name}</span>
                          <span className="text-slate-400">- {getSelectedLottery()?.state_code}</span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 max-h-[300px]">
                    {lotteries.map(lottery => {
                      const state = US_STATES.find(s => s.code === lottery.state_code);
                      return (
                        <SelectItem key={lottery.lottery_id} value={lottery.lottery_id}>
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{state?.flag || '🎱'}</span>
                            <span>{lottery.lottery_name}</span>
                            <span className="text-slate-400">- {state?.name || lottery.state_code}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Date and Draw Type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Date du Tirage *</Label>
                  <Input
                    type="date"
                    value={formData.draw_date}
                    onChange={(e) => setFormData({...formData, draw_date: e.target.value})}
                    className="bg-slate-900 border-slate-600 text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Type de Tirage *</Label>
                  <Select 
                    value={formData.draw_name} 
                    onValueChange={(v) => setFormData({...formData, draw_name: v})}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {DRAW_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Winning Numbers */}
              <div className="space-y-2">
                <Label className="text-slate-300">Numéros Gagnants *</Label>
                <Input
                  value={formData.winning_numbers}
                  onChange={(e) => setFormData({...formData, winning_numbers: e.target.value})}
                  placeholder="Ex: 123-456-789 ou 123, 456, 789"
                  className="bg-slate-900 border-slate-600 text-white text-lg font-mono"
                  required
                />
                <p className="text-xs text-slate-500">Séparez les numéros par - , ou espace</p>
              </div>

              {/* Preview */}
              {formData.winning_numbers && (
                <div className="bg-slate-900/50 p-4 rounded-lg">
                  <p className="text-sm text-slate-400 mb-2">Aperçu:</p>
                  <div className="flex items-center gap-2">
                    {formData.winning_numbers.split(/[-,\s]+/).filter(n => n.trim()).map((num, idx) => (
                      <div
                        key={idx}
                        className={`w-12 h-12 flex items-center justify-center rounded-full font-bold text-lg ${
                          idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black' :
                          idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-black' :
                          'bg-gradient-to-br from-amber-600 to-amber-800 text-white'
                        }`}
                      >
                        {num.trim()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bonus Number */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Numéro Bonus (optionnel)</Label>
                  <Input
                    value={formData.bonus_number}
                    onChange={(e) => setFormData({...formData, bonus_number: e.target.value})}
                    placeholder="Ex: 42"
                    className="bg-slate-900 border-slate-600 text-white font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Jackpot (optionnel)</Label>
                  <Input
                    type="number"
                    value={formData.jackpot_amount}
                    onChange={(e) => setFormData({...formData, jackpot_amount: e.target.value})}
                    placeholder="Ex: 1000000"
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-slate-300">Notes (optionnel)</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Informations supplémentaires..."
                  className="bg-slate-900 border-slate-600 text-white"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border-slate-600"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                  data-testid="submit-result-btn"
                >
                  {editMode ? (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Mettre à Jour
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      PUBLIER
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default SuperResultManagementPage;
