import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLotoPamAuth } from '../../context/LotoPamAuthContext';
import LotoPamLayout from '../../layouts/LotoPamLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { User, Mail, Lock, Phone, ArrowRight, Loader2, CheckCircle } from 'lucide-react';

const LotoPamRegisterPage = () => {
  const { t, i18n } = useTranslation();
  const { register } = useLotoPamAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    accept_terms: false,
    preferred_language: i18n.language || 'fr'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirm_password) {
      toast.error('Modpas yo pa menm');
      return;
    }

    if (!form.accept_terms) {
      toast.error('Ou dwe aksepte kondisyon yo');
      return;
    }

    if (form.password.length < 8) {
      toast.error('Modpas dwe gen omwen 8 karaktè');
      return;
    }

    setLoading(true);

    try {
      await register({
        full_name: form.full_name,
        username: form.username.toLowerCase().replace(/\s/g, '_'),
        email: form.email,
        phone: form.phone,
        password: form.password,
        preferred_language: form.preferred_language,
        accept_terms: form.accept_terms
      });
      toast.success('Kont ou kreye avèk siksè!');
      navigate('/lotopam');
    } catch (error) {
      const message = error.response?.data?.detail || 'Erè nan enskripsyon';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LotoPamLayout>
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center text-3xl font-bold text-slate-900 shadow-xl shadow-yellow-500/20">
              LP
            </div>
            <h1 className="text-2xl font-bold text-white">{t('auth.createAccount')}</h1>
            <p className="text-slate-400 mt-2">Kreye kont ou pou kòmanse jwe</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('auth.fullName')} *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="pl-10 bg-slate-900 border-slate-600 text-white h-12"
                  placeholder="Jean Baptiste"
                  required
                  data-testid="register-fullname"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('auth.username')} *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">@</span>
                <Input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                  className="pl-10 bg-slate-900 border-slate-600 text-white h-12"
                  placeholder="jeanbaptiste"
                  required
                  data-testid="register-username"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Lèt miniskil, chif, ak underscore sèlman</p>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('auth.email')} *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="pl-10 bg-slate-900 border-slate-600 text-white h-12"
                  placeholder="votre@email.com"
                  required
                  data-testid="register-email"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('auth.phone')} *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="pl-10 bg-slate-900 border-slate-600 text-white h-12"
                  placeholder="+509 XXXX XXXX"
                  required
                  data-testid="register-phone"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('auth.password')} *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="pl-10 bg-slate-900 border-slate-600 text-white h-12"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  data-testid="register-password"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Omwen 8 karaktè</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('auth.confirmPassword')} *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="password"
                  value={form.confirm_password}
                  onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                  className="pl-10 bg-slate-900 border-slate-600 text-white h-12"
                  placeholder="••••••••"
                  required
                  data-testid="register-confirm-password"
                />
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={form.accept_terms}
                onCheckedChange={(checked) => setForm({ ...form, accept_terms: checked })}
                className="mt-1"
                data-testid="register-terms"
              />
              <label htmlFor="terms" className="text-sm text-slate-300">
                Mwen aksepte{' '}
                <Link to="/lotopam/terms" className="text-yellow-400 hover:underline">
                  kondisyon itilizasyon
                </Link>{' '}
                ak{' '}
                <Link to="/lotopam/privacy" className="text-yellow-400 hover:underline">
                  politik konfidansyalite
                </Link>
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading || !form.accept_terms}
              className="w-full h-12 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-slate-900 font-bold text-lg disabled:opacity-50"
              data-testid="register-submit"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {t('auth.createAccount')}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>

          {/* Login Link */}
          <p className="text-center mt-6 text-slate-400">
            {t('auth.hasAccount')}{' '}
            <Link
              to="/lotopam/login"
              className="text-yellow-400 hover:text-yellow-300 font-medium transition-colors"
            >
              {t('auth.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </LotoPamLayout>
  );
};

export default LotoPamRegisterPage;
