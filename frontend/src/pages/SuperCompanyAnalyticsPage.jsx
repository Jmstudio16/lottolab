import React, { useState, useEffect } from 'react';
import { API_URL } from '@/config/api';
import { useAuth } from '@/api/auth';
import { AdminLayout } from '@/components/AdminLayout';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Building2, Users, Store, UserCheck, TrendingUp, TrendingDown,
  RefreshCw, Search, ArrowUpDown, ChevronDown, ChevronUp,
  BarChart3, Eye, DollarSign, Ticket, Award, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Stat Card Component
const StatCard = ({ title, value, subtitle, icon: Icon, color = "emerald", trend = null }) => (
  <Card className="bg-zinc-900 border-zinc-800">
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>
          <p className={`text-2xl font-bold text-${color}-400 mt-1`}>{value}</p>
          {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2 bg-${color}-500/10 rounded-lg`}>
          <Icon className={`h-5 w-5 text-${color}-400`} />
        </div>
      </div>
      {trend !== null && (
        <div className={`flex items-center gap-1 mt-2 text-xs ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>{trend >= 0 ? '+' : ''}{trend}% ce mois</span>
        </div>
      )}
    </CardContent>
  </Card>
);

// Company Row Component
const CompanyRow = ({ company, rank, onViewDetails }) => {
  const [expanded, setExpanded] = useState(false);
  
  const statusColors = {
    ACTIVE: 'bg-emerald-500/20 text-emerald-400',
    TRIAL: 'bg-blue-500/20 text-blue-400',
    SUSPENDED: 'bg-red-500/20 text-red-400',
    EXPIRED: 'bg-orange-500/20 text-orange-400'
  };

  return (
    <>
      <tr 
        className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-3 px-4">
          <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
            rank <= 3 ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700 text-zinc-400'
          }`}>
            {rank}
          </span>
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-zinc-500" />
            <span className="text-white font-medium">{company.name}</span>
          </div>
          <span className="text-xs text-zinc-500">{company.company_id}</span>
        </td>
        <td className="py-3 px-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <Store className="h-4 w-4 text-blue-400" />
            <span className="text-white font-semibold">{company.succursales_count || 0}</span>
          </div>
        </td>
        <td className="py-3 px-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <Users className="h-4 w-4 text-purple-400" />
            <span className="text-white font-semibold">{company.agents_count || 0}</span>
          </div>
        </td>
        <td className="py-3 px-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <UserCheck className="h-4 w-4 text-emerald-400" />
            <span className="text-white font-semibold">{company.vendeurs_count || 0}</span>
          </div>
        </td>
        <td className="py-3 px-4 text-center">
          <span className="text-amber-400 font-semibold">
            {(company.total_sales || 0).toLocaleString()} HTG
          </span>
        </td>
        <td className="py-3 px-4 text-center">
          <Badge className={statusColors[company.status] || 'bg-zinc-500/20 text-zinc-400'}>
            {company.status}
          </Badge>
        </td>
        <td className="py-3 px-4 text-right">
          <Button variant="ghost" size="sm" className="text-zinc-400">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </td>
      </tr>
      
      {/* Expanded Details */}
      {expanded && (
        <tr className="bg-zinc-800/20">
          <td colSpan={8} className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-700">
                <div className="text-xs text-zinc-400 mb-1">Tickets Vendus</div>
                <div className="text-lg font-bold text-white">{company.tickets_count || 0}</div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-700">
                <div className="text-xs text-zinc-400 mb-1">Tickets Gagnants</div>
                <div className="text-lg font-bold text-emerald-400">{company.winning_tickets || 0}</div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-700">
                <div className="text-xs text-zinc-400 mb-1">Gains Payés</div>
                <div className="text-lg font-bold text-amber-400">
                  {(company.total_payouts || 0).toLocaleString()} HTG
                </div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-700">
                <div className="text-xs text-zinc-400 mb-1">Créé le</div>
                <div className="text-lg font-bold text-white">
                  {company.created_at ? new Date(company.created_at).toLocaleDateString('fr-FR') : 'N/A'}
                </div>
              </div>
            </div>
            
            {/* Top Agents */}
            {company.top_agents && company.top_agents.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-zinc-400 mb-2">Top Vendeurs</h4>
                <div className="flex flex-wrap gap-2">
                  {company.top_agents.map((agent, idx) => (
                    <div key={idx} className="bg-zinc-900 px-3 py-1 rounded-full border border-zinc-700 text-sm">
                      <span className="text-white">{agent.name}</span>
                      <span className="text-emerald-400 ml-2">{agent.sales} ventes</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
};

export const SuperCompanyAnalyticsPage = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [totals, setTotals] = useState({
    total_companies: 0,
    total_succursales: 0,
    total_agents: 0,
    total_vendeurs: 0,
    total_sales: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('total_sales');
  const [sortOrder, setSortOrder] = useState('desc');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchCompanyAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch all companies with their statistics
      const res = await axios.get(`${API_URL}/api/saas/company-analytics`, { headers });
      
      setCompanies(res.data.companies || []);
      setTotals(res.data.totals || {
        total_companies: 0,
        total_succursales: 0,
        total_agents: 0,
        total_vendeurs: 0,
        total_sales: 0
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Erreur lors du chargement des analytics');
      
      // Fallback - fetch basic company data
      try {
        const companiesRes = await axios.get(`${API_URL}/api/super/companies`, { headers });
        const companiesList = companiesRes.data || [];
        
        // Calculate basic totals
        let totalSuccursales = 0;
        let totalAgents = 0;
        let totalVendeurs = 0;
        
        setCompanies(companiesList.map(c => ({
          ...c,
          succursales_count: c.succursales_count || 0,
          agents_count: c.agents_count || 0,
          vendeurs_count: c.vendeurs_count || 0,
          total_sales: c.total_sales || 0
        })));
        
        setTotals({
          total_companies: companiesList.length,
          total_succursales: companiesList.reduce((sum, c) => sum + (c.succursales_count || 0), 0),
          total_agents: companiesList.reduce((sum, c) => sum + (c.agents_count || 0), 0),
          total_vendeurs: companiesList.reduce((sum, c) => sum + (c.vendeurs_count || 0), 0),
          total_sales: companiesList.reduce((sum, c) => sum + (c.total_sales || 0), 0)
        });
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanyAnalytics();
  }, []);

  // Filter and sort companies
  const filteredCompanies = companies
    .filter(c => 
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.company_id?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="company-analytics-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="h-7 w-7 text-blue-500" />
              Analytics Compagnies
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Vue d'ensemble de toutes les compagnies et leurs performances
            </p>
          </div>
          <Button 
            onClick={fetchCompanyAnalytics}
            variant="outline"
            className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            title="Compagnies"
            value={totals.total_companies}
            subtitle="Total actives"
            icon={Building2}
            color="blue"
          />
          <StatCard
            title="Succursales"
            value={totals.total_succursales}
            subtitle="Points de vente"
            icon={Store}
            color="purple"
          />
          <StatCard
            title="Agents"
            value={totals.total_agents}
            subtitle="Superviseurs & Staff"
            icon={Users}
            color="cyan"
          />
          <StatCard
            title="Vendeurs"
            value={totals.total_vendeurs}
            subtitle="POS actifs"
            icon={UserCheck}
            color="emerald"
          />
          <StatCard
            title="Ventes Totales"
            value={`${(totals.total_sales || 0).toLocaleString()}`}
            subtitle="HTG ce mois"
            icon={DollarSign}
            color="amber"
          />
        </div>

        {/* Search */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher une compagnie..."
              className="pl-10 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
        </div>

        {/* Companies Table */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              Classement des Compagnies ({filteredCompanies.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-zinc-500" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-700">
                      <th className="text-left py-3 px-4 text-zinc-400 font-medium w-12">#</th>
                      <th className="text-left py-3 px-4 text-zinc-400 font-medium">Compagnie</th>
                      <th 
                        className="text-center py-3 px-4 text-zinc-400 font-medium cursor-pointer hover:text-white"
                        onClick={() => handleSort('succursales_count')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Succursales
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th 
                        className="text-center py-3 px-4 text-zinc-400 font-medium cursor-pointer hover:text-white"
                        onClick={() => handleSort('agents_count')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Agents
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th 
                        className="text-center py-3 px-4 text-zinc-400 font-medium cursor-pointer hover:text-white"
                        onClick={() => handleSort('vendeurs_count')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Vendeurs
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th 
                        className="text-center py-3 px-4 text-zinc-400 font-medium cursor-pointer hover:text-white"
                        onClick={() => handleSort('total_sales')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Ventes
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th className="text-center py-3 px-4 text-zinc-400 font-medium">Statut</th>
                      <th className="text-right py-3 px-4 text-zinc-400 font-medium w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map((company, index) => (
                      <CompanyRow 
                        key={company.company_id} 
                        company={company} 
                        rank={index + 1}
                      />
                    ))}
                  </tbody>
                </table>
                
                {filteredCompanies.length === 0 && (
                  <div className="text-center py-8 text-zinc-500">
                    Aucune compagnie trouvée
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default SuperCompanyAnalyticsPage;
