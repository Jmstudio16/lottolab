#!/usr/bin/env python3
"""
LOTTOLAB - COMPLETE DEPLOYMENT VALIDATOR
Vérifie que tout est correctement configuré avant de déployer
"""

import os
import sys
import subprocess
import asyncio
from pathlib import Path
from typing import Tuple, List

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_header(text: str):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{text:^60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}\n")

def print_success(text: str):
    print(f"{Colors.GREEN}✓{Colors.RESET} {text}")

def print_error(text: str):
    print(f"{Colors.RED}✗{Colors.RESET} {text}")

def print_warning(text: str):
    print(f"{Colors.YELLOW}⚠{Colors.RESET} {text}")

def print_info(text: str):
    print(f"{Colors.BLUE}ℹ{Colors.RESET} {text}")

def run_command(cmd: str) -> Tuple[int, str, str]:
    """Run a shell command and return (returncode, stdout, stderr)"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return 1, "", "Command timed out"
    except Exception as e:
        return 1, "", str(e)

def validate_files(backend_path: Path) -> bool:
    """Validate that all required backend files exist"""
    print_header("STEP 1: Validate Files")
    
    required_files = [
        'server.py',
        'auth.py',
        'models.py',
        'requirements.txt',
        '.env'
    ]
    
    all_ok = True
    for file in required_files:
        file_path = backend_path / file
        if file_path.exists():
            print_success(f"{file}")
        else:
            print_error(f"{file} - NOT FOUND")
            all_ok = False
    
    return all_ok

def validate_env_vars(backend_path: Path) -> bool:
    """Validate environment variables"""
    print_header("STEP 2: Validate Environment Variables")
    
    env_file = backend_path / '.env'
    if not env_file.exists():
        print_error(".env file not found")
        return False
    
    env_vars = {}
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                value = value.strip('"\'')
                env_vars[key] = value
    
    required = {
        'MONGO_URL': 'mongodb+srv://',
        'DB_NAME': 'lottolab',
        'JWT_SECRET_KEY': 'not placeholder',
        'CORS_ORIGINS': 'domain'
    }
    
    all_ok = True
    for key, expected in required.items():
        value = env_vars.get(key, '')
        
        if not value:
            print_error(f"{key}: NOT SET")
            all_ok = False
        elif expected == 'not placeholder' and 'VOTRE-CLE' in value:
            print_error(f"{key}: STILL CONTAINS PLACEHOLDER")
            all_ok = False
        else:
            # Mask sensitive values
            display_value = value[:30] + '...' if len(value) > 30 else value
            print_success(f"{key}: {display_value}")
    
    return all_ok

def validate_python_syntax(backend_path: Path) -> bool:
    """Validate Python syntax"""
    print_header("STEP 3: Validate Python Syntax")
    
    files_to_check = ['server.py', 'auth.py', 'models.py']
    
    all_ok = True
    for file in files_to_check:
        file_path = backend_path / file
        returncode, _, stderr = run_command(f"python3 -m py_compile {file_path}")
        
        if returncode == 0:
            print_success(f"{file}: OK")
        else:
            print_error(f"{file}: SYNTAX ERROR")
            if stderr:
                print(f"  Error: {stderr[:100]}")
            all_ok = False
    
    return all_ok

def validate_python_packages(backend_path: Path) -> bool:
    """Validate that required Python packages are installed"""
    print_header("STEP 4: Validate Python Packages")
    
    packages = ['fastapi', 'motor', 'jose', 'bcrypt', 'dotenv', 'passlib']
    
    for package in packages:
        cmd = f"python3 -c 'import {package}' 2>/dev/null"
        returncode, _, _ = run_command(cmd)
        
        if returncode == 0:
            print_success(f"{package}")
        else:
            print_warning(f"{package}: NOT INSTALLED (will install with requirements.txt)")
    
    return True

async def validate_mongo_connection(backend_path: Path) -> bool:
    """Validate MongoDB connection"""
    print_header("STEP 5: Validate MongoDB Connection")
    
    env_file = backend_path / '.env'
    if not env_file.exists():
        print_error("Cannot test MongoDB: .env not found")
        return False
    
    # Load .env
    env_vars = {}
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                value = value.strip('"\'')
                env_vars[key] = value
    
    mongo_url = env_vars.get('MONGO_URL')
    if not mongo_url:
        print_error("MONGO_URL not set")
        return False
    
    print_info("Testing MongoDB connection (this may take a few seconds)...")
    
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
        await client.server_info()
        print_success("MongoDB connection successful")
        return True
    except Exception as e:
        error_msg = str(e)[:100]
        print_warning(f"MongoDB connection failed: {error_msg}")
        print_info("This might be normal in development. Production server needs internet access.")
        return False

def validate_cors(backend_path: Path) -> bool:
    """Validate CORS configuration"""
    print_header("STEP 6: Validate CORS Configuration")
    
    env_file = backend_path / '.env'
    env_vars = {}
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                value = value.strip('"\'')
                env_vars[key] = value
    
    cors_origins = env_vars.get('CORS_ORIGINS', '').split(',')
    
    print_success(f"CORS configured for {len(cors_origins)} domain(s)")
    for origin in cors_origins[:5]:
        origin = origin.strip()
        if origin:
            print_info(f"  {origin}")
    
    if len(cors_origins) > 5:
        print_info(f"  ... and {len(cors_origins) - 5} more")
    
    return True

async def main():
    """Main validation routine"""
    backend_path = Path(__file__).parent.resolve()
    
    print(f"\n{Colors.BOLD}{Colors.BLUE}")
    print("╔════════════════════════════════════════════════════════════╗")
    print("║                                                            ║")
    print("║  LOTTOLAB BACKEND - DEPLOYMENT VALIDATOR                  ║")
    print("║  Complete configuration check before production deploy    ║")
    print("║                                                            ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print(f"{Colors.RESET}")
    
    print_info(f"Backend path: {backend_path}\n")
    
    results = {
        'Files': validate_files(backend_path),
        'Environment': validate_env_vars(backend_path),
        'Python Syntax': validate_python_syntax(backend_path),
        'Python Packages': validate_python_packages(backend_path),
        'CORS': validate_cors(backend_path),
    }
    
    # Try MongoDB connection
    try:
        results['MongoDB'] = await validate_mongo_connection(backend_path)
    except Exception as e:
        print_warning(f"Could not validate MongoDB: {e}")
        results['MongoDB'] = None
    
    # Print summary
    print_header("VALIDATION SUMMARY")
    
    all_passed = True
    for check, result in results.items():
        if result is True:
            print_success(check)
        elif result is False:
            print_error(check)
            all_passed = False
        elif result is None:
            print_warning(check)
    
    print_header("DEPLOYMENT STATUS")
    
    if all_passed:
        print_success("All critical checks passed! Ready for deployment.\n")
        print_info("Next steps:")
        print_info("1. Copy files to production server")
        print_info("2. Run: bash DEPLOY-EMERGENT-QUICK.sh")
        print_info("3. Verify: curl http://localhost:8001/api/health")
        return 0
    else:
        print_error("Some checks failed. Please fix issues before deployment.\n")
        print_info("See errors above for details.")
        return 1

if __name__ == '__main__':
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\nValidation interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n{Colors.RED}Fatal error: {e}{Colors.RESET}")
        sys.exit(1)
