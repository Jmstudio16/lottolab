from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
env_file = ROOT_DIR / '.env'
prod_env_file = ROOT_DIR / '.env.production'
if env_file.exists():
    load_dotenv(env_file)
elif prod_env_file.exists():
    load_dotenv(prod_env_file)
else:
    load_dotenv(env_file)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("JWT_SECRET_KEY environment variable is required for production. Set it in backend/.env or .env.production")
if SECRET_KEY.strip() == "VOTRE-CLE-SECRETE-TRES-LONGUE-ET-COMPLEXE-CHANGEZ-LA" or SECRET_KEY.strip().startswith("VOTRE-CLE"):
    raise ValueError("JWT_SECRET_KEY in backend/.env or .env.production must be replaced with a real secret, not the placeholder value.")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
