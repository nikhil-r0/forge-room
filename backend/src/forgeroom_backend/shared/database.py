from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from .settings import get_settings


Base = declarative_base()


def build_engine(database_url: str | None = None):
    settings = get_settings()
    url = database_url or settings.database_url
    
    is_sqlite = url.startswith("sqlite")
    connect_args = {"check_same_thread": False} if is_sqlite else {}
    
    if is_sqlite:
        return create_engine(url, future=True, connect_args=connect_args)
    
    return create_engine(
        url, 
        future=True, 
        connect_args=connect_args,
        pool_size=20,
        max_overflow=10,
        pool_timeout=60
    )


ENGINE = build_engine()
SessionLocal = sessionmaker(bind=ENGINE, autoflush=False, autocommit=False, expire_on_commit=False)


def configure_database(database_url: str):
    global ENGINE, SessionLocal
    ENGINE.dispose()
    ENGINE = build_engine(database_url)
    SessionLocal = sessionmaker(bind=ENGINE, autoflush=False, autocommit=False, expire_on_commit=False)
    return ENGINE


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
