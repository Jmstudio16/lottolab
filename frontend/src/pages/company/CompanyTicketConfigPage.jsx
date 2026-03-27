import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  FileText, Save, RefreshCw, Eye, Type, Smartphone, QrCode,
  AlertCircle, Check, Printer, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import axios from 'axios';
import { API_URL } from '@/config/api';
import { useAuth } from '@/api/auth';

/**
 * CompanyTicketConfigPage - Configuration des textes du ticket
 * Permet à l'admin de modifier tous les textes affichés sur les tickets
 */
const CompanyTicketConfigPage = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  
  const [config, setConfig] = useState({
    company_name: '',
    slogan: 'JOUER POU GENYEN',
    phone: '',
    address: '',
    logo_url: '',
    ticket_header_text: '',
    ticket_footer_text: '',
    ticket_thank_you_text: '',
    ticket_legal_text: '',
    qr_code_enabled: true,
    ticket_font_size: 'normal',
    paper_width: '80mm'
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/export/ticket-text-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfig(res.data);
    } catch (error) {
      console.error('Error loading config:', error);
      toast.error('Erreur lors du chargement de la configuration');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/export/ticket-text-config`, config, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Configuration sauvegardée avec succès');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const openPreview = () => {
    // Open a sample ticket preview
    window.open(`${API_URL}/api/ticket/preview?token=${token}`, '_blank', 'width=400,height=700');
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
            <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-purple-400" />
            Configuration du Ticket
          </h1>
          <p className="text-sm text-slate-400">Personnalisez les textes affichés sur vos tickets</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={openPreview}
            variant="outline"
            className="border-purple-700 text-purple-400"
          >
            <Eye className="w-4 h-4 mr-2" />
            Aperçu
          </Button>
          <Button
            onClick={saveConfig}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Sauvegarder
          </Button>
        </div>
      </div>

      {/* Company Info Section */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" />
          Informations Entreprise
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Nom de l'entreprise</label>
            <input
              type="text"
              value={config.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-base"
              placeholder="LOTO PAM CENTER"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">Slogan</label>
            <input
              type="text"
              value={config.slogan}
              onChange={(e) => handleChange('slogan', e.target.value)}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-base"
              placeholder="JOUER POU GENYEN"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">Téléphone</label>
            <input
              type="text"
              value={config.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-base"
              placeholder="+509 XXXX-XXXX"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">Adresse</label>
            <input
              type="text"
              value={config.address}
              onChange={(e) => handleChange('address', e.target.value)}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-base"
              placeholder="Pétion-Ville, Haiti"
            />
          </div>
        </div>
      </div>

      {/* Ticket Text Section */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Type className="w-5 h-5 text-purple-400" />
          Textes du Ticket
        </h2>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Texte en haut du ticket (après les infos)</label>
            <input
              type="text"
              value={config.ticket_header_text}
              onChange={(e) => handleChange('ticket_header_text', e.target.value)}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-base"
              placeholder="Texte optionnel en haut"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">Message de remerciement</label>
            <input
              type="text"
              value={config.ticket_thank_you_text}
              onChange={(e) => handleChange('ticket_thank_you_text', e.target.value)}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-base"
              placeholder="MERCI POUR VOTRE CONFIANCE"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">Texte légal (conditions)</label>
            <textarea
              value={config.ticket_legal_text}
              onChange={(e) => handleChange('ticket_legal_text', e.target.value)}
              rows={5}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-base resize-none"
              placeholder="Vérifiez votre ticket avant de vous déplacer.&#10;Ce ticket doit être payé UNE SEULE FOIS..."
            />
            <p className="text-xs text-slate-500">Chaque ligne sera affichée séparément sur le ticket</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">Texte en bas du ticket (avant LOTTOLAB.TECH)</label>
            <input
              type="text"
              value={config.ticket_footer_text}
              onChange={(e) => handleChange('ticket_footer_text', e.target.value)}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-base"
              placeholder="Texte optionnel en bas"
            />
          </div>
        </div>
      </div>

      {/* Print Settings Section */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Printer className="w-5 h-5 text-emerald-400" />
          Paramètres d'Impression
        </h2>

        {/* Paper Width */}
        <div className="space-y-2">
          <label className="text-sm text-slate-400">Largeur du papier</label>
          <div className="flex gap-3">
            {['58mm', '80mm'].map((width) => (
              <button
                key={width}
                onClick={() => handleChange('paper_width', width)}
                className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                  config.paper_width === width
                    ? 'border-emerald-500 bg-emerald-500/20 text-white'
                    : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="text-lg font-bold">{width}</span>
                <p className="text-xs text-slate-400 mt-1">
                  {width === '58mm' ? 'Portable' : 'Standard POS'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Font Size */}
        <div className="space-y-2">
          <label className="text-sm text-slate-400">Taille de police (lisibilité)</label>
          <div className="flex gap-2">
            {[
              { value: 'small', label: 'Petit', desc: '10px' },
              { value: 'normal', label: 'Normal', desc: '12px - Recommandé' },
              { value: 'large', label: 'Grand', desc: '14px - Pour lunettes' }
            ].map((size) => (
              <button
                key={size.value}
                onClick={() => handleChange('ticket_font_size', size.value)}
                className={`flex-1 p-3 rounded-lg border transition-all ${
                  config.ticket_font_size === size.value
                    ? 'border-emerald-500 bg-emerald-500/20 text-white'
                    : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="font-bold">{size.label}</span>
                <p className="text-xs text-slate-400">{size.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* QR Code Toggle */}
        <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
          <div className="flex items-center gap-3">
            <QrCode className="w-5 h-5 text-cyan-400" />
            <div>
              <p className="text-white font-medium">Afficher QR Code</p>
              <p className="text-xs text-slate-400">Code QR pour vérification rapide</p>
            </div>
          </div>
          <Switch
            checked={config.qr_code_enabled}
            onCheckedChange={(checked) => handleChange('qr_code_enabled', checked)}
          />
        </div>
      </div>

      {/* Preview Section */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5 text-amber-400" />
          Aperçu du Ticket
        </h2>
        
        <div className="bg-white text-black p-4 rounded-lg font-mono text-xs max-w-[300px] mx-auto">
          <div className="text-center space-y-1">
            <div className="text-sm font-bold">{config.company_name || 'NOM ENTREPRISE'}</div>
            {config.slogan && <div className="italic">{config.slogan}</div>}
            {config.phone && <div>Tél: {config.phone}</div>}
            {config.address && <div>{config.address}</div>}
            <div className="py-2">================================</div>
            <div>VENDEUR : Jean Pierre</div>
            <div>SUCCURSALE : Delmas 33</div>
            <div>TICKET : LT-93847291</div>
            <div className="py-1">--------------------------------</div>
            <div>LOTERIE : IL Pick 3 Evening</div>
            <div>TIRAGE : SOIR</div>
            <div>DATE : 24/03/2026</div>
            <div>HEURE : 08:59 PM</div>
            <div className="py-1">--------------------------------</div>
            <div className="font-bold">NUMÉROS JOUÉS</div>
            <div>45 ................. 10 HTG</div>
            <div className="py-1">--------------------------------</div>
            <div className="font-bold text-base">TOTAL : 10 HTG</div>
            <div className="py-2">================================</div>
            <div className="font-bold border-2 border-black inline-block px-4 py-1">STATUT : VALIDÉ</div>
            <div className="py-2">--------------------------------</div>
            <div>{config.ticket_thank_you_text || 'MERCI POUR VOTRE CONFIANCE'}</div>
            <div className="font-bold">{config.company_name || 'NOM ENTREPRISE'}</div>
            <div className="py-1">--------------------------------</div>
            <div className="text-[8px] whitespace-pre-wrap">{config.ticket_legal_text?.slice(0, 100) || 'Texte légal...'}</div>
            <div className="py-1">--------------------------------</div>
            <div className="font-bold">LOTTOLAB.TECH</div>
            <div>================================</div>
          </div>
        </div>
      </div>

      {/* Save Button Mobile */}
      <div className="lg:hidden fixed bottom-20 left-4 right-4">
        <Button
          onClick={saveConfig}
          disabled={saving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 h-12"
        >
          {saving ? (
            <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Save className="w-5 h-5 mr-2" />
          )}
          Sauvegarder la Configuration
        </Button>
      </div>
    </div>
  );
};

export default CompanyTicketConfigPage;
