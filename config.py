from typing import List, Optional
import os
from pathlib import Path

# Try to load dotenv if available
try:
    from dotenv import load_dotenv
    # Load environment variables from .env file in backend directory
    env_path = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(dotenv_path=env_path)
except ImportError:
    # dotenv not installed, skip
    pass


def _normalize_db_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://") :]
    if url.startswith("postgresql://") and not url.startswith("postgresql+psycopg://"):
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


def _get_cors_origins() -> List[str]:
    csv = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    return [o.strip() for o in csv.split(",") if o.strip()]


class Settings:
    app_name: str = "BragBoard"
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-change")
    access_token_expires_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRES_MINUTES", "30"))
    refresh_token_expires_days: int = int(os.getenv("REFRESH_TOKEN_EXPIRES_DAYS", "7"))
    admin_invite_code: Optional[str] = os.getenv("ADMIN_INVITE_CODE", "admin")

    _database_url_env: Optional[str] = os.getenv(
        "DATABASE_URL",
        "postgres://avnadmin:AVNS_xJRBUwb1GKANHqq0oNh@sompalkar-sommproject-712a.b.aivencloud.com:28070/defaultdb?sslmode=require",
    )
    cors_origins: List[str] = _get_cors_origins()
    _media_root_env: Optional[str] = os.getenv("MEDIA_ROOT")
    _media_root: Optional[Path] = None

    # Cloudinary settings
    cloudinary_cloud_name: Optional[str] = os.getenv("CLOUDINARY_CLOUD_NAME")
    cloudinary_api_key: Optional[str] = os.getenv("CLOUDINARY_API_KEY")
    cloudinary_api_secret: Optional[str] = os.getenv("CLOUDINARY_API_SECRET")

    @property
    def database_url(self) -> str:
        """
        Require a PostgreSQL DATABASE_URL. No SQLite fallback.
        """
        if not self._database_url_env:
            raise RuntimeError("DATABASE_URL must be set to a PostgreSQL URL")
        return _normalize_db_url(self._database_url_env)

    @property
    def media_root(self) -> Path:
        """
        Directory where user-uploaded files are stored.
        Defaults to `<backend>/app/media`.
        """
        if self._media_root is None:
            if self._media_root_env:
                self._media_root = Path(self._media_root_env)
            else:
                self._media_root = Path(__file__).resolve().parent / "media"
        self._media_root.mkdir(parents=True, exist_ok=True)
        return self._media_root


settings = Settings()


