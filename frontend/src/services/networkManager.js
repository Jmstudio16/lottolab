/**
 * LOTTOLAB Network Manager
 * ========================
 * Gestion intelligente de la connexion réseau
 * - Détection qualité réseau (Online/Faible/Offline)
 * - Adaptation automatique du comportement
 * - Indicateurs visuels
 */

class NetworkManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.quality = 'unknown';
    this.listeners = new Set();
    this.pingInterval = null;
    this.lastPingTime = null;
    this.apiUrl = null;
    
    // Listen for network changes
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
    
    // Start quality monitoring
    this.startMonitoring();
  }

  /**
   * Set API URL for ping tests
   */
  setApiUrl(url) {
    this.apiUrl = url;
  }

  /**
   * Add listener
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
        console.error('[NetworkManager] Listener error:', e);
      }
    });
  }

  /**
   * Get current network status
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      quality: this.quality,
      effectiveType: this.getEffectiveType(),
      downlink: this.getDownlink(),
      rtt: this.getRtt(),
      lastPingTime: this.lastPingTime,
      shouldUseCache: this.shouldUseCache(),
      shouldUseOffline: this.shouldUseOffline()
    };
  }

  /**
   * Get network effective type from Network Information API
   */
  getEffectiveType() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return connection?.effectiveType || 'unknown';
  }

  /**
   * Get downlink speed
   */
  getDownlink() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return connection?.downlink || null;
  }

  /**
   * Get round-trip time
   */
  getRtt() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return connection?.rtt || null;
  }

  /**
   * Handle network change
   */
  handleNetworkChange(isOnline) {
    this.isOnline = isOnline;
    
    if (isOnline) {
      this.checkQuality();
    } else {
      this.quality = 'offline';
    }
    
    this.notifyListeners();
    console.log(`[NetworkManager] Network ${isOnline ? 'online' : 'offline'}, quality: ${this.quality}`);
  }

  /**
   * Start quality monitoring
   */
  startMonitoring() {
    // Check quality every 30 seconds
    this.pingInterval = setInterval(() => {
      if (this.isOnline) {
        this.checkQuality();
      }
    }, 30000);
    
    // Initial check
    if (this.isOnline) {
      this.checkQuality();
    }
    
    // Listen for connection changes
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      connection.addEventListener('change', () => this.checkQuality());
    }
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Check network quality
   */
  async checkQuality() {
    if (!this.isOnline) {
      this.quality = 'offline';
      this.notifyListeners();
      return;
    }
    
    // Use Network Information API first
    const effectiveType = this.getEffectiveType();
    
    if (effectiveType === '4g') {
      this.quality = 'good';
    } else if (effectiveType === '3g') {
      this.quality = 'medium';
    } else if (effectiveType === '2g' || effectiveType === 'slow-2g') {
      this.quality = 'slow';
    } else {
      // Fallback to ping test
      await this.pingTest();
    }
    
    this.notifyListeners();
  }

  /**
   * Ping test to determine quality
   */
  async pingTest() {
    if (!this.apiUrl) {
      this.quality = 'unknown';
      return;
    }
    
    const startTime = performance.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.apiUrl}/api/health`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store'
      });
      
      clearTimeout(timeoutId);
      
      const endTime = performance.now();
      this.lastPingTime = Math.round(endTime - startTime);
      
      if (response.ok) {
        if (this.lastPingTime < 300) {
          this.quality = 'good';
        } else if (this.lastPingTime < 1000) {
          this.quality = 'medium';
        } else {
          this.quality = 'slow';
        }
      } else {
        this.quality = 'slow';
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        this.quality = 'slow';
        this.lastPingTime = 5000;
      } else {
        this.quality = 'offline';
        this.isOnline = false;
      }
    }
  }

  /**
   * Should use cached data?
   */
  shouldUseCache() {
    return !this.isOnline || this.quality === 'slow' || this.quality === 'medium';
  }

  /**
   * Should use offline mode?
   */
  shouldUseOffline() {
    return !this.isOnline || this.quality === 'slow';
  }

  /**
   * Get quality color
   */
  getQualityColor() {
    switch (this.quality) {
      case 'good':
        return '#10b981'; // emerald
      case 'medium':
        return '#f59e0b'; // amber
      case 'slow':
        return '#ef4444'; // red
      case 'offline':
        return '#6b7280'; // gray
      default:
        return '#6b7280';
    }
  }

  /**
   * Get quality label
   */
  getQualityLabel() {
    switch (this.quality) {
      case 'good':
        return 'En ligne';
      case 'medium':
        return 'Moyen';
      case 'slow':
        return 'Lent';
      case 'offline':
        return 'Hors ligne';
      default:
        return 'Vérification...';
    }
  }

  /**
   * Get quality icon name
   */
  getQualityIcon() {
    switch (this.quality) {
      case 'good':
        return 'wifi';
      case 'medium':
        return 'wifi-low';
      case 'slow':
        return 'wifi-off';
      case 'offline':
        return 'wifi-off';
      default:
        return 'loader';
    }
  }

  /**
   * Wait for network
   */
  async waitForNetwork(timeout = 30000) {
    if (this.isOnline && this.quality !== 'offline') {
      return true;
    }
    
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(false);
      }, timeout);
      
      const unsubscribe = this.addListener((status) => {
        if (status.isOnline && status.quality !== 'offline') {
          clearTimeout(timer);
          unsubscribe();
          resolve(true);
        }
      });
    });
  }

  /**
   * Execute with network check
   */
  async executeWithFallback(onlineAction, offlineAction) {
    if (this.shouldUseOffline()) {
      return await offlineAction();
    }
    
    try {
      return await onlineAction();
    } catch (error) {
      console.warn('[NetworkManager] Online action failed, using fallback:', error);
      return await offlineAction();
    }
  }
}

// Singleton instance
export const networkManager = new NetworkManager();
export default networkManager;
