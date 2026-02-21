import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Ticket, ToggleLeft, ToggleRight } from 'lucide-react';

export const CompanyLotteriesPage = () => {
  const [lotteries, setLotteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchLotteries();
  }, []);

  const fetchLotteries = async () => {
    try {
      const response = await apiClient.get('/company/lotteries');
      setLotteries(response.data);
    } catch (error) {
      toast.error('Failed to load lotteries');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (lotteryId, currentStatus) => {
    try {
      await apiClient.put(`/company/lotteries/${lotteryId}/toggle`, null, {
        params: { enabled: !currentStatus }
      });
      toast.success(`Lottery ${!currentStatus ? 'enabled' : 'disabled'}`);
      fetchLotteries();
    } catch (error) {
      toast.error('Failed to toggle lottery');
    }
  };

  const filteredLotteries = lotteries.filter(lottery => {
    if (filter === 'enabled') return lottery.enabled;
    if (filter === 'disabled') return !lottery.enabled;
    return true;
  });

  if (loading) {
    return (
      <AdminLayout title="Lottery Catalog" subtitle="Manage lottery offerings" role="COMPANY_ADMIN">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Lottery Catalog" subtitle="Manage lottery offerings" role="COMPANY_ADMIN">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'button-primary' : 'border-slate-600 text-slate-300'}
            data-testid="filter-all"
          >
            All ({lotteries.length})
          </Button>
          <Button
            variant={filter === 'enabled' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('enabled')}
            className={filter === 'enabled' ? 'bg-green-600 hover:bg-green-700' : 'border-slate-600 text-slate-300'}
            data-testid="filter-enabled"
          >
            Enabled ({lotteries.filter(l => l.enabled).length})
          </Button>
          <Button
            variant={filter === 'disabled' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('disabled')}
            className={filter === 'disabled' ? 'bg-slate-600 hover:bg-slate-700' : 'border-slate-600 text-slate-300'}
            data-testid="filter-disabled"
          >
            Disabled ({lotteries.filter(l => !l.enabled).length})
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLotteries.map((lottery) => (
            <div
              key={lottery.lottery_id}
              className={`bg-card border rounded-xl p-5 transition-all ${
                lottery.enabled
                  ? 'border-green-700/50 bg-green-950/10'
                  : 'border-slate-700/50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-barlow font-bold text-white text-lg">
                    {lottery.lottery_name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {lottery.region} • {lottery.game_type}
                  </p>
                </div>
                <button
                  onClick={() => handleToggle(lottery.lottery_id, lottery.enabled)}
                  data-testid={`toggle-lottery-${lottery.lottery_id}`}
                  className="ml-2"
                >
                  {lottery.enabled ? (
                    <ToggleRight className="w-8 h-8 text-green-400" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-600" />
                  )}
                </button>
              </div>
              
              {lottery.description && (
                <p className="text-sm text-slate-400 mb-3">{lottery.description}</p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                  lottery.enabled
                    ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}>
                  {lottery.enabled ? 'ENABLED' : 'DISABLED'}
                </span>
                <span className="text-xs text-slate-500">
                  {lottery.draw_times?.length || 0} draws/day
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};