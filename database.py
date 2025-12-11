from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError
import time

from .config import settings


# Create engine with connection pooling and retry logic
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={
        "connect_timeout": 10,
    }
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Initialize database tables. Retries connection with exponential backoff.
    """
    from . import models  # noqa: F401

    max_retries = 3
    retry_delay = 2  # seconds
    
    for attempt in range(max_retries):
        try:
            # Test connection first
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            
            # Create tables if they don't exist
            models.Base.metadata.create_all(bind=engine)
            
            # Lightweight auto-migration: ensure comments.parent_id exists
            try:
                inspector = inspect(engine)
                if 'comments' in inspector.get_table_names():
                    columns = {col['name'] for col in inspector.get_columns('comments')}
                    if 'parent_id' not in columns:
                        with engine.begin() as conn:
                            dialect = engine.dialect.name
                            if dialect == 'mysql':
                                conn.execute(text('ALTER TABLE comments ADD COLUMN parent_id INT NULL'))
                            elif dialect == 'postgresql':
                                conn.execute(text('ALTER TABLE comments ADD COLUMN parent_id INTEGER NULL'))
                            else:  # sqlite and others
                                conn.execute(text('ALTER TABLE comments ADD COLUMN parent_id INTEGER'))
                # Ensure users.avatar_url exists
                if 'users' in inspector.get_table_names():
                    columns = {col['name'] for col in inspector.get_columns('users')}
                    if 'avatar_url' not in columns:
                        with engine.begin() as conn:
                            dialect = engine.dialect.name
                            if dialect == 'mysql':
                                conn.execute(text('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL'))
                            elif dialect == 'postgresql':
                                conn.execute(text('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL'))
                            else:  # sqlite and others
                                conn.execute(text('ALTER TABLE users ADD COLUMN avatar_url TEXT'))
            except Exception:
                # Best-effort; ignore if the column already exists or cannot be altered at runtime
                pass
            
            return  # Success, exit retry loop
            
        except (OperationalError, Exception) as e:
            if attempt < max_retries - 1:
                error_msg = str(e)
                print(f"Database connection attempt {attempt + 1}/{max_retries} failed: {error_msg}")
                print(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                # Last attempt failed
                error_msg = str(e)
                print(f"WARNING: Failed to connect to database after {max_retries} attempts.")
                print(f"Error: {error_msg}")
                print(f"Please check your DATABASE_URL in the .env file.")
                db_url_preview = settings.database_url[:80] + "..." if len(settings.database_url) > 80 else settings.database_url
                print(f"Current DATABASE_URL (preview): {db_url_preview}")
                print("The app will start, but database operations will fail until the connection is fixed.")
                # Don't raise - let the app start, connections will fail at runtime with better error messages
                return
