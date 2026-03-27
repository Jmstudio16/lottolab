import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Settings, Printer, Save, RefreshCw, TestTube, CheckCircle, Wifi,
  AlertCircle, Ruler, Type, Copy, Scissors, DollarSign, Bluetooth,
  Usb, Monitor, Smartphone, Zap, List, FileText, QrCode, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import PrinterSelector from '@/components/PrinterSelector';
import printerService, { 
  getPrinterSettings, 
  updatePrinterSettings,
  testPrint,
  DEFAULT_PRINTER_SETTINGS,
  detectPrinters,
  getPrinters,
  PRINTER_STATUS
} from '@/services/PrinterService';

/**
 * CompanyPrinterConfigPage - ULTRA PRO Printer Configuration
 * Full professional configuration for Company Admin
 */
const CompanyPrinterConfigPage = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(DEFAULT_PRINTER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [activeTab, setActiveTab] = useState('printers');

  useEffect(() => {
    loadSettings();
    loadPrinters();
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

  const loadPrinters = async () => {
    const detected = getPrinters();
    setPrinters(detected);
  };

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const detected = await detectPrinters();
      setPrinters(detected.filter(p => !p.isSearchOption));
      toast.success(`${detected.length} imprimante(s) détectée(s)`);
    } catch (error) {
      toast.error('Erreur lors de la détection');
    } finally {
      setDetecting(false);
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

  const getStatusColor = (status) => {
    switch (status) {
      case PRINTER_STATUS.CONNECTED: return 'text-emerald-400';
      case PRINTER_STATUS.DISCONNECTED: return 'text-red-400';
      case PRINTER_STATUS.CONNECTING: return 'text-amber-400';
      default: return 'text-slate-400';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case PRINTER_STATUS.CONNECTED: return 'Connecté';
      case PRINTER_STATUS.DISCONNECTED: return 'Déconnecté';
      case PRINTER_STATUS.CONNECTING: return 'Connexion...';
      default: return 'Inconnu';
    }
  };

  const getPrinterIcon = (type) => {
    switch (type) {
      case 'bluetooth': return <Bluetooth className="w-5 h-5 text-blue-400" />;
      case 'usb': return <Usb className="w-5 h-5 text-green-400" />;
      case 'network': return <Wifi className="w-5 h-5 text-purple-400" />;
      case 'integrated': return <Smartphone className="w-5 h-5 text-amber-400" />;
      default: return <Monitor className="w-5 h-5 text-slate-400" />;
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
            <Printer className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" />
            Configuration Imprimante
          </h1>
          <p className="text-sm text-slate-400">Paramètres d'impression POS / Android professionnels</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleTestPrint}
            variant="outline"
            disabled={testing}
            className="border-blue-700 text-blue-400 hover:bg-blue-500/10"
            data-testid="test-print-btn"
          >
            {testing ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <TestTube className="w-4 h-4 mr-2" />
            )}
            Test
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700"
            data-testid="save-printer-settings-btn"
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-3">
        {[
          { id: 'printers', label: 'Imprimantes', icon: Printer },
          { id: 'print', label: 'Impression', icon: FileText },
          { id: 'advanced', label: 'Avancé', icon: Settings }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Printers Tab */}
      {activeTab === 'printers' && (
        <div className="space-y-6">
          {/* Detected Printers */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <List className="w-5 h-5 text-blue-400" />
                Imprimantes Détectées
              </h2>
              <Button
                onClick={handleDetect}
                variant="outline"
                size="sm"
                disabled={detecting}
                className="border-slate-600"
              >
                {detecting ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Détecter
              </Button>
            </div>

            <div className="space-y-3">
              {printers.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Printer className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Aucune imprimante détectée</p>
                  <p className="text-sm">Cliquez sur "Détecter" ou utilisez l'impression navigateur</p>
                </div>
              ) : (
                printers.map((printer, idx) => (
                  <div
                    key={printer.id || idx}
                    className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-slate-600"
                  >
                    <div className="flex items-center gap-3">
                      {getPrinterIcon(printer.type)}
                      <div>
                        <p className="text-white font-medium">{printer.name}</p>
                        <p className="text-xs text-slate-400 capitalize">{printer.type || 'browser'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm ${getStatusColor(printer.status)}`}>
                        {getStatusText(printer.status)}
                      </span>
                      {printer.isDefault && (
                        <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                          Par défaut
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Printer Selection */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Sélection & Connexion
            </h2>
            <PrinterSelector showSettings />
          </div>
        </div>
      )}

      {/* Print Settings Tab */}
      {activeTab === 'print' && (
        <div className="space-y-6">
          {/* Paper Settings */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Ruler className="w-5 h-5 text-blue-400" />
              Paramètres du Papier
            </h2>

            {/* Paper Width */}
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Largeur du papier</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: '58mm', label: '58mm', desc: 'Imprimante portable' },
                  { value: '80mm', label: '80mm', desc: 'Standard POS' }
                ].map((width) => (
                  <button
                    key={width.value}
                    onClick={() => setSettings({ ...settings, paperWidth: width.value })}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      settings.paperWidth === width.value
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-slate-600 bg-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <span className="text-2xl font-bold text-white">{width.label}</span>
                    <p className="text-xs text-slate-400 mt-1">{width.desc}</p>
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
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'small', label: 'Petit', desc: 'Plus de lignes' },
                  { value: 'normal', label: 'Normal', desc: 'Recommandé' },
                  { value: 'large', label: 'Grand', desc: 'Lisibilité max' }
                ].map((size) => (
                  <button
                    key={size.value}
                    onClick={() => setSettings({ ...settings, fontSize: size.value })}
                    className={`p-3 rounded-lg border transition-all ${
                      settings.fontSize === size.value
                        ? 'border-blue-500 bg-blue-500/20 text-white'
                        : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span className="font-bold">{size.label}</span>
                    <p className="text-xs text-slate-400">{size.desc}</p>
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
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSettings({ ...settings, copies: Math.max(1, settings.copies - 1) })}
                  className="w-12 h-12 rounded-lg bg-slate-700 text-white hover:bg-slate-600 text-xl font-bold"
                >
                  -
                </button>
                <span className="text-3xl font-bold text-white w-16 text-center">{settings.copies}</span>
                <button
                  onClick={() => setSettings({ ...settings, copies: Math.min(5, settings.copies + 1) })}
                  className="w-12 h-12 rounded-lg bg-slate-700 text-white hover:bg-slate-600 text-xl font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Behavior Settings */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Comportement
            </h2>

            {/* Toggle Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Auto Print */}
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Printer className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Auto Impression</p>
                    <p className="text-xs text-slate-400">Après validation ticket</p>
                  </div>
                </div>
                <Switch
                  checked={settings.autoPrint}
                  onCheckedChange={(checked) => setSettings({ ...settings, autoPrint: checked })}
                />
              </div>

              {/* Cut Paper */}
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Scissors className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Coupe Auto</p>
                    <p className="text-xs text-slate-400">Couper après impression</p>
                  </div>
                </div>
                <Switch
                  checked={settings.cutPaper}
                  onCheckedChange={(checked) => setSettings({ ...settings, cutPaper: checked })}
                />
              </div>

              {/* Open Drawer */}
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Ouvrir Tiroir</p>
                    <p className="text-xs text-slate-400">Tiroir-caisse après impression</p>
                  </div>
                </div>
                <Switch
                  checked={settings.openDrawer}
                  onCheckedChange={(checked) => setSettings({ ...settings, openDrawer: checked })}
                />
              </div>

              {/* Print Logo */}
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Logo Entreprise</p>
                    <p className="text-xs text-slate-400">Afficher sur le ticket</p>
                  </div>
                </div>
                <Switch
                  checked={settings.printLogo}
                  onCheckedChange={(checked) => setSettings({ ...settings, printLogo: checked })}
                />
              </div>

              {/* Print QR Code */}
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">QR Code</p>
                    <p className="text-xs text-slate-400">Code de vérification</p>
                  </div>
                </div>
                <Switch
                  checked={settings.printQRCode}
                  onCheckedChange={(checked) => setSettings({ ...settings, printQRCode: checked })}
                />
              </div>

              {/* Dark Mode */}
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-500/20 flex items-center justify-center">
                    <Type className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Noir Intense</p>
                    <p className="text-xs text-slate-400">Meilleur contraste thermique</p>
                  </div>
                </div>
                <Switch
                  checked={settings.darkMode}
                  onCheckedChange={(checked) => setSettings({ ...settings, darkMode: checked })}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Tab */}
      {activeTab === 'advanced' && (
        <div className="space-y-6">
          {/* Margins */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-400" />
              Marges d'Impression
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Marge haute (mm)</label>
                <input
                  type="number"
                  value={settings.marginTop}
                  onChange={(e) => setSettings({ ...settings, marginTop: parseInt(e.target.value) || 0 })}
                  min="0"
                  max="20"
                  className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg text-center"
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
                  className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg text-center"
                />
              </div>
            </div>
          </div>

          {/* Long Ticket Options */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              Tickets Longs (15+ numéros)
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl">
                <div>
                  <p className="text-white font-medium">Mode Compact</p>
                  <p className="text-xs text-slate-400">Réduire les espaces pour plus de lignes</p>
                </div>
                <Switch
                  checked={settings.compactMode || false}
                  onCheckedChange={(checked) => setSettings({ ...settings, compactMode: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl">
                <div>
                  <p className="text-white font-medium">Pagination Intelligente</p>
                  <p className="text-xs text-slate-400">Diviser en plusieurs pages (Ticket 1/2, 2/2)</p>
                </div>
                <Switch
                  checked={settings.smartPagination !== false}
                  onCheckedChange={(checked) => setSettings({ ...settings, smartPagination: checked })}
                />
              </div>
            </div>
          </div>

          {/* Reset */}
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-red-400 flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5" />
              Zone Dangereuse
            </h2>
            <Button
              onClick={handleReset}
              variant="outline"
              className="border-red-700 text-red-400 hover:bg-red-500/10"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Réinitialiser tous les paramètres
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Save Button */}
      <div className="lg:hidden fixed bottom-20 left-4 right-4">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 h-12"
        >
          {saving ? (
            <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Save className="w-5 h-5 mr-2" />
          )}
          Sauvegarder les Paramètres
        </Button>
      </div>
    </div>
  );
};

export default CompanyPrinterConfigPage;
