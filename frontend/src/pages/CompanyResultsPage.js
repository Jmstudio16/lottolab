import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export const CompanyResultsPage = () => {
  const [results, setResults] = useState([]);
  const [lotteries, setLotteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    lottery_id: '',
    draw_datetime: '',
    winning_numbers: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [resultsRes, lotteriesRes] = await Promise.all([
        apiClient.get('/company/results'),
        apiClient.get('/company/lotteries')
      ]);
      setResults(resultsRes.data);
      setLotteries(lotteriesRes.data.filter(l => l.enabled));
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/company/results', formData);
      toast.success('Result posted successfully!');
      setShowCreateModal(false);
      fetchData();
      setFormData({
        lottery_id: '',
        draw_datetime: '',
        winning_numbers: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to post result');
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Results" subtitle="Manage lottery results" role="COMPANY_ADMIN">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Results" subtitle="Manage lottery results" role="COMPANY_ADMIN">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-slate-400">Total: {results.length} results</p>
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button className="button-primary" data-testid="post-result-button">
                <Plus className="w-4 h-4 mr-2" />
                Post Result
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Post Lottery Result</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-slate-300">Lottery</Label>
                  <select
                    value={formData.lottery_id}
                    onChange={(e) => setFormData({...formData, lottery_id: e.target.value})}
                    required
                    className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-white"
                    data-testid="result-lottery-select"
                  >
                    <option value="">Select lottery</option>
                    {lotteries.map(lottery => (
                      <option key={lottery.lottery_id} value={lottery.lottery_id}>
                        {lottery.lottery_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-slate-300">Draw Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={formData.draw_datetime}
                    onChange={(e) => setFormData({...formData, draw_datetime: new Date(e.target.value).toISOString()})}
                    required
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="result-datetime-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Winning Numbers</Label>
                  <Input
                    value={formData.winning_numbers}
                    onChange={(e) => setFormData({...formData, winning_numbers: e.target.value})}
                    placeholder="e.g., 1234 or 12-34-56"
                    required
                    className="bg-slate-950 border-slate-700 text-white font-mono text-lg"
                    data-testid="result-numbers-input"
                  />
                </div>
                <Button type="submit" className="w-full button-primary" data-testid="submit-result-button">
                  Post Result
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Lottery</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Draw Date</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Winning Numbers</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Posted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                      No results posted yet
                    </td>
                  </tr>
                ) : (
                  results.map((result) => (
                    <tr key={result.result_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white">{result.lottery_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {new Date(result.draw_datetime).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-mono font-bold text-yellow-400">
                          {result.winning_numbers}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">{result.source}</td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {new Date(result.created_at).toLocaleDateString()}
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