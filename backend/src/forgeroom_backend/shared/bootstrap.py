from pathlib import Path

from git import Repo

from .database import Base


def ensure_database(engine) -> None:
    Base.metadata.create_all(bind=engine)


def ensure_demo_repo(repo_root: Path) -> None:
    repo_root.mkdir(parents=True, exist_ok=True)
    if not (repo_root / ".git").exists():
        repo = Repo.init(repo_root)
        repo.git.add(A=True)
        repo.index.commit("Initial demo repo")
