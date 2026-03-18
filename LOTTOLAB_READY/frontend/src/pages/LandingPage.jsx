import React, { useEffect, useState } from 'react';
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
  Phone,
  Mail,
  Globe,
  Clock,
  CreditCard,
  Settings,
  PieChart,
  Smartphone,
  Building2,
  UserCheck,
  Receipt,
  TrendingUp,
  Lock,
  Headphones,
  Star
} from 'lucide-react';
import WhatsAppButton from '../components/WhatsAppButton';

// Lottery Ball Component
const LotteryBall = ({ number, color, style }) => (
  <div
    className={`lottery-ball absolute rounded-full flex items-center justify-center font-black text-white shadow-lg ${color}`}
    style={style}
  >
    {number}
  </div>
);

// Animated Lottery Balls Background
const LotteryBallsBackground = () => {
  const balls = [
    { number: 7, color: 'bg-red-500', size: 60, left: '5%', delay: 0 },
    { number: 21, color: 'bg-blue-500', size: 50, left: '15%', delay: 1 },
    { number: 33, color: 'bg-green-500', size: 55, left: '25%', delay: 2 },
    { number: 45, color: 'bg-yellow-500', size: 45, left: '35%', delay: 0.5 },
    { number: 12, color: 'bg-purple-500', size: 65, left: '45%', delay: 1.5 },
    { number: 8, color: 'bg-pink-500', size: 50, left: '55%', delay: 2.5 },
    { number: 56, color: 'bg-orange-500', size: 55, left: '65%', delay: 0.8 },
    { number: 3, color: 'bg-cyan-500', size: 48, left: '75%', delay: 1.8 },
    { number: 19, color: 'bg-amber-500', size: 58, left: '85%', delay: 2.2 },
    { number: 27, color: 'bg-emerald-500', size: 52, left: '95%', delay: 0.3 },
    { number: 42, color: 'bg-rose-500', size: 46, left: '10%', delay: 1.2 },
    { number: 66, color: 'bg-indigo-500', size: 54, left: '30%', delay: 2.8 },
    { number: 88, color: 'bg-teal-500', size: 44, left: '50%', delay: 0.7 },
    { number: 15, color: 'bg-violet-500', size: 56, left: '70%', delay: 1.7 },
    { number: 99, color: 'bg-lime-500', size: 50, left: '90%', delay: 2.4 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {balls.map((ball, index) => (
        <LotteryBall
          key={index}
          number={ball.number}
          color={ball.color}
          style={{
            width: ball.size,
            height: ball.size,
            fontSize: ball.size * 0.35,
            left: ball.left,
            animation: `floatBall ${8 + index % 4}s ease-in-out infinite`,
            animationDelay: `${ball.delay}s`,
            top: `${-100 - (index * 50)}px`,
          }}
        />
      ))}
    </div>
  );
};

// Animation hook for scroll reveal
const useScrollReveal = () => {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fadeInUp');
            entry.target.style.opacity = '1';
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('.reveal').forEach((el) => {
      el.style.opacity = '0';
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);
};

// Animated counter component
const AnimatedCounter = ({ end, duration = 2000, suffix = '' }) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let startTime;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration]);
  
  return <span>{count}{suffix}</span>;
};

