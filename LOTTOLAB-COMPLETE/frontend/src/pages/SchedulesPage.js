import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { toast } from 'sonner';
import { CalendarClock, Eye, Clock, RefreshCw } from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Lundi' },
  { value: 1, label: 'Mardi' },
  { value: 2, label: 'Mercredi' },
  { value: 3, label: 'Jeudi' },
  { value: 4, label: 'Vendredi' },
  { value: 5, label: 'Samedi' },
  { value: 6, label: 'Dimanche' }
];

// READ-ONLY Schedules page for Company Admin
// Schedules are managed globally by Super Admin
export const SchedulesPage = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      // Fetch global schedules (read-only for company admin)
      const res = await apiClient.get('/company/schedules');
      setSchedules(res.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des horaires');
    } finally {
      setLoading(false);
    }
  };

  const getDaysLabel = (daysArray) => {
    if (!daysArray || daysArray.length === 0) return 'Tous les jours';
    return daysArray.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.label || '').join(', ');
  };

  if (loading) {
    return (
      <AdminLayout title="Schedules (View)" subtitle="Vue des horaires de loterie - Lecture seule" role="COMPANY_ADMIN">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Schedules (View)" subtitle="Vue des horaires de loterie - Lecture seule" role="COMPANY_ADMIN">
      <div className="space-y-6">
        {/* Header with read-only indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Eye className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <span className="text-slate-300">{schedules.length} schedules globaux</span>
              <p className="text-slate-500 text-sm">Géré par Super Admin - Lecture seule</p>
            </div>
          </div>
          <button
            onClick={fetchSchedules}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            data-testid="refresh-schedules"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Schedule list - READ ONLY */}
        <div className="bg-card border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="schedules-readonly-table">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Loterie</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">État</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Tirage</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Jours</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Ouverture</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Fermeture</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Heure Tirage</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {schedules.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                      <CalendarClock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Aucun schedule global configuré</p>
                      <p className="text-sm mt-1">Contactez le Super Admin pour configurer les horaires</p>
                    </td>
                  </tr>
                ) : (
                  schedules.map((schedule) => (
                    <tr key={schedule.schedule_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white">
                        {schedule.lottery_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {schedule.state_code || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded">
                          {schedule.draw_name || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {getDaysLabel(schedule.days_of_week)}
                      </td>
                      <td className="px-6 py-4 text-sm text-emerald-400 font-mono">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {schedule.open_time}
                      </td>
                      <td className="px-6 py-4 text-sm text-orange-400 font-mono">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {schedule.close_time}
                      </td>
                      <td className="px-6 py-4 text-sm text-cyan-400 font-mono">
                        {schedule.draw_time}
                      </td>
                      <td className="px-6 py-4">
                        {schedule.is_active ? (
                          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                            Actif
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                            Inactif
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Read-only notice */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 text-center">
          <Eye className="w-6 h-6 mx-auto mb-2 text-purple-400" />
          <p className="text-slate-400 text-sm">
            Les horaires des loteries sont gérés globalement par le Super Admin.
            <br />
            Cette vue est en lecture seule.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
};
