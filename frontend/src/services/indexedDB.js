/**
 * LOTTOLAB IndexedDB Manager
 * ==========================
 * Stockage robuste pour mode offline APK POS
 * Remplace localStorage pour éviter les crashs
 */

const DB_NAME = 'lottolab_db';
const DB_VERSION = 2;

// Tables de la base de données
const STORES = {
  PENDING_TICKETS: 'pending_tickets',
  SYNCED_TICKETS: 'synced_tickets',
  LOTTERIES_CACHE: 'lotteries_cache',
  SCHEDULES_CACHE: 'schedules_cache',
  RESULTS_CACHE: 'results_cache',
  CONFIG_CACHE: 'config_cache',
  BET_LIMITS_CACHE: 'bet_limits_cache',
  USER_SESSION: 'user_session',
  PRINTER_CONFIG: 'printer_config',
  SYNC_QUEUE: 'sync_queue'
};

class IndexedDBManager {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.readyPromise = this.init();
  }

  /**
   * Initialize the database
   */
  async init() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.error('[IDB] IndexedDB not supported');
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('[IDB] Error opening database:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.isReady = true;
        console.log('[IDB] Database opened successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('[IDB] Upgrading database...');

        // Create all stores
        Object.values(STORES).forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
            
            // Add indexes based on store type
            if (storeName === STORES.PENDING_TICKETS || storeName === STORES.SYNCED_TICKETS) {
              store.createIndex('ticket_id', 'ticket_id', { unique: false });
              store.createIndex('created_at', 'created_at', { unique: false });
              store.createIndex('status', 'status', { unique: false });
            }
            
            if (storeName === STORES.SYNC_QUEUE) {
              store.createIndex('status', 'status', { unique: false });
              store.createIndex('priority', 'priority', { unique: false });
              store.createIndex('created_at', 'created_at', { unique: false });
            }
            
            if (storeName === STORES.LOTTERIES_CACHE || storeName === STORES.RESULTS_CACHE) {
              store.createIndex('lottery_id', 'lottery_id', { unique: false });
              store.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            console.log(`[IDB] Created store: ${storeName}`);
          }
        });
      };
    });
  }

  /**
   * Wait for database to be ready
   */
  async ensureReady() {
    if (!this.isReady) {
      await this.readyPromise;
    }
    return this.db;
  }

  /**
   * Generic put operation
   */
  async put(storeName, data) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      // Add timestamp if not present
      if (!data.timestamp) {
        data.timestamp = Date.now();
      }
      
      const request = store.put(data);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generic get operation
   */
  async get(storeName, id) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all items from a store
   */
  async getAll(storeName) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get items by index
   */
  async getByIndex(storeName, indexName, value) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete an item
   */
  async delete(storeName, id) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear a store
   */
  async clear(storeName) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Count items in a store
   */
  async count(storeName) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== SPECIFIC METHODS ====================

  /**
   * Save pending ticket for offline mode
   */
  async savePendingTicket(ticketData) {
    const ticket = {
      ...ticketData,
      id: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ticket_id: ticketData.ticket_id || `offline_${Date.now()}`,
      status: 'pending',
      created_at: new Date().toISOString(),
      attempts: 0,
      last_attempt: null
    };
    
    await this.put(STORES.PENDING_TICKETS, ticket);
    return ticket;
  }

  /**
   * Get all pending tickets
   */
  async getPendingTickets() {
    return await this.getByIndex(STORES.PENDING_TICKETS, 'status', 'pending');
  }

  /**
   * Mark ticket as synced
   */
  async markTicketSynced(pendingId, serverTicketId) {
    const ticket = await this.get(STORES.PENDING_TICKETS, pendingId);
    if (ticket) {
      ticket.status = 'synced';
      ticket.server_ticket_id = serverTicketId;
      ticket.synced_at = new Date().toISOString();
      
      // Move to synced store
      await this.put(STORES.SYNCED_TICKETS, ticket);
      await this.delete(STORES.PENDING_TICKETS, pendingId);
    }
    return ticket;
  }

  /**
   * Mark ticket as failed
   */
  async markTicketFailed(pendingId, error) {
    const ticket = await this.get(STORES.PENDING_TICKETS, pendingId);
    if (ticket) {
      ticket.status = 'failed';
      ticket.error = error;
      ticket.attempts++;
      ticket.last_attempt = new Date().toISOString();
      await this.put(STORES.PENDING_TICKETS, ticket);
    }
    return ticket;
  }

  /**
   * Cache lotteries
   */
  async cacheLotteries(lotteries) {
    await this.clear(STORES.LOTTERIES_CACHE);
    for (const lottery of lotteries) {
      await this.put(STORES.LOTTERIES_CACHE, {
        ...lottery,
        id: lottery.lottery_id,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get cached lotteries
   */
  async getCachedLotteries(maxAge = 3600000) { // 1 hour default
    const all = await this.getAll(STORES.LOTTERIES_CACHE);
    if (all.length === 0) return null;
    
    // Check if cache is still valid
    const oldest = Math.min(...all.map(l => l.timestamp));
    if (Date.now() - oldest > maxAge) {
      return null; // Cache expired
    }
    
    return all;
  }

  /**
   * Cache results
   */
  async cacheResults(results) {
    await this.clear(STORES.RESULTS_CACHE);
    for (const result of results) {
      await this.put(STORES.RESULTS_CACHE, {
        ...result,
        id: result.result_id || `result_${Date.now()}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get cached results
   */
  async getCachedResults(maxAge = 300000) { // 5 minutes default
    const all = await this.getAll(STORES.RESULTS_CACHE);
    if (all.length === 0) return null;
    
    const oldest = Math.min(...all.map(r => r.timestamp));
    if (Date.now() - oldest > maxAge) {
      return null;
    }
    
    return all;
  }

  /**
   * Cache company config
   */
  async cacheConfig(config) {
    await this.put(STORES.CONFIG_CACHE, {
      id: 'company_config',
      ...config,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached config
   */
  async getCachedConfig() {
    const config = await this.get(STORES.CONFIG_CACHE, 'company_config');
    if (!config) return null;
    
    // Config valid for 24 hours
    if (Date.now() - config.timestamp > 86400000) {
      return null;
    }
    
    return config;
  }

  /**
   * Cache bet limits
   */
  async cacheBetLimits(limits) {
    await this.put(STORES.BET_LIMITS_CACHE, {
      id: 'bet_limits',
      limits,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached bet limits
   */
  async getCachedBetLimits() {
    const data = await this.get(STORES.BET_LIMITS_CACHE, 'bet_limits');
    if (!data) return null;
    
    if (Date.now() - data.timestamp > 3600000) {
      return null;
    }
    
    return data.limits;
  }

  /**
   * Save user session for offline login
   */
  async saveUserSession(user, token) {
    await this.put(STORES.USER_SESSION, {
      id: 'current_session',
      user,
      token,
      saved_at: new Date().toISOString(),
      timestamp: Date.now()
    });
  }

  /**
   * Get saved user session
   */
  async getUserSession() {
    const session = await this.get(STORES.USER_SESSION, 'current_session');
    if (!session) return null;
    
    // Session valid for 7 days
    if (Date.now() - session.timestamp > 604800000) {
      await this.delete(STORES.USER_SESSION, 'current_session');
      return null;
    }
    
    return session;
  }

  /**
   * Clear user session
   */
  async clearUserSession() {
    await this.delete(STORES.USER_SESSION, 'current_session');
  }

  /**
   * Save printer config
   */
  async savePrinterConfig(config) {
    await this.put(STORES.PRINTER_CONFIG, {
      id: 'printer_config',
      ...config,
      timestamp: Date.now()
    });
  }

  /**
   * Get printer config
   */
  async getPrinterConfig() {
    return await this.get(STORES.PRINTER_CONFIG, 'printer_config');
  }

  /**
   * Add item to sync queue
   */
  async addToSyncQueue(item, priority = 5) {
    const queueItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      priority,
      created_at: new Date().toISOString(),
      attempts: 0
    };
    
    await this.put(STORES.SYNC_QUEUE, queueItem);
    return queueItem;
  }

  /**
   * Get pending sync queue items
   */
  async getSyncQueue() {
    const items = await this.getByIndex(STORES.SYNC_QUEUE, 'status', 'pending');
    // Sort by priority (lower = higher priority)
    return items.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Update sync queue item status
   */
  async updateSyncQueueItem(id, status, error = null) {
    const item = await this.get(STORES.SYNC_QUEUE, id);
    if (item) {
      item.status = status;
      item.attempts++;
      item.last_attempt = new Date().toISOString();
      if (error) item.error = error;
      await this.put(STORES.SYNC_QUEUE, item);
    }
    return item;
  }

  /**
   * Remove from sync queue
   */
  async removeFromSyncQueue(id) {
    await this.delete(STORES.SYNC_QUEUE, id);
  }

  /**
   * Get database stats
   */
  async getStats() {
    return {
      pendingTickets: await this.count(STORES.PENDING_TICKETS),
      syncedTickets: await this.count(STORES.SYNCED_TICKETS),
      lotteriesCache: await this.count(STORES.LOTTERIES_CACHE),
      resultsCache: await this.count(STORES.RESULTS_CACHE),
      syncQueue: await this.count(STORES.SYNC_QUEUE)
    };
  }
}

// Singleton instance
export const indexedDB = new IndexedDBManager();
export const STORES_ENUM = STORES;
export default indexedDB;
