import { API_URL } from '@/config/api';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/api/auth';
import { AdminLayout } from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  ArrowDownCircle, CheckCircle, XCircle, 
  Loader2, RefreshCw, User, Phone, Calendar, Wallet
} from 'lucide-react';

const SuperOnlineWithdrawalsPage = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const loadWithdrawals = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/online-admin/withdrawals/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setWithdrawals(data.withdrawals || []);
    } catch (error) {
      console.error('Failed to load withdrawals:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const processWithdrawal = async (transactionId, action) => {
    setProcessing(transactionId);
    try {
      let endpoint = action === 'paid' 
        ? `${API_URL}/api/online-admin/withdrawals/process`
        : `${API_URL}/api/online-admin/withdrawals/reject`;

      const body = action === 'paid' 
        ? { transaction_id: transactionId, reference_notes: 'Paiement effectué' }
        : { transaction_id: transactionId, approved: false, notes: 'Rejet administratif' };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        toast.success(action === 'paid' ? 'Retrait marqué comme payé!' : 'Retrait rejeté et remboursé');
        loadWithdrawals();
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
              <ArrowDownCircle className="w-6 h-6 text-red-400" />
              {t('admin.withdrawalsManagement')}
            </h1>
            <p className="text-slate-400">Traitez les demandes de retrait des joueurs</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium">
              {withdrawals.length} en attente
            </span>
            <button
              onClick={loadWithdrawals}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <h3 className="font-bold text-red-400 mb-2">Processus de Paiement</h3>
          <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
            <li>Vérifiez que le joueur a un compte KYC vérifié</li>
            <li>Effectuez le paiement MonCash/NatCash au numéro indiqué</li>
            <li>Cliquez sur "Marquer Payé" UNIQUEMENT après avoir envoyé l'argent</li>
            <li>En cas de problème, "Rejeter" rembourse automatiquement le solde du joueur</li>
          </ol>
        </div>

        {/* Withdrawals List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
          </div>
        ) : withdrawals.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {withdrawals.map((withdrawal) => (
              <div
                key={withdrawal.transaction_id}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4"
              >
                {/* Amount */}
                <div className="text-center pb-4 border-b border-slate-700">
                  <p className="text-4xl font-bold text-red-400">{withdrawal.amount?.toLocaleString()}</p>
                  <p className="text-slate-400">HTG à payer</p>
                </div>

                {/* Player Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-300">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>{withdrawal.player?.full_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <span>{withdrawal.player?.email}</span>
                  </div>
                </div>

                {/* Payout Details */}
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-400 font-medium mb-2">Envoyer le paiement à:</p>
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-yellow-400" />
                    <span className="text-xl font-bold text-white">{withdrawal.payout_phone}</span>
                  </div>
                  <p className="text-sm text-slate-400 mt-2">via {withdrawal.method}</p>
                </div>

                {/* Date */}
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Calendar className="w-4 h-4" />
                  {new Date(withdrawal.created_at).toLocaleString('fr-FR')}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => processWithdrawal(withdrawal.transaction_id, 'paid')}
                    disabled={processing === withdrawal.transaction_id}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {processing === withdrawal.transaction_id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Marquer Payé
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => processWithdrawal(withdrawal.transaction_id, 'reject')}
                    disabled={processing === withdrawal.transaction_id}
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
            <Wallet className="w-16 h-16 mx-auto mb-4 text-green-400 opacity-50" />
            <h3 className="text-xl font-bold text-white mb-2">Aucun retrait en attente</h3>
            <p className="text-slate-400">Tous les retraits ont été traités</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default SuperOnlineWithdrawalsPage;
