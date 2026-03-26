/**
 * LOTTOLAB - Printer Service
 * Handles thermal printer detection, connection and printing
 * Supports: Bluetooth, USB OTG, WiFi/LAN printers, integrated POS printers
 */

// Printer types
export const PRINTER_TYPES = {
  BLUETOOTH: 'bluetooth',
  USB: 'usb',
  NETWORK: 'network',
  INTEGRATED: 'integrated',
  BROWSER: 'browser'
};

// Printer status
export const PRINTER_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  ERROR: 'error',
  UNKNOWN: 'unknown'
};

// Default printer settings
export const DEFAULT_PRINTER_SETTINGS = {
  paperWidth: '80mm', // 80mm or 58mm
  fontSize: 'normal', // small, normal, large
  copies: 1,
  autoPrint: true, // Auto print after ticket creation
  cutPaper: true, // Auto cut paper if supported
  openDrawer: false, // Open cash drawer if supported
  printLogo: true,
  printQRCode: true,
  marginTop: 0,
  marginBottom: 10,
  darkMode: true // Darker print for thermal
};

// Storage keys
const STORAGE_KEYS = {
  SELECTED_PRINTER: 'lottolab_selected_printer',
  PRINTER_SETTINGS: 'lottolab_printer_settings',
  KNOWN_PRINTERS: 'lottolab_known_printers'
};

class PrinterService {
  constructor() {
    this.printers = [];
    this.selectedPrinter = null;
    this.settings = { ...DEFAULT_PRINTER_SETTINGS };
    this.isInitialized = false;
    this.bluetoothDevice = null;
    this.usbDevice = null;
    
    // Load saved settings
    this.loadSettings();
  }

  /**
   * Initialize printer service and detect available printers
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Load saved printers and settings
      this.loadSettings();
      
      // Auto-detect printers
      await this.detectPrinters();
      
      // Try to reconnect to last used printer
      await this.reconnectLastPrinter();
      
      this.isInitialized = true;
      console.log('[PrinterService] Initialized with', this.printers.length, 'printers');
      
    } catch (error) {
      console.error('[PrinterService] Init error:', error);
    }
  }

  /**
   * Load saved settings from localStorage
   */
  loadSettings() {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEYS.PRINTER_SETTINGS);
      if (savedSettings) {
        this.settings = { ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(savedSettings) };
      }
      
      const savedPrinters = localStorage.getItem(STORAGE_KEYS.KNOWN_PRINTERS);
      if (savedPrinters) {
        this.printers = JSON.parse(savedPrinters);
      }
      
