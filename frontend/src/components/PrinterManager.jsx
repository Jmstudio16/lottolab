/**
 * LOTTOLAB PRO - Advanced Bluetooth Printer Manager
 * ==================================================
 * Full Bluetooth printer management with:
 * - Auto-connection on app start
 * - Device scanning with list
 * - Connection persistence
 * - Native Android bridge support
 * - 58mm and 80mm paper support
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { 
  Printer, Bluetooth, BluetoothOff, BluetoothSearching,
  Check, X, RefreshCw, Settings2, TestTube, Wifi, 
  ChevronRight, Smartphone, Radio
} from 'lucide-react';
import { toast } from 'sonner';
import bluetoothPrinter from '../utils/bluetoothPrinter';
import { offlineDB } from '../services/offlineDB';

const PrinterManager = ({ onClose, compact = false, autoConnect = false }) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printerName, setPrinterName] = useState(null);
  const [paperWidth, setPaperWidth] = useState(80);
  const [savedPrinter, setSavedPrinter] = useState(null);
  const [useNativeBridge, setUseNativeBridge] = useState(false);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [showDeviceList, setShowDeviceList] = useState(false);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      // Check support
      setIsSupported(bluetoothPrinter.isSupported());
      setUseNativeBridge(bluetoothPrinter.useNativeBridge);
      
      // Get saved printer config from IndexedDB
      try {
        const config = await offlineDB.getPrinterConfig();
        if (config) {
          setSavedPrinter(config);
          setPaperWidth(config.paperWidth || 80);
          
          // Auto-connect if enabled and saved printer exists
          if (autoConnect && config.name) {
            tryAutoConnect();
          }
        }
      } catch (e) {
        console.warn('[PrinterManager] Could not load saved config:', e);
      }
      
      // Listen for connection changes
      const unsubscribe = bluetoothPrinter.addListener((state) => {
        setIsConnected(state.isConnected);
        setPrinterName(state.printerName);
        setPaperWidth(state.paperWidth || 80);
        setUseNativeBridge(state.useNativeBridge);
      });
      
      // Check current state
      setIsConnected(bluetoothPrinter.isConnected);
      setPrinterName(bluetoothPrinter.printerName);
      
      return () => unsubscribe();
    };
    
    init();
  }, [autoConnect]);

  // Try to auto-connect to saved printer
  const tryAutoConnect = useCallback(async () => {
    if (isConnected || isConnecting) return;
    
    setIsConnecting(true);
    try {
      await bluetoothPrinter.connect();
      toast.success('Imprimante connectée automatiquement');
    } catch (error) {
      console.log('[PrinterManager] Auto-connect failed (normal if no saved device)');
    } finally {
      setIsConnecting(false);
    }
  }, [isConnected, isConnecting]);

  // Scan for available devices (Native only)
  const handleScan = async () => {
    if (!useNativeBridge) {
      // Web Bluetooth uses the browser's device picker
      handleConnect();
      return;
    }
    
    setIsScanning(true);
    setShowDeviceList(true);
    setAvailableDevices([]);
    
    try {
      // For native bridge, scan for devices
      if (bluetoothPrinter.nativeBridge?.scan) {
        const devices = await bluetoothPrinter.nativeBridge.scan();
        setAvailableDevices(devices || []);
        
        if (devices.length === 0) {
          toast.info('Aucune imprimante trouvée. Vérifiez que l\'imprimante est allumée.');
        }
      }
    } catch (error) {
      console.error('[PrinterManager] Scan error:', error);
      toast.error('Erreur lors de la recherche');
    } finally {
      setIsScanning(false);
    }
  };

  // Connect to printer (Web Bluetooth or Native)
  const handleConnect = async (deviceAddress = null) => {
    setIsConnecting(true);
    try {
      let result;
      
      if (deviceAddress && useNativeBridge) {
        // Connect to specific device (native)
        result = await bluetoothPrinter.nativeBridge.connect(deviceAddress);
        bluetoothPrinter.isConnected = true;
        bluetoothPrinter.printerName = availableDevices.find(d => d.address === deviceAddress)?.name || 'Imprimante';
        bluetoothPrinter.notifyListeners();
      } else {
        // Use standard connect (shows browser picker for Web Bluetooth)
        result = await bluetoothPrinter.connect();
      }
      
      toast.success(`Connecté à ${result?.printerName || printerName || 'Imprimante'}`);
      setShowDeviceList(false);
    } catch (error) {
      console.error('[PrinterManager] Connection error:', error);
      if (error.name === 'NotFoundError') {
        toast.error('Aucune imprimante sélectionnée');
      } else if (error.message?.includes('User cancelled')) {
        toast.info('Connexion annulée');
      } else {
        toast.error(`Erreur: ${error.message}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    await bluetoothPrinter.disconnect();
    setAvailableDevices([]);
    toast.info('Imprimante déconnectée');
  };

  // Test print
  const handleTestPrint = async () => {
    setIsPrinting(true);
    try {
      await bluetoothPrinter.printTest();
      toast.success('Test d\'impression envoyé!');
    } catch (error) {
      console.error('[PrinterManager] Print error:', error);
      toast.error(`Erreur d'impression: ${error.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  // Change paper width
  const handlePaperWidthChange = (width) => {
    setPaperWidth(width);
    bluetoothPrinter.setPaperWidth(width);
    toast.success(`Largeur papier: ${width}mm`);
  };

  // Compact version for toolbar
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <div 
              className="flex items-center gap-1 text-emerald-400 text-sm cursor-pointer hover:text-emerald-300"
              onClick={handleTestPrint}
              title={`Imprimante: ${printerName}`}
            >
              <Bluetooth className="w-4 h-4" />
              <span className="hidden sm:inline max-w-[100px] truncate">{printerName}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleTestPrint}
              disabled={isPrinting}
              className="text-slate-400 hover:text-white p-1"
              title="Test d'impression"
            >
              <Printer className={`w-4 h-4 ${isPrinting ? 'animate-pulse' : ''}`} />
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handleConnect}
            disabled={isConnecting || !isSupported}
            className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
            title="Connecter une imprimante"
          >
            {isConnecting ? (
              <BluetoothSearching className="w-4 h-4 animate-pulse" />
            ) : (
              <BluetoothOff className="w-4 h-4" />
            )}
            <span className="ml-1 hidden sm:inline">
              {isConnecting ? 'Recherche...' : 'Imprimante'}
            </span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="bg-slate-900/95 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Printer className="w-5 h-5 text-blue-400" />
          Imprimante Bluetooth
          {useNativeBridge && (
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
              Mode Natif
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Connectez une imprimante thermique pour les tickets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Support Check */}
        {!isSupported && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
            <X className="w-4 h-4 inline mr-2" />
            Bluetooth non supporté. Utilisez Chrome/Edge sur Android ou installez l'APK LOTTOLAB PRO.
          </div>
        )}

        {/* Connection Status */}
        <div className={`flex items-center justify-between p-4 rounded-lg ${
          isConnected 
            ? 'bg-emerald-500/10 border border-emerald-500/30' 
            : 'bg-slate-800 border border-slate-700'
        }`}>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <Bluetooth className="w-6 h-6 text-emerald-400" />
              </div>
            ) : (
              <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center">
                <BluetoothOff className="w-6 h-6 text-slate-500" />
              </div>
            )}
            <div>
              <p className={`font-semibold ${isConnected ? 'text-emerald-400' : 'text-slate-400'}`}>
                {isConnected ? printerName : 'Non connecté'}
              </p>
              <p className="text-xs text-slate-500">
                {isConnected 
                  ? `Papier: ${paperWidth}mm` 
                  : savedPrinter?.name 
                    ? `Dernière: ${savedPrinter.name}` 
                    : 'Cliquez pour connecter'}
              </p>
            </div>
          </div>
          
          {isConnected && (
            <Check className="w-6 h-6 text-emerald-400" />
          )}
        </div>

        {/* Device List (for Native mode) */}
        {showDeviceList && useNativeBridge && (
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 max-h-48 overflow-y-auto">
            {isScanning ? (
              <div className="flex items-center justify-center p-4 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Recherche en cours...
              </div>
            ) : availableDevices.length > 0 ? (
              <div className="divide-y divide-slate-700">
                {availableDevices.map((device, index) => (
                  <button
                    key={device.address || index}
                    onClick={() => handleConnect(device.address)}
                    disabled={isConnecting}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="text-white font-medium">{device.name || 'Imprimante'}</p>
                        <p className="text-xs text-slate-500">{device.address}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center p-4 text-slate-500">
                <Radio className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Aucune imprimante trouvée</p>
                <p className="text-xs mt-1">Vérifiez que l'imprimante est allumée</p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {isConnected ? (
            <>
              <Button
                onClick={handleDisconnect}
                variant="outline"
                className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                <X className="w-4 h-4 mr-2" />
                Déconnecter
              </Button>
              <Button
                onClick={handleTestPrint}
                disabled={isPrinting}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <TestTube className={`w-4 h-4 mr-2 ${isPrinting ? 'animate-spin' : ''}`} />
                {isPrinting ? 'Impression...' : 'Test'}
              </Button>
            </>
          ) : (
            <>
              {useNativeBridge ? (
                <Button
                  onClick={handleScan}
                  disabled={isScanning || !isSupported}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {isScanning ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <BluetoothSearching className="w-4 h-4 mr-2" />
                  )}
                  {isScanning ? 'Recherche...' : 'Rechercher'}
                </Button>
              ) : (
                <Button
                  onClick={() => handleConnect()}
                  disabled={isConnecting || !isSupported}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isConnecting ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Bluetooth className="w-4 h-4 mr-2" />
                  )}
                  {isConnecting ? 'Connexion...' : 'Connecter Imprimante'}
                </Button>
              )}
            </>
          )}
        </div>

        {/* Paper Width Settings */}
        {isConnected && (
          <div className="pt-3 border-t border-slate-700">
            <p className="text-sm text-slate-400 mb-2 flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Largeur du papier
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => handlePaperWidthChange(58)}
                variant={paperWidth === 58 ? 'default' : 'outline'}
                size="sm"
                className={`flex-1 ${paperWidth === 58 ? 'bg-blue-600' : 'border-slate-700'}`}
              >
                58mm (Petit)
              </Button>
              <Button
                onClick={() => handlePaperWidthChange(80)}
                variant={paperWidth === 80 ? 'default' : 'outline'}
                size="sm"
                className={`flex-1 ${paperWidth === 80 ? 'bg-blue-600' : 'border-slate-700'}`}
              >
                80mm (Standard)
              </Button>
            </div>
          </div>
        )}

        {/* Auto-connect info */}
        {savedPrinter && !isConnected && (
          <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
            <div className="text-sm">
              <p className="text-slate-400">Dernière imprimante</p>
              <p className="text-white font-medium">{savedPrinter.name}</p>
            </div>
            <Button
              onClick={tryAutoConnect}
              disabled={isConnecting}
              variant="outline"
              size="sm"
              className="border-slate-600"
            >
              {isConnecting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                'Reconnecter'
              )}
            </Button>
          </div>
        )}

        {/* Tips */}
        <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-500">
          <p className="font-medium text-slate-400 mb-1">💡 Conseils:</p>
          <ul className="space-y-1">
            <li>• Activez le Bluetooth sur votre appareil</li>
            <li>• Allumez l'imprimante avant de connecter</li>
            {!useNativeBridge && (
              <li>• Utilisez Chrome ou Edge pour le Bluetooth Web</li>
            )}
            <li>• L'impression est automatique après chaque vente</li>
          </ul>
        </div>

        {/* Close button */}
        {onClose && (
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full border-slate-700 text-slate-400 hover:text-white"
          >
            Fermer
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default PrinterManager;
