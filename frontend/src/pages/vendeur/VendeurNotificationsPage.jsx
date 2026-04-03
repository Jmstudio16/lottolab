import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import { API_URL } from '@/config/api';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Bell, Search, RefreshCw, Trash2, Check, CheckCircle, Clock, 
  Trophy, DollarSign, Ticket, AlertCircle, Archive, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

const getNotificationIcon = (type) => {
  switch (type) {
    case 'WINNER': case 'RESULT': return <Trophy className="w-5 h-5 text-amber-400" />;
    case 'SALE': case 'TICKET': return <Ticket className="w-5 h-5 text-blue-400" />;
    case 'PAYMENT': return <DollarSign className="w-5 h-5 text-emerald-400" />;
    case 'ALERT': return <AlertCircle className="w-5 h-5 text-red-400" />;
    default: return <Bell className="w-5 h-5 text-slate-400" />;
  }
};

const VendeurNotificationsPage = () => {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [archivedNotifications, setArchivedNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [stats, setStats] = useState({ total: 0, unread: 0 });

  const headers = { Authorization: `Bearer ${token}` };

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/vendeur/notifications?limit=100`, { headers });
      const allNotifs = Array.isArray(res.data) ? res.data : (res.data.notifications || []);
      
      const now = new Date();
      const active = [];
      const archived = [];
      
      allNotifs.forEach(n => {
        const hoursSince = (now - new Date(n.created_at)) / 3600000;
        if (n.read && hoursSince > 24) archived.push(n);
        else active.push(n);
      });
      
      setNotifications(active);
      setArchivedNotifications(archived);
      setStats({ total: allNotifs.length, unread: active.filter(n => !n.read).length });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await axios.put(`${API_URL}/api/notifications/${id}/read`, {}, { headers });
      setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, read: true } : n));
      setStats(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
    } catch (e) {}
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(`${API_URL}/api/notifications/mark-all-read`, {}, { headers });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setStats(prev => ({ ...prev, unread: 0 }));
      toast.success('Toutes marquées comme lues');
    } catch (e) {}
  };

  const deleteNotification = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/notifications/${id}`, { headers });
      setNotifications(prev => prev.filter(n => n.notification_id !== id));
      setArchivedNotifications(prev => prev.filter(n => n.notification_id !== id));
      toast.success('Supprimée');
    } catch (e) {}
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMins = Math.floor((now - date) / 60000);
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return date.toLocaleDateString('fr-FR');
  };

  const displayedNotifs = showArchived ? archivedNotifications : notifications;
  const filtered = displayedNotifs.filter(n => 
    !searchTerm || n.title?.toLowerCase().includes(searchTerm.toLowerCase()) || n.message?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 space-y-5" data-testid="vendeur-notifications-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-3">
            <Bell className="w-6 h-6 text-amber-400" />
            Mes Notifications
          </h1>
          <p className="text-sm text-slate-400">Restez informé en temps réel</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchNotifications} variant="outline" size="sm" className="border-slate-700" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {stats.unread > 0 && (
            <Button onClick={markAllAsRead} size="sm" className="bg-blue-600 hover:bg-blue-700">
              <CheckCircle className="w-4 h-4 mr-1" />
              Tout lu
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-3 flex items-center gap-3">
            <Bell className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-xs text-blue-300">Total</p>
              <p className="text-lg font-bold text-white">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-3 flex items-center gap-3">
            <Eye className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-xs text-amber-300">Non lues</p>
              <p className="text-lg font-bold text-white">{stats.unread}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-slate-800 border-slate-700 text-white text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowArchived(false)} size="sm"
            variant={!showArchived ? "default" : "outline"}
            className={!showArchived ? "bg-blue-600 flex-1" : "border-slate-700 flex-1"}>
            Actives ({notifications.length})
          </Button>
          <Button onClick={() => setShowArchived(true)} size="sm"
            variant={showArchived ? "default" : "outline"}
            className={showArchived ? "bg-slate-600 flex-1" : "border-slate-700 flex-1"}>
            <Archive className="w-3 h-3 mr-1" />
            Archives ({archivedNotifications.length})
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
          <Bell className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">Aucune notification</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((notif) => (
            <div key={notif.notification_id}
              className={`p-3 rounded-xl border transition-all ${notif.read ? 'bg-slate-800/30 border-slate-700/50 opacity-70' : 'bg-blue-500/10 border-blue-500/30'}`}>
              <div className="flex items-start gap-3">
                <div className={`p-1.5 rounded-lg ${notif.read ? 'bg-slate-700' : 'bg-slate-800'}`}>
                  {getNotificationIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`text-sm font-semibold ${notif.read ? 'text-slate-400' : 'text-white'}`}>
                      {notif.title}
                    </h3>
                    {!notif.read && <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0" />}
                  </div>
                  <p className={`text-xs mt-1 ${notif.read ? 'text-slate-500' : 'text-slate-300'}`}>
                    {notif.message}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />{formatTime(notif.created_at)}
                    </span>
                    <div className="flex items-center gap-1">
                      {!notif.read && (
                        <Button size="sm" variant="ghost" onClick={() => markAsRead(notif.notification_id)}
                          className="text-blue-400 hover:text-blue-300 h-7 px-2">
                          <EyeOff className="w-3 h-3" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => deleteNotification(notif.notification_id)}
                        className="text-red-400 hover:text-red-300 h-7 px-2">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VendeurNotificationsPage;
