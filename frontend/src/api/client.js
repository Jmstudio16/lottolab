import axios from 'axios';

// Production deployment configuration for lottolab.tech
// Frontend: lottolab.tech (Netlify)
// Backend: api.lottolab.tech (VPS)
const getBackendUrl = () => {
  // Priority 1: Explicit environment variable (set during Netlify build)
  if (process.env.REACT_APP_BACKEND_URL && process.env.REACT_APP_BACKEND_URL.trim() !== '') {
    return process.env.REACT_APP_BACKEND_URL;
  }
  
  // Priority 2: Runtime config (for SPAs that inject config at runtime)
  if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__?.BACKEND_URL) {
    return window.__RUNTIME_CONFIG__.BACKEND_URL;
  }
  
  // Priority 3: Auto-detect based on current hostname
  // This handles the lottolab.tech -> api.lottolab.tech case
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production: lottolab.tech -> api.lottolab.tech
    if (hostname === 'lottolab.tech' || hostname === 'www.lottolab.tech') {
      return 'https://api.lottolab.tech';
    }
    
    // Emergent Preview: use same origin (Kubernetes handles /api routing)
    if (hostname.includes('preview.emergentagent.com')) {
      return window.location.origin;
    }
    
    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8001';
    }
    
    // Fallback: same origin (for other deployments with reverse proxy)
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