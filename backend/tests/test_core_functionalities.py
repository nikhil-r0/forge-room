"""Comprehensive tests for ForgeRoom core functionalities.

Tests cover:
- Full orchestration pipeline (supervisor → drift detection → blame graph)
- Gemini CLI fallback execution + diff apply + git commit
- Export pipeline with risk autopsy
- Conflict resolution end-to-end flow
- Blame graph construction and relationship tracking
- WebSocket message formatting
- Demo repo scanning and snapshot building
"""
from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from unittest.mock import patch

import pytest

from forgeroom_backend.execution.diff_utils import DiffValidationError, validate_diff
from forgeroom_backend.execution.fallbacks import build_fallback_diff
from forgeroom_backend.execution.gemini_cli import run_gemini_cli
from forgeroom_backend.execution.git_ops import apply_diff_and_commit
from forgeroom_backend.orchestrator.graph import ForgeRoomGraph
from forgeroom_backend.orchestrator.nodes.drift_detector import run_drift_detection
from forgeroom_backend.orchestrator.nodes.risk_autopsy import generate_risk_autopsy
from forgeroom_backend.orchestrator.providers import (
    AIProvider,
    fallback_appsec_review,
    fallback_drift_detection,
    fallback_supervisor,
    infer_category,
)
from forgeroom_backend.shared import repository
from forgeroom_backend.shared.blame import build_blame_graph
from forgeroom_backend.shared.contracts import (
    DecisionCategory,
    VoteChoice,
)
from forgeroom_backend.shared.exporter import generate_markdown_export
from forgeroom_backend.websocket_gateway.publisher import make_message


# ════════════════════════════════════════════
# 1. ORCHESTRATOR PIPELINE
# ════════════════════════════════════════════


class TestSupervisorFallback:
    """Test the heuristic-based supervisor (used when Gemini key is unavailable)."""

    def test_detects_jwt_decision(self):
        result = fallback_supervisor(
            chat_history=[
                {"sender": "alice", "message": "We should use JWT for auth.", "timestamp": datetime.now(UTC).isoformat()},
            ],
            existing_decisions=[],
            current_goal="No goal set yet",
        )
        assert any("jwt" in d["description"].lower() for d in result["new_decisions"])

    def test_detects_conflict_between_users(self):
        result = fallback_supervisor(
            chat_history=[
                {"sender": "alice", "message": "We should use JWT tokens.", "timestamp": datetime.now(UTC).isoformat()},
                {"sender": "bob", "message": "I'd rather use OAuth instead.", "timestamp": datetime.now(UTC).isoformat()},
            ],
            existing_decisions=[],
            current_goal="Auth system",
        )
        assert result["conflict_detected"] is True
        assert result["conflict"]["option_b"]  # bob's position
        assert "OAuth" in result["conflict"]["option_b"]

    def test_no_false_conflict_on_agreement(self):
        result = fallback_supervisor(
            chat_history=[
                {"sender": "alice", "message": "Let's use PostgreSQL.", "timestamp": datetime.now(UTC).isoformat()},
                {"sender": "bob", "message": "Sounds good, let's go with that.", "timestamp": datetime.now(UTC).isoformat()},
            ],
            existing_decisions=[],
            current_goal="Database setup",
        )
        assert result["conflict_detected"] is False

    def test_detects_goal_from_chat(self):
        result = fallback_supervisor(
            chat_history=[
                {"sender": "alice", "message": "Let's build the authentication system.", "timestamp": datetime.now(UTC).isoformat()},
            ],
            existing_decisions=[],
            current_goal="No goal set yet",
        )
        assert result["new_goal"] is not None
        assert "authentication" in result["new_goal"].lower()

    def test_does_not_duplicate_existing_decisions(self):
        result = fallback_supervisor(
            chat_history=[
                {"sender": "alice", "message": "Let's use JWT tokens.", "timestamp": datetime.now(UTC).isoformat()},
            ],
            existing_decisions=[{"description": "Use JWT tokens", "category": "auth"}],
            current_goal="Auth",
        )
        # Should not re-add "Use JWT tokens"
        for d in result["new_decisions"]:
            assert "jwt tokens" not in d["description"].lower()

    def test_extracts_tasks_from_todo(self):
        result = fallback_supervisor(
            chat_history=[
                {"sender": "alice", "message": "We need to add CSRF protection.", "timestamp": datetime.now(UTC).isoformat()},
            ],
            existing_decisions=[],
            current_goal="Security",
        )
        assert any("csrf" in t.lower() for t in result["new_tasks"])


