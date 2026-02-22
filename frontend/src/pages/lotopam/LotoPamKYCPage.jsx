import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLotoPamAuth } from '../../context/LotoPamAuthContext';
import LotoPamLayout from '../../layouts/LotoPamLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Shield, FileText, Camera, CheckCircle, Clock, 
  XCircle, AlertTriangle, Loader2, Upload, CreditCard
} from 'lucide-react';

const LotoPamKYCPage = () => {
  const { t } = useTranslation();
  const { isAuthenticated, player, apiClient } = useLotoPamAuth();
  const [kycStatus, setKycStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    document_type: 'id_card',
    document_number: ''
  });

  useEffect(() => {
    if (isAuthenticated) {
      loadKYCStatus();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadKYCStatus = async () => {
    try {
      const response = await apiClient.get('/api/online/kyc/status');
      setKycStatus(response.data);
    } catch (error) {
      console.error('Failed to load KYC status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.document_number || form.document_number.length < 5) {
      toast.error('Numéro de document invalide');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/api/online/kyc/submit', {
        document_type: form.document_type,
        document_number: form.document_number
      });
      toast.success('Documents soumis avec succès!');
      loadKYCStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la soumission');
    } finally {
      setSubmitting(false);
    }
  };

  const documentTypes = [
    { value: 'id_card', label: 'Carte d\'Identité Nationale (CIN)', icon: CreditCard },
    { value: 'passport', label: 'Passeport', icon: FileText },
    { value: 'driver_license', label: 'Permis de Conduire', icon: FileText }
  ];

  const getStatusDisplay = () => {
    if (!kycStatus) return null;
    
    const playerStatus = kycStatus.player_status;
    const kycSubmissionStatus = kycStatus.kyc_status;

    if (playerStatus === 'verified') {
      return (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8 text-center">
          <CheckCircle className="w-20 h-20 mx-auto mb-4 text-green-400" />
          <h2 className="text-2xl font-bold text-white mb-2">Compte Vérifié</h2>
          <p className="text-slate-400">
            Votre identité a été vérifiée. Vous pouvez maintenant effectuer des retraits.
          </p>
        </div>
      );
    }

    if (kycSubmissionStatus === 'pending' || kycStatus.submission?.status === 'pending') {
      return (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-8 text-center">
          <Clock className="w-20 h-20 mx-auto mb-4 text-yellow-400 animate-pulse" />
          <h2 className="text-2xl font-bold text-white mb-2">Vérification en Cours</h2>
          <p className="text-slate-400 mb-4">
            Vos documents sont en cours de vérification. Cela peut prendre jusqu'à 24 heures.
          </p>
          {kycStatus.submission && (
            <div className="mt-6 p-4 bg-slate-800/50 rounded-xl">
              <p className="text-sm text-slate-400">Document soumis:</p>
              <p className="text-white font-medium">{kycStatus.submission.document_type}</p>
              <p className="text-sm text-slate-500 mt-1">
                Soumis le {new Date(kycStatus.submission.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          )}
        </div>
      );
    }

    if (kycSubmissionStatus === 'rejected' || kycStatus.submission?.status === 'rejected') {
      return (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center mb-8">
          <XCircle className="w-20 h-20 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold text-white mb-2">Vérification Rejetée</h2>
          <p className="text-slate-400 mb-2">
            Votre demande de vérification a été rejetée.
          </p>
          {kycStatus.submission?.notes && (
            <p className="text-red-400 text-sm">
              Raison: {kycStatus.submission.notes}
            </p>
          )}
          <p className="text-slate-400 mt-4">
            Veuillez soumettre de nouveaux documents ci-dessous.
          </p>
        </div>
      );
    }

    return null;
  };

  if (!isAuthenticated) {
    return (
      <LotoPamLayout>
        <div className="max-w-2xl mx-auto py-20 text-center px-4">
          <Shield className="w-20 h-20 mx-auto mb-6 text-yellow-400 opacity-50" />
          <h2 className="text-3xl font-bold text-white mb-4">Connectez-vous pour vérifier votre compte</h2>
          <Link
            to="/lotopam/login"
            className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-slate-900 font-bold rounded-xl hover:shadow-xl transition-all inline-block"
          >
            Se Connecter
          </Link>
        </div>
      </LotoPamLayout>
    );
  }

  if (loading) {
    return (
      <LotoPamLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-12 h-12 animate-spin text-yellow-400" />
        </div>
      </LotoPamLayout>
    );
  }

  return (
    <LotoPamLayout>
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <Shield className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
          <h1 className="text-3xl font-bold text-white mb-2">{t('lotopam.kyc')}</h1>
          <p className="text-slate-400">Vérifiez votre identité pour activer les retraits</p>
        </div>

        {/* Status Display */}
        {getStatusDisplay()}

        {/* Show form if not verified and no pending submission */}
        {player?.status !== 'verified' && kycStatus?.submission?.status !== 'pending' && (
          <>
            {/* Why KYC Info */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                Pourquoi vérifier votre identité ?
              </h3>
              <ul className="space-y-3 text-slate-300">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Protéger votre compte contre les accès non autorisés</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Permettre les retraits vers MonCash et NatCash</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Se conformer aux régulations de jeu en Haïti</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Augmenter les limites de transactions</span>
                </li>
              </ul>
            </div>

            {/* KYC Form */}
            <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-6">Soumettre vos Documents</h3>

              {/* Document Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Type de Document *
                </label>
                <div className="space-y-3">
                  {documentTypes.map((doc) => (
                    <label
                      key={doc.value}
                      className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${
                        form.document_type === doc.value
                          ? 'bg-yellow-500/20 border-2 border-yellow-500'
                          : 'bg-slate-900/50 border border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="document_type"
                        value={doc.value}
                        checked={form.document_type === doc.value}
                        onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                        className="hidden"
                      />
                      <doc.icon className={`w-6 h-6 ${
                        form.document_type === doc.value ? 'text-yellow-400' : 'text-slate-400'
                      }`} />
                      <span className={form.document_type === doc.value ? 'text-white' : 'text-slate-300'}>
                        {doc.label}
                      </span>
                      {form.document_type === doc.value && (
                        <CheckCircle className="w-5 h-5 text-yellow-400 ml-auto" />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Document Number */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Numéro du Document *
                </label>
                <Input
                  type="text"
                  value={form.document_number}
                  onChange={(e) => setForm({ ...form, document_number: e.target.value })}
                  className="bg-slate-900 border-slate-600 text-white h-12"
                  placeholder="Ex: 00-00-00-0000-00"
                  required
                  minLength={5}
                  data-testid="kyc-document-number"
                />
              </div>

              {/* Note about document upload */}
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-sm text-blue-300">
                  <strong>Note:</strong> Pour une vérification complète, un agent vous contactera peut-être 
                  pour demander des photos de votre document. Assurez-vous que votre numéro de téléphone est correct.
                </p>
              </div>

              <Button
                type="submit"
                disabled={submitting || !form.document_number}
                className="w-full h-12 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-slate-900 font-bold text-lg disabled:opacity-50"
                data-testid="kyc-submit"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Soumettre pour Vérification
                  </>
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </LotoPamLayout>
  );
};

export default LotoPamKYCPage;
