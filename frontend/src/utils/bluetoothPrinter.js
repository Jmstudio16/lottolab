/**
 * LOTTOLAB PRO - Ultra-Fast Bluetooth Printer Service
 * =====================================================
 * Optimized for POS devices with weak internet
 * 
 * Features:
 * - Web Bluetooth API (Chrome/Edge)
 * - Native Android bridge (Capacitor)
 * - Auto-reconnection
 * - Offline printing (no server needed)
 * - 58mm and 80mm paper support
 * - Queue management for multiple prints
 */

import { offlineDB } from '../services/offlineDB';
import { buildTicketBytes } from './escpos';

// Common Bluetooth printer service UUIDs
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '00001101-0000-1000-8000-00805f9b34fb' // SPP UUID
];

const PRINTER_CHARACTERISTICS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'
];

class UltraBluetoothPrinter {
  constructor() {
    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.printerName = null;
    this.printerAddress = null;
    this.paperWidth = 80;
    this.listeners = new Set();
    this.printQueue = [];
    this.isPrinting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.useNativeBridge = false;
    this.nativeBridge = null;
    
    // Initialize
    this.init();
  }

  async init() {
    // Detect native bridge (Capacitor/Cordova)
    this.detectNativeBridge();
    
    // Load saved config
    await this.loadConfig();
    
    // Auto-connect if saved printer exists
    setTimeout(() => this.tryAutoConnect(), 1000);
    
    console.log('[Printer] Initialized', {
      useNativeBridge: this.useNativeBridge,
      savedPrinter: this.printerName
    });
  }

  detectNativeBridge() {
    // Check for Capacitor Bluetooth plugin
    if (window.Capacitor?.Plugins?.BluetoothPrinter) {
      this.useNativeBridge = true;
      this.nativeBridge = window.Capacitor.Plugins.BluetoothPrinter;
      console.log('[Printer] Using Capacitor native bridge');
      return;
    }
    
    // Check for Cordova Bluetooth plugin
    if (window.cordova?.plugins?.bluetoothSerial) {
      this.useNativeBridge = true;
      this.nativeBridge = {
        scan: () => new Promise((resolve, reject) => {
          window.cordova.plugins.bluetoothSerial.list(resolve, reject);
        }),
        connect: (address) => new Promise((resolve, reject) => {
          window.cordova.plugins.bluetoothSerial.connect(address, resolve, reject);
        }),
        disconnect: () => new Promise((resolve, reject) => {
          window.cordova.plugins.bluetoothSerial.disconnect(resolve, reject);
        }),
        write: (data) => new Promise((resolve, reject) => {
          window.cordova.plugins.bluetoothSerial.write(data, resolve, reject);
        }),
        isConnected: () => new Promise((resolve) => {
          window.cordova.plugins.bluetoothSerial.isConnected(
            () => resolve(true),
            () => resolve(false)
          );
        })
      };
      console.log('[Printer] Using Cordova native bridge');
      return;
    }
    
    // Check for custom LOTTOLAB bridge
    if (window.LottoLabPrinter) {
      this.useNativeBridge = true;
      this.nativeBridge = window.LottoLabPrinter;
      console.log('[Printer] Using LOTTOLAB native bridge');
      return;
    }
    
    console.log('[Printer] Using Web Bluetooth API');
  }

  async loadConfig() {
    try {
      const config = await offlineDB.getPrinterConfig();
      if (config) {
        this.printerName = config.name;
        this.printerAddress = config.address;
        this.paperWidth = config.paperWidth || 80;
      }
    } catch (e) {
      console.warn('[Printer] Could not load config:', e);
    }
  }

  async saveConfig() {
    try {
      await offlineDB.savePrinterConfig({
        name: this.printerName,
        address: this.printerAddress,
        paperWidth: this.paperWidth,
        useNativeBridge: this.useNativeBridge,
        connectedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[Printer] Could not save config:', e);
    }
  }

  // Check if Bluetooth is supported
  isSupported() {
    if (this.useNativeBridge) return true;
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  // Add listener for state changes
  addListener(callback) {
    this.listeners.add(callback);
    callback(this.getState());
    return () => this.listeners.delete(callback);
  }

  // Notify all listeners
  notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(cb => {
      try { cb(state); } catch (e) { console.error('[Printer] Listener error:', e); }
    });
  }

  // Get current state
  getState() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      printerName: this.printerName,
      printerAddress: this.printerAddress,
      paperWidth: this.paperWidth,
      useNativeBridge: this.useNativeBridge,
      queueLength: this.printQueue.length,
      isPrinting: this.isPrinting
    };
  }

