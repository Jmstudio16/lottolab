import { API_URL } from '@/config/api';
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLogoContext } from '../../contexts/LogoContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { useToast } from '../../hooks/use-toast';
import { Loader2, Upload, Trash2, Building2, Phone, Mail, MapPin, Image as ImageIcon, Check, QrCode, FileText, DollarSign, Award, Info } from 'lucide-react';
import axios from 'axios';


const CompanySettingsPage = () => {
  const { t } = useTranslation();
  const { refreshLogo, displayLogoUrl, systemLogoUrl, companyLogoUrl, companyName } = useLogoContext();
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [settings, setSettings] = useState({
    company_name: '',
    company_phone: '',
    company_email: '',
    company_address: '',
    ticket_header_text: '',
    ticket_footer_text: '',
    ticket_legal_text: '',
    ticket_thank_you_text: '',
    qr_code_enabled: true,
    min_bet_amount: 1,
    max_bet_amount: 999999
  });

  // Prime configuration state
  const [primes, setPrimes] = useState({
    prime_borlette: '60|20|10',
    prime_loto3: '500',
    prime_loto4: '5000',
    prime_loto5: '50000',
    prime_mariage: '750',
    prime_mariage_gratuit: '750'
  });
  const [savingPrimes, setSavingPrimes] = useState(false);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState(null);
  const [hasCompanyLogo, setHasCompanyLogo] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchPrimes();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/company/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = response.data;
      setSettings({
        company_name: data.company_name || '',
        company_phone: data.company_phone || '',
        company_email: data.company_email || '',
        company_address: data.company_address || '',
        ticket_header_text: data.ticket_header_text || '',
        ticket_footer_text: data.ticket_footer_text || '',
        ticket_legal_text: data.ticket_legal_text || '',
        ticket_thank_you_text: data.ticket_thank_you_text || '',
        qr_code_enabled: data.qr_code_enabled !== false,
        min_bet_amount: data.min_bet_amount || 1,
        max_bet_amount: data.max_bet_amount || 999999
      });
      setCurrentLogoUrl(data.company_logo_url || data.display_logo_url);
      setHasCompanyLogo(!!data.company_logo_url);
    } catch (err) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les paramètres",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handlePrimeChange = (e) => {
    const { name, value } = e.target;
    setPrimes(prev => ({ ...prev, [name]: value }));
  };

  const fetchPrimes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/company/primes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = response.data;
      setPrimes({
        prime_borlette: data.prime_borlette || '60|20|10',
        prime_loto3: data.prime_loto3 || '500',
        prime_loto4: data.prime_loto4 || '5000',
        prime_loto5: data.prime_loto5 || '50000',
        prime_mariage: data.prime_mariage || '750',
        prime_mariage_gratuit: data.prime_mariage_gratuit || '750'
      });
    } catch (err) {
      // Silently fail - use defaults
      console.log('Using default primes');
    }
  };

  const handleSavePrimes = async () => {
    setSavingPrimes(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/api/company/primes`, primes, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast({
        title: "Succès",
        description: "Les primes ont été mises à jour. Elles seront appliquées aux nouvelles ventes.",
      });
    } catch (err) {
      toast({
        title: "Erreur",
        description: err.response?.data?.detail || "Échec de la mise à jour des primes",
        variant: "destructive"
      });
    } finally {
      setSavingPrimes(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/api/company/profile`, settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast({
        title: "Succès",
        description: "Paramètres mis à jour",
      });
      refreshLogo();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err.response?.data?.detail || "Échec de la mise à jour",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Type de fichier invalide",
        description: "Utilisez PNG, JPG, WEBP, GIF ou SVG",
        variant: "destructive"
      });
      return;
    }

    // No file size limit - accept any size
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadLogo = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API_URL}/api/company/logo/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setCurrentLogoUrl(response.data.logo_url);
      setHasCompanyLogo(true);
      setPreviewUrl(null);
      fileInputRef.current.value = '';
      
      toast({
        title: t('common.logoUploaded'),
        description: t('common.success'),
      });
      
      refreshLogo();
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err.response?.data?.detail || t('common.error'),
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!window.confirm(t('common.confirm') + "?")) return;

    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/company/logo`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setCurrentLogoUrl(systemLogoUrl);
      setHasCompanyLogo(false);
      
      toast({
        title: t('common.logoDeleted'),
        description: t('common.success'),
      });
      
      refreshLogo();
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err.response?.data?.detail || t('common.error'),
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
    }
  };

  const cancelPreview = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="company-settings-page">
      <div>
        <h1 className="text-2xl font-bold text-white">Paramètres de l'Entreprise</h1>
        <p className="text-gray-400 mt-1">Gérez le logo et les informations de votre entreprise</p>
      </div>

      {/* Logo Section */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-blue-400" />
            Logo de l'Entreprise
          </CardTitle>
          <CardDescription>
            Ce logo apparaîtra sur les tickets, rapports et interfaces agent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Logo Display */}
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              <div className="w-48 h-32 bg-gray-900 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center overflow-hidden">
                {previewUrl ? (
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="max-w-full max-h-full object-contain"
                  />
                ) : currentLogoUrl ? (
                  <img 
                    src={currentLogoUrl.startsWith('http') ? currentLogoUrl : `${API_URL}${currentLogoUrl}`} 
                    alt="Logo actuel" 
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/assets/logos/lottolab-logo.png';
                    }}
                  />
                ) : (
                  <div className="text-center text-gray-500">
                    <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                    <p className="text-sm">Aucun logo</p>
                  </div>
                )}
              </div>
              {hasCompanyLogo && (
                <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Logo personnalisé actif
                </p>
              )}
              {!hasCompanyLogo && (
                <p className="text-xs text-gray-400 mt-2">
                  Logo système par défaut
                </p>
              )}
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <Label className="text-gray-300">Télécharger un nouveau logo</Label>
                <p className="text-xs text-gray-500 mb-2">
                  Formats: PNG, JPG, WEBP, GIF, SVG • Aucune limite de taille
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    onChange={handleFileSelect}
                    className="bg-gray-700 border-gray-600 text-white"
                    data-testid="logo-file-input"
                  />
                </div>
              </div>

              {previewUrl && (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleUploadLogo}
                    disabled={uploading}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="save-logo-btn"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Téléchargement...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Enregistrer le logo
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={cancelPreview}
                    className="border-gray-600 text-gray-300"
                  >
                    Annuler
                  </Button>
                </div>
              )}

              {hasCompanyLogo && !previewUrl && (
                <Button
                  variant="destructive"
                  onClick={handleDeleteLogo}
                  disabled={deleting}
                  data-testid="delete-logo-btn"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Supprimer le logo
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Info Section */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-purple-400" />
            Informations de l'Entreprise
          </CardTitle>
          <CardDescription>
            Ces informations apparaîtront sur les tickets et rapports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="company_name" className="text-gray-300 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Nom de l'Entreprise
              </Label>
              <Input
                id="company_name"
                name="company_name"
                value={settings.company_name}
                onChange={handleInputChange}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="Nom de votre entreprise"
                data-testid="company-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_phone" className="text-gray-300 flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Téléphone
              </Label>
              <Input
                id="company_phone"
                name="company_phone"
                value={settings.company_phone}
                onChange={handleInputChange}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="+509 xxxx-xxxx"
                data-testid="company-phone-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_email" className="text-gray-300 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                id="company_email"
                name="company_email"
                type="email"
                value={settings.company_email}
                onChange={handleInputChange}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="contact@entreprise.com"
                data-testid="company-email-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_address" className="text-gray-300 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Adresse
              </Label>
              <Input
                id="company_address"
                name="company_address"
                value={settings.company_address}
                onChange={handleInputChange}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="Adresse complète"
                data-testid="company-address-input"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleSaveSettings}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="save-settings-btn"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Enregistrer les modifications
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ticket Customization Section */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-400" />
            Personnalisation du Ticket
          </CardTitle>
          <CardDescription>
            Configurez le contenu qui apparaîtra sur les tickets imprimés
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {/* Ticket Header Text */}
            <div className="space-y-2">
              <Label htmlFor="ticket_header_text" className="text-gray-300 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Texte en Haut du Ticket
              </Label>
              <Textarea
                id="ticket_header_text"
                name="ticket_header_text"
                value={settings.ticket_header_text}
                onChange={handleInputChange}
                className="bg-gray-700 border-gray-600 text-white min-h-[80px]"
                placeholder="Ex: Bonne chance! / Jouez responsablement"
                data-testid="ticket-header-text-input"
              />
              <p className="text-xs text-gray-500">Ce texte apparaîtra sous le logo sur le ticket imprimé</p>
            </div>

            {/* Ticket Footer Text */}
            <div className="space-y-2">
              <Label htmlFor="ticket_footer_text" className="text-gray-300 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Texte en Bas du Ticket
              </Label>
              <Textarea
                id="ticket_footer_text"
                name="ticket_footer_text"
                value={settings.ticket_footer_text}
                onChange={handleInputChange}
                className="bg-gray-700 border-gray-600 text-white min-h-[80px]"
                placeholder="Ex: Merci pour votre confiance!"
                data-testid="ticket-footer-text-input"
              />
              <p className="text-xs text-gray-500">Ce texte apparaîtra avant les mentions légales</p>
            </div>

            {/* QR Code Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <QrCode className="h-5 w-5 text-blue-400" />
                <div>
                  <Label className="text-gray-300 font-medium">Code QR sur le Ticket</Label>
                  <p className="text-xs text-gray-500">Afficher un code QR pour la vérification du ticket</p>
                </div>
              </div>
              <Switch
                checked={settings.qr_code_enabled}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, qr_code_enabled: checked }))}
                data-testid="qr-code-toggle"
              />
            </div>

            {/* Thank You Text */}
            <div className="space-y-2">
              <Label htmlFor="ticket_thank_you_text" className="text-gray-300 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Message de Remerciement
              </Label>
              <Input
                id="ticket_thank_you_text"
                name="ticket_thank_you_text"
                value={settings.ticket_thank_you_text}
                onChange={handleInputChange}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="Ex: MERCI DE JOUER AVEC NOUS!"
                data-testid="ticket-thank-you-input"
              />
              <p className="text-xs text-gray-500">Texte de remerciement en bas du ticket</p>
            </div>

            {/* Legal Text */}
            <div className="space-y-2">
              <Label htmlFor="ticket_legal_text" className="text-gray-300 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Mentions Légales (optionnel)
              </Label>
              <Textarea
                id="ticket_legal_text"
                name="ticket_legal_text"
                value={settings.ticket_legal_text}
                onChange={handleInputChange}
                className="bg-gray-700 border-gray-600 text-white min-h-[100px]"
                placeholder="Ex: Ce ticket doit être présenté pour tout paiement..."
                data-testid="ticket-legal-text-input"
              />
              <p className="text-xs text-gray-500">Si vide, les mentions légales par défaut seront utilisées</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleSaveSettings}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700"
              data-testid="save-ticket-settings-btn"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Enregistrer les paramètres du ticket
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Prime Configuration Section */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-400" />
            Configuration des Primes
          </CardTitle>
          <CardDescription>
            Configurez les multiplicateurs de gains pour chaque type de jeu. Ces primes seront appliquées à toutes les nouvelles ventes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info Box */}
          <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-200">
                <p className="font-medium mb-1">Comment fonctionnent les primes?</p>
                <ul className="list-disc list-inside text-xs text-blue-300 space-y-1">
                  <li><strong>Borlette (60|20|10)</strong>: 1er rang × 60, 2ème rang × 20, 3ème rang × 10</li>
                  <li><strong>Loto 3, Loto 4, Loto 5</strong>: Un seul multiplicateur pour le match exact</li>
                  <li><strong>Exemple</strong>: Mise de 10 HTG avec prime 500 = Gain potentiel de 5,000 HTG</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Borlette Prime */}
            <div className="space-y-2">
              <Label htmlFor="prime_borlette" className="text-gray-300 flex items-center gap-2">
                <Award className="h-4 w-4 text-yellow-400" />
                Prime Borlette
              </Label>
              <Input
                id="prime_borlette"
                name="prime_borlette"
                value={primes.prime_borlette}
                onChange={handlePrimeChange}
                className="bg-gray-700 border-gray-600 text-white font-mono"
                placeholder="60|20|10"
                data-testid="prime-borlette-input"
              />
              <p className="text-xs text-gray-500">Format: 1er|2ème|3ème (ex: 60|20|10)</p>
            </div>

            {/* Loto 3 Prime */}
            <div className="space-y-2">
              <Label htmlFor="prime_loto3" className="text-gray-300 flex items-center gap-2">
                <Award className="h-4 w-4 text-green-400" />
                Prime Loto 3
              </Label>
              <Input
                id="prime_loto3"
                name="prime_loto3"
                value={primes.prime_loto3}
                onChange={handlePrimeChange}
                className="bg-gray-700 border-gray-600 text-white font-mono"
                placeholder="500"
                data-testid="prime-loto3-input"
              />
              <p className="text-xs text-gray-500">Multiplicateur pour 3 chiffres exacts (ex: 500)</p>
            </div>

            {/* Loto 4 Prime */}
            <div className="space-y-2">
              <Label htmlFor="prime_loto4" className="text-gray-300 flex items-center gap-2">
                <Award className="h-4 w-4 text-blue-400" />
                Prime Loto 4
              </Label>
              <Input
                id="prime_loto4"
                name="prime_loto4"
                value={primes.prime_loto4}
                onChange={handlePrimeChange}
                className="bg-gray-700 border-gray-600 text-white font-mono"
                placeholder="5000"
                data-testid="prime-loto4-input"
              />
              <p className="text-xs text-gray-500">Multiplicateur pour 4 chiffres exacts (ex: 5000)</p>
            </div>

            {/* Loto 5 Prime */}
            <div className="space-y-2">
              <Label htmlFor="prime_loto5" className="text-gray-300 flex items-center gap-2">
                <Award className="h-4 w-4 text-purple-400" />
                Prime Loto 5
              </Label>
              <Input
                id="prime_loto5"
                name="prime_loto5"
                value={primes.prime_loto5}
                onChange={handlePrimeChange}
                className="bg-gray-700 border-gray-600 text-white font-mono"
                placeholder="50000"
                data-testid="prime-loto5-input"
              />
              <p className="text-xs text-gray-500">Multiplicateur pour 5 chiffres exacts (ex: 50000)</p>
            </div>

            {/* Mariage Prime */}
            <div className="space-y-2">
              <Label htmlFor="prime_mariage" className="text-gray-300 flex items-center gap-2">
                <Award className="h-4 w-4 text-pink-400" />
                Prime Mariage
              </Label>
              <Input
                id="prime_mariage"
                name="prime_mariage"
                value={primes.prime_mariage}
                onChange={handlePrimeChange}
                className="bg-gray-700 border-gray-600 text-white font-mono"
                placeholder="750"
                data-testid="prime-mariage-input"
              />
              <p className="text-xs text-gray-500">Multiplicateur pour combinaison mariage (ex: 750)</p>
            </div>

            {/* Mariage Gratuit Prime */}
            <div className="space-y-2">
              <Label htmlFor="prime_mariage_gratuit" className="text-gray-300 flex items-center gap-2">
                <Award className="h-4 w-4 text-orange-400" />
                Prime Mariage Gratuit
              </Label>
              <Input
                id="prime_mariage_gratuit"
                name="prime_mariage_gratuit"
                value={primes.prime_mariage_gratuit}
                onChange={handlePrimeChange}
                className="bg-gray-700 border-gray-600 text-white font-mono"
                placeholder="750"
                data-testid="prime-mariage-gratuit-input"
              />
              <p className="text-xs text-gray-500">Multiplicateur pour mariage offert (ex: 750)</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleSavePrimes}
              disabled={savingPrimes}
              className="bg-yellow-600 hover:bg-yellow-700"
              data-testid="save-primes-btn"
            >
              {savingPrimes ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Enregistrer les primes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Betting Limits Section */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-amber-400" />
            Limites de Mise
          </CardTitle>
          <CardDescription>
            Configurez les limites de mise pour vos vendeurs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {/* Maximum Bet Amount - No minimum limit */}
            <div className="space-y-2 max-w-md">
              <Label htmlFor="max_bet_amount" className="text-gray-300 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Montant Maximum de Mise (HTG)
              </Label>
              <Input
                id="max_bet_amount"
                name="max_bet_amount"
                type="number"
                min="1"
                value={settings.max_bet_amount}
                onChange={handleInputChange}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="999999"
                data-testid="max-bet-input"
              />
              <p className="text-xs text-gray-500">Montant maximum par mise (laissez vide ou 999999 pour illimité)</p>
              <p className="text-xs text-emerald-500 mt-1">✓ Pas de limite minimum - Vendeurs peuvent miser n'importe quel montant positif</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleSaveSettings}
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="save-bet-limits-btn"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Enregistrer les limites
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanySettingsPage;
