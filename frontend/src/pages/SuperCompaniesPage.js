import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Building2, Edit, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export const SuperCompaniesPage = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    contact_email: '',
    contact_phone: '',
    currency: 'HTG',
    timezone: 'America/Port-au-Prince',
    plan: 'Basic'
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await apiClient.get('/super/companies');
      setCompanies(response.data);
    } catch (error) {
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/super/companies', formData);
      toast.success('Company created successfully!');
      setShowCreateModal(false);
      fetchCompanies();
      setFormData({
        name: '',
        slug: '',
        contact_email: '',
        contact_phone: '',
        currency: 'HTG',
        timezone: 'America/Port-au-Prince',
        plan: 'Basic'
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create company');
    }
  };

  const handleSuspend = async (companyId) => {
    try {
      await apiClient.delete(`/super/companies/${companyId}`);
      toast.success('Company suspended');
      fetchCompanies();
    } catch (error) {
      toast.error('Failed to suspend company');
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Companies" subtitle="Manage all companies" role="SUPER_ADMIN">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Companies" subtitle="Manage all companies" role="SUPER_ADMIN">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-slate-400">Total: {companies.length} companies</p>
          </div>
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button className="button-primary" data-testid="create-company-button">
                <Plus className="w-4 h-4 mr-2" />
                Create Company
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Create New Company</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-slate-300">Company Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Company Name"
                    required
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="company-name-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Slug</Label>
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                    placeholder="company-slug"
                    required
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="company-slug-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Contact Email</Label>
                  <Input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                    placeholder="contact@company.com"
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid="company-email-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Plan</Label>
                  <select
                    value={formData.plan}
                    onChange={(e) => setFormData({...formData, plan: e.target.value})}
                    className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-white"
                    data-testid="company-plan-select"
                  >
                    <option value="Basic">Basic</option>
                    <option value="Pro">Pro</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
                <Button type="submit" className="w-full button-primary" data-testid="submit-company-button">
                  Create Company
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
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Currency</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {companies.map((company) => (
                  <tr key={company.company_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-white">{company.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{company.slug}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                        company.status === 'ACTIVE' 
                          ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800'
                          : 'bg-red-950/50 text-red-400 border-red-800'
                      }`}>
                        {company.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">{company.plan}</td>
                    <td className="px-6 py-4 text-sm text-slate-400">{company.currency}</td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {new Date(company.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleSuspend(company.company_id)}
                        className="text-red-400 hover:bg-red-900/20"
                        data-testid={`suspend-company-${company.company_id}`}
                      >
                        Suspend
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