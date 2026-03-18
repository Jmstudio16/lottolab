import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLotoPamAuth } from '../../context/LotoPamAuthContext';
import LotoPamLayout from '../../layouts/LotoPamLayout';
import { 
  Gamepad2, Target, Gift, ArrowRight, Lock, 
  Wallet, AlertTriangle, Clock
} from 'lucide-react';

const LotoPamPlayPage = () => {
  const { t } = useTranslation();
  const { isAuthenticated, player, wallet } = useLotoPamAuth();

  const games = [
    {
      id: 'lottery',
      name: t('lotopam.lottery'),
      description: 'Pick 3, Pick 4, Pick 5 - 50 États + Haïti',
      icon: Gamepad2,
      color: 'yellow',
      bgFrom: 'from-yellow-900/30',
      bgTo: 'to-orange-900/30',
      borderColor: 'border-yellow-500/30',
      hoverBorder: 'hover:border-yellow-500',
      shadowColor: 'shadow-yellow-500/10',
      textColor: 'text-yellow-400',
      badge: '50+ ÉTATS',
      enabled: true,
      path: '/lotopam/play/lottery'
    },
    {
      id: 'keno',
      name: t('lotopam.keno'),
      description: 'Tirages rapides toutes les 5 minutes - Choisissez jusqu\'à 10 numéros',
      icon: Target,
      color: 'purple',
      bgFrom: 'from-purple-900/30',
      bgTo: 'to-pink-900/30',
      borderColor: 'border-purple-500/30',
      hoverBorder: 'hover:border-purple-500',
      shadowColor: 'shadow-purple-500/10',
      textColor: 'text-purple-400',
      badge: 'BIENTÔT',
      enabled: false,
      path: '/lotopam/play/keno'
    },
    {
      id: 'raffle',
      name: t('lotopam.raffle'),
      description: 'Tombolas spéciales avec des prix exceptionnels - Gagnez des voitures, maisons et plus',
      icon: Gift,
      color: 'green',
      bgFrom: 'from-green-900/30',
      bgTo: 'to-emerald-900/30',
      borderColor: 'border-green-500/30',
      hoverBorder: 'hover:border-green-500',
      shadowColor: 'shadow-green-500/10',
      textColor: 'text-green-400',
      badge: 'BIENTÔT',
      enabled: false,
      path: '/lotopam/play/raffle'
    }
  ];

  return (
    <LotoPamLayout>
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-4">{t('lotopam.chooseGame')}</h1>
          <p className="text-xl text-slate-400">Sélectionnez votre jeu préféré et tentez votre chance</p>
        </div>

        {/* Not authenticated warning */}
        {!isAuthenticated && (
          <div className="mb-8 p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
            <AlertTriangle className="w-8 h-8 text-yellow-400 flex-shrink-0" />
            <div className="flex-1 text-center sm:text-left">
              <p className="text-yellow-400 font-bold text-lg">Créez un compte pour jouer</p>
              <p className="text-slate-400">Vous devez avoir un compte et un solde pour placer des paris</p>
            </div>
            <Link
              to="/lotopam/register"
              className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-slate-900 font-bold rounded-xl hover:shadow-xl hover:shadow-yellow-500/30 transition-all"
            >
              Créer un Compte
            </Link>
          </div>
        )}

        {/* Balance info for authenticated users */}
        {isAuthenticated && (
          <div className="mb-8 p-4 bg-slate-800/50 border border-slate-700 rounded-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Wallet className="w-8 h-8 text-yellow-400" />
              <div>
                <p className="text-sm text-slate-400">Votre Solde</p>
                <p className="text-2xl font-bold text-yellow-400">{wallet?.balance?.toLocaleString() || 0} HTG</p>
              </div>
            </div>
            {wallet?.balance < 100 && (
              <Link
                to="/lotopam/wallet"
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:shadow-xl hover:shadow-green-500/30 transition-all"
              >
                Déposer de l'Argent
              </Link>
            )}
          </div>
        )}

        {/* Games Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {games.map((game) => (
            <div
              key={game.id}
              className={`relative bg-gradient-to-br ${game.bgFrom} ${game.bgTo} border ${game.borderColor} rounded-2xl p-8 transition-all ${
                game.enabled 
                  ? `${game.hoverBorder} hover:shadow-xl hover:${game.shadowColor} transform hover:-translate-y-1 cursor-pointer` 
                  : 'opacity-70 cursor-not-allowed'
              }`}
            >
              {/* Badge */}
              <div className={`absolute top-4 right-4 px-3 py-1 ${
                game.enabled ? `bg-${game.color}-500/20 text-${game.color}-400` : 'bg-slate-500/20 text-slate-400'
              } rounded-full text-xs font-bold`}>
                {game.badge}
              </div>

              {/* Icon */}
              <div className={`w-20 h-20 mb-6 rounded-2xl bg-${game.color}-500/20 flex items-center justify-center`}>
                <game.icon className={`w-10 h-10 ${game.textColor}`} />
              </div>

              {/* Content */}
              <h3 className="text-2xl font-bold text-white mb-3">{game.name}</h3>
              <p className="text-slate-400 mb-6">{game.description}</p>

              {/* CTA */}
              {game.enabled ? (
                <Link
                  to={isAuthenticated ? game.path : '/lotopam/login'}
                  className={`flex items-center ${game.textColor} font-medium group`}
                >
                  {isAuthenticated ? 'Jouer Maintenant' : 'Connectez-vous pour jouer'}
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform" />
                </Link>
              ) : (
                <div className="flex items-center text-slate-500 font-medium">
                  <Lock className="w-5 h-5 mr-2" />
                  Prochainement disponible
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Clock className="w-7 h-7 text-yellow-400" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Résultats en Direct</h4>
            <p className="text-slate-400">Suivez les tirages en temps réel et vérifiez vos gains instantanément</p>
          </div>
          
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <Wallet className="w-7 h-7 text-green-400" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Paiements Sécurisés</h4>
            <p className="text-slate-400">Dépôts et retraits via MonCash et NatCash en toute sécurité</p>
          </div>
          
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Gift className="w-7 h-7 text-purple-400" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Gros Gains</h4>
            <p className="text-slate-400">Multiplicateurs jusqu'à x500 sur vos mises gagnantes</p>
          </div>
        </div>
      </div>
    </LotoPamLayout>
  );
};

export default LotoPamPlayPage;
