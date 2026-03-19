// Configuration file for production deployment
// This file helps configure the app for different environments

export const getApiUrl = () => {
  // Priority 1: Use environment variable if set
  if (process.env.REACT_APP_BACKEND_URL && process.env.REACT_APP_BACKEND_URL !== '') {
    return process.env.REACT_APP_BACKEND_URL;
  }
  
  // Priority 2: Detect environment from hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production: lottolab.tech -> api.lottolab.tech
    if (hostname === 'lottolab.tech' || hostname === 'www.lottolab.tech') {
      return 'https://api.lottolab.tech';
    }
    
    // Local development - use port 8001
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8001';
    }
    
    // Emergent preview and other deployments - use same origin
    return window.location.origin;
  }
  
  // Fallback for SSR or build time
  return '';
};

export const API_URL = getApiUrl();

// For debugging
export const logApiConfig = () => {
  console.log('[LOTTOLAB] API Configuration:', {
    BACKEND_URL: API_URL,
    API: `${API_URL}/api`,
    currentOrigin: typeof window !== 'undefined' ? window.location.origin : 'N/A',
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'N/A',
    envVar: process.env.REACT_APP_BACKEND_URL || 'NOT SET'
  });
};
