import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Ticket, Search, Filter, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const TicketsPage = () => {
  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [filters, setFilters] = useState({
    agent_id: '',
    status: '',
    date_from: '',
    date_to: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ticketsRes, agentsRes] = await Promise.all([
        apiClient.get('/company/tickets'),
        apiClient.get('/company/agents')
      ]);
      setTickets(ticketsRes.data);
      setAgents(agentsRes.data);
    } catch (error) {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.agent_id) params.append('agent_id', filters.agent_id);
      if (filters.status) params.append('status', filters.status);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      
      const response = await apiClient.get(`/company/tickets?${params.toString()}`);
      setTickets(response.data);
    } catch (error) {
      toast.error('Failed to filter tickets');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({ agent_id: '', status: '', date_from: '', date_to: '' });
    fetchData();
  };

  const getAgentName = (agentId) => {
    const agent = agents.find(a => a.agent_id === agentId || a.user_id === agentId);
    return agent ? agent.name : agentId?.slice(0, 8) || 'Unknown';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return 'bg-blue-950/50 text-blue-400 border-blue-800';
      case 'WINNER': return 'bg-emerald-950/50 text-emerald-400 border-emerald-800';
      case 'LOSER': return 'bg-slate-950/50 text-slate-400 border-slate-800';
      case 'VOID': return 'bg-red-950/50 text-red-400 border-red-800';
      case 'PAID': return 'bg-purple-950/50 text-purple-400 border-purple-800';
      default: return 'bg-yellow-950/50 text-yellow-400 border-yellow-800';
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString();
  };

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'HTG' }).format(amount);
  };

  if (loading) {
    return (
      <AdminLayout title="Tickets" subtitle="View all company tickets" role="COMPANY_ADMIN">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Tickets" subtitle="View all company tickets" role="COMPANY_ADMIN">
      <div className="space-y-6">
        {/* Filters */}
        <div className="bg-card border border-slate-700/50 rounded-xl p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="min-w-[200px]">
              <label className="text-xs text-slate-400 mb-1 block">Agent</label>
              <Select value={filters.agent_id || "all"} onValueChange={(val) => setFilters({...filters, agent_id: val === "all" ? "" : val})}>
                <SelectTrigger className="bg-slate-950 border-slate-700 text-white" data-testid="filter-agent">
                  <SelectValue placeholder="All agents" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="all" className="text-white">All agents</SelectItem>
                  {agents.map(agent => (
                    <SelectItem key={agent.agent_id} value={agent.user_id || agent.agent_id} className="text-white">
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <label className="text-xs text-slate-400 mb-1 block">Status</label>
              <Select value={filters.status} onValueChange={(val) => setFilters({...filters, status: val})}>
                <SelectTrigger className="bg-slate-950 border-slate-700 text-white" data-testid="filter-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="" className="text-white">All statuses</SelectItem>
                  <SelectItem value="ACTIVE" className="text-white">Active</SelectItem>
                  <SelectItem value="WINNER" className="text-white">Winner</SelectItem>
                  <SelectItem value="LOSER" className="text-white">Loser</SelectItem>
                  <SelectItem value="VOID" className="text-white">Void</SelectItem>
                  <SelectItem value="PAID" className="text-white">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Date From</label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({...filters, date_from: e.target.value})}
                className="bg-slate-950 border-slate-700 text-white"
                data-testid="filter-date-from"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Date To</label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({...filters, date_to: e.target.value})}
                className="bg-slate-950 border-slate-700 text-white"
                data-testid="filter-date-to"
              />
            </div>
            <Button onClick={applyFilters} className="button-primary" data-testid="apply-filters-button">
              <Filter className="w-4 h-4 mr-2" />
              Apply
            </Button>
            <Button onClick={clearFilters} variant="outline" className="border-slate-700 text-slate-300" data-testid="clear-filters-button">
              Clear
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-card border border-slate-700/50 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Total Tickets</p>
            <p className="text-2xl font-bold text-white">{tickets.length}</p>
          </div>
          <div className="bg-card border border-slate-700/50 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Total Sales</p>
            <p className="text-2xl font-bold text-emerald-400">
              {formatCurrency(tickets.reduce((sum, t) => sum + t.total_amount, 0), 'HTG')}
            </p>
          </div>
          <div className="bg-card border border-slate-700/50 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Active</p>
            <p className="text-2xl font-bold text-blue-400">
              {tickets.filter(t => t.status === 'ACTIVE').length}
            </p>
          </div>
          <div className="bg-card border border-slate-700/50 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Winners</p>
            <p className="text-2xl font-bold text-yellow-400">
              {tickets.filter(t => t.status === 'WINNER').length}
            </p>
          </div>
        </div>

        {/* Ticket Detail Modal */}
        <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
          <DialogContent className="bg-card border-slate-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">Ticket Details</DialogTitle>
            </DialogHeader>
            {selectedTicket && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-400 text-sm">Ticket Code</p>
                    <p className="text-white font-mono">{selectedTicket.ticket_code}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Verification Code</p>
                    <p className="text-white font-mono">{selectedTicket.verification_code}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Lottery</p>
                    <p className="text-white">{selectedTicket.lottery_name}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Draw Date</p>
                    <p className="text-white">{formatDate(selectedTicket.draw_datetime)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Agent</p>
                    <p className="text-white">{getAgentName(selectedTicket.agent_id)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Total Amount</p>
                    <p className="text-emerald-400 font-bold">{formatCurrency(selectedTicket.total_amount, selectedTicket.currency)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-2">Plays</p>
                  <div className="bg-slate-900 rounded-lg p-3 space-y-2">
                    {selectedTicket.plays?.map((play, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-white font-mono">{play.numbers}</span>
                        <span className="text-slate-400">{play.bet_type}</span>
                        <span className="text-emerald-400">{formatCurrency(play.amount, selectedTicket.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {selectedTicket.qr_payload && selectedTicket.qr_payload.startsWith('data:image') && (
                  <div className="text-center">
                    <p className="text-slate-400 text-sm mb-2">QR Code</p>
                    <img src={selectedTicket.qr_payload} alt="QR Code" className="mx-auto w-32 h-32" />
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Tickets Table */}
        <div className="bg-card border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Ticket Code</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Lottery</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                      <Ticket className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No tickets found</p>
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => (
                    <tr key={ticket.ticket_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-white">{ticket.ticket_code}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">{ticket.lottery_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-400">{getAgentName(ticket.agent_id)}</td>
                      <td className="px-6 py-4 text-sm text-emerald-400 font-medium">
                        {formatCurrency(ticket.total_amount, ticket.currency)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {formatDate(ticket.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedTicket(ticket)}
                          className="text-blue-400 hover:bg-blue-900/20"
                          data-testid={`view-ticket-${ticket.ticket_id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
