import { API_URL } from '@/config/api';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/AdminLayout';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Building2, User, CreditCard, Settings, Upload, Save, X, 
  Shield, Calendar, Clock, Users, Monitor, DollarSign, 
  Mail, Phone, MapPin, Globe, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


const TIMEZONES = [
  { value: 'America/Port-au-Prince', label: 'Haiti (UTC-5)' },
  { value: 'America/New_York', label: 'New York (UTC-5)' },
  { value: 'America/Chicago', label: 'Chicago (UTC-6)' },
  { value: 'America/Denver', label: 'Denver (UTC-7)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8)' },
  { value: 'Europe/Paris', label: 'Paris (UTC+1)' },
  { value: 'Europe/London', label: 'London (UTC+0)' },
];

const COUNTRIES = [
  { value: 'HT', label: 'Haiti' },
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'FR', label: 'France' },
  { value: 'DO', label: 'Dominican Republic' },
];

const PLANS = [
  { value: 'Basic', label: 'Basic', agents: 5, devices: 10, dailyLimit: 100000 },
  { value: 'Premium', label: 'Premium', agents: 20, devices: 50, dailyLimit: 500000 },
  { value: 'Enterprise', label: 'Enterprise', agents: 100, devices: 500, dailyLimit: 5000000 },
];

