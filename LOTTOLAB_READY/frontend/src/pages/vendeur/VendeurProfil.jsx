import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/api/auth';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  User, Mail, Building2, MapPin, LogOut, Key, Shield,
  Phone, Camera, Upload, RefreshCw, Percent, Monitor, UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const VendeurProfil = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/api/vendeur/profile`, { headers });
        setProfile(res.data);
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast.error('Erreur lors du chargement du profil');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 2MB');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await axios.post(`${API_URL}/api/vendeur/profile/photo`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Photo mise à jour');
      setProfile(prev => ({
        ...prev,
        vendeur: { ...prev.vendeur, photo_url: res.data.photo_url }
      }));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du téléchargement');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  const vendeur = profile?.vendeur || {};
  const company = profile?.company || {};
  const succursale = profile?.succursale || {};
  const supervisor = profile?.supervisor || {};
  const device = profile?.device || {};

  return (
    <div className="p-6 pb-24 lg:pb-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <User className="w-7 h-7 text-purple-400" />
          Mon Profil
        </h1>
        <p className="text-slate-400">Informations de votre compte vendeur</p>
      </div>

      {/* Profile Card with Photo */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-start gap-6 mb-6">
          {/* Photo Upload */}
          <div className="relative">
            <div 
              className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center overflow-hidden cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              {vendeur.photo_url ? (
                <img 
                  src={`${API_URL}${vendeur.photo_url}`} 
                  alt="Photo de profil" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl font-bold text-white">
                  {vendeur.name?.charAt(0) || 'V'}
                </span>
              )}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-black/70 rounded-full flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>

          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">{vendeur.name || 'Vendeur'}</h2>
            <p className="text-slate-400">{vendeur.email}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">
                <Shield className="w-3 h-3" />
                {vendeur.status === 'ACTIVE' ? 'Actif' : 'Inactif'}
              </span>
              {vendeur.commission_rate > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded-full">
                  <Percent className="w-3 h-3" />
                  Commission: {vendeur.commission_rate}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Compagnie */}
          <div className="p-4 bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-3 text-slate-400 mb-1">
              <Building2 className="w-4 h-4" />
              <span className="text-sm">Compagnie</span>
            </div>
            <p className="text-white font-medium">{company.name || '-'}</p>
          </div>

          {/* Succursale */}
          <div className="p-4 bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-3 text-slate-400 mb-1">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">Succursale</span>
            </div>
            <p className="text-white font-medium">{succursale.name || '-'}</p>
          </div>

          {/* Superviseur */}
          <div className="p-4 bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-3 text-slate-400 mb-1">
              <UserCheck className="w-4 h-4" />
              <span className="text-sm">Superviseur</span>
            </div>
            <p className="text-white font-medium">{supervisor.name || '-'}</p>
            {supervisor.telephone && (
              <p className="text-xs text-slate-500 mt-1">{supervisor.telephone}</p>
            )}
          </div>

          {/* ID Vendeur */}
          <div className="p-4 bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-3 text-slate-400 mb-1">
              <User className="w-4 h-4" />
              <span className="text-sm">ID Vendeur</span>
            </div>
            <p className="text-white font-mono text-sm">{vendeur.user_id || '-'}</p>
          </div>

          {/* Device ID */}
          <div className="p-4 bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-3 text-slate-400 mb-1">
              <Monitor className="w-4 h-4" />
              <span className="text-sm">ID Appareil / POS</span>
            </div>
            <p className="text-white font-mono text-sm">
              {device.pos_serial_number || device.device_id || 'NON ASSIGNÉ'}
            </p>
            {device.device_name && (
              <p className="text-xs text-slate-500 mt-1">{device.device_name}</p>
            )}
          </div>

          {/* Téléphone */}
          <div className="p-4 bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-3 text-slate-400 mb-1">
              <Phone className="w-4 h-4" />
              <span className="text-sm">Téléphone</span>
            </div>
            <p className="text-white font-medium">{vendeur.telephone || '-'}</p>
          </div>

          {/* Email */}
          <div className="p-4 bg-slate-700/30 rounded-lg col-span-2">
            <div className="flex items-center gap-3 text-slate-400 mb-1">
              <Mail className="w-4 h-4" />
              <span className="text-sm">Email</span>
            </div>
            <p className="text-white font-medium">{vendeur.email || '-'}</p>
          </div>
        </div>
      </div>

      {/* Commission Info - Only show if configured */}
      {vendeur.commission_rate > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Percent className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-amber-300">Votre taux de commission</p>
              <p className="text-2xl font-bold text-amber-400">{vendeur.commission_rate}%</p>
              <p className="text-xs text-amber-300/70 mt-1">
                Sur chaque vente, vous gagnez {vendeur.commission_rate}% du montant
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-700"
        >
          <Key className="w-4 h-4 mr-3" />
          Modifier mon mot de passe
        </Button>

        <Button
          onClick={handleLogout}
          variant="destructive"
          className="w-full justify-start bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30"
        >
          <LogOut className="w-4 h-4 mr-3" />
          Déconnexion
        </Button>
      </div>
    </div>
  );
};

export default VendeurProfil;
