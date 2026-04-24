from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

from git import Repo


async def apply_diff_and_commit(diff_text: str, commit_message: str, repo_path: Path, push: bool = False) -> tuple[str, str]:
    repo = Repo(repo_path)
    with tempfile.NamedTemporaryFile(mode="w", suffix=".patch", delete=False) as handle:
        handle.write(diff_text)
        patch_path = Path(handle.name)

    try:
        result = subprocess.run(
            ["git", "apply", "--whitespace=fix", str(patch_path)],
            cwd=repo_path,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or "git apply failed")

        repo.git.add(A=True)
        commit = repo.index.commit(f"[ForgeRoom] {commit_message.strip()}")

        detail = "committed"
        if push:
            origin = repo.remotes.origin
            origin.push()
            detail = "pushed"
        return commit.hexsha[:8], detail
    finally:
        patch_path.unlink(missing_ok=True)
