import React from 'react';
import { useLogoContext } from '../contexts/LogoContext';

const Logo = ({ 
  className = '', 
  size = 'md',
  showName = false,
  useSystemLogo = false,
  darkMode = false
}) => {
  const { displayLogoUrl, displayName, systemLogoUrl, systemName, loading } = useLogoContext();

  const logoUrl = useSystemLogo ? systemLogoUrl : displayLogoUrl;
  const name = useSystemLogo ? systemName : displayName;

  const sizeClasses = {
    xs: 'h-6 w-auto',
    sm: 'h-8 w-auto',
    md: 'h-10 w-auto',
    lg: 'h-14 w-auto',
    xl: 'h-20 w-auto',
    '2xl': 'h-28 w-auto',
    full: 'h-full w-auto max-h-16'
  };

  const textSizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    full: 'text-lg'
  };

  if (loading) {
    return (
      <div className={`animate-pulse bg-gray-700 rounded ${sizeClasses[size]} min-w-[80px]`}></div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={logoUrl}
        alt={name || 'Logo'}
        className={`${sizeClasses[size]} object-contain`}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = '/assets/logos/lottolab-logo.png';
        }}
      />
      {showName && (
        <span className={`font-bold ${textSizes[size]} ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {name}
        </span>
      )}
    </div>
  );
};

export default Logo;
