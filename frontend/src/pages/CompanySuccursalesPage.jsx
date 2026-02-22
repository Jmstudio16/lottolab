import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Building2, Plus, Edit2, Trash2, Save, X, Users, Eye, 
  RefreshCw, Upload, UserPlus, ChevronRight, Store
} from 'lucide-react';
import CompanyLayout from '@/components/CompanyLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const CompanySuccursalesPage = () => {
  const { token } = useAuth();
  const [succursales, setSuccursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSuccursale, setSelectedSuccursale] = useState(null);
  const [showAgentModal, setShowAgentModal] = useState(false);

  // Form state for creating succursale
  const [formData, setFormData] = useState({
    nom_succursale: '',
    nom_bank: '',
    message: '',
    allow_sub_supervisor: false,
    mariage_gratuit: false,
    supervisor_nom: '',
    supervisor_prenom: '',
    supervisor_pseudo: '',
    supervisor_password: '',
    supervisor_password_confirm: '',
    user_nom: '',
    user_prenom: '',
    user_pseudo: '',
    user_password: '',
    user_password_confirm: ''
  });

  // Form state for creating agent
  const [agentForm, setAgentForm] = useState({
    device_id: '',
    zone_adresse: '',
    nom_agent: '',
    prenom_agent: '',
    telephone: '',
    identifiant: '',
    mot_de_passe: '',
    percent_agent: 0,
    percent_superviseur: 0,
    limite_credit: 50000,
    limite_balance_gain: 100000
  });

  const headers = { Authorization: `Bearer ${token}` };

  const fetchSuccursales = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/company/succursales`, { headers });
      setSuccursales(res.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des succursales');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuccursaleDetail = async (succursaleId) => {
    try {
      const res = await axios.get(`${API_URL}/api/company/succursales/${succursaleId}`, { headers });
      setSelectedSuccursale(res.data);
      setShowDetailModal(true);
    } catch (error) {
      toast.error('Erreur lors du chargement des détails');
    }
  };

  useEffect(() => {
    fetchSuccursales();
  }, []);

  const handleCreateSuccursale = async (e) => {
    e.preventDefault();
    
    if (formData.supervisor_password !== formData.supervisor_password_confirm) {
      toast.error('Les mots de passe du superviseur ne correspondent pas');
      return;
    }
    
    if (formData.user_password && formData.user_password !== formData.user_password_confirm) {
      toast.error('Les mots de passe de l\'utilisateur ne correspondent pas');
      return;
    }
    
    try {
      await axios.post(`${API_URL}/api/company/succursales`, formData, { headers });
      toast.success('Succursale créée avec succès');
      setShowCreateModal(false);
      resetForm();
      fetchSuccursales();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    }
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    
    if (!selectedSuccursale) return;
    
    try {
      await axios.post(
        `${API_URL}/api/company/succursales/${selectedSuccursale.succursale_id}/agents`,
        agentForm,
        { headers }
      );
      toast.success('Agent créé avec succès');
      setShowAgentModal(false);
      resetAgentForm();
      fetchSuccursaleDetail(selectedSuccursale.succursale_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    }
  };

  const handleDeleteSuccursale = async (succursaleId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette succursale?')) return;
    try {
      await axios.delete(`${API_URL}/api/company/succursales/${succursaleId}`, { headers });
      toast.success('Succursale supprimée');
      fetchSuccursales();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet agent?')) return;
    try {
      await axios.delete(
        `${API_URL}/api/company/succursales/${selectedSuccursale.succursale_id}/agents/${agentId}`,
        { headers }
      );
      toast.success('Agent supprimé');
      fetchSuccursaleDetail(selectedSuccursale.succursale_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setFormData({
      nom_succursale: '',
      nom_bank: '',
      message: '',
      allow_sub_supervisor: false,
      mariage_gratuit: false,
      supervisor_nom: '',
      supervisor_prenom: '',
      supervisor_pseudo: '',
      supervisor_password: '',
      supervisor_password_confirm: '',
      user_nom: '',
      user_prenom: '',
      user_pseudo: '',
      user_password: '',
      user_password_confirm: ''
    });
  };

  const resetAgentForm = () => {
    setAgentForm({
      device_id: '',
      zone_adresse: '',
      nom_agent: '',
      prenom_agent: '',
      telephone: '',
      identifiant: '',
      mot_de_passe: '',
      percent_agent: 0,
      percent_superviseur: 0,
      limite_credit: 50000,
      limite_balance_gain: 100000
    });
  };

  return (
    <CompanyLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl">
              <Store className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Succursales</h1>
              <p className="text-slate-400">{succursales.length} succursales</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchSuccursales}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <Button
              onClick={() => { resetForm(); setShowCreateModal(true); }}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="add-succursale-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle Succursale
            </Button>
          </div>
        </div>

        {/* Succursales Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {succursales.filter(s => s.status !== 'DELETED').map(succ => (
              <div
                key={succ.succursale_id}
                className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
                data-testid={`succursale-${succ.succursale_id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{succ.nom_succursale}</h3>
                    <span className="text-sm text-blue-400">{succ.nom_bank}</span>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    succ.status === 'ACTIVE' 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {succ.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Users className="w-4 h-4" />
                    <span>{succ.agent_count || 0} agents</span>
                  </div>
                  {succ.supervisor_name && (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <span className="text-yellow-400">Superviseur:</span>
                      <span>{succ.supervisor_name}</span>
                    </div>
                  )}
                  {succ.mariage_gratuit && (
                    <span className="inline-block px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">
                      Mariage Gratuit
                    </span>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t border-slate-800">
                  <button
                    onClick={() => fetchSuccursaleDetail(succ.succursale_id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors text-sm"
                    data-testid={`view-${succ.succursale_id}`}
                  >
                    <Eye className="w-4 h-4" />
                    Détails
                  </button>
                  <button
                    onClick={() => handleDeleteSuccursale(succ.succursale_id)}
                    className="px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    data-testid={`delete-${succ.succursale_id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {succursales.filter(s => s.status !== 'DELETED').length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-400">
                <Store className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucune succursale. Créez votre première succursale.</p>
              </div>
            )}
          </div>
        )}

        {/* Create Succursale Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-400" />
                Nouvelle Succursale
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateSuccursale} className="space-y-6">
              {/* Options */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300">Possibilité sous-superviseur</Label>
                  <Switch
                    checked={formData.allow_sub_supervisor}
                    onCheckedChange={(checked) => setFormData({...formData, allow_sub_supervisor: checked})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300">Mariage Gratuit</Label>
                  <Switch
                    checked={formData.mariage_gratuit}
                    onCheckedChange={(checked) => setFormData({...formData, mariage_gratuit: checked})}
                  />
                </div>
              </div>

              {/* Superviseur Principal */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider">
                  Superviseur Principal
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Nom Responsable *</Label>
                    <Input
                      value={formData.supervisor_nom}
                      onChange={(e) => setFormData({...formData, supervisor_nom: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white"
                      required
                      data-testid="supervisor-nom"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Prénom Responsable *</Label>
                    <Input
                      value={formData.supervisor_prenom}
                      onChange={(e) => setFormData({...formData, supervisor_prenom: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white"
                      required
                      data-testid="supervisor-prenom"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300">Pseudo (Identifiant) *</Label>
                  <Input
                    value={formData.supervisor_pseudo}
                    onChange={(e) => setFormData({...formData, supervisor_pseudo: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                    required
                    data-testid="supervisor-pseudo"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Mot de passe *</Label>
                    <Input
                      type="password"
                      value={formData.supervisor_password}
                      onChange={(e) => setFormData({...formData, supervisor_password: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white"
                      required
                      data-testid="supervisor-password"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Confirmer mot de passe *</Label>
                    <Input
                      type="password"
                      value={formData.supervisor_password_confirm}
                      onChange={(e) => setFormData({...formData, supervisor_password_confirm: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white"
                      required
                      data-testid="supervisor-password-confirm"
                    />
                  </div>
                </div>
              </div>

              {/* Utilisateur (Optional) */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">
                  Utilisateur (Optionnel)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Nom Utilisateur</Label>
                    <Input
                      value={formData.user_nom}
                      onChange={(e) => setFormData({...formData, user_nom: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white"
                      data-testid="user-nom"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Prénom Utilisateur</Label>
                    <Input
                      value={formData.user_prenom}
                      onChange={(e) => setFormData({...formData, user_prenom: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white"
                      data-testid="user-prenom"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300">Pseudo</Label>
                  <Input
                    value={formData.user_pseudo}
                    onChange={(e) => setFormData({...formData, user_pseudo: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                    data-testid="user-pseudo"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Mot de passe</Label>
                    <Input
                      type="password"
                      value={formData.user_password}
                      onChange={(e) => setFormData({...formData, user_password: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white"
                      data-testid="user-password"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Confirmer mot de passe</Label>
                    <Input
                      type="password"
                      value={formData.user_password_confirm}
                      onChange={(e) => setFormData({...formData, user_password_confirm: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white"
                      data-testid="user-password-confirm"
                    />
                  </div>
                </div>
              </div>

              {/* Succursale Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">
                  Informations Succursale
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Nom Succursale *</Label>
                    <Input
                      value={formData.nom_succursale}
                      onChange={(e) => setFormData({...formData, nom_succursale: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white"
                      required
                      data-testid="nom-succursale"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Nom Bank *</Label>
                    <Input
                      value={formData.nom_bank}
                      onChange={(e) => setFormData({...formData, nom_bank: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white"
                      required
                      data-testid="nom-bank"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300">Message</Label>
                  <Input
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="Message de bienvenue ou note..."
                    data-testid="message"
                  />
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
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  data-testid="save-succursale-btn"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Créer Succursale
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Succursale Detail Modal */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-400" />
                {selectedSuccursale?.nom_succursale}
                <span className="text-sm font-normal text-slate-400 ml-2">
                  ({selectedSuccursale?.nom_bank})
                </span>
              </DialogTitle>
            </DialogHeader>

            {selectedSuccursale && (
              <div className="space-y-6">
                {/* Info */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-800/50 rounded-lg">
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Superviseur</p>
                    <p className="text-white font-medium">{selectedSuccursale.supervisor?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Mariage Gratuit</p>
                    <p className={selectedSuccursale.mariage_gratuit ? 'text-emerald-400' : 'text-slate-500'}>
                      {selectedSuccursale.mariage_gratuit ? 'Oui' : 'Non'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Agents</p>
                    <p className="text-white font-medium">{selectedSuccursale.agents?.length || 0}</p>
                  </div>
                </div>

                {/* Agents List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-400" />
                      Agents
                    </h3>
                    <Button
                      onClick={() => setShowAgentModal(true)}
                      className="bg-emerald-600 hover:bg-emerald-700"
                      data-testid="add-agent-btn"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Créer Agent
                    </Button>
                  </div>

                  <div className="bg-slate-800/30 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Nom</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Device ID</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Zone</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">%Agent</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Limite Crédit</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Statut</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {selectedSuccursale.agents?.map((agent) => (
                          <tr key={agent.user_id} className="hover:bg-slate-800/50">
                            <td className="px-4 py-3 text-white font-medium">{agent.name}</td>
                            <td className="px-4 py-3 text-slate-300 font-mono text-sm">{agent.device_id || 'N/A'}</td>
                            <td className="px-4 py-3 text-slate-400">{agent.zone_adresse || 'N/A'}</td>
                            <td className="px-4 py-3 text-emerald-400">{agent.percent_agent}%</td>
                            <td className="px-4 py-3 text-slate-300">{agent.limite_credit?.toLocaleString()} HTG</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                agent.status === 'ACTIVE' 
                                  ? 'bg-emerald-500/20 text-emerald-400' 
                                  : 'bg-red-500/20 text-red-400'
                              }`}>
                                {agent.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleDeleteAgent(agent.user_id)}
                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded"
                                data-testid={`delete-agent-${agent.user_id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(!selectedSuccursale.agents || selectedSuccursale.agents.length === 0) && (
                          <tr>
                            <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                              Aucun agent dans cette succursale
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Create Agent Modal */}
        <Dialog open={showAgentModal} onOpenChange={setShowAgentModal}>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                Créer Agent
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateAgent} className="space-y-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-400">
                  Succursale: <span className="font-semibold text-white">{selectedSuccursale?.nom_succursale}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">DEVICE ID *</Label>
                  <Input
                    value={agentForm.device_id}
                    onChange={(e) => setAgentForm({...agentForm, device_id: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white font-mono"
                    required
                    data-testid="agent-device-id"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Zone / Adresse</Label>
                  <Input
                    value={agentForm.zone_adresse}
                    onChange={(e) => setAgentForm({...agentForm, zone_adresse: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                    data-testid="agent-zone"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Nom Agent *</Label>
                  <Input
                    value={agentForm.nom_agent}
                    onChange={(e) => setAgentForm({...agentForm, nom_agent: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                    required
                    data-testid="agent-nom"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Prénom Agent *</Label>
                  <Input
                    value={agentForm.prenom_agent}
                    onChange={(e) => setAgentForm({...agentForm, prenom_agent: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                    required
                    data-testid="agent-prenom"
                  />
                </div>
              </div>

              <div>
                <Label className="text-slate-300">Téléphone</Label>
                <Input
                  value={agentForm.telephone}
                  onChange={(e) => setAgentForm({...agentForm, telephone: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="+509-XXXX-XXXX"
                  data-testid="agent-telephone"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Identifiant (Login) *</Label>
                  <Input
                    value={agentForm.identifiant}
                    onChange={(e) => setAgentForm({...agentForm, identifiant: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                    required
                    data-testid="agent-identifiant"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Mot de passe *</Label>
                  <Input
                    type="password"
                    value={agentForm.mot_de_passe}
                    onChange={(e) => setAgentForm({...agentForm, mot_de_passe: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                    required
                    data-testid="agent-password"
                  />
                </div>
              </div>

              {/* Financial Settings */}
              <div className="p-4 bg-slate-800/50 rounded-lg space-y-4">
                <h4 className="text-sm font-semibold text-yellow-400 uppercase">Paramètres Financiers</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">% Agent</Label>
                    <Input
                      type="number"
                      value={agentForm.percent_agent}
                      onChange={(e) => setAgentForm({...agentForm, percent_agent: parseFloat(e.target.value) || 0})}
                      className="bg-slate-800 border-slate-700 text-white"
                      min="0"
                      max="100"
                      step="0.1"
                      data-testid="agent-percent"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">% Superviseur</Label>
                    <Input
                      type="number"
                      value={agentForm.percent_superviseur}
                      onChange={(e) => setAgentForm({...agentForm, percent_superviseur: parseFloat(e.target.value) || 0})}
                      className="bg-slate-800 border-slate-700 text-white"
                      min="0"
                      max="100"
                      step="0.1"
                      data-testid="agent-supervisor-percent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Limite Crédit (HTG)</Label>
                    <Input
                      type="number"
                      value={agentForm.limite_credit}
                      onChange={(e) => setAgentForm({...agentForm, limite_credit: parseFloat(e.target.value) || 0})}
                      className="bg-slate-800 border-slate-700 text-white"
                      min="0"
                      data-testid="agent-credit-limit"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Limite Balance Gain (HTG)</Label>
                    <Input
                      type="number"
                      value={agentForm.limite_balance_gain}
                      onChange={(e) => setAgentForm({...agentForm, limite_balance_gain: parseFloat(e.target.value) || 0})}
                      className="bg-slate-800 border-slate-700 text-white"
                      min="0"
                      data-testid="agent-win-limit"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAgentModal(false)}
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  data-testid="save-agent-btn"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Créer Agent
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </CompanyLayout>
  );
};

export default CompanySuccursalesPage;
