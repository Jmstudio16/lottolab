import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, AlertCircle, Trophy, DollarSign, Users, Ticket, Clock, CheckCircle, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/api/auth';
import { useNotifications } from '@/hooks/useNotifications';
import { LanguageSwitcher } from './LanguageSwitcher';
import UserAvatar from './UserAvatar';

const getNotificationIcon = (type) => {
  switch (type) {
    case 'WINNER':
    case 'RESULT':
      return <Trophy className="w-5 h-5 text-amber-400 animate-pulse" />;
    case 'SALE':
    case 'TICKET':
      return <Ticket className="w-5 h-5 text-blue-400" />;
    case 'PAYMENT':
      return <DollarSign className="w-5 h-5 text-emerald-400" />;
    case 'USER':
      return <Users className="w-5 h-5 text-purple-400" />;
    default:
      return <AlertCircle className="w-5 h-5 text-slate-400" />;
  }
};

export const Header = ({ title, subtitle }) => {
  const { user, token } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const dropdownRef = useRef(null);

  // Use the real-time notifications hook
  const {
    notifications,
    unreadCount,
    isConnected,
    connectionMethod,
    soundEnabled,
    toggleSound,
    markAsRead,
    markAllAsRead,
  } = useNotifications(token, user);

  // Real-time clock update every second
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins}min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    return date.toLocaleDateString('fr-FR');
  };

  // Format Haiti time
  const formatHaitiTime = () => {
    return currentTime.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'America/Port-au-Prince'
    });
  };

  const formatHaitiDate = () => {
    return currentTime.toLocaleDateString('fr-FR', { 
      weekday: 'short',
      day: 'numeric', 
      month: 'short',
      timeZone: 'America/Port-au-Prince'
    });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="bg-slate-900/50 border-b border-slate-800 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-50 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-2xl font-barlow font-bold uppercase tracking-tight text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5 sm:mt-1">{subtitle}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Language Switcher */}
          <LanguageSwitcher />
          
          {/* Real-time Clock */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700">
            <Clock className="w-4 h-4 text-emerald-400" />
            <div className="text-right">
              <p className="text-white font-mono text-sm font-bold">{formatHaitiTime()}</p>
              <p className="text-slate-400 text-xs">{formatHaitiDate()}</p>
            </div>
          </div>
          
          {/* Notifications */}
          <div className="relative" ref={dropdownRef}>
            <button 
              className="relative p-2 rounded-lg hover:bg-slate-800 transition-all duration-200 group"
              data-testid="header-notifications-button"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className={`w-5 h-5 transition-colors ${unreadCount > 0 ? 'text-amber-400' : 'text-slate-400 group-hover:text-white'}`} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold animate-pulse shadow-lg shadow-red-500/50">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              {/* Connection indicator */}
              <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${
                connectionMethod === 'websocket' ? 'bg-emerald-500' :
                connectionMethod === 'polling' ? 'bg-amber-500' : 'bg-red-500'
              }`} title={connectionMethod === 'websocket' ? 'Temps réel' : connectionMethod === 'polling' ? 'Polling' : 'Déconnecté'} />
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-400" />
                    <h3 className="font-semibold text-white">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full font-medium animate-pulse">
                        {unreadCount} nouveau{unreadCount > 1 ? 'x' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Sound toggle */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSound(); }}
                      className={`p-1.5 rounded-lg transition-colors ${soundEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}
                      title={soundEnabled ? 'Son activé' : 'Son désactivé'}
                    >
                      {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>
                    {/* Mark all read */}
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllAsRead}
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Tout lu
                      </button>
                    )}
                  </div>
                </div>

                {/* Connection status bar */}
                <div className={`px-4 py-1.5 text-xs flex items-center gap-2 ${
                  connectionMethod === 'websocket' ? 'bg-emerald-500/10 text-emerald-400' :
                  connectionMethod === 'polling' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {connectionMethod === 'websocket' ? (
                    <><Wifi className="w-3 h-3" /> Temps réel activé</>
                  ) : connectionMethod === 'polling' ? (
                    <><Wifi className="w-3 h-3" /> Mode polling (10s)</>
                  ) : (
                    <><WifiOff className="w-3 h-3" /> Déconnecté</>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {notifications.filter(n => !n.read).length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Aucune nouvelle notification</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Les notifications lues sont archivées
                      </p>
                    </div>
                  ) : (
                    notifications.filter(n => !n.read).map((notif, index) => (
                      <div 
                        key={notif.id || notif.notification_id || index}
                        className={`px-4 py-3 border-b border-slate-800 cursor-pointer transition-all duration-200 hover:bg-slate-800/80 bg-blue-500/10 border-l-2 border-l-blue-500`}
                        onClick={() => markAsRead(notif.id || notif.notification_id)}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getNotificationIcon(notif.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-white">
                                {notif.title}
                              </p>
                              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5 animate-pulse"></span>
                            </div>
                            <p className="text-sm mt-0.5 line-clamp-2 text-slate-300">
                              {notif.message}
                            </p>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(notif.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="px-4 py-2 border-t border-slate-700 bg-slate-800/50">
                  <button 
                    className="w-full text-center text-sm text-slate-400 hover:text-white py-1 transition-colors"
                    onClick={() => setShowNotifications(false)}
                  >
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* User Avatar */}
          <UserAvatar 
            photoUrl={user?.photo_url || user?.profile_image_url}
            name={user?.name || user?.full_name}
            size="sm"
            className="hidden sm:flex"
          />
        </div>
      </div>
    </div>
  );
};
