import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { toast } from 'sonner';
import { Activity, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const CompanyActivityLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action_type: '',
    entity_type: ''
  });

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.action_type) params.append('action_type', filters.action_type);
      if (filters.entity_type) params.append('entity_type', filters.entity_type);
      
      const response = await apiClient.get(`/company/activity-logs?${params.toString()}`);
      setLogs(response.data);
    } catch (error) {
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    fetchLogs();
  };

  const clearFilters = () => {
    setFilters({ action_type: '', entity_type: '' });
    fetchLogs();
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString();
  };

  const getActionColor = (actionType) => {
    if (actionType.includes('CREATED')) return 'text-emerald-400';
    if (actionType.includes('UPDATED')) return 'text-blue-400';
    if (actionType.includes('DELETED')) return 'text-red-400';
    if (actionType.includes('LOGIN')) return 'text-yellow-400';
    return 'text-slate-400';
  };

  const getActionIcon = (actionType) => {
    if (actionType.includes('CREATED')) return '+';
    if (actionType.includes('UPDATED')) return '~';
    if (actionType.includes('DELETED')) return '-';
    if (actionType.includes('LOGIN')) return '>';
    return '•';
  };

  if (loading) {
    return (
      <AdminLayout title="Activity Logs" subtitle="Company activity history" role="COMPANY_ADMIN">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Activity Logs" subtitle="Company activity history" role="COMPANY_ADMIN">
      <div className="space-y-6">
        {/* Filters */}
        <div className="bg-card border border-slate-700/50 rounded-xl p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="min-w-[200px]">
              <label className="text-xs text-slate-400 mb-1 block">Action Type</label>
              <Select value={filters.action_type || "all"} onValueChange={(val) => setFilters({...filters, action_type: val === "all" ? "" : val})}>
                <SelectTrigger className="bg-slate-950 border-slate-700 text-white" data-testid="filter-action-type">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="all" className="text-white">All actions</SelectItem>
                  <SelectItem value="AGENT_CREATED" className="text-white">Agent Created</SelectItem>
                  <SelectItem value="AGENT_UPDATED" className="text-white">Agent Updated</SelectItem>
                  <SelectItem value="POS_DEVICE_CREATED" className="text-white">POS Device Created</SelectItem>
                  <SelectItem value="SCHEDULE_CREATED" className="text-white">Schedule Created</SelectItem>
                  <SelectItem value="RESULT_CREATED" className="text-white">Result Created</SelectItem>
                  <SelectItem value="USER_LOGIN" className="text-white">User Login</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px]">
              <label className="text-xs text-slate-400 mb-1 block">Entity Type</label>
              <Select value={filters.entity_type || "all"} onValueChange={(val) => setFilters({...filters, entity_type: val === "all" ? "" : val})}>
                <SelectTrigger className="bg-slate-950 border-slate-700 text-white" data-testid="filter-entity-type">
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="all" className="text-white">All entities</SelectItem>
                  <SelectItem value="agent" className="text-white">Agent</SelectItem>
                  <SelectItem value="pos_device" className="text-white">POS Device</SelectItem>
                  <SelectItem value="schedule" className="text-white">Schedule</SelectItem>
                  <SelectItem value="result" className="text-white">Result</SelectItem>
                  <SelectItem value="user" className="text-white">User</SelectItem>
                  <SelectItem value="settings" className="text-white">Settings</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <button 
              onClick={applyFilters} 
              className="px-4 py-2 bg-yellow-400 text-slate-900 rounded-lg font-medium hover:bg-yellow-500 transition-colors"
              data-testid="apply-log-filters"
            >
              <Filter className="w-4 h-4 inline mr-2" />
              Apply
            </button>
            <button 
              onClick={clearFilters} 
              className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-800 transition-colors"
              data-testid="clear-log-filters"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Logs List */}
        <div className="bg-card border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-800">
            {logs.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-400">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No activity logs found</p>
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.log_id} className="p-4 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold ${getActionColor(log.action_type)} bg-slate-900`}>
                      {getActionIcon(log.action_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium ${getActionColor(log.action_type)}`}>
                          {log.action_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400 text-sm">{log.entity_type}</span>
                        {log.entity_id && (
                          <>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-500 text-xs font-mono">{log.entity_id.slice(0, 12)}...</span>
                          </>
                        )}
                      </div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-1 text-sm text-slate-400">
                          {Object.entries(log.metadata).map(([key, value]) => (
                            <span key={key} className="mr-3">
                              <span className="text-slate-500">{key}:</span> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                        <span>{formatDate(log.created_at)}</span>
                        {log.ip_address && <span>IP: {log.ip_address}</span>}
                        {log.performed_by && <span>By: {log.performed_by.slice(0, 12)}...</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
