import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import apiClient from './client';
import { offlineDB } from '../services/offlineDB';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const initRef = useRef(false);

  // Initialize from IndexedDB (with localStorage fallback for migration)
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    
    const initAuth = async () => {
      try {
        // Wait for IndexedDB to be ready
        await offlineDB.ensureReady();
        
        // Try to get session from IndexedDB first
        const session = await offlineDB.getSession();
        
        if (session) {
          console.log('[Auth] Session found in IndexedDB');
          setUser(session.user);
          setToken(session.token);
          
          // Also update localStorage for backwards compatibility
          localStorage.setItem('token', session.token);
          localStorage.setItem('user', JSON.stringify(session.user));
          
          // Try to verify token if online
          if (navigator.onLine) {
            await verifyTokenQuietly(session.token);
          } else {
            console.log('[Auth] Offline - using cached session');
            setIsOfflineSession(true);
            setLoading(false);
          }
          return;
        }
        
        // Fallback: Check localStorage (migration path)
        const localToken = localStorage.getItem('token');
        const localUser = localStorage.getItem('user');
        
        if (localToken && localUser) {
          console.log('[Auth] Migrating session from localStorage to IndexedDB');
          const userData = JSON.parse(localUser);
          
          // Save to IndexedDB for future use
          await offlineDB.saveSession(userData, localToken);
          
          setUser(userData);
          setToken(localToken);
          
          // Verify if online
          if (navigator.onLine) {
            await verifyTokenQuietly(localToken);
          } else {
            setIsOfflineSession(true);
            setLoading(false);
          }
          return;
        }
        
        // No session found
        console.log('[Auth] No session found');
        setLoading(false);
        
      } catch (error) {
        console.error('[Auth] Init error:', error);
        // Fallback to localStorage
        const localToken = localStorage.getItem('token');
        const localUser = localStorage.getItem('user');
        if (localToken && localUser) {
          setUser(JSON.parse(localUser));
          setToken(localToken);
        }
        setLoading(false);
      }
    };
    
    initAuth();
  }, []);

  // Verify token quietly (don't logout on failure if offline)
  const verifyTokenQuietly = async (authToken) => {
    try {
      const response = await apiClient.get('/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      const freshUserData = response.data;
      setUser(freshUserData);
      setIsOfflineSession(false);
      
      // Update storage
      localStorage.setItem('user', JSON.stringify(freshUserData));
      await offlineDB.saveSession(freshUserData, authToken);
      
      console.log('[Auth] Token verified successfully');
    } catch (error) {
      if (error.response?.status === 401) {
        // Token is invalid - logout
        console.log('[Auth] Token invalid, logging out');
        await logout();
      } else {
        // Network error - keep session but mark as offline
        console.log('[Auth] Verification failed (network), using cached session');
        setIsOfflineSession(true);
      }
    } finally {
      setLoading(false);
    }
  };

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
  }, [token, isOfflineSession]);

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
      
      // Update storage
      localStorage.setItem('user', JSON.stringify(freshUserData));
      await offlineDB.saveSession(freshUserData, token);
      
      return freshUserData;
    } catch (error) {
      console.error('[Auth] Error refreshing user:', error);
      return null;
    }
  }, [token]);

  // Update user locally (for immediate UI feedback)
  const updateUserLocal = useCallback(async (updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('user', JSON.stringify(updated));
      // Also update IndexedDB
      offlineDB.updateSessionUser(updates).catch(console.error);
      return updated;
    });
  }, []);

  // Login
  const login = useCallback(async (email, password) => {
    try {
      console.log('[Auth] Attempting login to:', apiClient.defaults.baseURL);
      const response = await apiClient.post('/auth/login', { email, password });
      const { token: authToken, user: userData, redirect_path } = response.data;
      
      // Save to both storage systems
      localStorage.setItem('token', authToken);
      localStorage.setItem('user', JSON.stringify(userData));
      await offlineDB.saveSession(userData, authToken);
      
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
    
    // Clear all storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    try {
      await offlineDB.clearSession();
    } catch (e) {
      console.error('[Auth] Error clearing IndexedDB session:', e);
    }
    
    setUser(null);
    setToken(null);
    setIsOfflineSession(false);
    
    window.location.href = '/login';
  }, []);

  // Get token (async, from IndexedDB with localStorage fallback)
  const getToken = useCallback(async () => {
    // Try IndexedDB first
    try {
      const idbToken = await offlineDB.getToken();
      if (idbToken) return idbToken;
    } catch (e) {
      console.warn('[Auth] IndexedDB token fetch failed:', e);
    }
    
    // Fallback to localStorage
    return localStorage.getItem('token');
  }, []);

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