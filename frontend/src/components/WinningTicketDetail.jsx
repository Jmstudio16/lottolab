/**
 * WinningTicketDetail - Composant pour afficher le détail d'un ticket gagnant
 * 
 * Basé sur les images de référence du système PRO:
 * - En-tête avec logo, tirage, date
 * - Tableau détaillé des lignes (Jeux, Pari, Mise, Gain)
 * - Mise en évidence des lignes gagnantes
 * - Totaux en bas (Total Mise, Total Gain)
 * - Calcul détaillé (lot, multiplicateur, gain)
 */

import React from 'react';
import { 
  Trophy, Ticket, Printer, Download, X,
  CheckCircle, XCircle, Calculator, Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WinningNumbersRow } from '@/components/WinningNumberBadge';

// Styles CSS pour les animations
const winnerLineStyles = `
  @keyframes winnerHighlight {
    0%, 100% { background-color: rgba(34, 197, 94, 0.1); }
    50% { background-color: rgba(34, 197, 94, 0.2); }
  }
  
  .winning-line {
    animation: winnerHighlight 2s ease-in-out infinite;
    border-left: 3px solid #22c55e;
  }
  
  .winning-badge {
    animation: pulse 2s infinite;
  }
`;

// Injecter les styles
const injectStyles = () => {
  if (typeof document !== 'undefined') {
    const styleId = 'winning-ticket-detail-styles';
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = winnerLineStyles;
      document.head.appendChild(styleElement);
    }
  }
};

/**
 * Formater un montant en devise
 */
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-HT', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0) + ' HTG';
};

/**
 * Formater une date
 */
const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Obtenir le label du lot
 */
const getLotLabel = (lotNumber) => {
  switch (lotNumber) {
    case 1: return '1er Lot';
    case 2: return '2e Lot';
    case 3: return '3e Lot';
    default: return `Lot ${lotNumber}`;
  }
};

/**
 * Obtenir le multiplicateur par défaut selon le lot
 */
const getDefaultMultiplier = (lotNumber, betType) => {
  const betTypeUpper = (betType || '').toUpperCase();
  
  // Pour BORLETTE: 60/20/10
  if (betTypeUpper === 'BORLETTE' || betTypeUpper === '20') {
    switch (lotNumber) {
      case 1: return 60;
      case 2: return 20;
      case 3: return 10;
      default: return 0;
    }
  }
  
  // Pour LOTO3, MARIAGE, etc.: multiplicateur unique
  if (betTypeUpper.includes('LOTO3') || betTypeUpper === '30') return 500;
  if (betTypeUpper.includes('MARIAGE') || betTypeUpper === '40') return 750;
  if (betTypeUpper.includes('LOTO4') || betTypeUpper.includes('L4O')) return 750;
  if (betTypeUpper.includes('LOTO5') || betTypeUpper.includes('L5O')) return 750;
  
  return 60; // Default
};

/**
 * WinningTicketDetailModal - Modal complet pour afficher un ticket
 */
