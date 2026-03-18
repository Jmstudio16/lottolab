import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLotoPamAuth } from '../../context/LotoPamAuthContext';
import LotoPamLayout from '../../layouts/LotoPamLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Wallet, ArrowUpCircle, ArrowDownCircle, Clock, 
  CheckCircle, XCircle, Smartphone, Loader2, AlertTriangle
} from 'lucide-react';

const LotoPamWalletPage = () => {
  const { t } = useTranslation();
  const { player, wallet, refreshWallet, apiClient, isAuthenticated } = useLotoPamAuth();
  const [activeTab, setActiveTab] = useState('deposit');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [depositForm, setDepositForm] = useState({
    amount: '',
    method: 'MonCash',
    reference_code: '',
    sender_phone: ''
  });

  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    method: 'MonCash',
    payout_phone: ''
  });

  useEffect(() => {
    if (isAuthenticated) {
      loadTransactions();
    }
  }, [isAuthenticated]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/online/wallet');
      setTransactions(response.data.recent_transactions || []);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    if (!depositForm.amount || !depositForm.reference_code) {
      toast.error('Ranpli tout chan yo');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/api/online/wallet/deposit', {
        amount: parseFloat(depositForm.amount),
        method: depositForm.method,
        reference_code: depositForm.reference_code,
        sender_phone: depositForm.sender_phone || null
      });
      toast.success('Demann depo soumèt! N ap verifye l.');
      setDepositForm({ amount: '', method: 'MonCash', reference_code: '', sender_phone: '' });
      loadTransactions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erè nan demann depo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (!withdrawForm.amount || !withdrawForm.payout_phone) {
      toast.error('Ranpli tout chan yo');
      return;
    }

    if (player?.status !== 'verified') {
      toast.error('Ou bezwen verifye kont ou (KYC) anvan ou ka fè retrè');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/api/online/wallet/withdraw', {
        amount: parseFloat(withdrawForm.amount),
        method: withdrawForm.method,
        payout_phone: withdrawForm.payout_phone
      });
      toast.success('Demann retrè soumèt!');
      setWithdrawForm({ amount: '', method: 'MonCash', payout_phone: '' });
      loadTransactions();
      refreshWallet();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erè nan demann retrè');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="flex items-center gap-1 text-yellow-400"><Clock className="w-4 h-4" /> An atant</span>;
      case 'approved':
        return <span className="flex items-center gap-1 text-green-400"><CheckCircle className="w-4 h-4" /> Apwouve</span>;
      case 'paid':
        return <span className="flex items-center gap-1 text-green-400"><CheckCircle className="w-4 h-4" /> Peye</span>;
      case 'rejected':
        return <span className="flex items-center gap-1 text-red-400"><XCircle className="w-4 h-4" /> Rejte</span>;
      default:
        return status;
    }
  };

  if (!isAuthenticated) {
    return (
      <LotoPamLayout>
        <div className="max-w-2xl mx-auto py-20 text-center">
          <Wallet className="w-16 h-16 mx-auto mb-4 text-slate-400" />
          <h2 className="text-2xl font-bold text-white mb-4">Konekte pou wè pòtfèy ou</h2>
        </div>
      </LotoPamLayout>
    );
  }

  return (
    <LotoPamLayout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{t('lotopam.wallet')}</h1>
          <div className="inline-flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-2xl">
            <Wallet className="w-8 h-8 text-yellow-400" />
            <div className="text-left">
              <p className="text-sm text-slate-400">Balans Disponib</p>
              <p className="text-3xl font-bold text-yellow-400">{wallet?.balance?.toLocaleString() || 0} HTG</p>
            </div>
          </div>
        </div>

        {/* KYC Warning */}
        {player?.status !== 'verified' && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-yellow-400 font-medium">{t('lotopam.kycRequired')}</p>
              <p className="text-sm text-slate-400">Verifye idantite ou pou ka fè retrè</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('deposit')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'deposit'
                ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                : 'bg-slate-800 border-2 border-slate-700 text-slate-300 hover:border-slate-600'
            }`}
          >
            <ArrowUpCircle className="w-5 h-5" />
            {t('financial.deposit')}
          </button>
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'withdraw'
                ? 'bg-red-500/20 border-2 border-red-500 text-red-400'
                : 'bg-slate-800 border-2 border-slate-700 text-slate-300 hover:border-slate-600'
            }`}
          >
            <ArrowDownCircle className="w-5 h-5" />
            {t('financial.withdraw')}
          </button>
        </div>

        {/* Forms */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            {activeTab === 'deposit' ? (
              <>
                <h2 className="text-xl font-bold text-white mb-4">{t('lotopam.depositInstructions')}</h2>
                
                {/* Payment Instructions */}
                <div className="space-y-4 mb-6">
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Smartphone className="w-5 h-5 text-yellow-400" />
                      <span className="font-bold text-yellow-400">💳 Paiement via MonCash</span>
                    </div>
                    <p className="text-sm text-slate-300">
                      Effectuez votre paiement MonCash au <strong className="text-white">+509 44 77 90 43</strong>, puis saisissez le code de référence reçu par SMS afin de confirmer votre dépôt et créditer votre compte LOTO PAM.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Smartphone className="w-5 h-5 text-green-400" />
                      <span className="font-bold text-green-400">💳 Paiement via NatCash</span>
                    </div>
                    <p className="text-sm text-slate-300">
                      Effectuez votre paiement NatCash au <strong className="text-white">+509 33 45 30 59</strong>, puis saisissez le code de référence reçu par SMS afin de confirmer votre dépôt et créditer votre compte LOTO PAM.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleDeposit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Metòd Peman</label>
                    <select
                      value={depositForm.method}
                      onChange={(e) => setDepositForm({ ...depositForm, method: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white"
                    >
                      <option value="MonCash">MonCash</option>
                      <option value="NatCash">NatCash</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Montan (HTG) *</label>
                    <Input
                      type="number"
                      value={depositForm.amount}
                      onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                      className="bg-slate-900 border-slate-600 text-white h-12"
                      placeholder="1000"
                      min="100"
                      required
                    />
                    <p className="text-xs text-slate-500 mt-1">Minimòm: 100 HTG</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Kòd Referans *</label>
                    <Input
                      type="text"
                      value={depositForm.reference_code}
                      onChange={(e) => setDepositForm({ ...depositForm, reference_code: e.target.value })}
                      className="bg-slate-900 border-slate-600 text-white h-12"
                      placeholder="Ex: MP12345678"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Telefòn Moun ki Voye (opsyonèl)</label>
                    <Input
                      type="tel"
                      value={depositForm.sender_phone}
                      onChange={(e) => setDepositForm({ ...depositForm, sender_phone: e.target.value })}
                      className="bg-slate-900 border-slate-600 text-white h-12"
                      placeholder="+509 XXXX XXXX"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Konfime Depo'}
                  </Button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-white mb-4">{t('lotopam.withdrawInstructions')}</h2>
                
                <div className="p-4 bg-slate-700/50 border border-slate-600 rounded-xl mb-6">
                  <p className="text-slate-300 mb-3">
                    Pour effectuer un retrait, veuillez saisir le montant souhaité et fournir les informations de paiement valides.
                    Après vérification, le montant sera envoyé via le mode de paiement sélectionné dans les meilleurs délais.
                  </p>
                  <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-300">
                      <strong>🔒 Important :</strong> Assurez-vous que vos informations sont correctes et que votre compte est vérifié (KYC) afin d'éviter tout retard.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleWithdraw} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Metòd Peman</label>
                    <select
                      value={withdrawForm.method}
                      onChange={(e) => setWithdrawForm({ ...withdrawForm, method: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white"
                    >
                      <option value="MonCash">MonCash</option>
                      <option value="NatCash">NatCash</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Montan (HTG) *</label>
                    <Input
                      type="number"
                      value={withdrawForm.amount}
                      onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                      className="bg-slate-900 border-slate-600 text-white h-12"
                      placeholder="5000"
                      min="500"
                      max={wallet?.balance || 0}
                      required
                    />
                    <p className="text-xs text-slate-500 mt-1">Minimòm: 500 HTG | Maksimòm: {wallet?.balance?.toLocaleString() || 0} HTG</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Nimewo Telefòn pou Resevwa *</label>
                    <Input
                      type="tel"
                      value={withdrawForm.payout_phone}
                      onChange={(e) => setWithdrawForm({ ...withdrawForm, payout_phone: e.target.value })}
                      className="bg-slate-900 border-slate-600 text-white h-12"
                      placeholder="+509 XXXX XXXX"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting || player?.status !== 'verified'}
                    className="w-full h-12 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Demann Retrè'}
                  </Button>
                </form>
              </>
            )}
          </div>

          {/* Transactions History */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Istwa Tranzaksyon</h2>
            
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-yellow-400 mx-auto" />
              </div>
            ) : transactions.length > 0 ? (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {transactions.map((txn, index) => (
                  <div
                    key={txn.transaction_id || index}
                    className="p-4 bg-slate-900/50 border border-slate-700 rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-medium ${
                        txn.type.includes('deposit') ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {txn.type.includes('deposit') ? '+ ' : '- '}
                        {txn.amount.toLocaleString()} HTG
                      </span>
                      {getStatusBadge(txn.status)}
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-400">
                      <span>{txn.method}</span>
                      <span>{new Date(txn.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Pa gen tranzaksyon ankò</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </LotoPamLayout>
  );
};

export default LotoPamWalletPage;
