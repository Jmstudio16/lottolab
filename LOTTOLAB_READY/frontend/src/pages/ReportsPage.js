import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BarChart3, TrendingUp, Users, Ticket } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const ReportsPage = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');

  useEffect(() => {
    fetchReport();
  }, [period]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/company/reports/summary?period=${period}`);
      setReport(response.data);
    } catch (error) {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'HTG' }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading) {
    return (
      <AdminLayout title="Reports" subtitle="Sales and performance reports" role="COMPANY_ADMIN">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Reports" subtitle="Sales and performance reports" role="COMPANY_ADMIN">
      <div className="space-y-6">
        {/* Period Selector */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px] bg-slate-950 border-slate-700 text-white" data-testid="period-select">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                <SelectItem value="today" className="text-white">Today</SelectItem>
                <SelectItem value="week" className="text-white">Last 7 Days</SelectItem>
                <SelectItem value="month" className="text-white">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchReport} variant="outline" className="border-slate-700 text-slate-300" data-testid="refresh-report-button">
              Refresh
            </Button>
          </div>
          <p className="text-slate-400 text-sm">
            Period: {formatDate(report?.period_start)} - {formatDate(report?.period_end)}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-card border border-slate-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Tickets</p>
                <p className="text-3xl font-bold text-white mt-1">{report?.total_tickets || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Ticket className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-card border border-slate-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Sales</p>
                <p className="text-3xl font-bold text-emerald-400 mt-1">{formatCurrency(report?.total_sales)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="bg-card border border-slate-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Wins Paid</p>
                <p className="text-3xl font-bold text-red-400 mt-1">{formatCurrency(report?.total_wins)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </div>

          <div className="bg-card border border-slate-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Net Revenue</p>
                <p className="text-3xl font-bold text-yellow-400 mt-1">{formatCurrency(report?.net_revenue)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Sales by Agent */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Sales by Agent
            </h3>
            <div className="space-y-3">
              {report?.sales_by_agent?.length > 0 ? (
                report.sales_by_agent.map((agent, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-white font-medium">{agent.agent_name}</p>
                        <p className="text-slate-400 text-sm">{agent.tickets} tickets</p>
                      </div>
                    </div>
                    <p className="text-emerald-400 font-bold">{formatCurrency(agent.sales)}</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-center py-6">No sales data for this period</p>
              )}
            </div>
          </div>

          {/* Sales by Lottery */}
          <div className="bg-card border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-yellow-400" />
              Sales by Lottery
            </h3>
            <div className="space-y-3">
              {report?.sales_by_lottery?.length > 0 ? (
                report.sales_by_lottery.map((lottery, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-white font-medium">{lottery.lottery_name}</p>
                        <p className="text-slate-400 text-sm">{lottery.tickets} tickets</p>
                      </div>
                    </div>
                    <p className="text-emerald-400 font-bold">{formatCurrency(lottery.sales)}</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-center py-6">No sales data for this period</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
