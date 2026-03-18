import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Ticket, 
  Trophy, 
  Shield, 
  Zap, 
  Users, 
  BarChart3,
  CheckCircle,
  ArrowRight,
  Star
} from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                <Ticket className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">LOTTOLAB</span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-amber-600 transition">Fonctionnalités</a>
              <a href="#how-it-works" className="text-gray-600 hover:text-amber-600 transition">Comment ça marche</a>
              <a href="#pricing" className="text-gray-600 hover:text-amber-600 transition">Tarifs</a>
              <a href="#faq" className="text-gray-600 hover:text-amber-600 transition">FAQ</a>
            </nav>
            <div className="flex items-center space-x-4">
              <Link to="/login" className="text-gray-600 hover:text-amber-600 font-medium">
                Connexion
              </Link>
              <Link 
                to="/login" 
                className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-lg font-medium transition"
              >
                Commencer
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Gérez votre loterie avec
            <span className="text-amber-500"> LOTTOLAB</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            La plateforme SaaS professionnelle pour la gestion de loterie multi-entreprises. 
            Ventes, tirages, résultats et paiements automatisés en temps réel.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              to="/login" 
              className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-4 rounded-lg font-bold text-lg transition flex items-center justify-center gap-2"
            >
              Démarrer Gratuitement <ArrowRight className="w-5 h-5" />
            </Link>
            <a 
              href="#features" 
              className="border-2 border-gray-300 hover:border-amber-500 text-gray-700 px-8 py-4 rounded-lg font-bold text-lg transition"
            >
              En savoir plus
            </a>
          </div>
          <div className="mt-12 flex justify-center items-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>Essai gratuit 14 jours</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>Sans carte bancaire</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>Support 24/7</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Fonctionnalités Puissantes
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Tout ce dont vous avez besoin pour gérer votre entreprise de loterie
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Ticket,
                title: "Gestion des Tickets",
                description: "Créez, vendez et suivez les tickets en temps réel. Impression automatique des reçus."
              },
              {
                icon: Trophy,
                title: "Tirages Automatiques",
                description: "Configurez vos tirages et laissez le système calculer automatiquement les gagnants."
              },
              {
                icon: Shield,
                title: "Sécurité Maximale",
                description: "Authentification JWT, rôles utilisateurs, et audit complet de toutes les actions."
              },
              {
                icon: Users,
                title: "Multi-Entreprises",
                description: "Gérez plusieurs entreprises, succursales et vendeurs depuis une seule plateforme."
              },
              {
                icon: BarChart3,
                title: "Rapports Détaillés",
                description: "Statistiques en temps réel, exports Excel/PDF, et tableaux de bord personnalisés."
              },
              {
                icon: Zap,
                title: "Performance Optimale",
                description: "Interface rapide et réactive, même avec des millions de tickets."
              }
            ].map((feature, index) => (
              <div key={index} className="bg-amber-50 p-8 rounded-2xl hover:shadow-lg transition">
                <div className="w-14 h-14 bg-amber-500 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Comment ça marche ?
            </h2>
            <p className="text-xl text-gray-600">
              Commencez en 3 étapes simples
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Créez votre compte",
                description: "Inscrivez-vous gratuitement et configurez votre entreprise de loterie en quelques minutes."
              },
              {
                step: "2",
                title: "Configurez vos jeux",
                description: "Définissez vos types de loterie, les multiplicateurs de gains et les horaires de tirage."
              },
              {
                step: "3",
                title: "Commencez à vendre",
                description: "Vos vendeurs peuvent immédiatement créer des tickets et servir vos clients."
              }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Tarifs Simples et Transparents
            </h2>
            <p className="text-xl text-gray-600">
              Choisissez le plan adapté à votre entreprise
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: "Starter",
                price: "49",
                features: ["1 succursale", "5 vendeurs", "1000 tickets/mois", "Support email"]
              },
              {
                name: "Business",
                price: "149",
                popular: true,
                features: ["5 succursales", "25 vendeurs", "10000 tickets/mois", "Support prioritaire", "Rapports avancés"]
              },
              {
                name: "Enterprise",
                price: "399",
                features: ["Illimité", "Vendeurs illimités", "Tickets illimités", "Support 24/7", "API personnalisée", "Formation incluse"]
              }
            ].map((plan, index) => (
              <div 
                key={index} 
                className={`p-8 rounded-2xl border-2 ${plan.popular ? 'border-amber-500 bg-amber-50 relative' : 'border-gray-200'}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-amber-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Plus populaire
                    </span>
                  </div>
                )}
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-gray-500">/mois</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-600">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/login"
                  className={`block text-center py-3 rounded-lg font-medium transition ${
                    plan.popular 
                      ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  }`}
                >
                  Commencer
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Questions Fréquentes
            </h2>
          </div>
          <div className="space-y-4">
            {[
              {
                q: "Comment fonctionne l'essai gratuit ?",
                a: "Vous avez 14 jours pour tester toutes les fonctionnalités sans engagement. Aucune carte bancaire n'est requise."
              },
              {
                q: "Puis-je changer de plan à tout moment ?",
                a: "Oui, vous pouvez upgrader ou downgrader votre plan à tout moment. Les changements sont effectifs immédiatement."
              },
              {
                q: "Comment sont calculés les gains ?",
                a: "Le système calcule automatiquement les gains selon vos multiplicateurs configurés (par défaut 60x pour 2 numéros, 20x pour 3 numéros)."
              },
              {
                q: "Les données sont-elles sécurisées ?",
                a: "Absolument. Nous utilisons un chiffrement de niveau bancaire et toutes les données sont sauvegardées quotidiennement."
              },
              {
                q: "Proposez-vous une formation ?",
                a: "Oui, tous les plans incluent une formation de base. Le plan Enterprise inclut une formation personnalisée sur site."
              }
            ].map((item, index) => (
              <details 
                key={index} 
                className="bg-white p-6 rounded-xl cursor-pointer group"
              >
                <summary className="font-bold text-gray-900 flex justify-between items-center">
                  {item.q}
                  <span className="text-amber-500 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-gray-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-amber-500">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Prêt à transformer votre entreprise de loterie ?
          </h2>
          <p className="text-xl text-amber-100 mb-8">
            Rejoignez des centaines d'entreprises qui font confiance à LOTTOLAB
          </p>
          <Link 
            to="/login" 
            className="inline-block bg-white hover:bg-gray-100 text-amber-600 px-8 py-4 rounded-lg font-bold text-lg transition"
          >
            Commencer Maintenant - C'est Gratuit
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                  <Ticket className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">LOTTOLAB</span>
              </div>
              <p className="text-sm">
                La plateforme de gestion de loterie la plus complète du marché.
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-amber-500">Fonctionnalités</a></li>
                <li><a href="#pricing" className="hover:text-amber-500">Tarifs</a></li>
                <li><a href="#faq" className="hover:text-amber-500">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Légal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/terms" className="hover:text-amber-500">Conditions d'utilisation</a></li>
                <li><a href="/privacy" className="hover:text-amber-500">Politique de confidentialité</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li>support@lottolab.tech</li>
                <li>+509 XX XX XXXX</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2026 LOTTOLAB by JM Studio. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
