/**
 * WebSocket Status Indicator v2.0
 * ================================
 * Shows real-time connection status with sound toggle.
 */

import React from 'react';
import { Wifi, WifiOff, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { cn } from '@/lib/utils';

const WebSocketIndicator = ({ className, showLabel = true }) => {
  const { isConnected, connectionError, connect, soundEnabled, toggleSound } = useWebSocketContext();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Sound Toggle */}
      <button
        onClick={toggleSound}
        className={cn(
          "p-1.5 rounded-lg transition-all duration-200",
          soundEnabled 
            ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" 
            : "bg-slate-700/50 text-slate-500 hover:bg-slate-700"
        )}
        title={soundEnabled ? "Désactiver les sons" : "Activer les sons"}
        data-testid="ws-sound-toggle"
      >
        {soundEnabled ? (
          <Volume2 className="w-4 h-4" />
        ) : (
          <VolumeX className="w-4 h-4" />
        )}
      </button>

      {/* Connection Status */}
      {isConnected ? (
        <div className="flex items-center gap-1.5 text-emerald-500" data-testid="ws-connected">
          <Wifi className="w-4 h-4" />
          {showLabel && <span className="text-xs hidden sm:inline">Temps réel</span>}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>
      ) : connectionError ? (
        <button 
          onClick={connect}
          className="flex items-center gap-1.5 text-red-500 hover:text-red-400 transition-colors"
          title={connectionError}
          data-testid="ws-disconnected"
        >
          <WifiOff className="w-4 h-4" />
          {showLabel && <span className="text-xs hidden sm:inline">Déconnecté</span>}
          <RefreshCw className="w-3 h-3" />
        </button>
      ) : (
        <div className="flex items-center gap-1.5 text-yellow-500" data-testid="ws-connecting">
          <Wifi className="w-4 h-4 animate-pulse" />
          {showLabel && <span className="text-xs hidden sm:inline">Connexion...</span>}
        </div>
      )}
    </div>
  );
};

// Compact version for small spaces
export const WebSocketIndicatorCompact = ({ className }) => {
  const { isConnected, connectionError, connect } = useWebSocketContext();

  return (
    <div className={cn("flex items-center", className)}>
      {isConnected ? (
        <div className="flex items-center gap-1 text-emerald-500" title="Connecté en temps réel">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>
      ) : connectionError ? (
        <button 
          onClick={connect}
          className="text-red-500 hover:text-red-400"
          title="Cliquer pour reconnecter"
        >
          <WifiOff className="w-4 h-4" />
        </button>
      ) : (
        <Wifi className="w-4 h-4 text-yellow-500 animate-pulse" title="Connexion..." />
      )}
    </div>
  );
};

export default WebSocketIndicator;
