import React, { useEffect, useState } from 'react';
import { AgentLayout } from '@/components/AgentLayout';
import apiClient from '@/api/client';
import { toast } from 'sonner';
import { BarChart3, TrendingUp, Ticket, Calendar } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export const AgentMySalesPage = () => {
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');

  useEffect(() => {
    fetchSales();
  }, [period]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/agent/my-sales?period=${period}`);
      setSalesData(response.data);
    } catch (error) {
      toast.error('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'HTG' }).format(amount || 0);
  };

  if (loading) {
    return (
      <AgentLayout title="My Sales" subtitle="Your sales performance">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AgentLayout>
    );
  }

  return (
    <AgentLayout title="My Sales" subtitle="Your sales performance">
      <div className="space-y-6">
        {/* Period Selector */}
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px] bg-slate-950 border-slate-700 text-white" data-testid="agent-period-select">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              <SelectItem value="today" className="text-white">Today</SelectItem>
              <SelectItem value="week" className="text-white">Last 7 Days</SelectItem>
              <SelectItem value="month" className="text-white">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchSales} variant="outline" className="border-slate-700 text-slate-300" data-testid="agent-refresh-sales">
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-300 text-sm font-medium">Total Tickets Sold</p>
                <p className="text-4xl font-bold text-white mt-2">{salesData?.total_tickets || 0}</p>
                <p className="text-blue-400 text-sm mt-1 capitalize">{period === 'today' ? 'Today' : `Last ${period === 'week' ? '7' : '30'} days`}</p>
              </div>
              <div className="w-16 h-16 rounded-full bg-blue-500/30 flex items-center justify-center">
                <Ticket className="w-8 h-8 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-300 text-sm font-medium">Total Sales</p>
                <p className="text-4xl font-bold text-emerald-400 mt-2">{formatCurrency(salesData?.total_sales)}</p>
                <p className="text-emerald-400/70 text-sm mt-1 capitalize">{period === 'today' ? 'Today' : `Last ${period === 'week' ? '7' : '30'} days`}</p>
              </div>
              <div className="w-16 h-16 rounded-full bg-emerald-500/30 flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Sales by Lottery */}
        <div className="bg-card border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-yellow-400" />
            Sales by Lottery
          </h3>
          <div className="space-y-4">
            {salesData?.sales_by_lottery?.length > 0 ? (
              salesData.sales_by_lottery.map((lottery, idx) => {
                const percentage = salesData.total_sales > 0 
                  ? (lottery.sales / salesData.total_sales * 100) 
                  : 0;
                
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-slate-900 font-bold text-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-white font-medium">{lottery.lottery_name}</p>
                          <p className="text-slate-400 text-sm">{lottery.tickets} tickets</p>
                        </div>
                      </div>
                      <p className="text-emerald-400 font-bold text-lg">{formatCurrency(lottery.sales)}</p>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No sales data for this period</p>
              </div>
            )}
          </div>
        </div>

        {/* Performance Tip */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <p className="text-yellow-400 font-medium">Performance Summary</p>
          <p className="text-slate-300 text-sm mt-1">
            {salesData?.total_tickets > 0 
              ? `Great work! You sold ${salesData?.total_tickets} tickets for a total of ${formatCurrency(salesData?.total_sales)}.`
              : `Start selling tickets to see your performance data here.`
            }
          </p>
        </div>
      </div>
    </AgentLayout>
  );
};
