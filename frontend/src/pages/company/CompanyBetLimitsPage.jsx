import React, { useState, useEffect } from 'react';
import { Sliders, Save, RefreshCw, AlertCircle, CheckCircle, DollarSign, Percent } from 'lucide-react';
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
    defaultMax: 5000
  },
  { 
    id: 'LOTO3', 
    name: 'Loto 3', 
    description: '3 chiffres (000-999)',
    digits: 3,
    defaultMin: 5,
    defaultMax: 3000
  },
  { 
    id: 'MARIAGE', 
    name: 'Mariage', 
    description: '2x2 chiffres (XX*XX)',
    digits: 4,
    defaultMin: 10,
    defaultMax: 2000
  },
  { 
    id: 'L4O1', 
    name: 'Loto 4 - Option 1', 
    description: '4 chiffres - 1er lot',
    digits: 4,
    defaultMin: 20,
    defaultMax: 1000
  },
  { 
    id: 'L4O2', 
    name: 'Loto 4 - Option 2', 
    description: '4 chiffres - 2ème lot',
    digits: 4,
    defaultMin: 20,
    defaultMax: 1000
  },
  { 
    id: 'L4O3', 
    name: 'Loto 4 - Option 3', 
    description: '4 chiffres - 3ème lot',
    digits: 4,
    defaultMin: 20,
    defaultMax: 1000
  },
  { 
    id: 'L5O1', 
    name: 'Loto 5 - Extra 1', 
    description: '5 chiffres - Extra 1',
    digits: 5,
    defaultMin: 50,
    defaultMax: 500
  },
  { 
    id: 'L5O2', 
    name: 'Loto 5 - Extra 2', 
    description: '5 chiffres - Extra 2',
    digits: 5,
    defaultMin: 50,
    defaultMax: 500
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
      const res = await axios.get(`${API_URL}/api/company/bet-limits`, { headers });
      
      // Initialize with defaults if no data
      const existingLimits = res.data.limits || {};
      const initialLimits = {};
      
      BET_TYPES.forEach(bt => {
        initialLimits[bt.id] = existingLimits[bt.id] || {
          enabled: true,
          min_amount: bt.defaultMin,
          max_amount: bt.defaultMax,
          max_per_number: bt.defaultMax * 2,
          max_per_ticket: bt.defaultMax * 5
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
          min_amount: bt.defaultMin,
          max_amount: bt.defaultMax,
          max_per_number: bt.defaultMax * 2,
          max_per_ticket: bt.defaultMax * 5
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
      await axios.put(`${API_URL}/api/company/bet-limits`, { limits }, { headers });
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
        min_amount: bt.defaultMin,
        max_amount: bt.defaultMax,
        max_per_number: bt.defaultMax * 2,
        max_per_ticket: bt.defaultMax * 5
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
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-6 h-6 text-emerald-400" />
            <div>
              <h2 className="text-xl font-bold text-white">Configuration des Limites</h2>
              <p className="text-sm text-slate-400">Ces limites s'appliquent à tous vos vendeurs</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={resetToDefaults}
              className="border-slate-600"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Réinitialiser
            </Button>
            <Button 
              onClick={saveLimits}
              disabled={!hasChanges || saving}
              className="bg-emerald-600 hover:bg-emerald-700"
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
                <p className="text-blue-300 font-medium">Information</p>
                <p className="text-sm text-blue-300/80">
                  Les limites configurées ici seront automatiquement appliquées à tous les vendeurs de votre compagnie.
                  Quand un vendeur essaie de vendre un montant hors des limites, la vente sera refusée.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bet Types Grid */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-slate-400" />
            <p className="text-slate-400 mt-2">Chargement...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BET_TYPES.map(betType => (
              <Card 
                key={betType.id}
                className={`border transition-all ${
                  limits[betType.id]?.enabled 
                    ? 'bg-slate-800/50 border-slate-700 hover:border-emerald-500/50' 
                    : 'bg-slate-900/50 border-slate-800 opacity-60'
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${limits[betType.id]?.enabled ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
                        {betType.name}
                      </CardTitle>
                      <CardDescription className="text-slate-400 text-xs">
                        {betType.description}
                      </CardDescription>
                    </div>
                    <Switch
                      checked={limits[betType.id]?.enabled ?? true}
                      onCheckedChange={(checked) => handleLimitChange(betType.id, 'enabled', checked)}
                    />
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Min / Max Amount */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Mise Minimum (HTG)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          type="number"
                          value={limits[betType.id]?.min_amount || 0}
                          onChange={(e) => handleLimitChange(betType.id, 'min_amount', e.target.value)}
                          className="pl-8 bg-slate-900/50 border-slate-700 text-white"
                          disabled={!limits[betType.id]?.enabled}
                          min={1}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Mise Maximum (HTG)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          type="number"
                          value={limits[betType.id]?.max_amount || 0}
                          onChange={(e) => handleLimitChange(betType.id, 'max_amount', e.target.value)}
                          className="pl-8 bg-slate-900/50 border-slate-700 text-white"
                          disabled={!limits[betType.id]?.enabled}
                          min={1}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Max per Number / Max per Ticket */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Max par Numéro (HTG)</label>
                      <Input
                        type="number"
                        value={limits[betType.id]?.max_per_number || 0}
                        onChange={(e) => handleLimitChange(betType.id, 'max_per_number', e.target.value)}
                        className="bg-slate-900/50 border-slate-700 text-white"
                        disabled={!limits[betType.id]?.enabled}
                        min={1}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Max par Ticket (HTG)</label>
                      <Input
                        type="number"
                        value={limits[betType.id]?.max_per_ticket || 0}
                        onChange={(e) => handleLimitChange(betType.id, 'max_per_ticket', e.target.value)}
                        className="bg-slate-900/50 border-slate-700 text-white"
                        disabled={!limits[betType.id]?.enabled}
                        min={1}
                      />
                    </div>
                  </div>

                  {/* Summary */}
                  {limits[betType.id]?.enabled && (
                    <div className="pt-2 border-t border-slate-700">
                      <p className="text-xs text-slate-500">
                        Vendeurs peuvent miser entre{' '}
                        <span className="text-emerald-400 font-medium">{formatCurrency(limits[betType.id]?.min_amount)}</span>
                        {' '}et{' '}
                        <span className="text-emerald-400 font-medium">{formatCurrency(limits[betType.id]?.max_amount)} HTG</span>
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
          <div className="fixed bottom-4 right-4 bg-amber-500/90 text-black px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Modifications non sauvegardées</span>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default CompanyBetLimitsPage;
