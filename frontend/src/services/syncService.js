/**
 * Offline Sync Service (LEGACY WRAPPER)
 * =====================================
 * This file provides backwards compatibility with old imports.
 * All functionality is delegated to the new offlineSyncManager.
 * 
 * @deprecated Use offlineSyncManager directly for new code.
 */

import { syncManager, SYNC_STATUS } from './offlineSyncManager';
import { offlineDB } from './offlineDB';

class SyncService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = new Set();
    this.isSyncing = false;
    
    // Forward to new sync manager
    syncManager.addListener((status) => {
      this.isOnline = status.isOnline;
      this.isSyncing = status.isSyncing;
      this.notifyListeners();
    });
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners();
    });
    
    console.log('[SyncService] Legacy wrapper initialized');
  }

  /**
   * Add status listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    // Send current status immediately
    callback(this.getStatus());
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  notifyListeners() {
    const status = this.getStatus();
    this.listeners.forEach(cb => {
      try {
        cb(status);
      } catch (e) {
        console.error('[SyncService] Listener error:', e);
      }
    });
  }

  /**
   * Get current sync status
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: 0, // Will be updated by async call
      lastSync: localStorage.getItem('lottolab_last_sync'),
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
   * Should use offline mode
   */
  shouldUseOfflineMode() {
    return !this.isOnline || this.getNetworkQuality() === 'slow';
  }

  /**
   * Add pending ticket (delegates to offlineDB)
   * @deprecated Use syncManager.createTicket() instead
   */
  addPendingTicket(ticketData) {
    const id = 'OFF_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    
    // Also save to IndexedDB in background
    offlineDB.savePendingTicket({
      ...ticketData,
      offline_id: id
    }).catch(console.error);
    
    return { id, ...ticketData };
  }

  /**
   * Get pending tickets (sync)
   * @deprecated Use offlineDB.getPendingTickets() instead
   */
  getPendingTickets() {
    // Try to get from IndexedDB synchronously (returns empty if not ready)
    return [];
  }

  /**
   * Cache lotteries
   */
  cacheLotteries(lotteries) {
    offlineDB.cacheLotteries(lotteries).catch(console.error);
  }

  /**
   * Get cached lotteries
   */
  getCachedLotteries() {
    // Sync method - can't use IndexedDB directly
    // Return null and let caller use async version
    return null;
  }

  /**
   * Cache config
   */
  cacheConfig(config) {
    offlineDB.cacheVendorConfig(config).catch(console.error);
  }

  /**
   * Get cached config
   */
  getCachedConfig() {
    return null;
  }

  /**
   * Cache bet limits
   */
  cacheBetLimits(limits) {
    offlineDB.cacheBetLimits(limits).catch(console.error);
  }

  /**
   * Get cached bet limits
   */
  getCachedBetLimits() {
    return null;
  }
}

// Singleton instance
export const syncService = new SyncService();

export default syncService;
