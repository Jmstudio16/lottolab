import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const LotoPamAuthContext = createContext(null);

export const useLotoPamAuth = () => useContext(LotoPamAuthContext);

export const LotoPamAuthProvider = ({ children }) => {
  const [player, setPlayer] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('lotopam_token'));
  const [wsConnected, setWsConnected] = useState(false);
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const apiClient = axios.create({
    baseURL: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  // WebSocket notification handler
  const handleWsMessage = useCallback((message) => {
    const { type, data } = message;
    
    switch (type) {
      case 'result_published':
        toast.info(`Résultat publié: ${data.lottery_name}`, {
          description: `Numéros: ${data.winning_numbers?.join('-')}`
        });
        break;
        
      case 'ticket_won':
        toast.success(`🎉 Félicitations! Vous avez gagné!`, {
          description: `+${data.amount_won?.toLocaleString()} HTG`,
          duration: 15000
        });
        refreshWallet();
        break;
        
      case 'ticket_lost':
        toast.info('Résultat de votre ticket', {
          description: 'Bonne chance pour le prochain tirage!'
        });
        break;
        
      case 'wallet_credited':
        toast.success('Solde crédité!', {
          description: `+${data.amount?.toLocaleString()} HTG`
        });
        refreshWallet();
        break;
        
      case 'deposit_approved':
        toast.success('Dépôt approuvé!', {
          description: `${data.amount?.toLocaleString()} HTG crédité`
        });
        refreshWallet();
        break;
        
      case 'deposit_rejected':
        toast.error('Dépôt rejeté', {
          description: data.reason || 'Contactez le support'
        });
        break;
        
      case 'withdrawal_processed':
        toast.success('Retrait traité!', {
          description: `${data.amount?.toLocaleString()} HTG envoyé`
        });
        break;
        
      case 'withdrawal_rejected':
        toast.warning('Retrait rejeté', {
          description: data.refunded ? 'Solde remboursé' : data.reason
        });
        if (data.refunded) refreshWallet();
        break;
        
      case 'kyc_approved':
        toast.success('Compte vérifié!', {
          description: 'Retraits maintenant disponibles'
        });
        loadPlayer();
        break;
        
      case 'kyc_rejected':
        toast.error('Vérification rejetée', {
          description: data.reason || 'Resoumettre vos documents'
        });
        break;
        
      default:
        console.log('[WS] Message:', type, data);
    }
  }, []);

  // Connect WebSocket
  const connectWebSocket = useCallback((playerId) => {
    if (!playerId || wsRef.current?.readyState === WebSocket.OPEN) return;
    
    const wsUrl = API_URL
      ?.replace('https://', 'wss://')
      .replace('http://', 'ws://');
    
    try {
      wsRef.current = new WebSocket(`${wsUrl}/ws/player/${playerId}`);
      
      wsRef.current.onopen = () => {
        console.log('[WS] Connected');
        setWsConnected(true);
      };
      
      wsRef.current.onclose = () => {
        console.log('[WS] Disconnected');
        setWsConnected(false);
        
        // Reconnect after 5s
        if (token) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket(player?.player_id);
          }, 5000);
        }
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWsMessage(message);
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };
      
      // Keep alive ping
      const pingInterval = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send('ping');
        }
      }, 30000);
      
      wsRef.current.pingInterval = pingInterval;
    } catch (error) {
      console.error('[WS] Connection error:', error);
    }
  }, [token, handleWsMessage]);

  useEffect(() => {
    if (token) {
      loadPlayer();
    } else {
      setLoading(false);
    }
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        if (wsRef.current.pingInterval) {
          clearInterval(wsRef.current.pingInterval);
        }
        wsRef.current.close();
      }
    };
  }, [token]);

  const loadPlayer = async () => {
    try {
      const response = await apiClient.get('/api/online/me');
      setPlayer(response.data.player);
      setWallet(response.data.wallet);
      
      // Connect WebSocket after loading player
      connectWebSocket(response.data.player?.player_id);
    } catch (error) {
      console.error('Failed to load player:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await apiClient.post('/api/online/login', { email, password });
    const { token: newToken, player: playerData, wallet: walletData } = response.data;
    
    localStorage.setItem('lotopam_token', newToken);
    setToken(newToken);
    setPlayer(playerData);
    setWallet(walletData);
    
    // Connect WebSocket
    setTimeout(() => connectWebSocket(playerData?.player_id), 500);
    
    return response.data;
  };

  const register = async (data) => {
    const response = await apiClient.post('/api/online/register', data);
    const { token: newToken, player: playerData } = response.data;
    
    localStorage.setItem('lotopam_token', newToken);
    setToken(newToken);
    setPlayer(playerData);
    setWallet({ balance: 0, currency: 'HTG' });
    
    // Connect WebSocket
    setTimeout(() => connectWebSocket(playerData?.player_id), 500);
    
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('lotopam_token');
    setToken(null);
    setPlayer(null);
    setWallet(null);
    
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const refreshWallet = async () => {
    try {
      const response = await apiClient.get('/api/online/wallet');
      setWallet({ balance: response.data.balance, currency: response.data.currency });
    } catch (error) {
      console.error('Failed to refresh wallet:', error);
    }
  };

  const value = {
    player,
    wallet,
    loading,
    isAuthenticated: !!player,
    wsConnected,
    login,
    register,
    logout,
    refreshWallet,
    apiClient: axios.create({
      baseURL: API_URL,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
  };

  return (
    <LotoPamAuthContext.Provider value={value}>
      {children}
    </LotoPamAuthContext.Provider>
  );
};

export default LotoPamAuthProvider;
