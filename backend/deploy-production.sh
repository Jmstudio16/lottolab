#!/bin/bash
# =====================================================================
# LOTTOLAB - DEPLOYMENT & FIX HTTP 500
# =====================================================================
# Instructions pour réparer HTTP 500 et déployer le backend correctement

set -e

echo "=================================================="
echo "  LOTTOLAB BACKEND - DEPLOYMENT GUIDE"
echo "=================================================="
echo ""

BACKEND_PATH="/app/backend"
PRODUCTION_URL="https://multi-tenant-lottery.emergent.host"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================
# STEP 1: VERIFY FILES
# ============================================================
echo -e "${YELLOW}STEP 1: Vérifier les fichiers locaux...${NC}"
echo "---"

if [ ! -d "$BACKEND_PATH" ]; then
    echo -e "${RED}✗ Répertoire $BACKEND_PATH non trouvé${NC}"
    exit 1
fi

cd "$BACKEND_PATH"

for file in server.py auth.py models.py requirements.txt .env .env.production; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file trouvé"
    else
        echo -e "${RED}✗${NC} $file MANQUANT"
        exit 1
    fi
done
echo ""

# ============================================================
# STEP 2: VERIFY ENVIRONMENT VARIABLES
# ============================================================
echo -e "${YELLOW}STEP 2: Vérifier les variables d'environnement...${NC}"
echo "---"

python3 << 'PYEOF'
import os
import sys
from pathlib import Path

# Load .env
env_file = Path('.env')
prod_env_file = Path('.env.production')

env_vars = {}

if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                value = value.strip('"\'')
                env_vars[key] = value

required = {
    'MONGO_URL': 'MongoDB connection string (mongodb+srv://...)',
    'DB_NAME': 'Database name (usually: lottolab)',
    'JWT_SECRET_KEY': 'JWT secret key (not placeholder)',
    'CORS_ORIGINS': 'Allowed origins (comma-separated)'
}

all_ok = True
for key, description in required.items():
    value = env_vars.get(key, '')
    if not value:
        print(f'✗ {key}: NOT SET ({description})')
        all_ok = False
    elif key == 'JWT_SECRET_KEY' and 'VOTRE-CLE' in value:
        print(f'✗ {key}: PLACEHOLDER VALUE (must change)')
        all_ok = False
    else:
        # Mask sensitive values
        if key in ['MONGO_URL', 'JWT_SECRET_KEY']:
            display = value[:30] + '...'
        else:
            display = value[:50] + '...' if len(value) > 50 else value
        print(f'✓ {key}: {display}')

sys.exit(0 if all_ok else 1)
PYEOF

if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}✗ Environment variables are NOT correct${NC}"
    echo "Please check .env or .env.production files"
    exit 1
fi
echo ""

# ============================================================
# STEP 3: CHECK PYTHON SYNTAX
# ============================================================
echo -e "${YELLOW}STEP 3: Vérifier la syntaxe Python...${NC}"
echo "---"

python3 -m py_compile server.py auth.py models.py 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ All Python files compile successfully${NC}"
else
    echo -e "${RED}✗ Syntax errors found${NC}"
    exit 1
fi
echo ""

# ============================================================
# STEP 4: CHECK PACKAGES
# ============================================================
echo -e "${YELLOW}STEP 4: Vérifier les packages Python...${NC}"
echo "---"

python3 -c "import fastapi, motor, jose, bcrypt; print('✓ All required packages installed')" 2>/dev/null || {
    echo -e "${YELLOW}⚠ Installing packages...${NC}"
    pip install -q -r requirements.txt
    echo -e "${GREEN}✓ Packages installed${NC}"
}
echo ""

# ============================================================
# STEP 5: CREATE DEPLOYMENT PACKAGE
# ============================================================
echo -e "${YELLOW}STEP 5: Créer le paquet de déploiement...${NC}"
echo "---"

DEPLOY_DIR="/tmp/lottolab-backend-deploy-$(date +%s)"
mkdir -p "$DEPLOY_DIR"

# Copy backend files
cp server.py auth.py models.py utils.py "$DEPLOY_DIR/" 2>/dev/null || true
cp .env "$DEPLOY_DIR/.env.prod" 2>/dev/null || true
cp requirements.txt "$DEPLOY_DIR/"

# Create startup script
cat > "$DEPLOY_DIR/start-backend.sh" << 'STARTEOF'
#!/bin/bash
cd /app/backend
source /root/.venv/bin/activate 2>/dev/null || true
pip install -q -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 4
STARTEOF
chmod +x "$DEPLOY_DIR/start-backend.sh"

# Create PM2 config
cat > "$DEPLOY_DIR/ecosystem.config.js" << 'PMEOF'
module.exports = {
  apps: [
    {
      name: 'lottolab-backend',
      script: './start-backend.sh',
      cwd: '/app/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '500M'
    }
  ]
};
PMEOF

echo -e "${GREEN}✓${NC} Deployment package created in: $DEPLOY_DIR"
echo ""

# ============================================================
# SUMMARY
# ============================================================
echo "=================================================="
echo -e "${GREEN}✅ LOCAL VERIFICATION COMPLETE${NC}"
echo "=================================================="
echo ""
echo "Next steps for production deployment:"
echo ""
echo "1️⃣  Upload to production server:"
echo "   scp -r $DEPLOY_DIR/* root@YOURSERVER:/app/backend/"
echo ""
echo "2️⃣  On production server, update .env:"
echo "   cp /app/backend/.env.prod /app/backend/.env"
echo ""
echo "3️⃣  Install dependencies:"
echo "   cd /app/backend && pip install -r requirements.txt"
echo ""
echo "4️⃣  Stop old backend (if running):"
echo "   pm2 delete lottolab-backend"
echo "   pkill -f 'uvicorn server'"
echo ""
echo "5️⃣  Start new backend:"
echo "   pm2 start ecosystem.config.js --name lottolab-backend"
echo "   pm2 save"
echo ""
echo "6️⃣  Verify backend is running:"
echo "   curl http://localhost:8001/api/health"
echo "   curl -X POST http://localhost:8001/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@test.com\",\"password\":\"test\"}'"
echo ""
echo "7️⃣  Check logs:"
echo "   pm2 logs lottolab-backend"
echo ""
echo "If HTTP 500 persists after deployment, check:"
echo "   - MongoDB connection: Verify MONGO_URL is correct and server has internet access"
echo "   - Port 27017: Make sure firewall allows MongoDB Atlas connection"
echo "   - JWT Secret: Ensure JWT_SECRET_KEY is not a placeholder"
echo "   - Logs: pm2 logs lottolab-backend --lines 100"
echo ""
