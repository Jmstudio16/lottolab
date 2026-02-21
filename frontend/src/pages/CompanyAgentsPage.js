import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export const CompanyAgentsPage = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    phone: '',
    email: '',
    can_void_ticket: false
  });

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await apiClient.get('/company/agents');
      setAgents(response.data);
    } catch (error) {
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/company/agents', formData);
      toast.success('Agent created successfully!');
      setShowCreateModal(false);
      fetchAgents();
      setFormData({
        name: '',
        username: '',
        password: '',
        phone: '',
        email: '',
        can_void_ticket: false
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create agent');
    }
  };

  const handleStatusToggle = async (agentId, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await apiClient.put(`/company/agents/${agentId}`, { status: newStatus });
      toast.success(`Agent ${newStatus.toLowerCase()}`);
      fetchAgents();
    } catch (error) {
      toast.error('Failed to update agent status');
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Agents" subtitle="Manage POS agents" role="COMPANY_ADMIN">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Agents" subtitle="Manage POS agents" role="COMPANY_ADMIN">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-slate-400">Total: {agents.length} agents</p>
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button className="button-primary" data-testid="create-agent-button">
                <Plus className="w-4 h-4 mr-2" />
                Create Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Create New Agent</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-slate-300">Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Agent Name"
                    required
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="agent-name-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Username</Label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    placeholder="username"
                    required
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="agent-username-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Password</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="••••••••"
                    required
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="agent-password-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="+509-XXXX-XXXX"
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="agent-phone-input"
                  />
                </div>
                <Button type="submit" className="w-full button-primary" data-testid="submit-agent-button">
                  Create Agent
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
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Username</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {agents.map((agent) => (
                  <tr key={agent.agent_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-white">{agent.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-300 font-mono">{agent.username}</td>
                    <td className="px-6 py-4 text-sm text-slate-400">{agent.phone || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                        agent.status === 'ACTIVE' 
                          ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800'
                          : 'bg-red-950/50 text-red-400 border-red-800'
                      }`}>
                        {agent.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {new Date(agent.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleStatusToggle(agent.agent_id, agent.status)}
                        className={agent.status === 'ACTIVE' ? 'text-red-400 hover:bg-red-900/20' : 'text-green-400 hover:bg-green-900/20'}
                        data-testid={`toggle-agent-${agent.agent_id}`}
                      >
                        {agent.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};