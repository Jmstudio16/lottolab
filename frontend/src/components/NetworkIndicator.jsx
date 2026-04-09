/**
 * Network Status Indicator Component
 * Shows current network status - Optimized for POS devices
 */

import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

const NetworkIndicator = ({ className, showDetails = false }) => {
  const [status, setStatus] = useState({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    networkQuality: navigator.onLine ? 'good' : 'offline'
  });
  
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    // Direct network event listeners (fast, no dependencies)
    const handleOnline = () => {
      if (!mountedRef.current) return;
      setStatus(prev => ({ ...prev, isOnline: true, networkQuality: 'good' }));
    };
    
    const handleOffline = () => {
      if (!mountedRef.current) return;
      setStatus(prev => ({ ...prev, isOnline: false, networkQuality: 'offline' }));
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check network quality periodically (every 10 seconds)
    const checkQuality = () => {
      if (!mountedRef.current) return;
      
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (connection && navigator.onLine) {
        const effectiveType = connection.effectiveType;
        let quality = 'good';
        if (effectiveType === '2g' || effectiveType === 'slow-2g') quality = 'slow';
        else if (effectiveType === '3g') quality = 'medium';
        
        setStatus(prev => ({ ...prev, networkQuality: quality }));
      }
    };
    
    checkQuality();
    const qualityInterval = setInterval(checkQuality, 10000);
    
    return () => {
      mountedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(qualityInterval);
    };
  }, []);

  const getStatusColor = () => {
    if (!status.isOnline) return 'text-red-400';
    if (status.networkQuality === 'slow') return 'text-yellow-400';
    if (status.networkQuality === 'medium') return 'text-yellow-400';
    return 'text-emerald-400';
  };

  const getStatusBgColor = () => {
    if (!status.isOnline) return 'bg-red-500/10 border-red-500/30';
    if (status.networkQuality === 'slow') return 'bg-yellow-500/10 border-yellow-500/30';
    if (status.networkQuality === 'medium') return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-emerald-500/10 border-emerald-500/30';
  };

  const getStatusIcon = () => {
    if (status.isSyncing) {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }
    if (!status.isOnline) {
      return <WifiOff className="w-4 h-4" />;
    }
    if (status.networkQuality === 'slow') {
      return <AlertTriangle className="w-4 h-4" />;
    }
    return <Wifi className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (status.isSyncing) return 'Sync...';
    if (!status.isOnline) return 'Hors ligne';
    if (status.networkQuality === 'slow') return 'Lent';
    if (status.networkQuality === 'medium') return 'Moyen';
    return 'En ligne';
  };

  // Compact indicator
  if (!showDetails) {
    return (
      <div className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium',
        getStatusBgColor(),
        getStatusColor(),
        className
      )}>
        {getStatusIcon()}
        <span className="hidden sm:inline">{getStatusText()}</span>
        {status.pendingCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-xs">
            {status.pendingCount}
          </span>
        )}
      </div>
    );
  }

  // Detailed indicator
  return (
    <div className={cn(
      'rounded-lg border p-3',
      getStatusBgColor(),
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('p-2 rounded-full', getStatusBgColor())}>
            {getStatusIcon()}
          </div>
          <div>
            <p className={cn('font-medium', getStatusColor())}>
              {getStatusText()}
            </p>
            <p className="text-xs text-slate-500">
              {status.isOnline 
                ? `Qualité: ${status.networkQuality}` 
                : 'Mode hors ligne actif'}
            </p>
          </div>
        </div>
        
        {status.pendingCount > 0 && (
          <div className="text-right">
            <p className="text-amber-400 font-bold">{status.pendingCount}</p>
            <p className="text-xs text-slate-500">en attente</p>
          </div>
        )}
      </div>
      
      {status.lastSync && (
        <p className="text-xs text-slate-500 mt-2">
          Dernière sync: {new Date(status.lastSync).toLocaleTimeString('fr-FR')}
        </p>
      )}
    </div>
  );
};

export default NetworkIndicator;
