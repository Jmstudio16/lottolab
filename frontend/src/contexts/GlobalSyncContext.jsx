import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { API_URL } from '@/config/api';
import { toast } from 'sonner';

/**
 * GlobalSyncContext - Real-time synchronization across all components
 * Uses polling (every 10 seconds) to keep all clients in sync
 */

const GlobalSyncContext = createContext(null);

export const useGlobalSync = () => {
  const context = useContext(GlobalSyncContext);
  if (!context) {
    throw new Error('useGlobalSync must be used within a GlobalSyncProvider');
  }
  return context;
};

export const GlobalSyncProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [configVersion, setConfigVersion] = useState(1);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [newResults, setNewResults] = useState([]);
  const [newWinners, setNewWinners] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPingTime, setLastPingTime] = useState(null);
  
  // Callbacks for subscribers
  const onNewResultsRef = useRef([]);
  const onNewNotificationsRef = useRef([]);
  const onConfigChangeRef = useRef([]);
  const onNewWinnersRef = useRef([]);
  
  const headers = { Authorization: `Bearer ${token}` };

  // Subscribe to new results
  const subscribeToResults = useCallback((callback) => {
    onNewResultsRef.current.push(callback);
    return () => {
      onNewResultsRef.current = onNewResultsRef.current.filter(cb => cb !== callback);
    };
  }, []);

  // Subscribe to new notifications
  const subscribeToNotifications = useCallback((callback) => {
    onNewNotificationsRef.current.push(callback);
    return () => {
      onNewNotificationsRef.current = onNewNotificationsRef.current.filter(cb => cb !== callback);
    };
  }, []);

  // Subscribe to config changes
  const subscribeToConfigChanges = useCallback((callback) => {
    onConfigChangeRef.current.push(callback);
    return () => {
      onConfigChangeRef.current = onConfigChangeRef.current.filter(cb => cb !== callback);
    };
  }, []);

  // Subscribe to new winners
  const subscribeToWinners = useCallback((callback) => {
    onNewWinnersRef.current.push(callback);
    return () => {
      onNewWinnersRef.current = onNewWinnersRef.current.filter(cb => cb !== callback);
    };
  }, []);

  // Main sync function
  const performSync = useCallback(async () => {
    if (!token) return;

    try {
      const params = {};
      if (lastSyncTime) {
        params.last_sync = lastSyncTime;
      }
      if (configVersion) {
        params.last_config_version = configVersion;
      }

      const response = await axios.get(`${API_URL}/api/sync/global`, {
        headers,
        params
      });

      const data = response.data;
      setIsConnected(true);
      setLastPingTime(new Date());
      setLastSyncTime(data.server_time);
      
      // Handle new results
      if (data.new_results && data.new_results.length > 0) {
        setNewResults(data.new_results);
        onNewResultsRef.current.forEach(cb => cb(data.new_results));
        
        // Show toast for new results
        if (data.results_count > 0) {
          toast.success(`${data.results_count} nouveau(x) résultat(s) disponible(s)!`, {
            icon: '🎲',
            duration: 5000
          });
        }
      }

      // Handle notifications count
      setUnreadNotifications(data.unread_notifications || 0);
      
      if (data.new_notifications && data.new_notifications.length > 0) {
        onNewNotificationsRef.current.forEach(cb => cb(data.new_notifications));
      }

      // Handle config version change
      if (data.config_version > configVersion) {
        setConfigVersion(data.config_version);
        onConfigChangeRef.current.forEach(cb => cb(data.config_version));
        
        toast.info('Configuration mise à jour. Rechargement recommandé.', {
          icon: '⚙️',
          duration: 4000
        });
      }

      // Handle new winners
      if (data.new_winners && data.new_winners.length > 0) {
        setNewWinners(data.new_winners);
        onNewWinnersRef.current.forEach(cb => cb(data.new_winners));
        
        toast.success(`${data.new_winners.length} nouveau(x) ticket(s) gagnant(s)!`, {
          icon: '🏆',
          duration: 5000
        });
      }

    } catch (error) {
      console.log('Sync error:', error.response?.status || error.message);
      setIsConnected(false);
    }
  }, [token, lastSyncTime, configVersion]);

  // Light ping for quick status updates
  const performPing = useCallback(async () => {
    if (!token) return;

    try {
      const response = await axios.get(`${API_URL}/api/sync/ping`, {
        headers,
        params: { last_config_version: configVersion }
      });

      const data = response.data;
      setIsConnected(true);
      setLastPingTime(new Date());
      setUnreadNotifications(data.unread_notifications || 0);

      if (data.config_changed) {
        // Trigger full sync if config changed
        performSync();
      }
    } catch (error) {
      setIsConnected(false);
    }
  }, [token, configVersion, performSync]);

  // Force refresh all data
  const forceRefresh = useCallback(() => {
    setLastSyncTime(null);
    performSync();
  }, [performSync]);

  // Start polling when authenticated
  useEffect(() => {
    if (!token) {
      setIsConnected(false);
      return;
    }

    // Initial sync
    performSync();

    // Poll every 10 seconds (full sync)
    const syncInterval = setInterval(performSync, 10000);

    // Light ping every 5 seconds
    const pingInterval = setInterval(performPing, 5000);

    return () => {
      clearInterval(syncInterval);
      clearInterval(pingInterval);
    };
  }, [token, performSync, performPing]);

  const value = {
    // State
    isConnected,
    lastSyncTime,
    lastPingTime,
    unreadNotifications,
    newResults,
    newWinners,
    configVersion,
    
    // Actions
    forceRefresh,
    performSync,
    
    // Subscriptions
    subscribeToResults,
    subscribeToNotifications,
    subscribeToConfigChanges,
    subscribeToWinners
  };

  return (
    <GlobalSyncContext.Provider value={value}>
      {children}
    </GlobalSyncContext.Provider>
  );
};

export default GlobalSyncProvider;
