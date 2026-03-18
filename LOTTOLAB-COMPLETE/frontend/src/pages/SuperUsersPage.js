import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export const SuperUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'AGENT_POS',
    company_id: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, companiesRes] = await Promise.all([
        apiClient.get('/saas/all-users').catch(() => ({ data: [] })),
        apiClient.get('/saas/companies').catch(() => ({ data: [] }))
      ]);
      setUsers(usersRes.data || []);
      setCompanies(companiesRes.data || []);
    } catch (error) {
      console.error('Users error:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/super/users', formData);
      toast.success('User created successfully!');
      setShowCreateModal(false);
      fetchData();
      setFormData({ name: '', email: '', password: '', role: 'AGENT_POS', company_id: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.put(`/super/users/${selectedUser.user_id}`, {
        name: formData.name,
        role: formData.role,
        status: formData.status,
        company_id: formData.company_id || null
      });
      toast.success('User updated successfully!');
      setShowEditModal(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to update user');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await apiClient.delete(`/super/users/${userId}`);
      toast.success('User deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      company_id: user.company_id || '',
      status: user.status
    });
    setShowEditModal(true);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = !roleFilter || user.role === roleFilter;
    const matchesStatus = !statusFilter || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading) {
    return (
      <AdminLayout title="Users Management" subtitle="Manage all platform users" role="SUPER_ADMIN">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Users Management" subtitle="Manage all platform users" role="SUPER_ADMIN">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-950 border-slate-700 text-white"
              data-testid="search-users-input"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 rounded-md bg-slate-950 border border-slate-700 text-white"
            data-testid="role-filter-select"
          >
            <option value="">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="COMPANY_ADMIN">Company Admin</option>
            <option value="COMPANY_MANAGER">Manager</option>
            <option value="AGENT_POS">Agent POS</option>
            <option value="AUDITOR_READONLY">Auditor</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-md bg-slate-950 border border-slate-700 text-white"
            data-testid="status-filter-select"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button className="button-primary" data-testid="create-user-button">
                <Plus className="w-4 h-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Create New User</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-slate-300">Full Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="user-name-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="user-email-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Password</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    required
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="user-password-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Role</Label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-white"
                    data-testid="user-role-select"
                  >
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="COMPANY_ADMIN">Company Admin</option>
                    <option value="COMPANY_MANAGER">Manager</option>
                    <option value="AGENT_POS">Agent POS</option>
                    <option value="AUDITOR_READONLY">Auditor</option>
                  </select>
                </div>
                <div>
                  <Label className="text-slate-300">Company (optional)</Label>
                  <select
                    value={formData.company_id}
                    onChange={(e) => setFormData({...formData, company_id: e.target.value})}
                    className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-white"
                    data-testid="user-company-select"
                  >
                    <option value="">None (Super Admin only)</option>
                    {companies.map(company => (
                      <option key={company.company_id} value={company.company_id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" className="w-full button-primary" data-testid="submit-user-button">
                  Create User
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <p className="text-slate-400">Total: {filteredUsers.length} users</p>

        {/* Users Table */}
        <div className="bg-card border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Last Login</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredUsers.map((user) => {
                  const company = companies.find(c => c.company_id === user.company_id);
                  return (
                    <tr key={user.user_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-white">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-950/50 text-blue-400 border border-blue-800">
                          {user.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {company ? company.name : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          user.status === 'ACTIVE' 
                            ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800'
                            : 'bg-red-950/50 text-red-400 border-red-800'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openEditModal(user)}
                          className="text-blue-400 hover:bg-blue-900/20"
                          data-testid={`edit-user-${user.user_id}`}
                        >
                          <Edit className="w-4 h-4" />
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="bg-card border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Edit User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <Label className="text-slate-300">Full Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="bg-slate-950 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Email (read-only)</Label>
                <Input
                  value={formData.email}
                  disabled
                  className="bg-slate-900 border-slate-700 text-slate-500"
                />
              </div>
              <div>
                <Label className="text-slate-300">Role</Label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="COMPANY_ADMIN">Company Admin</option>
                  <option value="COMPANY_MANAGER">Manager</option>
                  <option value="AGENT_POS">Agent POS</option>
                  <option value="AUDITOR_READONLY">Auditor</option>
                </select>
              </div>
              <div>
                <Label className="text-slate-300">Status</Label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
              <Button type="submit" className="w-full button-primary">
                Update User
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};