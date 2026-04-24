from __future__ import annotations

from pathlib import Path

import pytest
from git import Repo

from forgeroom_backend.shared.bootstrap import ensure_database
from forgeroom_backend.shared import database as db_module
from forgeroom_backend.shared.demo_repo import seed_demo_repo
from forgeroom_backend.shared.settings import get_settings


@pytest.fixture()
def temp_db_and_repo(tmp_path: Path):
    database_path = tmp_path / "test.db"
    db_module.configure_database(f"sqlite+pysqlite:///{database_path}")
    ensure_database(db_module.ENGINE)

    repo_path = tmp_path / "demo_repo"
    seed_demo_repo(repo_path)
    repo = Repo.init(repo_path)
    repo.git.add(A=True)
    repo.index.commit("Initial demo repo")

    settings = get_settings()
    settings.target_repo_path = str(repo_path)
    settings.enable_demo_fallbacks = True
    settings.allow_git_push = False

    db = db_module.SessionLocal()
    try:
        yield db, repo_path
    finally:
        db.close()
