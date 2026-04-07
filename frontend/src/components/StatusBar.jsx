/**
 * LOTTOLAB PRO - Status Bar Component
 * ====================================
 * Displays network, sync, and printer status
 * Compact header bar for POS interface
 */

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, Printer, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { useOffline } from '../contexts/OfflineContext';
import { Button } from './ui/button';

const StatusBar = ({ showDetails = true }) => {
  const {
    isOnline,
    networkQuality,
    isSyncing,
    pendingCount,
    lastSync,
    printerConnected,
    printerName,
    forceSync
  } = useOffline();
  
  const [showSyncDetails, setShowSyncDetails] = useState(false);

  // Get network icon and color
  const getNetworkStatus = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        label: 'Hors ligne'
      };
    }
    
    switch (networkQuality) {
      case 'good':
        return {
          icon: Wifi,
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-500/20',
          label: 'En ligne'
        };
      case 'medium':
        return {
          icon: Wifi,
          color: 'text-amber-400',
          bgColor: 'bg-amber-500/20',
          label: 'Moyen'
        };
      case 'slow':
        return {
          icon: Wifi,
          color: 'text-red-400',
          bgColor: 'bg-red-500/20',
          label: 'Lent'
        };
      default:
        return {
          icon: Wifi,
          color: 'text-slate-400',
          bgColor: 'bg-slate-500/20',
          label: 'En ligne'
        };
    }
  };

  // Get sync status
  const getSyncStatus = () => {
    if (isSyncing) {
      return {
        icon: RefreshCw,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        label: 'Sync...',
        animate: true
      };
    }
    
    if (pendingCount > 0) {
      return {
        icon: CloudOff,
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
        label: `${pendingCount} en attente`
      };
    }
    
    return {
      icon: Cloud,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
      label: 'Synchronisé'
    };
  };

  // Get printer status
  const getPrinterStatus = () => {
    if (printerConnected) {
      return {
        icon: Printer,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/20',
        label: printerName || 'Connecté'
      };
    }
    
    return {
      icon: Printer,
      color: 'text-slate-500',
      bgColor: 'bg-slate-500/20',
      label: 'Non connecté'
    };
  };

  const network = getNetworkStatus();
  const sync = getSyncStatus();
  const printer = getPrinterStatus();

  // Handle force sync
  const handleForceSync = async () => {
    if (isOnline && !isSyncing) {
      await forceSync();
    }
  };

  // Format last sync time
  const formatLastSync = () => {
    if (!lastSync) return 'Jamais';
    
    const date = new Date(lastSync);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'À l\'instant';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
    
    return date.toLocaleDateString('fr-FR');
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {/* Network Status */}
      <div 
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${network.bgColor} cursor-pointer`}
        title={`Réseau: ${network.label}`}
      >
        <network.icon className={`w-4 h-4 ${network.color}`} />
        {showDetails && (
          <span className={`text-xs font-medium ${network.color} hidden sm:inline`}>
            {network.label}
          </span>
        )}
      </div>

      {/* Sync Status */}
      <div 
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${sync.bgColor} cursor-pointer`}
        onClick={() => setShowSyncDetails(!showSyncDetails)}
        title={`Sync: ${sync.label}`}
      >
        <sync.icon className={`w-4 h-4 ${sync.color} ${sync.animate ? 'animate-spin' : ''}`} />
        {showDetails && (
          <span className={`text-xs font-medium ${sync.color} hidden sm:inline`}>
            {sync.label}
          </span>
        )}
      </div>

      {/* Printer Status */}
      <div 
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${printer.bgColor}`}
        title={`Imprimante: ${printer.label}`}
      >
        <printer.icon className={`w-4 h-4 ${printer.color}`} />
        {showDetails && (
          <span className={`text-xs font-medium ${printer.color} hidden sm:inline truncate max-w-[80px]`}>
            {printerConnected ? '✓' : '—'}
          </span>
        )}
      </div>

      {/* Sync Details Popover */}
      {showSyncDetails && (
        <div className="absolute top-12 right-4 z-50 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-xl min-w-[250px]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-semibold">État de synchronisation</h4>
            <button 
              onClick={() => setShowSyncDetails(false)}
              className="text-slate-400 hover:text-white"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Tickets en attente</span>
              <span className={pendingCount > 0 ? 'text-amber-400 font-semibold' : 'text-emerald-400'}>
                {pendingCount}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-slate-400">Dernière sync</span>
              <span className="text-white">{formatLastSync()}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-slate-400">Réseau</span>
              <span className={network.color}>{network.label}</span>
            </div>
          </div>
          
          {pendingCount > 0 && isOnline && (
            <Button
              onClick={handleForceSync}
              disabled={isSyncing}
              className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Synchronisation...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Synchroniser maintenant
                </>
              )}
            </Button>
          )}
          
          {!isOnline && (
            <div className="mt-3 p-2 bg-amber-500/20 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-400">
                Les tickets seront synchronisés au retour de la connexion
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StatusBar;
