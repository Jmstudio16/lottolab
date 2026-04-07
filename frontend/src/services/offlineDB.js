/**
 * LOTTOLAB PRO - Offline Database Service
 * =========================================
 * Robust IndexedDB implementation for POS APK
 * Replaces ALL localStorage usage for critical data
 * 
 * Features:
 * - Session persistence (7 days)
 * - Offline ticket queue with retry logic
 * - Configuration caching
 * - Lottery data caching
 * - Sync status tracking
 */

const DB_NAME = 'lottolab_pro';
const DB_VERSION = 3;

// Store names
export const STORES = {
  SESSION: 'session',           // User session & tokens
  TICKETS_PENDING: 'tickets_pending',    // Tickets waiting to sync
  TICKETS_SYNCED: 'tickets_synced',      // Successfully synced tickets
  TICKETS_FAILED: 'tickets_failed',      // Failed tickets after max retries
  LOTTERIES: 'lotteries',       // Cached lottery data
  RESULTS: 'results',           // Cached results
  CONFIG: 'config',             // Company & device config
  BET_LIMITS: 'bet_limits',     // Bet type limits
  SCHEDULES: 'schedules',       // Draw schedules
  SYNC_LOG: 'sync_log',         // Sync history log
  PRINTER: 'printer',           // Printer configuration
};

// Cache durations (milliseconds)
const CACHE_TTL = {
  SESSION: 7 * 24 * 60 * 60 * 1000,    // 7 days
  LOTTERIES: 5 * 60 * 1000,             // 5 minutes
  RESULTS: 2 * 60 * 1000,               // 2 minutes
  CONFIG: 24 * 60 * 60 * 1000,          // 24 hours
  BET_LIMITS: 60 * 60 * 1000,           // 1 hour
  SCHEDULES: 30 * 60 * 1000,            // 30 minutes
};

