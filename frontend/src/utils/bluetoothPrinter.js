/**
 * LOTTOLAB PRO - Bluetooth Printer Service
 * =========================================
 * Handles connection and printing to Bluetooth thermal printers
 * 
 * Supports:
 * - Web Bluetooth API (Chrome, Edge)
 * - Native Android bridge via Capacitor/Cordova
 * - 58mm and 80mm paper widths
 * - Auto-reconnection
 */

import { buildTicketBytes } from './escpos';
import { offlineDB } from '../services/offlineDB';

// Bluetooth Service UUIDs for common thermal printers
const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Generic thermal printer
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ESC/POS printers
  '0000ff00-0000-1000-8000-00805f9b34fb', // Some Chinese printers
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2'  // Other thermal printers
];

const PRINTER_CHARACTERISTIC_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'
];

class BluetoothPrinterService {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.isConnected = false;
    this.printerName = null;
    this.paperWidth = 80; // Default 80mm
    this.listeners = new Set();
    this.useNativeBridge = false;
    this.nativeBridge = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    
    // Check for native bridge
    this.detectNativeBridge();
    
    // Load saved config
    this.loadSavedConfig();
  }

  /**
   * Detect native Android/iOS bridge
   */
  detectNativeBridge() {
    // Check for Capacitor
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BluetoothPrinter) {
      console.log('[Printer] Native Capacitor bridge detected');
      this.useNativeBridge = true;
      this.nativeBridge = window.Capacitor.Plugins.BluetoothPrinter;
      return;
    }
    
    // Check for Cordova
    if (window.cordova && window.cordova.plugins && window.cordova.plugins.bluetoothPrinter) {
      console.log('[Printer] Native Cordova bridge detected');
      this.useNativeBridge = true;
      this.nativeBridge = window.cordova.plugins.bluetoothPrinter;
      return;
    }
    
    // Check for custom LOTTOLAB native bridge
    if (window.LottoLabPrinter) {
      console.log('[Printer] Native LOTTOLAB bridge detected');
      this.useNativeBridge = true;
      this.nativeBridge = window.LottoLabPrinter;
      return;
    }
    
    console.log('[Printer] Using Web Bluetooth API');
    this.useNativeBridge = false;
  }

  /**
   * Load saved config from IndexedDB
   */
  async loadSavedConfig() {
    try {
      const config = await offlineDB.getPrinterConfig();
      if (config) {
        this.printerName = config.name;
        this.paperWidth = config.paperWidth || 80;
        console.log('[Printer] Loaded saved config:', config);
      }
    } catch (e) {
      console.warn('[Printer] Could not load saved config:', e);
    }
  }

  /**
   * Check if Bluetooth is supported
   */
  isSupported() {
    if (this.useNativeBridge) return true;
    return typeof navigator !== 'undefined' && navigator.bluetooth !== undefined;
  }

  /**
   * Add connection state listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of state change
   */
  notifyListeners() {
    const state = {
      isConnected: this.isConnected,
      printerName: this.printerName,
      paperWidth: this.paperWidth,
      useNativeBridge: this.useNativeBridge
    };
    this.listeners.forEach(cb => cb(state));
  }

  /**
   * Scan and connect to a Bluetooth printer
   */
  async connect() {
    if (this.useNativeBridge) {
      return await this.connectNative();
    }
    return await this.connectWebBluetooth();
  }

  /**
   * Connect via native bridge (Capacitor/Cordova)
   */
  async connectNative() {
    try {
      console.log('[Printer] Connecting via native bridge...');
      
      // Scan for devices
      const devices = await this.nativeBridge.scan();
      
      if (!devices || devices.length === 0) {
        throw new Error('Aucune imprimante trouvée');
      }
      
      // For now, auto-select first printer or show selection
      // In production, you'd show a picker UI
      const selectedDevice = devices[0];
      
      // Connect
      await this.nativeBridge.connect(selectedDevice.address || selectedDevice.id);
      
      this.printerName = selectedDevice.name || 'Imprimante Bluetooth';
      this.isConnected = true;
      
      // Save config
      await this.saveConfig();
      this.notifyListeners();
      
      console.log('[Printer] Connected via native bridge:', this.printerName);
      
      return {
        success: true,
        printerName: this.printerName,
        native: true
      };
    } catch (error) {
      console.error('[Printer] Native connection error:', error);
      this.isConnected = false;
      this.notifyListeners();
      throw error;
    }
  }

  /**
   * Connect via Web Bluetooth API
   */
  async connectWebBluetooth() {
    if (!this.isSupported()) {
      throw new Error('Bluetooth non supporté sur ce navigateur');
    }

    try {
      console.log('[Printer] Connecting via Web Bluetooth...');
      
      // Request device with filters for thermal printers
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICE_UUIDS
      });

      this.printerName = this.device.name || 'Imprimante Bluetooth';
      
      // Listen for disconnection
      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnect();
      });

      // Connect to GATT server
      this.server = await this.device.gatt.connect();
      
      // Find the right service and characteristic
      for (const serviceUuid of PRINTER_SERVICE_UUIDS) {
        try {
          this.service = await this.server.getPrimaryService(serviceUuid);
          
          for (const charUuid of PRINTER_CHARACTERISTIC_UUIDS) {
            try {
              this.characteristic = await this.service.getCharacteristic(charUuid);
              break;
            } catch (e) {
              continue;
            }
          }
          
          if (this.characteristic) break;
          
          // Try to get all characteristics
          const characteristics = await this.service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              this.characteristic = char;
              break;
            }
          }
          
          if (this.characteristic) break;
        } catch (e) {
          continue;
        }
      }

      if (!this.characteristic) {
        throw new Error('Impossible de trouver le service d\'impression');
      }

      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Save config
      await this.saveConfig();
      this.notifyListeners();
      
      console.log('[Printer] Connected via Web Bluetooth:', this.printerName);
      
      return {
        success: true,
        printerName: this.printerName,
        native: false
      };
    } catch (error) {
      console.error('[Printer] Web Bluetooth connection error:', error);
      this.isConnected = false;
      this.notifyListeners();
      throw error;
    }
  }

  /**
   * Handle disconnection
   */
  handleDisconnect() {
    console.log('[Printer] Disconnected');
    this.isConnected = false;
    this.characteristic = null;
    this.service = null;
    this.server = null;
    this.notifyListeners();
    
    // Attempt auto-reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[Printer] Auto-reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      setTimeout(() => this.attemptReconnect(), 2000);
    }
  }

  /**
   * Attempt to reconnect
   */
  async attemptReconnect() {
    if (this.isConnected) return;
    
    try {
      if (this.useNativeBridge && this.printerName) {
        // Try native reconnect
        await this.nativeBridge.reconnect();
        this.isConnected = true;
        this.notifyListeners();
      } else if (this.device && this.device.gatt) {
        // Try Web Bluetooth reconnect
        this.server = await this.device.gatt.connect();
        // Re-establish characteristic...
        this.isConnected = true;
        this.notifyListeners();
      }
    } catch (e) {
      console.warn('[Printer] Reconnect failed:', e);
    }
  }

  /**
   * Disconnect from printer
   */
  async disconnect() {
    if (this.useNativeBridge && this.nativeBridge) {
      try {
        await this.nativeBridge.disconnect();
      } catch (e) {
        console.warn('[Printer] Native disconnect error:', e);
      }
    } else if (this.device && this.device.gatt.connected) {
      await this.device.gatt.disconnect();
    }
    
    this.handleDisconnect();
    await offlineDB.delete('printer', 'printer_config');
  }

  /**
   * Save printer config
   */
  async saveConfig() {
    try {
      await offlineDB.savePrinterConfig({
        name: this.printerName,
        paperWidth: this.paperWidth,
        useNativeBridge: this.useNativeBridge,
        connectedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[Printer] Could not save config:', e);
    }
  }

  /**
   * Get saved printer info (sync method for backwards compatibility)
   */
  getSavedPrinter() {
    // Return cached info if available
    if (this.printerName) {
      return {
        name: this.printerName,
        paperWidth: this.paperWidth,
        useNativeBridge: this.useNativeBridge
      };
    }
    return null;
  }

  /**
   * Set paper width (58mm or 80mm)
   */
  setPaperWidth(width) {
    this.paperWidth = width === 58 ? 58 : 80;
    this.saveConfig();
  }

  /**
   * Write data to printer
   */
  async writeData(data) {
    if (this.useNativeBridge) {
      return await this.writeNative(data);
    }
    return await this.writeWebBluetooth(data);
  }

  /**
   * Write via native bridge
   */
  async writeNative(data) {
    if (!this.nativeBridge) {
      throw new Error('Bridge natif non disponible');
    }
    
    // Convert Uint8Array to base64 for native bridge
    const base64 = btoa(String.fromCharCode.apply(null, data));
    await this.nativeBridge.print(base64);
  }

  /**
   * Write via Web Bluetooth
   */
  async writeWebBluetooth(data) {
    if (!this.characteristic) {
      throw new Error('Imprimante non connectée');
    }

    const CHUNK_SIZE = 100;
    
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      
      try {
        if (this.characteristic.properties.writeWithoutResponse) {
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.characteristic.writeValue(chunk);
        }
      } catch (error) {
        console.error('[Printer] Write error at chunk', i, error);
        throw error;
      }
      
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }

  /**
   * Print a ticket
   */
  async printTicket(ticketData, options = {}) {
    if (!this.isConnected) {
      throw new Error('Imprimante non connectée');
    }

    const bytes = buildTicketBytes(ticketData, {
      paperWidth: this.paperWidth,
      ...options
    });

    await this.writeData(bytes);
    
    return { success: true };
  }

  /**
   * Print test page
   */
  async printTest() {
    const testData = {
      companyName: 'LOTTOLAB PRO',
      branchName: 'Test Impression',
      ticketId: 'TEST-' + Date.now(),
      dateTime: new Date().toLocaleString('fr-FR'),
      vendorName: 'Test',
      lotteryName: 'Test Loterie',
      plays: [
        { numbers: '12', betType: 'BORLETTE', amount: 10 },
        { numbers: '345', betType: 'LOTO3', amount: 25 }
      ],
      totalAmount: 35,
      status: 'TEST IMPRESSION OK',
      footerMessage: `Imprimante: ${this.printerName}\nPapier: ${this.paperWidth}mm`
    };

    return await this.printTicket(testData);
  }

  /**
   * Print raw ESC/POS commands
   */
  async printRaw(bytes) {
    if (!this.isConnected) {
      throw new Error('Imprimante non connectée');
    }
    await this.writeData(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  }

  /**
   * Get printer status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      printerName: this.printerName,
      paperWidth: this.paperWidth,
      useNativeBridge: this.useNativeBridge,
      isSupported: this.isSupported()
    };
  }
}

// Singleton instance
export const bluetoothPrinter = new BluetoothPrinterService();

export default bluetoothPrinter;
