import { useState, useEffect, useCallback, useRef } from 'react';
import { API_URL } from '@/config/api';
import { useAuth } from '@/api/auth';

/**
 * Hook for real-time lottery synchronization
 * 
 * Features:
 * - WebSocket connection for instant updates
 * - Automatic lottery status refresh every 30 seconds
 * - Countdown timers for closing lotteries
 * - Filters closed lotteries from seller view
 */
export const useLotterySync = (options = {}) => {
  const { token } = useAuth();
  const { 
    showClosedLotteries = false,  // Set to false for seller page
    refreshInterval = 30000,      // Refresh every 30 seconds
    onLotteryStatusChange = null, // Callback when lottery opens/closes
    onResultPublished = null,     // Callback when new result is published
  } = options;
  
  const [lotteries, setLotteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [serverTime, setServerTime] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const wsRef = useRef(null);
  const refreshTimerRef = useRef(null);
  
  const headers = { Authorization: `Bearer ${token}` };

  // Fetch lotteries from backend
  const fetchLotteries = useCallback(async () => {
    if (!token) return;
    
    try {
      // Use vendor-specific endpoint that only returns open lotteries
      const endpoint = showClosedLotteries 
        ? `${API_URL}/api/sync/lotteries/status`
        : `${API_URL}/api/sync/vendeur/open-lotteries`;
      
      const res = await fetch(endpoint, { headers });
      
      if (!res.ok) {
        throw new Error('Failed to fetch lotteries');
      }
      
      const data = await res.json();
      setLotteries(data.lotteries || []);
      setServerTime(data.server_time);
      setLastSync(new Date());
      setError(null);
    } catch (err) {
      console.error('[LotterySync] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, showClosedLotteries]);

  // Handle WebSocket messages
  const handleWSMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'LOTTERY_STATUS_CHANGE':
        case 'LOTTERY_TOGGLED':
          // Refresh lottery list when status changes
          fetchLotteries();
          if (onLotteryStatusChange) {
            onLotteryStatusChange(data.data);
          }
          break;
          
        case 'SCHEDULE_CHANGE':
        case 'SCHEDULE_UPDATED':
          // Refresh when schedule is modified
          fetchLotteries();
          break;
          
        case 'RESULT_PUBLISHED':
        case 'RESULT_CHANGE':
          if (onResultPublished) {
            onResultPublished(data.data);
          }
          break;
          
        case 'SYNC_REQUIRED':
          // Full refresh requested
          fetchLotteries();
          break;
          
        default:
          break;
      }
    } catch (err) {
      console.error('[LotterySync] WS message parse error:', err);
    }
  }, [fetchLotteries, onLotteryStatusChange, onResultPublished]);

  // Connect WebSocket
  useEffect(() => {
    if (!token) return;
    
    const wsUrl = `${API_URL.replace('http', 'ws')}/api/ws?token=${token}`;
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('[LotterySync] WebSocket connected');
      };
      
      wsRef.current.onmessage = handleWSMessage;
      
      wsRef.current.onerror = (err) => {
        console.warn('[LotterySync] WebSocket error, falling back to polling');
      };
      
      wsRef.current.onclose = () => {
        console.log('[LotterySync] WebSocket closed');
      };
    } catch (err) {
      console.warn('[LotterySync] WebSocket not available');
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token, handleWSMessage]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchLotteries();
    
    // Set up refresh interval
    refreshTimerRef.current = setInterval(fetchLotteries, refreshInterval);
    
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [fetchLotteries, refreshInterval]);

  // Get only open lotteries
  const openLotteries = lotteries.filter(l => l.is_open);
  
  // Get lotteries closing soon (within 10 minutes)
  const closingSoonLotteries = openLotteries.filter(l => {
    const timeUntilClose = l.time_until_close;
    return timeUntilClose && timeUntilClose < 600; // Less than 10 minutes
  });

  return {
    lotteries: showClosedLotteries ? lotteries : openLotteries,
    allLotteries: lotteries,
    openLotteries,
    closingSoonLotteries,
    loading,
    error,
    serverTime,
    lastSync,
    refresh: fetchLotteries,
    openCount: openLotteries.length,
    totalCount: lotteries.length
  };
};

/**
 * Hook for countdown timer
 * Updates every second
 */
export const useCountdown = (targetSeconds) => {
  const [remaining, setRemaining] = useState(targetSeconds || 0);
  
  useEffect(() => {
    if (!targetSeconds || targetSeconds <= 0) {
      setRemaining(0);
      return;
    }
    
    setRemaining(targetSeconds);
    
    const timer = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [targetSeconds]);
  
  // Format as HH:MM:SS or MM:SS
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  
  const formatted = hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  return {
    remaining,
    hours,
    minutes,
    seconds,
    formatted,
    isExpired: remaining <= 0,
    isUrgent: remaining > 0 && remaining < 300 // Less than 5 minutes
  };
};

/**
 * Format time remaining in human-readable format
 */
export const formatTimeRemaining = (seconds) => {
  if (!seconds || seconds <= 0) return 'Fermé';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h${minutes.toString().padStart(2, '0')}`;
  }
  return `${minutes}min`;
};

export default useLotterySync;
