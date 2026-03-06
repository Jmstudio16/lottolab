import React from 'react';
import { useAuth } from '@/api/auth';
import { useNavigate } from 'react-router-dom';
import { 
  User, Mail, Building2, MapPin, LogOut, Key, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const VendeurProfil = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="p-6 pb-24 lg:pb-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <User className="w-7 h-7 text-purple-400" />
          Mon Profil
        </h1>
        <p className="text-slate-400">Informations de votre compte</p>
      </div>

      {/* Profile Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
            <span className="text-3xl font-bold text-white">
              {user?.full_name?.charAt(0) || 'V'}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{user?.full_name || 'Vendeur'}</h2>
            <p className="text-slate-400">{user?.email}</p>
            <span className="inline-flex items-center gap-1 px-2 py-1 mt-2 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">
              <Shield className="w-3 h-3" />
              Vendeur Actif
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-3 text-slate-400 mb-1">
              <Mail className="w-4 h-4" />
              <span className="text-sm">Email</span>
            </div>
            <p className="text-white font-medium">{user?.email || '-'}</p>
          </div>

          <div className="p-4 bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-3 text-slate-400 mb-1">
              <Building2 className="w-4 h-4" />
              <span className="text-sm">Compagnie</span>
            </div>
            <p className="text-white font-medium">{user?.company_name || '-'}</p>
          </div>

          <div className="p-4 bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-3 text-slate-400 mb-1">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">Succursale</span>
            </div>
            <p className="text-white font-medium">{user?.succursale_name || '-'}</p>
          </div>

          <div className="p-4 bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-3 text-slate-400 mb-1">
              <User className="w-4 h-4" />
              <span className="text-sm">ID Vendeur</span>
            </div>
            <p className="text-white font-mono text-sm">{user?.user_id || '-'}</p>
          </div>
        </div>
      </div>

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