class TestCategoryInference:
    def test_auth_category(self):
        assert infer_category("use jwt for login") == DecisionCategory.AUTH

    def test_database_category(self):
        assert infer_category("switch to postgres") == DecisionCategory.DATABASE

    def test_api_category(self):
        assert infer_category("add a rest endpoint") == DecisionCategory.API

    def test_general_fallback(self):
        assert infer_category("let's refactor the codebase") == DecisionCategory.GENERAL


# ════════════════════════════════════════════
# 2. FULL PIPELINE (GRAPH → DRIFT → BLAME)
# ════════════════════════════════════════════


class TestFullPipeline:
    """Test the ForgeRoomGraph orchestration from chat input to blame graph output."""

    def test_full_orchestration_with_demo_input(self, temp_db_and_repo):
        """Simulates the demo script: create room, add chat, run graph, verify output."""
        db, _repo_path = temp_db_and_repo
        room = repository.create_room(db, "No goal set yet", False)

        # Simulate user chat
        messages = [
            {"sender": "alice", "message": "Let's build the login system.", "timestamp": datetime.now(UTC).isoformat()},
            {"sender": "alice", "message": "We should use JWT tokens.", "timestamp": datetime.now(UTC).isoformat()},
            {"sender": "bob", "message": "I'd rather use OAuth for this.", "timestamp": datetime.now(UTC).isoformat()},
        ]
        repository.store_chat_messages(db, room.id, messages)

        # Run the full graph
        graph = ForgeRoomGraph()
        result = asyncio.run(graph.run(db, room.id))

        # Verify output structure
        assert "current_goal" in result
        assert "approved_decisions" in result
        assert "pending_conflicts" in result
        assert "blame_graph_nodes" in result
        assert "blame_graph_edges" in result
        assert "last_drift_alerts" in result

    def test_drift_detection_jwt_vs_session(self, temp_db_and_repo):
        """The demo repo has session-based auth; proposing JWT should flag drift."""
        db, _repo_path = temp_db_and_repo
        room = repository.create_room(db, "Auth", False)
        decision = repository.add_decision(db, room.id, "Use JWT for authentication", "auth", [])

        result = asyncio.run(
            run_drift_detection(
                db=db,
                room_id=room.id,
                proposed_decision="Use JWT for authentication",
                category="auth",
                decision_id=decision.id,
                provider=AIProvider(),
            )
        )

        assert result["drift_detected"] is True
        assert "middleware" in result["conflicting_file"].lower()
        assert result["severity"] == "high"

    def test_blame_graph_dependencies_and_contradictions(self, temp_db_and_repo):
        db, _repo_path = temp_db_and_repo
        room = repository.create_room(db, "Design", False)

        d1 = repository.add_decision(db, room.id, "Use REST API", "api", [])
        d2 = repository.add_decision(db, room.id, "Use JWT for auth", "auth", [d1.id])
        repository.add_contradiction(db, d2.id, d1.id)

        decisions = repository.list_decisions(db, room.id)
        nodes, edges = build_blame_graph(decisions, new_ids={d2.id})

        assert len(nodes) == 2
        assert len(edges) == 2  # 1 depends_on + 1 contradicts

        depends_edges = [e for e in edges if e.type == "depends_on"]
        contra_edges = [e for e in edges if e.type == "contradicts"]
        assert len(depends_edges) == 1
        assert len(contra_edges) == 1

        # d2 should be marked as new
        new_nodes = [n for n in nodes if n.is_new]
        assert len(new_nodes) == 1
        assert new_nodes[0].id == d2.id


# ════════════════════════════════════════════
# 3. EXECUTION BRIDGE (GEMINI CLI + GIT)
# ════════════════════════════════════════════


