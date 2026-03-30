/**
 * LOTTOLAB WebSocket Context v2.0
 * ================================
 * Global WebSocket provider with sounds and visual notifications.
 * 
 * Events handled:
 * - RESULT_PUBLISHED: New lottery result
 * - TICKET_SOLD: New ticket created
 * - TICKET_WINNER: Ticket won
 * - TICKET_PAID: Ticket paid out
 * - TICKET_DELETED: Ticket voided
 * - LOTTERY_TOGGLED: Lottery status changed
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/api/auth';
import { toast } from 'sonner';

// ============ EVENT TYPES ============
export const WSEventType = {
  // Results
  RESULT_PUBLISHED: 'RESULT_PUBLISHED',
  RESULT_UPDATED: 'RESULT_UPDATED',
  
  // Tickets
  TICKET_SOLD: 'TICKET_SOLD',
  TICKET_WINNER: 'TICKET_WINNER',
  TICKET_PAID: 'TICKET_PAID',
  TICKET_DELETED: 'TICKET_DELETED',
  
  // Lotteries
  LOTTERY_TOGGLED: 'LOTTERY_TOGGLED',
  LOTTERY_UPDATED: 'LOTTERY_UPDATED',
  
  // Schedules
  SCHEDULE_UPDATED: 'SCHEDULE_UPDATED',
  
  // System
  SYNC_REQUIRED: 'SYNC_REQUIRED',
  CONNECTION_ESTABLISHED: 'CONNECTION_ESTABLISHED',
  HEARTBEAT: 'HEARTBEAT',
};

// ============ AUDIO MANAGER ============
class AudioManager {
  constructor() {
    this.audioContext = null;
    this.sounds = {};
    this.enabled = true;
    this.volume = 0.5;
  }

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  // Generate synthetic notification sounds
  playResultPublished() {
    this.init();
    this.playTone([523, 659, 784, 1047], 0.15, 'sine'); // C-E-G-C (major chord)
  }

  playTicketWinner() {
    this.init();
    // Victory fanfare
    this.playTone([523, 659, 784], 0.1, 'triangle');
    setTimeout(() => this.playTone([784, 1047], 0.15, 'triangle'), 150);
    setTimeout(() => this.playTone([1047, 1318], 0.2, 'sine'), 300);
  }

  playTicketSold() {
    this.init();
    this.playTone([800, 1000], 0.08, 'sine'); // Quick ping
  }

  playTicketPaid() {
    this.init();
    this.playTone([600, 800, 1000], 0.1, 'sine'); // Cash register sound
  }

  playLotteryToggled() {
    this.init();
    this.playTone([440, 550], 0.12, 'square'); // Alert tone
  }

  playGenericNotification() {
    this.init();
    this.playTone([660, 880], 0.1, 'sine');
  }

  playTone(frequencies, duration = 0.15, type = 'sine') {
    if (!this.enabled || !this.audioContext) return;

    try {
      const now = this.audioContext.currentTime;
      
      frequencies.forEach((freq, i) => {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freq, now + i * 0.05);
        
        gainNode.gain.setValueAtTime(this.volume * 0.3, now + i * 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start(now + i * 0.05);
        oscillator.stop(now + i * 0.05 + duration);
      });
    } catch (err) {
      console.warn('[Audio] Error playing sound:', err);
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
  }
}

// Global audio manager instance
const audioManager = new AudioManager();

// ============ GET WS URL ============
const getWsUrl = (token) => {
  const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
  const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
  const wsHost = backendUrl.replace(/^https?:\/\//, '');
  return `${wsProtocol}://${wsHost}/api/ws?token=${token}`;
};

// ============ CONTEXT ============
const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [eventHistory, setEventHistory] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const listenersRef = useRef(new Map());
  const maxReconnectAttempts = 10;
  const reconnectDelay = 3000;

  // Event listeners management
  const addEventListener = useCallback((eventType, callback) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set());
    }
    listenersRef.current.get(eventType).add(callback);
    
    // Return cleanup function
    return () => {
      listenersRef.current.get(eventType)?.delete(callback);
    };
  }, []);

  // Notify all listeners for an event type
  const notifyListeners = useCallback((eventType, data) => {
    const listeners = listenersRef.current.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`[WS] Listener error for ${eventType}:`, err);
        }
      });
    }
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      setLastMessage(data);
      
      // Add to history (keep last 50)
      setEventHistory(prev => [{
        ...data,
        receivedAt: new Date().toISOString()
      }, ...prev.slice(0, 49)]);
      
      // Notify specific listeners
      notifyListeners(data.type, data);
      notifyListeners('*', data); // Wildcard listeners
      
      // Play sounds and show toasts based on event type
      if (data.type !== WSEventType.HEARTBEAT && data.type !== WSEventType.CONNECTION_ESTABLISHED) {
        handleEventNotification(data);
      }
      
    } catch (err) {
      console.error('[WS] Error parsing message:', err);
    }
  }, [notifyListeners]);

  // Handle event notifications (sounds + toasts)
  const handleEventNotification = useCallback((data) => {
    switch (data.type) {
      case WSEventType.RESULT_PUBLISHED:
        if (soundEnabled) audioManager.playResultPublished();
        toast.success(
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-bounce">🎰</span>
            <div>
              <p className="font-bold">Nouveau Résultat!</p>
              <p className="text-sm opacity-90">{data.data?.lottery_name} - {data.data?.draw_name}</p>
              <p className="font-mono font-bold text-amber-400">{data.data?.winning_numbers}</p>
            </div>
          </div>,
          { duration: 10000 }
        );
        break;
        
      case WSEventType.TICKET_WINNER:
        if (soundEnabled) audioManager.playTicketWinner();
        toast.success(
          <div className="flex items-center gap-2">
            <span className="text-3xl animate-pulse">🎉</span>
            <div>
              <p className="font-bold text-emerald-400">TICKET GAGNANT!</p>
              <p className="text-sm">{data.data?.ticket_code}</p>
              <p className="font-bold text-xl text-emerald-400">{data.data?.win_amount?.toLocaleString()} HTG</p>
            </div>
          </div>,
          { duration: 15000 }
        );
        break;
        
      case WSEventType.TICKET_SOLD:
        if (soundEnabled) audioManager.playTicketSold();
        toast.info(
          <div className="flex items-center gap-2">
            <span className="text-lg">🎫</span>
            <div>
              <p className="font-medium">Nouveau Ticket</p>
              <p className="text-sm opacity-80">{data.data?.ticket_code} - {data.data?.total_amount?.toLocaleString()} HTG</p>
            </div>
          </div>,
          { duration: 4000 }
        );
        break;
        
      case WSEventType.TICKET_PAID:
        if (soundEnabled) audioManager.playTicketPaid();
        toast.info(
          <div className="flex items-center gap-2">
            <span className="text-lg">💰</span>
            <div>
              <p className="font-medium">Ticket Payé</p>
              <p className="text-sm opacity-80">{data.data?.ticket_code} - {data.data?.paid_amount?.toLocaleString()} HTG</p>
            </div>
          </div>,
          { duration: 5000 }
        );
        break;
        
      case WSEventType.TICKET_DELETED:
        toast.warning(
          <div className="flex items-center gap-2">
            <span className="text-lg">🗑️</span>
            <div>
              <p className="font-medium">Ticket Supprimé</p>
              <p className="text-sm opacity-80">{data.data?.ticket_code}</p>
            </div>
          </div>,
          { duration: 5000 }
        );
        break;
        
      case WSEventType.LOTTERY_TOGGLED:
        if (soundEnabled) audioManager.playLotteryToggled();
        if (data.data?.is_active) {
          toast.success(
            <div className="flex items-center gap-2">
              <span className="text-lg">✅</span>
              <div>
                <p className="font-medium">Loterie Activée</p>
                <p className="text-sm opacity-80">{data.data?.lottery_name}</p>
              </div>
            </div>,
            { duration: 5000 }
          );
        } else {
          toast.warning(
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="font-medium">Loterie Désactivée</p>
                <p className="text-sm opacity-80">{data.data?.lottery_name}</p>
              </div>
            </div>,
            { duration: 5000 }
          );
        }
        break;
        
      case WSEventType.SYNC_REQUIRED:
        toast.info('🔄 Synchronisation en cours...', { duration: 3000 });
        break;
        
      default:
        // Unknown event - silent
        break;
    }
  }, [soundEnabled]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!token) {
      console.log('[WS] No token available');
      return;
    }
    
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    const wsUrl = getWsUrl(token);
    console.log('[WS] Connecting...');
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('[WS] Connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
        
        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'PING' }));
          }
        }, 25000);
      };
      
      wsRef.current.onmessage = handleMessage;
      
      wsRef.current.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code);
        setIsConnected(false);
        
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        
        // Auto reconnect
        if (event.code !== 1000 && event.code !== 4001 && event.code !== 4002) {
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current += 1;
            const delay = reconnectDelay * Math.min(reconnectAttempts.current, 5);
            console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          } else {
            setConnectionError('Connexion perdue. Veuillez rafraîchir la page.');
          }
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error('[WS] Error:', error);
      };
      
    } catch (err) {
      console.error('[WS] Connection error:', err);
      setConnectionError('Impossible de se connecter');
    }
  }, [token, handleMessage]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
    }
    setIsConnected(false);
  }, []);

  // Send message
  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Toggle sound
  const toggleSound = useCallback(() => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    audioManager.setEnabled(newState);
    localStorage.setItem('ws_sound_enabled', JSON.stringify(newState));
    return newState;
  }, [soundEnabled]);

  // Load sound preference
  useEffect(() => {
    const saved = localStorage.getItem('ws_sound_enabled');
    if (saved !== null) {
      const enabled = JSON.parse(saved);
      setSoundEnabled(enabled);
      audioManager.setEnabled(enabled);
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    if (token) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  const value = {
    isConnected,
    lastMessage,
    connectionError,
    eventHistory,
    soundEnabled,
    sendMessage,
    connect,
    disconnect,
    toggleSound,
    addEventListener,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
};

// Hook for subscribing to specific event types
export const useWebSocketEvent = (eventType, callback) => {
  const { addEventListener } = useWebSocketContext();
  
  useEffect(() => {
    const cleanup = addEventListener(eventType, callback);
    return cleanup;
  }, [eventType, callback, addEventListener]);
};

export default WebSocketContext;
