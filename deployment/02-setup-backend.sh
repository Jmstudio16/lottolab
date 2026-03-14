#!/bin/bash
# ==============================================
# SCRIPT DE CONFIGURATION DU BACKEND
# À exécuter dans /var/www/lottolab-backend
# ==============================================

echo "🔧 Configuration du Backend LOTTOLAB"
echo "====================================="

# 1. CRÉER L'ENVIRONNEMENT VIRTUEL PYTHON
echo ""
echo "🐍 1. Création de l'environnement virtuel Python..."
python3 -m venv venv
source venv/bin/activate

# 2. INSTALLER LES DÉPENDANCES
echo ""
echo "📦 2. Installation des dépendances Python..."
pip install --upgrade pip
pip install -r requirements.txt

# 3. CRÉER LE FICHIER .env
echo ""
echo "⚙️ 3. Création du fichier .env..."
cat > .env << 'EOF'
MONGO_URL="mongodb://localhost:27017"
DB_NAME="lottolab"
CORS_ORIGINS="*"
JWT_SECRET_KEY="CHANGEZ-CETTE-CLE-SECRETE-EN-PRODUCTION-$(openssl rand -hex 32)"
EOF

echo "✅ Fichier .env créé"

# 4. TESTER QUE LE BACKEND DÉMARRE
echo ""
echo "🧪 4. Test du démarrage..."
timeout 10 python3 -c "
import uvicorn
from server import app
print('✅ Import réussi - le backend peut démarrer')
" || echo "❌ Erreur d'import - vérifiez les dépendances"

echo ""
echo "====================================="
echo "✅ Backend configuré!"
echo ""
echo "Pour démarrer manuellement:"
echo "  source venv/bin/activate"
echo "  uvicorn server:app --host 0.0.0.0 --port 8001"
echo ""
echo "Pour démarrer avec systemd (production):"
echo "  sudo cp lottolab-backend.service /etc/systemd/system/"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable lottolab-backend"
echo "  sudo systemctl start lottolab-backend"
echo "====================================="
