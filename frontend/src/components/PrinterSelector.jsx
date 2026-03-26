import React, { useState, useEffect } from 'react';
import { 
  Printer, CheckCircle, XCircle, Bluetooth, Usb, Wifi, Monitor,
  RefreshCw, AlertTriangle, Plus, Trash2, Settings, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import printerService, { 
  PRINTER_TYPES, 
  PRINTER_STATUS,
  detectPrinters,
  pairBluetoothPrinter,
  connectUSBPrinter,
  addNetworkPrinter,
  testPrint,
  selectPrinter,
  getSelectedPrinter
} from '@/services/PrinterService';

/**
 * PrinterSelector - Component for selecting and managing printers
 * Used in print modal and settings page
 */
const PrinterSelector = ({ 
  onPrinterSelected, 
  showSettings = false,
  compact = false 
}) => {
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showNetworkForm, setShowNetworkForm] = useState(false);
  const [networkIP, setNetworkIP] = useState('');
  const [networkPort, setNetworkPort] = useState('9100');
  const [networkName, setNetworkName] = useState('');
  const [testingPrinter, setTestingPrinter] = useState(null);

  useEffect(() => {
    loadPrinters();
  }, []);

  const loadPrinters = async () => {
    setLoading(true);
    try {
      await printerService.initialize();
      const detected = await detectPrinters();
      setPrinters(detected.filter(p => !p.isSearchOption));
      setSelectedPrinter(getSelectedPrinter());
    } catch (error) {
      console.error('Error loading printers:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPrinterIcon = (type) => {
    switch (type) {
      case PRINTER_TYPES.BLUETOOTH:
        return <Bluetooth className="w-5 h-5" />;
      case PRINTER_TYPES.USB:
        return <Usb className="w-5 h-5" />;
      case PRINTER_TYPES.NETWORK:
        return <Wifi className="w-5 h-5" />;
      case PRINTER_TYPES.INTEGRATED:
        return <Zap className="w-5 h-5" />;
      default:
        return <Monitor className="w-5 h-5" />;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case PRINTER_STATUS.CONNECTED:
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case PRINTER_STATUS.ERROR:
        return <XCircle className="w-4 h-4 text-red-400" />;
      case PRINTER_STATUS.CONNECTING:
        return <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case PRINTER_STATUS.CONNECTED:
        return 'Connectée';
      case PRINTER_STATUS.DISCONNECTED:
        return 'Déconnectée';
      case PRINTER_STATUS.CONNECTING:
        return 'Connexion...';
      case PRINTER_STATUS.ERROR:
        return 'Erreur';
      default:
        return 'Inconnue';
    }
  };

  const handleSelectPrinter = (printer) => {
    selectPrinter(printer.id);
    setSelectedPrinter(printer);
    if (onPrinterSelected) {
      onPrinterSelected(printer);
    }
    toast.success(`Imprimante sélectionnée: ${printer.name}`);
  };

  const handlePairBluetooth = async () => {
    try {
      setLoading(true);
      const printer = await pairBluetoothPrinter();
      toast.success(`Imprimante Bluetooth jumelée: ${printer.name}`);
      await loadPrinters();
    } catch (error) {
      toast.error(error.message || 'Échec du jumelage Bluetooth');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectUSB = async () => {
    try {
      setLoading(true);
      const printer = await connectUSBPrinter();
      toast.success(`Imprimante USB connectée: ${printer.name}`);
      await loadPrinters();
    } catch (error) {
      toast.error(error.message || 'Échec connexion USB');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNetworkPrinter = async () => {
    if (!networkIP) {
      toast.error('Entrez une adresse IP');
      return;
    }
    
    try {
      const printer = await addNetworkPrinter(networkIP, parseInt(networkPort) || 9100, networkName);
      toast.success(`Imprimante réseau ajoutée: ${printer.name}`);
      setShowNetworkForm(false);
      setNetworkIP('');
      setNetworkPort('9100');
      setNetworkName('');
      await loadPrinters();
    } catch (error) {
      toast.error(error.message || 'Échec ajout imprimante');
    }
  };

  const handleTestPrint = async (printer) => {
    setTestingPrinter(printer.id);
    try {
      if (printer.id !== selectedPrinter?.id) {
        selectPrinter(printer.id);
      }
      await testPrint();
      toast.success('Test d\'impression envoyé');
    } catch (error) {
      toast.error('Échec du test d\'impression');
    } finally {
      setTestingPrinter(null);
    }
  };

  const handleRemovePrinter = (printer) => {
    if (window.confirm(`Supprimer ${printer.name} ?`)) {
      printerService.removePrinter(printer.id);
      loadPrinters();
      toast.success('Imprimante supprimée');
    }
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Imprimante</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={loadPrinters}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <select
          className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
          value={selectedPrinter?.id || ''}
          onChange={(e) => {
            const printer = printers.find(p => p.id === e.target.value);
            if (printer) handleSelectPrinter(printer);
          }}
        >
          {printers.map(printer => (
            <option key={printer.id} value={printer.id}>
              {printer.name} ({getStatusText(printer.status)})
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Printer className="w-5 h-5 text-blue-400" />
          Imprimantes
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={loadPrinters}
          disabled={loading}
          className="border-slate-700"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Connection Buttons */}
      <div className="flex flex-wrap gap-2">
        {'bluetooth' in navigator && (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePairBluetooth}
            disabled={loading}
            className="border-blue-700 text-blue-400 hover:bg-blue-500/10"
          >
            <Bluetooth className="w-4 h-4 mr-2" />
            Jumeler Bluetooth
          </Button>
        )}
        
        {'usb' in navigator && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleConnectUSB}
            disabled={loading}
            className="border-emerald-700 text-emerald-400 hover:bg-emerald-500/10"
          >
            <Usb className="w-4 h-4 mr-2" />
            Connecter USB
          </Button>
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowNetworkForm(!showNetworkForm)}
          className="border-purple-700 text-purple-400 hover:bg-purple-500/10"
        >
          <Wifi className="w-4 h-4 mr-2" />
          {showNetworkForm ? 'Annuler' : 'Ajouter Réseau'}
        </Button>
      </div>

      {/* Network Printer Form */}
      {showNetworkForm && (
        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl space-y-3">
          <h4 className="text-sm font-semibold text-white">Ajouter imprimante réseau</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Adresse IP *</label>
              <input
                type="text"
                value={networkIP}
                onChange={(e) => setNetworkIP(e.target.value)}
                placeholder="192.168.1.100"
                className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Port</label>
              <input
                type="text"
                value={networkPort}
                onChange={(e) => setNetworkPort(e.target.value)}
                placeholder="9100"
                className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">Nom (optionnel)</label>
            <input
              type="text"
              value={networkName}
              onChange={(e) => setNetworkName(e.target.value)}
              placeholder="Imprimante cuisine"
              className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <Button
            onClick={handleAddNetworkPrinter}
            className="w-full bg-purple-600 hover:bg-purple-700"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter
          </Button>
        </div>
      )}

      {/* Printers List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      ) : printers.length === 0 ? (
        <div className="text-center py-8 bg-slate-800/50 rounded-xl border border-slate-700">
          <Printer className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Aucune imprimante détectée</p>
          <p className="text-slate-500 text-sm mt-1">Connectez une imprimante Bluetooth, USB ou réseau</p>
        </div>
      ) : (
        <div className="space-y-2">
          {printers.map((printer) => (
            <div
              key={printer.id}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                selectedPrinter?.id === printer.id
                  ? 'bg-blue-500/20 border-blue-500'
                  : 'bg-slate-800/50 border-slate-700 hover:border-blue-500/50'
              }`}
              onClick={() => handleSelectPrinter(printer)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    selectedPrinter?.id === printer.id ? 'bg-blue-500/30' : 'bg-slate-700'
                  }`}>
                    {getPrinterIcon(printer.type)}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{printer.name}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      {getStatusIcon(printer.status)}
                      <span>{getStatusText(printer.status)}</span>
                      <span className="text-slate-600">•</span>
                      <span className="capitalize">{printer.type}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {selectedPrinter?.id === printer.id && (
                    <span className="px-2 py-1 bg-blue-500/30 text-blue-400 text-xs rounded-full">
                      Par défaut
                    </span>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTestPrint(printer);
                    }}
                    disabled={testingPrinter === printer.id}
                    className="text-slate-400 hover:text-white"
                    title="Tester l'impression"
                  >
                    {testingPrinter === printer.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Printer className="w-4 h-4" />
                    )}
                  </Button>
                  
                  {printer.type !== PRINTER_TYPES.BROWSER && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePrinter(printer);
                      }}
                      className="text-slate-400 hover:text-red-400"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PrinterSelector;
