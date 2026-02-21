import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const LogoContext = createContext();

export const useLogoContext = () => {
  const context = useContext(LogoContext);
  if (!context) {
    throw new Error('useLogoContext must be used within a LogoProvider');
  }
  return context;
};

export const LogoProvider = ({ children }) => {
  const [logoData, setLogoData] = useState({
    displayLogoUrl: '/assets/logos/lottolab-logo.png',
    displayName: 'LOTTOLAB',
    systemLogoUrl: '/assets/logos/lottolab-logo.png',
    systemName: 'LOTTOLAB',
    companyLogoUrl: null,
    companyName: null,
    hasCompanyLogo: false,
    loading: true,
    error: null
  });

  const fetchLogoData = async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      // No token - fetch system settings only
      try {
        const response = await axios.get(`${API_URL}/api/system/settings`);
        const data = response.data;
        setLogoData(prev => ({
          ...prev,
          displayLogoUrl: data.system_logo_url || '/assets/logos/lottolab-logo.png',
          displayName: data.system_name || 'LOTTOLAB',
          systemLogoUrl: data.system_logo_url || '/assets/logos/lottolab-logo.png',
          systemName: data.system_name || 'LOTTOLAB',
          loading: false
        }));
      } catch (err) {
        setLogoData(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to load system settings'
        }));
      }
      return;
    }

    // With token - fetch full logo data
    try {
      const response = await axios.get(`${API_URL}/api/logo/display`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data;
      
      setLogoData({
        displayLogoUrl: data.display_logo_url || '/assets/logos/lottolab-logo.png',
        displayName: data.display_name || 'LOTTOLAB',
        systemLogoUrl: data.system_logo_url || '/assets/logos/lottolab-logo.png',
        systemName: data.system_name || 'LOTTOLAB',
        companyLogoUrl: data.company_logo_url,
        companyName: data.company_name,
        hasCompanyLogo: data.has_company_logo || false,
        loading: false,
        error: null
      });
    } catch (err) {
      console.error('Failed to fetch logo data:', err);
      setLogoData(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load logo'
      }));
    }
  };

  const refreshLogo = () => {
    fetchLogoData();
  };

  useEffect(() => {
    fetchLogoData();
  }, []);

  const value = {
    ...logoData,
    refreshLogo,
    getDisplayLogo: () => logoData.displayLogoUrl,
    getDisplayName: () => logoData.displayName
  };

  return (
    <LogoContext.Provider value={value}>
      {children}
    </LogoContext.Provider>
  );
};

export default LogoContext;
