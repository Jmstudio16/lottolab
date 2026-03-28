import React, { useState, useEffect } from 'react';
import { useAuth } from '@/api/auth';
import { AdminLayout } from '@/components/AdminLayout';
import axios from 'axios';
import { toast } from 'sonner';
import { API_URL } from '@/config/api';
import { 
  Shield, AlertTriangle, Lock, Eye, RefreshCw, Search,
  CheckCircle, XCircle, Clock, Filter, Download, Ban,
  Activity, Users, Unlock, AlertOctagon, FileWarning
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * SecurityDashboardPage - Complete security monitoring for admins
 * Features: Audit logs, login attempts, fraud alerts, IP blacklist
 */
const SecurityDashboardPage = () => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loginAttempts, setLoginAttempts] = useState([]);
  const [fraudAlerts, setFraudAlerts] = useState([]);
  const [loginBlocks, setLoginBlocks] = useState([]);
  const [ipBlacklist, setIpBlacklist] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [auditFilter, setAuditFilter] = useState({ action: '', severity: '' });
  
  const headers = { Authorization: `Bearer ${token}` };
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, logsRes, alertsRes] = await Promise.all([
        axios.get(`${API_URL}/api/security/stats`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/security/audit-logs?limit=50`, { headers }).catch(() => ({ data: { logs: [] } })),
        axios.get(`${API_URL}/api/security/fraud-alerts`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setStats(statsRes.data);
      setAuditLogs(logsRes.data?.logs || []);
      setFraudAlerts(alertsRes.data || []);
      
      // Super Admin only data
      if (isSuperAdmin) {
        const [attemptsRes, blocksRes, blacklistRes] = await Promise.all([
          axios.get(`${API_URL}/api/security/login-attempts?limit=100`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/api/security/login-blocks`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/api/security/ip-blacklist`, { headers }).catch(() => ({ data: [] }))
        ]);
        
        setLoginAttempts(attemptsRes.data || []);
        setLoginBlocks(blocksRes.data || []);
        setIpBlacklist(blacklistRes.data || []);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleUnblock = async (email, ip) => {
    try {
      await axios.post(`${API_URL}/api/security/login-blocks/remove`, {
        email,
        ip_address: ip
      }, { headers });
      toast.success('Blocage supprimé');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleResolveAlert = async (alertId, status) => {
    const notes = window.prompt('Notes de résolution:');
    if (!notes) return;
    
    try {
      await axios.put(`${API_URL}/api/security/fraud-alerts/${alertId}/resolve`, {
        status,
        resolution_notes: notes
      }, { headers });
      toast.success('Alerte résolue');
      fetchData();
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'INFO': 'text-blue-400 bg-blue-500/20',
      'WARNING': 'text-amber-400 bg-amber-500/20',
      'CRITICAL': 'text-red-400 bg-red-500/20',
      'FRAUD': 'text-rose-400 bg-rose-500/20'
    };
    return colors[severity] || 'text-slate-400 bg-slate-500/20';
  };

  const getActionIcon = (action) => {
    if (action.includes('LOGIN')) return <Lock className="w-4 h-4" />;
    if (action.includes('TICKET')) return <Activity className="w-4 h-4" />;
    if (action.includes('PAYOUT')) return <CheckCircle className="w-4 h-4" />;
    if (action.includes('FRAUD')) return <AlertTriangle className="w-4 h-4" />;
    if (action.includes('USER')) return <Users className="w-4 h-4" />;
    return <Eye className="w-4 h-4" />;
  };

  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: Shield },
    { id: 'audit', label: 'Audit Trail', icon: Activity },
    { id: 'alerts', label: 'Alertes Fraude', icon: AlertTriangle },
    ...(isSuperAdmin ? [
      { id: 'logins', label: 'Tentatives Login', icon: Lock },
      { id: 'blocks', label: 'Blocages', icon: Ban },
      { id: 'blacklist', label: 'Liste Noire', icon: AlertOctagon }
    ] : [])
  ];

  return (
    <AdminLayout role={user?.role}>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-xl">
              <Shield className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Sécurité & Anti-Fraude</h1>
              <p className="text-slate-400">Surveillance en temps réel</p>
            </div>
          </div>
          
          <Button onClick={fetchData} variant="outline" className="border-slate-600">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-emerald-900/30 border border-emerald-700/30 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                  <div>
                    <p className="text-2xl font-bold text-emerald-400">{stats.today?.successful_logins || 0}</p>
                    <p className="text-sm text-slate-400">Connexions OK</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-red-900/30 border border-red-700/30 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <XCircle className="w-8 h-8 text-red-400" />
                  <div>
                    <p className="text-2xl font-bold text-red-400">{stats.today?.failed_logins || 0}</p>
                    <p className="text-sm text-slate-400">Échecs Login</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-amber-900/30 border border-amber-700/30 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-8 h-8 text-amber-400" />
                  <div>
                    <p className="text-2xl font-bold text-amber-400">{stats.alerts?.open_fraud_alerts || 0}</p>
                    <p className="text-sm text-slate-400">Alertes Ouvertes</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-purple-900/30 border border-purple-700/30 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Ban className="w-8 h-8 text-purple-400" />
                  <div>
                    <p className="text-2xl font-bold text-purple-400">{stats.today?.active_blocks || 0}</p>
                    <p className="text-sm text-slate-400">Blocages Actifs</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Critical Events */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-red-400" />
                Événements Critiques Récents
              </h3>
              
              <div className="space-y-2">
                {auditLogs.filter(l => l.severity === 'CRITICAL' || l.severity === 'FRAUD').slice(0, 5).map((log, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-red-900/20 border border-red-800/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getActionIcon(log.action)}
                      <div>
                        <p className="text-white font-medium">{log.action}</p>
                        <p className="text-sm text-slate-400">{log.client_ip} - {log.user_id}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(log.severity)}`}>
                      {log.severity}
                    </span>
                  </div>
                ))}
                
                {auditLogs.filter(l => l.severity === 'CRITICAL' || l.severity === 'FRAUD').length === 0 && (
                  <p className="text-center text-slate-500 py-4">Aucun événement critique</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Audit Trail Tab */}
        {activeTab === 'audit' && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex flex-wrap gap-4">
              <select
                value={auditFilter.severity}
                onChange={(e) => setAuditFilter({...auditFilter, severity: e.target.value})}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
              >
                <option value="">Toutes sévérités</option>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="FRAUD">FRAUD</option>
              </select>
            </div>
            
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="text-left text-slate-400 text-sm">
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Utilisateur</th>
                    <th className="px-4 py-3">IP</th>
                    <th className="px-4 py-3">Sévérité</th>
                    <th className="px-4 py-3">Détails</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs
                    .filter(l => !auditFilter.severity || l.severity === auditFilter.severity)
                    .map((log, idx) => (
                    <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {new Date(log.timestamp).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getActionIcon(log.action)}
                          <span className="text-white">{log.action}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{log.user_id?.slice(0, 15)}...</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-400">{log.client_ip}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(log.severity)}`}>
                          {log.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">
                        {JSON.stringify(log.details || {})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Fraud Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            {fraudAlerts.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
                <CheckCircle className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
                <p className="text-xl text-white">Aucune alerte de fraude</p>
                <p className="text-slate-400">Le système est sécurisé</p>
              </div>
            ) : (
              fraudAlerts.map((alert) => (
                <div 
                  key={alert.alert_id}
                  className={`bg-slate-900/50 border rounded-xl p-4 ${
                    alert.status === 'OPEN' ? 'border-amber-500/50' : 'border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`w-6 h-6 mt-1 ${
                        alert.severity === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'
                      }`} />
                      <div>
                        <h3 className="text-white font-medium">{alert.alert_type}</h3>
                        <p className="text-slate-400 text-sm">{alert.description}</p>
                        <p className="text-slate-500 text-xs mt-1">
                          {alert.entity_type}: {alert.entity_id} - {new Date(alert.created_at).toLocaleString('fr-FR')}
                        </p>
                      </div>
                    </div>
                    
                    {alert.status === 'OPEN' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveAlert(alert.alert_id, 'RESOLVED')}
                          className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20"
                        >
                          Résoudre
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveAlert(alert.alert_id, 'DISMISSED')}
                          className="border-slate-600 text-slate-400"
                        >
                          Ignorer
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Login Attempts Tab (Super Admin) */}
        {activeTab === 'logins' && isSuperAdmin && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="text-left text-slate-400 text-sm">
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">IP</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">User Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {loginAttempts.map((attempt, idx) => (
                    <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {new Date(attempt.timestamp).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-white">{attempt.email}</td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-400">{attempt.ip_address}</td>
                      <td className="px-4 py-3">
                        {attempt.success ? (
                          <span className="px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400">
                            Succès
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">
                            Échec
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                        {attempt.user_agent}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Active Blocks Tab (Super Admin) */}
        {activeTab === 'blocks' && isSuperAdmin && (
          <div className="space-y-4">
            {loginBlocks.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
                <Unlock className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
                <p className="text-xl text-white">Aucun blocage actif</p>
              </div>
            ) : (
              loginBlocks.map((block) => (
                <div 
                  key={block.block_id}
                  className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-white font-medium">{block.email}</p>
                    <p className="text-slate-400 text-sm">IP: {block.ip_address}</p>
                    <p className="text-slate-500 text-xs">
                      Bloqué jusqu'à: {new Date(block.blocked_until).toLocaleString('fr-FR')}
                    </p>
                    <p className="text-amber-400 text-sm">{block.reason}</p>
                  </div>
                  
                  <Button
                    onClick={() => handleUnblock(block.email, block.ip_address)}
                    variant="outline"
                    className="border-emerald-500/50 text-emerald-400"
                  >
                    <Unlock className="w-4 h-4 mr-2" />
                    Débloquer
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        {/* IP Blacklist Tab (Super Admin) */}
        {activeTab === 'blacklist' && isSuperAdmin && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-white font-medium">Adresses IP Bloquées</h3>
              <Button
                variant="outline"
                size="sm"
                className="border-red-500/50 text-red-400"
                onClick={() => {
                  const ip = window.prompt('Adresse IP à bloquer:');
                  const reason = window.prompt('Raison:');
                  if (ip && reason) {
                    axios.post(`${API_URL}/api/security/ip-blacklist`, { ip_address: ip, reason }, { headers })
                      .then(() => { toast.success('IP ajoutée'); fetchData(); })
                      .catch(() => toast.error('Erreur'));
                  }
                }}
              >
                <Ban className="w-4 h-4 mr-2" />
                Ajouter IP
              </Button>
            </div>
            
            {ipBlacklist.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                Aucune IP dans la liste noire
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-slate-400 text-sm bg-slate-800">
                      <th className="px-4 py-3">IP</th>
                      <th className="px-4 py-3">Raison</th>
                      <th className="px-4 py-3">Ajouté</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ipBlacklist.map((entry) => (
                      <tr key={entry.entry_id} className="border-b border-slate-800">
                        <td className="px-4 py-3 font-mono text-white">{entry.ip_address}</td>
                        <td className="px-4 py-3 text-slate-400">{entry.reason}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {new Date(entry.created_at).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-emerald-500/50 text-emerald-400"
                            onClick={() => {
                              axios.delete(`${API_URL}/api/security/ip-blacklist/${entry.ip_address}`, { headers })
                                .then(() => { toast.success('IP retirée'); fetchData(); })
                                .catch(() => toast.error('Erreur'));
                            }}
                          >
                            Retirer
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default SecurityDashboardPage;
