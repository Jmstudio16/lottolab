import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import axios from 'axios';
import { useAuth } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Plus, Building2, Edit, Trash2, Users, DollarSign,
  Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw,
  Power, Calendar, Shield, Eye, Store, Ban, Play
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const SuperCompaniesPage = () => {
  const { token } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
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

  const [editData, setEditData] = useState({
    company_name: '',
    slogan: '',
    contact_email: '',
    plan: '',
    timezone: '',
    currency: '',
    default_commission_rate: 0
  });

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/saas/companies`, { headers });
      setCompanies(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyDetail = async (companyId) => {
    try {
      const response = await axios.get(`${API_URL}/api/saas/companies/${companyId}`, { headers });
      setSelectedCompany(response.data);
      setShowDetailModal(true);
    } catch (error) {
      toast.error('Erreur lors du chargement');
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

  const openEditModal = (company) => {
    setEditData({
      company_name: company.name || '',
      slogan: company.slogan || '',
      contact_email: company.contact_email || '',
      plan: company.plan || 'Basic',
      timezone: company.timezone || 'America/Port-au-Prince',
      currency: company.currency || 'HTG',
      default_commission_rate: company.default_commission_rate || 10
    });
    setSelectedCompany(company);
    setShowEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/api/saas/companies/${selectedCompany.company_id}`, editData, { headers });
      toast.success('Entreprise mise à jour');
      setShowEditModal(false);
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };

  const handleSuspend = async (companyId) => {
    if (!window.confirm('Suspendre cette entreprise? Tous les utilisateurs seront bloqués.')) return;
    try {
      await axios.put(`${API_URL}/api/saas/companies/${companyId}/suspend`, {}, { headers });
      toast.success('Entreprise suspendue - Tous les accès sont bloqués');
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
      toast.error('Erreur');
    }
  };

  const handleDelete = async (companyId) => {
    if (!window.confirm('Supprimer (archiver) cette entreprise? Elle sera masquée et tous ses utilisateurs bloqués.')) return;
    try {
      await axios.delete(`${API_URL}/api/saas/companies/${companyId}`, { headers });
      toast.success('Entreprise archivée - Visible dans les archives');
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };

  const handleExtendLicense = async (companyId, days) => {
    try {
      await axios.put(`${API_URL}/api/saas/companies/${companyId}/extend-license?days=${days}`, {}, { headers });
      toast.success(`License étendue de ${days} jours`);
      fetchCompanies();
    } catch (error) {
      toast.error('Erreur');
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
      'DELETED': 'bg-slate-500/20 text-slate-400',
      'TRIAL': 'bg-blue-500/20 text-blue-400'
    };
    return styles[status] || 'bg-slate-500/20 text-slate-400';
  };

  const getRemainingDaysColor = (days) => {
    if (days <= 0) return 'text-red-400';
    if (days <= 7) return 'text-yellow-400';
    if (days <= 30) return 'text-orange-400';
    return 'text-emerald-400';
  };

  // Stats
  const activeCompanies = companies.filter(c => c.status === 'ACTIVE').length;
  const suspendedCompanies = companies.filter(c => c.status === 'SUSPENDED').length;
  const totalAgents = companies.reduce((sum, c) => sum + (c.agents_count || 0), 0);
  const totalSuccursales = companies.reduce((sum, c) => sum + (c.succursales_count || 0), 0);

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
              <p className="text-slate-400">{companies.length} entreprises</p>
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Total</p>
            <p className="text-2xl font-bold text-white">{companies.length}</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Actives</p>
            <p className="text-2xl font-bold text-emerald-400">{activeCompanies}</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Suspendues</p>
            <p className="text-2xl font-bold text-red-400">{suspendedCompanies}</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Succursales</p>
            <p className="text-2xl font-bold text-blue-400">{totalSuccursales}</p>
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
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase">Succursales</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase">Agents</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase">Jours Restants</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase">Statut</th>
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
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Store className="w-4 h-4 text-blue-400" />
                        <span className="text-white">{company.succursales_count || 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="w-4 h-4 text-yellow-400" />
                        <span className="text-white">{company.agents_count || 0}</span>
                        {company.active_agents !== undefined && (
                          <span className="text-xs text-slate-400">
                            ({company.active_agents} actifs)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className={`w-4 h-4 ${getRemainingDaysColor(company.remaining_days)}`} />
                        <span className={`font-bold ${getRemainingDaysColor(company.remaining_days)}`}>
                          {company.remaining_days || 0} jours
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(company.status)}`}>
                        {company.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View Details */}
                        <button
                          onClick={() => fetchCompanyDetail(company.company_id)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {/* Edit */}
                        <button
                          onClick={() => openEditModal(company)}
                          className="p-1.5 text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded"
                          title="Modifier"
                          data-testid={`edit-${company.company_id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        
                        {/* Suspend/Activate */}
                        {company.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleSuspend(company.company_id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded"
                            title="Suspendre"
                            data-testid={`suspend-${company.company_id}`}
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : company.status === 'SUSPENDED' ? (
                          <button
                            onClick={() => handleActivate(company.company_id)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded"
                            title="Réactiver"
                            data-testid={`activate-${company.company_id}`}
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        ) : null}
                        
                        {/* Extend License */}
                        <button
                          onClick={() => handleExtendLicense(company.company_id, 30)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded"
                          title="Étendre 30 jours"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        
                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(company.company_id, false)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded"
                          title="Supprimer"
                          data-testid={`delete-${company.company_id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {companies.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
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
                  />
                </div>
              </div>

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
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Mot de passe Admin *</Label>
                  <Input
                    type="password"
                    value={formData.admin_password}
                    onChange={(e) => setFormData({...formData, admin_password: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                    required
                    data-testid="admin-password"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-emerald-400 uppercase">Plan & Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Plan</Label>
                    <select
                      value={formData.plan_id}
                      onChange={(e) => setFormData({...formData, plan_id: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    >
                      <option value="Starter">Starter</option>
                      <option value="Basic">Basic</option>
                      <option value="Professional">Professional</option>
                      <option value="Enterprise">Enterprise</option>
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
                    />
                  </div>
                </div>
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
                >
                  {creating ? 'Création...' : 'Créer Entreprise'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Company Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-yellow-400" />
                Modifier Entreprise
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <Label className="text-slate-300">Nom Entreprise</Label>
                <Input
                  value={editData.company_name}
                  onChange={(e) => setEditData({...editData, company_name: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Email</Label>
                <Input
                  type="email"
                  value={editData.contact_email}
                  onChange={(e) => setEditData({...editData, contact_email: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Plan</Label>
                  <select
                    value={editData.plan}
                    onChange={(e) => setEditData({...editData, plan: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="Starter">Starter</option>
                    <option value="Basic">Basic</option>
                    <option value="Professional">Professional</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <Label className="text-slate-300">Commission %</Label>
                  <Input
                    type="number"
                    value={editData.default_commission_rate}
                    onChange={(e) => setEditData({...editData, default_commission_rate: parseFloat(e.target.value) || 0})}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                >
                  Enregistrer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Company Detail Modal */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-400" />
                {selectedCompany?.name}
              </DialogTitle>
            </DialogHeader>

            {selectedCompany && (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-400">{selectedCompany.succursales_count || 0}</p>
                    <p className="text-xs text-slate-400">Succursales</p>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-yellow-400">{selectedCompany.agents_count || 0}</p>
                    <p className="text-xs text-slate-400">Agents Total</p>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-emerald-400">{selectedCompany.active_agents || 0}</p>
                    <p className="text-xs text-slate-400">Agents Actifs</p>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                    <p className={`text-2xl font-bold ${getRemainingDaysColor(selectedCompany.remaining_days)}`}>
                      {selectedCompany.remaining_days || 0}
                    </p>
                    <p className="text-xs text-slate-400">Jours Restants</p>
                  </div>
                </div>

                {/* Succursales */}
                {selectedCompany.succursales && selectedCompany.succursales.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <Store className="w-5 h-5 text-blue-400" />
                      Succursales
                    </h3>
                    <div className="space-y-2">
                      {selectedCompany.succursales.map(succ => (
                        <div key={succ.succursale_id} className="bg-slate-800/30 p-3 rounded-lg flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{succ.nom_succursale}</p>
                            <p className="text-slate-400 text-sm">{succ.supervisor_email}</p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(succ.status)}`}>
                            {succ.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Agents */}
                {selectedCompany.agents && selectedCompany.agents.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <Users className="w-5 h-5 text-yellow-400" />
                      Agents ({selectedCompany.agents.length})
                    </h3>
                    <div className="bg-slate-800/30 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full">
                        <thead className="bg-slate-800">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs text-slate-400">Nom</th>
                            <th className="px-3 py-2 text-left text-xs text-slate-400">Email</th>
                            <th className="px-3 py-2 text-center text-xs text-slate-400">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {selectedCompany.agents.map(agent => (
                            <tr key={agent.user_id}>
                              <td className="px-3 py-2 text-white text-sm">{agent.name}</td>
                              <td className="px-3 py-2 text-blue-400 text-sm">{agent.email}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(agent.status)}`}>
                                  {agent.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default SuperCompaniesPage;