      const selectedPrinterId = localStorage.getItem(STORAGE_KEYS.SELECTED_PRINTER);
      if (selectedPrinterId) {
        this.selectedPrinter = this.printers.find(p => p.id === selectedPrinterId) || null;
      }
    } catch (e) {
      console.warn('[PrinterService] Failed to load settings:', e);
    }
  }

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEYS.PRINTER_SETTINGS, JSON.stringify(this.settings));
      localStorage.setItem(STORAGE_KEYS.KNOWN_PRINTERS, JSON.stringify(this.printers));
      if (this.selectedPrinter) {
        localStorage.setItem(STORAGE_KEYS.SELECTED_PRINTER, this.selectedPrinter.id);
      }
    } catch (e) {
      console.warn('[PrinterService] Failed to save settings:', e);
    }
  }

  /**
   * Update printer settings
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    return this.settings;
  }

  /**
   * Get current settings
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Detect all available printers
   */
  async detectPrinters() {
    const detected = [];

    // Always add browser print option
    detected.push({
      id: 'browser_default',
      name: 'Imprimante Navigateur',
      type: PRINTER_TYPES.BROWSER,
      status: PRINTER_STATUS.CONNECTED,
      isDefault: true
    });

    // Check for Web Bluetooth API
    if ('bluetooth' in navigator) {
      try {
        // We can't auto-scan, but we can add a placeholder for manual pairing
        detected.push({
          id: 'bluetooth_search',
          name: 'Rechercher Bluetooth...',
          type: PRINTER_TYPES.BLUETOOTH,
          status: PRINTER_STATUS.DISCONNECTED,
          isSearchOption: true
        });
      } catch (e) {
        console.log('[PrinterService] Bluetooth not available');
      }
    }

    // Check for USB devices (WebUSB API)
    if ('usb' in navigator) {
      try {
        const devices = await navigator.usb.getDevices();
        devices.forEach((device, idx) => {
          if (device.productName?.toLowerCase().includes('printer') || 
              device.manufacturerName?.toLowerCase().includes('epson') ||
              device.manufacturerName?.toLowerCase().includes('star')) {
            detected.push({
              id: `usb_${device.serialNumber || idx}`,
              name: device.productName || `USB Printer ${idx + 1}`,
              type: PRINTER_TYPES.USB,
              status: PRINTER_STATUS.CONNECTED,
              device: device
            });
          }
        });
        
        // Add USB search option
        detected.push({
          id: 'usb_search',
          name: 'Connecter USB...',
          type: PRINTER_TYPES.USB,
          status: PRINTER_STATUS.DISCONNECTED,
          isSearchOption: true
        });
      } catch (e) {
        console.log('[PrinterService] USB not available');
      }
    }

    // Check for Android POS integrated printer
    if (this.isAndroidPOS()) {
      detected.push({
        id: 'android_integrated',
        name: 'Imprimante POS Intégrée',
        type: PRINTER_TYPES.INTEGRATED,
        status: PRINTER_STATUS.CONNECTED
      });
    }

    // Add previously known network printers
    const knownNetworkPrinters = this.printers.filter(p => p.type === PRINTER_TYPES.NETWORK);
    knownNetworkPrinters.forEach(printer => {
      if (!detected.find(d => d.id === printer.id)) {
        detected.push({
          ...printer,
          status: PRINTER_STATUS.UNKNOWN
        });
      }
    });

    // Add network printer option
    detected.push({
      id: 'network_add',
      name: 'Ajouter imprimante réseau...',
      type: PRINTER_TYPES.NETWORK,
      status: PRINTER_STATUS.DISCONNECTED,
      isSearchOption: true
    });

    this.printers = detected;
    this.saveSettings();
    
    return detected;
  }

  /**
   * Check if running on Android POS device
   */
  isAndroidPOS() {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('android') && (
      ua.includes('pos') || 
      ua.includes('terminal') ||
      ua.includes('sunmi') ||
      ua.includes('verifone') ||
      ua.includes('ingenico') ||
      window.AndroidPrinter !== undefined
    );
  }

  /**
   * Request Bluetooth printer pairing
   */
  async pairBluetoothPrinter() {
    if (!('bluetooth' in navigator)) {
      throw new Error('Bluetooth non supporté sur cet appareil');
    }

    try {
      // Request device with printer service
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', '00001101-0000-1000-8000-00805f9b34fb']
      });

      const printer = {
        id: `bt_${device.id}`,
        name: device.name || 'Imprimante Bluetooth',
        type: PRINTER_TYPES.BLUETOOTH,
        status: PRINTER_STATUS.CONNECTING,
        deviceId: device.id
      };

      // Try to connect
      const server = await device.gatt?.connect();
      if (server) {
        printer.status = PRINTER_STATUS.CONNECTED;
        this.bluetoothDevice = device;
      }

      // Add to printers list
      this.printers = this.printers.filter(p => p.id !== printer.id && !p.isSearchOption);
      this.printers.unshift(printer);
      this.saveSettings();

      return printer;

    } catch (error) {
      console.error('[PrinterService] Bluetooth pairing failed:', error);
      throw new Error('Échec du jumelage Bluetooth: ' + error.message);
    }
  }

  /**
   * Request USB printer connection
   */
  async connectUSBPrinter() {
    if (!('usb' in navigator)) {
      throw new Error('USB non supporté sur cet appareil');
    }

    try {
      const device = await navigator.usb.requestDevice({
        filters: [
          { vendorId: 0x04b8 }, // Epson
          { vendorId: 0x0519 }, // Star Micronics
          { vendorId: 0x0416 }, // Citizen
          { vendorId: 0x1504 }, // Generic POS
        ]
      });

      const printer = {
        id: `usb_${device.serialNumber || Date.now()}`,
        name: device.productName || 'Imprimante USB',
        type: PRINTER_TYPES.USB,
        status: PRINTER_STATUS.CONNECTED,
        device: device
      };

      await device.open();
      this.usbDevice = device;

      this.printers = this.printers.filter(p => p.id !== printer.id && !p.isSearchOption);
      this.printers.unshift(printer);
      this.saveSettings();

      return printer;

    } catch (error) {
      console.error('[PrinterService] USB connection failed:', error);
      throw new Error('Échec connexion USB: ' + error.message);
    }
  }

  /**
   * Add network printer by IP
   */
  async addNetworkPrinter(ip, port = 9100, name = '') {
    const printer = {
      id: `net_${ip}_${port}`,
      name: name || `Imprimante ${ip}`,
      type: PRINTER_TYPES.NETWORK,
      status: PRINTER_STATUS.UNKNOWN,
      ip: ip,
      port: port
    };

    // Note: Direct socket connection to printers is not possible from browser
    // This would require a backend proxy or native app
    // For now, we track the config and use browser print fallback

    this.printers = this.printers.filter(p => p.id !== printer.id && !p.isSearchOption);
    this.printers.unshift(printer);
    this.saveSettings();

    return printer;
  }

  /**
   * Select a printer as default
   */
  selectPrinter(printerId) {
    const printer = this.printers.find(p => p.id === printerId);
    if (printer) {
      this.selectedPrinter = printer;
      this.saveSettings();
      return printer;
    }
    return null;
  }

  /**
   * Get currently selected printer
   */
  getSelectedPrinter() {
    return this.selectedPrinter;
  }

  /**
   * Get all known printers
   */
  getPrinters() {
    return this.printers.filter(p => !p.isSearchOption);
  }

  /**
   * Attempt to reconnect to last used printer
   */
  async reconnectLastPrinter() {
    if (!this.selectedPrinter) return;

    if (this.selectedPrinter.type === PRINTER_TYPES.BLUETOOTH && this.selectedPrinter.deviceId) {
      try {
        // For Bluetooth, we need user gesture to reconnect
        console.log('[PrinterService] Bluetooth printer needs manual reconnection');
      } catch (e) {
        console.log('[PrinterService] Could not auto-reconnect Bluetooth');
      }
    }
  }

  /**
   * Test print - prints a test ticket
   */
  async testPrint() {
    const testContent = `
================================
       TEST D'IMPRESSION
================================

Imprimante: ${this.selectedPrinter?.name || 'Navigateur'}
Date: ${new Date().toLocaleString('fr-FR')}
Largeur: ${this.settings.paperWidth}

--------------------------------

Lorem ipsum dolor sit amet.
0123456789
ABCDEFGHIJKLMNOP

--------------------------------

   ██████████████████
   █  TEST QR CODE  █
   ██████████████████

================================
      LOTTOLAB.TECH
================================
    `;

    return this.print(testContent, { isTest: true });
  }

  /**
   * Print HTML content
   */
  async print(htmlContent, options = {}) {
    const printer = this.selectedPrinter || this.printers[0];
    
    if (!printer) {
      return this.browserPrint(htmlContent);
    }

    switch (printer.type) {
      case PRINTER_TYPES.INTEGRATED:
        return this.printAndroidPOS(htmlContent);
      case PRINTER_TYPES.BLUETOOTH:
        return this.printBluetooth(htmlContent);
      case PRINTER_TYPES.USB:
        return this.printUSB(htmlContent);
      case PRINTER_TYPES.NETWORK:
      case PRINTER_TYPES.BROWSER:
      default:
        return this.browserPrint(htmlContent);
    }
  }

  /**
   * Print using browser's print dialog
   */
  async browserPrint(htmlContent) {
    return new Promise((resolve, reject) => {
      try {
        // Create hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;';
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) {
          reject(new Error('Could not access print frame'));
          return;
        }

        // If htmlContent is a URL, fetch it
        if (htmlContent.startsWith('http') || htmlContent.startsWith('/')) {
          fetch(htmlContent)
            .then(res => res.text())
            .then(html => {
              doc.open();
              doc.write(html);
              doc.close();
              
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
              
              setTimeout(() => {
                document.body.removeChild(iframe);
                resolve({ success: true, method: 'browser' });
              }, 1000);
            })
            .catch(reject);
        } else {
          // Direct HTML content
          doc.open();
          doc.write(htmlContent);
          doc.close();

          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();

          setTimeout(() => {
            document.body.removeChild(iframe);
            resolve({ success: true, method: 'browser' });
          }, 1000);
        }

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Print using Android POS integrated printer
   */
  async printAndroidPOS(htmlContent) {
    if (typeof window.AndroidPrinter !== 'undefined') {
      try {
        // Many Android POS devices expose a JavaScript interface
        window.AndroidPrinter.printHtml(htmlContent);
        return { success: true, method: 'android_pos' };
      } catch (e) {
        console.error('[PrinterService] Android POS print failed:', e);
      }
    }

    // Fallback to browser print
    return this.browserPrint(htmlContent);
  }

  /**
   * Print using Bluetooth
   */
  async printBluetooth(htmlContent) {
    // For Bluetooth thermal printers, we would typically need to:
    // 1. Convert HTML to ESC/POS commands
    // 2. Send raw bytes via BLE
    // This requires a more complex implementation
    
    console.log('[PrinterService] Bluetooth direct print not fully implemented, using browser');
    return this.browserPrint(htmlContent);
  }

  /**
   * Print using USB
   */
  async printUSB(htmlContent) {
    // For USB thermal printers, we would need WebUSB
    // This requires converting HTML to ESC/POS commands
    
    console.log('[PrinterService] USB direct print not fully implemented, using browser');
    return this.browserPrint(htmlContent);
  }

  /**
   * Print a ticket by ID - fetches from API and prints
   */
  async printTicket(ticketId, token, apiUrl) {
    const printUrl = `${apiUrl}/api/ticket/print/${ticketId}?token=${token}&format=thermal&auto=${this.settings.autoPrint}`;
    
    if (this.settings.autoPrint && this.selectedPrinter?.type === PRINTER_TYPES.BROWSER) {
      // Open in new window for browser print
      const printWindow = window.open(printUrl, '_blank', 'width=400,height=600');
      if (printWindow) {
        return { success: true, method: 'browser_window' };
      }
    }
    
    return this.browserPrint(printUrl);
  }

  /**
   * Remove a printer from the list
   */
  removePrinter(printerId) {
    this.printers = this.printers.filter(p => p.id !== printerId);
    if (this.selectedPrinter?.id === printerId) {
      this.selectedPrinter = this.printers[0] || null;
    }
    this.saveSettings();
  }
}

// Singleton instance
const printerService = new PrinterService();
export default printerService;

// Named exports for convenience
export const initializePrinter = () => printerService.initialize();
export const getPrinters = () => printerService.getPrinters();
export const getSelectedPrinter = () => printerService.getSelectedPrinter();
export const selectPrinter = (id) => printerService.selectPrinter(id);
export const printTicket = (ticketId, token, apiUrl) => printerService.printTicket(ticketId, token, apiUrl);
export const testPrint = () => printerService.testPrint();
export const getPrinterSettings = () => printerService.getSettings();
export const updatePrinterSettings = (settings) => printerService.updateSettings(settings);
export const pairBluetoothPrinter = () => printerService.pairBluetoothPrinter();
export const connectUSBPrinter = () => printerService.connectUSBPrinter();
export const addNetworkPrinter = (ip, port, name) => printerService.addNetworkPrinter(ip, port, name);
export const detectPrinters = () => printerService.detectPrinters();
