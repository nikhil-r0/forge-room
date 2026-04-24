from pathlib import Path

from git import Repo

from .database import Base
from .demo_repo import seed_demo_repo


def ensure_database(engine) -> None:
    Base.metadata.create_all(bind=engine)


def ensure_demo_repo(repo_root: Path) -> None:
    seed_demo_repo(repo_root)
    if not (repo_root / ".git").exists():
        repo = Repo.init(repo_root)
        repo.git.add(A=True)
        repo.index.commit("Initial demo repo")
