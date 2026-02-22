import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/api/auth';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  ArrowUpCircle, CheckCircle, XCircle, Clock, 
  Loader2, RefreshCw, User, Phone, Calendar
} from 'lucide-react';

const SuperOnlineDepositsPage = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    loadDeposits();
  }, []);

  const loadDeposits = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/online-admin/deposits/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setDeposits(data.deposits || []);
    } catch (error) {
      console.error('Failed to load deposits:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const processDeposit = async (transactionId, approved, notes = '') => {
    setProcessing(transactionId);
    try {
      const response = await fetch(`${API_URL}/api/online-admin/deposits/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          transaction_id: transactionId,
          approved: approved,
          notes: notes
        })
      });

      if (response.ok) {
        toast.success(approved ? 'Dépôt approuvé!' : 'Dépôt rejeté');
        loadDeposits();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Erreur lors du traitement');
      }
    } catch (error) {
      toast.error('Erreur lors du traitement');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ArrowUpCircle className="w-6 h-6 text-green-400" />
              {t('admin.depositsManagement')}
            </h1>
            <p className="text-slate-400">Approuvez ou rejetez les demandes de dépôt</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">
              {deposits.length} en attente
            </span>
            <button
              onClick={loadDeposits}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <h3 className="font-bold text-green-400 mb-2">Instructions de Vérification</h3>
          <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
            <li>Vérifiez le code de référence MonCash/NatCash avec votre historique de transactions</li>
            <li>Confirmez que le montant correspond exactement</li>
            <li>Approuvez seulement après avoir vérifié la réception réelle des fonds</li>
          </ol>
        </div>

        {/* Deposits List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
          </div>
        ) : deposits.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deposits.map((deposit) => (
              <div
                key={deposit.transaction_id}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4"
              >
                {/* Amount */}
                <div className="text-center pb-4 border-b border-slate-700">
                  <p className="text-4xl font-bold text-green-400">{deposit.amount?.toLocaleString()}</p>
                  <p className="text-slate-400">HTG</p>
                </div>

                {/* Player Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-300">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>{deposit.player?.full_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <span>@{deposit.player?.username}</span>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="p-3 bg-slate-900/50 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Méthode</span>
                    <span className="text-white font-medium">{deposit.method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Code Ref.</span>
                    <span className="text-yellow-400 font-mono">{deposit.reference_code}</span>
                  </div>
                  {deposit.sender_phone && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tél. Envoyeur</span>
                      <span className="text-white">{deposit.sender_phone}</span>
                    </div>
                  )}
                </div>

                {/* Date */}
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Calendar className="w-4 h-4" />
                  {new Date(deposit.created_at).toLocaleString('fr-FR')}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => processDeposit(deposit.transaction_id, true)}
                    disabled={processing === deposit.transaction_id}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {processing === deposit.transaction_id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approuver
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => processDeposit(deposit.transaction_id, false, 'Code référence invalide')}
                    disabled={processing === deposit.transaction_id}
                    variant="outline"
                    className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Rejeter
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400 opacity-50" />
            <h3 className="text-xl font-bold text-white mb-2">Aucun dépôt en attente</h3>
            <p className="text-slate-400">Tous les dépôts ont été traités</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default SuperOnlineDepositsPage;
