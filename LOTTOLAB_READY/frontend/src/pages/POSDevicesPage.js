import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Monitor, Trash2, Power, PowerOff, UserPlus, UserMinus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const POSDevicesPage = () => {
  const [devices, setDevices] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [formData, setFormData] = useState({
    imei: '',
    device_name: '',
    branch: '',
    location: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [devicesRes, agentsRes] = await Promise.all([
        apiClient.get('/company/pos-devices'),
        apiClient.get('/company/agents')
      ]);
      setDevices(devicesRes.data);
      setAgents(agentsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/company/pos-devices', formData);
      toast.success('POS Device created successfully!');
      setShowCreateModal(false);
      fetchData();
      setFormData({ imei: '', device_name: '', branch: '', location: '', notes: '' });
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to create device';
      toast.error(msg);
    }
  };

  const handleActivate = async (deviceId) => {
    try {
      await apiClient.put(`/company/pos-devices/${deviceId}/activate`);
      toast.success('Device activated');
      fetchData();
    } catch (error) {
      toast.error('Failed to activate device');
    }
  };

  const handleBlock = async (deviceId) => {
    try {
      await apiClient.put(`/company/pos-devices/${deviceId}/block`);
      toast.success('Device blocked');
      fetchData();
    } catch (error) {
      toast.error('Failed to block device');
    }
  };

  const handleDelete = async (deviceId) => {
    if (!window.confirm('Are you sure you want to delete this device?')) return;
    try {
      await apiClient.delete(`/company/pos-devices/${deviceId}`);
      toast.success('Device deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete device');
    }
  };

  const handleAssign = async (agentId) => {
    if (!selectedDevice) return;
    try {
      if (agentId === 'unassign') {
        await apiClient.put(`/company/pos-devices/${selectedDevice.device_id}/unassign`);
        toast.success('Agent unassigned');
      } else {
        await apiClient.put(`/company/pos-devices/${selectedDevice.device_id}/assign/${agentId}`);
        toast.success('Agent assigned');
      }
      setShowAssignModal(false);
      setSelectedDevice(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to assign agent');
    }
  };

  const getAgentName = (agentId) => {
    const agent = agents.find(a => a.agent_id === agentId);
    return agent ? agent.name : 'Not assigned';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return 'bg-emerald-950/50 text-emerald-400 border-emerald-800';
      case 'BLOCKED': return 'bg-red-950/50 text-red-400 border-red-800';
      default: return 'bg-yellow-950/50 text-yellow-400 border-yellow-800';
    }
  };

  if (loading) {
    return (
      <AdminLayout title="POS Devices" subtitle="Manage point of sale devices" role="COMPANY_ADMIN">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="POS Devices" subtitle="Manage point of sale devices" role="COMPANY_ADMIN">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-slate-400">Total: {devices.length} devices</p>
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button className="button-primary" data-testid="create-device-button">
                <Plus className="w-4 h-4 mr-2" />
                Add Device
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Add New POS Device</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-slate-300">IMEI *</Label>
                  <Input
                    value={formData.imei}
                    onChange={(e) => setFormData({...formData, imei: e.target.value})}
                    placeholder="Enter device IMEI"
                    required
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="device-imei-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Device Name *</Label>
                  <Input
                    value={formData.device_name}
                    onChange={(e) => setFormData({...formData, device_name: e.target.value})}
                    placeholder="e.g., POS Terminal 001"
                    required
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="device-name-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Branch</Label>
                  <Input
                    value={formData.branch}
                    onChange={(e) => setFormData({...formData, branch: e.target.value})}
                    placeholder="Branch name"
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="device-branch-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Location</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    placeholder="Physical location"
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="device-location-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Notes</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Additional notes"
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="device-notes-input"
                  />
                </div>
                <Button type="submit" className="w-full button-primary" data-testid="submit-device-button">
                  Add Device
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Assign Agent Modal */}
        <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
          <DialogContent className="bg-card border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Assign Agent to Device</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-slate-400">Device: {selectedDevice?.device_name}</p>
              <Select onValueChange={handleAssign}>
                <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="unassign" className="text-red-400">Unassign current agent</SelectItem>
                  {agents.filter(a => a.status === 'ACTIVE').map(agent => (
                    <SelectItem key={agent.agent_id} value={agent.agent_id} className="text-white">
                      {agent.name} ({agent.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DialogContent>
        </Dialog>

        <div className="bg-card border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Device</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">IMEI</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Branch</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Assigned Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                      <Monitor className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No POS devices registered yet</p>
                    </td>
                  </tr>
                ) : (
                  devices.map((device) => (
                    <tr key={device.device_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white">{device.device_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-300 font-mono">{device.imei}</td>
                      <td className="px-6 py-4 text-sm text-slate-400">{device.branch || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {device.assigned_agent_id ? getAgentName(device.assigned_agent_id) : 
                          <span className="text-slate-500 italic">Not assigned</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${getStatusColor(device.status)}`}>
                          {device.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => { setSelectedDevice(device); setShowAssignModal(true); }}
                          className="text-blue-400 hover:bg-blue-900/20"
                          data-testid={`assign-agent-${device.device_id}`}
                        >
                          <UserPlus className="w-4 h-4" />
                        </Button>
                        {device.status !== 'ACTIVE' ? (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleActivate(device.device_id)}
                            className="text-green-400 hover:bg-green-900/20"
                            data-testid={`activate-device-${device.device_id}`}
                          >
                            <Power className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleBlock(device.device_id)}
                            className="text-orange-400 hover:bg-orange-900/20"
                            data-testid={`block-device-${device.device_id}`}
                          >
                            <PowerOff className="w-4 h-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(device.device_id)}
                          className="text-red-400 hover:bg-red-900/20"
                          data-testid={`delete-device-${device.device_id}`}
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
