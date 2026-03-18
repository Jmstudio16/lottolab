import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLotoPamAuth } from '../../context/LotoPamAuthContext';
import LotoPamLayout from '../../layouts/LotoPamLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';

const LotoPamLoginPage = () => {
  const { t } = useTranslation();
  const { login } = useLotoPamAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(form.email, form.password);
      toast.success('Koneksyon reyisi!');
      navigate('/lotopam');
    } catch (error) {
      const message = error.response?.data?.detail || t('auth.invalidCredentials');
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
            <h1 className="text-2xl font-bold text-white">{t('auth.welcomeBack')}</h1>
            <p className="text-slate-400 mt-2">{t('auth.loginSubtitle')}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('auth.email')}
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
                    data-testid="login-email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('auth.password')}
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
                    data-testid="login-password"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-slate-900 font-bold text-lg"
              data-testid="login-submit"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {t('auth.signIn')}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>

            <div className="text-center">
              <Link
                to="/lotopam/forgot-password"
                className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>
          </form>

          {/* Register Link */}
          <p className="text-center mt-6 text-slate-400">
            {t('auth.noAccount')}{' '}
            <Link
              to="/lotopam/register"
              className="text-yellow-400 hover:text-yellow-300 font-medium transition-colors"
            >
              {t('auth.createAccount')}
            </Link>
          </p>
        </div>
      </div>
    </LotoPamLayout>
  );
};

export default LotoPamLoginPage;
