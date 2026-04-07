/**
 * LOTTOLAB Sync Queue Manager
 * ===========================
 * Gestion professionnelle de la synchronisation offline
 * - Retry automatique (3-5 tentatives)
 * - File d'attente FIFO avec priorité
 * - Anti-duplicate
 * - Statuts: pending, syncing, synced, failed
 */

import { indexedDB, STORES_ENUM } from './indexedDB';

// Sync status constants
export const SYNC_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  FAILED: 'failed'
};

// Priority levels (lower = higher priority)
export const PRIORITY = {
  CRITICAL: 1,  // Tickets de vente
  HIGH: 2,      // Paiements
  NORMAL: 5,    // Données standard
  LOW: 10       // Cache refresh
};

class SyncQueueManager {
  constructor() {
    this.isProcessing = false;
    this.isOnline = navigator.onLine;
    this.listeners = new Set();
    this.retryIntervals = [5000, 15000, 30000, 60000, 120000]; // Retry delays
    this.maxRetries = 5;
    this.syncTimer = null;
    
    // Listen for network changes
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Start sync loop
    this.startSyncLoop();
  }

  /**
   * Add listener for sync status changes
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  async notifyListeners() {
    const status = await this.getStatus();
    this.listeners.forEach(cb => {
      try {
        cb(status);
      } catch (e) {
        console.error('[SyncQueue] Listener error:', e);
      }
    });
  }

  /**
   * Get current sync status
   */
  async getStatus() {
    const stats = await indexedDB.getStats();
    return {
      isOnline: this.isOnline,
      isProcessing: this.isProcessing,
      pendingCount: stats.pendingTickets + stats.syncQueue,
      pendingTickets: stats.pendingTickets,
      syncQueue: stats.syncQueue,
      lastSync: localStorage.getItem('lottolab_last_sync')
    };
  }

  /**
   * Handle coming online
   */
  async handleOnline() {
    console.log('[SyncQueue] Network online - starting sync');
    this.isOnline = true;
    await this.notifyListeners();
    
    // Immediate sync attempt
    await this.processQueue();
  }

  /**
   * Handle going offline
   */
  async handleOffline() {
    console.log('[SyncQueue] Network offline');
    this.isOnline = false;
    await this.notifyListeners();
  }

  /**
   * Start the sync loop
   */
  startSyncLoop() {
    // Process queue every 30 seconds when online
    this.syncTimer = setInterval(async () => {
      if (this.isOnline && !this.isProcessing) {
        await this.processQueue();
      }
    }, 30000);
  }

  /**
   * Stop the sync loop
   */
  stopSyncLoop() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Add a ticket to the sync queue
   */
  async addTicket(ticketData, apiUrl, token) {
    // Check for duplicate
    const pendingTickets = await indexedDB.getPendingTickets();
    const isDuplicate = pendingTickets.some(t => 
      t.lottery_id === ticketData.lottery_id &&
      t.created_at === ticketData.created_at &&
      JSON.stringify(t.plays) === JSON.stringify(ticketData.plays)
    );
    
    if (isDuplicate) {
      console.warn('[SyncQueue] Duplicate ticket detected, skipping');
      return null;
    }
    
    // Save to pending tickets
    const savedTicket = await indexedDB.savePendingTicket({
      ...ticketData,
      apiUrl,
      token,
      type: 'ticket_sale'
    });
    
    // Also add to sync queue with highest priority
    await indexedDB.addToSyncQueue({
      type: 'ticket_sale',
      ticket_id: savedTicket.id,
      data: ticketData,
      apiUrl,
      token
    }, PRIORITY.CRITICAL);
    
    await this.notifyListeners();
    
    // Try to sync immediately if online
    if (this.isOnline) {
      this.processQueue();
    }
    
    return savedTicket;
  }

  /**
   * Add generic item to sync queue
   */
  async addToQueue(type, data, apiUrl, token, priority = PRIORITY.NORMAL) {
    const item = await indexedDB.addToSyncQueue({
      type,
      data,
      apiUrl,
      token
    }, priority);
    
    await this.notifyListeners();
    
    if (this.isOnline) {
      this.processQueue();
    }
    
    return item;
  }

  /**
   * Process the sync queue
   */
  async processQueue() {
    if (this.isProcessing || !this.isOnline) {
      return { synced: 0, failed: 0 };
    }
    
    this.isProcessing = true;
    await this.notifyListeners();
    
    let synced = 0;
    let failed = 0;
    
    try {
      // Process pending tickets first
      const pendingTickets = await indexedDB.getPendingTickets();
      
      for (const ticket of pendingTickets) {
        if (!this.isOnline) break;
        
        const result = await this.syncTicket(ticket);
        if (result.success) {
          synced++;
        } else {
          failed++;
        }
      }
      
      // Then process sync queue
      const queue = await indexedDB.getSyncQueue();
      
      for (const item of queue) {
        if (!this.isOnline) break;
        if (item.type === 'ticket_sale') continue; // Already processed above
        
        const result = await this.syncQueueItem(item);
        if (result.success) {
          synced++;
        } else {
          failed++;
        }
      }
      
      // Update last sync time
      localStorage.setItem('lottolab_last_sync', new Date().toISOString());
      
    } catch (error) {
      console.error('[SyncQueue] Queue processing error:', error);
    } finally {
      this.isProcessing = false;
      await this.notifyListeners();
    }
    
    return { synced, failed };
  }

