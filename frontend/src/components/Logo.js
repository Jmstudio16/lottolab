import React from 'react';
import { useLogoContext } from '../contexts/LogoContext';

/**
 * Logo component that displays either company logo or system default
 * Automatically uses LogoContext to get the right logo
 */
const Logo = ({ 
  size = 'md', 
  className = '', 
  useSystemLogo = false,
  showFallback = true 
}) => {
  const { displayLogoUrl, systemLogoUrl, companyLogoUrl, companyName, isLoading } = useLogoContext();

  // Size mappings
  const sizeClasses = {
    xs: 'h-6 w-auto',
    sm: 'h-8 w-auto',
    md: 'h-10 w-auto',
    lg: 'h-12 w-auto',
    xl: 'h-16 w-auto',
    '2xl': 'h-20 w-auto'
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;

  // Determine which logo to show
  const logoUrl = useSystemLogo ? systemLogoUrl : (companyLogoUrl || displayLogoUrl);

  // Loading state
  if (isLoading) {
    return (
      <div className={`${sizeClass} bg-slate-700/50 animate-pulse rounded ${className}`} />
    );
  }

  // No logo available
  if (!logoUrl && showFallback) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
          <span className="text-slate-900 font-bold text-sm">L</span>
        </div>
        <span className="font-bold text-white">{companyName || 'LOTTOLAB'}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className}`}>
      <img
        src={logoUrl}
        alt={companyName || 'Logo'}
        className={`${sizeClass} object-contain`}
        onError={(e) => {
          // Fallback to system logo on error
          if (e.target.src !== systemLogoUrl) {
            e.target.src = systemLogoUrl;
          } else {
            // If even system logo fails, hide it
            e.target.style.display = 'none';
          }
        }}
      />
    </div>
  );
};

export default Logo;
