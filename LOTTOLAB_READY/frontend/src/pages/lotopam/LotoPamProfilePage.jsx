import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLotoPamAuth } from '../../context/LotoPamAuthContext';
import LotoPamLayout from '../../layouts/LotoPamLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  User, Mail, Phone, Shield, LogOut, 
  Edit2, Save, X, Loader2, Calendar,
  CheckCircle, AlertTriangle, Wallet, Ticket
} from 'lucide-react';

const LotoPamProfilePage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { player, wallet, logout, apiClient, isAuthenticated } = useLotoPamAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: player?.full_name || '',
    phone: player?.phone || ''
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/api/online/me', {
        full_name: form.full_name,
        phone: form.phone
      });
      toast.success('Profil mis à jour');
      setEditing(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/lotopam');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'verified':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Vérifié
          </span>
        );
      case 'pending_kyc':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            En attente KYC
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-slate-500/20 text-slate-400 rounded-full text-sm font-medium">
            {status}
          </span>
        );
    }
  };

  if (!isAuthenticated) {
    return (
      <LotoPamLayout>
        <div className="max-w-2xl mx-auto py-20 text-center px-4">
          <User className="w-20 h-20 mx-auto mb-6 text-yellow-400 opacity-50" />
          <h2 className="text-3xl font-bold text-white mb-4">Connectez-vous pour voir votre profil</h2>
          <Link
            to="/lotopam/login"
            className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-slate-900 font-bold rounded-xl hover:shadow-xl transition-all inline-block"
          >
            Se Connecter
          </Link>
        </div>
      </LotoPamLayout>
    );
  }

  return (
    <LotoPamLayout>
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-4xl font-bold text-slate-900 shadow-xl shadow-yellow-500/20">
            {player?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <h1 className="text-2xl font-bold text-white">{player?.full_name}</h1>
          <p className="text-slate-400">@{player?.username}</p>
          <div className="mt-3">
            {getStatusBadge(player?.status)}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
            <Wallet className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
            <p className="text-2xl font-bold text-white">{wallet?.balance?.toLocaleString() || 0}</p>
            <p className="text-sm text-slate-400">HTG Balance</p>
          </div>
          <Link
            to="/lotopam/my-tickets"
            className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center hover:border-yellow-500/50 transition-colors"
          >
            <Ticket className="w-8 h-8 mx-auto mb-2 text-purple-400" />
            <p className="text-2xl font-bold text-white">--</p>
            <p className="text-sm text-slate-400">Mes Tickets</p>
          </Link>
        </div>

        {/* Profile Info */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Informations du Profil</h2>
            {!editing ? (
              <Button
                onClick={() => setEditing(true)}
                variant="outline"
                size="sm"
                className="border-slate-600 text-slate-300"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Modifier
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setEditing(false)}
                  variant="ghost"
                  size="sm"
                  className="text-slate-400"
                >
                  <X className="w-4 h-4 mr-1" />
                  Annuler
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  size="sm"
                  className="bg-yellow-500 hover:bg-yellow-600 text-slate-900"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Enregistrer
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                <User className="w-4 h-4" />
                Nom Complet
              </label>
              {editing ? (
                <Input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="bg-slate-900 border-slate-600 text-white"
                />
              ) : (
                <p className="text-white font-medium">{player?.full_name}</p>
              )}
            </div>

            {/* Username */}
            <div>
              <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                <span className="text-yellow-400">@</span>
                Nom d'Utilisateur
              </label>
              <p className="text-white font-medium">{player?.username}</p>
              <p className="text-xs text-slate-500">Ne peut pas être modifié</p>
            </div>

            {/* Email */}
            <div>
              <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                <Mail className="w-4 h-4" />
                Email
              </label>
              <p className="text-white font-medium">{player?.email}</p>
              <p className="text-xs text-slate-500">Ne peut pas être modifié</p>
            </div>

            {/* Phone */}
            <div>
              <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                <Phone className="w-4 h-4" />
                Téléphone
              </label>
              {editing ? (
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="bg-slate-900 border-slate-600 text-white"
                />
              ) : (
                <p className="text-white font-medium">{player?.phone}</p>
              )}
            </div>

            {/* Member Since */}
            <div>
              <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                <Calendar className="w-4 h-4" />
                Membre Depuis
              </label>
              <p className="text-white font-medium">
                {player?.created_at 
                  ? new Date(player.created_at).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : '--'
                }
              </p>
            </div>
          </div>
        </div>

        {/* KYC Section */}
        {player?.status !== 'verified' && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <Shield className="w-8 h-8 text-yellow-400 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-1">Vérifiez votre identité</h3>
                <p className="text-slate-400 mb-4">
                  Complétez la vérification KYC pour débloquer les retraits et augmenter vos limites.
                </p>
                <Link
                  to="/lotopam/kyc"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 text-slate-900 font-bold rounded-lg hover:bg-yellow-400 transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  Commencer la Vérification
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-red-500/10 border border-red-500/30 text-red-400 font-medium rounded-xl hover:bg-red-500/20 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Se Déconnecter
        </button>
      </div>
    </LotoPamLayout>
  );
};

export default LotoPamProfilePage;
