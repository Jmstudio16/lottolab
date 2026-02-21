import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, CalendarClock, Trash2, Edit2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' }
];

export const SchedulesPage = () => {
  const [schedules, setSchedules] = useState([]);
  const [lotteries, setLotteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    lottery_id: '',
    day_of_week: 0,
    open_time: '08:00',
    close_time: '18:00',
    draw_time: '19:00',
    is_active: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [schedulesRes, lotteriesRes] = await Promise.all([
        apiClient.get('/company/schedules'),
        apiClient.get('/company/lotteries')
      ]);
      setSchedules(schedulesRes.data);
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
      await apiClient.post('/company/schedules', formData);
      toast.success('Schedule created successfully!');
      setShowCreateModal(false);
      fetchData();
      setFormData({
        lottery_id: '',
        day_of_week: 0,
        open_time: '08:00',
        close_time: '18:00',
        draw_time: '19:00',
        is_active: true
      });
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to create schedule';
      toast.error(msg);
    }
  };

  const handleToggle = async (scheduleId, currentActive) => {
    try {
      await apiClient.put(`/company/schedules/${scheduleId}`, { is_active: !currentActive });
      toast.success(`Schedule ${!currentActive ? 'activated' : 'deactivated'}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update schedule');
    }
  };

  const handleDelete = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    try {
      await apiClient.delete(`/company/schedules/${scheduleId}`);
      toast.success('Schedule deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete schedule');
    }
  };

  const getDayName = (dayIndex) => {
    return DAYS_OF_WEEK.find(d => d.value === dayIndex)?.label || 'Unknown';
  };

  if (loading) {
    return (
      <AdminLayout title="Schedules" subtitle="Manage lottery schedules" role="COMPANY_ADMIN">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Schedules" subtitle="Manage lottery schedules" role="COMPANY_ADMIN">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-slate-400">Total: {schedules.length} schedules</p>
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button className="button-primary" data-testid="create-schedule-button">
                <Plus className="w-4 h-4 mr-2" />
                Add Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Create New Schedule</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-slate-300">Lottery *</Label>
                  <Select 
                    value={formData.lottery_id} 
                    onValueChange={(value) => setFormData({...formData, lottery_id: value})}
                  >
                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white" data-testid="schedule-lottery-select">
                      <SelectValue placeholder="Select a lottery" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      {lotteries.map(lottery => (
                        <SelectItem key={lottery.lottery_id} value={lottery.lottery_id} className="text-white">
                          {lottery.lottery_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Day of Week *</Label>
                  <Select 
                    value={String(formData.day_of_week)} 
                    onValueChange={(value) => setFormData({...formData, day_of_week: parseInt(value)})}
                  >
                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white" data-testid="schedule-day-select">
                      <SelectValue placeholder="Select a day" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      {DAYS_OF_WEEK.map(day => (
                        <SelectItem key={day.value} value={String(day.value)} className="text-white">
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-slate-300">Open Time</Label>
                    <Input
                      type="time"
                      value={formData.open_time}
                      onChange={(e) => setFormData({...formData, open_time: e.target.value})}
                      className="bg-slate-950 border-slate-700 text-white"
                      data-testid="schedule-open-time"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Close Time</Label>
                    <Input
                      type="time"
                      value={formData.close_time}
                      onChange={(e) => setFormData({...formData, close_time: e.target.value})}
                      className="bg-slate-950 border-slate-700 text-white"
                      data-testid="schedule-close-time"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Draw Time</Label>
                    <Input
                      type="time"
                      value={formData.draw_time}
                      onChange={(e) => setFormData({...formData, draw_time: e.target.value})}
                      className="bg-slate-950 border-slate-700 text-white"
                      data-testid="schedule-draw-time"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                    data-testid="schedule-active-switch"
                  />
                  <Label className="text-slate-300">Active</Label>
                </div>
                <Button type="submit" className="w-full button-primary" data-testid="submit-schedule-button">
                  Create Schedule
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
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Day</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Open</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Close</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Draw</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {schedules.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                      <CalendarClock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No schedules created yet</p>
                      <p className="text-sm mt-1">Create a schedule to control when lotteries are open for sales</p>
                    </td>
                  </tr>
                ) : (
                  schedules.map((schedule) => (
                    <tr key={schedule.schedule_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white">{schedule.lottery_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">{getDayName(schedule.day_of_week)}</td>
                      <td className="px-6 py-4 text-sm text-emerald-400 font-mono">{schedule.open_time}</td>
                      <td className="px-6 py-4 text-sm text-red-400 font-mono">{schedule.close_time}</td>
                      <td className="px-6 py-4 text-sm text-yellow-400 font-mono">{schedule.draw_time}</td>
                      <td className="px-6 py-4">
                        <Switch
                          checked={schedule.is_active}
                          onCheckedChange={() => handleToggle(schedule.schedule_id, schedule.is_active)}
                          data-testid={`toggle-schedule-${schedule.schedule_id}`}
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(schedule.schedule_id)}
                          className="text-red-400 hover:bg-red-900/20"
                          data-testid={`delete-schedule-${schedule.schedule_id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
