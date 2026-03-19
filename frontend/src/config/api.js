// Configuration file for production deployment
// This file helps configure the app for different environments

export const getApiUrl = () => {
  // IMPORTANT: Detect environment from hostname FIRST
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production: lottolab.tech -> ALWAYS use same origin (API is at /api)
    // This overrides any environment variable because api.lottolab.tech doesn't exist
    if (hostname === 'lottolab.tech' || hostname === 'www.lottolab.tech') {
      return window.location.origin;
    }
    
    // Emergent: ALWAYS use same origin
    if (hostname.includes('emergent.host') || hostname.includes('emergentagent.com')) {
      return window.location.origin;
    }
    
    // Local development - use port 8001
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8001';
    }
  }
  
  // Fallback: use environment variable or same origin
  if (process.env.REACT_APP_BACKEND_URL && process.env.REACT_APP_BACKEND_URL !== '') {
    return process.env.REACT_APP_BACKEND_URL;
  }
  
  // Default: same origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
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
