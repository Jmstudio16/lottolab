/**
 * LOTTOLAB WebSocket Hook
 * ======================
 * React hook for real-time updates via WebSocket connection.
 * 
 * Usage:
 * const { isConnected, lastMessage, sendMessage } = useWebSocket();
 * 
 * Events received:
 * - RESULT_PUBLISHED: New lottery result
 * - TICKET_SOLD: New ticket created
 * - TICKET_WINNER: Ticket won
 * - TICKET_PAID: Ticket paid out
 * - TICKET_DELETED: Ticket voided
 * - LOTTERY_TOGGLED: Lottery status changed
 * - SYNC_REQUIRED: Client should refresh data
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/api/auth';
import { toast } from 'sonner';

// Event types
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

// Get WebSocket URL from backend URL
const getWsUrl = (token) => {
  const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
  // Convert http(s) to ws(s)
  const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
  const wsHost = backendUrl.replace(/^https?:\/\//, '');
  return `${wsProtocol}://${wsHost}/api/ws?token=${token}`;
};

export const useWebSocket = (options = {}) => {
  const { token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectAttempts = useRef(0);
  
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 3000,
    showToasts = true,
  } = options;
  
  // Handle incoming messages
  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      setLastMessage(data);
      
      // Call custom handler if provided
      if (onMessage) {
        onMessage(data);
      }
      
      // Show toast notifications for important events
      if (showToasts) {
        switch (data.type) {
          case WSEventType.RESULT_PUBLISHED:
            toast.success(`🎰 ${data.message}`, {
              description: `${data.data?.lottery_name} - ${data.data?.winning_numbers}`,
              duration: 8000,
            });
            break;
            
          case WSEventType.TICKET_WINNER:
            toast.success(`🎉 ${data.message}`, {
              description: `${data.data?.lottery_name}`,
              duration: 10000,
            });
            break;
            
          case WSEventType.TICKET_PAID:
            toast.info(`💰 ${data.message}`, {
              duration: 5000,
            });
            break;
            
          case WSEventType.LOTTERY_TOGGLED:
            if (data.data?.is_active) {
              toast.success(`✅ ${data.message}`);
            } else {
              toast.warning(`⚠️ ${data.message}`);
            }
            break;
            
          case WSEventType.SYNC_REQUIRED:
            toast.info('🔄 Synchronisation en cours...', {
              description: 'Rechargement des données',
            });
            // Could trigger a data refresh here
            break;
            
          case WSEventType.CONNECTION_ESTABLISHED:
            // Silent - just for internal use
            break;
            
          case WSEventType.HEARTBEAT:
            // Silent heartbeat
            break;
            
          default:
            // Unknown event - log for debugging
            console.log('[WS] Unknown event:', data.type);
        }
      }
    } catch (err) {
      console.error('[WS] Error parsing message:', err);
    }
  }, [onMessage, showToasts]);
  
  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!token) {
      console.log('[WS] No token available, skipping connection');
      return;
    }
    
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    const wsUrl = getWsUrl(token);
    console.log('[WS] Connecting to:', wsUrl.replace(/token=.*/, 'token=***'));
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('[WS] Connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
        
        if (onConnect) {
          onConnect();
        }
        
        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'PING' }));
          }
        }, 25000);
      };
      
      wsRef.current.onmessage = handleMessage;
      
      wsRef.current.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code, event.reason);
        setIsConnected(false);
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        
        if (onDisconnect) {
          onDisconnect(event);
        }
        
        // Auto reconnect if enabled and not a clean close
        if (autoReconnect && event.code !== 1000 && event.code !== 4001 && event.code !== 4002) {
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current += 1;
            const delay = reconnectDelay * reconnectAttempts.current;
            console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          } else {
            console.log('[WS] Max reconnect attempts reached');
            setConnectionError('Connexion perdue. Veuillez rafraîchir la page.');
          }
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error('[WS] Error:', error);
        setConnectionError('Erreur de connexion WebSocket');
        
        if (onError) {
          onError(error);
        }
      };
      
    } catch (err) {
      console.error('[WS] Connection error:', err);
      setConnectionError('Impossible de se connecter');
    }
  }, [token, handleMessage, onConnect, onDisconnect, onError, autoReconnect, maxReconnectAttempts, reconnectDelay]);
  
  // Disconnect from WebSocket
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
  
  // Send a message
  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
      return true;
    }
    console.warn('[WS] Cannot send message - not connected');
    return false;
  }, []);
  
  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  
  // Reconnect when token changes
  useEffect(() => {
    if (token && !isConnected) {
      connect();
    }
  }, [token, isConnected, connect]);
  
  return {
    isConnected,
    lastMessage,
    connectionError,
    sendMessage,
    connect,
    disconnect,
  };
};

// Context provider for app-wide WebSocket access
import React, { createContext, useContext } from 'react';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children, options = {} }) => {
  const ws = useWebSocket(options);
  
  return (
    <WebSocketContext.Provider value={ws}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

export default useWebSocket;
