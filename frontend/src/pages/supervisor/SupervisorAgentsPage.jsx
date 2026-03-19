import { API_URL } from '@/config/api';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Users, UserPlus, Edit, Trash2, StopCircle, PlayCircle, 
  Eye, Search, RefreshCw, Phone, Mail, Percent
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';


export const SupervisorAgentsPage = () => {
  const { token } = useAuth();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    telephone: '',
    password: '',
    commission_percent: 10
  });

  const headers = { Authorization: `Bearer ${token}` };

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/supervisor/agents`, { headers });
      setAgents(res.data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des agents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [token]);

  const handleSuspend = async (agentId) => {
    if (!window.confirm('Suspendre cet agent?')) return;
    try {
      await axios.put(`${API_URL}/api/supervisor/agents/${agentId}/suspend`, {}, { headers });
      toast.success('Agent suspendu');
      fetchAgents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };

  const handleActivate = async (agentId) => {
    try {
      await axios.put(`${API_URL}/api/supervisor/agents/${agentId}/activate`, {}, { headers });
      toast.success('Agent réactivé');
      fetchAgents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };

  const handleDelete = async (agentId) => {
    if (!window.confirm('Supprimer définitivement cet agent?')) return;
    try {
      await axios.delete(`${API_URL}/api/supervisor/agents/${agentId}`, { headers });
      toast.success('Agent supprimé');
      fetchAgents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };

  const filteredAgents = agents.filter(a => 
    a.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-400" />
            Mes Agents
          </h1>
          <p className="text-slate-400">Gérez vos agents vendeurs</p>
        </div>
        <Button onClick={fetchAgents} variant="outline" className="border-slate-700">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          placeholder="Rechercher un agent..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-slate-800 border-slate-700 text-white"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total Agents</p>
          <p className="text-2xl font-bold text-white">{agents.length}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Actifs</p>
          <p className="text-2xl font-bold text-emerald-400">
            {agents.filter(a => a.status === 'ACTIVE').length}
          </p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Suspendus</p>
          <p className="text-2xl font-bold text-red-400">
            {agents.filter(a => a.status === 'SUSPENDED').length}
          </p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Commission Moy.</p>
          <p className="text-2xl font-bold text-amber-400">
            {agents.length > 0 ? Math.round(agents.reduce((sum, a) => sum + (a.commission_percent || 10), 0) / agents.length) : 10}%
          </p>
        </div>
      </div>

      {/* Agents Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Agent</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Contact</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-amber-400 uppercase">Commission</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-4 py-12 text-center">
                    <RefreshCw className="w-8 h-8 mx-auto text-blue-400 animate-spin" />
                  </td>
                </tr>
              ) : filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-12 text-center text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Aucun agent trouvé</p>
                  </td>
                </tr>
              ) : (
                filteredAgents.map((agent) => (
                  <tr key={agent.user_id} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-white">{agent.name || agent.full_name || 'Agent'}</p>
                        <p className="text-xs text-slate-500">{agent.user_id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="text-sm text-slate-300 flex items-center gap-2">
                          <Mail className="w-3 h-3" /> {agent.email}
                        </p>
                        {agent.telephone && (
                          <p className="text-sm text-slate-400 flex items-center gap-2">
                            <Phone className="w-3 h-3" /> {agent.telephone}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-bold">
                        {agent.commission_percent || 10}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        agent.status === 'ACTIVE' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {agent.status === 'ACTIVE' ? 'Actif' : 'Suspendu'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {agent.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleSuspend(agent.user_id)}
                            className="p-2 text-orange-400 hover:bg-orange-500/20 rounded-lg"
                            title="Suspendre"
                          >
                            <StopCircle className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(agent.user_id)}
                            className="p-2 text-emerald-400 hover:bg-emerald-500/20 rounded-lg"
                            title="Réactiver"
                          >
                            <PlayCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(agent.user_id)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SupervisorAgentsPage;
