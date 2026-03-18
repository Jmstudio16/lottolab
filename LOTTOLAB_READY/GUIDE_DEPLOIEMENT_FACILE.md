# ============================================
# LOTTOLAB - DÉPLOIEMENT FACILE 100% GRATUIT
# Netlify (Frontend) + Render (Backend) + MongoDB Atlas
# ============================================

## 🎯 CETTE MÉTHODE EST:
- ✅ 100% Gratuite
- ✅ Sans VPS ni terminal
- ✅ Visible sur Google
- ✅ SSL automatique (HTTPS)
- ✅ Fonctionne avec votre domaine lottolab.tech

---

## ÉTAPE 1: CRÉER LA BASE DE DONNÉES (MongoDB Atlas)

### 1.1 Créer un compte
1. Allez sur: https://www.mongodb.com/cloud/atlas/register
2. Créez un compte gratuit (avec Google ou email)

### 1.2 Créer un cluster gratuit
1. Cliquez **"Build a Database"**
2. Choisissez **"M0 FREE"** (gratuit)
3. Région: **Paris (EU)** ou **N. Virginia (US)**
4. Cliquez **"Create"**

### 1.3 Créer un utilisateur
1. Allez dans **"Database Access"** (menu gauche)
2. Cliquez **"Add New Database User"**
3. Username: `lottolab`
4. Password: `LottoLab2026!` (notez-le!)
5. Cliquez **"Add User"**

### 1.4 Autoriser les connexions
1. Allez dans **"Network Access"** (menu gauche)
2. Cliquez **"Add IP Address"**
3. Cliquez **"Allow Access from Anywhere"** (0.0.0.0/0)
4. Cliquez **"Confirm"**

### 1.5 Obtenir l'URL de connexion
1. Allez dans **"Database"** (menu gauche)
2. Cliquez **"Connect"** sur votre cluster
3. Choisissez **"Connect your application"**
4. Copiez l'URL, elle ressemble à:
```
mongodb+srv://lottolab:LottoLab2026!@cluster0.xxxxx.mongodb.net/lottolab?retryWrites=true&w=majority
```
5. **GARDEZ CETTE URL** pour l'étape 2

---

## ÉTAPE 2: DÉPLOYER LE BACKEND (Render.com)

### 2.1 Créer un compte Render
1. Allez sur: https://render.com
2. Cliquez **"Get Started for Free"**
3. Connectez-vous avec **GitHub**

### 2.2 Connecter votre repo GitHub
1. Après "Save to GitHub" depuis Emergent, votre code sera sur GitHub
2. Sur Render, cliquez **"New +"** → **"Web Service"**
3. Connectez votre repo GitHub `lottolab`
4. Sélectionnez le repo

### 2.3 Configurer le service
Remplissez:
- **Name**: `lottolab-api`
- **Region**: `Frankfurt (EU)` ou `Oregon (US)`
- **Branch**: `main`
- **Root Directory**: `backend`
- **Runtime**: `Python 3`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`

### 2.4 Ajouter les variables d'environnement
Cliquez **"Advanced"** puis **"Add Environment Variable"**:

| Key | Value |
|-----|-------|
| `MONGO_URL` | (votre URL MongoDB Atlas de l'étape 1.5) |
| `DB_NAME` | `lottolab` |
| `JWT_SECRET_KEY` | `lottolab-production-secret-key-2026` |
| `CORS_ORIGINS` | `https://lottolab.tech,https://www.lottolab.tech,https://lottolab.netlify.app` |

### 2.5 Créer le service
1. Cliquez **"Create Web Service"**
2. Attendez le déploiement (3-5 minutes)
3. Render vous donne une URL comme: `https://lottolab-api.onrender.com`
4. **NOTEZ CETTE URL** pour l'étape 3

### 2.6 Tester le backend
Visitez: `https://lottolab-api.onrender.com/api/health`
Vous devez voir: `{"status":"healthy","database":"connected"...}`