export const SuperCreateCompanyPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);

  const [formData, setFormData] = useState({
    // Company Information
    company_name: '',
    company_slug: '',
    company_email: '',
    company_phone: '',
    company_address: '',
    country: 'HT',
    timezone: 'America/Port-au-Prince',
    currency: 'HTG',
    
    // Admin Account
    admin_first_name: '',
    admin_last_name: '',
    admin_email: '',
    admin_password: '',
    admin_confirm_password: '',
    
    // Subscription
    plan: 'Basic',
    activation_date: new Date().toISOString().split('T')[0],
    expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'ACTIVE',
    
    // Limits
    max_agents: 5,
    max_pos_devices: 10,
    max_daily_sales: 100000
  });

  const headers = { Authorization: `Bearer ${token}` };

  // Auto-generate slug from company name
  useEffect(() => {
    if (formData.company_name) {
      const slug = formData.company_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setFormData(prev => ({ ...prev, company_slug: slug }));
    }
  }, [formData.company_name]);

  // Update limits when plan changes
  useEffect(() => {
    const plan = PLANS.find(p => p.value === formData.plan);
    if (plan) {
      setFormData(prev => ({
        ...prev,
        max_agents: plan.agents,
        max_pos_devices: plan.devices,
        max_daily_sales: plan.dailyLimit
      }));
    }
  }, [formData.plan]);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    if (!formData.company_name.trim()) {
      toast.error('Le nom de l\'entreprise est requis');
      return false;
    }
    if (!formData.admin_email.trim()) {
      toast.error('L\'email de l\'administrateur est requis');
      return false;
    }
    if (!formData.admin_password) {
      toast.error('Le mot de passe est requis');
      return false;
    }
    if (formData.admin_password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return false;
    }
    if (formData.admin_password !== formData.admin_confirm_password) {
      toast.error('Les mots de passe ne correspondent pas');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      // Create company with admin
      const companyData = {
        name: formData.company_name,
        slug: formData.company_slug,
        contact_email: formData.company_email,
        contact_phone: formData.company_phone,
        address: formData.company_address,
        country: formData.country,
        timezone: formData.timezone,
        currency: formData.currency,
        plan: formData.plan,
        status: formData.status,
        activation_date: formData.activation_date,
        expiration_date: formData.expiration_date,
        max_agents: formData.max_agents,
        max_pos_devices: formData.max_pos_devices,
        max_daily_sales: formData.max_daily_sales,
        
        // Admin account to create
        admin_name: `${formData.admin_first_name} ${formData.admin_last_name}`.trim(),
        admin_email: formData.admin_email,
        admin_password: formData.admin_password
      };
      
      const response = await axios.post(
        `${API_URL}/api/super/companies/full-create`,
        companyData,
        { headers }
      );
      
      // Upload logo if provided
      if (logoFile && response.data.company_id) {
        const logoFormData = new FormData();
        logoFormData.append('file', logoFile);
        
        await axios.post(
          `${API_URL}/api/super/companies/${response.data.company_id}/logo`,
          logoFormData,
          { headers: { ...headers, 'Content-Type': 'multipart/form-data' } }
        );
      }
      
      toast.success('Entreprise et compte admin créés avec succès!');
      navigate('/super/companies');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout role="SUPER_ADMIN">
      <div className="max-w-5xl mx-auto space-y-6" data-testid="create-company-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Créer une Entreprise</h1>
              <p className="text-slate-400">Création complète avec compte administrateur</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => navigate('/super/companies')}
            className="border-slate-600"
          >
            <X className="w-4 h-4 mr-2" />
            Annuler
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Information */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="flex items-center gap-2 text-white">
                <Building2 className="w-5 h-5 text-blue-400" />
                Informations de l'Entreprise
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Logo Upload */}
                <div className="md:col-span-2">
                  <Label className="text-slate-300 mb-2 block">Logo de l'entreprise</Label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 bg-slate-700 rounded-xl flex items-center justify-center overflow-hidden">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Upload className="w-8 h-8 text-slate-500" />
                      )}
                    </div>
                    <div>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="bg-slate-900 border-slate-600 text-white"
                      />
                      <p className="text-xs text-slate-500 mt-1">PNG, JPG jusqu'à 2MB</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Nom de l'entreprise *</Label>
                  <Input
                    value={formData.company_name}
                    onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                    placeholder="Ex: LotoPam Haiti"
                    className="bg-slate-900 border-slate-600 text-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Slug (URL)</Label>
                  <Input
                    value={formData.company_slug}
                    onChange={(e) => setFormData({...formData, company_slug: e.target.value})}
                    placeholder="lotopam-haiti"
                    className="bg-slate-900 border-slate-600 text-white font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Email
                  </Label>
                  <Input
                    type="email"
                    value={formData.company_email}
                    onChange={(e) => setFormData({...formData, company_email: e.target.value})}
                    placeholder="contact@company.com"
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <Phone className="w-4 h-4" /> Téléphone
                  </Label>
                  <Input
                    value={formData.company_phone}
                    onChange={(e) => setFormData({...formData, company_phone: e.target.value})}
                    placeholder="+509 1234 5678"
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Adresse
                  </Label>
                  <Input
                    value={formData.company_address}
                    onChange={(e) => setFormData({...formData, company_address: e.target.value})}
                    placeholder="123 Rue Principale, Port-au-Prince"
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <Globe className="w-4 h-4" /> Pays
                  </Label>
                  <Select value={formData.country} onValueChange={(v) => setFormData({...formData, country: v})}>
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {COUNTRIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Fuseau Horaire
                  </Label>
                  <Select value={formData.timezone} onValueChange={(v) => setFormData({...formData, timezone: v})}>
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {TIMEZONES.map(tz => (
                        <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Admin Account */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="flex items-center gap-2 text-white">
                <User className="w-5 h-5 text-green-400" />
                Compte Administrateur
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-300">Prénom *</Label>
                  <Input
                    value={formData.admin_first_name}
                    onChange={(e) => setFormData({...formData, admin_first_name: e.target.value})}
                    placeholder="Jean"
                    className="bg-slate-900 border-slate-600 text-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Nom *</Label>
                  <Input
                    value={formData.admin_last_name}
                    onChange={(e) => setFormData({...formData, admin_last_name: e.target.value})}
                    placeholder="Dupont"
                    className="bg-slate-900 border-slate-600 text-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Email Admin *</Label>
                  <Input
                    type="email"
                    value={formData.admin_email}
                    onChange={(e) => setFormData({...formData, admin_email: e.target.value})}
                    placeholder="admin@company.com"
                    className="bg-slate-900 border-slate-600 text-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Mot de passe *</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.admin_password}
                      onChange={(e) => setFormData({...formData, admin_password: e.target.value})}
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

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-slate-300">Confirmer le mot de passe *</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.admin_confirm_password}
                      onChange={(e) => setFormData({...formData, admin_confirm_password: e.target.value})}
                      placeholder="Confirmez le mot de passe"
                      className="bg-slate-900 border-slate-600 text-white pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="flex items-center gap-2 text-white">
                <CreditCard className="w-5 h-5 text-purple-400" />
                Abonnement
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-300">Plan</Label>
                  <Select value={formData.plan} onValueChange={(v) => setFormData({...formData, plan: v})}>
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {PLANS.map(p => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label} ({p.agents} agents, {p.devices} POS)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Date d'activation
                  </Label>
                  <Input
                    type="date"
                    value={formData.activation_date}
                    onChange={(e) => setFormData({...formData, activation_date: e.target.value})}
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Date d'expiration
                  </Label>
                  <Input
                    type="date"
                    value={formData.expiration_date}
                    onChange={(e) => setFormData({...formData, expiration_date: e.target.value})}
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Statut</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="ACTIVE">Actif</SelectItem>
                      <SelectItem value="SUSPENDED">Suspendu</SelectItem>
                      <SelectItem value="TRIAL">Essai</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Limits */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="flex items-center gap-2 text-white">
                <Settings className="w-5 h-5 text-orange-400" />
                Limites
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Max Agents
                  </Label>
                  <Input
                    type="number"
                    value={formData.max_agents}
                    onChange={(e) => setFormData({...formData, max_agents: parseInt(e.target.value) || 0})}
                    className="bg-slate-900 border-slate-600 text-white"
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <Monitor className="w-4 h-4" /> Max POS Devices
                  </Label>
                  <Input
                    type="number"
                    value={formData.max_pos_devices}
                    onChange={(e) => setFormData({...formData, max_pos_devices: parseInt(e.target.value) || 0})}
                    className="bg-slate-900 border-slate-600 text-white"
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Limite Ventes/Jour
                  </Label>
                  <Input
                    type="number"
                    value={formData.max_daily_sales}
                    onChange={(e) => setFormData({...formData, max_daily_sales: parseInt(e.target.value) || 0})}
                    className="bg-slate-900 border-slate-600 text-white"
                    min="0"
                    step="10000"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate('/super/companies')}
              className="border-slate-600"
            >
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              data-testid="submit-company-btn"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Création...
                </span>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  CRÉER L'ENTREPRISE
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};

export default SuperCreateCompanyPage;
