import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { 
  Ticket, 
  DollarSign, 
  Users, 
  Clock,
  TrendingUp
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

export const CompanyDashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, ticketsRes] = await Promise.all([
        apiClient.get('/company/dashboard/stats'),
        apiClient.get('/company/tickets')
      ]);
      setStats(statsRes.data);
      setTickets(ticketsRes.data.slice(0, 10));
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