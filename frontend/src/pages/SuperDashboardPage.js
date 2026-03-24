import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { 
  Building2, 
  Users, 
  UserCheck, 
  Ticket, 
  DollarSign,
  TrendingUp,
  Eye,
  Settings as SettingsIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const StatCard = ({ title, value, subtitle, icon: Icon, color = 'yellow' }) => {
  const colorClasses = {
    yellow: 'from-yellow-400/20 to-yellow-600/20',
    blue: 'from-blue-400/20 to-blue-600/20',
    green: 'from-green-400/20 to-green-600/20',
    purple: 'from-purple-400/20 to-purple-600/20',
  };

  return (
    <div className="stat-card bg-card border border-slate-700/50 rounded-xl p-4 sm:p-6 relative overflow-hidden">
      <div className={`absolute -top-10 -right-10 w-24 sm:w-32 h-24 sm:h-32 bg-gradient-to-br ${colorClasses[color]} rounded-full blur-2xl opacity-50`}></div>
      <div className="relative">
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div className="p-2 sm:p-3 rounded-lg bg-slate-900/50">
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
          </div>
        </div>
        <h3 className="text-2xl sm:text-3xl font-barlow font-bold text-white mb-1">{value}</h3>
        <p className="text-xs sm:text-sm font-medium text-slate-300">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};

export const SuperDashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, companiesRes] = await Promise.all([
        apiClient.get('/saas/dashboard-stats'),
        apiClient.get('/saas/companies')
      ]);
      setStats(statsRes.data);
      setCompanies(companiesRes.data.slice(0, 5));
    } catch (error) {
      console.error('Dashboard error:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Dashboard" subtitle="Super Admin Overview" role="SUPER_ADMIN">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard" subtitle="Super Admin Overview" role="SUPER_ADMIN">
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Companies"
            value={stats?.total_companies || 0}
            icon={Building2}
            color="yellow"
            data-testid="stat-total-companies"
          />
          <StatCard
            title="Active Companies"
            value={stats?.active_companies || 0}
            icon={UserCheck}
            color="green"
            data-testid="stat-active-companies"
          />
          <StatCard
            title="Total Agents"
            value={stats?.total_agents || 0}
            icon={Users}
            color="blue"
            data-testid="stat-total-agents"
          />
          <StatCard
            title="Tickets Today"
            value={stats?.tickets_today || 0}
            icon={Ticket}
            color="purple"
            data-testid="stat-tickets-today"
          />
        </div>

        {/* Companies Table */}
        <div className="bg-card border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-barlow font-bold uppercase tracking-tight text-white">
                Recent Companies
              </h2>
              <Link to="/super/companies">
                <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                  View All
                </Button>
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                      No companies found
                    </td>
                  </tr>
                ) : (
                  companies.map((company) => (
                    <tr key={company.company_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-white">{company.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{company.slug}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                          company.status === 'ACTIVE' 
                            ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800'
                            : 'bg-slate-900 text-slate-500 border-slate-800'
                        }`}>
                          {company.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">{company.plan}</td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {new Date(company.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link to={`/super/companies`}>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                            data-testid={`view-company-${company.company_id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </Link>
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