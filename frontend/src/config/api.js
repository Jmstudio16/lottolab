// Configuration file for production deployment
// This file helps configure the app for different environments

export const getApiUrl = () => {
  // Priority 1: Use environment variable if set
  if (process.env.REACT_APP_BACKEND_URL && process.env.REACT_APP_BACKEND_URL !== '') {
    return process.env.REACT_APP_BACKEND_URL;
  }
  
  // Priority 2: Use current window origin (same domain deployment)
  // This works when frontend and backend are on the same domain
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Local development - use port 8001
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8001';
    }
    
    // Emergent and other deployments - use same origin
    return window.location.origin;
  }
  
  // Fallback for SSR or build time
  return '';
};

export const API_URL = getApiUrl();

// For debugging
export const logApiConfig = () => {
  console.log('API Configuration:', {
    REACT_APP_BACKEND_URL: process.env.REACT_APP_BACKEND_URL,
    windowOrigin: typeof window !== 'undefined' ? window.location.origin : 'N/A',
    resolvedApiUrl: API_URL
  });
};
