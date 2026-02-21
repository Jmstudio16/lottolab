import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState('/assets/logos/lottolab-logo.png');
  const { login } = useAuth();
  const navigate = useNavigate();

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const redirectPath = await login(email, password);
      toast.success('Login successful!');
      navigate(redirectPath);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
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
              Welcome Back
            </h1>
            <p className="text-sm text-slate-400 mt-2">Sign in to your account</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-slate-300">Email</Label>
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
              <Label htmlFor="password" className="text-slate-300">Password</Label>
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
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 p-4 bg-slate-900/50 border border-slate-700/50 rounded-lg">
            <p className="text-xs text-slate-400 mb-2 font-semibold">Demo Accounts:</p>
            <div className="space-y-2 text-xs text-slate-300">
              <div>
                <span className="text-yellow-400 font-mono">Super Admin:</span> jefferson@jmstudio.com
              </div>
              <div>
                <span className="text-blue-400 font-mono">Company Admin:</span> admin@lotopam.com
              </div>
              <div>
                <span className="text-green-400 font-mono">Agent POS:</span> agent001@pos.lottolab.local
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-500">
            © JM STUDIO - LOTTOLAB
          </div>
        </div>
      </div>
    </div>
  );
};