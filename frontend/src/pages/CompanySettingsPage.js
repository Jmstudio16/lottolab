import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Settings, Save } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TIMEZONES = [
  { value: 'America/Port-au-Prince', label: 'Haiti (Port-au-Prince)' },
  { value: 'America/New_York', label: 'US Eastern (New York)' },
  { value: 'America/Chicago', label: 'US Central (Chicago)' },
  { value: 'America/Denver', label: 'US Mountain (Denver)' },
  { value: 'America/Los_Angeles', label: 'US Pacific (Los Angeles)' },
  { value: 'America/Santo_Domingo', label: 'Dominican Republic' },
  { value: 'America/Jamaica', label: 'Jamaica' }
];

const CURRENCIES = [
  { value: 'HTG', label: 'Haitian Gourde (HTG)' },
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'DOP', label: 'Dominican Peso (DOP)' },
  { value: 'JMD', label: 'Jamaican Dollar (JMD)' }
];

export const CompanySettingsPage = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await apiClient.get('/company/settings');
      setSettings(response.data);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await apiClient.put('/company/settings', {
        timezone: settings.timezone,
        currency: settings.currency,
        stop_sales_before_draw_minutes: settings.stop_sales_before_draw_minutes,
        allow_ticket_void: settings.allow_ticket_void,
        max_ticket_amount: settings.max_ticket_amount,
        min_ticket_amount: settings.min_ticket_amount,
        auto_print_ticket: settings.auto_print_ticket,
        receipt_header: settings.receipt_header,
        receipt_footer: settings.receipt_footer
      });
      setSettings(response.data);
      toast.success('Settings saved successfully!');
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to save settings';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Settings" subtitle="Company configuration" role="COMPANY_ADMIN">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Settings" subtitle="Company configuration" role="COMPANY_ADMIN">
      <div className="max-w-3xl space-y-6">
        {/* General Settings */}
        <div className="bg-card border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Settings className="w-5 h-5 text-yellow-400" />
            General Settings
          </h3>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-slate-300">Timezone</Label>
                <Select 
                  value={settings?.timezone || 'America/Port-au-Prince'} 
                  onValueChange={(val) => setSettings({...settings, timezone: val})}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-white mt-1" data-testid="settings-timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {TIMEZONES.map(tz => (
                      <SelectItem key={tz.value} value={tz.value} className="text-white">
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">Currency</Label>
                <Select 
                  value={settings?.currency || 'HTG'} 
                  onValueChange={(val) => setSettings({...settings, currency: val})}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-white mt-1" data-testid="settings-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {CURRENCIES.map(c => (
                      <SelectItem key={c.value} value={c.value} className="text-white">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Sales Settings */}
        <div className="bg-card border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Sales Settings</h3>
          <div className="space-y-6">
            <div>
              <Label className="text-slate-300">Stop Sales Before Draw (minutes)</Label>
              <Input
                type="number"
                value={settings?.stop_sales_before_draw_minutes || 5}
                onChange={(e) => setSettings({...settings, stop_sales_before_draw_minutes: parseInt(e.target.value)})}
                min={1}
                max={60}
                className="bg-slate-950 border-slate-700 text-white mt-1 w-32"
                data-testid="settings-stop-sales-minutes"
              />
              <p className="text-slate-500 text-sm mt-1">Sales will be blocked this many minutes before the draw</p>
            </div>
            
            <div>
              <Label className="text-slate-300">Maximum Ticket Amount</Label>
              <Input
                type="number"
                value={settings?.max_ticket_amount || 100000}
                onChange={(e) => setSettings({...settings, max_ticket_amount: parseFloat(e.target.value)})}
                min={1}
                className="bg-slate-950 border-slate-700 text-white mt-1"
                data-testid="settings-max-amount"
              />
              <p className="text-slate-500 text-sm mt-1">Pas de limite minimum</p>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-slate-800">
              <div>
                <p className="text-white font-medium">Allow Ticket Void</p>
                <p className="text-slate-500 text-sm">Allow agents to void tickets</p>
              </div>
              <Switch
                checked={settings?.allow_ticket_void ?? true}
                onCheckedChange={(checked) => setSettings({...settings, allow_ticket_void: checked})}
                data-testid="settings-allow-void"
              />
            </div>

            <div className="flex items-center justify-between py-3 border-t border-slate-800">
              <div>
                <p className="text-white font-medium">Auto Print Ticket</p>
                <p className="text-slate-500 text-sm">Automatically print ticket after sale</p>
              </div>
              <Switch
                checked={settings?.auto_print_ticket ?? true}
                onCheckedChange={(checked) => setSettings({...settings, auto_print_ticket: checked})}
                data-testid="settings-auto-print"
              />
            </div>
          </div>
        </div>

        {/* Receipt Settings */}
        <div className="bg-card border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Receipt Settings</h3>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Receipt Header</Label>
              <Input
                value={settings?.receipt_header || ''}
                onChange={(e) => setSettings({...settings, receipt_header: e.target.value})}
                placeholder="Company name or custom header text"
                className="bg-slate-950 border-slate-700 text-white mt-1"
                data-testid="settings-receipt-header"
              />
            </div>
            <div>
              <Label className="text-slate-300">Receipt Footer</Label>
              <Input
                value={settings?.receipt_footer || ''}
                onChange={(e) => setSettings({...settings, receipt_footer: e.target.value})}
                placeholder="Thank you message or contact info"
                className="bg-slate-950 border-slate-700 text-white mt-1"
                data-testid="settings-receipt-footer"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="button-primary"
            data-testid="save-settings-button"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};