const LandingPage = () => {
  useScrollReveal();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: Ticket,
      title: "Gestion des Tickets",
      description: "Créez, vendez et suivez les tickets en temps réel. Impression automatique des reçus thermiques.",
      color: "from-amber-400 to-orange-500"
    },
    {
      icon: Trophy,
      title: "Tirages Automatiques",
      description: "Configurez vos tirages et le système calcule automatiquement les gagnants avec multiplicateurs personnalisés.",
      color: "from-emerald-400 to-green-500"
    },
    {
      icon: Shield,
      title: "Sécurité Maximale",
      description: "Authentification JWT, chiffrement des données, rôles utilisateurs et audit complet des actions.",
      color: "from-blue-400 to-indigo-500"
    },
    {
      icon: Building2,
      title: "Multi-Succursales",
      description: "Gérez plusieurs succursales et points de vente depuis une seule plateforme centralisée.",
      color: "from-purple-400 to-violet-500"
    },
    {
      icon: BarChart3,
      title: "Rapports Détaillés",
      description: "Statistiques en temps réel, exports Excel/PDF, et tableaux de bord personnalisés par rôle.",
      color: "from-pink-400 to-rose-500"
    },
    {
      icon: Smartphone,
      title: "Compatible POS",
      description: "Application optimisée pour les terminaux de point de vente Android. Interface tactile intuitive.",
      color: "from-cyan-400 to-teal-500"
    }
  ];

  const stats = [
    { value: 500, suffix: '+', label: 'Entreprises' },
    { value: 10000, suffix: '+', label: 'Vendeurs Actifs' },
    { value: 1, suffix: 'M+', label: 'Tickets/Mois' },
    { value: 99.9, suffix: '%', label: 'Disponibilité' }
  ];

  const pricingPlans = [
    {
      name: 'Basic',
      subtitle: 'Pour démarrer',
      price: '$5',
      priceUnit: '/POS/mois',
      features: [
        '5 Succursales',
        '50 Vendeurs maximum',
        'Tickets illimités',
        'Rapports de base',
        'Support email'
      ],
      color: 'slate',
      popular: false
    },
    {
      name: 'Business',
      subtitle: 'Pour les entreprises en croissance',
      price: '$50',
      priceUnit: '/mois',
      features: [
        '10 Succursales',
        '150 Vendeurs maximum',
        'Tickets illimités',
        'Rapports avancés',
        'Export Excel/PDF',
        'Support prioritaire'
      ],
      color: 'amber',
      popular: true
    },
    {
      name: 'Mini Entreprise',
      subtitle: 'Croissance rapide',
      price: '$300',
      priceUnit: '/mois',
      features: [
        '50 Succursales',
        '300 Vendeurs maximum',
        'Tickets illimités',
        'Rapports complets',
        'API accès',
        'Support dédié',
        'Formation incluse'
      ],
      color: 'purple',
      popular: false
    },
    {
      name: 'Enterprise',
      subtitle: 'Solution complète',
      price: '$500',
      priceUnit: '/mois',
      features: [
        'Succursales illimitées',
        'Vendeurs illimités',
        'Tickets illimités',
        'API personnalisée',
        'Formation sur site',
        'Support 24/7 dédié',
        'Personnalisation totale'
      ],
      color: 'emerald',
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white overflow-x-hidden">
      {/* CSS Animations */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.4); }
          50% { box-shadow: 0 0 40px rgba(245, 158, 11, 0.8); }
        }
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes floatBall {
          0% { 
            transform: translateY(-100px) rotate(0deg); 
            opacity: 0;
          }
          10% { opacity: 0.8; }
          90% { opacity: 0.8; }
          100% { 
            transform: translateY(100vh) rotate(360deg); 
            opacity: 0;
          }
        }
        .lottery-ball {
          box-shadow: 
            inset -5px -5px 15px rgba(0,0,0,0.3),
            inset 5px 5px 15px rgba(255,255,255,0.3),
            0 5px 20px rgba(0,0,0,0.3);
          border: 2px solid rgba(255,255,255,0.3);
        }
        .animate-fadeInUp { animation: fadeInUp 0.8s ease-out forwards; }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
        .animate-gradient { 
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
        .reveal { transition: opacity 0.6s ease, transform 0.6s ease; }
        .glass { 
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .card-shine {
          position: relative;
          overflow: hidden;
        }
        .card-shine::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          animation: shine 3s infinite;
        }
        
        /* Mobile Responsive */
        @media (max-width: 768px) {
          .lottery-ball {
            opacity: 0.5;
          }
        }
      `}</style>

      {/* Lottery Balls Animation Background */}
      <LotteryBallsBackground />

      {/* Header */}
      <header className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-slate-900/95 backdrop-blur-lg shadow-xl' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div className="flex items-center">
              <img 
                src="/logo-lottolab.png" 
                alt="LOTTOLAB" 
                className="h-14 md:h-16 w-auto object-contain"
              />
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-slate-300 hover:text-amber-400 transition font-medium">Fonctionnalités</a>
              <a href="#pricing" className="text-slate-300 hover:text-amber-400 transition font-medium">Tarifs</a>
              <a href="#contact" className="text-slate-300 hover:text-amber-400 transition font-medium">Contact</a>
            </nav>

            {/* CTA Buttons */}
            <div className="flex items-center space-x-4">
              <Link to="/login" className="text-slate-300 hover:text-white font-medium transition">
                Connexion
              </Link>
              <Link 
                to="/login" 
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white px-6 py-2.5 rounded-xl font-bold transition transform hover:scale-105 shadow-lg shadow-amber-500/25"
              >
                Commencer
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-28 pb-20 px-4 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center">
            {/* Logo Hero */}
            <div className="flex justify-center mb-8 reveal">
              <img 
                src="/logo-lottolab.png" 
                alt="LOTTOLAB by JM Studio" 
                className="h-32 md:h-40 lg:h-48 w-auto object-contain drop-shadow-2xl animate-float"
              />
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-2 mb-8 reveal">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-amber-400 font-medium">Disponible maintenant sur POS Android</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-6 reveal">
              <span className="text-white">La Solution</span>
              <br />
              <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent animate-gradient">
                Complète de Loterie
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-slate-300 mb-10 max-w-3xl mx-auto reveal" style={{animationDelay: '0.2s'}}>
              Plateforme SaaS professionnelle pour gérer vos <strong className="text-white">ventes</strong>, 
              <strong className="text-white"> tirages</strong>, <strong className="text-white">résultats</strong> et 
              <strong className="text-white"> paiements</strong> en temps réel.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16 reveal" style={{animationDelay: '0.4s'}}>
              <Link 
                to="/login" 
                className="group bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white px-8 py-4 rounded-2xl font-bold text-lg transition transform hover:scale-105 shadow-xl shadow-amber-500/30 flex items-center justify-center gap-3"
              >
                Commencer Aujourd'hui
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
              </Link>
              <a 
                href="#features" 
                className="glass hover:bg-white/10 text-white px-8 py-4 rounded-2xl font-bold text-lg transition flex items-center justify-center gap-2"
              >
                <Globe className="w-5 h-5" />
                Découvrir
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto reveal" style={{animationDelay: '0.6s'}}>
              {stats.map((stat, index) => (
                <div key={index} className="glass rounded-2xl p-6 text-center hover:bg-white/10 transition">
                  <div className="text-3xl md:text-4xl font-black text-amber-400 mb-1">
                    <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-slate-400 text-sm">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 reveal">
            <span className="text-amber-400 font-semibold tracking-wider uppercase">Fonctionnalités</span>
            <h2 className="text-3xl md:text-5xl font-black mt-4 mb-6">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Une plateforme complète pour transformer votre entreprise de loterie
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="reveal group glass rounded-3xl p-8 hover:bg-white/10 transition-all duration-300 hover:-translate-y-2"
                style={{animationDelay: `${index * 0.1}s`}}
              >
                <div className={`w-16 h-16 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition shadow-lg`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 reveal">
            <span className="text-amber-400 font-semibold tracking-wider uppercase">Comment ça marche</span>
            <h2 className="text-3xl md:text-5xl font-black mt-4 mb-6">
              Démarrez en 3 étapes
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connection Line */}
            <div className="hidden md:block absolute top-24 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500"></div>
            
            {[
              { step: '01', title: 'Créez votre compte', desc: 'Inscrivez-vous et configurez votre entreprise en quelques minutes.', icon: UserCheck },
              { step: '02', title: 'Configurez vos jeux', desc: 'Définissez vos loteries, multiplicateurs et horaires de tirage.', icon: Settings },
              { step: '03', title: 'Commencez à vendre', desc: 'Vos vendeurs peuvent immédiatement créer des tickets sur POS.', icon: Receipt }
            ].map((item, index) => (
              <div key={index} className="reveal text-center relative" style={{animationDelay: `${index * 0.2}s`}}>
                <div className="relative inline-block mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-amber-500/30 animate-float" style={{animationDelay: `${index * 0.5}s`}}>
                    <item.icon className="w-10 h-10 text-white" />
                  </div>
                  <div className="absolute -top-3 -right-3 w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center border-2 border-amber-500 font-black text-amber-400">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 reveal">
            <span className="text-amber-400 font-semibold tracking-wider uppercase">Tarifs</span>
            <h2 className="text-3xl md:text-5xl font-black mt-4 mb-6">
              Choisissez votre plan
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Des tarifs adaptés à la taille de votre entreprise
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <div 
                key={index}
                className={`reveal card-shine glass rounded-3xl p-6 transition-all duration-300 hover:-translate-y-2 ${
                  plan.popular ? 'border-2 border-amber-500 relative bg-gradient-to-b from-amber-500/20 to-transparent scale-105 shadow-2xl shadow-amber-500/30' : ''
                }`}
                style={{animationDelay: `${index * 0.1}s`}}
              >
                {plan.popular && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                    <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 text-slate-900 px-6 py-2 rounded-full text-base font-black shadow-xl shadow-amber-500/50 flex items-center gap-2 animate-pulse whitespace-nowrap">
                      <Star className="w-5 h-5" fill="currentColor" />
                      POPULAIRE
                      <Star className="w-5 h-5" fill="currentColor" />
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                  <p className="text-slate-400 text-sm mb-4">{plan.subtitle}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={`text-4xl font-black ${plan.popular ? 'bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent' : 'text-white'}`}>
                      {plan.price}
                    </span>
                    <span className="text-slate-400 text-sm">{plan.priceUnit}</span>
                  </div>
                </div>
                
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-slate-300 text-sm">
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 ${
                        plan.popular ? 'text-amber-500' : 
                        plan.color === 'purple' ? 'text-purple-500' :
                        plan.color === 'emerald' ? 'text-emerald-500' :
                        'text-green-500'
                      }`} />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <Link
                  to="/login"
                  className={`block text-center py-3 rounded-xl font-bold transition ${
                    plan.popular 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-500/30' 
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  Commencer
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 px-4 bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            {[
              { icon: Lock, title: 'Sécurisé', desc: 'Chiffrement SSL' },
              { icon: Clock, title: '24/7', desc: 'Disponibilité' },
              { icon: Headphones, title: 'Support', desc: 'Assistance rapide' },
              { icon: TrendingUp, title: 'Performance', desc: 'Rapide et fiable' }
            ].map((item, index) => (
              <div key={index} className="reveal flex flex-col items-center" style={{animationDelay: `${index * 0.1}s`}}>
                <div className="w-14 h-14 bg-amber-500/20 rounded-xl flex items-center justify-center mb-4">
                  <item.icon className="w-7 h-7 text-amber-400" />
                </div>
                <h4 className="font-bold text-white">{item.title}</h4>
                <p className="text-slate-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="reveal glass rounded-3xl p-12 text-center">
            {/* Logo */}
            <img 
              src="/logo-lottolab.png" 
              alt="LOTTOLAB" 
              className="h-24 w-auto mx-auto mb-8 object-contain"
            />
            
            <h2 className="text-3xl md:text-4xl font-black mb-6">
              Prêt à transformer votre business ?
            </h2>
            <p className="text-xl text-slate-300 mb-10">
              Contactez-nous pour démarrer votre projet de loterie
            </p>
            
            <div className="grid md:grid-cols-2 gap-6 mb-10">
              <a 
                href="tel:+16892450198" 
                className="flex items-center justify-center gap-4 bg-slate-700/50 hover:bg-slate-700 p-6 rounded-2xl transition group"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition">
                  <Phone className="w-7 h-7 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-slate-400 text-sm">USA</p>
                  <p className="text-xl font-bold text-white">+1 689 245 01 98</p>
                </div>
              </a>
              
              <a 
                href="tel:+50938196748" 
                className="flex items-center justify-center gap-4 bg-slate-700/50 hover:bg-slate-700 p-6 rounded-2xl transition group"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition">
                  <Phone className="w-7 h-7 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-slate-400 text-sm">Haiti</p>
                  <p className="text-xl font-bold text-white">+509 38 19 67 48</p>
                </div>
              </a>
            </div>

            <Link 
              to="/login" 
              className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white px-10 py-5 rounded-2xl font-bold text-xl transition transform hover:scale-105 shadow-xl shadow-amber-500/30"
            >
              Commencer Aujourd'hui
              <ArrowRight className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <img 
                src="/logo-lottolab.png" 
                alt="LOTTOLAB" 
                className="h-12 w-auto object-contain mb-4"
              />
              <p className="text-slate-400 text-sm">
                La plateforme de gestion de loterie la plus complète pour les entreprises.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#features" className="hover:text-amber-400 transition">Fonctionnalités</a></li>
                <li><a href="#pricing" className="hover:text-amber-400 transition">Tarifs</a></li>
                <li><Link to="/login" className="hover:text-amber-400 transition">Connexion</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>USA: +1 689 245 01 98</li>
                <li>Haiti: +509 38 19 67 48</li>
                <li>support@lottolab.tech</li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-4">Légal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="/terms" className="hover:text-amber-400 transition">Conditions d'utilisation</a></li>
                <li><a href="/privacy" className="hover:text-amber-400 transition">Confidentialité</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-800 pt-8 text-center">
            <p className="text-slate-500 text-sm">
              © 2026 LOTTOLAB by JM Studio. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>

      {/* WhatsApp Floating Button */}
      <WhatsAppButton />
    </div>
  );
};

export default LandingPage;
