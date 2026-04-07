/**
 * Offline Sync Service
 * Handles offline ticket creation and automatic synchronization
 */

const STORAGE_KEYS = {
  PENDING_TICKETS: 'lottolab_pending_tickets',
  CACHED_LOTTERIES: 'lottolab_cached_lotteries',
  CACHED_CONFIG: 'lottolab_cached_config',
  CACHED_BET_LIMITS: 'lottolab_cached_bet_limits',
  LAST_SYNC: 'lottolab_last_sync',
  NETWORK_STATUS: 'lottolab_network_status'
};

class SyncService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncInterval = null;
    this.listeners = new Set();
    this.isSyncing = false;
    
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Start sync interval
    this.startSyncInterval();
  }

  /**
   * Add status listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  notifyListeners() {
    const status = this.getStatus();
    this.listeners.forEach(cb => cb(status));
  }

  /**
   * Get current sync status
   */
  getStatus() {
    const pending = this.getPendingTickets();
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: pending.length,
      lastSync: localStorage.getItem(STORAGE_KEYS.LAST_SYNC),
      networkQuality: this.getNetworkQuality()
    };
  }

  /**
   * Get network quality indicator
   */
  getNetworkQuality() {
    if (!this.isOnline) return 'offline';
    
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return 'unknown';
    
    const effectiveType = connection.effectiveType;
    if (effectiveType === '4g') return 'good';
    if (effectiveType === '3g') return 'medium';
    return 'slow';
  }

  /**
   * Handle coming online
   */
  async handleOnline() {
    this.isOnline = true;
    this.notifyListeners();
    
    // Start sync immediately
    await this.syncPendingTickets();
    
    // Refresh cached data
    await this.refreshCache();
  }

  /**
   * Handle going offline
   */
  handleOffline() {
    this.isOnline = false;
    this.notifyListeners();
  }

  /**
   * Start periodic sync
   */
  startSyncInterval() {
    // Sync every 30 seconds if online
    this.syncInterval = setInterval(async () => {
      if (this.isOnline && !this.isSyncing) {
        await this.syncPendingTickets();
      }
    }, 30000);
  }

  /**
   * Stop sync interval
   */
  stopSyncInterval() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // ==================== CACHE MANAGEMENT ====================

  /**
   * Cache lotteries data
   */
  cacheLotteries(lotteries) {
    try {
      localStorage.setItem(STORAGE_KEYS.CACHED_LOTTERIES, JSON.stringify({
        data: lotteries,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error('Error caching lotteries:', e);
    }
  }

  /**
   * Get cached lotteries
   */
  getCachedLotteries() {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CACHED_LOTTERIES);
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      
      // Cache valid for 1 hour
      if (Date.now() - timestamp > 3600000) return null;
      
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Cache company config
   */
  cacheConfig(config) {
    try {
      localStorage.setItem(STORAGE_KEYS.CACHED_CONFIG, JSON.stringify({
        data: config,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error('Error caching config:', e);
    }
  }

  /**
   * Get cached config
   */
  getCachedConfig() {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CACHED_CONFIG);
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      
      // Cache valid for 24 hours
      if (Date.now() - timestamp > 86400000) return null;
      
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Cache bet type limits
   */
  cacheBetLimits(limits) {
    try {
      localStorage.setItem(STORAGE_KEYS.CACHED_BET_LIMITS, JSON.stringify({
        data: limits,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error('Error caching bet limits:', e);
    }
  }

  /**
   * Get cached bet limits
   */
  getCachedBetLimits() {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CACHED_BET_LIMITS);
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      
      // Cache valid for 1 hour
      if (Date.now() - timestamp > 3600000) return null;
      
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Refresh all cached data
   */
  async refreshCache() {
    // This will be called from components that have API access
    // Components should call cacheXXX methods after fetching data
  }

  /**
   * Clear all cache
   */
  clearCache() {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  // ==================== PENDING TICKETS ====================

  /**
   * Get all pending tickets
   */
  getPendingTickets() {
    try {
      const pending = localStorage.getItem(STORAGE_KEYS.PENDING_TICKETS);
      return pending ? JSON.parse(pending) : [];
    } catch {
      return [];
    }
  }

  /**
   * Add a pending ticket (offline mode)
   */
  addPendingTicket(ticketData) {
    const pending = this.getPendingTickets();
    
    const offlineTicket = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...ticketData,
      createdAt: new Date().toISOString(),
      synced: false,
      attempts: 0
    };
    
    pending.push(offlineTicket);
    
    localStorage.setItem(STORAGE_KEYS.PENDING_TICKETS, JSON.stringify(pending));
    
    this.notifyListeners();
    
    return offlineTicket;
  }

  /**
   * Remove a pending ticket
   */
  removePendingTicket(ticketId) {
    const pending = this.getPendingTickets();
    const filtered = pending.filter(t => t.id !== ticketId);
    localStorage.setItem(STORAGE_KEYS.PENDING_TICKETS, JSON.stringify(filtered));
    this.notifyListeners();
  }

  /**
   * Mark ticket as synced
   */
  markTicketSynced(offlineId, serverTicketId) {
    const pending = this.getPendingTickets();
    const filtered = pending.filter(t => t.id !== offlineId);
    localStorage.setItem(STORAGE_KEYS.PENDING_TICKETS, JSON.stringify(filtered));
    this.notifyListeners();
  }

  /**
   * Sync all pending tickets to server
   */
  async syncPendingTickets(apiUrl, token) {
    if (!this.isOnline || this.isSyncing) return { synced: 0, failed: 0 };
    
    const pending = this.getPendingTickets();
    if (pending.length === 0) return { synced: 0, failed: 0 };
    
    this.isSyncing = true;
    this.notifyListeners();
    
    let synced = 0;
    let failed = 0;
    
    for (const ticket of pending) {
      if (ticket.synced) continue;
      
      try {
        const response = await fetch(`${apiUrl}/api/vendeur/sell`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            plays: ticket.plays,
            lottery_id: ticket.lottery_id,
            draw_date: ticket.draw_date,
            offline_id: ticket.id
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          this.markTicketSynced(ticket.id, result.ticket_id);
          synced++;
        } else {
          // Increment attempt count
          ticket.attempts++;
          if (ticket.attempts >= 3) {
            // Mark as failed after 3 attempts
            ticket.failed = true;
          }
          failed++;
        }
      } catch (error) {
        console.error('Sync error for ticket:', ticket.id, error);
        ticket.attempts++;
        failed++;
      }
    }
    
    // Update storage with failed attempts
    const remaining = this.getPendingTickets().map(t => {
      const updated = pending.find(p => p.id === t.id);
      return updated || t;
    });
    localStorage.setItem(STORAGE_KEYS.PENDING_TICKETS, JSON.stringify(remaining));
    
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    
    this.isSyncing = false;
    this.notifyListeners();
    
    return { synced, failed };
  }

  /**
   * Check if we should use offline mode
   */
  shouldUseOfflineMode() {
    if (!this.isOnline) return true;
    
    const quality = this.getNetworkQuality();
    // Use offline mode for slow connections
    return quality === 'slow';
  }
}

// Singleton instance
export const syncService = new SyncService();

export default syncService;
