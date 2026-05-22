import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Building2, Users, DollarSign, FileText, RefreshCw, Settings as SettingsIcon,
  Download, CheckCircle2, AlertCircle, Clock, Receipt, Wifi, TrendingUp
} from 'lucide-react';
import { API_URL } from '@/config/api';
import { useAuth } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const COUNTING_LABELS = {
  active: 'Tous agents ACTIFS',
  online_now: 'En ligne maintenant',
  monthly_active: 'Connectés ce mois',
  monthly_sellers: 'Vendeurs ce mois'
};

const MODE_LABELS = {
  fixed_per_agent: 'Tarif fixe / agent',
  tiered: 'Paliers',
  percentage: '% du CA',
  custom: 'Manuel'
};

const STATUS_BADGE = {
  pending: { label: 'En attente', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  paid: { label: 'Payée', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  overdue: { label: 'En retard', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  cancelled: { label: 'Annulée', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' }
};

const fmt = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n || 0);

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const prevMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const SuperBillingPage = () => {
  const { token } = useAuth();
  const [summary, setSummary] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(prevMonth());
  const [tab, setTab] = useState('companies');

  const [configOpen, setConfigOpen] = useState(false);
  const [configCompany, setConfigCompany] = useState(null);
  const [configForm, setConfigForm] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [generating, setGenerating] = useState(false);

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [s, c, i] = await Promise.all([
        axios.get(`${API_URL}/api/super/billing/summary`, { headers: authHeaders() }),
        axios.get(`${API_URL}/api/super/billing/companies?month=${month}`, { headers: authHeaders() }),
        axios.get(`${API_URL}/api/super/billing/invoices?month=${month}`, { headers: authHeaders() })
      ]);
      setSummary(s.data);
      setCompanies(c.data.companies || []);
      setInvoices(i.data.invoices || []);
    } catch (err) {
      console.error('[Billing] load error:', err);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [month, authHeaders]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openConfig = async (company) => {
    setConfigCompany(company);
    setConfigOpen(true);
    try {
      const { data } = await axios.get(
        `${API_URL}/api/super/billing/company/${company.company_id}/config`,
        { headers: authHeaders() }
      );
      setConfigForm({
        billing_mode: data.billing_mode,
        rate_per_agent: data.rate_per_agent,
        counting_method: data.counting_method,
        percentage_rate: data.percentage_rate,
        tiers: data.tiers || [],
        currency: data.currency || 'HTG',
        notes: data.notes || ''
      });
    } catch (err) {
      toast.error('Impossible de charger la configuration');
    }
  };

  const saveConfig = async () => {
    if (!configCompany || !configForm) return;
    try {
      setSavingConfig(true);
      await axios.put(
        `${API_URL}/api/super/billing/company/${configCompany.company_id}/config`,
        configForm,
        { headers: authHeaders() }
      );
      toast.success(`Configuration mise à jour pour ${configCompany.name}`);
      setConfigOpen(false);
      loadAll();
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSavingConfig(false);
    }
  };

  const generateInvoices = async (force = false) => {
    try {
      setGenerating(true);
      const { data } = await axios.post(
        `${API_URL}/api/super/billing/generate-invoices?month=${month}&force=${force}`,
        {},
        { headers: authHeaders() }
      );
      toast.success(
        `Factures ${month} — Créées: ${data.created.length}, MAJ: ${data.updated.length}, Existantes: ${data.skipped_existing.length}`
      );
      loadAll();
    } catch (err) {
      toast.error('Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  const markInvoice = async (invoiceId, status) => {
    try {
      await axios.put(
        `${API_URL}/api/super/billing/invoices/${invoiceId}/status`,
        { status },
        { headers: authHeaders() }
      );
      toast.success(`Facture marquée ${status}`);
      loadAll();
    } catch (err) {
      toast.error('Erreur de mise à jour');
    }
  };

  const downloadPdf = async (invoiceId) => {
    try {
      const res = await axios.get(
        `${API_URL}/api/super/billing/invoices/${invoiceId}/pdf`,
        { headers: authHeaders(), responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${invoiceId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Erreur PDF');
    }
  };

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6" data-testid="super-billing-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-amber-400" />
            Facturation Compagnies
          </h1>
          <p className="text-sm text-slate-400">
            Suivi des agents connectés et facturation SaaS par compagnie active
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            max={currentMonth()}
            className="w-44 bg-slate-800 border-slate-700 text-white"
            data-testid="billing-month-input"
          />
          <Button onClick={loadAll} variant="outline" size="sm" className="border-slate-700" data-testid="billing-refresh-btn">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button
            onClick={() => generateInvoices(false)}
            disabled={generating}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
            data-testid="billing-generate-btn"
          >
            <FileText className="w-4 h-4 mr-2" />
            {generating ? 'Génération…' : 'Générer Factures'}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Building2} color="emerald" label="Compagnies actives" value={summary.active_companies} />
          <StatCard icon={Wifi} color="blue" label="Agents en ligne" value={summary.online_agents_now} />
          <StatCard icon={Clock} color="amber" label="Factures en attente" value={`${summary.invoices.pending.count} (${fmt(summary.invoices.pending.total)} HTG)`} />
          <StatCard icon={CheckCircle2} color="emerald" label="Factures payées" value={`${summary.invoices.paid.count} (${fmt(summary.invoices.paid.total)} HTG)`} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        <TabButton active={tab === 'companies'} onClick={() => setTab('companies')} testId="tab-companies">
          Compagnies & projections
        </TabButton>
        <TabButton active={tab === 'invoices'} onClick={() => setTab('invoices')} testId="tab-invoices">
          Factures ({invoices.length})
        </TabButton>
      </div>

      {tab === 'companies' && (
        <CompaniesTable
          companies={companies}
          loading={loading}
          onConfigure={openConfig}
        />
      )}

      {tab === 'invoices' && (
        <InvoicesTable
          invoices={invoices}
          loading={loading}
          onMark={markInvoice}
          onPdf={downloadPdf}
        />
      )}

      <ConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        company={configCompany}
        form={configForm}
        setForm={setConfigForm}
        onSave={saveConfig}
        saving={savingConfig}
      />
    </div>
  );
};

const StatCard = ({ icon: Icon, color, label, value }) => (
  <Card className="bg-slate-800/50 border-slate-700 p-3 sm:p-4">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-${color}-500/15`}>
        <Icon className={`w-5 h-5 text-${color}-400`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-base sm:text-lg font-bold text-white truncate">{value}</p>
      </div>
    </div>
  </Card>
);

const TabButton = ({ active, onClick, children, testId }) => (
  <button
    onClick={onClick}
    data-testid={testId}
    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      active
        ? 'border-amber-400 text-amber-400'
        : 'border-transparent text-slate-400 hover:text-white'
    }`}
  >
    {children}
  </button>
);

const CompaniesTable = ({ companies, loading, onConfigure }) => {
  if (loading) return <p className="text-slate-400 text-center py-8">Chargement…</p>;
  if (!companies.length) return <p className="text-slate-400 text-center py-8">Aucune compagnie active</p>;

  return (
    <div className="overflow-x-auto bg-slate-800/30 border border-slate-700 rounded-xl">
      <table className="w-full text-sm" data-testid="companies-table">
        <thead className="bg-slate-800/70 text-slate-300">
          <tr>
            <th className="text-left p-3">Compagnie</th>
            <th className="text-center p-3"><Users className="w-4 h-4 inline" /> Actifs</th>
            <th className="text-center p-3"><Wifi className="w-4 h-4 inline" /> En ligne</th>
            <th className="text-center p-3"><TrendingUp className="w-4 h-4 inline" /> Mensuels</th>
            <th className="text-center p-3">Vendeurs</th>
            <th className="text-right p-3">CA (HTG)</th>
            <th className="text-right p-3">Montant dû</th>
            <th className="text-center p-3">Mode</th>
            <th className="text-right p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.company_id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
              <td className="p-3">
                <div className="font-medium text-white">{c.name}</div>
                <div className="text-xs text-slate-500">{c.plan} · {c.slug}</div>
              </td>
              <td className="p-3 text-center text-slate-300">{c.counters.agents_active}</td>
              <td className="p-3 text-center">
                <span className={c.counters.agents_online_now > 0 ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                  {c.counters.agents_online_now}
                </span>
              </td>
              <td className="p-3 text-center text-slate-300">{c.counters.agents_monthly_active}</td>
              <td className="p-3 text-center text-slate-300">{c.counters.agents_monthly_sellers}</td>
              <td className="p-3 text-right text-slate-300">{fmt(c.revenue_htg)}</td>
              <td className="p-3 text-right font-bold text-amber-400" data-testid={`amount-${c.company_id}`}>
                {fmt(c.projected_amount)} {c.currency}
              </td>
              <td className="p-3 text-center text-xs text-slate-400">
                <div>{MODE_LABELS[c.billing_mode] || c.billing_mode}</div>
                <div className="text-slate-500">{COUNTING_LABELS[c.counting_method] || c.counting_method}</div>
              </td>
              <td className="p-3 text-right">
                <Button
                  onClick={() => onConfigure(c)}
                  variant="outline"
                  size="sm"
                  className="border-slate-700 hover:bg-slate-700"
                  data-testid={`configure-${c.company_id}`}
                >
                  <SettingsIcon className="w-3.5 h-3.5 mr-1" />
                  Configurer
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const InvoicesTable = ({ invoices, loading, onMark, onPdf }) => {
  if (loading) return <p className="text-slate-400 text-center py-8">Chargement…</p>;
  if (!invoices.length) {
    return (
      <div className="text-center py-12 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl">
        <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">Aucune facture pour cette période</p>
        <p className="text-xs text-slate-500 mt-1">Cliquez sur "Générer Factures" pour créer les factures du mois</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-slate-800/30 border border-slate-700 rounded-xl">
      <table className="w-full text-sm" data-testid="invoices-table">
        <thead className="bg-slate-800/70 text-slate-300">
          <tr>
            <th className="text-left p-3">Période</th>
            <th className="text-left p-3">Compagnie</th>
            <th className="text-center p-3">Agents</th>
            <th className="text-right p-3">Montant</th>
            <th className="text-center p-3">Statut</th>
            <th className="text-right p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const badge = STATUS_BADGE[inv.status] || STATUS_BADGE.pending;
            return (
              <tr key={inv.invoice_id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                <td className="p-3 font-medium text-white">{inv.period_label}</td>
                <td className="p-3">
                  <div className="text-white">{inv.company_name}</div>
                  <div className="text-xs text-slate-500">{inv.invoice_id}</div>
                </td>
                <td className="p-3 text-center text-slate-300">{inv.billable_agents}</td>
                <td className="p-3 text-right font-bold text-amber-400">
                  {fmt(inv.amount_due)} {inv.currency}
                </td>
                <td className="p-3 text-center">
                  <Badge className={badge.cls + ' border'} variant="outline">{badge.label}</Badge>
                </td>
                <td className="p-3 text-right space-x-1">
                  <Button
                    onClick={() => onPdf(inv.invoice_id)}
                    variant="outline"
                    size="sm"
                    className="border-slate-700"
                    data-testid={`pdf-${inv.invoice_id}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  {inv.status !== 'paid' && (
                    <Button
                      onClick={() => onMark(inv.invoice_id, 'paid')}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      data-testid={`mark-paid-${inv.invoice_id}`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Payée
                    </Button>
                  )}
                  {inv.status === 'paid' && (
                    <Button
                      onClick={() => onMark(inv.invoice_id, 'pending')}
                      variant="outline"
                      size="sm"
                      className="border-slate-700"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const ConfigDialog = ({ open, onOpenChange, company, form, setForm, onSave, saving }) => {
  if (!form) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-amber-400">Configurer la facturation</DialogTitle>
          <DialogDescription className="text-slate-400">
            {company?.name} — {company?.slug}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Mode de facturation</Label>
              <Select
                value={form.billing_mode}
                onValueChange={(v) => setForm({ ...form, billing_mode: v })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 mt-1" data-testid="config-mode-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-white">
                  <SelectItem value="fixed_per_agent">Tarif fixe par agent</SelectItem>
                  <SelectItem value="tiered">Paliers progressifs</SelectItem>
                  <SelectItem value="percentage">% du chiffre d'affaires</SelectItem>
                  <SelectItem value="custom">Manuel (sans calcul)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300">Méthode de comptage</Label>
              <Select
                value={form.counting_method}
                onValueChange={(v) => setForm({ ...form, counting_method: v })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 mt-1" data-testid="config-counting-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-white">
                  <SelectItem value="active">Tous agents ACTIFS</SelectItem>
                  <SelectItem value="online_now">En ligne maintenant</SelectItem>
                  <SelectItem value="monthly_active">Connectés ce mois</SelectItem>
                  <SelectItem value="monthly_sellers">Ayant vendu ce mois</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.billing_mode === 'fixed_per_agent' && (
            <div>
              <Label className="text-slate-300">Tarif par agent (HTG / mois)</Label>
              <Input
                type="number"
                value={form.rate_per_agent}
                onChange={(e) => setForm({ ...form, rate_per_agent: parseFloat(e.target.value) || 0 })}
                className="bg-slate-800 border-slate-700 mt-1"
                data-testid="config-rate-input"
              />
            </div>
          )}

          {form.billing_mode === 'percentage' && (
            <div>
              <Label className="text-slate-300">Pourcentage du CA (ex: 0.02 = 2%)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.percentage_rate}
                onChange={(e) => setForm({ ...form, percentage_rate: parseFloat(e.target.value) || 0 })}
                className="bg-slate-800 border-slate-700 mt-1"
                data-testid="config-pct-input"
              />
            </div>
          )}

          <div>
            <Label className="text-slate-300">Notes (optionnel)</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Conditions de paiement, contact, etc."
              className="bg-slate-800 border-slate-700 mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-700">
            Annuler
          </Button>
          <Button
            onClick={onSave}
            disabled={saving}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
            data-testid="config-save-btn"
          >
            {saving ? 'Sauvegarde…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SuperBillingPage;
