import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import sessionmaker, DeclarativeBase

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not configured")


def ensure_database_exists(database_url: str):
    """
    Ensures the target database exists on MySQL before SQLAlchemy connects.
    Creates the database if it does not already exist.
    """
    url = make_url(database_url)
    if not url.database or url.drivername.startswith("sqlite"):
        return

    try:
        # Connect to MySQL server without specifying a database
        server_url = url.set(database="")
        temp_engine = create_engine(server_url, isolation_level="AUTOCOMMIT")
        with temp_engine.connect() as conn:
            conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{url.database}`"))
        temp_engine.dispose()
    except Exception as exc:
        print(f"[Warning] Could not auto-create database '{url.database}': {exc}")


# Auto-create database if not exists before initializing main engine
ensure_database_exists(DATABASE_URL)

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()