/**
 * Bluetooth Printer Service
 * Handles connection and printing to Bluetooth thermal printers
 */

import { buildTicketBytes } from './escpos';

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
  }

  /**
   * Check if Web Bluetooth is supported
   */
  isSupported() {
    return typeof navigator !== 'undefined' && 
           navigator.bluetooth !== undefined;
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
    this.listeners.forEach(cb => cb({
      isConnected: this.isConnected,
      printerName: this.printerName,
      paperWidth: this.paperWidth
    }));
  }

  /**
   * Scan and connect to a Bluetooth printer
   */
  async connect() {
    if (!this.isSupported()) {
      throw new Error('Bluetooth non supporté sur ce navigateur');
    }

    try {
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
      
      // Save to localStorage
      this.saveConnection();
      
      this.notifyListeners();
      
      return {
        success: true,
        printerName: this.printerName
      };
    } catch (error) {
      console.error('Bluetooth connection error:', error);
      this.isConnected = false;
      this.notifyListeners();
      throw error;
    }
  }

  /**
   * Handle disconnection
   */
  handleDisconnect() {
    this.isConnected = false;
    this.characteristic = null;
    this.service = null;
    this.server = null;
    this.notifyListeners();
  }

  /**
   * Disconnect from printer
   */
  async disconnect() {
    if (this.device && this.device.gatt.connected) {
      await this.device.gatt.disconnect();
    }
    this.handleDisconnect();
    localStorage.removeItem('lottolab_printer');
  }

  /**
   * Save connection info to localStorage
   */
  saveConnection() {
    localStorage.setItem('lottolab_printer', JSON.stringify({
      name: this.printerName,
      paperWidth: this.paperWidth,
      connectedAt: new Date().toISOString()
    }));
  }

  /**
   * Get saved printer info
   */
  getSavedPrinter() {
    try {
      const saved = localStorage.getItem('lottolab_printer');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  /**
   * Set paper width (58mm or 80mm)
   */
  setPaperWidth(width) {
    this.paperWidth = width === 58 ? 58 : 80;
    this.saveConnection();
  }

  /**
   * Write data to printer in chunks
   */
  async writeData(data) {
    if (!this.characteristic) {
      throw new Error('Imprimante non connectée');
    }

    const CHUNK_SIZE = 100; // Reduced for better compatibility
    
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      
      try {
        if (this.characteristic.properties.writeWithoutResponse) {
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.characteristic.writeValue(chunk);
        }
      } catch (error) {
        console.error('Write error at chunk', i, error);
        throw error;
      }
      
      // Small delay between chunks for printer buffer
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
      companyName: 'LOTTOLAB',
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
      footerMessage: 'Imprimante connectée!'
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
}

// Singleton instance
export const bluetoothPrinter = new BluetoothPrinterService();

export default bluetoothPrinter;
