import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Users, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const CompanyUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'COMPANY_MANAGER'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await apiClient.get('/company/users');
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/company/users', formData);
      toast.success('User created successfully!');
      setShowCreateModal(false);
      fetchUsers();
      setFormData({ name: '', email: '', password: '', role: 'COMPANY_MANAGER' });
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to create user';
      toast.error(msg);
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await apiClient.put(`/company/users/${userId}`, { status: newStatus });
      toast.success(`User ${newStatus.toLowerCase()}`);
      fetchUsers();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to update user';
      toast.error(msg);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await apiClient.delete(`/company/users/${userId}`);
      toast.success('User deleted');
      fetchUsers();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to delete user';
      toast.error(msg);
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'COMPANY_ADMIN': return 'Admin';
      case 'COMPANY_MANAGER': return 'Manager';
      case 'AUDITOR_READONLY': return 'Auditor';
      default: return role;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'COMPANY_ADMIN': return 'bg-purple-950/50 text-purple-400 border-purple-800';
      case 'COMPANY_MANAGER': return 'bg-blue-950/50 text-blue-400 border-blue-800';
      case 'AUDITOR_READONLY': return 'bg-slate-950/50 text-slate-400 border-slate-800';
      default: return 'bg-slate-950/50 text-slate-400 border-slate-800';
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Company Users" subtitle="Manage company staff" role="COMPANY_ADMIN">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Company Users" subtitle="Manage company staff" role="COMPANY_ADMIN">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-slate-400">Total: {users.length} users</p>
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button className="button-primary" data-testid="create-user-button">
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Add New Company User</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-slate-300">Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Full name"
                    required
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="user-name-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Email *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="email@company.com"
                    required
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="user-email-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Password *</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="••••••••"
                    required
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="user-password-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Role *</Label>
                  <Select value={formData.role} onValueChange={(val) => setFormData({...formData, role: val})}>
                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white" data-testid="user-role-select">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem value="COMPANY_MANAGER" className="text-white">Manager</SelectItem>
                      <SelectItem value="AUDITOR_READONLY" className="text-white">Auditor (Read-only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full button-primary" data-testid="submit-user-button">
                  Create User
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
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Last Login</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No company users found</p>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.user_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white">{user.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRoleColor(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                          user.status === 'ACTIVE' 
                            ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800'
                            : 'bg-red-950/50 text-red-400 border-red-800'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {user.role !== 'COMPANY_ADMIN' && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleStatusToggle(user.user_id, user.status)}
                              className={user.status === 'ACTIVE' ? 'text-red-400 hover:bg-red-900/20' : 'text-green-400 hover:bg-green-900/20'}
                              data-testid={`toggle-user-${user.user_id}`}
                            >
                              {user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDelete(user.user_id)}
                              className="text-red-400 hover:bg-red-900/20"
                              data-testid={`delete-user-${user.user_id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
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
