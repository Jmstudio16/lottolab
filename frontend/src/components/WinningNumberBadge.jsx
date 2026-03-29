/**
 * WinningNumberBadge - Composant pour afficher les numéros gagnants avec animation
 * 
 * Ce composant affiche un numéro gagnant avec:
 * - Animation pulse/glow pour le 1er lot
 * - Couleurs distinctes selon le lot (1er=or, 2e=argent, 3e=bronze)
 * - Badge "GAGNANT" optionnel
 * - Effets visuels sans casser le design existant
 */

import React from 'react';

// CSS keyframes pour les animations
const animationStyles = `
@keyframes winnerPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 20px 4px rgba(251, 191, 36, 0.4);
  }
}

@keyframes winnerGlow {
  0%, 100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.2);
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-3px);
  }
}

.winner-badge-1st {
  animation: winnerPulse 2s ease-in-out infinite, winnerGlow 1.5s ease-in-out infinite;
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #f59e0b 100%);
  background-size: 200% 200%;
}

.winner-badge-2nd {
  animation: float 3s ease-in-out infinite;
  background: linear-gradient(135deg, #94a3b8 0%, #cbd5e1 50%, #94a3b8 100%);
}

.winner-badge-3rd {
  animation: float 3s ease-in-out infinite 0.5s;
  background: linear-gradient(135deg, #b45309 0%, #d97706 50%, #b45309 100%);
}

.winner-shimmer {
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: shimmer 3s infinite;
}
`;

/**
 * Injecte les styles d'animation dans le document
 */
const injectStyles = () => {
  if (typeof document !== 'undefined') {
    const styleId = 'winner-badge-styles';
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = animationStyles;
      document.head.appendChild(styleElement);
    }
  }
};

/**
 * Props:
 * @param {string} number - Le numéro gagnant à afficher
 * @param {number} position - Position du lot (1, 2, ou 3)
 * @param {boolean} showLabel - Afficher le label du lot (ex: "1er")
 * @param {boolean} animated - Activer les animations (true par défaut)
 * @param {string} size - Taille: "sm", "md", "lg", "xl"
 * @param {boolean} showBadge - Afficher le badge "GAGNANT"
 */
export const WinningNumberBadge = ({
  number,
  position = 1,
  showLabel = false,
  animated = true,
  size = 'md',
  showBadge = false
}) => {
  // Injecter les styles CSS
  React.useEffect(() => {
    injectStyles();
  }, []);

  // Définir les tailles
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-lg',
    lg: 'w-14 h-14 text-xl',
    xl: 'w-20 h-20 text-3xl'
  };

  // Classes de base
  const baseClasses = `
    flex items-center justify-center rounded-full font-bold
    shadow-lg transition-all duration-300
    ${sizeClasses[size] || sizeClasses.md}
  `;

  // Classes selon la position
  let positionClasses = '';
  let textColor = 'text-black';
  let label = '';

  switch (position) {
    case 1:
      positionClasses = animated ? 'winner-badge-1st' : 'bg-amber-500';
      textColor = 'text-black';
      label = '1er';
      break;
    case 2:
      positionClasses = animated ? 'winner-badge-2nd' : 'bg-slate-400';
      textColor = 'text-black';
      label = '2e';
      break;
    case 3:
      positionClasses = animated ? 'winner-badge-3rd' : 'bg-amber-700';
      textColor = 'text-white';
      label = '3e';
      break;
    default:
      positionClasses = 'bg-slate-600';
      textColor = 'text-white';
      label = '';
  }

  return (
    <div className="relative inline-flex flex-col items-center">
      {/* Badge "GAGNANT" au-dessus */}
      {showBadge && position === 1 && (
        <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 
          px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full
          whitespace-nowrap shadow-lg animate-bounce">
          GAGNANT
        </span>
      )}

      {/* Le cercle avec le numéro */}
      <div className={`${baseClasses} ${positionClasses} ${textColor}`}>
        {number}
        {/* Effet shimmer sur le 1er lot */}
        {animated && position === 1 && (
          <div className="absolute inset-0 rounded-full winner-shimmer pointer-events-none" />
        )}
      </div>

      {/* Label du lot en dessous */}
      {showLabel && (
        <span className="mt-1 text-xs text-slate-400 font-medium">
          {label} lot
        </span>
      )}
    </div>
  );
};

