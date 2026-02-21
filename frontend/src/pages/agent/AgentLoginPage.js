import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/api/auth';
import { 
  LogIn, 
  Mail, 
  Lock, 
  AlertCircle,
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AgentLoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const getDeviceIcon = () => {
    const width = window.innerWidth;
    if (width < 768) return <Smartphone size={32} className="text-emerald-400" />;
    if (width < 1024) return <Tablet size={32} className="text-emerald-400" />;
    return <Monitor size={32} className="text-emerald-400" />;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/agent/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': navigator.userAgent
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Échec de la connexion');
      }

      // Store token and user info manually for agent login
      const userData = {
        user_id: data.agent_id,
        name: data.agent_name,
        role: 'AGENT_POS',
        company_id: data.company_id,
        email: email
      };
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(userData));

      toast.success(`Bienvenue, ${data.agent_name}!`);
      
      // Force page reload to update auth context
      window.location.href = '/agent/dashboard';
      
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-4"
      data-testid="agent-login-page"
    >
      <Card className="w-full max-w-md bg-slate-800/90 backdrop-blur border-slate-700 shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto p-4 bg-emerald-900/30 rounded-full w-fit">
            {getDeviceIcon()}
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-white">LOTTOLAB</CardTitle>
            <p className="text-slate-400 mt-1">Terminal Agent Universel</p>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-2 text-red-400">
                <AlertCircle size={18} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-slate-300">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="agent@exemple.com"
                  className="pl-10 bg-slate-700 border-slate-600 text-white focus:border-emerald-500"
                  required
                  data-testid="email-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 bg-slate-700 border-slate-600 text-white focus:border-emerald-500"
                  required
                  data-testid="password-input"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-lg font-semibold"
              data-testid="login-btn"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="animate-spin mr-2" />
                  Connexion...
                </>
              ) : (
                <>
                  <LogIn className="mr-2" />
                  Se Connecter
                </>
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-slate-500">
            <p>Connectez-vous depuis n'importe quel appareil</p>
            <p className="mt-1">Ordinateur • Tablette • Téléphone</p>
          </div>

          <div className="border-t border-slate-700 pt-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/login')}
              className="w-full text-slate-400 hover:text-white hover:bg-slate-700"
            >
              Connexion Admin
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentLoginPage;
