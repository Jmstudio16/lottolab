/**
 * LOTTOLAB PRO - Offline Sync Manager
 * ====================================
 * Professional sync queue management for POS APK
 * 
 * Features:
 * - Automatic sync when online
 * - Retry with exponential backoff
 * - Priority queue (tickets > other data)
 * - Background sync via Service Worker
 * - Real-time status updates
 */

import { offlineDB } from './offlineDB';

// Sync status
export const SYNC_STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  OFFLINE: 'offline',
  ERROR: 'error'
};

// Retry configuration
const MAX_RETRIES = 5;
const RETRY_DELAYS = [3000, 10000, 30000, 60000, 120000]; // 3s, 10s, 30s, 1m, 2m
const SYNC_INTERVAL = 30000; // 30 seconds

class OfflineSyncManager {
  constructor() {
    this.status = SYNC_STATUS.IDLE;
    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    this.listeners = new Set();
    this.syncTimer = null;
    this.apiUrl = null;
    this.getToken = null;
    
    // Bind methods
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);
    
    // Listen for network changes
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // Listen for Service Worker sync events
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_REQUESTED') {
          this.syncNow();
        }
      });
    }
  }

  /**
   * Configure the sync manager
   */
  configure({ apiUrl, getToken }) {
    this.apiUrl = apiUrl;
    this.getToken = getToken;
    console.log('[SyncManager] Configured with API:', apiUrl);
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
  async notifyListeners() {
    const status = await this.getFullStatus();
    this.listeners.forEach(cb => {
      try {
        cb(status);
      } catch (e) {
        console.error('[SyncManager] Listener error:', e);
      }
    });
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      status: this.status
    };
  }

  /**
   * Get full status with stats
   */
  async getFullStatus() {
    const stats = await offlineDB.getStats();
    return {
      ...this.getStatus(),
      pendingTickets: stats.pendingTickets,
      syncedTickets: stats.syncedTickets,
      failedTickets: stats.failedTickets,
      lastSync: localStorage.getItem('lottolab_last_sync')
    };
  }

  /**
   * Handle coming online
   */
  async handleOnline() {
    console.log('[SyncManager] Network online');
    this.isOnline = true;
    this.status = SYNC_STATUS.IDLE;
    await this.notifyListeners();
    
    // Start sync immediately
    this.syncNow();
    
    // Start periodic sync
    this.startSyncLoop();
  }

  /**
   * Handle going offline
   */
  async handleOffline() {
    console.log('[SyncManager] Network offline');
    this.isOnline = false;
    this.status = SYNC_STATUS.OFFLINE;
    await this.notifyListeners();
    
    // Stop sync loop
    this.stopSyncLoop();
  }

  /**
   * Start periodic sync loop
   */
  startSyncLoop() {
    this.stopSyncLoop(); // Clear any existing
    
    this.syncTimer = setInterval(async () => {
      if (this.isOnline && !this.isSyncing) {
        await this.syncNow();
      }
    }, SYNC_INTERVAL);
    
    console.log('[SyncManager] Sync loop started');
  }

  /**
   * Stop sync loop
   */
  stopSyncLoop() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Force sync now
   */
  async syncNow() {
    if (!this.isOnline) {
      console.log('[SyncManager] Cannot sync - offline');
      return { success: false, reason: 'offline' };
    }
    
    if (this.isSyncing) {
      console.log('[SyncManager] Already syncing');
      return { success: false, reason: 'already_syncing' };
    }
    
    if (!this.apiUrl || !this.getToken) {
      console.warn('[SyncManager] Not configured');
      return { success: false, reason: 'not_configured' };
    }
    
    this.isSyncing = true;
    this.status = SYNC_STATUS.SYNCING;
    await this.notifyListeners();
    
    let synced = 0;
    let failed = 0;
    
    try {
      // Get all pending tickets
      const pendingTickets = await offlineDB.getPendingTickets();
      console.log('[SyncManager] Syncing', pendingTickets.length, 'pending tickets');
      
      for (const ticket of pendingTickets) {
        const result = await this.syncTicket(ticket);
        if (result.success) {
          synced++;
        } else {
          failed++;
        }
      }
      
      // Update last sync time
      localStorage.setItem('lottolab_last_sync', new Date().toISOString());
      
      console.log('[SyncManager] Sync complete:', { synced, failed });
      
    } catch (error) {
      console.error('[SyncManager] Sync error:', error);
      this.status = SYNC_STATUS.ERROR;
    } finally {
      this.isSyncing = false;
      this.status = this.isOnline ? SYNC_STATUS.IDLE : SYNC_STATUS.OFFLINE;
      await this.notifyListeners();
    }
    
    return { success: true, synced, failed };
  }

  /**
   * Sync a single ticket
   */
  async syncTicket(ticket) {
    const token = typeof this.getToken === 'function' ? await this.getToken() : this.getToken;
    
    if (!token) {
      console.warn('[SyncManager] No auth token');
      return { success: false, error: 'No auth token' };
    }
    
    // Check if max retries exceeded
    if (ticket.attempts >= MAX_RETRIES) {
      await offlineDB.markTicketFailed(ticket.offline_id, 'Max retries exceeded');
      return { success: false, error: 'Max retries exceeded' };
    }
    
    try {
      const response = await fetch(`${this.apiUrl}/api/vendeur/sell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          lottery_id: ticket.lottery_id,
          draw_date: ticket.draw_date,
          draw_name: ticket.draw_name,
          draw_time: ticket.draw_time,
          plays: ticket.plays,
          offline_id: ticket.offline_id // Server uses this for duplicate detection
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        await offlineDB.markTicketSynced(ticket.offline_id, result.ticket_id, result);
        return { success: true, serverTicketId: result.ticket_id };
      }
      
      // Handle specific error codes
      const errorText = await response.text();
      
      if (response.status === 400) {
        // Bad request - don't retry, mark as failed
        await offlineDB.markTicketFailed(ticket.offline_id, `Erreur 400: ${errorText}`);
        return { success: false, error: errorText, permanent: true };
      }
      
      if (response.status === 401 || response.status === 403) {
        // Auth error - don't retry
        await offlineDB.markTicketFailed(ticket.offline_id, 'Erreur d\'authentification');
        return { success: false, error: 'Auth error', permanent: true };
      }
      
      // Other errors - retry
      await offlineDB.incrementTicketAttempt(ticket.offline_id, errorText);
      return { success: false, error: errorText };
      
    } catch (error) {
      // Network error - retry
      console.error('[SyncManager] Network error syncing ticket:', error);
      await offlineDB.incrementTicketAttempt(ticket.offline_id, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create ticket (online or offline)
   * This is the main entry point for creating tickets
   */
  async createTicket(ticketData) {
    // Always save to pending first (for safety)
    const pendingTicket = await offlineDB.savePendingTicket(ticketData);
    
    // If online, try to sync immediately
    if (this.isOnline) {
      const result = await this.syncTicket(pendingTicket);
      if (result.success) {
        return {
          success: true,
          offline: false,
          ticket_id: result.serverTicketId,
          offline_id: pendingTicket.offline_id
        };
      }
    }
    
    // Return offline ticket info
    return {
      success: true,
      offline: true,
      offline_id: pendingTicket.offline_id,
      ticket_code: pendingTicket.offline_id,
      message: 'Ticket sauvegardé hors ligne'
    };
  }

  /**
   * Retry all failed tickets
   */
  async retryAllFailed() {
    const failedTickets = await offlineDB.getFailedTickets();
    
    for (const ticket of failedTickets) {
      await offlineDB.retryFailedTicket(ticket.offline_id);
    }
    
    await this.notifyListeners();
    
    // Trigger sync
    if (this.isOnline) {
      this.syncNow();
    }
    
    return failedTickets.length;
  }

  /**
   * Get sync status summary
   */
  async getSummary() {
    const stats = await offlineDB.getStats();
    return {
      pendingTickets: stats.pendingTickets,
      syncedTickets: stats.syncedTickets,
      failedTickets: stats.failedTickets,
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSync: localStorage.getItem('lottolab_last_sync')
    };
  }

  /**
   * Register for background sync (Service Worker)
   */
  async registerBackgroundSync() {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-tickets');
        console.log('[SyncManager] Background sync registered');
      } catch (error) {
        console.warn('[SyncManager] Background sync not available:', error);
      }
    }
  }

  /**
   * Clean up
   */
  destroy() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.stopSyncLoop();
    this.listeners.clear();
  }
}

// Singleton instance
export const syncManager = new OfflineSyncManager();

export default syncManager;
