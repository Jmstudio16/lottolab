/**
 * LOTTOLAB PRO - Ultimate Printer Manager
 * ========================================
 * Complete Bluetooth printer management for POS devices
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { 
  Printer, Bluetooth, BluetoothOff, BluetoothSearching,
  Check, X, RefreshCw, Settings2, TestTube, 
  ChevronRight, Smartphone, Radio, Loader2, Wifi, WifiOff
} from 'lucide-react';
import { toast } from 'sonner';
import bluetoothPrinter from '../utils/bluetoothPrinter';

const PrinterManager = ({ onClose, compact = false, autoConnect = false }) => {
  const [state, setState] = useState({
    isConnected: false,
    isConnecting: false,
    printerName: null,
    paperWidth: 80,
    useNativeBridge: false,
    isPrinting: false
  });
  const [isScanning, setIsScanning] = useState(false);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [showDeviceList, setShowDeviceList] = useState(false);

  // Subscribe to printer state changes
  useEffect(() => {
    const unsubscribe = bluetoothPrinter.addListener((newState) => {
      setState({
        isConnected: newState.isConnected,
        isConnecting: newState.isConnecting,
        printerName: newState.printerName,
        paperWidth: newState.paperWidth || 80,
        useNativeBridge: newState.useNativeBridge,
        isPrinting: newState.isPrinting
      });
    });
    
    return () => unsubscribe();
  }, []);

  // Scan for devices (native mode only)
  const handleScan = async () => {
    if (!state.useNativeBridge) {
      // Web Bluetooth - just connect directly (browser shows picker)
      handleConnect();
      return;
    }
    
    setIsScanning(true);
    setShowDeviceList(true);
    setAvailableDevices([]);
    
    try {
      const devices = await bluetoothPrinter.scanDevices();
      setAvailableDevices(devices);
      
      if (devices.length === 0) {
        toast.info('Aucune imprimante trouvée');
      }
    } catch (error) {
      console.error('[PrinterManager] Scan error:', error);
      toast.error('Erreur lors de la recherche');
    } finally {
      setIsScanning(false);
    }
  };

  // Connect to printer
  const handleConnect = async (deviceAddress = null) => {
    try {
      const result = await bluetoothPrinter.connect(deviceAddress);
      toast.success(`Connecté: ${result.printerName}`);
      setShowDeviceList(false);
    } catch (error) {
      console.error('[PrinterManager] Connect error:', error);
      if (error.name === 'NotFoundError' || error.message?.includes('cancelled')) {
        toast.info('Connexion annulée');
      } else {
        toast.error(error.message || 'Erreur de connexion');
      }
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    await bluetoothPrinter.disconnect();
    setAvailableDevices([]);
    toast.info('Déconnecté');
  };

  // Test print
  const handleTestPrint = async () => {
    try {
      await bluetoothPrinter.printTest();
      toast.success('Test d\'impression envoyé!');
    } catch (error) {
      console.error('[PrinterManager] Print error:', error);
      toast.error(`Erreur: ${error.message}`);
    }
  };

  // Change paper width
  const handlePaperWidth = (width) => {
    bluetoothPrinter.setPaperWidth(width);
    toast.success(`Papier: ${width}mm`);
  };

  // Compact version for toolbar
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {state.isConnected ? (
          <>
            <div 
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/20 cursor-pointer hover:bg-emerald-500/30"
              onClick={handleTestPrint}
              title={`Imprimante: ${state.printerName}`}
            >
              <Bluetooth className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-400 hidden sm:inline max-w-[80px] truncate">
                {state.printerName}
              </span>
              {state.isPrinting && <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />}
            </div>
          </>
        ) : state.isConnecting ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/20">
            <BluetoothSearching className="w-4 h-4 text-blue-400 animate-pulse" />
            <span className="text-xs text-blue-400 hidden sm:inline">Connexion...</span>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleConnect}
            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 px-2"
            title="Connecter imprimante"
          >
            <BluetoothOff className="w-4 h-4" />
            <span className="ml-1 text-xs hidden sm:inline">Imprimante</span>
          </Button>
        )}
      </div>
    );
  }

  // Full panel version
  return (
    <Card className="bg-slate-900/95 border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Printer className="w-5 h-5 text-blue-400" />
          Imprimante Bluetooth
          {state.useNativeBridge && (
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
              NATIF
            </span>
          )}
        </CardTitle>
        <CardDescription className="text-slate-500 text-sm">
          Connectez une imprimante thermique 58mm ou 80mm
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className={`flex items-center justify-between p-4 rounded-xl transition-all ${
          state.isConnected 
            ? 'bg-emerald-500/10 border border-emerald-500/30' 
            : state.isConnecting
              ? 'bg-blue-500/10 border border-blue-500/30'
              : 'bg-slate-800/50 border border-slate-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              state.isConnected 
                ? 'bg-emerald-500/20' 
                : state.isConnecting
                  ? 'bg-blue-500/20'
                  : 'bg-slate-700'
            }`}>
              {state.isConnecting ? (
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              ) : state.isConnected ? (
                <Bluetooth className="w-6 h-6 text-emerald-400" />
              ) : (
                <BluetoothOff className="w-6 h-6 text-slate-500" />
              )}
            </div>
            <div>
              <p className={`font-semibold ${
                state.isConnected ? 'text-emerald-400' : 
                state.isConnecting ? 'text-blue-400' : 'text-slate-400'
              }`}>
                {state.isConnecting ? 'Connexion en cours...' :
                 state.isConnected ? state.printerName : 'Non connecté'}
              </p>
              <p className="text-xs text-slate-500">
                {state.isConnected 
                  ? `Papier: ${state.paperWidth}mm • Prêt` 
                  : 'Cliquez pour connecter'}
              </p>
            </div>
          </div>
          
          {state.isConnected && (
            <Check className="w-6 h-6 text-emerald-400" />
          )}
        </div>

        {/* Device List (Native Mode) */}
        {showDeviceList && state.useNativeBridge && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 max-h-48 overflow-y-auto">
            {isScanning ? (
              <div className="flex items-center justify-center p-6 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Recherche d'imprimantes...
              </div>
            ) : availableDevices.length > 0 ? (
              <div className="divide-y divide-slate-700">
                {availableDevices.map((device, idx) => (
                  <button
                    key={device.address || idx}
                    onClick={() => handleConnect(device.address)}
                    disabled={state.isConnecting}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="text-white font-medium text-sm">{device.name}</p>
                        <p className="text-xs text-slate-500">{device.address}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center p-6 text-slate-500">
                <Radio className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucune imprimante trouvée</p>
                <p className="text-xs mt-1">Vérifiez que l'imprimante est allumée</p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {state.isConnected ? (
            <>
              <Button
                onClick={handleDisconnect}
                variant="outline"
                className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <X className="w-4 h-4 mr-2" />
                Déconnecter
              </Button>
              <Button
                onClick={handleTestPrint}
                disabled={state.isPrinting}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {state.isPrinting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4 mr-2" />
                )}
                {state.isPrinting ? 'Impression...' : 'Test'}
              </Button>
            </>
          ) : (
            <Button
              onClick={state.useNativeBridge ? handleScan : handleConnect}
              disabled={state.isConnecting || isScanning}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {state.isConnecting || isScanning ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Bluetooth className="w-4 h-4 mr-2" />
              )}
              {state.isConnecting ? 'Connexion...' : 
               isScanning ? 'Recherche...' : 
               state.useNativeBridge ? 'Rechercher' : 'Connecter'}
            </Button>
          )}
        </div>

        {/* Paper Width Settings */}
        {state.isConnected && (
          <div className="pt-3 border-t border-slate-700">
            <p className="text-sm text-slate-400 mb-2 flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Largeur du papier
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => handlePaperWidth(58)}
                variant={state.paperWidth === 58 ? 'default' : 'outline'}
                size="sm"
                className={`flex-1 ${state.paperWidth === 58 ? 'bg-blue-600' : 'border-slate-600 hover:bg-slate-700'}`}
              >
                58mm
              </Button>
              <Button
                onClick={() => handlePaperWidth(80)}
                variant={state.paperWidth === 80 ? 'default' : 'outline'}
                size="sm"
                className={`flex-1 ${state.paperWidth === 80 ? 'bg-blue-600' : 'border-slate-600 hover:bg-slate-700'}`}
              >
                80mm
              </Button>
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="bg-slate-800/30 rounded-lg p-3 text-xs text-slate-500">
          <p className="font-medium text-slate-400 mb-1">💡 Conseils:</p>
          <ul className="space-y-0.5">
            <li>• Activez le Bluetooth sur l'appareil</li>
            <li>• Allumez l'imprimante avant de connecter</li>
            <li>• L'impression est automatique après chaque vente</li>
          </ul>
        </div>

        {/* Close button */}
        {onClose && (
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
          >
            Fermer
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default PrinterManager;
