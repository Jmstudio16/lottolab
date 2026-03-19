import axios from 'axios';

// Universal API configuration - works on ALL environments
// IMPORTANT: Hostname detection has PRIORITY over environment variables
// because api.lottolab.tech doesn't exist - we must use same origin
const getBackendUrl = () => {
  // PRIORITY 1: Detect from hostname FIRST (overrides env var)
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production: lottolab.tech - ALWAYS use same origin
    if (hostname === 'lottolab.tech' || hostname === 'www.lottolab.tech') {
      return window.location.origin;
    }
    
    // Emergent Production: emergent.host - ALWAYS use same origin
    if (hostname.includes('emergent.host')) {
      return window.location.origin;
    }
    
    // Emergent Preview: preview.emergentagent.com - ALWAYS use same origin
    if (hostname.includes('emergentagent.com')) {
      return window.location.origin;
    }
    
    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8001';
    }
    
    // Default: same origin
    return window.location.origin;
  }
  
  // Fallback for SSR: use env var if available
  if (process.env.REACT_APP_BACKEND_URL && process.env.REACT_APP_BACKEND_URL.trim() !== '') {
    return process.env.REACT_APP_BACKEND_URL;
  }
  
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