import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import axios from 'axios';
import { useAuth } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Plus, Building2, Edit, Trash2, Users, Ticket, DollarSign,
  Globe, Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw,
  Power, Calendar, Shield, Eye
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const SuperCompaniesPage = () => {
  const { token } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [creating, setCreating] = useState(false);
  
  const [formData, setFormData] = useState({
    company_name: '',
    slogan: '',
    contact_email: '',
    admin_password: '',
    admin_name: '',
    plan_id: 'Professional',
    timezone: 'America/Port-au-Prince',
    currency: 'HTG',
    default_commission_rate: 10.0,
    max_agents: 50,
    max_daily_sales: 1000000.0
  });

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/super/companies`, { headers });
      setCompanies(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des entreprises');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.contact_email || !formData.admin_password || !formData.company_name) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    try {
      setCreating(true);
      const response = await axios.post(`${API_URL}/api/saas/companies/full-create`, formData, { headers });
      toast.success(`Entreprise créée! Admin: ${response.data.admin_email}`);
      setShowCreateModal(false);
      resetForm();
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleSuspend = async (companyId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir suspendre cette entreprise?')) return;
    try {
      await axios.put(`${API_URL}/api/saas/companies/${companyId}/suspend`, {}, { headers });
      toast.success('Entreprise suspendue');
      fetchCompanies();
    } catch (error) {
      toast.error('Erreur lors de la suspension');
    }
  };

  const handleActivate = async (companyId) => {
    try {
      await axios.put(`${API_URL}/api/saas/companies/${companyId}/activate`, {}, { headers });
      toast.success('Entreprise activée');
      fetchCompanies();
    } catch (error) {
      toast.error('Erreur lors de l\'activation');
    }
  };

  const handleExtendLicense = async (companyId, days) => {
    try {
      await axios.put(`${API_URL}/api/saas/companies/${companyId}/extend-license?days=${days}`, {}, { headers });
      toast.success(`License étendue de ${days} jours`);
      fetchCompanies();
    } catch (error) {
      toast.error('Erreur lors de l\'extension');
    }
  };

  const resetForm = () => {
    setFormData({
      company_name: '',
      slogan: '',
      contact_email: '',
      admin_password: '',
      admin_name: '',
      plan_id: 'Professional',
      timezone: 'America/Port-au-Prince',
      currency: 'HTG',
      default_commission_rate: 10.0,
      max_agents: 50,
      max_daily_sales: 1000000.0
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      'ACTIVE': 'bg-emerald-500/20 text-emerald-400',
      'SUSPENDED': 'bg-red-500/20 text-red-400',
      'EXPIRED': 'bg-yellow-500/20 text-yellow-400',
      'TRIAL': 'bg-blue-500/20 text-blue-400'
    };
    return styles[status] || 'bg-slate-500/20 text-slate-400';
  };

  // Stats
  const activeCompanies = companies.filter(c => c.status === 'ACTIVE').length;
  const onlineCompanies = companies.filter(c => c.is_online).length;
  const totalAgents = companies.reduce((sum, c) => sum + (c.agents_count || 0), 0);

  return (
    <AdminLayout role="SUPER_ADMIN">
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl">
              <Building2 className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Entreprises SaaS</h1>
              <p className="text-slate-400">{companies.length} entreprises enregistrées</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchCompanies}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="create-company-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle Entreprise
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Total</p>
            <p className="text-2xl font-bold text-white">{companies.length}</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Actives</p>
            <p className="text-2xl font-bold text-emerald-400">{activeCompanies}</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">En Ligne</p>
            <p className="text-2xl font-bold text-blue-400">{onlineCompanies}</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Agents Total</p>
            <p className="text-2xl font-bold text-yellow-400">{totalAgents}</p>
          </div>
        </div>

        {/* Companies Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Entreprise</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Plan</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase">Agents</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase">Statut</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase">En Ligne</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {companies.map((company) => (
                  <tr key={company.company_id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white font-medium">{company.name}</p>
                        <p className="text-slate-400 text-sm">{company.contact_email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                        {company.plan || 'Basic'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-white">{company.agents_count || 0}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(company.status)}`}>
                        {company.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {company.is_online ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                          Online
                        </span>
                      ) : (
                        <span className="text-slate-500">Offline</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {company.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleSuspend(company.company_id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded"
                            title="Suspendre"
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(company.company_id)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded"
                            title="Activer"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleExtendLicense(company.company_id, 30)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded"
                          title="Étendre 30 jours"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {companies.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                      Aucune entreprise
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Create Company Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-400" />
                Nouvelle Entreprise SaaS
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Company Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-purple-400 uppercase">Informations Entreprise</h3>
                <div>
                  <Label className="text-slate-300">Nom Entreprise *</Label>
                  <Input
                    value={formData.company_name}
                    onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="Ex: LotoPam Haiti"
                    required
                    data-testid="company-name"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Slogan</Label>
                  <Input
                    value={formData.slogan}
                    onChange={(e) => setFormData({...formData, slogan: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="La chance vous sourit!"
                    data-testid="company-slogan"
                  />
                </div>
              </div>

              {/* Admin Account */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-400 uppercase">Compte Admin</h3>
                <div>
                  <Label className="text-slate-300">Email Contact (Login Admin) *</Label>
                  <Input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="admin@company.com"
                    required
                    data-testid="admin-email"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Nom Admin</Label>
                  <Input
                    value={formData.admin_name}
                    onChange={(e) => setFormData({...formData, admin_name: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="Jean Pierre"
                    data-testid="admin-name"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Mot de passe Admin *</Label>
                  <Input
                    type="password"
                    value={formData.admin_password}
                    onChange={(e) => setFormData({...formData, admin_password: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="Min 8 caractères"
                    required
                    data-testid="admin-password"
                  />
                </div>
              </div>

              {/* Plan & Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-emerald-400 uppercase">Plan & Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Plan</Label>
                    <select
                      value={formData.plan_id}
                      onChange={(e) => setFormData({...formData, plan_id: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      data-testid="plan-select"
                    >
                      <option value="Starter">Starter (Gratuit)</option>
                      <option value="Basic">Basic ($99)</option>
                      <option value="Professional">Professional ($299)</option>
                      <option value="Enterprise">Enterprise ($999)</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-slate-300">Timezone</Label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => setFormData({...formData, timezone: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      data-testid="timezone-select"
                    >
                      <option value="America/Port-au-Prince">Haiti (UTC-5)</option>
                      <option value="America/New_York">New York (UTC-5)</option>
                      <option value="America/Chicago">Chicago (UTC-6)</option>
                      <option value="America/Los_Angeles">Los Angeles (UTC-8)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Devise</Label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({...formData, currency: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      data-testid="currency-select"
                    >
                      <option value="HTG">HTG (Gourde)</option>
                      <option value="USD">USD (Dollar)</option>
                      <option value="EUR">EUR (Euro)</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-slate-300">Commission %</Label>
                    <Input
                      type="number"
                      value={formData.default_commission_rate}
                      onChange={(e) => setFormData({...formData, default_commission_rate: parseFloat(e.target.value) || 0})}
                      className="bg-slate-800 border-slate-700 text-white"
                      min="0"
                      max="100"
                      step="0.5"
                      data-testid="commission"
                    />
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-400">
                  À la création, toutes les loteries actives globalement seront automatiquement liées à cette entreprise.
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  disabled={creating}
                  data-testid="save-company-btn"
                >
                  {creating ? 'Création...' : 'Créer Entreprise'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default SuperCompaniesPage;
