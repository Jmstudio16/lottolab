import { API_URL } from '@/config/api';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Building2, Plus, Trash2, Save, Users, Eye, 
  RefreshCw, UserPlus, Store, Mail, Phone, User, Lock, Edit, PlayCircle, StopCircle, Settings, Percent, Smartphone
} from 'lucide-react';
import CompanyLayout from '@/components/CompanyLayout';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';


export const CompanySuccursalesPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [succursales, setSuccursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSuccursale, setSelectedSuccursale] = useState(null);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showEditAgentModal, setShowEditAgentModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [creating, setCreating] = useState(false);

  // NEW Form state - EMAIL BASED (no pseudo/identifiant)
  const [formData, setFormData] = useState({
    // Section 1 - Superviseur
    supervisor_nom: '',
    supervisor_prenom: '',
    supervisor_email: '',  // EMAIL replaces pseudo
    supervisor_telephone: '',  // REQUIRED
    supervisor_password: '',
    supervisor_password_confirm: '',
    supervisor_commission_percent: 10,  // Pourcentage superviseur sur ventes agents
    // Section 2 - Paramètres
    allow_sub_supervisor: false,
    superviseur_principal: true,
    mariage_gratuit: false,
    nom_succursale: '',
    nom_bank: '',
    message: ''
  });

  // NEW Agent form - EMAIL BASED
  const [agentForm, setAgentForm] = useState({
    nom_agent: '',
    prenom_agent: '',
    email: '',  // EMAIL replaces identifiant
    telephone: '',
    password: '',
    password_confirm: '',
    commission_percent: 0,
    limite_credit: 50000,
    limite_gain: 100000,
    status: 'ACTIVE',
    pos_serial_number: ''  // POS Serial Number - unique identifier
  });

  const [posCheckStatus, setPosCheckStatus] = useState({ checking: false, valid: null, message: '' });

  const headers = { Authorization: `Bearer ${token}` };

  const fetchSuccursales = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/company/succursales`, { headers });
      setSuccursales(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du chargement');
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
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    
    if (!formData.supervisor_email) {
      toast.error('Email superviseur requis');
      return;
    }
    
    try {
      setCreating(true);
      await axios.post(`${API_URL}/api/company/succursales`, formData, { headers });
      toast.success('Succursale créée avec succès');
      setShowCreateModal(false);
      resetForm();
      fetchSuccursales();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    
    if (!selectedSuccursale) return;
    
    if (agentForm.password !== agentForm.password_confirm) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    
    if (!agentForm.email) {
      toast.error('Email agent requis');
      return;
    }
    
    // Check if POS serial is valid (if provided)
    if (agentForm.pos_serial_number && posCheckStatus.valid === false) {
      toast.error('Ce numéro de série POS est déjà utilisé');
      return;
    }
    
    try {
      setCreating(true);
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
    } finally {
      setCreating(false);
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

  const handleSuspendAgent = async (agentId) => {
    try {
      await axios.put(
        `${API_URL}/api/company/succursales/${selectedSuccursale.succursale_id}/agents/${agentId}/suspend`,
        {},
        { headers }
      );
      toast.success('Agent suspendu');
      fetchSuccursaleDetail(selectedSuccursale.succursale_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };

  const handleActivateAgent = async (agentId) => {
    try {
      await axios.put(
        `${API_URL}/api/company/succursales/${selectedSuccursale.succursale_id}/agents/${agentId}/activate`,
        {},
        { headers }
      );
      toast.success('Agent réactivé');
      fetchSuccursaleDetail(selectedSuccursale.succursale_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };

  // Check if POS serial number is available
  const checkPosSerialAvailable = async (serialNumber) => {
    if (!serialNumber || serialNumber.trim() === '') {
      setPosCheckStatus({ checking: false, valid: null, message: '' });
      return;
    }
    
    setPosCheckStatus({ checking: true, valid: null, message: 'Vérification...' });
    
    try {
      const res = await axios.get(
        `${API_URL}/api/company/check-pos-serial/${encodeURIComponent(serialNumber.trim())}`,
        { headers }
      );
      setPosCheckStatus({ 
        checking: false, 
        valid: res.data.available, 
        message: res.data.available ? 'Numéro disponible' : 'Numéro déjà utilisé'
      });
    } catch (error) {
      console.error('POS serial check error:', error);
      setPosCheckStatus({ 
        checking: false, 
        valid: null, 
        message: 'Erreur de vérification - réessayez'
      });
    }
  };

  // Debounced POS check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (agentForm.pos_serial_number) {
        checkPosSerialAvailable(agentForm.pos_serial_number);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [agentForm.pos_serial_number]);

  const openEditAgentModal = (agent) => {
    setEditingAgent({
      user_id: agent.user_id,
      nom_agent: agent.name?.split(' ')[0] || '',
      prenom_agent: agent.name?.split(' ').slice(1).join(' ') || '',
      email: agent.email || '',
      telephone: agent.telephone || '',
      commission_percent: agent.commission_percent || 0,
      limite_credit: agent.limite_credit || 50000,
      limite_gain: agent.limite_gain || 100000,
      status: agent.status || 'ACTIVE',
      pos_serial_number: agent.pos_serial_number || ''
    });
    setShowEditAgentModal(true);
  };

  const handleUpdateAgent = async (e) => {
    e.preventDefault();
    if (!editingAgent) return;
    
    try {
      setCreating(true);
      await axios.put(
        `${API_URL}/api/company/succursales/${selectedSuccursale.succursale_id}/agents/${editingAgent.user_id}`,
        {
          nom_agent: editingAgent.nom_agent,
          prenom_agent: editingAgent.prenom_agent,
          telephone: editingAgent.telephone,
          commission_percent: editingAgent.commission_percent,
          limite_credit: editingAgent.limite_credit,
          limite_gain: editingAgent.limite_gain
        },
        { headers }
      );
      toast.success('Agent mis à jour');
      setShowEditAgentModal(false);
      setEditingAgent(null);
      fetchSuccursaleDetail(selectedSuccursale.succursale_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setFormData({
      supervisor_nom: '',
      supervisor_prenom: '',
      supervisor_email: '',
      supervisor_telephone: '',
      supervisor_password: '',
      supervisor_password_confirm: '',
      allow_sub_supervisor: false,
      superviseur_principal: true,
      mariage_gratuit: false,
      nom_succursale: '',
      nom_bank: '',
      message: ''
    });
  };

  const resetAgentForm = () => {
    setAgentForm({
      nom_agent: '',
      prenom_agent: '',
      email: '',
      telephone: '',
      password: '',
      password_confirm: '',
      commission_percent: 0,
      limite_credit: 50000,
      limite_gain: 100000,
      status: 'ACTIVE',
      pos_serial_number: ''
    });
    setPosCheckStatus({ checking: false, valid: null, message: '' });
  };

  // Suspend entire succursale
  const handleSuspendSuccursale = async (succursaleId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir suspendre cette succursale? Tous les superviseurs et agents seront bloqués.')) return;
    try {
      const res = await axios.put(
        `${API_URL}/api/company/succursales/${succursaleId}/suspend`,
        {},
        { headers }
      );
      toast.success(`Succursale suspendue. ${res.data.agents_suspended || 0} agent(s) affectés.`);
      fetchSuccursales();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suspension');
    }
  };

  // Reactivate succursale
  const handleActivateSuccursale = async (succursaleId) => {
    if (!window.confirm('Réactiver cette succursale et tous ses utilisateurs?')) return;
    try {
      const res = await axios.put(
        `${API_URL}/api/company/succursales/${succursaleId}/activate`,
        {},
        { headers }
      );
      toast.success(`Succursale réactivée. ${res.data.agents_activated || 0} agent(s) réactivés.`);
      fetchSuccursales();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la réactivation');
    }
  };

  // Edit Succursale state
  const [showEditSuccursaleModal, setShowEditSuccursaleModal] = useState(false);
  const [editSuccursaleForm, setEditSuccursaleForm] = useState({
    nom_succursale: '',
    nom_bank: '',
    message: ''
  });
  const [editingSuccursaleId, setEditingSuccursaleId] = useState(null);

  const openEditSuccursaleModal = (succ) => {
    setEditingSuccursaleId(succ.succursale_id);
    setEditSuccursaleForm({
      nom_succursale: succ.nom_succursale || '',
      nom_bank: succ.nom_bank || '',
      message: succ.message || ''
    });
    setShowEditSuccursaleModal(true);
  };

  const handleUpdateSuccursale = async (e) => {
    e.preventDefault();
    if (!editingSuccursaleId) return;
    
    try {
      setCreating(true);
      await axios.put(
        `${API_URL}/api/company/succursales/${editingSuccursaleId}`,
        editSuccursaleForm,
        { headers }
      );
      toast.success('Succursale mise à jour');
      setShowEditSuccursaleModal(false);
      setEditingSuccursaleId(null);
      fetchSuccursales();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    } finally {
      setCreating(false);
    }
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
            {succursales.map(succ => (
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
                  {succ.supervisor_email && (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <Mail className="w-4 h-4 text-yellow-400" />
                      <span className="truncate">{succ.supervisor_email}</span>
                    </div>
                  )}
                  {succ.supervisor_name && (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <User className="w-4 h-4" />
                      <span>{succ.supervisor_name}</span>
                    </div>
                  )}
                  {succ.mariage_gratuit && (
                    <span className="inline-block px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">
                      Mariage Gratuit
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800">
                  <button
                    onClick={() => fetchSuccursaleDetail(succ.succursale_id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors text-sm"
                    data-testid={`view-${succ.succursale_id}`}
                  >
                    <Eye className="w-4 h-4" />
                    Détails
                  </button>
                  <button
                    onClick={() => openEditSuccursaleModal(succ)}
                    className="px-3 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 rounded-lg transition-colors"
                    title="Modifier la succursale"
                    data-testid={`edit-succursale-${succ.succursale_id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => navigate(`/company/branches/${succ.succursale_id}/lotteries`)}
                    className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg transition-colors"
                    title="Gérer les loteries"
                    data-testid={`lotteries-${succ.succursale_id}`}
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  {succ.status === 'ACTIVE' ? (
                    <button
                      onClick={() => handleSuspendSuccursale(succ.succursale_id)}
                      className="px-3 py-2 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 rounded-lg transition-colors"
                      title="Suspendre la succursale"
                      data-testid={`suspend-succursale-${succ.succursale_id}`}
                    >
                      <StopCircle className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleActivateSuccursale(succ.succursale_id)}
                      className="px-3 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg transition-colors"
                      title="Réactiver la succursale"
                      data-testid={`activate-succursale-${succ.succursale_id}`}
                    >
                      <PlayCircle className="w-4 h-4" />
                    </button>
                  )}
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

            {succursales.length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-400">
                <Store className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucune succursale. Créez votre première succursale.</p>
              </div>
            )}
          </div>
        )}

        {/* Create Succursale Modal - NEW FORM WITH EMAIL */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-400" />
                Nouvelle Succursale
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateSuccursale} className="space-y-6">
              {/* SECTION 1 - SUPERVISEUR */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Superviseur
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-400" />
                      Email (Login) *
                    </Label>
                    <Input
                      type="email"
                      value={formData.supervisor_email}
                      onChange={(e) => setFormData({...formData, supervisor_email: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white"
                      placeholder="superviseur@email.com"
                      required
                      data-testid="supervisor-email"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-green-400" />
                      Téléphone *
                    </Label>
                    <Input
                      value={formData.supervisor_telephone}
                      onChange={(e) => setFormData({...formData, supervisor_telephone: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white"
                      placeholder="+509-XXXX-XXXX"
                      required
                      data-testid="supervisor-telephone"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300 flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Mot de passe *
                    </Label>
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

                {/* Pourcentage Commission Superviseur */}
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <Label className="text-amber-300 flex items-center gap-2 mb-2">
                    <Percent className="w-4 h-4" />
                    Pourcentage Commission Superviseur
                  </Label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      value={formData.supervisor_commission_percent}
                      onChange={(e) => setFormData({...formData, supervisor_commission_percent: parseFloat(e.target.value) || 0})}
                      className="w-24 bg-slate-800 border-slate-700 text-white"
                      min="0"
                      max="100"
                      step="0.5"
                      data-testid="supervisor-commission-percent"
                    />
                    <span className="text-amber-300">%</span>
                    <span className="text-xs text-slate-400">
                      Le superviseur reçoit ce pourcentage sur toutes les ventes de ses agents
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 2 - PARAMÈTRES */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Paramètres Succursale
                </h3>
                
                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">Sous-superviseur</Label>
                    <Switch
                      checked={formData.allow_sub_supervisor}
                      onCheckedChange={(checked) => setFormData({...formData, allow_sub_supervisor: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">Principal</Label>
                    <Switch
                      checked={formData.superviseur_principal}
                      onCheckedChange={(checked) => setFormData({...formData, superviseur_principal: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">Mariage Gratuit</Label>
                    <Switch
                      checked={formData.mariage_gratuit}
                      onCheckedChange={(checked) => setFormData({...formData, mariage_gratuit: checked})}
                    />
                  </div>
                </div>

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
                    placeholder="Message de bienvenue..."
                    data-testid="message"
                  />
                </div>
              </div>

              {/* Info Box */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-400">
                  Le superviseur utilisera son <strong>email</strong> pour se connecter.
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
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={creating}
                  data-testid="save-succursale-btn"
                >
                  {creating ? 'Création...' : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Créer Succursale
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Succursale Modal */}
        <Dialog open={showEditSuccursaleModal} onOpenChange={setShowEditSuccursaleModal}>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-yellow-400" />
                Modifier Succursale
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleUpdateSuccursale} className="space-y-4">
              <div>
                <Label className="text-slate-300">Nom de la Succursale *</Label>
                <Input
                  value={editSuccursaleForm.nom_succursale}
                  onChange={(e) => setEditSuccursaleForm({...editSuccursaleForm, nom_succursale: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                  required
                  data-testid="edit-nom-succursale"
                />
              </div>

              <div>
                <Label className="text-slate-300">Nom de la Banque</Label>
                <Input
                  value={editSuccursaleForm.nom_bank}
                  onChange={(e) => setEditSuccursaleForm({...editSuccursaleForm, nom_bank: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                  data-testid="edit-nom-bank"
                />
              </div>

              <div>
                <Label className="text-slate-300">Message</Label>
                <Input
                  value={editSuccursaleForm.message}
                  onChange={(e) => setEditSuccursaleForm({...editSuccursaleForm, message: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                  placeholder="Message personnalisé (optionnel)"
                  data-testid="edit-message"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditSuccursaleModal(false)}
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                  disabled={creating}
                  data-testid="update-succursale-btn"
                >
                  {creating ? 'Mise à jour...' : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Enregistrer
                    </>
                  )}
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
                <div className="grid grid-cols-4 gap-4 p-4 bg-slate-800/50 rounded-lg">
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Superviseur</p>
                    <p className="text-white font-medium">{selectedSuccursale.supervisor?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Email</p>
                    <p className="text-blue-400 font-medium text-sm truncate">{selectedSuccursale.supervisor_email || 'N/A'}</p>
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
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Téléphone</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Commission</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Statut</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {selectedSuccursale.agents?.map((agent) => (
                          <tr key={agent.user_id} className="hover:bg-slate-800/50">
                            <td className="px-4 py-3 text-white font-medium">{agent.name}</td>
                            <td className="px-4 py-3 text-blue-400 text-sm">{agent.email}</td>
                            <td className="px-4 py-3 text-slate-300">{agent.telephone || 'N/A'}</td>
                            <td className="px-4 py-3 text-emerald-400">{agent.commission_percent || 0}%</td>
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
                              <div className="flex items-center justify-end gap-1">
                                {/* Edit Button */}
                                <button
                                  onClick={() => openEditAgentModal(agent)}
                                  className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded"
                                  title="Modifier"
                                  data-testid={`edit-agent-${agent.user_id}`}
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                
                                {/* Suspend/Activate Button */}
                                {agent.status === 'ACTIVE' ? (
                                  <button
                                    onClick={() => handleSuspendAgent(agent.user_id)}
                                    className="p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 rounded"
                                    title="Suspendre"
                                    data-testid={`suspend-agent-${agent.user_id}`}
                                  >
                                    <StopCircle className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleActivateAgent(agent.user_id)}
                                    className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded"
                                    title="Réactiver"
                                    data-testid={`activate-agent-${agent.user_id}`}
                                  >
                                    <PlayCircle className="w-4 h-4" />
                                  </button>
                                )}
                                
                                {/* Delete Button */}
                                <button
                                  onClick={() => handleDeleteAgent(agent.user_id)}
                                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded"
                                  title="Supprimer"
                                  data-testid={`delete-agent-${agent.user_id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {(!selectedSuccursale.agents || selectedSuccursale.agents.length === 0) && (
                          <tr>
                            <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
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

        {/* Create Agent Modal - NEW FORM WITH EMAIL */}
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
                <Label className="text-slate-300 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-400" />
                  Email (Login) *
                </Label>
                <Input
                  type="email"
                  value={agentForm.email}
                  onChange={(e) => setAgentForm({...agentForm, email: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="agent@email.com"
                  required
                  data-testid="agent-email"
                />
              </div>

              <div>
                <Label className="text-slate-300 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-green-400" />
                  Téléphone
                </Label>
                <Input
                  value={agentForm.telephone}
                  onChange={(e) => setAgentForm({...agentForm, telephone: e.target.value})}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="+509-XXXX-XXXX"
                  data-testid="agent-telephone"
                />
              </div>

              {/* POS Serial Number */}
              <div>
                <Label className="text-slate-300 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  Numéro de série POS
                </Label>
                <div className="relative">
                  <Input
                    value={agentForm.pos_serial_number}
                    onChange={(e) => setAgentForm({...agentForm, pos_serial_number: e.target.value.toUpperCase()})}
                    className={`bg-slate-800 border-slate-700 text-white pr-24 ${
                      posCheckStatus.valid === false ? 'border-red-500' : 
                      posCheckStatus.valid === true ? 'border-emerald-500' : ''
                    }`}
                    placeholder="POS-XXXX"
                    data-testid="agent-pos-serial"
                  />
                  {posCheckStatus.message && (
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${
                      posCheckStatus.valid ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {posCheckStatus.message}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Ce numéro unique identifie l'appareil POS de l'agent</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300 flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Mot de passe *
                  </Label>
                  <Input
                    type="password"
                    value={agentForm.password}
                    onChange={(e) => setAgentForm({...agentForm, password: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                    required
                    data-testid="agent-password"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Confirmer *</Label>
                  <Input
                    type="password"
                    value={agentForm.password_confirm}
                    onChange={(e) => setAgentForm({...agentForm, password_confirm: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white"
                    required
                    data-testid="agent-password-confirm"
                  />
                </div>
              </div>

              {/* Financial Settings */}
              <div className="p-4 bg-slate-800/50 rounded-lg space-y-4">
                <h4 className="text-sm font-semibold text-yellow-400 uppercase">Paramètres Financiers</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-slate-300">% Commission</Label>
                    <Input
                      type="number"
                      value={agentForm.commission_percent}
                      onChange={(e) => setAgentForm({...agentForm, commission_percent: parseFloat(e.target.value) || 0})}
                      className="bg-slate-800 border-slate-700 text-white"
                      min="0"
                      max="100"
                      step="0.5"
                      data-testid="agent-commission"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Limite Crédit</Label>
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
                    <Label className="text-slate-300">Limite Gain</Label>
                    <Input
                      type="number"
                      value={agentForm.limite_gain}
                      onChange={(e) => setAgentForm({...agentForm, limite_gain: parseFloat(e.target.value) || 0})}
                      className="bg-slate-800 border-slate-700 text-white"
                      min="0"
                      data-testid="agent-win-limit"
                    />
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <p className="text-sm text-emerald-400">
                  L'agent utilisera son <strong>email</strong> pour se connecter.
                </p>
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
                  disabled={creating}
                  data-testid="save-agent-btn"
                >
                  {creating ? 'Création...' : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Créer Agent
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Agent Modal */}
        <Dialog open={showEditAgentModal} onOpenChange={setShowEditAgentModal}>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-400" />
                Modifier Agent
              </DialogTitle>
            </DialogHeader>

            {editingAgent && (
              <form onSubmit={handleUpdateAgent} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-slate-400 text-sm">Nom</Label>
                    <Input
                      value={editingAgent.nom_agent}
                      onChange={(e) => setEditingAgent({...editingAgent, nom_agent: e.target.value})}
                      placeholder="Nom"
                      className="bg-slate-800 border-slate-700 text-white"
                      data-testid="edit-agent-nom"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-sm">Prénom</Label>
                    <Input
                      value={editingAgent.prenom_agent}
                      onChange={(e) => setEditingAgent({...editingAgent, prenom_agent: e.target.value})}
                      placeholder="Prénom"
                      className="bg-slate-800 border-slate-700 text-white"
                      data-testid="edit-agent-prenom"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-slate-400 text-sm">Email (lecture seule)</Label>
                  <Input
                    value={editingAgent.email}
                    disabled
                    className="bg-slate-800/50 border-slate-700 text-slate-500"
                  />
                </div>

                <div>
                  <Label className="text-slate-400 text-sm">Téléphone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <Input
                      value={editingAgent.telephone}
                      onChange={(e) => setEditingAgent({...editingAgent, telephone: e.target.value})}
                      placeholder="Téléphone"
                      className="bg-slate-800 border-slate-700 text-white pl-10"
                      data-testid="edit-agent-telephone"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-slate-400 text-sm">Commission %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={editingAgent.commission_percent}
                      onChange={(e) => setEditingAgent({...editingAgent, commission_percent: parseFloat(e.target.value) || 0})}
                      className="bg-slate-800 border-slate-700 text-white"
                      data-testid="edit-agent-commission"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-sm">Limite Crédit</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editingAgent.limite_credit}
                      onChange={(e) => setEditingAgent({...editingAgent, limite_credit: parseFloat(e.target.value) || 0})}
                      className="bg-slate-800 border-slate-700 text-white"
                      data-testid="edit-agent-credit"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-sm">Limite Gain</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editingAgent.limite_gain}
                      onChange={(e) => setEditingAgent({...editingAgent, limite_gain: parseFloat(e.target.value) || 0})}
                      className="bg-slate-800 border-slate-700 text-white"
                      data-testid="edit-agent-gain"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowEditAgentModal(false); setEditingAgent(null); }}
                    className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    disabled={creating}
                    data-testid="update-agent-btn"
                  >
                    {creating ? 'Mise à jour...' : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Mettre à jour
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </CompanyLayout>
  );
};

export default CompanySuccursalesPage;
