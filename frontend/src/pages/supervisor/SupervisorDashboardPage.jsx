import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import axios from 'axios';
import { 
  Users, 
  Ticket, 
  TrendingUp,
  AlertCircle,
  RefreshCw,
  UserCheck,
  UserX
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const SupervisorDashboardPage = () => {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch agents managed by this supervisor
      const agentsRes = await axios.get(`${API_URL}/api/supervisor/agents`, { headers }).catch(() => ({ data: [] }));
      const agentsData = agentsRes.data || [];
      setAgents(agentsData);
      
      // Calculate stats
      const activeAgents = agentsData.filter(a => a.status === 'ACTIVE').length;
      const suspendedAgents = agentsData.filter(a => a.status === 'SUSPENDED').length;
      
      setStats({
        totalAgents: agentsData.length,
        activeAgents,
        suspendedAgents,
        ticketsToday: 0  // Will be fetched separately
      });
      
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="supervisor-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tableau de Bord</h1>
          <p className="text-slate-400">Bienvenue, {user?.name || 'Superviseur'}</p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchData}
          className="border-slate-600 text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{stats?.totalAgents || 0}</p>
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
            <p className="text-3xl font-bold text-emerald-400">{stats?.activeAgents || 0}</p>
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
            <p className="text-3xl font-bold text-red-400">{stats?.suspendedAgents || 0}</p>
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
            <p className="text-3xl font-bold text-blue-400">{stats?.ticketsToday || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Agents List */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Mes Agents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun agent assigné</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="pb-3 font-medium">Nom</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Ventes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {agents.map(agent => (
                    <tr key={agent.user_id} className="text-slate-300">
                      <td className="py-3">{agent.name}</td>
                      <td className="py-3">{agent.email}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          agent.status === 'ACTIVE' 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {agent.status}
                        </span>
                      </td>
                      <td className="py-3">{agent.sales_today || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SupervisorDashboardPage;
