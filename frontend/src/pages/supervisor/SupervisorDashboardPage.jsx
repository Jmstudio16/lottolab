import { API_URL } from '@/config/api';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Users, 
  Ticket, 
  TrendingUp,
  AlertCircle,
  RefreshCw,
  UserCheck,
  UserX,
  Edit,
  StopCircle,
  PlayCircle,
  Trash2,
  Eye,
  Search,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';


export const SupervisorDashboardPage = () => {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTicketsModal, setShowTicketsModal] = useState(false);
  const [agentTickets, setAgentTickets] = useState([]);
  const [editForm, setEditForm] = useState({});

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [agentsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/supervisor/agents`, { headers }),
        axios.get(`${API_URL}/api/supervisor/dashboard-stats`, { headers }).catch(() => ({ data: {} }))
      ]);
      
      setAgents(agentsRes.data || []);
      setStats(statsRes.data || {
        total_agents: agentsRes.data?.length || 0,
        active_agents: agentsRes.data?.filter(a => a.status === 'ACTIVE').length || 0,
        suspended_agents: agentsRes.data?.filter(a => a.status !== 'ACTIVE').length || 0,
        tickets_today: 0
      });
    } catch (error) {
      console.error('Dashboard load error:', error);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSuspendAgent = async (agentId) => {
    if (!window.confirm('Voulez-vous suspendre cet agent?')) return;
    
    try {
      await axios.put(`${API_URL}/api/supervisor/agents/${agentId}/suspend`, {}, { headers });
      toast.success('Agent suspendu');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suspension');
    }
  };

  const handleActivateAgent = async (agentId) => {
    try {
      await axios.put(`${API_URL}/api/supervisor/agents/${agentId}/activate`, {}, { headers });
      toast.success('Agent réactivé');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'activation');
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet agent? Cette action est irréversible.')) return;
    
    try {
      await axios.delete(`${API_URL}/api/supervisor/agents/${agentId}`, { headers });
      toast.success('Agent supprimé');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const openEditModal = (agent) => {
    setSelectedAgent(agent);
    setEditForm({
      name: agent.name || '',
      telephone: agent.telephone || '',
      commission_percent: agent.commission_percent || 0  // Default to 0
    });
    setShowEditModal(true);
  };

  const handleUpdateAgent = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/api/supervisor/agents/${selectedAgent.user_id}`, editForm, { headers });
      toast.success('Agent mis à jour');
      setShowEditModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    }
  };

  const viewAgentTickets = async (agent) => {
    setSelectedAgent(agent);
    try {
      const res = await axios.get(`${API_URL}/api/supervisor/agents/${agent.user_id}/tickets`, { headers });
      setAgentTickets(res.data || []);
      setShowTicketsModal(true);
    } catch (error) {
      toast.error('Erreur lors du chargement des tickets');
    }
  };

  const filteredAgents = agents.filter(a => 
    a.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && agents.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="supervisor-dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tableau de Bord Superviseur</h1>
          <p className="text-slate-400">Bienvenue, {user?.name || 'Superviseur'}</p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchData}
          className="border-slate-600 text-slate-300 hover:bg-slate-800"
          disabled={loading}
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{stats?.total_agents || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-900/30 border-emerald-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-emerald-400 flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              Agents Actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-400">{stats?.active_agents || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-red-900/30 border-red-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-400 flex items-center gap-2">
              <UserX className="w-4 h-4" />
              Agents Suspendus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-400">{stats?.suspended_agents || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-900/30 border-blue-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-400 flex items-center gap-2">
              <Ticket className="w-4 h-4" />
              Tickets Aujourd'hui
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-400">{stats?.tickets_today || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <Input
          placeholder="Rechercher un agent..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-slate-800 border-slate-700 text-white"
        />
      </div>

      {/* Agents List */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Mes Agents ({filteredAgents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAgents.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun agent trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="pb-3 font-medium">Nom</th>
                    <th className="pb-3 font-medium hidden sm:table-cell">Email</th>
                    <th className="pb-3 font-medium hidden md:table-cell">Téléphone</th>
                    <th className="pb-3 font-medium">Statut</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredAgents.map(agent => (
                    <tr key={agent.user_id} className="text-slate-300">
                      <td className="py-3 font-medium">{agent.name}</td>
                      <td className="py-3 hidden sm:table-cell text-sm">{agent.email}</td>
                      <td className="py-3 hidden md:table-cell text-sm">{agent.telephone || '-'}</td>
                      <td className="py-3">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          agent.status === 'ACTIVE' 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'bg-red-500/20 text-red-400'
                        )}>
                          {agent.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => viewAgentTickets(agent)}
                            className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded"
                            title="Voir Tickets"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(agent)}
                            className="p-2 text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {agent.status === 'ACTIVE' ? (
                            <button
                              onClick={() => handleSuspendAgent(agent.user_id)}
                              className="p-2 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded"
                              title="Suspendre"
                            >
                              <StopCircle className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivateAgent(agent.user_id)}
                              className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded"
                              title="Réactiver"
                            >
                              <PlayCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteAgent(agent.user_id)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Agent Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Modifier Agent</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateAgent} className="space-y-4">
            <div>
              <Label className="text-slate-400">Nom</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-400">Téléphone</Label>
              <Input
                value={editForm.telephone}
                onChange={(e) => setEditForm({ ...editForm, telephone: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-400">Commission (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={editForm.commission_percent}
                onChange={(e) => setEditForm({ ...editForm, commission_percent: parseFloat(e.target.value) })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)} className="flex-1 border-slate-700">
                Annuler
              </Button>
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tickets Modal */}
      <Dialog open={showTicketsModal} onOpenChange={setShowTicketsModal}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              Tickets de {selectedAgent?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {agentTickets.length === 0 ? (
              <p className="text-center text-slate-400 py-8">Aucun ticket trouvé</p>
            ) : (
              <div className="space-y-2">
                {agentTickets.map(ticket => (
                  <div key={ticket.ticket_id} className="bg-slate-800 p-3 rounded-lg">
                    <div className="flex justify-between">
                      <span className="text-white font-medium">{ticket.ticket_code}</span>
                      <span className="text-slate-400 text-sm">{ticket.created_at?.split('T')[0]}</span>
                    </div>
                    <div className="text-sm text-slate-400 mt-1">
                      {ticket.lottery_name} • {ticket.total_amount} HTG
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupervisorDashboardPage;
