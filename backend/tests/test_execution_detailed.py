from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException
from git import Repo

from forgeroom_backend.execution import fallbacks, gemini_cli, git_ops, main
from forgeroom_backend.execution.diff_utils import DiffValidationError, extract_paths, validate_diff
from forgeroom_backend.shared.contracts import ApplyDiffRequest, ExecuteSpecRequest


def _decision_dicts() -> list[dict]:
    return [
        {
            "id": "decision-1",
            "timestamp": "2026-04-24T00:00:00",
            "description": "Use JWT for authentication",
            "category": "auth",
            "depends_on": [],
            "contradicts": [],
            "risk_score": 3.5,
        },
        {
            "id": "decision-2",
            "timestamp": "2026-04-24T00:01:00",
            "description": "Use PostgreSQL for persistence",
            "category": "database",
            "depends_on": ["decision-1"],
            "contradicts": [],
            "risk_score": 2.0,
        },
    ]


class TestFallbacks:
    def test_build_fallback_diff_is_valid_unified_diff(self) -> None:
        diff = fallbacks.build_fallback_diff("Build the auth flow", _decision_dicts())
        print(f"\n[DEBUG] Fallback Diff:\n{diff}\n[DEBUG] End of Diff")

        assert diff.startswith("--- /dev/null")
        assert "+++ b/forgeroom_generated.md" in diff
        assert "@@ -0,0" in diff
        assert "Build the auth flow" in diff
        assert "Use JWT for authentication" in diff

    def test_build_fallback_diff_handles_empty_decisions(self) -> None:
        diff = fallbacks.build_fallback_diff("Spec body", [])
        print(f"\n[DEBUG] Empty Decisions Fallback Diff:\n{diff}\n[DEBUG] End of Diff")

        assert "- No decisions provided" in diff
        assert "Spec body" in diff


class TestDiffUtils:
    def test_extract_paths_skips_dev_null_and_normalizes_b_prefix(self) -> None:
        diff = """--- a/foo.txt
+++ b/foo.txt
@@ -1 +1 @@
-old
+new
--- /dev/null
+++ b/bar.txt
@@ -0,0 +1 @@
+content
"""

        assert extract_paths(diff) == ["foo.txt", "bar.txt"]

    def test_validate_diff_accepts_safe_unified_diff(self, temp_db_and_repo) -> None:
        _db, repo_path = temp_db_and_repo
        diff = fallbacks.build_fallback_diff("Spec", _decision_dicts())

        validate_diff(diff, repo_path)

    @pytest.mark.parametrize(
        "diff_text, expected_message",
        [
            ("", "empty"),
            ("diff --git a/x b/y\n", "unified diff header"),
            ("--- /dev/null\n+++ b/outside/../escape.txt\n@@ -0,0 +1 @@\n+bad\n", "unsafe path"),
            ("--- /dev/null\n+++ b/../../escape.txt\n@@ -0,0 +1 @@\n+bad\n", "outside repo"),
            ("--- /dev/null\n+++ b/file.txt\n+no hunk header\n", "hunks"),
        ],
    )
    def test_validate_diff_rejects_bad_diff(self, temp_db_and_repo, diff_text: str, expected_message: str) -> None:
        _db, repo_path = temp_db_and_repo

        with pytest.raises(DiffValidationError, match=expected_message):
            validate_diff(diff_text, repo_path)


