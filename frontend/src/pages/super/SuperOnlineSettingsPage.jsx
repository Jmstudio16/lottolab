import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/api/auth';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Settings, Save, Loader2, Palette, Phone, 
  Mail, Globe, Gamepad2, Shield, RefreshCw
} from 'lucide-react';

const SuperOnlineSettingsPage = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/online-admin/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/online-admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        toast.success('Paramètres enregistrés!');
      } else {
        toast.error('Erreur lors de l\'enregistrement');
      }
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Settings className="w-6 h-6 text-slate-400" />
              {t('admin.brandingSettings')}
            </h1>
            <p className="text-slate-400">Configurez la plateforme LOTO PAM</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadSettings}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Button
              onClick={saveSettings}
              disabled={saving}
              className="bg-yellow-500 hover:bg-yellow-600 text-slate-900"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Enregistrer
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Branding */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Palette className="w-5 h-5 text-yellow-400" />
              Branding
            </h2>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Nom de la Plateforme</label>
              <Input
                type="text"
                value={settings?.platform_name || ''}
                onChange={(e) => updateField('platform_name', e.target.value)}
                className="bg-slate-900 border-slate-600 text-white"
                placeholder="LOTO PAM"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">URL du Logo</label>
              <Input
                type="url"
                value={settings?.logo_url || ''}
                onChange={(e) => updateField('logo_url', e.target.value)}
                className="bg-slate-900 border-slate-600 text-white"
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Couleur Primaire</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings?.primary_color || '#FFD700'}
                    onChange={(e) => updateField('primary_color', e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={settings?.primary_color || '#FFD700'}
                    onChange={(e) => updateField('primary_color', e.target.value)}
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Couleur Secondaire</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings?.secondary_color || '#1a1a2e'}
                    onChange={(e) => updateField('secondary_color', e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={settings?.secondary_color || '#1a1a2e'}
                    onChange={(e) => updateField('secondary_color', e.target.value)}
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contact & Payment */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Phone className="w-5 h-5 text-green-400" />
              Contact & Paiement
            </h2>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email de Contact</label>
              <Input
                type="email"
                value={settings?.contact_email || ''}
                onChange={(e) => updateField('contact_email', e.target.value)}
                className="bg-slate-900 border-slate-600 text-white"
                placeholder="support@lotopam.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Téléphone de Contact</label>
              <Input
                type="tel"
                value={settings?.contact_phone || ''}
                onChange={(e) => updateField('contact_phone', e.target.value)}
                className="bg-slate-900 border-slate-600 text-white"
                placeholder="+509 XXXX XXXX"
              />
            </div>

            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <h3 className="font-bold text-yellow-400 mb-3">Numéros de Paiement</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">MonCash</label>
                  <Input
                    type="tel"
                    value={settings?.moncash_number || ''}
                    onChange={(e) => updateField('moncash_number', e.target.value)}
                    className="bg-slate-900 border-slate-600 text-white"
                    placeholder="+509 44 77 90 43"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">NatCash</label>
                  <Input
                    type="tel"
                    value={settings?.natcash_number || ''}
                    onChange={(e) => updateField('natcash_number', e.target.value)}
                    className="bg-slate-900 border-slate-600 text-white"
                    placeholder="+509 33 45 30 59"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Games Configuration */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-purple-400" />
              {t('admin.gamesConfig')}
            </h2>

            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎰</span>
                  <span className="text-white font-medium">Loterie</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings?.lottery_enabled ?? true}
                  onChange={(e) => updateField('lottery_enabled', e.target.checked)}
                  className="w-5 h-5 rounded accent-yellow-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎯</span>
                  <span className="text-white font-medium">Keno</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings?.keno_enabled ?? true}
                  onChange={(e) => updateField('keno_enabled', e.target.checked)}
                  className="w-5 h-5 rounded accent-yellow-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎫</span>
                  <span className="text-white font-medium">Raffle (Tombola)</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings?.raffle_enabled ?? true}
                  onChange={(e) => updateField('raffle_enabled', e.target.checked)}
                  className="w-5 h-5 rounded accent-yellow-500"
                />
              </label>
            </div>
          </div>

          {/* Maintenance Mode */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-400" />
              Mode Maintenance
            </h2>

            <label className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/30 rounded-lg cursor-pointer">
              <div>
                <p className="text-white font-medium">Activer le Mode Maintenance</p>
                <p className="text-sm text-slate-400">La plateforme sera inaccessible aux joueurs</p>
              </div>
              <input
                type="checkbox"
                checked={settings?.maintenance_mode ?? false}
                onChange={(e) => updateField('maintenance_mode', e.target.checked)}
                className="w-5 h-5 rounded accent-red-500"
              />
            </label>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Conditions d'Utilisation</label>
              <textarea
                value={settings?.terms_content || ''}
                onChange={(e) => updateField('terms_content', e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white resize-none"
                rows={4}
                placeholder="Contenu des conditions d'utilisation..."
              />
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SuperOnlineSettingsPage;
