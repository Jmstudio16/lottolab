#!/bin/bash
# =====================================================================
# LOTTOLAB - PRODUCTION DEPLOYMENT VERIFICATION CHECKLIST
# =====================================================================
# This script tests if the backend is ready for production deployment
# Run this on your production server BEFORE going live

echo "=================================================="
echo "  LOTTOLAB BACKEND - PRODUCTION READINESS TEST"
echo "=================================================="
echo ""

# 1. Check Python version
echo "1. Checking Python version..."
python3 --version
if [ $? -ne 0 ]; then
    echo "  ❌ FAIL: Python 3 not installed"
    exit 1
fi
echo "  ✅ PASS"
echo ""

# 2. Check if backend files exist
echo "2. Checking backend files..."
if [ ! -f "server.py" ] || [ ! -f "auth.py" ] || [ ! -f "models.py" ]; then
    echo "  ❌ FAIL: Backend files missing"
    exit 1
fi
echo "  ✅ PASS"
echo ""

# 3. Check .env file
echo "3. Checking .env or .env.production..."
if [ ! -f ".env" ] && [ ! -f ".env.production" ]; then
    echo "  ❌ FAIL: Neither .env nor .env.production found"
    exit 1
fi
echo "  ✅ PASS"
echo ""

# 4. Check if all required packages are installed
echo "4. Checking Python packages..."
python3 -c "import fastapi; import motor; import jose; import bcrypt" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "  ⚠️  WARNING: Some packages may not be installed"
    echo "     Run: pip install -r requirements.txt"
else
    echo "  ✅ PASS"
fi
echo ""

# 5. Test Python compilation
echo "5. Testing Python syntax..."
python3 -m py_compile server.py auth.py models.py 2>/dev/null
if [ $? -ne 0 ]; then
    echo "  ❌ FAIL: Python syntax error in backend files"
    exit 1
fi
echo "  ✅ PASS"
echo ""

# 6. Check environment variables are set
echo "6. Checking environment variables..."
python3 << 'EOF'
import os
from pathlib import Path
import sys

# Load .env
root_dir = Path(__file__).parent.resolve()
env_file = root_dir / '.env'
prod_env_file = root_dir / '.env.production'

if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                # Remove quotes if present
                value = value.strip('"\'')
                os.environ[key] = value

required = ['MONGO_URL', 'DB_NAME', 'JWT_SECRET_KEY', 'CORS_ORIGINS']
missing = []
for var in required:
    if not os.environ.get(var):
        missing.append(var)

if missing:
    print(f"  ❌ FAIL: Missing variables: {', '.join(missing)}")
    sys.exit(1)

jwt_secret = os.environ.get('JWT_SECRET_KEY', '')
if 'VOTRE-CLE' in jwt_secret:
    print(f"  ❌ FAIL: JWT_SECRET_KEY still contains placeholder value")
    sys.exit(1)

print("  ✅ PASS: All required environment variables set")
EOF

if [ $? -ne 0 ]; then
    exit 1
fi
echo ""

echo "=================================================="
echo "✅ ALL CHECKS PASSED!"
echo "=================================================="
echo ""
echo "Next steps to deploy:"
echo "1. Copy .env to production server (via SSH or deployment tool)"
echo "2. Install requirements: pip install -r requirements.txt"
echo "3. Start backend with PM2:"
echo "   pm2 start 'uvicorn server:app --host 0.0.0.0 --port 8001' --name lottolab-backend"
echo "4. Configure Nginx as reverse proxy"
echo "5. Test: curl https://yourdomain.com/api/health"
echo ""
echo "If you see HTTP 500 on login, check:"
echo "  - MongoDB connection: Check MONGO_URL in .env"
echo "  - Network access: Server must have internet to reach MongoDB Atlas"
echo "  - Firewall: Check that port 27017 is not blocked by firewall"
echo "  - Backend logs: pm2 logs lottolab-backend"
echo ""
