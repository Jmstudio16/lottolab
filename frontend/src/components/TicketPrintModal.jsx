import React, { useState, useEffect } from 'react';
import { 
  Printer, CheckCircle, X, RefreshCw, Eye, Download, Copy,
  Share2, FileText, Smartphone, AlertTriangle, Zap, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { API_URL } from '@/config/api';
import PrinterSelector from './PrinterSelector';
import printerService, { printTicket } from '@/services/PrinterService';

/**
 * TicketPrintModal - ULTRA PRO Modal displayed after successful ticket creation
 * Features: Print, Reprint, PDF Download, PDF Share (WhatsApp/Email), Preview
 */
const TicketPrintModal = ({ 
  isOpen, 
  onClose, 
  ticket, 
  token,
  onNewSale 
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showPrinterSelect, setShowPrinterSelect] = useState(false);
  const [printCount, setPrintCount] = useState(0);
  const [autoPrintDone, setAutoPrintDone] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [canShare, setCanShare] = useState(false);

  // Check if Web Share API is available
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

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

  // Download PDF
  const handleDownloadPDF = async () => {
    if (!ticket?.ticket_id) {
      toast.error('Ticket non disponible');
      return;
    }

    setIsDownloading(true);
    try {
      const pdfUrl = `${API_URL}/api/export/ticket/pdf/${ticket.ticket_id}?token=${token}`;
      
      // Fetch the PDF
      const response = await fetch(pdfUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Erreur téléchargement');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ticket_${ticket.ticket_code || ticket.ticket_id.slice(-8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF téléchargé');
    } catch (error) {
      console.error('PDF download error:', error);
      // Fallback: open in new tab
      window.open(
        `${API_URL}/api/export/ticket/pdf/${ticket.ticket_id}?token=${token}`,
        '_blank'
      );
      toast.info('PDF ouvert dans un nouvel onglet');
    } finally {
      setIsDownloading(false);
    }
  };

  // Share PDF via Web Share API
  const handleSharePDF = async () => {
    if (!ticket?.ticket_id) {
      toast.error('Ticket non disponible');
      return;
    }

    setIsSharing(true);
    try {
      const pdfUrl = `${API_URL}/api/export/ticket/pdf/${ticket.ticket_id}?token=${token}`;
      
      // Check if we can share files directly
      if (navigator.canShare && navigator.canShare({ files: [] })) {
        // Fetch PDF and share as file
        const response = await fetch(pdfUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const file = new File([blob], `ticket_${ticket.ticket_code}.pdf`, { type: 'application/pdf' });
          
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `Ticket ${ticket.ticket_code}`,
              text: `Ticket de loterie - ${ticket.lottery_name || 'Loterie'}\nCode: ${ticket.ticket_code}\nTotal: ${ticket.total_amount} HTG`
            });
            toast.success('Ticket partagé');
            setIsSharing(false);
            return;
          }
        }
      }
      
      // Fallback: Share URL/text only
      if (navigator.share) {
        await navigator.share({
          title: `Ticket ${ticket.ticket_code}`,
          text: `Ticket de loterie - ${ticket.lottery_name || 'Loterie'}\nCode: ${ticket.ticket_code}\nTotal: ${ticket.total_amount} HTG\nVérifier: ${window.location.origin}/verify/${ticket.verification_code || ticket.ticket_code}`,
          url: `${window.location.origin}/verify/${ticket.verification_code || ticket.ticket_code}`
        });
        toast.success('Ticket partagé');
      } else {
        throw new Error('Partage non supporté');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        // User cancelled
        console.log('Share cancelled');
      } else {
        console.error('Share error:', error);
        // Fallback: Copy link
        const verifyUrl = `${window.location.origin}/verify/${ticket.verification_code || ticket.ticket_code}`;
        try {
          await navigator.clipboard.writeText(
            `Ticket: ${ticket.ticket_code}\nLoterie: ${ticket.lottery_name}\nTotal: ${ticket.total_amount} HTG\nVérifier: ${verifyUrl}`
          );
          toast.success('Lien copié dans le presse-papiers');
        } catch (e) {
          toast.error('Partage non supporté sur cet appareil');
        }
      }
    } finally {
      setIsSharing(false);
    }
  };

  // Share via WhatsApp directly
  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `*Ticket Loterie*\n` +
      `Code: ${ticket.ticket_code}\n` +
      `Loterie: ${ticket.lottery_name || 'N/A'}\n` +
      `Tirage: ${ticket.draw_name || 'Standard'}\n` +
      `Total: ${ticket.total_amount} HTG\n` +
      `\nVérifier: ${window.location.origin}/verify/${ticket.verification_code || ticket.ticket_code}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header - Success */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-center relative">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Ticket Créé!</h2>
          <p className="text-emerald-100 text-sm mt-1">Vente validée avec succès</p>
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white p-1 transition-colors"
            data-testid="close-print-modal"
          >
            <X className="w-5 h-5" />
          </button>
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
                data-testid="copy-ticket-code"
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

          {/* Main Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {/* Print Button */}
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
            
            {/* Preview Button */}
            <Button
              onClick={handlePreview}
              variant="outline"
              className="border-slate-600 h-14 text-base"
              disabled={previewLoading}
              data-testid="preview-ticket-btn"
            >
              {previewLoading ? (
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Eye className="w-5 h-5 mr-2" />
              )}
              Aperçu
            </Button>
          </div>

          {/* Secondary Actions - PDF & Share */}
          <div className="grid grid-cols-4 gap-2">
            {/* Reprint */}
            <Button
              onClick={() => handlePrint(false)}
              variant="outline"
              size="sm"
              className="border-slate-700 text-slate-300 flex-col h-16 gap-1"
              data-testid="reprint-ticket-btn"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="text-[10px]">Réimprimer</span>
            </Button>
            
            {/* Download PDF */}
            <Button
              onClick={handleDownloadPDF}
              variant="outline"
              size="sm"
              disabled={isDownloading}
              className="border-slate-700 text-slate-300 flex-col h-16 gap-1"
              data-testid="download-pdf-btn"
            >
              {isDownloading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span className="text-[10px]">PDF</span>
            </Button>
            
            {/* Share PDF */}
            <Button
              onClick={handleSharePDF}
              variant="outline"
              size="sm"
              disabled={isSharing}
              className="border-slate-700 text-slate-300 flex-col h-16 gap-1"
              data-testid="share-pdf-btn"
            >
              {isSharing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
              <span className="text-[10px]">Partager</span>
            </Button>
            
            {/* WhatsApp */}
            <Button
              onClick={handleShareWhatsApp}
              variant="outline"
              size="sm"
              className="border-green-800 text-green-400 hover:bg-green-900/30 flex-col h-16 gap-1"
              data-testid="share-whatsapp-btn"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span className="text-[10px]">WhatsApp</span>
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
              data-testid="close-modal-btn"
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
      </div>
    </div>
  );
};

export default TicketPrintModal;
