import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLotoPamAuth } from '../../context/LotoPamAuthContext';
import LotoPamLayout from '../../layouts/LotoPamLayout';
import { 
  Gamepad2, Trophy, Wallet, Ticket, ArrowRight, 
  Star, Zap, Gift, Users, TrendingUp, Clock, Shield
} from 'lucide-react';
import confetti from 'canvas-confetti';

const LotoPamHomePage = () => {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, player, wallet } = useLotoPamAuth();
  const [lotteries, setLotteries] = useState([]);
  const [results, setResults] = useState([]);

  useEffect(() => {
    // Trigger confetti on first load
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f97316', '#ef4444']
      });
    }

    // Load latest results - use dynamic API URL
    const apiUrl = process.env.REACT_APP_BACKEND_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8001' : window.location.origin);
    fetch(`${apiUrl}/api/online/results?limit=6`)
      .then(res => res.json())
      .then(data => setResults(data.results || []))
      .catch(console.error);
  }, []);

  const heroText = {
    ht: {
      welcome: 'Byenvini nan LOTO PAM',
      subtitle: 'Chwazi jwèt ou vle jwe: Lotri, Keno, Rafl',
      playNow: 'Jwe Kounye a',
      createAccount: 'Kreye Kont'
    },
    fr: {
      welcome: 'Bienvenue sur LOTO PAM',
      subtitle: 'Choisissez votre jeu: Loterie, Keno, Tombola',
      playNow: 'Jouer Maintenant',
      createAccount: 'Créer un Compte'
    },
    en: {
      welcome: 'Welcome to LOTO PAM',
      subtitle: 'Choose your game: Lottery, Keno, Raffle',
      playNow: 'Play Now',
      createAccount: 'Create Account'
    },
    es: {
      welcome: 'Bienvenido a LOTO PAM',
      subtitle: 'Elige tu juego: Lotería, Keno, Rifa',
      playNow: 'Jugar Ahora',
      createAccount: 'Crear Cuenta'
    }
  };

  const lang = i18n.language || 'fr';
  const texts = heroText[lang] || heroText.fr;

  const features = [
    { icon: Zap, title: 'Rezilta Rapid', desc: 'Gade rezilta yo an dirèk', color: 'yellow' },
    { icon: Shield, title: 'Sekirite 100%', desc: 'Kont ou pwoteje', color: 'green' },
    { icon: Gift, title: 'Gwo Pri', desc: 'Genyen chak jou', color: 'purple' },
    { icon: Users, title: '24/7 Sipò', desc: 'Nou la pou ou', color: 'blue' }
  ];

  return (
    <LotoPamLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Main heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold mb-6">
            <span className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent animate-gradient">
              {texts.welcome}
            </span>
          </h1>
          
          <p className="text-xl sm:text-2xl text-slate-300 mb-8 max-w-2xl mx-auto">
            {texts.subtitle}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            {isAuthenticated ? (
              <>
                <Link
                  to="/lotopam/play"
                  className="group flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-slate-900 font-bold text-lg rounded-xl hover:shadow-xl hover:shadow-yellow-500/30 transition-all transform hover:scale-105"
                >
                  <Gamepad2 className="w-6 h-6" />
                  {texts.playNow}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/lotopam/wallet"
                  className="flex items-center gap-2 px-8 py-4 bg-slate-800 border-2 border-yellow-500/50 text-yellow-400 font-bold text-lg rounded-xl hover:bg-yellow-500/10 transition-all"
                >
                  <Wallet className="w-6 h-6" />
                  {t('lotopam.depositMoney')}
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/lotopam/register"
                  className="group flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-slate-900 font-bold text-lg rounded-xl hover:shadow-xl hover:shadow-yellow-500/30 transition-all transform hover:scale-105"
                >
                  <Star className="w-6 h-6" />
                  {texts.createAccount}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/lotopam/login"
                  className="flex items-center gap-2 px-8 py-4 bg-slate-800 border-2 border-slate-600 text-white font-bold text-lg rounded-xl hover:border-yellow-500/50 transition-all"
                >
                  {t('auth.signIn')}
                </Link>
              </>
            )}
          </div>

          {/* Stats */}
          {isAuthenticated && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-4">
                <Wallet className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{wallet?.balance?.toLocaleString() || 0}</p>
                <p className="text-sm text-slate-400">HTG Balance</p>
              </div>
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-4">
                <Ticket className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">--</p>
                <p className="text-sm text-slate-400">Tikè Aktif</p>
              </div>
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-4">
                <Trophy className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">--</p>
                <p className="text-sm text-slate-400">Gen</p>
              </div>
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-4">
                <TrendingUp className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">--</p>
                <p className="text-sm text-slate-400">Total Jwe</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Games Section */}
      <section className="py-16 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-white mb-12">
            {t('lotopam.chooseGame')}
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Lottery Card */}
            <Link
              to="/lotopam/play/lottery"
              className="group relative bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 rounded-2xl p-8 hover:border-yellow-500 transition-all hover:shadow-xl hover:shadow-yellow-500/10 transform hover:-translate-y-1"
            >
              <div className="absolute top-4 right-4 px-3 py-1 bg-yellow-500/20 rounded-full text-yellow-400 text-xs font-bold">
                50+ ÉTATS
              </div>
              <div className="text-6xl mb-6">🎰</div>
              <h3 className="text-2xl font-bold text-white mb-2">{t('lotopam.lottery')}</h3>
              <p className="text-slate-400 mb-4">Pick 3, Pick 4, Pick 5 - 50 États + Haïti</p>
              <div className="flex items-center text-yellow-400 font-medium">
                {texts.playNow}
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform" />
              </div>
            </Link>

            {/* Keno Card */}
            <Link
              to="/lotopam/play/keno"
              className="group relative bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-8 hover:border-purple-500 transition-all hover:shadow-xl hover:shadow-purple-500/10 transform hover:-translate-y-1"
            >
              <div className="absolute top-4 right-4 px-3 py-1 bg-purple-500/20 rounded-full text-purple-400 text-xs font-bold">
                RAPIDE
              </div>
              <div className="text-6xl mb-6">🎯</div>
              <h3 className="text-2xl font-bold text-white mb-2">{t('lotopam.keno')}</h3>
              <p className="text-slate-400 mb-4">Tirages rapides toutes les 5 minutes</p>
              <div className="flex items-center text-purple-400 font-medium">
                {texts.playNow}
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform" />
              </div>
            </Link>

            {/* Raffle Card */}
            <Link
              to="/lotopam/play/raffle"
              className="group relative bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl p-8 hover:border-green-500 transition-all hover:shadow-xl hover:shadow-green-500/10 transform hover:-translate-y-1"
            >
              <div className="absolute top-4 right-4 px-3 py-1 bg-green-500/20 rounded-full text-green-400 text-xs font-bold">
                GROS PRI
              </div>
              <div className="text-6xl mb-6">🎫</div>
              <h3 className="text-2xl font-bold text-white mb-2">{t('lotopam.raffle')}</h3>
              <p className="text-slate-400 mb-4">Tombolas spéciales avec des prix exceptionnels</p>
              <div className="flex items-center text-green-400 font-medium">
                {texts.playNow}
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Latest Results Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-white">{t('results.latestResults')}</h2>
            <Link
              to="/lotopam/results"
              className="flex items-center gap-2 text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              {t('lotopam.viewResults')}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.slice(0, 6).map((result, index) => {
              // Parse winning_numbers - could be string, array, or object
              let numbers = [];
              if (Array.isArray(result.winning_numbers)) {
                numbers = result.winning_numbers;
              } else if (typeof result.winning_numbers === 'object' && result.winning_numbers) {
                const wn = result.winning_numbers;
                if (wn.first) numbers.push(wn.first);
                if (wn.second) numbers.push(wn.second);
                if (wn.third) numbers.push(wn.third);
              } else if (typeof result.winning_numbers === 'string') {
                numbers = result.winning_numbers.split(/[-,\s]+/).filter(n => n.trim());
              } else if (result.winning_numbers_parsed) {
                numbers = Object.values(result.winning_numbers_parsed);
              }
              
              return (
                <div
                  key={result.result_id || index}
                  className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-yellow-500/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-white">{result.lottery_name}</h3>
                    <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                      {result.draw_type}
                    </span>
                  </div>
                  <div className="flex gap-2 mb-4">
                    {numbers.slice(0, 6).map((num, i) => (
                      <div
                        key={i}
                        className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-slate-900 font-bold shadow-lg"
                      >
                        {num}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Clock className="w-4 h-4" />
                    {new Date(result.draw_date || result.created_at).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>

          {results.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>{t('results.noResults')}</p>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gradient-to-br from-slate-800/50 to-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="text-center p-6"
              >
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-${feature.color}-500/20 flex items-center justify-center`}>
                  <feature.icon className={`w-8 h-8 text-${feature.color}-400`} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!isAuthenticated && (
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              Kòmanse Jwe Jodi a!
            </h2>
            <p className="text-xl text-slate-300 mb-8">
              Kreye kont ou gratis epi depoze premye lajan ou pou kòmanse genyen gwo pri.
            </p>
            <Link
              to="/lotopam/register"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-slate-900 font-bold text-lg rounded-xl hover:shadow-xl hover:shadow-yellow-500/30 transition-all transform hover:scale-105"
            >
              {texts.createAccount}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      )}

      <style jsx>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </LotoPamLayout>
  );
};

export default LotoPamHomePage;
