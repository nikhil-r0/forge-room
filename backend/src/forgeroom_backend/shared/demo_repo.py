from pathlib import Path


DEMO_FILES = {
    "README.md": "# Demo Repo\n",
    "requirements.txt": "fastapi\nsqlalchemy\n",
    "src/main.py": "from src.auth.middleware import authenticate_request\n",
    "src/auth/middleware.py": """# Session-based authentication middleware
import session


def authenticate_request(request):
    \"\"\"Validates user via session cookie.\"\"\"
    session_id = request.cookies.get('session_id')
    if not session_id:
        return None

    user_data = session.store.get(session_id)
    return user_data


def create_session(user_id: str) -> str:
    \"\"\"Creates a new session and returns session cookie value.\"\"\"
    session_id = session.store.create(user_id)
    return session_id
""",
    "src/database/connection.py": """import sqlite3


def connect_db(path: str = 'app.db'):
    return sqlite3.connect(path)
""",
    "src/api/routes.py": """from fastapi import APIRouter

router = APIRouter()
""",
}


def seed_demo_repo(repo_root: Path) -> None:
    repo_root.mkdir(parents=True, exist_ok=True)
    for relative_path, content in DEMO_FILES.items():
        target = repo_root / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            target.write_text(content, encoding="utf-8")
