import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { Activity } from 'lucide-react';
import { toast } from 'sonner';

export const SuperActivityLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, entityFilter]);

  const fetchLogs = async () => {
    try {
      const params = {};
      if (actionFilter) params.action_type = actionFilter;
      if (entityFilter) params.entity_type = entityFilter;
      
      const response = await apiClient.get('/super/activity-logs', { params });
      setLogs(response.data);
    } catch (error) {
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    if (action.includes('CREATE')) return 'text-green-400 bg-green-950/50 border-green-800';
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'text-blue-400 bg-blue-950/50 border-blue-800';
    if (action.includes('DELETE') || action.includes('SUSPEND')) return 'text-red-400 bg-red-950/50 border-red-800';
    if (action.includes('LOGIN')) return 'text-yellow-400 bg-yellow-950/50 border-yellow-800';
    return 'text-slate-400 bg-slate-900 border-slate-800';
  };

  if (loading) {
    return (
      <AdminLayout title="Activity Logs" subtitle="System audit trail" role="SUPER_ADMIN">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Activity Logs" subtitle="System audit trail" role="SUPER_ADMIN">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-4 py-2 rounded-md bg-slate-950 border border-slate-700 text-white"
            data-testid="action-filter-select"
          >
            <option value="">All Actions</option>
            <option value="USER_LOGIN">Login</option>
            <option value="USER_CREATED">User Created</option>
            <option value="USER_UPDATED">User Updated</option>
            <option value="USER_DELETED">User Deleted</option>
            <option value="COMPANY_CREATED">Company Created</option>
            <option value="PLAN_CREATED">Plan Created</option>
            <option value="LICENSE_CREATED">License Created</option>
            <option value="SETTINGS_UPDATED">Settings Updated</option>
          </select>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-4 py-2 rounded-md bg-slate-950 border border-slate-700 text-white"
            data-testid="entity-filter-select"
          >
            <option value="">All Entities</option>
            <option value="user">User</option>
            <option value="company">Company</option>
            <option value="plan">Plan</option>
            <option value="license">License</option>
            <option value="settings">Settings</option>
            <option value="ticket">Ticket</option>
          </select>
        </div>

        <p className="text-slate-400">Showing {logs.length} activity logs</p>

        {/* Logs Table */}
        <div className="bg-card border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Entity</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Performed By</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">IP Address</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                      No activity logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.log_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getActionColor(log.action_type)}`}>
                          {log.action_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {log.entity_type}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-white">{log.performed_by_name || 'Unknown'}</p>
                          <p className="text-xs text-slate-500 font-mono">{log.performed_by}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {log.company_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400 font-mono">
                        {log.ip_address || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {new Date(log.created_at).toLocaleString()}
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