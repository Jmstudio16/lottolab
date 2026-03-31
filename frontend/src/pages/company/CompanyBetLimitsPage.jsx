import React, { useState, useEffect } from 'react';
import { Sliders, Save, RefreshCw, AlertCircle, CheckCircle, DollarSign, ToggleLeft, ToggleRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/api/auth';
import { API_URL } from '@/config/api';
import axios from 'axios';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/AdminLayout';

// Types de mise avec leurs configurations par défaut
const BET_TYPES = [
  { 
    id: 'BORLETTE', 
    name: 'Borlette', 
    description: '2 chiffres (00-99)',
    digits: 2,
    defaultMin: 5,
    defaultMax: 5000,
    defaultMaxPerNumber: 10000
  },
  { 
    id: 'LOTO3', 
    name: 'Loto 3', 
    description: '3 chiffres (000-999)',
    digits: 3,
    defaultMin: 5,
    defaultMax: 3000,
    defaultMaxPerNumber: 6000
  },
  { 
    id: 'MARIAGE', 
    name: 'Mariage', 
    description: '2x2 chiffres (XX*XX)',
    digits: 4,
    defaultMin: 10,
    defaultMax: 2000,
    defaultMaxPerNumber: 4000
  },
  { 
    id: 'L4O1', 
    name: 'Loto 4 - Option 1', 
    description: '4 chiffres - 1er lot',
    digits: 4,
    defaultMin: 5,
    defaultMax: 20,
    defaultMaxPerNumber: 100
  },
  { 
    id: 'L4O2', 
    name: 'Loto 4 - Option 2', 
    description: '4 chiffres - 2ème lot',
    digits: 4,
    defaultMin: 5,
    defaultMax: 20,
    defaultMaxPerNumber: 100
  },
  { 
    id: 'L4O3', 
    name: 'Loto 4 - Option 3', 
    description: '4 chiffres - 3ème lot',
    digits: 4,
    defaultMin: 5,
    defaultMax: 20,
    defaultMaxPerNumber: 100
  },
  { 
    id: 'L5O1', 
    name: 'Loto 5 - Extra 1', 
    description: '5 chiffres - Extra 1',
    digits: 5,
    defaultMin: 20,
    defaultMax: 250,
    defaultMaxPerNumber: 500
  },
  { 
    id: 'L5O2', 
    name: 'Loto 5 - Extra 2', 
    description: '5 chiffres - Extra 2',
    digits: 5,
    defaultMin: 20,
    defaultMax: 250,
    defaultMaxPerNumber: 500
  }
];

const CompanyBetLimitsPage = () => {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [limits, setLimits] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchLimits();
  }, [token]);

  const fetchLimits = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/company/bet-type-limits`, { headers });
      
      // Initialize with defaults if no data
      const existingLimits = res.data.limits || {};
      const initialLimits = {};
      
      BET_TYPES.forEach(bt => {
        initialLimits[bt.id] = existingLimits[bt.id] || {
          enabled: true,
          min_bet: bt.defaultMin,
          max_bet: bt.defaultMax,
          max_per_number: bt.defaultMaxPerNumber
        };
      });
      
      setLimits(initialLimits);
    } catch (error) {
      console.error('Error fetching limits:', error);
      // Initialize with defaults
      const initialLimits = {};
      BET_TYPES.forEach(bt => {
        initialLimits[bt.id] = {
          enabled: true,
          min_bet: bt.defaultMin,
          max_bet: bt.defaultMax,
          max_per_number: bt.defaultMaxPerNumber
        };
      });
      setLimits(initialLimits);
    } finally {
      setLoading(false);
    }
  };

  const handleLimitChange = (betType, field, value) => {
    setLimits(prev => ({
      ...prev,
      [betType]: {
        ...prev[betType],
        [field]: field === 'enabled' ? value : parseFloat(value) || 0
      }
    }));
    setHasChanges(true);
  };

  const saveLimits = async () => {
    try {
      setSaving(true);
      await axios.put(`${API_URL}/api/company/bet-type-limits`, { limits }, { headers });
      toast.success('Limites sauvegardées avec succès!');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving limits:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    const defaultLimits = {};
    BET_TYPES.forEach(bt => {
      defaultLimits[bt.id] = {
        enabled: true,
        min_bet: bt.defaultMin,
        max_bet: bt.defaultMax,
        max_per_number: bt.defaultMaxPerNumber
      };
    });
    setLimits(defaultLimits);
    setHasChanges(true);
    toast.info('Limites réinitialisées aux valeurs par défaut');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR').format(amount || 0);
  };

  return (
    <AdminLayout 
      title="Limites Types de Mise" 
      subtitle="Configurez les limites min/max pour chaque type de mise"
    >
      <div className="space-y-6" data-testid="bet-limits-page">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-6 h-6 text-emerald-400" />
            <div>
              <h2 className="text-xl font-bold text-white">Configuration des Limites par Type de Jeu</h2>
              <p className="text-sm text-slate-400">Ces limites s'appliquent à tous vos vendeurs en temps réel</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={resetToDefaults}
              className="border-slate-600"
              data-testid="reset-limits-btn"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Réinitialiser
            </Button>
            <Button 
              onClick={saveLimits}
              disabled={!hasChanges || saving}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="save-limits-btn"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Sauvegarder
            </Button>
          </div>
        </div>

        {/* Info Banner */}
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <p className="text-blue-300 font-medium">Synchronisation en Temps Réel</p>
                <p className="text-sm text-blue-300/80">
                  Les limites configurées ici seront appliquées immédiatement à tous vos vendeurs. 
                  Validation côté frontend ET backend pour empêcher toute fraude.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bet Types Grid */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-slate-400" />
            <p className="text-slate-400 mt-2">Chargement des limites...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BET_TYPES.map(betType => (
              <Card 
                key={betType.id}
                data-testid={`bet-type-card-${betType.id}`}
                className={`border transition-all ${
                  limits[betType.id]?.enabled 
                    ? 'bg-slate-800/50 border-slate-700 hover:border-emerald-500/50' 
                    : 'bg-slate-900/50 border-red-900/50 opacity-70'
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${limits[betType.id]?.enabled ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                        {betType.name}
                      </CardTitle>
                      <CardDescription className="text-slate-400 text-xs">
                        {betType.description}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${limits[betType.id]?.enabled ? 'text-emerald-400' : 'text-red-400'}`}>
                        {limits[betType.id]?.enabled ? 'Actif' : 'Désactivé'}
                      </span>
                      <Switch
                        checked={limits[betType.id]?.enabled ?? true}
                        onCheckedChange={(checked) => handleLimitChange(betType.id, 'enabled', checked)}
                        data-testid={`toggle-${betType.id}`}
                      />
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Min / Max Amount */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        Mise Minimum (HTG)
                      </label>
                      <Input
                        type="number"
                        value={limits[betType.id]?.min_bet || 0}
                        onChange={(e) => handleLimitChange(betType.id, 'min_bet', e.target.value)}
                        className="bg-slate-900/50 border-slate-700 text-white"
                        disabled={!limits[betType.id]?.enabled}
                        min={1}
                        data-testid={`min-bet-${betType.id}`}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        Mise Maximum (HTG)
                      </label>
                      <Input
                        type="number"
                        value={limits[betType.id]?.max_bet || 0}
                        onChange={(e) => handleLimitChange(betType.id, 'max_bet', e.target.value)}
                        className="bg-slate-900/50 border-slate-700 text-white"
                        disabled={!limits[betType.id]?.enabled}
                        min={1}
                        data-testid={`max-bet-${betType.id}`}
                      />
                    </div>
                  </div>

                  {/* Max per Number */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">
                      Maximum par Numéro (HTG)
                    </label>
                    <Input
                      type="number"
                      value={limits[betType.id]?.max_per_number || 0}
                      onChange={(e) => handleLimitChange(betType.id, 'max_per_number', e.target.value)}
                      className="bg-slate-900/50 border-slate-700 text-white"
                      disabled={!limits[betType.id]?.enabled}
                      min={1}
                      data-testid={`max-per-number-${betType.id}`}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Montant total maximum qu'un vendeur peut vendre sur un seul numéro
                    </p>
                  </div>

                  {/* Summary */}
                  {limits[betType.id]?.enabled ? (
                    <div className="pt-2 border-t border-slate-700 bg-emerald-500/5 p-2 rounded-lg">
                      <p className="text-xs text-slate-400">
                        Vendeurs peuvent miser entre{' '}
                        <span className="text-emerald-400 font-bold">{formatCurrency(limits[betType.id]?.min_bet)}</span>
                        {' '}et{' '}
                        <span className="text-emerald-400 font-bold">{formatCurrency(limits[betType.id]?.max_bet)} HTG</span>
                      </p>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-red-900/50 bg-red-500/5 p-2 rounded-lg">
                      <p className="text-xs text-red-400 flex items-center gap-2">
                        <AlertCircle className="w-3 h-3" />
                        Type de jeu désactivé - Les vendeurs ne peuvent pas vendre ce type
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Changes indicator */}
        {hasChanges && (
          <div className="fixed bottom-4 right-4 bg-amber-500/90 text-black px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse z-50">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Modifications non sauvegardées</span>
          </div>
        )}

        {/* Validation Rules Info */}
        <Card className="bg-slate-800/30 border-slate-700">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Règles de Validation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">1.</span>
                Si montant {"<"} min_bet → Vente REFUSÉE
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">2.</span>
                Si montant {">"} max_bet → Vente REFUSÉE
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">3.</span>
                Si total sur numéro {">"} max_per_number → Vente REFUSÉE
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">4.</span>
                Si enabled = false → Type de jeu INVISIBLE pour les vendeurs
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">5.</span>
                Validation Backend OBLIGATOIRE même si Frontend valide
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default CompanyBetLimitsPage;
