import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Settings } from 'lucide-react';

export const SuperSettingsPage = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    platform_name: '',
    default_currency: '',
    default_timezone: '',
    ticket_code_length: '',
    verification_code_length: '',
    maintenance_mode: false,
    allow_company_registration: false
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await apiClient.get('/super/settings');
      setSettings(response.data);
      setFormData({
        platform_name: response.data.platform_name,
        default_currency: response.data.default_currency,
        default_timezone: response.data.default_timezone,
        ticket_code_length: response.data.ticket_code_length.toString(),
        verification_code_length: response.data.verification_code_length.toString(),
        maintenance_mode: response.data.maintenance_mode,
        allow_company_registration: response.data.allow_company_registration
      });
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        ...formData,
        ticket_code_length: parseInt(formData.ticket_code_length),
        verification_code_length: parseInt(formData.verification_code_length)
      };
      await apiClient.put('/super/settings', data);
      toast.success('Settings updated successfully!');
      fetchSettings();
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="System Settings" subtitle="Configure platform settings" role="SUPER_ADMIN">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="System Settings" subtitle="Configure platform settings" role="SUPER_ADMIN">
      <div className="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Platform Settings */}
          <div className="bg-card border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-lg font-barlow font-bold text-white mb-4">Platform Settings</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-slate-300">Platform Name</Label>
                <Input
                  value={formData.platform_name}
                  onChange={(e) => setFormData({...formData, platform_name: e.target.value})}
                  className="bg-slate-950 border-slate-700 text-white"
                  data-testid="platform-name-input"
                />
              </div>
              <div>
                <Label className="text-slate-300">Default Currency</Label>
                <select
                  value={formData.default_currency}
                  onChange={(e) => setFormData({...formData, default_currency: e.target.value})}
                  className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-white"
                  data-testid="currency-select"
                >
                  <option value="HTG">HTG - Haitian Gourde</option>
                  <option value="USD">USD - US Dollar</option>
                </select>
              </div>
              <div>
                <Label className="text-slate-300">Default Timezone</Label>
                <select
                  value={formData.default_timezone}
                  onChange={(e) => setFormData({...formData, default_timezone: e.target.value})}
                  className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-white"
                  data-testid="timezone-select"
                >
                  <option value="America/Port-au-Prince">America/Port-au-Prince</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Chicago">America/Chicago</option>
                  <option value="America/Los_Angeles">America/Los_Angeles</option>
                </select>
              </div>
            </div>
          </div>

          {/* Ticket Settings */}
          <div className="bg-card border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-lg font-barlow font-bold text-white mb-4">Ticket Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Ticket Code Length</Label>
                <Input
                  type="number"
                  min="8"
                  max="20"
                  value={formData.ticket_code_length}
                  onChange={(e) => setFormData({...formData, ticket_code_length: e.target.value})}
                  className="bg-slate-950 border-slate-700 text-white"
                  data-testid="ticket-code-length-input"
                />
              </div>
              <div>
                <Label className="text-slate-300">Verification Code Length</Label>
                <Input
                  type="number"
                  min="6"
                  max="20"
                  value={formData.verification_code_length}
                  onChange={(e) => setFormData({...formData, verification_code_length: e.target.value})}
                  className="bg-slate-950 border-slate-700 text-white"
                  data-testid="verification-code-length-input"
                />
              </div>
            </div>
          </div>

          {/* System Toggles */}
          <div className="bg-card border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-lg font-barlow font-bold text-white mb-4">System Controls</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-slate-300">Maintenance Mode</Label>
                  <p className="text-xs text-slate-500 mt-1">Temporarily disable the platform for all users</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, maintenance_mode: !formData.maintenance_mode})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.maintenance_mode ? 'bg-yellow-400' : 'bg-slate-700'
                  }`}
                  data-testid="maintenance-mode-toggle"
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.maintenance_mode ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-slate-300">Allow Company Registration</Label>
                  <p className="text-xs text-slate-500 mt-1">Enable self-service company sign-ups</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, allow_company_registration: !formData.allow_company_registration})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.allow_company_registration ? 'bg-green-400' : 'bg-slate-700'
                  }`}
                  data-testid="registration-toggle"
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.allow_company_registration ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="button-primary" data-testid="save-settings-button">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>

        {/* Info */}
        {settings && (
          <div className="mt-6 p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
            <p className="text-xs text-slate-500">
              Last updated: {new Date(settings.updated_at).toLocaleString()}
              {settings.updated_by && ` by user ${settings.updated_by}`}
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};