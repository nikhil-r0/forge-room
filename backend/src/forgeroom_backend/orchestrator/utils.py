import re
from pathlib import Path

import httpx


async def fetch_skill_from_url(url: str) -> str:
    # Normalize GitHub URLs to raw content if needed
    if "github.com" in url and "/blob/" in url:
        url = url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/")
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.text


def build_codebase_snapshot(repo_path: Path, suffixes: set[str] | None = None, max_files: int = 8) -> str:
    suffixes = suffixes or {".py", ".ts", ".tsx", ".js", ".jsx", ".md", ".json", ".yml", ".yaml"}
    files = []
    for path in sorted(repo_path.rglob("*")):
        if not path.is_file() or path.suffix not in suffixes:
            continue
        if any(part in {".git", "node_modules", "__pycache__", ".next", ".venv", "venv"} for part in path.parts):
            continue
        files.append(path)
        if len(files) >= max_files:
            break

    snapshots = []
    for path in files:
        try:
            lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        except OSError:
            continue
        numbered = "\n".join(f"{index}: {line}" for index, line in enumerate(lines, start=1))
        snapshots.append(f"### FILE: {path.relative_to(repo_path)}\n{numbered}")
    return "\n\n".join(snapshots)


def build_targeted_snapshot(repo_path: Path, category: str, max_files: int = 5) -> str:
    keywords_by_category = {
        "auth": ["auth", "session", "jwt", "cookie", "oauth", "token"],
        "database": ["sqlite", "postgres", "database", "schema", "model"],
        "api": ["route", "api", "router", "endpoint", "graphql", "rest"],
        "frontend": ["component", "store", "hook", "state"],
        "security": ["hash", "encrypt", "sanitize", "csrf", "auth"],
        "infra": ["docker", "queue", "deploy", "worker"],
    }
    keywords = keywords_by_category.get(category, [])
    matched = []
    for path in sorted(repo_path.rglob("*")):
        if not path.is_file() or path.suffix not in {".py", ".ts", ".tsx", ".js", ".jsx"}:
            continue
        if any(part in {".git", "node_modules", "__pycache__", ".next", ".venv", "venv"} for part in path.parts):
            continue
        try:
            content = path.read_text(encoding="utf-8", errors="ignore").lower()
        except OSError:
            continue
        if any(keyword in content for keyword in keywords):
            matched.append(path)
        if len(matched) >= max_files:
            break
    if not matched:
        return build_codebase_snapshot(repo_path, max_files=max_files)

    snapshots = []
    for path in matched:
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        numbered = "\n".join(f"{index}: {line}" for index, line in enumerate(lines, start=1))
        snapshots.append(f"### FILE: {path.relative_to(repo_path)}\n{numbered}")
    return "\n\n".join(snapshots)
