import { API_URL } from '@/config/api';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/api/auth';
import CompanyLayout from '@/components/CompanyLayout';
import { 
  Wallet, Plus, Minus, RefreshCw, Search, User, 
  ArrowUpRight, ArrowDownRight, Clock, DollarSign,
  TrendingUp, TrendingDown, History
} from 'lucide-react';
import { toast } from 'sonner';


const CompanyBalanceManagementPage = () => {
  const { token } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('credit'); // 'credit' or 'debit'
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/company/vendors/balances`, { headers });
      setVendors(response.data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error('Erreur lors du chargement des vendeurs');
    } finally {
      setLoading(false);
    }
  };

  const fetchVendorHistory = async (agentId) => {
    try {
      const response = await axios.get(`${API_URL}/api/company/vendors/${agentId}/balance/history`, { headers });
      setTransactionHistory(response.data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
      setTransactionHistory([]);
    }
  };

  const handleSelectVendor = (vendor) => {
    setSelectedVendor(vendor);
    fetchVendorHistory(vendor.agent_id);
  };

  const openModal = (type) => {
    if (!selectedVendor) {
      toast.error('Sélectionnez un vendeur d\'abord');
      return;
    }
    setModalType(type);
    setAmount('');
    setNotes(type === 'credit' ? 'Dépôt' : 'Retrait');
    setShowModal(true);
  };

  const handleTransaction = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Montant invalide');
      return;
    }

    setProcessing(true);
    try {
      const endpoint = modalType === 'credit' 
        ? `${API_URL}/api/company/vendors/${selectedVendor.agent_id}/balance/credit`
        : `${API_URL}/api/company/vendors/${selectedVendor.agent_id}/balance/debit`;

      const response = await axios.post(
        endpoint,
        null,
        { 
          headers,
          params: { amount: parseFloat(amount), notes }
        }
      );

      toast.success(response.data.message || 'Transaction effectuée');
      setShowModal(false);
      fetchVendors();
      fetchVendorHistory(selectedVendor.agent_id);
      
      // Update selected vendor balance
      setSelectedVendor(prev => ({
        ...prev,
        available_balance: response.data.new_balance
      }));
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Erreur lors de la transaction';
      toast.error(errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  const filteredVendors = vendors.filter(v => 
    v.agent_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.agent_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalBalance = vendors.reduce((sum, v) => sum + (v.available_balance || 0), 0);
  const totalDeposits = vendors.reduce((sum, v) => sum + (v.total_deposits || 0), 0);
  const totalPayouts = vendors.reduce((sum, v) => sum + (v.total_payouts || 0), 0);

  return (
    <CompanyLayout>
      <div className="p-6 space-y-6" data-testid="balance-management-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Wallet className="w-7 h-7 text-emerald-400" />
              Gestion des Soldes
            </h1>
            <p className="text-slate-400 mt-1">Gérez les soldes de vos vendeurs</p>
          </div>
          <button
            onClick={fetchVendors}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-emerald-400 text-sm">Total Soldes</p>
                <p className="text-2xl font-bold text-white">{totalBalance.toLocaleString()} HTG</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-500/10 border border-blue-500/30 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-blue-400 text-sm">Total Dépôts</p>
                <p className="text-2xl font-bold text-white">{totalDeposits.toLocaleString()} HTG</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-amber-600/20 to-amber-500/10 border border-amber-500/30 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-amber-400 text-sm">Total Payouts</p>
                <p className="text-2xl font-bold text-white">{totalPayouts.toLocaleString()} HTG</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Vendors List */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un vendeur..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            
            <div className="max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              ) : filteredVendors.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Aucun vendeur trouvé</p>
                </div>
              ) : (
                filteredVendors.map((vendor) => (
                  <div
                    key={vendor.agent_id}
                    onClick={() => handleSelectVendor(vendor)}
                    className={`p-4 border-b border-slate-800 cursor-pointer transition-colors ${
                      selectedVendor?.agent_id === vendor.agent_id
                        ? 'bg-emerald-500/10 border-l-4 border-l-emerald-500'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{vendor.agent_name}</p>
                          <p className="text-slate-500 text-sm">{vendor.agent_id.slice(0, 15)}...</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${vendor.available_balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {vendor.available_balance?.toLocaleString() || 0} HTG
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Vendor Details & History */}
          <div className="space-y-4">
            {selectedVendor ? (
              <>
                {/* Vendor Info Card */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-white font-semibold text-lg">{selectedVendor.agent_name}</p>
                        <p className="text-slate-500 text-sm">Vendeur</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center py-4 bg-slate-800/50 rounded-xl mb-4">
                    <p className="text-slate-400 text-sm mb-1">Solde Actuel</p>
                    <p className="text-3xl font-bold text-emerald-400">
                      {selectedVendor.available_balance?.toLocaleString() || 0} <span className="text-lg">HTG</span>
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => openModal('credit')}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors"
                      data-testid="credit-button"
                    >
                      <Plus className="w-5 h-5" />
                      Dépôt
                    </button>
                    <button
                      onClick={() => openModal('debit')}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold transition-colors"
                      data-testid="debit-button"
                    >
                      <Minus className="w-5 h-5" />
                      Retrait
                    </button>
                  </div>
                </div>

                {/* Transaction History */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-slate-800 flex items-center gap-2">
                    <History className="w-5 h-5 text-slate-400" />
                    <h3 className="text-white font-semibold">Historique des Transactions</h3>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {transactionHistory.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p>Aucune transaction</p>
                      </div>
                    ) : (
                      transactionHistory.map((txn, idx) => (
                        <div key={txn.transaction_id || idx} className="p-4 border-b border-slate-800/50 hover:bg-slate-800/30">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                txn.amount >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'
                              }`}>
                                {txn.amount >= 0 ? (
                                  <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <ArrowUpRight className="w-4 h-4 text-red-400" />
                                )}
                              </div>
                              <div>
                                <p className="text-white text-sm">{txn.description || txn.type}</p>
                                <p className="text-slate-500 text-xs">
                                  {new Date(txn.created_at).toLocaleString('fr-FR')}
                                </p>
                              </div>
                            </div>
                            <p className={`font-bold ${txn.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {txn.amount >= 0 ? '+' : ''}{txn.amount?.toLocaleString()} HTG
                            </p>
                          </div>
                          {txn.performed_by_name && (
                            <p className="text-slate-500 text-xs mt-1 pl-11">
                              Par: {txn.performed_by_name}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
                <User className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400">Sélectionnez un vendeur pour voir les détails</p>
              </div>
            )}
          </div>
        </div>

        {/* Transaction Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                {modalType === 'credit' ? (
                  <>
                    <Plus className="w-6 h-6 text-emerald-400" />
                    Dépôt pour {selectedVendor?.agent_name}
                  </>
                ) : (
                  <>
                    <Minus className="w-6 h-6 text-red-400" />
                    Retrait pour {selectedVendor?.agent_name}
                  </>
                )}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Montant (HTG)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-xl font-bold focus:outline-none focus:border-emerald-500"
                      data-testid="amount-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-sm mb-2">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Description..."
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleTransaction}
                    disabled={processing || !amount}
                    className={`flex-1 px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                      modalType === 'credit'
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-red-600 hover:bg-red-500 text-white'
                    } disabled:opacity-50`}
                    data-testid="confirm-transaction"
                  >
                    {processing ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        {modalType === 'credit' ? 'Déposer' : 'Retirer'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </CompanyLayout>
  );
};

export default CompanyBalanceManagementPage;