class OfflineDBService {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.initPromise = null;
    this.listeners = new Set();
  }

  /**
   * Initialize the database
   */
  async init() {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.error('[OfflineDB] IndexedDB not supported');
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('[OfflineDB] Error:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.isReady = true;
        console.log('[OfflineDB] Database ready');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('[OfflineDB] Upgrading database...');

        // Session store
        if (!db.objectStoreNames.contains(STORES.SESSION)) {
          db.createObjectStore(STORES.SESSION, { keyPath: 'key' });
        }

        // Pending tickets with indexes
        if (!db.objectStoreNames.contains(STORES.TICKETS_PENDING)) {
          const pendingStore = db.createObjectStore(STORES.TICKETS_PENDING, { keyPath: 'offline_id' });
          pendingStore.createIndex('status', 'status', { unique: false });
          pendingStore.createIndex('created_at', 'created_at', { unique: false });
          pendingStore.createIndex('lottery_id', 'lottery_id', { unique: false });
        }

        // Synced tickets
        if (!db.objectStoreNames.contains(STORES.TICKETS_SYNCED)) {
          const syncedStore = db.createObjectStore(STORES.TICKETS_SYNCED, { keyPath: 'offline_id' });
          syncedStore.createIndex('server_ticket_id', 'server_ticket_id', { unique: false });
          syncedStore.createIndex('synced_at', 'synced_at', { unique: false });
        }

        // Failed tickets
        if (!db.objectStoreNames.contains(STORES.TICKETS_FAILED)) {
          const failedStore = db.createObjectStore(STORES.TICKETS_FAILED, { keyPath: 'offline_id' });
          failedStore.createIndex('failed_at', 'failed_at', { unique: false });
        }

        // Lotteries cache
        if (!db.objectStoreNames.contains(STORES.LOTTERIES)) {
          const lotteryStore = db.createObjectStore(STORES.LOTTERIES, { keyPath: 'lottery_id' });
          lotteryStore.createIndex('cached_at', 'cached_at', { unique: false });
        }

        // Results cache
        if (!db.objectStoreNames.contains(STORES.RESULTS)) {
          const resultsStore = db.createObjectStore(STORES.RESULTS, { keyPath: 'result_id' });
          resultsStore.createIndex('lottery_id', 'lottery_id', { unique: false });
        }

        // Config store
        if (!db.objectStoreNames.contains(STORES.CONFIG)) {
          db.createObjectStore(STORES.CONFIG, { keyPath: 'key' });
        }

        // Bet limits
        if (!db.objectStoreNames.contains(STORES.BET_LIMITS)) {
          db.createObjectStore(STORES.BET_LIMITS, { keyPath: 'bet_type' });
        }

        // Schedules
        if (!db.objectStoreNames.contains(STORES.SCHEDULES)) {
          const schedulesStore = db.createObjectStore(STORES.SCHEDULES, { keyPath: 'schedule_id' });
          schedulesStore.createIndex('lottery_id', 'lottery_id', { unique: false });
        }

        // Sync log
        if (!db.objectStoreNames.contains(STORES.SYNC_LOG)) {
          const syncStore = db.createObjectStore(STORES.SYNC_LOG, { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('type', 'type', { unique: false });
        }

        // Printer config
        if (!db.objectStoreNames.contains(STORES.PRINTER)) {
          db.createObjectStore(STORES.PRINTER, { keyPath: 'key' });
        }

        console.log('[OfflineDB] All stores created');
      };
    });

    return this.initPromise;
  }

  /**
   * Ensure database is ready
   */
  async ensureReady() {
    if (!this.isReady) {
      await this.init();
    }
    return this.db;
  }

  // ==================== GENERIC OPERATIONS ====================

  async put(storeName, data) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName, key) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllByIndex(storeName, indexName, value) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, key) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async count(storeName) {
    await this.ensureReady();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Save user session (replaces localStorage for auth)
   */
  async saveSession(user, token) {
    const sessionData = {
      key: 'current_session',
      user,
      token,
      saved_at: Date.now(),
      expires_at: Date.now() + CACHE_TTL.SESSION
    };
    await this.put(STORES.SESSION, sessionData);
    
    // Also save token separately for quick access
    await this.put(STORES.SESSION, {
      key: 'auth_token',
      token,
      saved_at: Date.now()
    });
    
    console.log('[OfflineDB] Session saved');
    return sessionData;
  }

  /**
   * Get current session
   */
  async getSession() {
    const session = await this.get(STORES.SESSION, 'current_session');
    if (!session) return null;
    
    // Check if expired
    if (Date.now() > session.expires_at) {
      console.log('[OfflineDB] Session expired');
      await this.clearSession();
      return null;
    }
    
    return session;
  }

  /**
   * Get auth token
   */
  async getToken() {
    const tokenData = await this.get(STORES.SESSION, 'auth_token');
    return tokenData?.token || null;
  }

  /**
   * Clear session (logout)
   */
  async clearSession() {
    await this.delete(STORES.SESSION, 'current_session');
    await this.delete(STORES.SESSION, 'auth_token');
    console.log('[OfflineDB] Session cleared');
  }

  /**
   * Update session user data
   */
  async updateSessionUser(updates) {
    const session = await this.getSession();
    if (session) {
      session.user = { ...session.user, ...updates };
      await this.put(STORES.SESSION, session);
    }
    return session;
  }

  // ==================== TICKET MANAGEMENT ====================

  /**
   * Generate offline ticket ID
   */
  generateOfflineId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `OFF_${timestamp}_${random}`.toUpperCase();
  }

  /**
   * Save ticket for offline mode (queued for sync)
   */
  async savePendingTicket(ticketData) {
    const offline_id = this.generateOfflineId();
    const ticket = {
      offline_id,
      ...ticketData,
      status: 'pending',
      created_at: new Date().toISOString(),
      attempts: 0,
      last_attempt: null,
      printed: false
    };
    
    await this.put(STORES.TICKETS_PENDING, ticket);
    await this.logSync('ticket_created_offline', { offline_id });
    
    console.log('[OfflineDB] Pending ticket saved:', offline_id);
    return ticket;
  }

  /**
   * Get all pending tickets
   */
  async getPendingTickets() {
    const tickets = await this.getAll(STORES.TICKETS_PENDING);
    // Sort by creation date, oldest first
    return tickets.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  /**
   * Get pending tickets count
   */
  async getPendingCount() {
    return await this.count(STORES.TICKETS_PENDING);
  }

  /**
   * Mark ticket as synced
   */
  async markTicketSynced(offline_id, server_ticket_id, serverResponse = {}) {
    const ticket = await this.get(STORES.TICKETS_PENDING, offline_id);
    if (!ticket) return null;

    const syncedTicket = {
      ...ticket,
      ...serverResponse,
      server_ticket_id,
      status: 'synced',
      synced_at: new Date().toISOString()
    };

    await this.put(STORES.TICKETS_SYNCED, syncedTicket);
    await this.delete(STORES.TICKETS_PENDING, offline_id);
    await this.logSync('ticket_synced', { offline_id, server_ticket_id });

    console.log('[OfflineDB] Ticket synced:', offline_id, '->', server_ticket_id);
    return syncedTicket;
  }

  /**
   * Mark ticket as failed (after max retries)
   */
  async markTicketFailed(offline_id, error) {
    const ticket = await this.get(STORES.TICKETS_PENDING, offline_id);
    if (!ticket) return null;

    const failedTicket = {
      ...ticket,
      status: 'failed',
      error: error?.message || error || 'Unknown error',
      failed_at: new Date().toISOString()
    };

    await this.put(STORES.TICKETS_FAILED, failedTicket);
    await this.delete(STORES.TICKETS_PENDING, offline_id);
    await this.logSync('ticket_failed', { offline_id, error: failedTicket.error });

    console.log('[OfflineDB] Ticket failed:', offline_id, error);
    return failedTicket;
  }

  /**
   * Update ticket attempt count
   */
  async incrementTicketAttempt(offline_id, error = null) {
    const ticket = await this.get(STORES.TICKETS_PENDING, offline_id);
    if (!ticket) return null;

    ticket.attempts++;
    ticket.last_attempt = new Date().toISOString();
    ticket.last_error = error;

    await this.put(STORES.TICKETS_PENDING, ticket);
    return ticket;
  }

  /**
   * Mark ticket as printed
   */
  async markTicketPrinted(offline_id) {
    // Check pending first
    let ticket = await this.get(STORES.TICKETS_PENDING, offline_id);
    let store = STORES.TICKETS_PENDING;
    
    if (!ticket) {
      // Check synced tickets
      ticket = await this.get(STORES.TICKETS_SYNCED, offline_id);
      store = STORES.TICKETS_SYNCED;
    }
    
    if (ticket) {
      ticket.printed = true;
      ticket.printed_at = new Date().toISOString();
      await this.put(store, ticket);
    }
    
    return ticket;
  }

  /**
   * Get synced tickets (for history)
   */
  async getSyncedTickets(limit = 50) {
    const tickets = await this.getAll(STORES.TICKETS_SYNCED);
    return tickets
      .sort((a, b) => new Date(b.synced_at) - new Date(a.synced_at))
      .slice(0, limit);
  }

  /**
   * Get failed tickets
   */
  async getFailedTickets() {
    return await this.getAll(STORES.TICKETS_FAILED);
  }

  /**
   * Retry failed ticket
   */
  async retryFailedTicket(offline_id) {
    const ticket = await this.get(STORES.TICKETS_FAILED, offline_id);
    if (!ticket) return null;

    // Move back to pending
    ticket.status = 'pending';
    ticket.attempts = 0;
    ticket.last_attempt = null;
    delete ticket.error;
    delete ticket.failed_at;

    await this.put(STORES.TICKETS_PENDING, ticket);
    await this.delete(STORES.TICKETS_FAILED, offline_id);

    return ticket;
  }

  // ==================== LOTTERY DATA CACHING ====================

  /**
   * Cache lotteries
   */
  async cacheLotteries(lotteries) {
    const cached_at = Date.now();
    
    // Clear old cache
    await this.clear(STORES.LOTTERIES);
    
    // Add each lottery
    for (const lottery of lotteries) {
      await this.put(STORES.LOTTERIES, {
        ...lottery,
        lottery_id: lottery.lottery_id,
        cached_at
      });
    }
    
    // Save cache timestamp
    await this.put(STORES.CONFIG, {
      key: 'lotteries_cache_time',
      value: cached_at
    });
    
    console.log('[OfflineDB] Cached', lotteries.length, 'lotteries');
  }

  /**
   * Get cached lotteries
   */
  async getCachedLotteries() {
    const cacheTime = await this.get(STORES.CONFIG, 'lotteries_cache_time');
    
    // Check if cache is valid
    if (!cacheTime || Date.now() - cacheTime.value > CACHE_TTL.LOTTERIES) {
      return { data: null, expired: true };
    }
    
    const lotteries = await this.getAll(STORES.LOTTERIES);
    return { data: lotteries, expired: false };
  }

  /**
   * Cache results
   */
  async cacheResults(results) {
    const cached_at = Date.now();
    
    await this.clear(STORES.RESULTS);
    
    for (const result of results) {
      await this.put(STORES.RESULTS, {
        ...result,
        result_id: result.result_id || `${result.lottery_id}_${result.draw_date}`,
        cached_at
      });
    }
    
    await this.put(STORES.CONFIG, {
      key: 'results_cache_time',
      value: cached_at
    });
  }

  /**
   * Get cached results
   */
  async getCachedResults() {
    const cacheTime = await this.get(STORES.CONFIG, 'results_cache_time');
    
    if (!cacheTime || Date.now() - cacheTime.value > CACHE_TTL.RESULTS) {
      return { data: null, expired: true };
    }
    
    const results = await this.getAll(STORES.RESULTS);
    return { data: results, expired: false };
  }

  // ==================== CONFIGURATION CACHING ====================

  /**
   * Cache company config
   */
  async cacheConfig(key, value) {
    await this.put(STORES.CONFIG, {
      key,
      value,
      cached_at: Date.now()
    });
  }

  /**
   * Get cached config
   */
  async getConfig(key, maxAge = CACHE_TTL.CONFIG) {
    const config = await this.get(STORES.CONFIG, key);
    
    if (!config) return null;
    if (Date.now() - config.cached_at > maxAge) return null;
    
    return config.value;
  }

  /**
   * Cache all vendor config
   */
  async cacheVendorConfig(config) {
    await this.cacheConfig('vendor_config', config);
    
    // Also cache individual items for easy access
    if (config.company) await this.cacheConfig('company', config.company);
    if (config.succursale) await this.cacheConfig('succursale', config.succursale);
    if (config.profile) await this.cacheConfig('vendor_profile', config.profile);
    if (config.betLimits) await this.cacheBetLimits(config.betLimits);
  }

  /**
   * Get cached vendor config
   */
  async getVendorConfig() {
    return await this.getConfig('vendor_config');
  }

  // ==================== BET LIMITS ====================

  /**
   * Cache bet limits
   */
  async cacheBetLimits(limits) {
    await this.clear(STORES.BET_LIMITS);
    
    for (const [betType, limitData] of Object.entries(limits)) {
      await this.put(STORES.BET_LIMITS, {
        bet_type: betType,
        ...limitData,
        cached_at: Date.now()
      });
    }
    
    await this.put(STORES.CONFIG, {
      key: 'bet_limits_cache_time',
      value: Date.now()
    });
  }

  /**
   * Get cached bet limits
   */
  async getCachedBetLimits() {
    const cacheTime = await this.get(STORES.CONFIG, 'bet_limits_cache_time');
    
    if (!cacheTime || Date.now() - cacheTime.value > CACHE_TTL.BET_LIMITS) {
      return { data: null, expired: true };
    }
    
    const limits = await this.getAll(STORES.BET_LIMITS);
    // Convert to object format
    const limitsObj = {};
    for (const limit of limits) {
      limitsObj[limit.bet_type] = limit;
    }
    return { data: limitsObj, expired: false };
  }

  // ==================== PRINTER CONFIG ====================

  /**
   * Save printer config
   */
  async savePrinterConfig(config) {
    await this.put(STORES.PRINTER, {
      key: 'printer_config',
      ...config,
      saved_at: Date.now()
    });
  }

  /**
   * Get printer config
   */
  async getPrinterConfig() {
    return await this.get(STORES.PRINTER, 'printer_config');
  }

  // ==================== SYNC LOG ====================

  /**
   * Log sync event
   */
  async logSync(type, data = {}) {
    await this.put(STORES.SYNC_LOG, {
      type,
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get sync log
   */
  async getSyncLog(limit = 100) {
    const logs = await this.getAll(STORES.SYNC_LOG);
    return logs
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Clear old sync logs (keep last 24 hours)
   */
  async cleanSyncLog() {
    const logs = await this.getAll(STORES.SYNC_LOG);
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    
    for (const log of logs) {
      if (log.timestamp < cutoff) {
        await this.delete(STORES.SYNC_LOG, log.id);
      }
    }
  }

  // ==================== STATS ====================

  /**
   * Get database stats
   */
  async getStats() {
    const [
      pendingCount,
      syncedCount,
      failedCount,
      lotteriesCount
    ] = await Promise.all([
      this.count(STORES.TICKETS_PENDING),
      this.count(STORES.TICKETS_SYNCED),
      this.count(STORES.TICKETS_FAILED),
      this.count(STORES.LOTTERIES)
    ]);
    
    const session = await this.getSession();
    
    return {
      pendingTickets: pendingCount,
      syncedTickets: syncedCount,
      failedTickets: failedCount,
      cachedLotteries: lotteriesCount,
      hasSession: !!session,
      sessionExpires: session?.expires_at
    };
  }
}

// Singleton instance
export const offlineDB = new OfflineDBService();

// Initialize immediately
offlineDB.init().catch(err => console.error('[OfflineDB] Init error:', err));

export default offlineDB;