class TestGeminiCli:
    def test_build_prompt_includes_spec_and_decisions(self) -> None:
        prompt = gemini_cli._build_prompt("Implement auth", _decision_dicts(), Path("/tmp/repo"))

        assert "Implement auth" in prompt
        assert "Use JWT for authentication" in prompt
        assert "Use PostgreSQL for persistence" in prompt

    def test_extract_diff_finds_first_unified_diff_block(self) -> None:
        output = "thinking...\n--- a/foo.txt\n+++ b/foo.txt\n@@ -1 +1 @@\n-old\n+new\n"

        assert gemini_cli._extract_diff(output) == "--- a/foo.txt\n+++ b/foo.txt\n@@ -1 +1 @@\n-old\n+new\n"

    def test_extract_diff_returns_none_when_missing_diff(self) -> None:
        assert gemini_cli._extract_diff("no diff here") is None

    def test_run_gemini_cli_uses_fallback_when_cli_missing(self, temp_db_and_repo) -> None:
        _db, repo_path = temp_db_and_repo
        with patch("forgeroom_backend.execution.gemini_cli.shutil.which", return_value=None):
            diff = asyncio.run(
                gemini_cli.run_gemini_cli("Build auth", _decision_dicts(), repo_path, enable_fallbacks=True)
            )

        print(f"\n[DEBUG] Gemini CLI Missing Fallback Diff:\n{diff}\n[DEBUG] End of Diff")
        assert diff.startswith("--- /dev/null")
        assert "forgeroom_generated.md" in diff

    def test_run_gemini_cli_raises_when_cli_missing_and_no_fallback(self, temp_db_and_repo) -> None:
        _db, repo_path = temp_db_and_repo
        with patch("forgeroom_backend.execution.gemini_cli.shutil.which", return_value=None):
            with pytest.raises(RuntimeError, match="Gemini CLI is not installed"):
                asyncio.run(
                    gemini_cli.run_gemini_cli("Build auth", _decision_dicts(), repo_path, enable_fallbacks=False)
                )

    def test_run_gemini_cli_accepts_direct_unified_diff_output(self, temp_db_and_repo) -> None:
        _db, repo_path = temp_db_and_repo
        fake_result = Mock(returncode=0, stdout="--- a/foo.txt\n+++ b/foo.txt\n@@ -1 +1 @@\n-old\n+new\n")
        with patch("forgeroom_backend.execution.gemini_cli.shutil.which", return_value="/usr/bin/gemini"), patch(
            "forgeroom_backend.execution.gemini_cli.subprocess.run", return_value=fake_result
        ):
            diff = asyncio.run(
                gemini_cli.run_gemini_cli("Build auth", _decision_dicts(), repo_path, enable_fallbacks=False)
            )

        print(f"\n[DEBUG] Gemini CLI Direct Diff:\n{diff}\n[DEBUG] End of Diff")
        assert diff.endswith("\n")
        assert "+++ b/foo.txt" in diff

    def test_run_gemini_cli_extracts_diff_from_verbose_output(self, temp_db_and_repo) -> None:
        _db, repo_path = temp_db_and_repo
        fake_result = Mock(returncode=0, stdout="Done.\n--- a/foo.txt\n+++ b/foo.txt\n@@ -1 +1 @@\n-old\n+new\n")
        with patch("forgeroom_backend.execution.gemini_cli.shutil.which", return_value="/usr/bin/gemini"), patch(
            "forgeroom_backend.execution.gemini_cli.subprocess.run", return_value=fake_result
        ):
            diff = asyncio.run(
                gemini_cli.run_gemini_cli("Build auth", _decision_dicts(), repo_path, enable_fallbacks=False)
            )

        print(f"\n[DEBUG] Gemini CLI Verbose Output Diff:\n{diff}\n[DEBUG] End of Diff")
        assert diff.startswith("--- a/foo.txt")

    def test_run_gemini_cli_falls_back_when_subprocess_fails(self, temp_db_and_repo) -> None:
        _db, repo_path = temp_db_and_repo
        fake_result = Mock(returncode=1, stderr="boom")
        with patch("forgeroom_backend.execution.gemini_cli.shutil.which", return_value="/usr/bin/gemini"), patch(
            "forgeroom_backend.execution.gemini_cli.subprocess.run", return_value=fake_result
        ):
            diff = asyncio.run(
                gemini_cli.run_gemini_cli("Build auth", _decision_dicts(), repo_path, enable_fallbacks=True)
            )

        print(f"\n[DEBUG] Gemini CLI Subprocess Failure Fallback Diff:\n{diff}\n[DEBUG] End of Diff")
        assert "forgeroom_generated.md" in diff

    def test_run_gemini_cli_raises_when_subprocess_fails_and_fallback_disabled(self, temp_db_and_repo) -> None:
        _db, repo_path = temp_db_and_repo
        fake_result = Mock(returncode=1, stderr="boom")
        with patch("forgeroom_backend.execution.gemini_cli.shutil.which", return_value="/usr/bin/gemini"), patch(
            "forgeroom_backend.execution.gemini_cli.subprocess.run", return_value=fake_result
        ):
            with pytest.raises(RuntimeError, match="boom"):
                asyncio.run(
                    gemini_cli.run_gemini_cli("Build auth", _decision_dicts(), repo_path, enable_fallbacks=False)
                )


class TestGitOps:
    def test_apply_diff_and_commit_commits_changes(self, temp_db_and_repo) -> None:
        _db, repo_path = temp_db_and_repo
        diff = fallbacks.build_fallback_diff("Spec", _decision_dicts())
        print(f"\n[DEBUG] GitOps Apply Diff:\n{diff}\n[DEBUG] End of Diff")

        commit_hash, detail = asyncio.run(
            git_ops.apply_diff_and_commit(diff, "Apply generated diff", repo_path, push=False)
        )

        assert detail == "committed"
        assert len(commit_hash) == 8
        assert (repo_path / "forgeroom_generated.md").exists()

    def test_apply_diff_and_commit_pushes_when_requested(self, temp_db_and_repo, tmp_path) -> None:
        _db, repo_path = temp_db_and_repo
        remote_repo_path = tmp_path / "remote.git"
        Repo.init(remote_repo_path, bare=True)
        repo = Repo(repo_path)
        if "origin" not in [remote.name for remote in repo.remotes]:
            repo.create_remote("origin", str(remote_repo_path))
        repo.git.push("--set-upstream", "origin", repo.active_branch.name)

        diff = fallbacks.build_fallback_diff("Spec", _decision_dicts())
        print(f"\n[DEBUG] GitOps Push Diff:\n{diff}\n[DEBUG] End of Diff")
        commit_hash, detail = asyncio.run(
            git_ops.apply_diff_and_commit(diff, "Push me", repo_path, push=True)
        )

        assert detail == "pushed"
        assert len(commit_hash) == 8

    def test_apply_diff_and_commit_raises_on_bad_patch(self, temp_db_and_repo) -> None:
        _db, repo_path = temp_db_and_repo

        with pytest.raises(RuntimeError, match="No valid patches in input"):
            asyncio.run(git_ops.apply_diff_and_commit("not a diff", "Broken", repo_path, push=False))


