import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Globe } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';

export const LoginPage = () => {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState('/assets/logos/lottolab-logo.png');
  const [showLanguages, setShowLanguages] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const languages = [
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'ht', name: 'Kreyòl', flag: '🇭🇹' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' }
  ];

  useEffect(() => {
    // Fetch system logo for login page
    const fetchSystemLogo = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/system/settings`);
        if (response.data.system_logo_url) {
          setLogoUrl(response.data.system_logo_url);
        }
      } catch (err) {
        console.log('Using default logo');
      }
    };
    fetchSystemLogo();
  }, []);

  const changeLanguage = (langCode) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('language', langCode);
    setShowLanguages(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const redirectPath = await login(email, password);
      toast.success(t('common.success'));
      navigate(redirectPath);
    } catch (error) {
      toast.error(error.response?.data?.detail || t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Language Selector - Top Right */}
        <div className="absolute top-4 right-4">
          <div className="relative">
            <button
              onClick={() => setShowLanguages(!showLanguages)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-colors text-sm"
            >
              <Globe className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300">{languages.find(l => l.code === i18n.language)?.flag || '🌐'}</span>
            </button>
            {showLanguages && (
              <div className="absolute right-0 mt-2 py-2 w-36 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-800 transition-colors ${
                      i18n.language === lang.code ? 'text-yellow-400' : 'text-slate-300'
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-slate-700/50 rounded-xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <img 
              src={logoUrl} 
              alt="LOTTOLAB" 
              className="w-48 h-auto mx-auto mb-4"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/assets/logos/lottolab-logo.png';
              }}
            />
            <h1 className="text-2xl font-barlow font-bold uppercase tracking-tight text-white">
              {t('auth.welcomeBack')}
            </h1>
            <p className="text-sm text-slate-400 mt-2">{t('auth.loginSubtitle')}</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-slate-300">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                data-testid="login-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="mt-1.5 bg-slate-950 border-slate-700 focus:border-yellow-400 focus:ring-yellow-400/50 text-white"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-slate-300">{t('auth.password')}</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  data-testid="login-password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-slate-950 border-slate-700 focus:border-yellow-400 focus:ring-yellow-400/50 text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              data-testid="login-submit-button"
              disabled={loading}
              className="w-full button-primary mt-6"
            >
              {loading ? t('common.loading') : t('auth.signIn')}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            © JM STUDIO - LOTTOLAB
          </div>
        </div>
      </div>
    </div>
  );
};