class TestExecutionBridge:
    """Test code generation fallback, diff validation, and git operations."""

    DECISIONS = [
        {
            "id": "d-1",
            "timestamp": "2026-04-24T00:00:00",
            "description": "Use JWT for authentication",
            "category": "auth",
            "depends_on": [],
            "contradicts": [],
            "risk_score": 3.0,
        },
        {
            "id": "d-2",
            "timestamp": "2026-04-24T00:01:00",
            "description": "Use PostgreSQL for persistence",
            "category": "database",
            "depends_on": ["d-1"],
            "contradicts": [],
            "risk_score": 2.0,
        },
    ]

    def test_fallback_diff_generates_valid_unified_diff(self):
        diff = build_fallback_diff("Implement auth flow", self.DECISIONS)
        print(f"\n[DEBUG] Core Fallback Diff:\n{diff}\n[DEBUG] End of Diff")
        assert diff.startswith("--- /dev/null")
        assert "+++ b/forgeroom_generated.md" in diff
        assert "@@ -0,0" in diff
        assert "JWT" in diff

    def test_gemini_cli_fallback_when_cli_missing(self, temp_db_and_repo):
        _db, repo_path = temp_db_and_repo
        with patch("forgeroom_backend.execution.gemini_cli.shutil.which", return_value=None):
            diff = asyncio.run(
                run_gemini_cli("Build auth.", self.DECISIONS, repo_path, enable_fallbacks=True)
            )
        print(f"\n[DEBUG] Core Gemini CLI Fallback Diff:\n{diff}\n[DEBUG] End of Diff")
        assert diff.startswith("--- ")
        assert "JWT" in diff

    def test_gemini_cli_raises_when_no_fallback(self, temp_db_and_repo):
        _db, repo_path = temp_db_and_repo
        with patch("forgeroom_backend.execution.gemini_cli.shutil.which", return_value=None):
            with pytest.raises(RuntimeError, match="not installed"):
                asyncio.run(
                    run_gemini_cli("Build auth.", self.DECISIONS, repo_path, enable_fallbacks=False)
                )

    def test_diff_validation_rejects_empty(self, temp_db_and_repo):
        _db, repo_path = temp_db_and_repo
        with pytest.raises(DiffValidationError, match="empty"):
            validate_diff("", repo_path)

    def test_diff_validation_rejects_outside_repo(self, temp_db_and_repo):
        _db, repo_path = temp_db_and_repo
        bad_diff = "--- a/etc/passwd\n+++ b/../../../etc/shadow\n@@ -0,0 +1 @@\n+hacked\n"
        with pytest.raises(DiffValidationError):
            validate_diff(bad_diff, repo_path)

    def test_apply_diff_and_commit(self, temp_db_and_repo):
        _db, repo_path = temp_db_and_repo
        with patch("forgeroom_backend.execution.gemini_cli.shutil.which", return_value=None):
            diff = asyncio.run(
                run_gemini_cli("Build auth.", self.DECISIONS, repo_path, enable_fallbacks=True)
            )
        print(f"\n[DEBUG] Core Apply Diff:\n{diff}\n[DEBUG] End of Diff")
        validate_diff(diff, repo_path)
        commit_hash, status = asyncio.run(
            apply_diff_and_commit(diff, "Test commit", repo_path, push=False)
        )
        assert status == "committed"
        assert len(commit_hash) == 8
        assert (repo_path / "forgeroom_generated.md").exists()


# ════════════════════════════════════════════
# 4. EXPORT PIPELINE
# ════════════════════════════════════════════


class TestExportPipeline:
    def test_export_with_decisions_and_conflicts(self, temp_db_and_repo):
        db, _repo_path = temp_db_and_repo
        room = repository.create_room(db, "Auth system", False)
        repository.add_decision(db, room.id, "Use JWT", "auth", [])
        repository.add_decision(db, room.id, "Use PostgreSQL", "database", [])
        conflict = repository.add_conflict(db, room.id, "Auth method", "JWT", "OAuth", "Discussion")
        repository.cast_vote(db, conflict.id, "alice", VoteChoice.A)
        repository.cast_vote(db, conflict.id, "bob", VoteChoice.A)

        report = asyncio.run(generate_risk_autopsy(db, room.id, AIProvider()))
        snapshot = repository.snapshot_room(db, room.id)
        markdown = generate_markdown_export(snapshot, report)

        assert "# ForgeRoom Session" in markdown
        assert "JWT" in markdown
        assert "PostgreSQL" in markdown
        assert "Approved Decisions" in markdown
        assert "Risk Autopsy" in markdown
        assert "Confidence Score" in markdown

    def test_export_saves_to_db(self, temp_db_and_repo):
        db, _repo_path = temp_db_and_repo
        room = repository.create_room(db, "Test", False)
        repository.save_export(db, room.id, "# Test Export", "## Test Autopsy")
        # No exception means success


