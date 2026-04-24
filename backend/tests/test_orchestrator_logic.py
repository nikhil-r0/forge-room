from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from forgeroom_backend.orchestrator.nodes.drift_detector import run_drift_detection
from forgeroom_backend.orchestrator.nodes.risk_autopsy import generate_risk_autopsy
from forgeroom_backend.orchestrator.providers import AIProvider, fallback_supervisor
from forgeroom_backend.shared import repository


def test_fallback_supervisor_detects_conflict_and_decision():
    result = fallback_supervisor(
        chat_history=[
            {"sender": "alice", "message": "Let's build the login system.", "timestamp": datetime.now(UTC).isoformat()},
            {"sender": "alice", "message": "We should use JWT tokens.", "timestamp": datetime.now(UTC).isoformat()},
            {"sender": "bob", "message": "I'd rather use OAuth for this flow.", "timestamp": datetime.now(UTC).isoformat()},
        ],
        existing_decisions=[],
        current_goal="No goal set yet",
    )

    assert result["new_goal"] == "the login system"
    assert result["new_decisions"][0]["description"].lower().startswith("use jwt")
    assert result["conflict_detected"] is True
    assert "OAuth" in result["conflict"]["option_b"]


async def _drift_detection_case(temp_db_and_repo):
    db, _repo_path = temp_db_and_repo
    room = repository.create_room(db, "Auth system", False)
    decision = repository.add_decision(db, room.id, "Use JWT for authentication", "auth", [])

    result = await run_drift_detection(
        db=db,
        room_id=room.id,
        proposed_decision=decision.description,
        category="auth",
        decision_id=decision.id,
        provider=AIProvider(),
    )

    assert result["drift_detected"] is True
    assert result["conflicting_file"].endswith("src/auth/middleware.py")
    assert result["severity"] == "high"


async def _risk_autopsy_case(temp_db_and_repo):
    db, _repo_path = temp_db_and_repo
    room = repository.create_room(db, "Auth system", False)
    repository.add_decision(db, room.id, "Use JWT for authentication", "auth", [])
    repository.add_decision(db, room.id, "Use PostgreSQL for persistence", "database", [])

    report = await generate_risk_autopsy(db, room.id, AIProvider())

    assert "## High-Risk Decisions" in report
    assert "## Confidence Score:" in report


def test_drift_detection_finds_session_conflict_sync(temp_db_and_repo):
    asyncio.run(_drift_detection_case(temp_db_and_repo))


def test_risk_autopsy_includes_confidence_sync(temp_db_and_repo):
    asyncio.run(_risk_autopsy_case(temp_db_and_repo))
