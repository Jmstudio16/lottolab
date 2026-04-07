/**
 * ESC/POS Command Generator for Thermal Printers
 * Compatible with 58mm and 80mm printers
 */

// ESC/POS Commands
export const ESC = 0x1B;
export const GS = 0x1D;
export const LF = 0x0A;
export const CR = 0x0D;

export const COMMANDS = {
  // Initialize printer
  INIT: [ESC, 0x40],
  
  // Text formatting
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  
  // Text size
  TEXT_NORMAL: [ESC, 0x21, 0x00],
  TEXT_DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  TEXT_DOUBLE_WIDTH: [ESC, 0x21, 0x20],
  TEXT_DOUBLE: [ESC, 0x21, 0x30],
  TEXT_BOLD_ON: [ESC, 0x45, 0x01],
  TEXT_BOLD_OFF: [ESC, 0x45, 0x00],
  TEXT_UNDERLINE_ON: [ESC, 0x2D, 0x01],
  TEXT_UNDERLINE_OFF: [ESC, 0x2D, 0x00],
  
  // Paper
  CUT_PAPER: [GS, 0x56, 0x00],
  CUT_PAPER_PARTIAL: [GS, 0x56, 0x01],
  FEED_LINE: [LF],
  FEED_LINES: (n) => [ESC, 0x64, n],
  
  // Barcode
  BARCODE_HEIGHT: (h) => [GS, 0x68, h],
  BARCODE_WIDTH: (w) => [GS, 0x77, w],
  BARCODE_TEXT_BELOW: [GS, 0x48, 0x02],
  BARCODE_CODE128: (data) => [GS, 0x6B, 0x49, data.length, ...data.split('').map(c => c.charCodeAt(0))],
  
  // QR Code
  QR_MODEL: [GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00],
  QR_SIZE: (size) => [GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, size],
  QR_ERROR: [GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31],
  QR_STORE: (data) => {
    const len = data.length + 3;
    const pL = len % 256;
    const pH = Math.floor(len / 256);
    return [GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30, ...data.split('').map(c => c.charCodeAt(0))];
  },
  QR_PRINT: [GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]
};

/**
 * Convert string to bytes with proper encoding
 */
export const textToBytes = (text) => {
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(text));
};

/**
 * Build ESC/POS byte array for a complete ticket
 */