# ════════════════════════════════════════════
# 5. CONFLICT RESOLUTION FLOW
# ════════════════════════════════════════════


class TestConflictResolution:
    def test_two_votes_resolve_conflict(self, temp_db_and_repo):
        db, _ = temp_db_and_repo
        room = repository.create_room(db, "Design", False)
        conflict = repository.add_conflict(db, room.id, "JWT vs OAuth", "JWT", "OAuth", "Auth discussion")

        repository.cast_vote(db, conflict.id, "alice", VoteChoice.A)
        result = repository.cast_vote(db, conflict.id, "bob", VoteChoice.A)

        assert result.resolved is True
        assert result.winner == VoteChoice.A

    def test_split_vote_stays_unresolved(self, temp_db_and_repo):
        db, _ = temp_db_and_repo
        room = repository.create_room(db, "Design", False)
        conflict = repository.add_conflict(db, room.id, "SQL vs NoSQL", "SQL", "NoSQL", "DB choice")

        repository.cast_vote(db, conflict.id, "alice", VoteChoice.A)
        result = repository.cast_vote(db, conflict.id, "bob", VoteChoice.B)

        # Tied 1-1 — stays unresolved, needs a tiebreaker vote
        assert result.resolved is False
        assert result.winner is None

        # Third vote breaks the tie
        final = repository.cast_vote(db, conflict.id, "charlie", VoteChoice.A)
        assert final.resolved is True
        assert final.winner == VoteChoice.A

    def test_user_cannot_double_vote_new_choice(self, temp_db_and_repo):
        db, _ = temp_db_and_repo
        room = repository.create_room(db, "Design", False)
        conflict = repository.add_conflict(db, room.id, "X vs Y", "X", "Y", "ctx")

        repository.cast_vote(db, conflict.id, "alice", VoteChoice.A)
        # Same user votes again — should update, not duplicate
        result = repository.cast_vote(db, conflict.id, "alice", VoteChoice.B)
        assert result.votes["alice"] == VoteChoice.B

    def test_snapshot_includes_resolved_conflict(self, temp_db_and_repo):
        db, _ = temp_db_and_repo
        room = repository.create_room(db, "Test", False)
        conflict = repository.add_conflict(db, room.id, "A vs B", "A", "B", "ctx")
        repository.cast_vote(db, conflict.id, "alice", VoteChoice.A)
        repository.cast_vote(db, conflict.id, "bob", VoteChoice.A)

        snapshot = repository.snapshot_room(db, room.id)
        assert snapshot.pending_conflicts[0].resolved is True


# ════════════════════════════════════════════
# 6. APPSEC AGENT
# ════════════════════════════════════════════


class TestAppSecAgent:
    def test_fallback_detects_session_usage(self):
        result = fallback_appsec_review(
            [],
            "### FILE: auth.py\nsession_id = request.cookies.get('sid')\n",
        )
        assert "session" in result.response.lower() or "cookie" in result.response.lower()
        assert result.agent_name == "AppSec"
        assert result.agent_emoji == "🛡"

    def test_fallback_detects_sqlite(self):
        result = fallback_appsec_review(
            [],
            "### FILE: db.py\nconn = sqlite3.connect('app.db')\n",
        )
        assert "sqlite" in result.response.lower()


# ════════════════════════════════════════════
# 7. DRIFT DETECTION FALLBACK
# ════════════════════════════════════════════


