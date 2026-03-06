import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import apiClient from '@/api/client';
import { toast } from 'sonner';
import { Trophy, Eye, Calendar, RefreshCw, Filter } from 'lucide-react';

// READ-ONLY Results page for Company Admin
// Results are entered globally by Super Admin
export const CompanyResultsPage = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    fetchResults();
  }, [filterDate]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      // Fetch global results (read-only for company admin)
      const params = {};
      if (filterDate) params.draw_date = filterDate;
      const res = await apiClient.get('/company/results', { params });
      setResults(res.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des résultats');
    } finally {
      setLoading(false);
    }
  };

  if (loading && results.length === 0) {
    return (
      <AdminLayout title="Results (View)" subtitle="Vue des résultats de loterie - Lecture seule" role="COMPANY_ADMIN">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Results (View)" subtitle="Vue des résultats de loterie - Lecture seule" role="COMPANY_ADMIN">
      <div className="space-y-6">
        {/* Header with read-only indicator */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Eye className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <span className="text-slate-300">{results.length} résultats</span>
              <p className="text-slate-500 text-sm">Entré par Super Admin - Lecture seule</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                data-testid="filter-date"
              />
            </div>
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors text-sm"
              >
                Effacer
              </button>
            )}
            <button
              onClick={fetchResults}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
              data-testid="refresh-results"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Results list - READ ONLY */}
        <div className="bg-card border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="results-readonly-table">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Loterie</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">État</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Tirage</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Numéros Gagnants</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Bonus</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Vérifié</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                      <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Aucun résultat trouvé</p>
                      <p className="text-sm mt-1">Les résultats sont entrés par le Super Admin</p>
                    </td>
                  </tr>
                ) : (
                  results.map((result) => (
                    <tr key={result.result_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white">
                        {result.lottery_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {result.state_code || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {result.draw_date}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded">
                          {result.draw_name || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const wn = result.winning_numbers;
                            if (!wn) return null;
                            let nums = [];
                            if (typeof wn === 'object') {
                              if (wn.first) nums.push(wn.first);
                              if (wn.second) nums.push(wn.second);
                              if (wn.third) nums.push(wn.third);
                            } else if (typeof wn === 'string') {
                              nums = wn.split(/[-,\s]+/).filter(n => n);
                            }
                            return nums.map((num, idx) => (
                              <span
                                key={idx}
                                className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-lg ${
                                  idx === 0 ? 'bg-amber-500 text-black' :
                                  idx === 1 ? 'bg-slate-400 text-black' :
                                  'bg-amber-700 text-white'
                                }`}
                              >
                                {num}
                              </span>
                            ));
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-cyan-400 font-mono">
                        {result.bonus_number || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {result.is_verified ? (
                          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                            Vérifié
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                            En attente
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
          <Eye className="w-6 h-6 mx-auto mb-2 text-amber-400" />
          <p className="text-slate-400 text-sm">
            Les résultats des loteries sont entrés globalement par le Super Admin.
            <br />
            Cette vue est en lecture seule. Tous les résultats sont automatiquement visibles.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
};
