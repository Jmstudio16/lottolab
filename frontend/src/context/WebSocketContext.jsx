import { API_URL } from '@/config/api';
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';

const WebSocketContext = createContext(null);

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children, playerId, isAdmin = false, userId = null }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  
  
  // Convert HTTP URL to WebSocket URL
  const getWsUrl = useCallback(() => {
    const baseUrl = API_URL?.replace('https://', 'wss://').replace('http://', 'ws://');
    if (isAdmin && userId) {
      return `${baseUrl}/ws/admin/${userId}`;
    }
    if (playerId) {
      return `${baseUrl}/ws/player/${playerId}`;
    }
    return null;
  }, [API_URL, playerId, isAdmin, userId]);
  
  const connect = useCallback(() => {
    const wsUrl = getWsUrl();
    if (!wsUrl) return;
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('[WebSocket] Connected');
        setIsConnected(true);
      };
      
      wsRef.current.onclose = (event) => {
        console.log('[WebSocket] Disconnected', event.code);
        setIsConnected(false);
        
        // Reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[WebSocket] Attempting reconnect...');
          connect();
        }, 5000);
      };
      
      wsRef.current.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[WebSocket] Message received:', message);
          setLastMessage(message);
          handleNotification(message);
        } catch (e) {
          console.error('[WebSocket] Parse error:', e);
        }
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
    }
  }, [getWsUrl]);
  
  const handleNotification = (message) => {
    const { type, data } = message;
    
    switch (type) {
      // Player notifications
      case 'result_published':
        toast.info(`Résultat publié: ${data.lottery_name}`, {
          description: `Numéros: ${data.winning_numbers?.join(', ')}`
        });
        break;
        
      case 'ticket_won':
        toast.success(`Félicitations! Vous avez gagné!`, {
          description: `Montant: ${data.amount_won?.toLocaleString()} HTG`,
          duration: 10000
        });
        // Play celebration sound or animation
        break;
        
      case 'ticket_lost':
        toast.info('Résultat de votre ticket', {
          description: 'Pas de gain cette fois. Bonne chance pour le prochain!'
        });
        break;
        
      case 'wallet_credited':
        toast.success('Solde crédité!', {
          description: `+${data.amount?.toLocaleString()} HTG - ${data.reason}`
        });
        break;
        
      case 'wallet_debited':
        toast.info('Transaction effectuée', {
          description: `-${data.amount?.toLocaleString()} HTG`
        });
        break;
        
      case 'deposit_approved':
        toast.success('Dépôt approuvé!', {
          description: `${data.amount?.toLocaleString()} HTG ajouté à votre compte`
        });
        break;
        
      case 'deposit_rejected':
        toast.error('Dépôt rejeté', {
          description: data.reason || 'Contactez le support pour plus d\'informations'
        });
        break;
        
      case 'withdrawal_processed':
        toast.success('Retrait traité!', {
          description: `${data.amount?.toLocaleString()} HTG envoyé à ${data.payout_phone}`
        });
        break;
        
      case 'withdrawal_rejected':
        toast.warning('Retrait rejeté', {
          description: data.refunded ? 'Votre solde a été remboursé' : data.reason
        });
        break;
        
      case 'kyc_approved':
        toast.success('Compte vérifié!', {
          description: 'Vous pouvez maintenant effectuer des retraits'
        });
        break;
        
      case 'kyc_rejected':
        toast.error('Vérification KYC rejetée', {
          description: data.reason || 'Veuillez resoumettre vos documents'
        });
        break;
        
      // Admin notifications
      case 'new_deposit':
        toast.info('Nouveau dépôt!', {
          description: `${data.player_name} - ${data.amount?.toLocaleString()} HTG (${data.method})`
        });
        break;
        
      case 'new_withdrawal':
        toast.warning('Nouvelle demande de retrait', {
          description: `${data.player_name} - ${data.amount?.toLocaleString()} HTG`
        });
        break;
        
      case 'fraud_alert':
        toast.error('Alerte Fraude!', {
          description: `${data.reason}: ${data.details}`,
          duration: 15000
        });
        break;
        
      case 'high_win':
        toast.info('Gros gain détecté!', {
          description: `${data.amount_won?.toLocaleString()} HTG - Ticket ${data.ticket_id?.slice(0, 12)}`
        });
        break;
        
      default:
        console.log('[WebSocket] Unknown notification type:', type);
    }
  };
  
  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
    }
  }, []);
  
  // Keep connection alive with ping
  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendMessage('ping');
      }
    }, 30000);
    
    return () => clearInterval(pingInterval);
  }, [sendMessage]);
  
  // Connect on mount
  useEffect(() => {
    if (playerId || (isAdmin && userId)) {
      connect();
    }
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [playerId, isAdmin, userId, connect]);
  
  return (
    <WebSocketContext.Provider value={{
      isConnected,
      lastMessage,
      sendMessage
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketProvider;