export const WinningTicketDetailModal = ({
  open,
  onClose,
  ticket,
  companyName = 'LOTO PAM CENTER',
  companyLogo = null,
  onPrint = null,
  onPay = null
}) => {
  React.useEffect(() => {
    injectStyles();
  }, []);

  if (!ticket) return null;

  // Extraire les données du ticket
  const plays = ticket.plays || ticket.numbers_played || [];
  const winningPlays = ticket.winning_plays || [];
  const allPlaysCalculated = ticket.all_plays_calculated || [];
  
  // Calculer les totaux
  const totalMise = plays.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const totalGain = allPlaysCalculated.reduce((sum, p) => sum + (parseFloat(p.gain) || 0), 0) 
    || (ticket.winnings || ticket.win_amount || 0);
  
  // Numéros gagnants
  const winningNumbers = ticket.winning_numbers_parsed || ticket.winning_numbers || {};

  // Créer une map des calculs pour chaque play
  const calculationsMap = {};
  allPlaysCalculated.forEach(calc => {
    const key = `${calc.played_number}-${calc.bet_type}`;
    calculationsMap[key] = calc;
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* En-tête du ticket */}
        <div className="text-center border-b border-slate-700 pb-4">
          {companyLogo ? (
            <img src={companyLogo} alt={companyName} className="h-12 mx-auto mb-2" />
          ) : (
            <div className="w-16 h-16 mx-auto mb-2 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center">
              <Trophy className="w-8 h-8 text-white" />
            </div>
          )}
          <h2 className="text-xl font-bold text-white">{companyName}</h2>
          <p className="text-slate-400">
            Tirage: <span className="text-white font-medium">{ticket.lottery_name} {ticket.draw_name}</span>
          </p>
          <p className="text-sm text-slate-500">{formatDateTime(ticket.created_at)}</p>
        </div>

        {/* Infos POS et Ticket */}
        <div className="flex justify-between items-center py-3 border-b border-slate-700/50">
          <div>
            <span className="text-xs text-slate-400">POS:</span>
            <span className="ml-2 font-mono text-slate-300">{ticket.device_id || ticket.pos_id || '-'}</span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400"># Ticket:</span>
            <span className="ml-2 font-mono font-bold text-yellow-400">{ticket.ticket_code || ticket.ticket_id}</span>
          </div>
        </div>

        {/* Numéros gagnants publiés */}
        {(winningNumbers.first || ticket.winning_numbers) && (
          <div className="py-3 bg-slate-900/50 rounded-lg px-4 my-2">
            <p className="text-xs text-slate-400 mb-2">Résultat du tirage:</p>
            <div className="flex justify-center">
              <WinningNumbersRow 
                winningNumbers={winningNumbers}
                animated={true}
                size="lg"
                showLabels={true}
              />
            </div>
          </div>
        )}

        {/* Tableau des jeux */}
        <div className="mt-4">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-400 uppercase border-b border-slate-700">
                <th className="text-left py-2 px-2">Jeux</th>
                <th className="text-left py-2 px-2">Pari</th>
                <th className="text-right py-2 px-2">Mise</th>
                <th className="text-left py-2 px-4">Gain</th>
              </tr>
            </thead>
            <tbody>
              {plays.map((play, idx) => {
                // Trouver le calcul correspondant
                const key = `${play.numbers || play.number}-${play.bet_type || play.type}`;
                const calc = calculationsMap[key] || {};
                const isWinner = calc.is_winner || false;
                const winningLot = calc.winning_lot;
                const multiplier = calc.multiplier || getDefaultMultiplier(winningLot, play.bet_type);
                const gain = calc.gain || 0;

                return (
                  <tr 
                    key={idx} 
                    className={`border-b border-slate-700/30 ${isWinner ? 'winning-line bg-green-500/10' : ''}`}
                    data-testid={`play-row-${idx}`}
                  >
                    <td className="py-3 px-2 text-slate-300">{play.bet_type || play.type || 'Borlette'}</td>
                    <td className="py-3 px-2">
                      <span className={`font-mono font-bold ${isWinner ? 'text-green-400' : 'text-white'}`}>
                        {play.numbers || play.number}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-slate-300">
                      {parseFloat(play.amount || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      {isWinner ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-bold rounded winning-badge">
                              GAGNANT
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            <span className="text-green-400 font-medium">{getLotLabel(winningLot)}</span>
                            <span className="mx-1">•</span>
                            <span>x{multiplier}</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <Calculator className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-400">{parseFloat(play.amount).toFixed(0)} × {multiplier} =</span>
                            <span className="text-green-400 font-bold">{gain.toFixed(2)}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totaux */}
        <div className="mt-4 bg-slate-900/70 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-400">Total Mise:</span>
            <span className="font-mono font-bold text-white">{formatCurrency(totalMise)}</span>
          </div>
          <div className="flex justify-between items-center border-t border-slate-700 pt-2">
            <span className="text-slate-400">Total Gain:</span>
            <span className={`font-mono font-bold text-xl ${totalGain > 0 ? 'text-green-400' : 'text-slate-400'}`}>
              {formatCurrency(totalGain)}
            </span>
          </div>
          
          {/* Statut du ticket */}
          <div className="mt-4 text-center">
            {totalGain > 0 ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-full">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-bold">TICKET GAGNANT</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700/50 rounded-full">
                <XCircle className="w-5 h-5 text-slate-500" />
                <span className="text-slate-500 font-medium">TICKET PERDANT</span>
              </div>
            )}
            
            {totalGain > totalMise && (
              <p className="mt-2 text-sm text-green-400">
                Bénéfice: <span className="font-bold">{formatCurrency(totalGain - totalMise)}</span>
              </p>
            )}
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="mt-4 flex gap-3">
          {onPrint && (
            <Button onClick={onPrint} variant="outline" className="flex-1 border-slate-600">
              <Printer className="w-4 h-4 mr-2" />
              Imprimer
            </Button>
          )}
          {onPay && totalGain > 0 && ticket.payment_status !== 'PAID' && (
            <Button onClick={onPay} className="flex-1 bg-green-600 hover:bg-green-700">
              <Award className="w-4 h-4 mr-2" />
              Payer {formatCurrency(totalGain)}
            </Button>
          )}
          <Button onClick={onClose} variant="outline" className="border-slate-600">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * WinningTicketCard - Carte résumé d'un ticket gagnant pour la liste
 */
export const WinningTicketCard = ({
  ticket,
  onClick,
  onPay
}) => {
  const totalGain = ticket.winnings || ticket.win_amount || 0;
  const totalMise = ticket.total_amount || 0;
  const isPaid = ticket.payment_status === 'PAID';

  return (
    <div 
      className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:bg-slate-800 transition-colors cursor-pointer"
      onClick={onClick}
      data-testid={`winning-ticket-card-${ticket.ticket_id}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="font-mono font-bold text-yellow-400">{ticket.ticket_code}</p>
          <p className="text-sm text-slate-400">{ticket.agent_name || ticket.created_by_name}</p>
          <p className="text-xs text-slate-500">{formatDateTime(ticket.created_at)}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 justify-end">
            <span className="text-sm text-slate-400">Mise:</span>
            <span className="font-mono text-white">{formatCurrency(totalMise)}</span>
          </div>
          <div className="flex items-center gap-1 justify-end mt-1">
            <Trophy className="w-4 h-4 text-green-400" />
            <span className="font-mono font-bold text-green-400">{formatCurrency(totalGain)}</span>
          </div>
          <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${
            isPaid 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-amber-500/20 text-amber-400'
          }`}>
            {isPaid ? 'PAYÉ' : 'NON PAYÉ'}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * WinningTicketsTable - Tableau des tickets gagnants (vue liste)
 */
export const WinningTicketsTable = ({
  tickets,
  onViewTicket,
  onPayTicket,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-400 mt-2">Chargement...</p>
      </div>
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <div className="text-center py-8">
        <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">Aucun ticket gagnant trouvé</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-700">
            <th className="py-3 px-4"># Ticket</th>
            <th className="py-3 px-4">Agent</th>
            <th className="py-3 px-4">Date</th>
            <th className="py-3 px-4 text-right">Mise</th>
            <th className="py-3 px-4 text-right">Gain</th>
            <th className="py-3 px-4 text-center">Statut</th>
            <th className="py-3 px-4 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => {
            const totalGain = ticket.winnings || ticket.win_amount || 0;
            const totalMise = ticket.total_amount || 0;
            const isPaid = ticket.payment_status === 'PAID';

            return (
              <tr 
                key={ticket.ticket_id} 
                className="border-b border-slate-700/50 hover:bg-slate-800/50"
                data-testid={`winning-ticket-row-${ticket.ticket_id}`}
              >
                <td className="py-3 px-4">
                  <span className="font-mono font-bold text-yellow-400">{ticket.ticket_code}</span>
                </td>
                <td className="py-3 px-4 text-slate-300">{ticket.agent_name || ticket.created_by_name || '-'}</td>
                <td className="py-3 px-4 text-sm text-slate-400">{formatDateTime(ticket.created_at)}</td>
                <td className="py-3 px-4 text-right font-mono text-slate-300">{formatCurrency(totalMise)}</td>
                <td className="py-3 px-4 text-right font-mono font-bold text-green-400">{formatCurrency(totalGain)}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    isPaid 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {isPaid ? 'PAYÉ' : 'NON PAYÉ'}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onViewTicket(ticket)}
                      className="border-slate-600"
                    >
                      Voir
                    </Button>
                    {!isPaid && onPayTicket && (
                      <Button
                        size="sm"
                        onClick={() => onPayTicket(ticket)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Payer
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default WinningTicketDetailModal;