---

## ÉTAPE 3: DÉPLOYER LE FRONTEND (Netlify)

### 3.1 Créer un compte Netlify
1. Allez sur: https://www.netlify.com
2. Cliquez **"Sign up"**
3. Connectez-vous avec **GitHub**

### 3.2 Créer un nouveau site
1. Cliquez **"Add new site"** → **"Import an existing project"**
2. Choisissez **GitHub**
3. Sélectionnez votre repo `lottolab`

### 3.3 Configurer le build
Remplissez:
- **Base directory**: `frontend`
- **Build command**: `yarn build`
- **Publish directory**: `frontend/build`

### 3.4 Ajouter la variable d'environnement
Cliquez **"Advanced build settings"** → **"New variable"**:

| Key | Value |
|-----|-------|
| `REACT_APP_BACKEND_URL` | `https://lottolab-api.onrender.com` (votre URL Render) |

### 3.5 Déployer
1. Cliquez **"Deploy site"**
2. Attendez le déploiement (2-3 minutes)
3. Netlify vous donne une URL comme: `https://random-name.netlify.app`

---

## ÉTAPE 4: CONNECTER VOTRE DOMAINE lottolab.tech

### 4.1 Sur Netlify (Frontend)
1. Allez dans **"Domain settings"**
2. Cliquez **"Add custom domain"**
3. Entrez: `lottolab.tech`
4. Netlify vous donne des serveurs DNS:
   - `dns1.p01.nsone.net`
   - `dns2.p01.nsone.net`

### 4.2 Sur Hostinger (DNS)
1. Connectez-vous à Hostinger
2. Allez dans **"Domains"** → **"lottolab.tech"** → **"DNS / Nameservers"**
3. Changez les nameservers pour ceux de Netlify
4. **OU** ajoutez ces enregistrements:

| Type | Name | Value |
|------|------|-------|
| CNAME | @ | `your-site.netlify.app` |
| CNAME | www | `your-site.netlify.app` |

### 4.3 SSL automatique
Netlify active automatiquement HTTPS après la configuration DNS (attendez 5-30 min)

---

## ÉTAPE 5: ÊTRE VISIBLE SUR GOOGLE (SEO)

### 5.1 Google Search Console
1. Allez sur: https://search.google.com/search-console
2. Cliquez **"Add property"**
3. Choisissez **"URL prefix"**
4. Entrez: `https://lottolab.tech`
5. Vérifiez avec DNS ou HTML

### 5.2 Soumettre le Sitemap
1. Dans Search Console, allez dans **"Sitemaps"**
2. Ajoutez: `https://lottolab.tech/sitemap.xml`
3. Cliquez **"Submit"**

### 5.3 Indexation
- Google indexera votre site en 1-7 jours
- Vous pouvez demander une indexation manuelle dans Search Console

---

## ✅ RÉCAPITULATIF

Après ces étapes, vous aurez:
- ✅ Frontend: https://lottolab.tech (Netlify)
- ✅ Backend API: https://lottolab-api.onrender.com (Render)
- ✅ Base de données: MongoDB Atlas (cloud)
- ✅ SSL/HTTPS automatique
- ✅ Visible sur Google

---

## 🔧 COMPTES DE TEST

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | admin@lottolab.com | 123456 |
| Company Admin | admin@lotopam.com | Admin123! |

---

## ❓ PROBLÈMES COURANTS

### "Application error" sur Render
- Vérifiez les variables d'environnement
- Vérifiez les logs dans Render Dashboard

### Le site ne charge pas
- Attendez la propagation DNS (5-30 min)
- Vérifiez que REACT_APP_BACKEND_URL est correct

### Erreur CORS
- Ajoutez votre domaine Netlify dans CORS_ORIGINS sur Render

---

## 📞 SUPPORT

- WhatsApp USA: +1 689 245 01 98
- WhatsApp Haiti: +509 38 19 67 48
