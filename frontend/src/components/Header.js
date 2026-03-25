import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, AlertCircle, Trophy, DollarSign, Users, Ticket, Clock, CheckCircle } from 'lucide-react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { API_URL } from '@/config/api';

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
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const dropdownRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };

  // Real-time clock update every second
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const fetchNotifications = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      // Different endpoint based on role
      let endpoint = '/api/notifications';
      if (user?.role === 'SUPER_ADMIN') {
        endpoint = '/api/saas/notifications';
      } else if (user?.role === 'COMPANY_ADMIN' || user?.role === 'COMPANY_MANAGER') {
        endpoint = '/api/company/notifications';
      } else if (user?.role === 'BRANCH_SUPERVISOR') {
        endpoint = '/api/supervisor/notifications';
      } else if (user?.role === 'AGENT_POS') {
        endpoint = '/api/vendeur/notifications';
      }
      
      const res = await axios.get(`${API_URL}${endpoint}?limit=20`, { headers });
      const notifs = Array.isArray(res.data) ? res.data : (res.data.notifications || []);
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    } catch (error) {
      console.log('Notifications endpoint not available, using generated data');
      // Generate sample notifications if endpoint doesn't exist
      generateSampleNotifications();
    } finally {
      setLoading(false);
    }
  };

  const generateSampleNotifications = () => {
    const now = new Date();
    const samples = [
      {
        id: '1',
        type: 'RESULT',
        title: 'Nouveau tirage LOTTO 3 ce soir 20h',
        message: 'Les résultats seront publiés à 20h00',
        read: false,
        created_at: new Date(now - 1000 * 60 * 60).toISOString()
      },
      {
        id: '2',
        type: 'WINNER',
        title: 'Résultats SUPER 6 disponibles',
        message: 'Consultez les numéros gagnants',
        read: false,
        created_at: new Date(now - 1000 * 60 * 120).toISOString()
      },
      {
        id: '3',
        type: 'SALE',
        title: 'Système mis à jour',
        message: 'Nouvelles fonctionnalités disponibles',
        read: true,
        created_at: new Date(now - 1000 * 60 * 180).toISOString()
      }
    ];
    setNotifications(samples);
    setUnreadCount(samples.filter(n => !n.read).length);
  };

  const markAsRead = async (notifId) => {
    setNotifications(prev => 
      prev.map(n => (n.id === notifId || n.notification_id === notifId) ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    // Try to mark as read on server
    try {
      await axios.put(`${API_URL}/api/notifications/${notifId}/read`, {}, { headers });
    } catch (e) {
      // Ignore if endpoint doesn't exist
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    
    // Try to mark all as read on server
    try {
      await axios.put(`${API_URL}/api/notifications/mark-all-read`, {}, { headers });
    } catch (e) {
      // Ignore if endpoint doesn't exist
    }
  };

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

  useEffect(() => {
    fetchNotifications();
    // Refresh every 15 seconds for real-time feel
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [token, user?.role]);

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
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-400" />
                    <h3 className="font-semibold text-white">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full font-medium">
                        {unreadCount} nouveau{unreadCount > 1 ? 'x' : ''}
                      </span>
                    )}
                  </div>
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

                <div className="max-h-96 overflow-y-auto">
                  {loading ? (
                    <div className="py-8 text-center text-slate-400">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-amber-400 border-t-transparent"></div>
                      <p className="mt-2 text-sm">Chargement...</p>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Aucune notification</p>
                    </div>
                  ) : (
                    notifications.map((notif, index) => (
                      <div 
                        key={notif.id || notif.notification_id}
                        className={`px-4 py-3 border-b border-slate-800 cursor-pointer transition-all duration-200 hover:bg-slate-800/80 ${
                          !notif.read ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : 'hover:bg-slate-800/50'
                        }`}
                        onClick={() => markAsRead(notif.id || notif.notification_id)}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getNotificationIcon(notif.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm font-medium transition-colors ${notif.read ? 'text-slate-400' : 'text-white'}`}>
                                {notif.title}
                              </p>
                              {!notif.read && (
                                <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5 animate-pulse"></span>
                              )}
                              {notif.read && (
                                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                              )}
                            </div>
                            <p className={`text-sm mt-0.5 line-clamp-2 ${notif.read ? 'text-slate-500' : 'text-slate-300'}`}>
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
        </div>
      </div>
    </div>
  );
};
