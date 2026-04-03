import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import { API_URL } from '@/config/api';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Bell, Search, RefreshCw, Trash2, Check, CheckCircle, Clock, 
  Trophy, DollarSign, Ticket, Users, AlertCircle, Archive,
  ChevronLeft, ChevronRight, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import CompanyLayout from '@/components/CompanyLayout';

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
    case 'ALERT':
      return <AlertCircle className="w-5 h-5 text-red-400" />;
    default:
      return <Bell className="w-5 h-5 text-slate-400" />;
  }
};

const getNotificationBgColor = (type) => {
  switch (type) {
    case 'WINNER':
    case 'RESULT':
      return 'bg-amber-500/10 border-amber-500/30';
    case 'SALE':
    case 'TICKET':
      return 'bg-blue-500/10 border-blue-500/30';
    case 'PAYMENT':
      return 'bg-emerald-500/10 border-emerald-500/30';
    case 'USER':
      return 'bg-purple-500/10 border-purple-500/30';
    case 'ALERT':
      return 'bg-red-500/10 border-red-500/30';
    default:
      return 'bg-slate-700/30 border-slate-600/30';
  }
};

const CompanyNotificationsPage = () => {
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [archivedNotifications, setArchivedNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState({ total: 0, unread: 0, today: 0 });

  const headers = { Authorization: `Bearer ${token}` };
  const ITEMS_PER_PAGE = 20;

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      
      const res = await axios.get(`${API_URL}/api/company/notifications?limit=200`, { headers });
      const allNotifs = Array.isArray(res.data) ? res.data : (res.data.notifications || []);
      
      const now = new Date();
      const active = [];
      const archived = [];
      
      allNotifs.forEach(n => {
        const createdAt = new Date(n.created_at);
        const hoursSinceCreated = (now - createdAt) / (1000 * 60 * 60);
        
        if (n.read && hoursSinceCreated > 24) {
          archived.push(n);
        } else {
          active.push(n);
        }
      });
      
      setNotifications(active);
      setArchivedNotifications(archived);
      
      const unread = active.filter(n => !n.read).length;
      const todayNotifs = active.filter(n => {
        const d = new Date(n.created_at);
        return d.toDateString() === now.toDateString();
      }).length;
      
      setStats({
        total: allNotifs.length,
        unread: unread,
        today: todayNotifs
      });
      
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`${API_URL}/api/notifications/${notificationId}/read`, {}, { headers });
      setNotifications(prev => 
        prev.map(n => n.notification_id === notificationId ? { ...n, read: true } : n)
      );
      setStats(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(`${API_URL}/api/notifications/mark-all-read`, {}, { headers });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setStats(prev => ({ ...prev, unread: 0 }));
      toast.success('Toutes les notifications marquées comme lues');
    } catch (error) {
      toast.error('Erreur lors du marquage');
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await axios.delete(`${API_URL}/api/notifications/${notificationId}`, { headers });
      setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
      setArchivedNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
      toast.success('Notification supprimée');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const clearAllArchived = async () => {
    try {
      for (const notif of archivedNotifications) {
        await axios.delete(`${API_URL}/api/notifications/${notif.notification_id}`, { headers });
      }
      setArchivedNotifications([]);
      toast.success('Archives vidées');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    return date.toLocaleDateString('fr-FR');
  };

  const displayedNotifications = showArchived ? archivedNotifications : notifications;
  
  const filteredNotifications = displayedNotifications.filter(n => {
    const matchesSearch = !searchTerm || 
      n.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.message?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || n.type === filterType;
    return matchesSearch && matchesType;
  });

  const totalPages = Math.ceil(filteredNotifications.length / ITEMS_PER_PAGE);
  const paginatedNotifications = filteredNotifications.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const NOTIFICATION_TYPES = [
    { value: 'all', label: 'Tous' },
    { value: 'RESULT', label: 'Résultats' },
    { value: 'WINNER', label: 'Gagnants' },
    { value: 'PAYMENT', label: 'Paiements' },
    { value: 'SALE', label: 'Ventes' },
    { value: 'TICKET', label: 'Tickets' },
    { value: 'USER', label: 'Utilisateurs' },
    { value: 'ALERT', label: 'Alertes' }
  ];

  return (
    <CompanyLayout>
      <div className="p-4 sm:p-6 space-y-6" data-testid="company-notifications-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
              <Bell className="w-6 h-6 text-amber-400" />
              Notifications
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Centre de notifications de votre entreprise
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={fetchNotifications} variant="outline" className="border-slate-700" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            {stats.unread > 0 && (
              <Button onClick={markAllAsRead} className="bg-blue-600 hover:bg-blue-700">
                <CheckCircle className="w-4 h-4 mr-2" />
                Tout marquer lu
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-blue-500/10 border-blue-500/30">
            <CardContent className="p-4 flex items-center gap-3">
              <Bell className="w-6 h-6 text-blue-400" />
              <div>
                <p className="text-sm text-blue-300">Total</p>
                <p className="text-xl font-bold text-white">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardContent className="p-4 flex items-center gap-3">
              <Eye className="w-6 h-6 text-amber-400" />
              <div>
                <p className="text-sm text-amber-300">Non lues</p>
                <p className="text-xl font-bold text-white">{stats.unread}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-emerald-500/10 border-emerald-500/30">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="w-6 h-6 text-emerald-400" />
              <div>
                <p className="text-sm text-emerald-300">Aujourd'hui</p>
                <p className="text-xl font-bold text-white">{stats.today}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white"
            />
          </div>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
          >
            {NOTIFICATION_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <div className="flex gap-2">
            <Button
              onClick={() => { setShowArchived(false); setPage(1); }}
              variant={!showArchived ? "default" : "outline"}
              className={!showArchived ? "bg-blue-600" : "border-slate-700"}
            >
              Actives ({notifications.length})
            </Button>
            <Button
              onClick={() => { setShowArchived(true); setPage(1); }}
              variant={showArchived ? "default" : "outline"}
              className={showArchived ? "bg-slate-600" : "border-slate-700"}
            >
              <Archive className="w-4 h-4 mr-2" />
              Archives ({archivedNotifications.length})
            </Button>
          </div>
        </div>

        {showArchived && archivedNotifications.length > 0 && (
          <div className="flex justify-end">
            <Button onClick={clearAllArchived} variant="outline" className="border-red-500/50 text-red-400">
              <Trash2 className="w-4 h-4 mr-2" />
              Vider les archives
            </Button>
          </div>
        )}

        {/* Notifications List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        ) : paginatedNotifications.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
            <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Aucune notification</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedNotifications.map((notif) => (
              <div
                key={notif.notification_id || notif.id}
                className={`p-4 rounded-xl border transition-all ${
                  notif.read ? 'bg-slate-800/30 border-slate-700/50 opacity-70' : getNotificationBgColor(notif.type)
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${notif.read ? 'bg-slate-700' : 'bg-slate-800'}`}>
                    {getNotificationIcon(notif.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className={`font-semibold ${notif.read ? 'text-slate-400' : 'text-white'}`}>
                          {notif.title}
                        </h3>
                        <p className={`text-sm mt-1 ${notif.read ? 'text-slate-500' : 'text-slate-300'}`}>
                          {notif.message}
                        </p>
                      </div>
                      {!notif.read && <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
                      {notif.read && <Check className="w-4 h-4 text-emerald-500" />}
                    </div>
                    
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(notif.created_at)}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        {!notif.read && (
                          <Button size="sm" variant="ghost" onClick={() => markAsRead(notif.notification_id)}
                            className="text-blue-400 hover:text-blue-300">
                            <EyeOff className="w-4 h-4 mr-1" /> Lu
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => deleteNotification(notif.notification_id)}
                          className="text-red-400 hover:text-red-300">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-slate-400 text-sm px-4">Page {page} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </CompanyLayout>
  );
};

export default CompanyNotificationsPage;