  /**
   * Sync a single ticket
   */
  async syncTicket(ticket) {
    if (ticket.attempts >= this.maxRetries) {
      await indexedDB.markTicketFailed(ticket.id, 'Max retries exceeded');
      return { success: false, error: 'Max retries exceeded' };
    }
    
    try {
      const response = await fetch(`${ticket.apiUrl}/api/vendeur/sell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ticket.token}`
        },
        body: JSON.stringify({
          lottery_id: ticket.lottery_id,
          draw_date: ticket.draw_date,
          draw_name: ticket.draw_name,
          plays: ticket.plays,
          offline_id: ticket.id // For server-side duplicate detection
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        await indexedDB.markTicketSynced(ticket.id, result.ticket_id);
        console.log(`[SyncQueue] Ticket synced: ${ticket.id} -> ${result.ticket_id}`);
        return { success: true, serverTicketId: result.ticket_id };
      } else {
        const error = await response.text();
        
        // Don't retry on certain errors
        if (response.status === 400 || response.status === 403) {
          await indexedDB.markTicketFailed(ticket.id, `HTTP ${response.status}: ${error}`);
          return { success: false, error };
        }
        
        // Increment attempts for retryable errors
        await indexedDB.markTicketFailed(ticket.id, `HTTP ${response.status}`);
        return { success: false, error };
      }
    } catch (error) {
      console.error(`[SyncQueue] Sync error for ticket ${ticket.id}:`, error);
      await indexedDB.markTicketFailed(ticket.id, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sync a queue item
   */
  async syncQueueItem(item) {
    if (item.attempts >= this.maxRetries) {
      await indexedDB.updateSyncQueueItem(item.id, SYNC_STATUS.FAILED, 'Max retries exceeded');
      return { success: false, error: 'Max retries exceeded' };
    }
    
    await indexedDB.updateSyncQueueItem(item.id, SYNC_STATUS.SYNCING);
    
    try {
      // Handle different item types
      let response;
      
      switch (item.type) {
        case 'pay_winner':
          response = await fetch(`${item.apiUrl}/api/vendeur/pay-winner/${item.data.ticket_id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${item.token}`
            }
          });
          break;
          
        default:
          console.warn(`[SyncQueue] Unknown item type: ${item.type}`);
          await indexedDB.removeFromSyncQueue(item.id);
          return { success: true };
      }
      
      if (response.ok) {
        await indexedDB.removeFromSyncQueue(item.id);
        return { success: true };
      } else {
        const error = await response.text();
        await indexedDB.updateSyncQueueItem(item.id, SYNC_STATUS.PENDING, error);
        return { success: false, error };
      }
    } catch (error) {
      await indexedDB.updateSyncQueueItem(item.id, SYNC_STATUS.PENDING, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Force sync now
   */
  async forcSync() {
    if (!this.isOnline) {
      return { success: false, error: 'Offline' };
    }
    return await this.processQueue();
  }

  /**
   * Get pending tickets count
   */
  async getPendingCount() {
    const tickets = await indexedDB.getPendingTickets();
    const queue = await indexedDB.getSyncQueue();
    return tickets.length + queue.length;
  }

  /**
   * Get all pending tickets
   */
  async getPendingTickets() {
    return await indexedDB.getPendingTickets();
  }

  /**
   * Retry failed tickets
   */
  async retryFailed() {
    const pending = await indexedDB.getAll(STORES_ENUM.PENDING_TICKETS);
    const failed = pending.filter(t => t.status === 'failed' && t.attempts < this.maxRetries);
    
    for (const ticket of failed) {
      ticket.status = 'pending';
      await indexedDB.put(STORES_ENUM.PENDING_TICKETS, ticket);
    }
    
    await this.notifyListeners();
    return failed.length;
  }

  /**
   * Clear all failed tickets
   */
  async clearFailed() {
    const pending = await indexedDB.getAll(STORES_ENUM.PENDING_TICKETS);
    const failed = pending.filter(t => t.status === 'failed');
    
    for (const ticket of failed) {
      await indexedDB.delete(STORES_ENUM.PENDING_TICKETS, ticket.id);
    }
    
    await this.notifyListeners();
    return failed.length;
  }
}

// Singleton instance
export const syncQueueManager = new SyncQueueManager();
export default syncQueueManager;
