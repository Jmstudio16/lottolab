/**
 * LOTTOLAB Analytics Pro Dashboard
 * =================================
 * Comprehensive analytics dashboard with 4 sections:
 * 1. Sales Dashboard - Ventes par période, tendances
 * 2. Gains Dashboard - Numéros populaires, gagnants
 * 3. Performance Dashboard - Classement agents
 * 4. Real-time Dashboard - Activité en direct
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/api/auth';
import { useWebSocketContext, useWebSocketEvent, WSEventType } from '@/context/WebSocketContext';
import WebSocketIndicator from '@/components/WebSocketIndicator';
import { API_URL } from '@/config/api';
import axios from 'axios';
import { toast } from 'sonner';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Users, Ticket, Trophy,
  Calendar, RefreshCw, Download, ArrowUpRight, ArrowDownRight, 
  Target, Award, Activity, PieChart, LineChart, Clock, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminLayout } from '@/components/AdminLayout';

const AnalyticsDashboardPage = () => {
  const { token, user } = useAuth();
  const { isConnected, lastMessage } = useWebSocketContext();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [activeTab, setActiveTab] = useState('sales');
  
  // Data states
  const [salesSummary, setSalesSummary] = useState(null);
  const [salesTrend, setSalesTrend] = useState([]);
  const [topAgents, setTopAgents] = useState([]);
  const [topLotteries, setTopLotteries] = useState([]);
  const [mostPlayedNumbers, setMostPlayedNumbers] = useState([]);
  const [mostWinningNumbers, setMostWinningNumbers] = useState([]);
  const [gameTypeStats, setGameTypeStats] = useState([]);
  const [performanceSummary, setPerformanceSummary] = useState(null);
  const [agentsRanking, setAgentsRanking] = useState([]);
  
  // Real-time activity
  const [realtimeActivity, setRealtimeActivity] = useState([]);

  const headers = { Authorization: `Bearer ${token}` };

  // Fetch all analytics data
  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      
      const [
        summaryRes,
        trendRes,
        agentsRes,
        lotteriesRes,
        playedRes,
        winningRes,
        gameTypeRes,
        perfSummaryRes,
        rankingRes
      ] = await Promise.all([
        axios.get(`${API_URL}/api/analytics/sales/summary?period=${period}`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/analytics/sales/trend?period=${period}`, { headers }).catch(() => ({ data: { data: [] } })),
        axios.get(`${API_URL}/api/analytics/sales/top-agents?period=${period}&limit=10`, { headers }).catch(() => ({ data: { agents: [] } })),
        axios.get(`${API_URL}/api/analytics/sales/top-lotteries?period=${period}&limit=10`, { headers }).catch(() => ({ data: { lotteries: [] } })),
        axios.get(`${API_URL}/api/analytics/gains/most-played-numbers?limit=15`, { headers }).catch(() => ({ data: { numbers: [] } })),
        axios.get(`${API_URL}/api/analytics/gains/most-winning-numbers?limit=15`, { headers }).catch(() => ({ data: { numbers: [] } })),
        axios.get(`${API_URL}/api/analytics/gains/by-game-type?period=${period}`, { headers }).catch(() => ({ data: { game_types: [] } })),
        axios.get(`${API_URL}/api/analytics/performance/summary?period=${period}`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/analytics/performance/agents-ranking?period=${period}&limit=20`, { headers }).catch(() => ({ data: { agents: [] } }))
      ]);

      setSalesSummary(summaryRes.data);
      setSalesTrend(trendRes.data?.data || []);
      setTopAgents(agentsRes.data?.agents || []);
      setTopLotteries(lotteriesRes.data?.lotteries || []);
      setMostPlayedNumbers(playedRes.data?.numbers || []);
      setMostWinningNumbers(winningRes.data?.numbers || []);
      setGameTypeStats(gameTypeRes.data?.game_types || []);
      setPerformanceSummary(perfSummaryRes.data?.summary || null);
      setAgentsRanking(rankingRes.data?.agents || []);
      
    } catch (error) {
      console.error('Analytics error:', error);
      toast.error('Erreur lors du chargement des analytics');
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // WebSocket: Real-time activity
  useWebSocketEvent(WSEventType.TICKET_SOLD, useCallback((data) => {
    setRealtimeActivity(prev => [{
      type: 'sale',
      icon: <Ticket className="w-4 h-4 text-blue-400" />,
      message: `Ticket ${data.data?.ticket_code}`,
      amount: data.data?.total_amount,
      time: new Date().toLocaleTimeString('fr-FR'),
      agent: data.data?.agent_name
    }, ...prev.slice(0, 19)]);
  }, []));

  useWebSocketEvent(WSEventType.TICKET_WINNER, useCallback((data) => {
    setRealtimeActivity(prev => [{
      type: 'winner',
      icon: <Trophy className="w-4 h-4 text-amber-400" />,
      message: `GAGNANT ${data.data?.ticket_code}`,
      amount: data.data?.win_amount,
      time: new Date().toLocaleTimeString('fr-FR'),
      agent: data.data?.agent_name
    }, ...prev.slice(0, 19)]);
  }, []));

  useWebSocketEvent(WSEventType.TICKET_PAID, useCallback((data) => {
    setRealtimeActivity(prev => [{
      type: 'paid',
      icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
      message: `Payé ${data.data?.ticket_code}`,
      amount: data.data?.paid_amount,
      time: new Date().toLocaleTimeString('fr-FR')
    }, ...prev.slice(0, 19)]);
  }, []));

  useWebSocketEvent(WSEventType.RESULT_PUBLISHED, useCallback((data) => {
    setRealtimeActivity(prev => [{
      type: 'result',
      icon: <Zap className="w-4 h-4 text-purple-400" />,
      message: `${data.data?.lottery_name} - ${data.data?.draw_name}`,
      numbers: data.data?.winning_numbers,
      time: new Date().toLocaleTimeString('fr-FR')
    }, ...prev.slice(0, 19)]);
  }, []));

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR').format(amount || 0);
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '0%';
    const num = parseFloat(value);
    return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
  };

  // Simple bar chart component
  const SimpleBarChart = ({ data, labelKey, valueKey, maxValue }) => {
    const max = maxValue || Math.max(...data.map(d => d[valueKey] || 0), 1);
    return (
      <div className="space-y-2">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <span className="text-slate-400 text-sm w-8">{idx + 1}.</span>
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white truncate">{item[labelKey]}</span>
                <span className="text-emerald-400 font-medium">{formatCurrency(item[valueKey])} HTG</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${(item[valueKey] / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6" data-testid="analytics-dashboard">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <BarChart3 className="w-7 h-7 text-purple-400" />
              Analytics Pro
            </h1>
            <p className="text-sm text-slate-400">Tableau de bord analytique complet</p>
          </div>
          <div className="flex items-center gap-3">
            <WebSocketIndicator />
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32 bg-slate-800 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Aujourd'hui</SelectItem>
                <SelectItem value="week">7 jours</SelectItem>
                <SelectItem value="month">30 jours</SelectItem>
                <SelectItem value="year">365 jours</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchAnalytics} variant="outline" className="border-slate-700">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              {salesSummary?.change?.sales_percent > 0 ? (
                <ArrowUpRight className="w-5 h-5 text-emerald-400" />
              ) : (
                <ArrowDownRight className="w-5 h-5 text-red-400" />
              )}
            </div>
            <p className="text-slate-400 text-sm mt-2">Ventes</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(salesSummary?.current?.total_sales)} <span className="text-sm">HTG</span></p>
            <p className={`text-xs ${salesSummary?.change?.sales_percent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatPercent(salesSummary?.change?.sales_percent)} vs période précédente
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Ticket className="w-5 h-5 text-blue-400" />
              </div>
              {salesSummary?.change?.tickets_percent > 0 ? (
                <ArrowUpRight className="w-5 h-5 text-emerald-400" />
              ) : (
                <ArrowDownRight className="w-5 h-5 text-red-400" />
              )}
            </div>
            <p className="text-slate-400 text-sm mt-2">Tickets</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(salesSummary?.current?.total_tickets)}</p>
            <p className={`text-xs ${salesSummary?.change?.tickets_percent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatPercent(salesSummary?.change?.tickets_percent)} vs période précédente
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Trophy className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <p className="text-slate-400 text-sm mt-2">Gains Distribués</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(salesSummary?.current?.total_winnings)} <span className="text-sm">HTG</span></p>
            <p className="text-xs text-slate-500">Total payé aux gagnants</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <p className="text-emerald-300 text-sm mt-2">Revenu Net</p>
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(salesSummary?.current?.net_revenue)} <span className="text-sm">HTG</span></p>
            <p className="text-xs text-emerald-300/70">Ventes - Gains</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="sales" className="data-[state=active]:bg-emerald-600">
              <DollarSign className="w-4 h-4 mr-2" />
              Ventes
            </TabsTrigger>
            <TabsTrigger value="gains" className="data-[state=active]:bg-amber-600">
              <Target className="w-4 h-4 mr-2" />
              Gains
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-blue-600">
              <Award className="w-4 h-4 mr-2" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="realtime" className="data-[state=active]:bg-purple-600">
              <Activity className="w-4 h-4 mr-2" />
              Temps Réel
            </TabsTrigger>
          </TabsList>

          {/* SALES TAB */}
          <TabsContent value="sales" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Sales Trend */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <LineChart className="w-5 h-5 text-emerald-400" />
                  Tendance des Ventes
                </h3>
                {salesTrend.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {salesTrend.slice(-14).map((day, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-slate-400 text-xs w-20">{day.date}</span>
                        <div className="flex-1 h-6 bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${Math.min((day.sales / (Math.max(...salesTrend.map(d => d.sales)) || 1)) * 100, 100)}%` }}
                          >
                            <span className="text-xs text-white font-medium">{formatCurrency(day.sales)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-8">Aucune donnée disponible</p>
                )}
              </div>

              {/* Top Lotteries */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-blue-400" />
                  Top Loteries
                </h3>
                {topLotteries.length > 0 ? (
                  <SimpleBarChart 
                    data={topLotteries.slice(0, 8)} 
                    labelKey="lottery_name" 
                    valueKey="total_sales" 
                  />
                ) : (
                  <p className="text-slate-400 text-center py-8">Aucune donnée disponible</p>
                )}
              </div>

              {/* Top Agents */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 lg:col-span-2">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  Top Vendeurs
                </h3>
                {topAgents.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                          <th className="pb-3 font-medium">Rang</th>
                          <th className="pb-3 font-medium">Vendeur</th>
                          <th className="pb-3 font-medium text-right">Ventes</th>
                          <th className="pb-3 font-medium text-right">Tickets</th>
                          <th className="pb-3 font-medium text-right">Revenu Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topAgents.slice(0, 10).map((agent) => (
                          <tr key={agent.agent_id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                            <td className="py-3">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                agent.rank === 1 ? 'bg-amber-500 text-black' :
                                agent.rank === 2 ? 'bg-slate-400 text-black' :
                                agent.rank === 3 ? 'bg-amber-700 text-white' :
                                'bg-slate-600 text-white'
                              }`}>
                                {agent.rank}
                              </span>
                            </td>
                            <td className="py-3 text-white">{agent.agent_name}</td>
                            <td className="py-3 text-right text-emerald-400 font-medium">
                              {formatCurrency(agent.total_sales)} HTG
                            </td>
                            <td className="py-3 text-right text-slate-400">{agent.total_tickets}</td>
                            <td className="py-3 text-right text-emerald-400">
                              {formatCurrency(agent.net_revenue)} HTG
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-8">Aucune donnée disponible</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* GAINS TAB */}
          <TabsContent value="gains" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Most Played Numbers */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-400" />
                  Numéros les Plus Joués
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {mostPlayedNumbers.length > 0 ? (
                    mostPlayedNumbers.map((num) => (
                      <div key={num.number} className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 text-sm">#{num.rank}</span>
                          <span className="font-mono text-xl font-bold text-amber-400">{num.number}</span>
                          <span className="text-xs text-slate-500">{num.bet_type}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-medium">{num.times_played}x joué</p>
                          <p className="text-xs text-slate-400">{formatCurrency(num.total_wagered)} HTG</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 text-center py-8">Aucune donnée disponible</p>
                  )}
                </div>
              </div>

              {/* Most Winning Numbers */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Numéros les Plus Gagnants
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {mostWinningNumbers.length > 0 ? (
                    mostWinningNumbers.map((num) => (
                      <div key={num.number} className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 text-sm">#{num.rank}</span>
                          <span className="font-mono text-xl font-bold text-emerald-400">{num.number}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-medium">{num.wins_count}x gagnant</p>
                          <p className="text-xs text-emerald-400">{formatCurrency(num.total_winnings)} HTG</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 text-center py-8">Aucune donnée disponible</p>
                  )}
                </div>
              </div>

              {/* Game Type Stats */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 lg:col-span-2">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-purple-400" />
                  Statistiques par Type de Jeu
                </h3>
                {gameTypeStats.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                          <th className="pb-3 font-medium">Type</th>
                          <th className="pb-3 font-medium text-right">Mises</th>
                          <th className="pb-3 font-medium text-right">Jeux</th>
                          <th className="pb-3 font-medium text-right">Gains</th>
                          <th className="pb-3 font-medium text-right">Taux Gain</th>
                          <th className="pb-3 font-medium text-right">Revenu Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gameTypeStats.map((gt) => (
                          <tr key={gt.bet_type} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                            <td className="py-3">
                              <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-sm font-medium">
                                {gt.bet_type}
                              </span>
                            </td>
                            <td className="py-3 text-right text-white font-medium">
                              {formatCurrency(gt.total_wagered)} HTG
                            </td>
                            <td className="py-3 text-right text-slate-400">{gt.total_plays}</td>
                            <td className="py-3 text-right text-amber-400">
                              {formatCurrency(gt.total_winnings)} HTG
                            </td>
                            <td className="py-3 text-right">
                              <span className={`${gt.win_rate > 5 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {gt.win_rate?.toFixed(1)}%
                              </span>
                            </td>
                            <td className={`py-3 text-right font-medium ${gt.net_revenue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {formatCurrency(gt.net_revenue)} HTG
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-8">Aucune donnée disponible</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* PERFORMANCE TAB */}
          <TabsContent value="performance" className="space-y-6">
            {/* Performance Summary */}
            {performanceSummary && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <p className="text-slate-400 text-sm">Agents Actifs</p>
                  <p className="text-2xl font-bold text-white">{performanceSummary.active_agents}</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <p className="text-slate-400 text-sm">Moy. par Agent</p>
                  <p className="text-2xl font-bold text-emerald-400">{formatCurrency(performanceSummary.avg_sales_per_agent)} HTG</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <p className="text-slate-400 text-sm">Tickets Gagnants</p>
                  <p className="text-2xl font-bold text-amber-400">{performanceSummary.winning_tickets}</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <p className="text-slate-400 text-sm">Marge Profit</p>
                  <p className="text-2xl font-bold text-emerald-400">{performanceSummary.profit_margin?.toFixed(1)}%</p>
                </div>
              </div>
            )}

            {/* Agents Ranking */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                Classement Complet des Agents
              </h3>
              {agentsRanking.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                        <th className="pb-3 font-medium">Rang</th>
                        <th className="pb-3 font-medium">Agent</th>
                        <th className="pb-3 font-medium text-right">Ventes</th>
                        <th className="pb-3 font-medium text-right">Tickets</th>
                        <th className="pb-3 font-medium text-right">Gagnants</th>
                        <th className="pb-3 font-medium text-right">Taux Gain</th>
                        <th className="pb-3 font-medium text-right">Marge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentsRanking.map((agent) => (
                        <tr key={agent.agent_id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="py-3">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                              agent.rank === 1 ? 'bg-amber-500 text-black' :
                              agent.rank === 2 ? 'bg-slate-400 text-black' :
                              agent.rank === 3 ? 'bg-amber-700 text-white' :
                              'bg-slate-600 text-white'
                            }`}>
                              {agent.rank}
                            </span>
                          </td>
                          <td className="py-3 text-white font-medium">{agent.agent_name}</td>
                          <td className="py-3 text-right text-emerald-400 font-medium">
                            {formatCurrency(agent.total_sales)} HTG
                          </td>
                          <td className="py-3 text-right text-slate-400">{agent.total_tickets}</td>
                          <td className="py-3 text-right text-amber-400">{agent.winning_tickets}</td>
                          <td className="py-3 text-right text-slate-400">{agent.win_rate?.toFixed(1)}%</td>
                          <td className={`py-3 text-right font-medium ${agent.profit_margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {agent.profit_margin?.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8">Aucune donnée disponible</p>
              )}
            </div>
          </TabsContent>

          {/* REAL-TIME TAB */}
          <TabsContent value="realtime" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Live Activity Feed */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 lg:col-span-2">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-400" />
                  Activité en Direct
                  {isConnected && (
                    <span className="ml-auto text-xs text-emerald-400 flex items-center gap-1">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      LIVE
                    </span>
                  )}
                </h3>
                
                {!isConnected && (
                  <div className="text-center py-8 text-slate-400">
                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Connectez-vous au WebSocket pour voir l'activité en temps réel</p>
                  </div>
                )}

                {isConnected && realtimeActivity.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-50 animate-pulse" />
                    <p>En attente d'activité...</p>
                    <p className="text-sm">Les ventes, gagnants et résultats apparaîtront ici en temps réel</p>
                  </div>
                )}

                {realtimeActivity.length > 0 && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {realtimeActivity.map((activity, idx) => (
                      <div 
                        key={idx}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                          idx === 0 ? 'bg-slate-700/50 ring-1 ring-purple-500/50 animate-pulse' : 'bg-slate-700/30'
                        }`}
                      >
                        <div className="p-2 rounded-lg bg-slate-700">
                          {activity.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{activity.message}</p>
                          {activity.agent && (
                            <p className="text-xs text-slate-400">par {activity.agent}</p>
                          )}
                          {activity.numbers && (
                            <p className="text-sm text-amber-400 font-mono">{activity.numbers}</p>
                          )}
                        </div>
                        <div className="text-right">
                          {activity.amount && (
                            <p className={`font-bold ${
                              activity.type === 'winner' ? 'text-amber-400' :
                              activity.type === 'paid' ? 'text-emerald-400' :
                              'text-white'
                            }`}>
                              {formatCurrency(activity.amount)} HTG
                            </p>
                          )}
                          <p className="text-xs text-slate-500">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AnalyticsDashboardPage;