export const buildTicketBytes = (ticketData, options = {}) => {
  const {
    paperWidth = 80, // 58 or 80
    showQR = true,
    showLogo = false
  } = options;
  
  const bytes = [];
  const maxChars = paperWidth === 58 ? 32 : 48;
  
  // Initialize printer
  bytes.push(...COMMANDS.INIT);
  
  // Center align for header
  bytes.push(...COMMANDS.ALIGN_CENTER);
  
  // Company name (large)
  bytes.push(...COMMANDS.TEXT_DOUBLE);
  bytes.push(...COMMANDS.TEXT_BOLD_ON);
  bytes.push(...textToBytes(ticketData.companyName || 'LOTTOLAB'));
  bytes.push(...COMMANDS.FEED_LINE);
  bytes.push(...COMMANDS.TEXT_NORMAL);
  bytes.push(...COMMANDS.TEXT_BOLD_OFF);
  
  // Branch name
  if (ticketData.branchName) {
    bytes.push(...textToBytes(ticketData.branchName));
    bytes.push(...COMMANDS.FEED_LINE);
  }
  
  // Separator
  bytes.push(...textToBytes('='.repeat(maxChars)));
  bytes.push(...COMMANDS.FEED_LINE);
  
  // Ticket ID (bold)
  bytes.push(...COMMANDS.TEXT_BOLD_ON);
  bytes.push(...textToBytes(`TICKET: ${ticketData.ticketId}`));
  bytes.push(...COMMANDS.FEED_LINE);
  bytes.push(...COMMANDS.TEXT_BOLD_OFF);
  
  // Date and time
  bytes.push(...textToBytes(ticketData.dateTime || new Date().toLocaleString('fr-FR')));
  bytes.push(...COMMANDS.FEED_LINE);
  
  // Vendor
  if (ticketData.vendorName) {
    bytes.push(...textToBytes(`Agent: ${ticketData.vendorName}`));
    bytes.push(...COMMANDS.FEED_LINE);
  }
  
  // Lottery name
  bytes.push(...textToBytes(`Loterie: ${ticketData.lotteryName}`));
  bytes.push(...COMMANDS.FEED_LINE);
  
  // Separator
  bytes.push(...textToBytes('-'.repeat(maxChars)));
  bytes.push(...COMMANDS.FEED_LINE);
  
  // Left align for plays
  bytes.push(...COMMANDS.ALIGN_LEFT);
  
  // Plays header
  bytes.push(...COMMANDS.TEXT_BOLD_ON);
  bytes.push(...textToBytes(padRight('NUMERO', 12) + padRight('TYPE', 12) + padLeft('MISE', 10)));
  bytes.push(...COMMANDS.FEED_LINE);
  bytes.push(...COMMANDS.TEXT_BOLD_OFF);
  
  // Each play
  if (ticketData.plays && ticketData.plays.length > 0) {
    ticketData.plays.forEach(play => {
      const line = padRight(play.numbers || '', 12) + 
                   padRight(play.betType || '', 12) + 
                   padLeft(`${play.amount} HTG`, 10);
      bytes.push(...textToBytes(line));
      bytes.push(...COMMANDS.FEED_LINE);
    });
  }
  
  // Separator
  bytes.push(...textToBytes('-'.repeat(maxChars)));
  bytes.push(...COMMANDS.FEED_LINE);
  
  // Total (right align, bold)
  bytes.push(...COMMANDS.ALIGN_RIGHT);
  bytes.push(...COMMANDS.TEXT_BOLD_ON);
  bytes.push(...COMMANDS.TEXT_DOUBLE_HEIGHT);
  bytes.push(...textToBytes(`TOTAL: ${ticketData.totalAmount} HTG`));
  bytes.push(...COMMANDS.FEED_LINE);
  bytes.push(...COMMANDS.TEXT_NORMAL);
  bytes.push(...COMMANDS.TEXT_BOLD_OFF);
  
  // Center for footer
  bytes.push(...COMMANDS.ALIGN_CENTER);
  
  // Separator
  bytes.push(...textToBytes('='.repeat(maxChars)));
  bytes.push(...COMMANDS.FEED_LINE);
  
  // Status
  bytes.push(...COMMANDS.TEXT_BOLD_ON);
  bytes.push(...textToBytes(ticketData.status || 'VALIDE'));
  bytes.push(...COMMANDS.FEED_LINE);
  bytes.push(...COMMANDS.TEXT_BOLD_OFF);
  
  // QR Code (if enabled)
  if (showQR && ticketData.ticketId) {
    bytes.push(...COMMANDS.FEED_LINE);
    bytes.push(...COMMANDS.QR_MODEL);
    bytes.push(...COMMANDS.QR_SIZE(6));
    bytes.push(...COMMANDS.QR_ERROR);
    bytes.push(...COMMANDS.QR_STORE(ticketData.ticketId));
    bytes.push(...COMMANDS.QR_PRINT);
    bytes.push(...COMMANDS.FEED_LINE);
  }
  
  // Footer message
  if (ticketData.footerMessage) {
    bytes.push(...COMMANDS.FEED_LINE);
    bytes.push(...textToBytes(ticketData.footerMessage));
    bytes.push(...COMMANDS.FEED_LINE);
  }
  
  // Legal text
  bytes.push(...COMMANDS.FEED_LINE);
  bytes.push(...textToBytes('Ticket valide 90 jours'));
  bytes.push(...COMMANDS.FEED_LINE);
  bytes.push(...textToBytes('Conservez ce ticket'));
  bytes.push(...COMMANDS.FEED_LINE);
  
  // Powered by
  bytes.push(...COMMANDS.FEED_LINE);
  bytes.push(...textToBytes('LOTTOLAB.TECH'));
  bytes.push(...COMMANDS.FEED_LINE);
  
  // Feed and cut
  bytes.push(...COMMANDS.FEED_LINES(4));
  bytes.push(...COMMANDS.CUT_PAPER_PARTIAL);
  
  return new Uint8Array(bytes);
};

// Helper functions
function padRight(str, len) {
  str = String(str);
  return str.length >= len ? str.substring(0, len) : str + ' '.repeat(len - str.length);
}

function padLeft(str, len) {
  str = String(str);
  return str.length >= len ? str.substring(0, len) : ' '.repeat(len - str.length) + str;
}

export default {
  COMMANDS,
  textToBytes,
  buildTicketBytes
};
