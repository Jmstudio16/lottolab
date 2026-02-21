import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Edit, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export const SuperPlansPage = () => {
  const [plans, setPlans] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [showEditPlanModal, setShowEditPlanModal] = useState(false);
  const [showCreateLicenseModal, setShowCreateLicenseModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [planFormData, setPlanFormData] = useState({
    name: '',
    price: '0',
    max_agents: '5',
    max_tickets_per_day: '1000',
    max_lotteries: '10',
    max_pos_devices: '5',
    features: ''
  });
  const [licenseFormData, setLicenseFormData] = useState({
    company_id: '',
    plan_id: '',
    start_date: new Date().toISOString().split('T')[0],
    expiry_date: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [plansRes, licensesRes, companiesRes] = await Promise.all([
        apiClient.get('/super/plans'),
        apiClient.get('/super/licenses'),
        apiClient.get('/super/companies')
      ]);
      setPlans(plansRes.data);
      setLicenses(licensesRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...planFormData,
        price: parseFloat(planFormData.price),
        max_agents: parseInt(planFormData.max_agents),
        max_tickets_per_day: parseInt(planFormData.max_tickets_per_day),
        max_lotteries: parseInt(planFormData.max_lotteries),
        max_pos_devices: parseInt(planFormData.max_pos_devices),
        features: planFormData.features.split(',').map(f => f.trim()).filter(f => f)
      };
      await apiClient.post('/super/plans', data);
      toast.success('Plan created successfully!');
      setShowCreatePlanModal(false);
      fetchData();
      setPlanFormData({ name: '', price: '0', max_agents: '5', max_tickets_per_day: '1000', max_lotteries: '10', max_pos_devices: '5', features: '' });
    } catch (error) {
      toast.error('Failed to create plan');
    }
  };

  const handleUpdatePlan = async (e) => {
    e.preventDefault();
    try {
      const data = {
        name: planFormData.name,
        price: parseFloat(planFormData.price),
        max_agents: parseInt(planFormData.max_agents),
        max_tickets_per_day: parseInt(planFormData.max_tickets_per_day),
        max_lotteries: parseInt(planFormData.max_lotteries),
        max_pos_devices: parseInt(planFormData.max_pos_devices),
        features: planFormData.features.split(',').map(f => f.trim()).filter(f => f)
      };
      await apiClient.put(`/super/plans/${selectedPlan.plan_id}`, data);
      toast.success('Plan updated successfully!');
      setShowEditPlanModal(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to update plan');
    }
  };

  const handleCreateLicense = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/super/licenses', licenseFormData);
      toast.success('License created successfully!');
      setShowCreateLicenseModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create license');
    }
  };

  const openEditPlanModal = (plan) => {
    setSelectedPlan(plan);
    setPlanFormData({
      name: plan.name,
      price: plan.price.toString(),
      max_agents: plan.max_agents.toString(),
      max_tickets_per_day: plan.max_tickets_per_day.toString(),
      max_lotteries: plan.max_lotteries.toString(),
      max_pos_devices: plan.max_pos_devices.toString(),
      features: plan.features.join(', ')
    });
    setShowEditPlanModal(true);
  };

  if (loading) {
    return (
      <AdminLayout title="Plans & Licenses" subtitle="Manage subscription plans" role="SUPER_ADMIN">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Plans & Licenses" subtitle="Manage subscription plans" role="SUPER_ADMIN">
      <div className="space-y-6">
        {/* Plans Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-barlow font-bold uppercase text-white">Subscription Plans</h2>
            <Dialog open={showCreatePlanModal} onOpenChange={setShowCreatePlanModal}>
              <DialogTrigger asChild>
                <Button className="button-primary" data-testid="create-plan-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Plan
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Create New Plan</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreatePlan} className="space-y-4">
                  <div>
                    <Label className="text-slate-300">Plan Name</Label>
                    <Input value={planFormData.name} onChange={(e) => setPlanFormData({...planFormData, name: e.target.value})} required className="bg-slate-950 border-slate-700 text-white" />
                  </div>
                  <div>
                    <Label className="text-slate-300">Price (USD)</Label>
                    <Input type="number" step="0.01" value={planFormData.price} onChange={(e) => setPlanFormData({...planFormData, price: e.target.value})} required className="bg-slate-950 border-slate-700 text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">Max Agents</Label>
                      <Input type="number" value={planFormData.max_agents} onChange={(e) => setPlanFormData({...planFormData, max_agents: e.target.value})} required className="bg-slate-950 border-slate-700 text-white" />
                    </div>
                    <div>
                      <Label className="text-slate-300">Max POS Devices</Label>
                      <Input type="number" value={planFormData.max_pos_devices} onChange={(e) => setPlanFormData({...planFormData, max_pos_devices: e.target.value})} required className="bg-slate-950 border-slate-700 text-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">Max Tickets/Day</Label>
                      <Input type="number" value={planFormData.max_tickets_per_day} onChange={(e) => setPlanFormData({...planFormData, max_tickets_per_day: e.target.value})} required className="bg-slate-950 border-slate-700 text-white" />
                    </div>
                    <div>
                      <Label className="text-slate-300">Max Lotteries</Label>
                      <Input type="number" value={planFormData.max_lotteries} onChange={(e) => setPlanFormData({...planFormData, max_lotteries: e.target.value})} required className="bg-slate-950 border-slate-700 text-white" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-300">Features (comma-separated)</Label>
                    <Input value={planFormData.features} onChange={(e) => setPlanFormData({...planFormData, features: e.target.value})} placeholder="Feature 1, Feature 2" className="bg-slate-950 border-slate-700 text-white" />
                  </div>
                  <Button type="submit" className="w-full button-primary">Create Plan</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.plan_id} className="bg-card border border-slate-700/50 rounded-xl p-6 relative">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-barlow font-bold text-white">{plan.name}</h3>
                    <p className="text-3xl font-bold text-yellow-400 mt-2">${plan.price}<span className="text-sm text-slate-400">/mo</span></p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openEditPlanModal(plan)} className="text-blue-400 hover:bg-blue-900/20">
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li>• {plan.max_agents} Agents</li>
                  <li>• {plan.max_pos_devices} POS Devices</li>
                  <li>• {plan.max_tickets_per_day} Tickets/Day</li>
                  <li>• {plan.max_lotteries} Lotteries</li>
                  {plan.features.map((feature, idx) => (
                    <li key={idx}>• {feature}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Licenses Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-barlow font-bold uppercase text-white">Active Licenses</h2>
            <Dialog open={showCreateLicenseModal} onOpenChange={setShowCreateLicenseModal}>
              <DialogTrigger asChild>
                <Button className="button-primary" data-testid="create-license-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Assign License
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Assign License</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateLicense} className="space-y-4">
                  <div>
                    <Label className="text-slate-300">Company</Label>
                    <select value={licenseFormData.company_id} onChange={(e) => setLicenseFormData({...licenseFormData, company_id: e.target.value})} required className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-white">
                      <option value="">Select company</option>
                      {companies.map(company => <option key={company.company_id} value={company.company_id}>{company.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-slate-300">Plan</Label>
                    <select value={licenseFormData.plan_id} onChange={(e) => setLicenseFormData({...licenseFormData, plan_id: e.target.value})} required className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-white">
                      <option value="">Select plan</option>
                      {plans.map(plan => <option key={plan.plan_id} value={plan.plan_id}>{plan.name} - ${plan.price}/mo</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">Start Date</Label>
                      <Input type="date" value={licenseFormData.start_date} onChange={(e) => setLicenseFormData({...licenseFormData, start_date: e.target.value})} required className="bg-slate-950 border-slate-700 text-white" />
                    </div>
                    <div>
                      <Label className="text-slate-300">Expiry Date</Label>
                      <Input type="date" value={licenseFormData.expiry_date} onChange={(e) => setLicenseFormData({...licenseFormData, expiry_date: e.target.value})} required className="bg-slate-950 border-slate-700 text-white" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full button-primary">Assign License</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="bg-card border border-slate-700/50 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Start Date</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Expiry Date</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {licenses.map((license) => (
                  <tr key={license.license_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-white">{license.company_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">{license.plan_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-400">{new Date(license.start_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm text-slate-400">{new Date(license.expiry_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        license.status === 'ACTIVE' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800' : 'bg-red-950/50 text-red-400 border-red-800'
                      }`}>
                        {license.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Plan Modal */}
        <Dialog open={showEditPlanModal} onOpenChange={setShowEditPlanModal}>
          <DialogContent className="bg-card border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Edit Plan</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdatePlan} className="space-y-4">
              <div>
                <Label className="text-slate-300">Plan Name</Label>
                <Input value={planFormData.name} onChange={(e) => setPlanFormData({...planFormData, name: e.target.value})} className="bg-slate-950 border-slate-700 text-white" />
              </div>
              <div>
                <Label className="text-slate-300">Price (USD)</Label>
                <Input type="number" step="0.01" value={planFormData.price} onChange={(e) => setPlanFormData({...planFormData, price: e.target.value})} className="bg-slate-950 border-slate-700 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Max Agents</Label>
                  <Input type="number" value={planFormData.max_agents} onChange={(e) => setPlanFormData({...planFormData, max_agents: e.target.value})} className="bg-slate-950 border-slate-700 text-white" />
                </div>
                <div>
                  <Label className="text-slate-300">Max POS Devices</Label>
                  <Input type="number" value={planFormData.max_pos_devices} onChange={(e) => setPlanFormData({...planFormData, max_pos_devices: e.target.value})} className="bg-slate-950 border-slate-700 text-white" />
                </div>
              </div>
              <Button type="submit" className="w-full button-primary">Update Plan</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};