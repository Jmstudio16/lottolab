import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '@/config/api';
import { useAuth } from '@/api/auth';

const LogoContext = createContext({
  displayLogoUrl: null,
  companyLogoUrl: null,
  systemLogoUrl: '/assets/logos/lottolab-logo.png',
  companyName: 'LOTTOLAB',
  userPhotoUrl: null,
  refreshLogo: () => {},
  isLoading: true
});

export const LogoProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [logoState, setLogoState] = useState({
    displayLogoUrl: null,
    companyLogoUrl: null,
    systemLogoUrl: '/assets/logos/lottolab-logo.png',
    companyName: 'LOTTOLAB',
    userPhotoUrl: null,
    isLoading: true
  });

  const fetchLogoInfo = useCallback(async () => {
    if (!token) {
      setLogoState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      // Fetch company profile for logo
      const res = await axios.get(`${API_URL}/api/company/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = res.data;
      const companyLogo = data.company_logo_url || data.logo_url;
      
      // Build full URL for logo
      let fullLogoUrl = null;
      if (companyLogo) {
        fullLogoUrl = companyLogo.startsWith('http') ? companyLogo : `${API_URL}${companyLogo}`;
      }

      // Get user photo if available
      let userPhoto = user?.photo_url || user?.profile_image_url;
      if (userPhoto && !userPhoto.startsWith('http')) {
        userPhoto = `${API_URL}${userPhoto}`;
      }

      setLogoState({
        displayLogoUrl: fullLogoUrl || '/assets/logos/lottolab-logo.png',
        companyLogoUrl: fullLogoUrl,
        systemLogoUrl: '/assets/logos/lottolab-logo.png',
        companyName: data.company_name || 'LOTTOLAB',
        userPhotoUrl: userPhoto,
        isLoading: false
      });

    } catch (err) {
      console.log('[LogoContext] Using default logo');
      setLogoState(prev => ({
        ...prev,
        isLoading: false,
        displayLogoUrl: '/assets/logos/lottolab-logo.png'
      }));
    }
  }, [token, user]);

  useEffect(() => {
    fetchLogoInfo();
  }, [fetchLogoInfo]);

  const refreshLogo = useCallback(() => {
    fetchLogoInfo();
  }, [fetchLogoInfo]);

  return (
    <LogoContext.Provider value={{ ...logoState, refreshLogo }}>
      {children}
    </LogoContext.Provider>
  );
};

export const useLogoContext = () => {
  const context = useContext(LogoContext);
  if (!context) {
    throw new Error('useLogoContext must be used within a LogoProvider');
  }
  return context;
};

export default LogoContext;
