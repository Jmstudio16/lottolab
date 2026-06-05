#!/usr/bin/env python
"""
Quick diagnostic script to test backend startup and connectivity
"""
import os
import sys
import asyncio
from pathlib import Path
from dotenv import load_dotenv

print("=" * 70)
print("LOTTOLAB BACKEND - DIAGNOSTIC TEST")
print("=" * 70)

# Load env files
ROOT_DIR = Path(__file__).parent
env_file = ROOT_DIR / '.env'
prod_env_file = ROOT_DIR / '.env.production'

if env_file.exists():
    print(f"✓ Loading {env_file}")
    load_dotenv(env_file)
elif prod_env_file.exists():
    print(f"✓ Loading {prod_env_file}")
    load_dotenv(prod_env_file)
else:
    print("✗ No .env or .env.production found!")
    sys.exit(1)

# Check critical env vars
print("\n1. CHECKING ENVIRONMENT VARIABLES:")
print("-" * 70)

required_vars = ["MONGO_URL", "DB_NAME", "JWT_SECRET_KEY", "CORS_ORIGINS"]
env_status = {}
for var in required_vars:
    value = os.environ.get(var, "NOT SET")
    is_set = value != "NOT SET"
    status = "✓" if is_set else "✗"
    
    # Mask sensitive values
    display_value = value
    if var == "MONGO_URL" and is_set:
        try:
            if "@" in value:
                scheme, rest = value.split("://", 1)
                creds, host = rest.split("@", 1)
                user = creds.split(":")[0]
                display_value = f"{scheme}://{user}:***@{host[:50]}..."
            else:
                display_value = value[:50] + "..." if len(value) > 50 else value
        except:
            display_value = value[:50] + "..."
    elif var == "JWT_SECRET_KEY" and is_set:
        display_value = value[:30] + "..." if len(value) > 30 else value
    
    print(f"{status} {var:20s} = {display_value}")
    env_status[var] = is_set

missing = [v for v, is_set in env_status.items() if not is_set]
if missing:
    print(f"\n✗ Missing required variables: {missing}")
    sys.exit(1)

# Test JWT secret validity
print("\n2. CHECKING JWT SECRET:")
print("-" * 70)
jwt_secret = os.environ.get("JWT_SECRET_KEY", "")
if jwt_secret.strip().startswith("VOTRE-CLE"):
    print("✗ JWT_SECRET_KEY is still using placeholder value!")
    sys.exit(1)
else:
    print("✓ JWT_SECRET_KEY is set to a real value")

# Test MongoDB connection
print("\n3. TESTING MONGODB CONNECTION:")
print("-" * 70)

try:
    from motor.motor_asyncio import AsyncIOMotorClient
    
    async def test_mongo():
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        
        print(f"Connecting to: {mongo_url.split('@')[1] if '@' in mongo_url else mongo_url[:50]}...")
        print(f"Database: {db_name}")
        
        try:
            client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
            db = client[db_name]
            
            # Test connection
            await db.command("ping")
            print("✓ MongoDB connection successful!")
            
            # Check if users collection exists
            users_count = await db.users.count_documents({})
            print(f"✓ Users collection: {users_count} users found")
            
            # Check for super admin
            super_admin = await db.users.find_one({"role": "SUPER_ADMIN"})
            if super_admin:
                print(f"✓ Super Admin found: {super_admin.get('email')}")
            else:
                print("⚠ No Super Admin found (will be auto-created on first startup)")
            
            return True
        except Exception as e:
            print(f"✗ MongoDB connection failed: {str(e)[:100]}")
            return False
    
    result = asyncio.run(test_mongo())
    if not result:
        sys.exit(1)

except Exception as e:
    print(f"✗ Error testing MongoDB: {str(e)}")
    sys.exit(1)

# Test auth module
print("\n4. TESTING AUTH MODULE:")
print("-" * 70)

try:
    from auth import create_access_token, decode_token, verify_password, get_password_hash
    
    # Test token creation
    test_payload = {"user_id": "test_user", "role": "SUPER_ADMIN", "company_id": None}
    token = create_access_token(test_payload)
    print(f"✓ Token created: {token[:50]}...")
    
    # Test token decoding
    decoded = decode_token(token)
    if decoded and decoded.get("user_id") == "test_user":
        print("✓ Token decoded successfully")
    else:
        print("✗ Token decode failed")
        sys.exit(1)
    
    # Test password hashing
    test_pass = "TestPassword123!"
    hashed = get_password_hash(test_pass)
    if verify_password(test_pass, hashed):
        print("✓ Password hashing/verification works")
    else:
        print("✗ Password verification failed")
        sys.exit(1)

except Exception as e:
    print(f"✗ Auth module error: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test CORS configuration
print("\n5. CHECKING CORS CONFIGURATION:")
print("-" * 70)
cors_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
print(f"✓ CORS Origins: {len(cors_origins)} domain(s) configured")
for origin in cors_origins[:5]:
    print(f"  - {origin.strip()}")
if len(cors_origins) > 5:
    print(f"  ... and {len(cors_origins) - 5} more")

print("\n" + "=" * 70)
print("✅ ALL DIAGNOSTICS PASSED!")
print("=" * 70)
print("\nNext steps:")
print("1. Run: uvicorn server:app --host 0.0.0.0 --port 8001 --reload")
print("2. Test: curl http://localhost:8001/api/health")
print("3. Login: POST http://localhost:8001/api/auth/login")
print("=" * 70)
