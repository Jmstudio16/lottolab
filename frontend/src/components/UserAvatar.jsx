import React from 'react';
import { User } from 'lucide-react';
import { API_URL } from '@/config/api';

/**
 * UserAvatar component - displays user profile photo or initials
 * @param {string} photoUrl - URL to the user's photo
 * @param {string} name - User's name (for initials fallback)
 * @param {string} size - Size: 'xs', 'sm', 'md', 'lg', 'xl'
 * @param {string} className - Additional CSS classes
 */
const UserAvatar = ({ 
  photoUrl, 
  name = '', 
  size = 'md', 
  className = '',
  showBorder = false
}) => {
  // Size mappings
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
    '2xl': 'w-20 h-20 text-2xl'
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
    '2xl': 'w-10 h-10'
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const iconSize = iconSizes[size] || iconSizes.md;

  // Build full URL for photo
  let fullPhotoUrl = null;
  if (photoUrl) {
    fullPhotoUrl = photoUrl.startsWith('http') ? photoUrl : `${API_URL}${photoUrl}`;
  }

  // Get initials from name
  const getInitials = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0][0]?.toUpperCase() || '';
  };

  const initials = getInitials(name);
  const borderClass = showBorder ? 'ring-2 ring-emerald-500/50' : '';

  // Has photo - show image
  if (fullPhotoUrl) {
    return (
      <div 
        className={`${sizeClass} rounded-full overflow-hidden bg-slate-700 flex-shrink-0 ${borderClass} ${className}`}
      >
        <img
          src={fullPhotoUrl}
          alt={name || 'Avatar'}
          className="w-full h-full object-cover"
          onError={(e) => {
            // On error, replace with initials
            e.target.onerror = null;
            e.target.style.display = 'none';
            e.target.parentElement.classList.add('show-fallback');
          }}
        />
        {/* Fallback shown via CSS when image fails */}
        <div className="fallback-content hidden w-full h-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold">
          {initials || <User className={iconSize} />}
        </div>
      </div>
    );
  }

  // No photo - show initials or icon
  return (
    <div 
      className={`${sizeClass} rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold flex-shrink-0 ${borderClass} ${className}`}
    >
      {initials || <User className={iconSize} />}
    </div>
  );
};

export default UserAvatar;
