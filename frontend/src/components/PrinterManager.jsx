/**
 * Printer Manager Component
 * Allows vendors to connect and manage Bluetooth printers
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  Printer, Bluetooth, BluetoothOff, Check, X, 
  RefreshCw, Settings2, TestTube, Wifi, WifiOff 
} from 'lucide-react';
import { toast } from 'sonner';
import bluetoothPrinter from '../utils/bluetoothPrinter';

const PrinterManager = ({ onClose, compact = false }) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printerName, setPrinterName] = useState(null);
  const [paperWidth, setPaperWidth] = useState(80);
  const [savedPrinter, setSavedPrinter] = useState(null);

  useEffect(() => {
    // Check support
    setIsSupported(bluetoothPrinter.isSupported());
    
    // Get saved printer info
    const saved = bluetoothPrinter.getSavedPrinter();
    if (saved) {
      setSavedPrinter(saved);
      setPaperWidth(saved.paperWidth || 80);
    }
    
    // Listen for connection changes
    const unsubscribe = bluetoothPrinter.addListener((state) => {
      setIsConnected(state.isConnected);
      setPrinterName(state.printerName);
      setPaperWidth(state.paperWidth);
    });
    
    // Check current state
    setIsConnected(bluetoothPrinter.isConnected);
    setPrinterName(bluetoothPrinter.printerName);
    
    return () => unsubscribe();
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const result = await bluetoothPrinter.connect();
      toast.success(`Connecté à ${result.printerName}`);
    } catch (error) {
      console.error('Connection error:', error);
      if (error.name === 'NotFoundError') {
        toast.error('Aucune imprimante trouvée');
      } else if (error.message.includes('User cancelled')) {
        toast.info('Connexion annulée');
      } else {
        toast.error(`Erreur: ${error.message}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await bluetoothPrinter.disconnect();
    toast.info('Imprimante déconnectée');
  };

  const handleTestPrint = async () => {
    setIsPrinting(true);
    try {
      await bluetoothPrinter.printTest();
      toast.success('Test d\'impression envoyé!');
    } catch (error) {
      console.error('Print error:', error);
      toast.error(`Erreur d'impression: ${error.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

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
            <div className="flex items-center gap-1 text-emerald-400 text-sm">
              <Bluetooth className="w-4 h-4" />
              <span className="hidden sm:inline">{printerName}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleTestPrint}
              disabled={isPrinting}
              className="text-slate-400 hover:text-white"
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
            className="border-slate-700 text-slate-300"
          >
            <BluetoothOff className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Connecter</span>
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
        </CardTitle>
        <CardDescription>
          Connectez une imprimante thermique via Bluetooth
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Support Check */}
        {!isSupported && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
            <X className="w-4 h-4 inline mr-2" />
            Bluetooth non supporté sur ce navigateur. Utilisez Chrome ou Edge sur Android.
          </div>
        )}

        {/* Connection Status */}
        <div className={`flex items-center justify-between p-3 rounded-lg ${
          isConnected ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-800 border border-slate-700'
        }`}>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <Bluetooth className="w-6 h-6 text-emerald-400" />
            ) : (
              <BluetoothOff className="w-6 h-6 text-slate-500" />
            )}
            <div>
              <p className={`font-medium ${isConnected ? 'text-emerald-400' : 'text-slate-400'}`}>
                {isConnected ? printerName : 'Non connecté'}
              </p>
              {savedPrinter && !isConnected && (
                <p className="text-xs text-slate-500">
                  Dernière: {savedPrinter.name}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Check className="w-5 h-5 text-emerald-400" />
            ) : null}
          </div>
        </div>

        {/* Connect/Disconnect Button */}
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
            <Button
              onClick={handleConnect}
              disabled={isConnecting || !isSupported}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isConnecting ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Bluetooth className="w-4 h-4 mr-2" />
              )}
              {isConnecting ? 'Recherche...' : 'Connecter Imprimante'}
            </Button>
          )}
        </div>

        {/* Paper Width Settings */}
        {isConnected && (
          <div className="pt-2 border-t border-slate-700">
            <p className="text-sm text-slate-400 mb-2 flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Largeur du papier
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => handlePaperWidthChange(58)}
                variant={paperWidth === 58 ? 'default' : 'outline'}
                size="sm"
                className={paperWidth === 58 ? 'bg-blue-600' : 'border-slate-700'}
              >
                58mm
              </Button>
              <Button
                onClick={() => handlePaperWidthChange(80)}
                variant={paperWidth === 80 ? 'default' : 'outline'}
                size="sm"
                className={paperWidth === 80 ? 'bg-blue-600' : 'border-slate-700'}
              >
                80mm
              </Button>
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-500">
          <p className="font-medium text-slate-400 mb-1">💡 Conseils:</p>
          <ul className="space-y-1">
            <li>• Activez le Bluetooth sur votre appareil</li>
            <li>• Allumez l'imprimante avant de connecter</li>
            <li>• Utilisez Chrome ou Edge pour le Bluetooth</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default PrinterManager;
