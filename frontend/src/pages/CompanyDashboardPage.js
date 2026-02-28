import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { 
  Ticket, 
  DollarSign, 
  Users, 
  Clock,
  TrendingUp,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';

const StatCard = ({ title, value, subtitle, icon: Icon, color = 'yellow' }) => {
  const colorClasses = {
    yellow: 'from-yellow-400/20 to-yellow-600/20',
    blue: 'from-blue-400/20 to-blue-600/20',
    green: 'from-green-400/20 to-green-600/20',
    purple: 'from-purple-400/20 to-purple-600/20',
  };

  return (
    <div className="stat-card bg-card border border-slate-700/50 rounded-xl p-6 relative overflow-hidden">
      <div className={`absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br ${colorClasses[color]} rounded-full blur-2xl opacity-50`}></div>
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 rounded-lg bg-slate-900/50">
            <Icon className="w-6 h-6 text-yellow-400" />
          </div>
        </div>
        <h3 className="text-3xl font-barlow font-bold text-white mb-1">{value}</h3>
        <p className="text-sm font-medium text-slate-300">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};

// Subscription Alert Component
const SubscriptionAlert = ({ subscription }) => {
  if (!subscription) return null;
  
  const { remaining_days, alert_level, message, is_expired, plan, subscription_end } = subscription;
  
  // Don't show if more than 15 days remaining
  if (remaining_days > 15 && !is_expired) return null;
  
  const getAlertStyles = () => {
    if (is_expired || alert_level === 'critical') {
      return 'bg-red-950/50 border-red-700 text-red-300';
    }
    if (alert_level === 'warning') {
      return 'bg-yellow-950/50 border-yellow-700 text-yellow-300';
    }
    return 'bg-slate-800/50 border-slate-700 text-slate-300';
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className={`${getAlertStyles()} border rounded-xl p-4 mb-6`} data-testid="subscription-alert">
      <div className="flex items-center gap-3">
        <AlertTriangle className={`w-6 h-6 ${is_expired || alert_level === 'critical' ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`} />
        <div className="flex-1">
          <p className="font-bold text-lg">{message}</p>
          <p className="text-sm opacity-80">
            Plan: {plan} | Expire le: {formatDate(subscription_end)}
          </p>
        </div>
        <div className="text-right">
          <span className={`text-3xl font-bold ${is_expired ? 'text-red-400' : remaining_days <= 5 ? 'text-red-400' : 'text-yellow-400'}`}>
            {is_expired ? '0' : remaining_days}
          </span>
          <p className="text-xs opacity-80">jours restants</p>
        </div>
      </div>
    </div>
  );
};

// Subscription Counter Component (always visible)
const SubscriptionCounter = ({ subscription }) => {
  if (!subscription) return null;
  
  const { remaining_days, is_expired, plan, subscription_end, company_name } = subscription;
  
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  const getProgressColor = () => {
    if (is_expired || remaining_days <= 5) return 'bg-red-500';
    if (remaining_days <= 15) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  
  // Calculate progress (assuming 365 days max)
  const progress = Math.min(100, (remaining_days / 365) * 100);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 mb-6" data-testid="subscription-counter">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-yellow-400" />
          <span className="font-semibold text-white">Abonnement {plan}</span>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-bold ${is_expired ? 'text-red-400' : remaining_days <= 5 ? 'text-red-400' : remaining_days <= 15 ? 'text-yellow-400' : 'text-green-400'}`}>
            {is_expired ? 'Expiré' : `${remaining_days} jours`}
          </span>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
        <div 
          className={`${getProgressColor()} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <p className="text-xs text-slate-400">
        Expire le {formatDate(subscription_end)}
      </p>
    </div>
  );
};

export const CompanyDashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, ticketsRes, subscriptionRes] = await Promise.all([
        apiClient.get('/company/dashboard/stats'),
        apiClient.get('/company/tickets'),
        apiClient.get('/saas/my-subscription').catch(() => ({ data: null }))
      ]);
      setStats(statsRes.data);
      setTickets(ticketsRes.data.slice(0, 10));
      setSubscription(subscriptionRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Dashboard" subtitle="Company Overview" role="COMPANY_ADMIN">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard" subtitle="Company Overview" role="COMPANY_ADMIN">
      <div className="space-y-6">
        {/* Subscription Alert (Critical warnings) */}
        <SubscriptionAlert subscription={subscription} />
        
        {/* Subscription Counter (Always visible) */}
        <SubscriptionCounter subscription={subscription} />
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Tickets Today"
            value={stats?.tickets_today || 0}
            icon={Ticket}
            color="yellow"
            data-testid="stat-tickets-today"
          />
          <StatCard
            title="Sales Today"
            value={`${stats?.sales_today?.toFixed(2) || '0.00'} HTG`}
            icon={DollarSign}
            color="green"
            data-testid="stat-sales-today"
          />
          <StatCard
            title="Active Agents"
            value={stats?.active_agents || 0}
            icon={Users}
            color="blue"
            data-testid="stat-active-agents"
          />
          <StatCard
            title="Open Lotteries"
            value={stats?.open_lotteries || 0}
            icon={Clock}
            color="purple"
            data-testid="stat-open-lotteries"
          />
        </div>

        {/* Recent Tickets */}
        <div className="bg-card border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-slate-700/50">
            <h2 className="text-xl font-barlow font-bold uppercase tracking-tight text-white">
              Recent Tickets
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Ticket Code</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Lottery</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                      No tickets found
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => (
                    <tr key={ticket.ticket_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-white">{ticket.ticket_code}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">{ticket.lottery_name}</td>
                      <td className="px-6 py-4 text-sm text-green-400 font-semibold">
                        {ticket.total_amount} {ticket.currency}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                          ticket.status === 'ACTIVE' 
                            ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800'
                            : ticket.status === 'VOID'
                            ? 'bg-red-950/50 text-red-400 border-red-800'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {new Date(ticket.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};