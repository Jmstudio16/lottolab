/**
 * WebSocket Connection Indicator
 * ==============================
 * Shows real-time connection status in the UI.
 */

import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const WebSocketIndicator = ({ isConnected, connectionError, onReconnect }) => {
  return (
    <div className="flex items-center gap-2">
      {isConnected ? (
        <div className="flex items-center gap-1.5 text-emerald-500">
          <Wifi className="w-4 h-4" />
          <span className="text-xs hidden sm:inline">Temps réel</span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>
      ) : connectionError ? (
        <button 
          onClick={onReconnect}
          className="flex items-center gap-1.5 text-red-500 hover:text-red-400 transition-colors"
          title={connectionError}
        >
          <WifiOff className="w-4 h-4" />
          <span className="text-xs hidden sm:inline">Déconnecté</span>
          <RefreshCw className="w-3 h-3" />
        </button>
      ) : (
        <div className="flex items-center gap-1.5 text-yellow-500">
          <Wifi className="w-4 h-4 animate-pulse" />
          <span className="text-xs hidden sm:inline">Connexion...</span>
        </div>
      )}
    </div>
  );
};

export default WebSocketIndicator;
