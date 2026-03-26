import React, { useState, useEffect } from 'react';
import { 
  Printer, CheckCircle, X, RefreshCw, Eye, Download, Copy,
  Smartphone, AlertTriangle, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { API_URL } from '@/config/api';
import PrinterSelector from './PrinterSelector';
import printerService, { printTicket } from '@/services/PrinterService';

/**
 * TicketPrintModal - Modal displayed after successful ticket creation
 * Allows immediate printing, reprint, and ticket preview
 */
const TicketPrintModal = ({ 
  isOpen, 
  onClose, 
  ticket, 
  token,
  onNewSale 
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [showPrinterSelect, setShowPrinterSelect] = useState(false);
  const [printCount, setPrintCount] = useState(0);
  const [autoPrintDone, setAutoPrintDone] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Auto-print on mount if enabled
  useEffect(() => {
    if (isOpen && ticket && !autoPrintDone) {
      const settings = printerService.getSettings();
      if (settings.autoPrint) {
        handlePrint(true);
        setAutoPrintDone(true);
      }
      setSelectedPrinter(printerService.getSelectedPrinter());
    }
  }, [isOpen, ticket, autoPrintDone]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setAutoPrintDone(false);
      setPrintCount(0);
    }
  }, [isOpen]);

  const handlePrint = async (isAuto = false) => {
    if (!ticket?.ticket_id) {
      toast.error('Ticket non disponible');
      return;
    }

    setIsPrinting(true);
    try {
      await printTicket(ticket.ticket_id, token, API_URL);
      setPrintCount(prev => prev + 1);
      if (!isAuto) {
        toast.success('Impression lancée');
      }
    } catch (error) {
      console.error('Print error:', error);
      if (!isAuto) {
        toast.error('Erreur d\'impression');
      }
      // Fallback to new window
      window.open(
        `${API_URL}/api/ticket/print/${ticket.ticket_id}?token=${token}&format=thermal&auto=true`,
        '_blank',
        'width=400,height=700'
      );
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePreview = () => {
    setPreviewLoading(true);
    window.open(
      `${API_URL}/api/ticket/print/${ticket.ticket_id}?token=${token}&format=thermal`,
      '_blank',
      'width=400,height=700'
    );
    setTimeout(() => setPreviewLoading(false), 500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(ticket?.ticket_code || ticket?.verification_code);
    toast.success('Code copié!');
  };

  const handleDownloadPDF = () => {
    window.open(
      `${API_URL}/api/ticket/pdf/${ticket.ticket_id}?token=${token}`,
      '_blank'
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header - Success */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Ticket Créé!</h2>
          <p className="text-emerald-100 text-sm mt-1">Vente validée avec succès</p>
        </div>

        {/* Ticket Info */}
        <div className="p-4 space-y-4">
          {/* Ticket Code - Large */}
          <div className="bg-slate-800 rounded-xl p-4 text-center border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Numéro de ticket</p>
            <div className="flex items-center justify-center gap-2">
              <p className="text-2xl font-mono font-bold text-emerald-400 tracking-wider">
                {ticket?.ticket_code || ticket?.verification_code}
              </p>
              <button
                onClick={handleCopyCode}
                className="p-1 text-slate-400 hover:text-white transition-colors"
                title="Copier le code"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Ticket Details */}
          <div className="bg-slate-800/50 rounded-xl p-4 space-y-2 border border-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Loterie</span>
              <span className="text-white font-medium">{ticket?.lottery_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Tirage</span>
              <span className="text-white">{ticket?.draw_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Nombre de jeux</span>
              <span className="text-white">{ticket?.plays?.length || 0}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-700">
              <span className="text-slate-400">Total</span>
              <span className="text-xl font-bold text-white">{ticket?.total_amount?.toLocaleString()} HTG</span>
            </div>
          </div>

          {/* Printer Info */}
          {!showPrinterSelect ? (
            <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-white text-sm font-medium">
                      {selectedPrinter?.name || 'Imprimante Navigateur'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {printCount > 0 ? `${printCount} impression(s)` : 'Prêt à imprimer'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPrinterSelect(true)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Changer
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-white">Choisir imprimante</span>
                <button
                  onClick={() => setShowPrinterSelect(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <PrinterSelector 
                compact 
                onPrinterSelected={(p) => {
                  setSelectedPrinter(p);
                  setShowPrinterSelect(false);
                }}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => handlePrint(false)}
              disabled={isPrinting}
              className="bg-blue-600 hover:bg-blue-700 h-14 text-base"
              data-testid="print-ticket-btn"
            >
              {isPrinting ? (
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Printer className="w-5 h-5 mr-2" />
              )}
              Imprimer
            </Button>
            
            <Button
              onClick={handlePreview}
              variant="outline"
              className="border-slate-600 h-14 text-base"
              disabled={previewLoading}
            >
              {previewLoading ? (
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Eye className="w-5 h-5 mr-2" />
              )}
              Aperçu
            </Button>
          </div>

          {/* Secondary Actions */}
          <div className="flex gap-2">
            <Button
              onClick={() => handlePrint(false)}
              variant="outline"
              size="sm"
              className="flex-1 border-slate-700 text-slate-300"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Réimprimer
            </Button>
            <Button
              onClick={handleDownloadPDF}
              variant="outline"
              size="sm"
              className="flex-1 border-slate-700 text-slate-300"
            >
              <Download className="w-4 h-4 mr-1" />
              PDF
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-800/50 border-t border-slate-700">
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="border-slate-600"
            >
              Fermer
            </Button>
            <Button
              onClick={() => {
                onClose();
                if (onNewSale) onNewSale();
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="new-sale-after-print-btn"
            >
              <Zap className="w-4 h-4 mr-2" />
              Nouvelle Vente
            </Button>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default TicketPrintModal;
