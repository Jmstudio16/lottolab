import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/api/auth';
import { AdminLayout } from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  Shield, CheckCircle, XCircle, Clock, 
  Loader2, RefreshCw, User, FileText, Calendar
} from 'lucide-react';

const SuperOnlineKYCPage = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/online-admin/kyc/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setSubmissions(data.submissions || []);
    } catch (error) {
      console.error('Failed to load KYC submissions:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const processKYC = async (submissionId, approved, notes = '') => {
    setProcessing(submissionId);
    try {
      const response = await fetch(`${API_URL}/api/online-admin/kyc/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          submission_id: submissionId,
          approved: approved,
          notes: notes
        })
      });

      if (response.ok) {
        toast.success(approved ? 'KYC approuvé!' : 'KYC rejeté');
        loadSubmissions();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Erreur lors du traitement');
      }
    } catch (error) {
      toast.error('Erreur lors du traitement');
    } finally {
      setProcessing(null);
    }
  };

  const getDocumentTypeLabel = (type) => {
    const labels = {
      id_card: 'Carte d\'Identité Nationale (CIN)',
      passport: 'Passeport',
      driver_license: 'Permis de Conduire'
    };
    return labels[type] || type;
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-yellow-400" />
              Vérification KYC
            </h1>
            <p className="text-slate-400">Vérifiez les documents d'identité des joueurs</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">
              {submissions.length} en attente
            </span>
            <button
              onClick={loadSubmissions}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <h3 className="font-bold text-yellow-400 mb-2">Processus de Vérification</h3>
          <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
            <li>Vérifiez que le numéro de document est valide et correspond au format attendu</li>
            <li>Contactez le joueur par téléphone si nécessaire pour confirmer son identité</li>
            <li>L'approbation KYC débloque les retraits pour le joueur</li>
          </ul>
        </div>

        {/* KYC Submissions */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
          </div>
        ) : submissions.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {submissions.map((submission) => (
              <div
                key={submission.submission_id}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4"
              >
                {/* Player Info */}
                <div className="flex items-center gap-3 pb-4 border-b border-slate-700">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-lg font-bold text-slate-900">
                    {submission.player?.full_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-white">{submission.player?.full_name}</p>
                    <p className="text-sm text-slate-400">@{submission.player?.username}</p>
                  </div>
                </div>

                {/* Document Info */}
                <div className="space-y-3">
                  <div className="p-3 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-yellow-400" />
                      <span className="text-sm text-slate-400">Type de Document</span>
                    </div>
                    <p className="text-white font-medium">{getDocumentTypeLabel(submission.document_type)}</p>
                  </div>

                  <div className="p-3 bg-slate-900/50 rounded-lg">
                    <p className="text-sm text-slate-400 mb-1">Numéro du Document</p>
                    <p className="text-xl font-mono font-bold text-yellow-400">{submission.document_number}</p>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="text-sm text-slate-400">
                  <p>Email: {submission.player?.email}</p>
                  <p>Tél: {submission.player?.phone || 'Non renseigné'}</p>
                </div>

                {/* Date */}
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Calendar className="w-4 h-4" />
                  Soumis le {new Date(submission.created_at).toLocaleDateString('fr-FR')}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => processKYC(submission.submission_id, true)}
                    disabled={processing === submission.submission_id}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {processing === submission.submission_id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approuver
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => processKYC(submission.submission_id, false, 'Document invalide ou information incorrecte')}
                    disabled={processing === submission.submission_id}
                    variant="outline"
                    className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Rejeter
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400 opacity-50" />
            <h3 className="text-xl font-bold text-white mb-2">Aucune demande KYC en attente</h3>
            <p className="text-slate-400">Toutes les vérifications ont été traitées</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default SuperOnlineKYCPage;