/**
 * WinningNumbersRow - Affiche une ligne de numéros gagnants
 * 
 * @param {object} winningNumbers - {first: "42", second: "15", third: "88"}
 * @param {boolean} animated - Activer les animations
 * @param {string} size - Taille des badges
 * @param {boolean} showLabels - Afficher les labels
 */
export const WinningNumbersRow = ({
  winningNumbers,
  animated = true,
  size = 'md',
  showLabels = false,
  showBadge = false
}) => {
  if (!winningNumbers) return null;

  // Support pour les formats string et object
  let numbers = { first: null, second: null, third: null };

  if (typeof winningNumbers === 'string') {
    const parts = winningNumbers.split(/[-,\s]+/).filter(n => n.trim());
    numbers = {
      first: parts[0] || null,
      second: parts[1] || null,
      third: parts[2] || null
    };
  } else if (typeof winningNumbers === 'object') {
    numbers = {
      first: winningNumbers.first || null,
      second: winningNumbers.second || null,
      third: winningNumbers.third || null
    };
  }

  return (
    <div className="flex items-center gap-3">
      {numbers.first && (
        <WinningNumberBadge
          number={numbers.first}
          position={1}
          animated={animated}
          size={size}
          showLabel={showLabels}
          showBadge={showBadge}
        />
      )}
      {numbers.second && (
        <WinningNumberBadge
          number={numbers.second}
          position={2}
          animated={animated}
          size={size}
          showLabel={showLabels}
        />
      )}
      {numbers.third && (
        <WinningNumberBadge
          number={numbers.third}
          position={3}
          animated={animated}
          size={size}
          showLabel={showLabels}
        />
      )}
    </div>
  );
};

/**
 * WinningTicketHighlight - Encadre un ticket gagnant avec effet visuel
 * 
 * @param {boolean} isWinner - Si le ticket est gagnant
 * @param {number} totalGain - Montant total gagné
 * @param {React.ReactNode} children - Contenu du ticket
 */
export const WinningTicketHighlight = ({
  isWinner = false,
  totalGain = 0,
  children
}) => {
  // Injecter les styles CSS
  React.useEffect(() => {
    injectStyles();
  }, []);

  if (!isWinner) {
    return <div className="relative">{children}</div>;
  }

  return (
    <div className="relative">
      {/* Bordure animée pour ticket gagnant */}
      <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 
        rounded-xl opacity-75 blur-sm animate-pulse" />
      
      {/* Contenu */}
      <div className="relative bg-slate-900 rounded-xl border-2 border-amber-500/50">
        {children}
      </div>

      {/* Badge montant gagné */}
      {totalGain > 0 && (
        <div className="absolute -top-3 -right-3 px-3 py-1 bg-emerald-500 text-white 
          font-bold rounded-full shadow-lg text-sm animate-bounce">
          +{totalGain.toLocaleString()} G
        </div>
      )}
    </div>
  );
};

/**
 * LoserIndicator - Indicateur discret pour les tickets perdants
 */
export const LoserIndicator = () => (
  <span className="px-2 py-1 bg-slate-700/50 text-slate-500 text-xs rounded">
    Perdant
  </span>
);

/**
 * WinnerIndicator - Indicateur pour les tickets gagnants
 */
export const WinnerIndicator = ({ gain }) => (
  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded flex items-center gap-1">
    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
    GAGNANT {gain > 0 && `+${gain.toLocaleString()} G`}
  </span>
);

export default WinningNumberBadge;
