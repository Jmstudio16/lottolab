import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const CompanyLotteriesForAgentsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
          <Settings className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Gestion des Loteries pour Agents</h1>
          <p className="text-slate-400 mb-6">
            Cette fonctionnalité a été déplacée vers la gestion par succursale.
          </p>
          <Button onClick={() => navigate('/company/succursales')} className="bg-emerald-600 hover:bg-emerald-700">
            Aller à la gestion des succursales
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CompanyLotteriesForAgentsPage;
