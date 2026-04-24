from __future__ import annotations

import asyncio
from unittest.mock import patch

from forgeroom_backend.execution.diff_utils import validate_diff
from forgeroom_backend.execution.gemini_cli import run_gemini_cli
from forgeroom_backend.execution.git_ops import apply_diff_and_commit


async def _execution_case(temp_db_and_repo):
    _db, repo_path = temp_db_and_repo
    decisions = [
        {
            "id": "decision-1",
            "timestamp": "2026-04-24T00:00:00",
            "description": "Use JWT for authentication",
            "category": "auth",
            "depends_on": [],
            "contradicts": [],
            "risk_score": 0,
        }
    ]
    with patch("forgeroom_backend.execution.gemini_cli.shutil.which", return_value=None):
        diff = await run_gemini_cli("Implement the approved auth foundation.", decisions, repo_path, enable_fallbacks=True)

    print(f"\n[DEBUG] Generated Diff:\n{diff}\n[DEBUG] End of Diff")

    validate_diff(diff, repo_path)
    commit_hash, status = await apply_diff_and_commit(diff, "Apply generated diff", repo_path, push=False)

    assert status == "committed"
    assert len(commit_hash) == 8
    assert (repo_path / "forgeroom_generated.md").exists()


def test_execute_spec_and_apply_diff(temp_db_and_repo):
    asyncio.run(_execution_case(temp_db_and_repo))
