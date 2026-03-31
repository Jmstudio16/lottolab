/**
 * LOTTOLAB - Real-time Notifications Hook
 * =========================================
 * WebSocket-based notifications with polling fallback.
 * Sound enabled by default with user preference stored in localStorage.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_URL, WS_URL } from '@/config/api';

// Notification sound (short ding)
const NOTIFICATION_SOUND = '/notification.mp3';

// Default settings
const DEFAULT_SETTINGS = {
  soundEnabled: true,
  pollInterval: 10000, // 10 seconds fallback
};

export const useNotifications = (token, user) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState('none'); // 'websocket' | 'polling' | 'none'
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('notification_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const wsRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const audioRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND);
    audioRef.current.volume = 0.5;
    
    // Preload audio
    audioRef.current.load();
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Play notification sound
  const playSound = useCallback(() => {
    if (settings.soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => {
        console.log('[Notifications] Sound play failed (user interaction required):', e.message);
      });
    }
  }, [settings.soundEnabled]);

  // Toggle sound setting
  const toggleSound = useCallback(() => {
    setSettings(prev => {
      const newSettings = { ...prev, soundEnabled: !prev.soundEnabled };
      localStorage.setItem('notification_settings', JSON.stringify(newSettings));
      return newSettings;
    });
  }, []);

  // Get endpoint based on user role
  const getEndpoint = useCallback(() => {
    if (!user?.role) return '/api/notifications';
    
    switch (user.role) {
      case 'SUPER_ADMIN':
        return '/api/saas/notifications';
      case 'COMPANY_ADMIN':
      case 'COMPANY_MANAGER':
        return '/api/company/notifications';
      case 'BRANCH_SUPERVISOR':
        return '/api/supervisor/notifications';
      case 'AGENT_POS':
        return '/api/vendeur/notifications';
      default:
        return '/api/notifications';
    }
  }, [user?.role]);

  // Fetch notifications via HTTP
  const fetchNotifications = useCallback(async () => {
    if (!token) return;

    try {
      const endpoint = getEndpoint();
      const res = await axios.get(`${API_URL}${endpoint}?limit=30`, { headers });
      const notifs = Array.isArray(res.data) ? res.data : (res.data.notifications || []);
      
      // Check for new notifications
      const currentUnread = notifs.filter(n => !n.read).length;
      if (currentUnread > unreadCount && unreadCount > 0) {
        playSound();
      }
      
      setNotifications(notifs);
      setUnreadCount(currentUnread);
      return notifs;
    } catch (error) {
      console.log('[Notifications] Fetch error:', error.message);
      return [];
    }
  }, [token, getEndpoint, unreadCount, playSound, headers]);

  // Handle incoming WebSocket message
  const handleWSMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('[WS] Received:', data.type);

      // Handle notification events
      if (['RESULT_PUBLISHED', 'TICKET_WINNER', 'TICKET_PAID', 'TICKET_SOLD', 
           'NOTIFICATION', 'ADMIN_MESSAGE', 'LOTTERY_STATUS_CHANGE'].includes(data.type)) {
        
        // Add new notification to the top
        const newNotif = {
          id: data.data?.notification_id || `ws_${Date.now()}`,
          notification_id: data.data?.notification_id || `ws_${Date.now()}`,
          type: data.type === 'RESULT_PUBLISHED' ? 'RESULT' :
                data.type === 'TICKET_WINNER' ? 'WINNER' :
                data.type === 'TICKET_PAID' ? 'PAYMENT' :
                data.type === 'TICKET_SOLD' ? 'SALE' : 'INFO',
          title: data.data?.title || data.message || 'Nouvelle notification',
          message: data.message || data.data?.message || '',
          read: false,
          created_at: data.timestamp || new Date().toISOString(),
          metadata: data.data || {}
        };

        setNotifications(prev => {
          // Avoid duplicates
          const exists = prev.some(n => n.id === newNotif.id || n.notification_id === newNotif.notification_id);
          if (exists) return prev;
          return [newNotif, ...prev].slice(0, 50); // Keep max 50
        });

        setUnreadCount(prev => prev + 1);
        playSound();
      }

      // Handle heartbeat
      if (data.type === 'HEARTBEAT' || data.type === 'CONNECTION_ESTABLISHED') {
        console.log('[WS] Connection confirmed');
      }

    } catch (e) {
      console.error('[WS] Message parse error:', e);
    }
  }, [playSound]);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (!token || !user?.user_id) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      // Build WebSocket URL
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = API_URL.replace(/^https?:\/\//, '').replace(/\/api$/, '');
      const wsUrl = `${wsProtocol}//${wsHost}/ws/notifications?token=${token}`;

      console.log('[WS] Connecting to:', wsUrl);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('[WS] Connected');
        setIsConnected(true);
        setConnectionMethod('websocket');
        reconnectAttemptsRef.current = 0;

        // Send auth message
        wsRef.current.send(JSON.stringify({
          type: 'AUTH',
          user_id: user.user_id,
          company_id: user.company_id,
          role: user.role
        }));
      };

      wsRef.current.onmessage = handleWSMessage;

      wsRef.current.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code, event.reason);
        setIsConnected(false);
        
        // Switch to polling fallback
        if (connectionMethod === 'websocket') {
          setConnectionMethod('polling');
          startPolling();
        }

        // Try to reconnect (max 5 attempts)
        if (reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.log('[WS] Error - switching to polling fallback');
        setConnectionMethod('polling');
        startPolling();
      };

    } catch (e) {
      console.error('[WS] Connection error:', e);
      setConnectionMethod('polling');
      startPolling();
    }
  }, [token, user, handleWSMessage, connectionMethod]);

  // Start polling fallback
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    console.log('[Notifications] Starting polling fallback');
    setConnectionMethod('polling');
    
    // Initial fetch
    fetchNotifications();
    
    // Poll every 10 seconds
    pollIntervalRef.current = setInterval(() => {
      fetchNotifications();
    }, settings.pollInterval);
  }, [fetchNotifications, settings.pollInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n =>
        (n.id === notificationId || n.notification_id === notificationId)
          ? { ...n, read: true }
          : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    // Server update
    try {
      await axios.put(`${API_URL}/api/notifications/${notificationId}/read`, {}, { headers });
    } catch (e) {
      console.log('[Notifications] Mark read error:', e.message);
    }
  }, [headers]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);

    // Server update
    try {
      await axios.put(`${API_URL}/api/notifications/mark-all-read`, {}, { headers });
    } catch (e) {
      console.log('[Notifications] Mark all read error:', e.message);
    }
  }, [headers]);

  // Add notification manually (for testing or local events)
  const addNotification = useCallback((notification) => {
    const newNotif = {
      id: notification.id || `local_${Date.now()}`,
      notification_id: notification.id || `local_${Date.now()}`,
      type: notification.type || 'INFO',
      title: notification.title,
      message: notification.message,
      read: false,
      created_at: new Date().toISOString(),
      ...notification
    };

    setNotifications(prev => [newNotif, ...prev].slice(0, 50));
    setUnreadCount(prev => prev + 1);
    
    if (notification.playSound !== false) {
      playSound();
    }
  }, [playSound]);

  // Initialize connection
  useEffect(() => {
    if (!token || !user?.user_id) return;

    // Initial fetch
    fetchNotifications();

    // Try WebSocket first, fallback to polling
    connectWebSocket();

    // Cleanup
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      stopPolling();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [token, user?.user_id]);

  return {
    // Data
    notifications,
    unreadCount,
    isConnected,
    connectionMethod,
    
    // Settings
    soundEnabled: settings.soundEnabled,
    toggleSound,
    
    // Actions
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    addNotification,
    
    // For debugging
    reconnect: connectWebSocket,
  };
};

export default useNotifications;
