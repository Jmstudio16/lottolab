import axios from 'axios';

// Production deployment configuration for lottolab.tech
// This handles multiple deployment scenarios
const getBackendUrl = () => {
  // Priority 1: Explicit environment variable (set during build)
  if (process.env.REACT_APP_BACKEND_URL && process.env.REACT_APP_BACKEND_URL.trim() !== '') {
    console.log('[API Config] Using REACT_APP_BACKEND_URL:', process.env.REACT_APP_BACKEND_URL);
    return process.env.REACT_APP_BACKEND_URL;
  }
  
  // Priority 2: Runtime environment variable check for SPA deployments
  if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__?.BACKEND_URL) {
    console.log('[API Config] Using runtime config:', window.__RUNTIME_CONFIG__.BACKEND_URL);
    return window.__RUNTIME_CONFIG__.BACKEND_URL;
  }
  
  // Priority 3: Same-origin deployment (frontend and backend on same domain)
  // This works when your nginx/server proxies /api/* to your backend
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    console.log('[API Config] Using same-origin:', origin);
    return origin;
  }
  
  // Fallback for SSR/build time
  return '';
};

const BACKEND_URL = getBackendUrl();
const API = `${BACKEND_URL}/api`;

// Log configuration on app start (helpful for debugging)
if (typeof window !== 'undefined') {
  console.log('[LOTTOLAB] API Configuration:', {
    BACKEND_URL,
    API,
    origin: window.location.origin,
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