class TestExecutionMain:
    def test_startup_ensures_demo_repo(self, temp_db_and_repo) -> None:
        called = Mock()
        with patch.object(main, "ensure_demo_repo", called):
            main.startup()

        called.assert_called_once_with(main.settings.target_repo)

    def test_execute_spec_route_returns_diff(self, temp_db_and_repo) -> None:
        _db, _repo_path = temp_db_and_repo
        fake_diff = fallbacks.build_fallback_diff("Spec", _decision_dicts())
        with patch.object(main, "run_gemini_cli", return_value=fake_diff) as run_mock, patch.object(
            main, "validate_diff"
        ) as validate_mock:
            response = asyncio.run(
                main.execute_spec(
                    ExecuteSpecRequest(spec_markdown="Spec", approved_decisions=_decision_dicts()),
                )
            )

        print(f"\n[DEBUG] Route Execute Spec Diff:\n{response.diff}\n[DEBUG] End of Diff")
        assert response.diff == fake_diff
        assert response.status == "success"
        run_mock.assert_awaited_once()
        validate_mock.assert_called_once()

    def test_execute_spec_route_returns_400_on_invalid_diff(self, temp_db_and_repo) -> None:
        _db, _repo_path = temp_db_and_repo
        with patch.object(main, "run_gemini_cli", return_value="broken diff"), patch.object(
            main, "validate_diff", side_effect=DiffValidationError("bad diff")
        ):
            with pytest.raises(HTTPException) as excinfo:
                asyncio.run(
                    main.execute_spec(
                        ExecuteSpecRequest(spec_markdown="Spec", approved_decisions=_decision_dicts()),
                    )
                )

        assert excinfo.value.status_code == 400
        assert "bad diff" in excinfo.value.detail

    def test_apply_diff_route_returns_commit_hash(self, temp_db_and_repo) -> None:
        _db, _repo_path = temp_db_and_repo
        diff = fallbacks.build_fallback_diff("Spec", _decision_dicts())
        print(f"\n[DEBUG] Route Apply Diff:\n{diff}\n[DEBUG] End of Diff")
        with patch.object(main, "validate_diff") as validate_mock, patch.object(
            main, "apply_diff_and_commit", return_value=("deadbeef", "committed")
        ) as apply_mock:
            response = asyncio.run(
                main.apply_diff(ApplyDiffRequest(diff_text=diff, commit_message="Ship it", push=False))
            )

        assert response.commit_hash == "deadbeef"
        assert response.status == "committed"
        apply_mock.assert_awaited_once()
        validate_mock.assert_called_once()

    def test_apply_diff_route_respects_push_guard(self, temp_db_and_repo) -> None:
        _db, _repo_path = temp_db_and_repo
        main.settings.allow_git_push = False
        with patch.object(main, "validate_diff") as validate_mock, patch.object(
            main, "apply_diff_and_commit", return_value=("deadbeef", "committed")
        ) as apply_mock:
            asyncio.run(
                main.apply_diff(
                    ApplyDiffRequest(
                        diff_text=fallbacks.build_fallback_diff("Spec", _decision_dicts()),
                        commit_message="Ship it",
                        push=True,
                    )
                )
            )

        apply_mock.assert_awaited_once()
        assert apply_mock.await_args.kwargs["push"] is False
        validate_mock.assert_called_once()

    def test_apply_diff_route_returns_500_on_runtime_error(self, temp_db_and_repo) -> None:
        _db, _repo_path = temp_db_and_repo
        with patch.object(main, "validate_diff") as validate_mock, patch.object(
            main, "apply_diff_and_commit", side_effect=RuntimeError("disk full")
        ):
            with pytest.raises(HTTPException) as excinfo:
                asyncio.run(
                    main.apply_diff(
                        ApplyDiffRequest(
                            diff_text=fallbacks.build_fallback_diff("Spec", _decision_dicts()),
                            commit_message="Ship it",
                            push=False,
                        )
                    )
                )

        assert excinfo.value.status_code == 500
        assert "disk full" in excinfo.value.detail
        validate_mock.assert_called_once()
