/**
 * LOTTOLAB PRO - Offline Context Provider
 * ========================================
 * Global state management for offline-first APK
 * 
 * Provides:
 * - Network status (online/offline/slow)
 * - Sync status and pending count
 * - Printer connection status
 * - Cached data access
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { offlineDB } from '../services/offlineDB';
import { syncManager } from '../services/offlineSyncManager';
import { API_URL } from '../config/api';

const OfflineContext = createContext(null);

export const OfflineProvider = ({ children }) => {
  // Network state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [networkQuality, setNetworkQuality] = useState(navigator.onLine ? 'good' : 'offline');
  
  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  
  // Printer state
  const [printerConnected, setPrinterConnected] = useState(false);
  const [printerName, setPrinterName] = useState(null);
  
  // DB ready state
  const [isDBReady, setIsDBReady] = useState(false);
  
  // Mount ref
  const mountedRef = useRef(true);

  // Initialize OfflineDB
  useEffect(() => {
    mountedRef.current = true;
    
    offlineDB.init().then(() => {
      if (!mountedRef.current) return;
      setIsDBReady(true);
      console.log('[OfflineContext] IndexedDB ready');
    }).catch(err => {
      console.error('[OfflineContext] IndexedDB init error:', err);
    });
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Configure sync manager
  useEffect(() => {
    const getToken = async () => {
      try {
        const token = await offlineDB.getToken();
        if (token) return token;
      } catch (e) {
        console.warn('[OfflineContext] Token from IndexedDB failed:', e);
      }
      // Fallback to localStorage
      return localStorage.getItem('token');
    };
    
    syncManager.configure({
      apiUrl: API_URL,
      getToken
    });
    
    console.log('[OfflineContext] SyncManager configured with API:', API_URL);
    
    return () => {
      syncManager.stopSyncLoop();
    };
  }, []);

  // Listen for sync manager updates
  useEffect(() => {
    const unsubscribe = syncManager.addListener((status) => {
      if (!mountedRef.current) return;
      
      setIsOnline(status.isOnline ?? navigator.onLine);
      setIsSyncing(status.isSyncing ?? false);
      setPendingCount(status.pendingTickets ?? 0);
      setLastSync(status.lastSync);
      
      // Update network quality
      if (!status.isOnline) {
        setNetworkQuality('offline');
      } else {
        setNetworkQuality('good');
      }
    });
    
    return unsubscribe;
  }, []);

  // Monitor network quality with native events
  useEffect(() => {
    const checkQuality = () => {
      if (!mountedRef.current) return;
      
      if (!navigator.onLine) {
        setNetworkQuality('offline');
        setIsOnline(false);
        return;
      }
      
      setIsOnline(true);
      
      // Use Network Information API if available
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (connection) {
        const effectiveType = connection.effectiveType;
        if (effectiveType === '4g') {
          setNetworkQuality('good');
        } else if (effectiveType === '3g') {
          setNetworkQuality('medium');
        } else {
          setNetworkQuality('slow');
        }
      } else {
        setNetworkQuality('good');
      }
    };
    
    // Initial check
    checkQuality();
    
    // Listen for changes
    window.addEventListener('online', checkQuality);
    window.addEventListener('offline', checkQuality);
    
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      connection.addEventListener('change', checkQuality);
    }
    
    return () => {
      window.removeEventListener('online', checkQuality);
      window.removeEventListener('offline', checkQuality);
      if (connection) {
        connection.removeEventListener('change', checkQuality);
      }
    };
  }, []);

  // Force sync
  const forceSync = useCallback(async () => {
    if (!isOnline) {
      console.warn('[OfflineContext] Cannot sync - offline');
      return { success: false, reason: 'offline' };
    }
    return await syncManager.syncNow();
  }, [isOnline]);

  // Create ticket (handles online/offline)
  const createTicket = useCallback(async (ticketData) => {
    return await syncManager.createTicket(ticketData);
  }, []);

  // Get pending tickets
  const getPendingTickets = useCallback(async () => {
    return await offlineDB.getPendingTickets();
  }, []);

  // Retry failed tickets
  const retryFailedTickets = useCallback(async () => {
    return await syncManager.retryAllFailed();
  }, []);

  // Cache lotteries
  const cacheLotteries = useCallback(async (lotteries) => {
    await offlineDB.cacheLotteries(lotteries);
  }, []);

  // Get cached lotteries
  const getCachedLotteries = useCallback(async () => {
    const result = await offlineDB.getCachedLotteries();
    return result.data;
  }, []);

  // Cache config
  const cacheVendorConfig = useCallback(async (config) => {
    await offlineDB.cacheVendorConfig(config);
  }, []);

  // Get cached config
  const getVendorConfig = useCallback(async () => {
    return await offlineDB.getVendorConfig();
  }, []);

  // Cache bet limits
  const cacheBetLimits = useCallback(async (limits) => {
    await offlineDB.cacheBetLimits(limits);
  }, []);

  // Get cached bet limits
  const getCachedBetLimits = useCallback(async () => {
    const result = await offlineDB.getCachedBetLimits();
    return result.data;
  }, []);

  // Get stats
  const getStats = useCallback(async () => {
    return await offlineDB.getStats();
  }, []);

  // Should use offline mode
  const shouldUseOfflineMode = useCallback(() => {
    return !isOnline || networkQuality === 'slow';
  }, [isOnline, networkQuality]);

  // Context value
  const value = {
    // State
    isOnline,
    networkQuality,
    isSyncing,
    pendingCount,
    lastSync,
    printerConnected,
    printerName,
    isDBReady,
    
    // Methods
    forceSync,
    createTicket,
    getPendingTickets,
    retryFailedTickets,
    cacheLotteries,
    getCachedLotteries,
    cacheVendorConfig,
    getVendorConfig,
    cacheBetLimits,
    getCachedBetLimits,
    getStats,
    shouldUseOfflineMode,
    
    // Set printer status (called from PrinterManager)
    setPrinterStatus: (connected, name) => {
      setPrinterConnected(connected);
      setPrinterName(name);
    }
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
};

export default OfflineContext;
