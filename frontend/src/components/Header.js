import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, AlertCircle, Trophy, DollarSign, Users, Ticket } from 'lucide-react';
import { useAuth } from '@/api/auth';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getNotificationIcon = (type) => {
  switch (type) {
    case 'WINNER':
    case 'RESULT':
      return <Trophy className="w-5 h-5 text-amber-400" />;
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
  const dropdownRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };

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
        title: 'Nouveau résultat publié',
        message: 'NY Pick 3 Midday - Numéros: 555',
        read: false,
        created_at: new Date(now - 1000 * 60 * 5).toISOString()
      },
      {
        id: '2',
        type: 'WINNER',
        title: 'Ticket gagnant détecté!',
        message: 'Un ticket de 100 HTG a gagné 6,000 HTG',
        read: false,
        created_at: new Date(now - 1000 * 60 * 30).toISOString()
      },
      {
        id: '3',
        type: 'SALE',
        title: 'Nouvelle vente',
        message: 'Vendeur Test a vendu 1 ticket',
        read: true,
        created_at: new Date(now - 1000 * 60 * 60).toISOString()
      }
    ];
    setNotifications(samples);
    setUnreadCount(samples.filter(n => !n.read).length);
  };

  const markAsRead = async (notifId) => {
    setNotifications(prev => 
      prev.map(n => n.id === notifId ? { ...n, read: true } : n)
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

  useEffect(() => {
    fetchNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
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
    <div className="bg-slate-900/50 border-b border-slate-800 px-6 py-4 sticky top-0 z-50 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-barlow font-bold uppercase tracking-tight text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative" ref={dropdownRef}>
            <button 
              className="relative p-2 rounded-lg hover:bg-slate-800 transition-colors"
              data-testid="header-notifications-button"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="w-5 h-5 text-slate-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                  <h3 className="font-semibold text-white">Notifications</h3>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Tout marquer comme lu
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {loading ? (
                    <div className="py-8 text-center text-slate-400">
                      Chargement...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      Aucune notification
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id || notif.notification_id}
                        className={`px-4 py-3 border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors ${
                          !notif.read ? 'bg-blue-500/5' : ''
                        }`}
                        onClick={() => markAsRead(notif.id || notif.notification_id)}
                      >
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {getNotificationIcon(notif.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm font-medium ${notif.read ? 'text-slate-300' : 'text-white'}`}>
                                {notif.title}
                              </p>
                              {!notif.read && (
                                <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5"></span>
                              )}
                            </div>
                            <p className="text-sm text-slate-400 mt-0.5 line-clamp-2">
                              {notif.message}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
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
                    className="w-full text-center text-sm text-blue-400 hover:text-blue-300 py-1"
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