  // Scan for available printers (Native only)
  async scanDevices() {
    if (!this.useNativeBridge || !this.nativeBridge?.scan) {
      throw new Error('Scan only available on native app');
    }
    
    try {
      const devices = await this.nativeBridge.scan();
      return devices.map(d => ({
        name: d.name || d.id || 'Unknown',
        address: d.address || d.id,
        id: d.id || d.address
      }));
    } catch (error) {
      console.error('[Printer] Scan error:', error);
      throw error;
    }
  }

  // Connect to printer
  async connect(deviceAddress = null) {
    if (this.isConnecting) {
      console.log('[Printer] Already connecting...');
      return { success: false, reason: 'already_connecting' };
    }
    
    this.isConnecting = true;
    this.notifyListeners();
    
    try {
      if (this.useNativeBridge) {
        return await this.connectNative(deviceAddress);
      } else {
        return await this.connectWebBluetooth();
      }
    } catch (error) {
      console.error('[Printer] Connection error:', error);
      this.isConnected = false;
      this.isConnecting = false;
      this.notifyListeners();
      throw error;
    }
  }

  // Connect via native bridge
  async connectNative(address) {
    if (!this.nativeBridge) {
      throw new Error('Native bridge not available');
    }
    
    try {
      // If no address provided, scan and use first device
      if (!address) {
        const devices = await this.scanDevices();
        if (devices.length === 0) {
          throw new Error('Aucune imprimante trouvée');
        }
        address = devices[0].address;
        this.printerName = devices[0].name;
      }
      
      await this.nativeBridge.connect(address);
      
      this.printerAddress = address;
      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      
      await this.saveConfig();
      this.notifyListeners();
      
      console.log('[Printer] Connected via native:', this.printerName);
      
      return { success: true, printerName: this.printerName };
    } catch (error) {
      this.isConnecting = false;
      this.notifyListeners();
      throw error;
    }
  }

  // Connect via Web Bluetooth
  async connectWebBluetooth() {
    if (!this.isSupported()) {
      throw new Error('Bluetooth non supporté');
    }
    
    try {
      // Request device
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICES
      });
      
      this.printerName = this.device.name || 'Imprimante Bluetooth';
      
