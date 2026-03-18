import axios from 'axios';

// Universal API configuration - works on ALL Emergent domains
// Supports: emergent.host, preview.emergentagent.com, localhost
const getBackendUrl = () => {
  // Priority 1: Explicit environment variable
  if (process.env.REACT_APP_BACKEND_URL && process.env.REACT_APP_BACKEND_URL.trim() !== '') {
    return process.env.REACT_APP_BACKEND_URL;
  }
  
  // Priority 2: Always use same origin for Emergent deployments
  // This works for BOTH preview.emergentagent.com AND emergent.host
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Emergent Production: emergent.host - use same origin
    if (hostname.includes('emergent.host')) {
      return window.location.origin;
    }
    
    // Emergent Preview: preview.emergentagent.com - use same origin
    if (hostname.includes('emergentagent.com')) {
      return window.location.origin;
    }
    
    // External production: lottolab.tech -> api.lottolab.tech
    if (hostname === 'lottolab.tech' || hostname === 'www.lottolab.tech') {
      return 'https://api.lottolab.tech';
    }
    
    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8001';
    }
    
    // Default fallback: same origin (works for most deployments)
    return window.location.origin;
  }
  
  // SSR/build fallback
  return '';
};

const BACKEND_URL = getBackendUrl();
const API = `${BACKEND_URL}/api`;

// Log configuration on app start (helpful for debugging production issues)
if (typeof window !== 'undefined') {
  console.log('[LOTTOLAB] API Configuration:', {
    BACKEND_URL,
    API,
    currentOrigin: window.location.origin,
    hostname: window.location.hostname,
    envVar: process.env.REACT_APP_BACKEND_URL || 'NOT SET'
  });
}

const apiClient = axios.create({
  baseURL: API,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;

export { API, BACKEND_URL };