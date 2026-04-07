/**
 * LOTTOLAB Status Bar Component
 * =============================
 * Barre de statut complète montrant:
 * - État réseau (Online/Faible/Offline)
 * - État imprimante (Connectée/Non connectée)
 * - Tickets en attente de sync
 * - Dernière synchronisation
 */

import React, { useState, useEffect } from 'react';
import { 
  Wifi, WifiOff, Bluetooth, BluetoothOff, 
  Cloud, CloudOff, RefreshCw, AlertTriangle,
  CheckCircle, XCircle, Printer, Signal
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { networkManager } from '../services/networkManager';
import { syncQueueManager } from '../services/syncQueueManager';
import bluetoothPrinter from '../utils/bluetoothPrinter';
import { cn } from '../lib/utils';

const StatusBar = ({ showDetails = false, className }) => {
  const [networkStatus, setNetworkStatus] = useState({
    isOnline: navigator.onLine,
    quality: 'unknown'
  });
  const [syncStatus, setSyncStatus] = useState({
    pendingCount: 0,
    isProcessing: false
  });
  const [printerStatus, setPrinterStatus] = useState({
    isConnected: false,
    name: null
  });
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Network status listener
    const unsubNetwork = networkManager.addListener((status) => {
      setNetworkStatus(status);
    });

    // Sync status listener
    const unsubSync = syncQueueManager.addListener((status) => {
      setSyncStatus(status);
    });

    // Printer status listener
    const unsubPrinter = bluetoothPrinter.addListener((status) => {
      setPrinterStatus({
        isConnected: status.isConnected,
        name: status.printerName
      });
    });

    // Initial states
    setPrinterStatus({
      isConnected: bluetoothPrinter.isConnected,
      name: bluetoothPrinter.printerName
    });

    return () => {
      unsubNetwork();
      unsubSync();
      unsubPrinter();
    };
  }, []);

  const getNetworkIcon = () => {
    if (!networkStatus.isOnline) return <WifiOff className="w-4 h-4" />;
    if (networkStatus.quality === 'slow') return <Signal className="w-4 h-4" />;
    if (networkStatus.quality === 'medium') return <Signal className="w-4 h-4" />;
    return <Wifi className="w-4 h-4" />;
  };

  const getNetworkColor = () => {
    if (!networkStatus.isOnline) return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (networkStatus.quality === 'slow') return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (networkStatus.quality === 'medium') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  };

  const getNetworkLabel = () => {
    if (!networkStatus.isOnline) return 'Hors ligne';
    if (networkStatus.quality === 'slow') return 'Lent';
    if (networkStatus.quality === 'medium') return 'Moyen';
    if (networkStatus.quality === 'good') return 'En ligne';
    return 'Vérification...';
  };

  const handleForceSync = async () => {
    try {
      await syncQueueManager.forcSync();
    } catch (error) {
      console.error('Force sync failed:', error);
    }
  };

  // Compact version
  if (!showDetails) {
    return (
      <div 
        className={cn(
          'flex items-center gap-2',
          className
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Network Status */}
        <div className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium cursor-pointer',
          getNetworkColor()
        )}>
          {syncStatus.isProcessing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            getNetworkIcon()
          )}
          <span className="hidden sm:inline">{getNetworkLabel()}</span>
        </div>

        {/* Pending Count */}
        {syncStatus.pendingCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
            <Cloud className="w-3.5 h-3.5" />
            <span>{syncStatus.pendingCount}</span>
          </div>
        )}

        {/* Printer Status */}
        <div className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium',
          printerStatus.isConnected 
            ? 'text-blue-400 bg-blue-500/10 border-blue-500/30'
            : 'text-slate-400 bg-slate-500/10 border-slate-500/30'
        )}>
          {printerStatus.isConnected ? (
            <Bluetooth className="w-3.5 h-3.5" />
          ) : (
            <BluetoothOff className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">
            {printerStatus.isConnected ? 'Imprimante' : 'Non connecté'}
          </span>
        </div>
      </div>
    );
  }

  // Detailed version
  return (
    <div className={cn(
      'bg-slate-900/95 border border-slate-700 rounded-xl p-4 space-y-4',
      className
    )}>
      <h3 className="text-white font-semibold text-sm flex items-center gap-2">
        <Signal className="w-4 h-4 text-emerald-400" />
        État du Système
      </h3>

      {/* Network Status */}
      <div className={cn(
        'flex items-center justify-between p-3 rounded-lg border',
        getNetworkColor()
      )}>
        <div className="flex items-center gap-3">
          {getNetworkIcon()}
          <div>
            <p className="font-medium text-sm">{getNetworkLabel()}</p>
            {networkStatus.lastPingTime && (
              <p className="text-xs opacity-70">
                Latence: {networkStatus.lastPingTime}ms
              </p>
            )}
          </div>
        </div>
        {networkStatus.isOnline ? (
          <CheckCircle className="w-5 h-5" />
        ) : (
          <XCircle className="w-5 h-5" />
        )}
      </div>

      {/* Sync Status */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800 border border-slate-700">
        <div className="flex items-center gap-3">
          {syncStatus.isProcessing ? (
            <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
          ) : syncStatus.pendingCount > 0 ? (
            <CloudOff className="w-5 h-5 text-amber-400" />
          ) : (
            <Cloud className="w-5 h-5 text-emerald-400" />
          )}
          <div>
            <p className="font-medium text-sm text-white">
              {syncStatus.isProcessing 
                ? 'Synchronisation...' 
                : syncStatus.pendingCount > 0 
                  ? `${syncStatus.pendingCount} en attente`
                  : 'Synchronisé'}
            </p>
            {syncStatus.lastSync && (
              <p className="text-xs text-slate-500">
                Dernière sync: {new Date(syncStatus.lastSync).toLocaleTimeString('fr-FR')}
              </p>
            )}
          </div>
        </div>
        {syncStatus.pendingCount > 0 && networkStatus.isOnline && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleForceSync}
            disabled={syncStatus.isProcessing}
            className="text-blue-400 hover:text-blue-300"
          >
            <RefreshCw className={cn(
              'w-4 h-4',
              syncStatus.isProcessing && 'animate-spin'
            )} />
          </Button>
        )}
      </div>

      {/* Printer Status */}
      <div className={cn(
        'flex items-center justify-between p-3 rounded-lg border',
        printerStatus.isConnected 
          ? 'bg-blue-500/10 border-blue-500/30'
          : 'bg-slate-800 border-slate-700'
      )}>
        <div className="flex items-center gap-3">
          {printerStatus.isConnected ? (
            <Printer className="w-5 h-5 text-blue-400" />
          ) : (
            <BluetoothOff className="w-5 h-5 text-slate-500" />
          )}
          <div>
            <p className={cn(
              'font-medium text-sm',
              printerStatus.isConnected ? 'text-blue-400' : 'text-slate-400'
            )}>
              {printerStatus.isConnected 
                ? printerStatus.name || 'Imprimante connectée'
                : 'Imprimante non connectée'}
            </p>
            {printerStatus.isConnected && (
              <p className="text-xs text-slate-500">Prêt à imprimer</p>
            )}
          </div>
        </div>
        {printerStatus.isConnected ? (
          <CheckCircle className="w-5 h-5 text-blue-400" />
        ) : (
          <XCircle className="w-5 h-5 text-slate-500" />
        )}
      </div>

      {/* Warning for offline */}
      {!networkStatus.isOnline && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Mode Hors Ligne Actif</p>
            <p className="text-xs text-amber-400/70 mt-1">
              Les tickets seront synchronisés automatiquement quand la connexion sera rétablie.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusBar;
