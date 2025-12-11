from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from passlib.context import CryptContext

from .config import settings


pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def _create_token(data: dict[str, Any], expires_delta: timedelta) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm="HS256")


def create_access_token(subject: str) -> str:
    return _create_token({"sub": subject, "type": "access"}, timedelta(minutes=settings.access_token_expires_minutes))


def create_refresh_token(subject: str) -> str:
    return _create_token({"sub": subject, "type": "refresh"}, timedelta(days=settings.refresh_token_expires_days))


def decode_token(token: str) -> Optional[dict[str, Any]]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


