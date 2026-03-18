import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/api/auth';
import { AdminLayout } from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Users, Search, Filter, Eye, Ban, CheckCircle, 
  Shield, Wallet, Loader2, RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react';

const SuperOnlinePlayersPage = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    loadPlayers();
  }, [page, statusFilter]);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        skip: page * limit,
        limit: limit
      });
      if (statusFilter) params.append('status', statusFilter);
      if (search) params.append('search', search);

      const response = await fetch(`${API_URL}/api/online-admin/players?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setPlayers(data.players || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to load players:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const loadPlayerDetail = async (playerId) => {
    try {
      const response = await fetch(`${API_URL}/api/online-admin/players/${playerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setSelectedPlayer(data);
    } catch (error) {
      toast.error('Erreur lors du chargement du joueur');
    }
  };

  const updatePlayerStatus = async (playerId, newStatus) => {
    try {
      const response = await fetch(`${API_URL}/api/online-admin/players/${playerId}/status?status=${newStatus}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success(`Statut mis à jour: ${newStatus}`);
        loadPlayers();
        if (selectedPlayer) loadPlayerDetail(playerId);
      } else {
        toast.error('Erreur lors de la mise à jour');
      }
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0);
    loadPlayers();
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending_kyc: { color: 'yellow', text: 'En attente KYC' },
      verified: { color: 'green', text: 'Vérifié' },
      suspended: { color: 'red', text: 'Suspendu' },
      blocked: { color: 'slate', text: 'Bloqué' }
    };
    const badge = badges[status] || { color: 'slate', text: status };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${badge.color}-500/20 text-${badge.color}-400`}>
        {badge.text}
      </span>
    );
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-400" />
              {t('admin.playersManagement')}
            </h1>
            <p className="text-slate-400">Gérez les joueurs de la plateforme LOTO PAM</p>
          </div>
          <button
            onClick={loadPlayers}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-900 border-slate-600 text-white"
              placeholder="Rechercher par email, nom, username..."
            />
          </form>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className="px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
            >
              <option value="">Tous les statuts</option>
              <option value="pending_kyc">En attente KYC</option>
              <option value="verified">Vérifiés</option>
              <option value="suspended">Suspendus</option>
              <option value="blocked">Bloqués</option>
            </select>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Players List */}
          <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
              </div>
            ) : players.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-900/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Joueur</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Statut</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Balance</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {players.map((player) => (
                        <tr
                          key={player.player_id}
                          className={`hover:bg-slate-700/30 cursor-pointer ${
                            selectedPlayer?.player?.player_id === player.player_id ? 'bg-yellow-500/10' : ''
                          }`}
                          onClick={() => loadPlayerDetail(player.player_id)}
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-white">{player.full_name}</p>
                              <p className="text-sm text-slate-400">@{player.username}</p>
                              <p className="text-xs text-slate-500">{player.email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(player.status)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-yellow-400">{player.balance?.toLocaleString() || 0} HTG</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-slate-400 hover:text-white"
                              onClick={(e) => { e.stopPropagation(); loadPlayerDetail(player.player_id); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
                  <span className="text-sm text-slate-400">
                    {page * limit + 1}-{Math.min((page + 1) * limit, total)} sur {total}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="border-slate-600"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage(p => p + 1)}
                      disabled={(page + 1) * limit >= total}
                      className="border-slate-600"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-16 text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucun joueur trouvé</p>
              </div>
            )}
          </div>

          {/* Player Detail */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            {selectedPlayer ? (
              <div className="space-y-6">
                {/* Header */}
                <div className="text-center pb-4 border-b border-slate-700">
                  <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-2xl font-bold text-slate-900">
                    {selectedPlayer.player?.full_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <h3 className="text-lg font-bold text-white">{selectedPlayer.player?.full_name}</h3>
                  <p className="text-slate-400">@{selectedPlayer.player?.username}</p>
                  <div className="mt-2">{getStatusBadge(selectedPlayer.player?.status)}</div>
                </div>

                {/* Info */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Email</span>
                    <span className="text-white">{selectedPlayer.player?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Téléphone</span>
                    <span className="text-white">{selectedPlayer.player?.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Balance</span>
                    <span className="text-yellow-400 font-bold">{selectedPlayer.wallet?.balance?.toLocaleString() || 0} HTG</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Inscrit le</span>
                    <span className="text-white">{new Date(selectedPlayer.player?.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>

                {/* KYC */}
                {selectedPlayer.kyc && (
                  <div className="p-3 bg-slate-900/50 rounded-lg">
                    <p className="text-sm text-slate-400 mb-1">KYC</p>
                    <p className="text-white">{selectedPlayer.kyc.document_type}: {selectedPlayer.kyc.document_number}</p>
                    <p className="text-xs text-slate-500">Statut: {selectedPlayer.kyc.status}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2 pt-4 border-t border-slate-700">
                  <p className="text-sm font-medium text-slate-300 mb-2">Actions</p>
                  {selectedPlayer.player?.status !== 'verified' && (
                    <Button
                      onClick={() => updatePlayerStatus(selectedPlayer.player.player_id, 'verified')}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Vérifier le Compte
                    </Button>
                  )}
                  {selectedPlayer.player?.status !== 'suspended' && (
                    <Button
                      onClick={() => updatePlayerStatus(selectedPlayer.player.player_id, 'suspended')}
                      variant="outline"
                      className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
                    >
                      <Ban className="w-4 h-4 mr-2" />
                      Suspendre
                    </Button>
                  )}
                  {selectedPlayer.player?.status === 'suspended' && (
                    <Button
                      onClick={() => updatePlayerStatus(selectedPlayer.player.player_id, 'pending_kyc')}
                      variant="outline"
                      className="w-full border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                    >
                      Réactiver
                    </Button>
                  )}
                </div>

                {/* Recent Transactions */}
                {selectedPlayer.transactions?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-300 mb-2">Transactions Récentes</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedPlayer.transactions.slice(0, 5).map((txn, i) => (
                        <div key={i} className="flex justify-between text-sm p-2 bg-slate-900/50 rounded">
                          <span className={txn.type.includes('deposit') ? 'text-green-400' : 'text-red-400'}>
                            {txn.type.includes('deposit') ? '+' : '-'}{txn.amount} HTG
                          </span>
                          <span className="text-slate-500">{txn.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Sélectionnez un joueur pour voir les détails</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SuperOnlinePlayersPage;
