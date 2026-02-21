import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import { 
  PlusCircle, 
  Ticket, 
  Trophy, 
  DollarSign, 
  TrendingUp,
  Clock,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AgentDashboardPage = () => {
  const { syncData } = useOutletContext();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [recentTickets, setRecentTickets] = useState([]);
  const [latestResults, setLatestResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch recent tickets
        const ticketsRes = await fetch(`${API_URL}/api/agent/tickets?limit=5`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (ticketsRes.ok) {
          const tickets = await ticketsRes.json();
          setRecentTickets(tickets);
        }

        // Fetch latest results
        const resultsRes = await fetch(`${API_URL}/api/results/latest`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resultsRes.ok) {
          const results = await resultsRes.json();
          setLatestResults(results.slice(0, 5));
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchData();
    }
  }, [token]);

  const stats = syncData?.daily_stats || {};
  const balance = syncData?.balance || {};
  const company = syncData?.company || {};

  const quickActions = [
    { 
      label: 'Nouvelle Vente', 
      icon: PlusCircle, 
      path: '/agent/new-ticket',
      color: 'bg-emerald-600 hover:bg-emerald-700',
      primary: true
    },
    { 
      label: 'Mes Tickets', 
      icon: Ticket, 
      path: '/agent/tickets',
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    { 
      label: 'Résultats', 
      icon: Trophy, 
      path: '/agent/results',
      color: 'bg-amber-600 hover:bg-amber-700'
    },
  ];

  const getStatusBadge = (status) => {
    const styles = {
      'PENDING_RESULT': 'bg-amber-900/50 text-amber-400',
      'WINNER': 'bg-emerald-900/50 text-emerald-400',
      'LOSER': 'bg-slate-700 text-slate-400',
      'VOID': 'bg-red-900/50 text-red-400'
    };
    const labels = {
      'PENDING_RESULT': 'En attente',
      'WINNER': 'Gagnant',
      'LOSER': 'Non gagnant',
      'VOID': 'Annulé'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] || 'bg-slate-700 text-slate-400'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="space-y-6" data-testid="agent-dashboard">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-emerald-900/50 to-slate-800 rounded-xl p-6 border border-emerald-700/30">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Bonjour, {user?.name || 'Agent'}
            </h1>
            <p className="text-slate-400 mt-1">
              {company.name} - Terminal Universel
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Clock size={16} />
            <span>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {quickActions.map((action) => (
          <Button
            key={action.path}
            onClick={() => navigate(action.path)}
            className={`h-20 text-lg font-semibold ${action.color} ${action.primary ? 'ring-2 ring-emerald-400/50' : ''}`}
            data-testid={`action-${action.label.toLowerCase().replace(' ', '-')}`}
          >
            <action.icon size={24} className="mr-3" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Tickets Aujourd'hui</p>
                <p className="text-2xl font-bold text-white">{stats.tickets || 0}</p>
              </div>
              <div className="p-3 bg-blue-900/30 rounded-full">
                <Ticket size={24} className="text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Ventes Aujourd'hui</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {(stats.sales || 0).toLocaleString()} {company.currency || 'HTG'}
                </p>
              </div>
              <div className="p-3 bg-emerald-900/30 rounded-full">
                <DollarSign size={24} className="text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Gains Payés</p>
                <p className="text-2xl font-bold text-amber-400">
                  {(stats.wins || 0).toLocaleString()} {company.currency || 'HTG'}
                </p>
              </div>
              <div className="p-3 bg-amber-900/30 rounded-full">
                <Trophy size={24} className="text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Net</p>
                <p className={`text-2xl font-bold ${(stats.net || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(stats.net || 0).toLocaleString()} {company.currency || 'HTG'}
                </p>
              </div>
              <div className="p-3 bg-slate-700 rounded-full">
                <TrendingUp size={24} className="text-slate-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tickets */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Ticket size={20} className="text-blue-400" />
              Derniers Tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="animate-spin text-slate-400" />
              </div>
            ) : recentTickets.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                <p>Aucun ticket aujourd'hui</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentTickets.map((ticket) => (
                  <div 
                    key={ticket.ticket_id}
                    className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                  >
                    <div>
                      <p className="font-mono text-sm text-white">{ticket.ticket_code}</p>
                      <p className="text-xs text-slate-400">{ticket.lottery_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-400">
                        {ticket.total_amount?.toLocaleString()} {ticket.currency}
                      </p>
                      {getStatusBadge(ticket.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Latest Results */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Trophy size={20} className="text-amber-400" />
              Derniers Résultats
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="animate-spin text-slate-400" />
              </div>
            ) : latestResults.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                <p>Aucun résultat aujourd'hui</p>
              </div>
            ) : (
              <div className="space-y-2">
                {latestResults.map((result, idx) => (
                  <div 
                    key={result.result_id || idx}
                    className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-white">{result.lottery_name}</p>
                      <p className="text-xs text-slate-400">{result.draw_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg text-amber-400 font-bold">
                        {result.winning_numbers}
                      </p>
                      <p className="text-xs text-slate-400">{result.draw_date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AgentDashboardPage;
