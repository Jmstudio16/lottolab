import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { toast } from 'sonner';
import { 
  UserPlus, User, Phone, Mail, MapPin, Monitor, CreditCard,
  Shield, Percent, Save, X, Eye, EyeOff, Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEVICE_TYPES = [
  { value: 'POS', label: 'POS Terminal' },
  { value: 'MOBILE', label: 'Mobile Phone' },
  { value: 'TABLET', label: 'Tablet' },
  { value: 'PC', label: 'Computer' },
];

export const CompanyCreateAgentPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [branches, setBranches] = useState([]);

  const [formData, setFormData] = useState({
    // Agent Info
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    
    // Device Info
    imei: '',
    device_name: '',
    device_type: 'MOBILE',
    
    // Permissions
    credit_limit: 50000,
    winning_limit: 100000,
    commission_percent: 5,
    can_cancel_tickets: true,
    can_pay_winners: true,
    can_reprint_tickets: true,
    
    // Assignment
    branch_id: '',
    status: 'ACTIVE'
  });

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const response = await apiClient.get('/company/branches');
      setBranches(response.data || []);
    } catch (error) {
      // Branches might not exist
    }
  };

  const validateForm = () => {
    if (!formData.first_name.trim()) {
      toast.error('Le prénom est requis');
      return false;
    }
    if (!formData.last_name.trim()) {
      toast.error('Le nom est requis');
      return false;
    }
    if (!formData.email.trim()) {
      toast.error('L\'email est requis');
      return false;
    }
    if (!formData.password || formData.password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const agentData = {
        name: `${formData.first_name} ${formData.last_name}`.trim(),
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        address: formData.address,
        status: formData.status,
        
        // Device info (if IMEI provided, create device)
        imei: formData.imei || null,
        device_name: formData.device_name || `${formData.first_name}'s Device`,
        device_type: formData.device_type,
        
        // Permissions in policy
        credit_limit: formData.credit_limit,
        winning_limit: formData.winning_limit,
        commission_percent: formData.commission_percent,
        can_cancel_tickets: formData.can_cancel_tickets,
        can_pay_winners: formData.can_pay_winners,
        can_reprint_tickets: formData.can_reprint_tickets,
        
        // Branch
        branch_id: formData.branch_id || null
      };
      
      await apiClient.post('/company/agents/full-create', agentData);
      toast.success('Agent créé avec succès!');
      navigate('/company/agents');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout role="COMPANY_ADMIN">
      <div className="max-w-4xl mx-auto space-y-6" data-testid="create-agent-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
              <UserPlus className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Créer un Agent</h1>
              <p className="text-slate-400">Nouvel agent POS avec appareil et permissions</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => navigate('/company/agents')}
            className="border-slate-600"
          >
            <X className="w-4 h-4 mr-2" />
            Annuler
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Agent Information */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="flex items-center gap-2 text-white">
                <User className="w-5 h-5 text-green-400" />
                Informations de l'Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-300">Prénom *</Label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    placeholder="Jean"
                    className="bg-slate-900 border-slate-600 text-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Nom *</Label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    placeholder="Baptiste"
                    className="bg-slate-900 border-slate-600 text-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Email *
                  </Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="agent@company.com"
                    className="bg-slate-900 border-slate-600 text-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Mot de passe *</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      placeholder="Minimum 6 caractères"
                      className="bg-slate-900 border-slate-600 text-white pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <Phone className="w-4 h-4" /> Téléphone
                  </Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="+509 1234 5678"
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Adresse
                  </Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="123 Rue Principale"
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Device Information */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="flex items-center gap-2 text-white">
                <Monitor className="w-5 h-5 text-blue-400" />
                Appareil
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-300">IMEI (optionnel)</Label>
                  <Input
                    value={formData.imei}
                    onChange={(e) => setFormData({...formData, imei: e.target.value})}
                    placeholder="123456789012345"
                    className="bg-slate-900 border-slate-600 text-white font-mono"
                  />
                  <p className="text-xs text-slate-500">Laisser vide pour accès universel</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Nom de l'appareil</Label>
                  <Input
                    value={formData.device_name}
                    onChange={(e) => setFormData({...formData, device_name: e.target.value})}
                    placeholder="POS Bureau Principal"
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Type d'appareil</Label>
                  <Select value={formData.device_type} onValueChange={(v) => setFormData({...formData, device_type: v})}>
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {DEVICE_TYPES.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Permissions */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="flex items-center gap-2 text-white">
                <Shield className="w-5 h-5 text-purple-400" />
                Permissions et Limites
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> Limite de Crédit (HTG)
                  </Label>
                  <Input
                    type="number"
                    value={formData.credit_limit}
                    onChange={(e) => setFormData({...formData, credit_limit: parseInt(e.target.value) || 0})}
                    className="bg-slate-900 border-slate-600 text-white"
                    min="0"
                    step="1000"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Limite de Gain (HTG)</Label>
                  <Input
                    type="number"
                    value={formData.winning_limit}
                    onChange={(e) => setFormData({...formData, winning_limit: parseInt(e.target.value) || 0})}
                    className="bg-slate-900 border-slate-600 text-white"
                    min="0"
                    step="1000"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <Percent className="w-4 h-4" /> Commission (%)
                  </Label>
                  <Input
                    type="number"
                    value={formData.commission_percent}
                    onChange={(e) => setFormData({...formData, commission_percent: parseFloat(e.target.value) || 0})}
                    className="bg-slate-900 border-slate-600 text-white"
                    min="0"
                    max="100"
                    step="0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                  <div>
                    <Label className="text-white">Annuler Tickets</Label>
                    <p className="text-xs text-slate-500">Peut annuler des tickets</p>
                  </div>
                  <Switch
                    checked={formData.can_cancel_tickets}
                    onCheckedChange={(checked) => setFormData({...formData, can_cancel_tickets: checked})}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                  <div>
                    <Label className="text-white">Payer Gagnants</Label>
                    <p className="text-xs text-slate-500">Peut effectuer des paiements</p>
                  </div>
                  <Switch
                    checked={formData.can_pay_winners}
                    onCheckedChange={(checked) => setFormData({...formData, can_pay_winners: checked})}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                  <div>
                    <Label className="text-white">Réimprimer Tickets</Label>
                    <p className="text-xs text-slate-500">Peut réimprimer</p>
                  </div>
                  <Switch
                    checked={formData.can_reprint_tickets}
                    onCheckedChange={(checked) => setFormData({...formData, can_reprint_tickets: checked})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Branch & Status */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="flex items-center gap-2 text-white">
                <Building2 className="w-5 h-5 text-orange-400" />
                Affectation
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {branches.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-slate-300">Succursale</Label>
                    <Select value={formData.branch_id} onValueChange={(v) => setFormData({...formData, branch_id: v})}>
                      <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                        <SelectValue placeholder="Aucune succursale" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="">Aucune</SelectItem>
                        {branches.map(b => (
                          <SelectItem key={b.branch_id} value={b.branch_id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-slate-300">Statut</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="ACTIVE">Actif</SelectItem>
                      <SelectItem value="SUSPENDED">Suspendu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate('/company/agents')}
              className="border-slate-600"
            >
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              data-testid="submit-agent-btn"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Création...
                </span>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  CRÉER L'AGENT
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};

export default CompanyCreateAgentPage;
