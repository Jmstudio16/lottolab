import { API_URL } from '@/config/api';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Building2, Plus, Edit2, Trash2, Save, X, MapPin, Phone, User, RefreshCw
} from 'lucide-react';
import CompanyLayout from '@/components/CompanyLayout';


export const CompanyBranchesPage = () => {
  const { token } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    phone: '',
    manager_id: ''
  });

  const headers = { Authorization: `Bearer ${token}` };

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/company/branches`, { headers });
      setBranches(res.data);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBranch) {
        await axios.put(
          `${API_URL}/api/company/branches/${editingBranch.branch_id}`,
          formData,
          { headers }
        );
        toast.success('Succursale mise à jour');
      } else {
        await axios.post(`${API_URL}/api/company/branches`, formData, { headers });
        toast.success('Succursale créée');
      }
      setShowModal(false);
      setEditingBranch(null);
      resetForm();
      fetchBranches();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };

  const handleDelete = async (branchId) => {
    if (!window.confirm('Supprimer cette succursale?')) return;
    try {
      await axios.delete(`${API_URL}/api/company/branches/${branchId}`, { headers });
      toast.success('Succursale supprimée');
      fetchBranches();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      address: '',
      city: '',
      phone: '',
      manager_id: ''
    });
  };

  const openEditModal = (branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      city: branch.city || '',
      phone: branch.phone || '',
      manager_id: branch.manager_id || ''
    });
    setShowModal(true);
  };

  return (
    <CompanyLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl">
              <Building2 className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Succursales</h1>
              <p className="text-slate-400">{branches.length} succursales</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchBranches}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => { resetForm(); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              data-testid="add-branch-btn"
            >
              <Plus className="w-4 h-4" />
              Nouvelle Succursale
            </button>
          </div>
        </div>

        {/* Branch List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map(branch => (
              <div
                key={branch.branch_id}
                className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
                data-testid={`branch-${branch.branch_id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{branch.name}</h3>
                    <span className="text-sm text-blue-400 font-mono">{branch.code}</span>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    branch.status === 'ACTIVE' 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {branch.status}
                  </span>
                </div>

                {branch.address && (
                  <div className="flex items-start gap-2 text-slate-400 text-sm mb-2">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{branch.address}{branch.city && `, ${branch.city}`}</span>
                  </div>
                )}

                {branch.phone && (
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                    <Phone className="w-4 h-4" />
                    <span>{branch.phone}</span>
                  </div>
                )}

                {branch.manager_name && (
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
                    <User className="w-4 h-4" />
                    <span>Manager: {branch.manager_name}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-slate-800">
                  <button
                    onClick={() => openEditModal(branch)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm"
                    data-testid={`edit-${branch.branch_id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(branch.branch_id)}
                    className="px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    data-testid={`delete-${branch.branch_id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {branches.length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-400">
                Aucune succursale. Créez votre première succursale.
              </div>
            )}
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-lg mx-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  {editingBranch ? 'Modifier Succursale' : 'Nouvelle Succursale'}
                </h2>
                <button
                  onClick={() => { setShowModal(false); setEditingBranch(null); }}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Nom *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      required
                      data-testid="branch-name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Code *</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
                      placeholder="BR001"
                      required
                      data-testid="branch-code"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Adresse</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    data-testid="branch-address"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Ville</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      data-testid="branch-city"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Téléphone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      data-testid="branch-phone"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setEditingBranch(null); }}
                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                    data-testid="save-branch-btn"
                  >
                    <Save className="w-4 h-4" />
                    {editingBranch ? 'Mettre à jour' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </CompanyLayout>
  );
};
