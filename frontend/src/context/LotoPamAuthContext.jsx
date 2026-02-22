import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const LotoPamAuthContext = createContext(null);

export const useLotoPamAuth = () => useContext(LotoPamAuthContext);

export const LotoPamAuthProvider = ({ children }) => {
  const [player, setPlayer] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('lotopam_token'));

  const apiClient = axios.create({
    baseURL: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  useEffect(() => {
    if (token) {
      loadPlayer();
    } else {
      setLoading(false);
    }
  }, [token]);

  const loadPlayer = async () => {
    try {
      const response = await apiClient.get('/api/online/me');
      setPlayer(response.data.player);
      setWallet(response.data.wallet);
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
    
    return response.data;
  };

  const register = async (data) => {
    const response = await apiClient.post('/api/online/register', data);
    const { token: newToken, player: playerData } = response.data;
    
    localStorage.setItem('lotopam_token', newToken);
    setToken(newToken);
    setPlayer(playerData);
    setWallet({ balance: 0, currency: 'HTG' });
    
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('lotopam_token');
    setToken(null);
    setPlayer(null);
    setWallet(null);
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