      // Listen for disconnection
      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnect();
      });
      
      // Connect to GATT server
      this.server = await this.device.gatt.connect();
      
      // Find service and characteristic
      for (const serviceUuid of PRINTER_SERVICES) {
        try {
          const service = await this.server.getPrimaryService(serviceUuid);
          
          // Try known characteristics
          for (const charUuid of PRINTER_CHARACTERISTICS) {
            try {
              this.characteristic = await service.getCharacteristic(charUuid);
              break;
            } catch (e) { continue; }
          }
          
          // If not found, get first writable characteristic
          if (!this.characteristic) {
            const chars = await service.getCharacteristics();
            for (const char of chars) {
              if (char.properties.write || char.properties.writeWithoutResponse) {
                this.characteristic = char;
                break;
              }
            }
          }
          
          if (this.characteristic) break;
        } catch (e) { continue; }
      }
      
      if (!this.characteristic) {
        throw new Error('Service d\'impression non trouvé');
      }
      
      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      
      await this.saveConfig();
      this.notifyListeners();
      
      console.log('[Printer] Connected via Web Bluetooth:', this.printerName);
      
      return { success: true, printerName: this.printerName };
    } catch (error) {
      this.isConnecting = false;
      this.notifyListeners();
      throw error;
    }
  }

  // Handle disconnection
  handleDisconnect() {
    console.log('[Printer] Disconnected');
    this.isConnected = false;
    this.characteristic = null;
    this.server = null;
    this.notifyListeners();
    
    // Auto-reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(2000 * this.reconnectAttempts, 10000);
      console.log(`[Printer] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.tryAutoConnect(), delay);
    }
  }

  // Try to auto-connect
  async tryAutoConnect() {
    if (this.isConnected || this.isConnecting) return;
    if (!this.printerAddress && !this.useNativeBridge) return;
    
    try {
      if (this.useNativeBridge && this.printerAddress) {
        await this.connectNative(this.printerAddress);
      }
    } catch (e) {
      console.log('[Printer] Auto-connect failed:', e.message);
    }
  }

  // Disconnect
  async disconnect() {
    try {
      if (this.useNativeBridge && this.nativeBridge?.disconnect) {
        await this.nativeBridge.disconnect();
      } else if (this.device?.gatt?.connected) {
        await this.device.gatt.disconnect();
      }
    } catch (e) {
      console.warn('[Printer] Disconnect error:', e);
    }
    
    this.isConnected = false;
    this.characteristic = null;
    this.server = null;
    this.device = null;
    this.printerAddress = null;
    this.printerName = null;
    this.notifyListeners();
    
    // Clear saved config
    try {
      await offlineDB.delete('printer', 'printer_config');
    } catch (e) {}
  }

  // Set paper width
  setPaperWidth(width) {
    this.paperWidth = width === 58 ? 58 : 80;
    this.saveConfig();
    this.notifyListeners();
  }

  // Write data to printer
  async writeData(data) {
    if (this.useNativeBridge) {
      return await this.writeNative(data);
    }
    return await this.writeWebBluetooth(data);
  }

  // Write via native bridge
  async writeNative(data) {
    if (!this.nativeBridge?.write) {
      throw new Error('Native write not available');
    }
    
    // Convert to base64 for native bridge
    const base64 = btoa(String.fromCharCode.apply(null, data));
    await this.nativeBridge.write(base64);
  }

  // Write via Web Bluetooth
  async writeWebBluetooth(data) {
    if (!this.characteristic) {
      throw new Error('Imprimante non connectée');
    }
    
    const CHUNK_SIZE = 100;
    
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      
      if (this.characteristic.properties.writeWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValue(chunk);
      }
      
      // Small delay between chunks
      await new Promise(r => setTimeout(r, 15));
    }
  }

  // Add print job to queue
  queuePrint(ticketData, options = {}) {
    return new Promise((resolve, reject) => {
      this.printQueue.push({ ticketData, options, resolve, reject });
      this.processQueue();
    });
  }

  // Process print queue
  async processQueue() {
    if (this.isPrinting || this.printQueue.length === 0) return;
    if (!this.isConnected) {
      // Reject all pending jobs
      while (this.printQueue.length > 0) {
        const job = this.printQueue.shift();
        job.reject(new Error('Imprimante non connectée'));
      }
      return;
    }
    
    this.isPrinting = true;
    this.notifyListeners();
    
    const job = this.printQueue.shift();
    
    try {
      await this.printTicketDirect(job.ticketData, job.options);
      job.resolve({ success: true });
    } catch (error) {
      job.reject(error);
    }
    
    this.isPrinting = false;
    this.notifyListeners();
    
    // Process next in queue
    if (this.printQueue.length > 0) {
      setTimeout(() => this.processQueue(), 100);
    }
  }

  // Print ticket directly
  async printTicketDirect(ticketData, options = {}) {
    const bytes = buildTicketBytes(ticketData, {
      paperWidth: this.paperWidth,
      ...options
    });
    
    await this.writeData(bytes);
  }

  // Print ticket (with queue)
  async printTicket(ticketData, options = {}) {
    if (!this.isConnected) {
      throw new Error('Imprimante non connectée');
    }
    
    return this.queuePrint(ticketData, options);
  }

  // Print test page
  async printTest() {
    const testData = {
      companyName: 'LOTTOLAB PRO',
      branchName: 'Test Impression',
      ticketId: 'TEST-' + Date.now().toString(36).toUpperCase(),
      dateTime: new Date().toLocaleString('fr-FR'),
      vendorName: 'Test',
      lotteryName: 'Test Loterie',
      plays: [
        { numbers: '12', betType: 'BORLETTE', amount: 100 },
        { numbers: '345', betType: 'LOTO3', amount: 250 },
        { numbers: '6789', betType: 'LOTO4', amount: 500 }
      ],
      totalAmount: 850,
      status: 'TEST OK',
      footerMessage: `Imprimante: ${this.printerName || 'N/A'}\nPapier: ${this.paperWidth}mm\n✓ Connexion réussie`
    };
    
    return this.printTicket(testData);
  }

  // Get saved printer info
  getSavedPrinter() {
    return this.printerName ? {
      name: this.printerName,
      address: this.printerAddress,
      paperWidth: this.paperWidth
    } : null;
  }
}

// Singleton instance
export const bluetoothPrinter = new UltraBluetoothPrinter();
export default bluetoothPrinter;
