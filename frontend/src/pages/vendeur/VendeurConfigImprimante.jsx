import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Settings, Printer, Save, RefreshCw, TestTube, CheckCircle,
  AlertCircle, Ruler, Type, Copy, Scissors, DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import PrinterSelector from '@/components/PrinterSelector';
import printerService, { 
  getPrinterSettings, 
  updatePrinterSettings,
  testPrint,
  DEFAULT_PRINTER_SETTINGS
} from '@/services/PrinterService';

/**
 * VendeurConfigImprimante - Printer settings page for vendors
 */
const VendeurConfigImprimante = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(DEFAULT_PRINTER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      await printerService.initialize();
      const currentSettings = getPrinterSettings();
      setSettings(currentSettings);
    } catch (error) {
      console.error('Error loading printer settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      updatePrinterSettings(settings);
      toast.success('Paramètres sauvegardés');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = async () => {
    setTesting(true);
    try {
      await testPrint();
      toast.success('Test d\'impression envoyé');
    } catch (error) {
      toast.error('Échec du test d\'impression');
    } finally {
      setTesting(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Réinitialiser tous les paramètres ?')) {
      setSettings(DEFAULT_PRINTER_SETTINGS);
      updatePrinterSettings(DEFAULT_PRINTER_SETTINGS);
      toast.success('Paramètres réinitialisés');
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
            <Settings className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" />
            Configuration Imprimante
          </h1>
          <p className="text-sm text-slate-400">Paramètres d'impression POS / Android</p>
        </div>
        <Button
          onClick={handleTestPrint}
          variant="outline"
          disabled={testing}
          className="border-blue-700 text-blue-400 hover:bg-blue-500/10"
        >
          {testing ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <TestTube className="w-4 h-4 mr-2" />
          )}
          Test
        </Button>
      </div>

      {/* Printer Selection */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
        <PrinterSelector showSettings />
      </div>

      {/* Print Settings */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Printer className="w-5 h-5 text-blue-400" />
          Paramètres d'impression
        </h2>

        {/* Paper Width */}
        <div className="space-y-2">
          <label className="text-sm text-slate-400 flex items-center gap-2">
            <Ruler className="w-4 h-4" />
            Largeur du papier
          </label>
          <div className="flex gap-3">
            {['58mm', '80mm'].map((width) => (
              <button
                key={width}
                onClick={() => setSettings({ ...settings, paperWidth: width })}
                className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                  settings.paperWidth === width
                    ? 'border-blue-500 bg-blue-500/20 text-white'
                    : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="text-lg font-bold">{width}</span>
                <p className="text-xs text-slate-400 mt-1">
                  {width === '58mm' ? 'Portable' : 'Standard POS'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Font Size */}
        <div className="space-y-2">
          <label className="text-sm text-slate-400 flex items-center gap-2">
            <Type className="w-4 h-4" />
            Taille de police
          </label>
          <div className="flex gap-2">
            {[
              { value: 'small', label: 'Petit' },
              { value: 'normal', label: 'Normal' },
              { value: 'large', label: 'Grand' }
            ].map((size) => (
              <button
                key={size.value}
                onClick={() => setSettings({ ...settings, fontSize: size.value })}
                className={`flex-1 p-2 rounded-lg border transition-all ${
                  settings.fontSize === size.value
                    ? 'border-blue-500 bg-blue-500/20 text-white'
                    : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>

        {/* Copies */}
        <div className="space-y-2">
          <label className="text-sm text-slate-400 flex items-center gap-2">
            <Copy className="w-4 h-4" />
            Nombre de copies
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSettings({ ...settings, copies: Math.max(1, settings.copies - 1) })}
              className="w-10 h-10 rounded-lg bg-slate-700 text-white hover:bg-slate-600 text-xl font-bold"
            >
              -
            </button>
            <span className="text-2xl font-bold text-white w-12 text-center">{settings.copies}</span>
            <button
              onClick={() => setSettings({ ...settings, copies: Math.min(5, settings.copies + 1) })}
              className="w-10 h-10 rounded-lg bg-slate-700 text-white hover:bg-slate-600 text-xl font-bold"
            >
              +
            </button>
          </div>
        </div>

        {/* Toggle Options */}
        <div className="space-y-4">
          {/* Auto Print */}
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Printer className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-white font-medium">Impression automatique</p>
                <p className="text-xs text-slate-400">Imprimer après validation du ticket</p>
              </div>
            </div>
            <Switch
              checked={settings.autoPrint}
              onCheckedChange={(checked) => setSettings({ ...settings, autoPrint: checked })}
            />
          </div>

          {/* Cut Paper */}
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Scissors className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-white font-medium">Coupe automatique</p>
                <p className="text-xs text-slate-400">Couper le papier après impression</p>
              </div>
            </div>
            <Switch
              checked={settings.cutPaper}
              onCheckedChange={(checked) => setSettings({ ...settings, cutPaper: checked })}
            />
          </div>

          {/* Open Drawer */}
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-white font-medium">Ouvrir tiroir-caisse</p>
                <p className="text-xs text-slate-400">Ouvrir le tiroir après impression</p>
              </div>
            </div>
            <Switch
              checked={settings.openDrawer}
              onCheckedChange={(checked) => setSettings({ ...settings, openDrawer: checked })}
            />
          </div>

          {/* Print Logo */}
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-white font-medium">Imprimer le logo</p>
                <p className="text-xs text-slate-400">Afficher le logo de l'entreprise</p>
              </div>
            </div>
            <Switch
              checked={settings.printLogo}
              onCheckedChange={(checked) => setSettings({ ...settings, printLogo: checked })}
            />
          </div>

          {/* Print QR Code */}
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="text-white font-medium">Imprimer QR Code</p>
                <p className="text-xs text-slate-400">Code QR pour vérification</p>
              </div>
            </div>
            <Switch
              checked={settings.printQRCode}
              onCheckedChange={(checked) => setSettings({ ...settings, printQRCode: checked })}
            />
          </div>

          {/* Dark Mode */}
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Type className="w-5 h-5 text-white" />
              <div>
                <p className="text-white font-medium">Mode noir intense</p>
                <p className="text-xs text-slate-400">Impression plus foncée (thermique)</p>
              </div>
            </div>
            <Switch
              checked={settings.darkMode}
              onCheckedChange={(checked) => setSettings({ ...settings, darkMode: checked })}
            />
          </div>
        </div>

        {/* Margins */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Marge haute (mm)</label>
            <input
              type="number"
              value={settings.marginTop}
              onChange={(e) => setSettings({ ...settings, marginTop: parseInt(e.target.value) || 0 })}
              min="0"
              max="20"
              className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Marge basse (mm)</label>
            <input
              type="number"
              value={settings.marginBottom}
              onChange={(e) => setSettings({ ...settings, marginBottom: parseInt(e.target.value) || 0 })}
              min="0"
              max="20"
              className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleReset}
          variant="outline"
          className="flex-1 border-slate-600"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Réinitialiser
        </Button>
        <Button
          onClick={handleSave}
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
    </div>
  );
};

export default VendeurConfigImprimante;
