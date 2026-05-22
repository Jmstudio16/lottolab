import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import apiClient from './client';
import { tokenStore } from '../services/tokenStore';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const initRef = useRef(false);

  const verifyTokenQuietly = useCallback(async (authToken) => {
    try {
      const response = await apiClient.get('/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const freshUserData = response.data;
      setUser(freshUserData);
      setIsOfflineSession(false);
      await tokenStore.setSession(freshUserData, authToken);
      console.log('[Auth] Token verified successfully');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('[Auth] Token invalid, logging out');
        await tokenStore.clearSession();
        setUser(null);
        setToken(null);
        window.location.href = '/login';
      } else {
        console.log('[Auth] Verification failed (network), using cached session');
        setIsOfflineSession(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize from IndexedDB via tokenStore (single source of truth)
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const initAuth = async () => {
      try {
        await tokenStore.hydrate();
        const cachedToken = tokenStore.getToken();
        const cachedUser = tokenStore.getUser();

        if (cachedToken && cachedUser) {
          console.log('[Auth] Session restored from IndexedDB');
          setUser(cachedUser);
          setToken(cachedToken);

          if (navigator.onLine) {
            await verifyTokenQuietly(cachedToken);
          } else {
            console.log('[Auth] Offline - using cached session');
            setIsOfflineSession(true);
            setLoading(false);
          }
          return;
        }

        console.log('[Auth] No session found');
        setLoading(false);
      } catch (error) {
        console.error('[Auth] Init error:', error);
        setLoading(false);
      }
    };

    initAuth();
  }, [verifyTokenQuietly]);

  // Revalidate when coming back online
  useEffect(() => {
    const handleOnline = async () => {
      if (token && isOfflineSession) {
        console.log('[Auth] Back online - revalidating session');
        await verifyTokenQuietly(token);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [token, isOfflineSession, verifyTokenQuietly]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (!token) return null;

    try {
      const response = await apiClient.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const freshUserData = response.data;
      setUser(freshUserData);
      setIsOfflineSession(false);
      await tokenStore.setSession(freshUserData, token);
      return freshUserData;
    } catch (error) {
      console.error('[Auth] Error refreshing user:', error);
      return null;
    }
  }, [token]);

  // Update user locally (for immediate UI feedback)
  const updateUserLocal = useCallback(async (updates) => {
    setUser(prev => ({ ...prev, ...updates }));
    try {
      await tokenStore.updateUser(updates);
    } catch (err) {
      console.error('[Auth] updateUserLocal error:', err);
    }
  }, []);

  // Login
  const login = useCallback(async (email, password) => {
    try {
      console.log('[Auth] Attempting login to:', apiClient.defaults.baseURL);
      const response = await apiClient.post('/auth/login', { email, password });
      const { token: authToken, user: userData, redirect_path } = response.data;

      await tokenStore.setSession(userData, authToken);

      setUser(userData);
      setToken(authToken);
      setIsOfflineSession(false);

      console.log('[Auth] Login successful for:', userData.email);
      return redirect_path;
    } catch (error) {
      console.error('[Auth] Login failed:', {
        url: apiClient.defaults.baseURL + '/auth/login',
        status: error.response?.status,
        message: error.response?.data?.detail || error.message,
        networkError: !error.response
      });
      throw error;
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    console.log('[Auth] Logging out');
    await tokenStore.clearSession();
    setUser(null);
    setToken(null);
    setIsOfflineSession(false);
    window.location.href = '/login';
  }, []);

  // Get token (sync — RAM)
  const getToken = useCallback(() => tokenStore.getToken(), []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      isOfflineSession,
      login,
      logout,
      refreshUser,
      updateUserLocal,
      getToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
