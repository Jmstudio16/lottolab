import React, { createContext, useState, useContext, useEffect } from 'react';
import apiClient from './client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      verifyToken();
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async () => {
    try {
      const response = await apiClient.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      console.log('[Auth] Attempting login to:', apiClient.defaults.baseURL);
      const response = await apiClient.post('/auth/login', { email, password });
      const { token, user: userData, redirect_path } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
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
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  // Add token from localStorage
  const token = localStorage.getItem('token');
  return { ...context, token };
};