class TestDriftDetectionFallback:
    def test_jwt_vs_session_cookie(self):
        snapshot = "### FILE: src/auth/middleware.py\n1: import session\n2: session_id = request.cookies.get('session_id')\n"
        result = fallback_drift_detection("Use JWT for authentication", snapshot)
        assert result["drift_detected"] is True
        assert result["severity"] == "high"

    def test_postgres_vs_sqlite(self):
        snapshot = "### FILE: src/database/connection.py\n1: import sqlite3\n2: sqlite3.connect('app.db')\n"
        result = fallback_drift_detection("Use PostgreSQL for persistence", snapshot)
        assert result["drift_detected"] is True
        assert result["severity"] == "medium"

    def test_no_drift_for_unrelated(self):
        snapshot = "### FILE: src/main.py\n1: print('hello')\n"
        result = fallback_drift_detection("Add logging framework", snapshot)
        assert result["drift_detected"] is False


# ════════════════════════════════════════════
# 8. WEBSOCKET MESSAGE FORMATTING
# ════════════════════════════════════════════


class TestWSMessages:
    def test_make_message_structure(self):
        msg = make_message("chat", "room-1", "user:alice", {"message": "Hello"})
        assert msg["type"] == "chat"
        assert msg["room_id"] == "room-1"
        assert msg["sender_id"] == "user:alice"
        assert msg["payload"]["message"] == "Hello"
        assert "timestamp" in msg

    def test_make_message_with_enum(self):
        from forgeroom_backend.shared.contracts import MessageType
        msg = make_message(MessageType.CONFLICT, "r1", "sys", {"summary": "Test"})
        assert msg["type"] == "conflict"


# ════════════════════════════════════════════
# 9. ROOM LIFECYCLE
# ════════════════════════════════════════════


class TestRoomLifecycle:
    def test_create_and_find_room(self, temp_db_and_repo):
        db, _ = temp_db_and_repo
        room = repository.create_room(db, "Build login", False)
        assert room.id is not None
        assert room.current_goal == "Build login"

        found = repository.get_room(db, room.id)
        assert found is not None
        assert found.id == room.id

    def test_missing_room_returns_none(self, temp_db_and_repo):
        db, _ = temp_db_and_repo
        assert repository.get_room(db, "nonexistent") is None

    def test_update_goal(self, temp_db_and_repo):
        db, _ = temp_db_and_repo
        room = repository.create_room(db, "Original", False)
        repository.update_room_goal(db, room.id, "Updated goal")
        refreshed = repository.get_room(db, room.id)
        assert refreshed.current_goal == "Updated goal"

    def test_pending_tasks(self, temp_db_and_repo):
        db, _ = temp_db_and_repo
        room = repository.create_room(db, "Test", False)
        tasks = repository.add_pending_tasks(db, room.id, ["Task 1", "Task 2"])
        assert "Task 1" in tasks
        # No duplicates
        tasks2 = repository.add_pending_tasks(db, room.id, ["Task 1", "Task 3"])
        assert tasks2.count("Task 1") == 1
        assert "Task 3" in tasks2

    def test_chat_storage_and_retrieval(self, temp_db_and_repo):
        db, _ = temp_db_and_repo
        room = repository.create_room(db, "Test", False)
        repository.store_chat_messages(db, room.id, [
            {"sender": "alice", "message": "Hello", "timestamp": datetime.now(UTC).isoformat()},
            {"sender": "bob", "message": "World", "timestamp": datetime.now(UTC).isoformat()},
        ])
        messages = repository.recent_chat_messages(db, room.id)
        assert len(messages) == 2
        assert messages[0].message == "Hello"
        assert messages[1].message == "World"

    def test_full_snapshot(self, temp_db_and_repo):
        db, _ = temp_db_and_repo
        room = repository.create_room(db, "Full test", False)
        d1 = repository.add_decision(db, room.id, "Use React", "frontend", [])
        repository.add_pending_tasks(db, room.id, ["Add tests"])

        snapshot = repository.snapshot_room(db, room.id)
        assert snapshot.room_id == room.id
        assert snapshot.current_goal == "Full test"
        assert len(snapshot.approved_decisions) == 1
        assert snapshot.approved_decisions[0].description == "Use React"
        assert "Add tests" in snapshot.pending_tasks
        assert len(snapshot.blame_graph_nodes) == 1
