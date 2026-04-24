from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session

from ...shared import repository
from ...shared.settings import get_settings
from ..providers import AIProvider
from ..utils import build_targeted_snapshot


async def run_drift_detection(
    db: Session,
    room_id: str,
    proposed_decision: str,
    category: str,
    decision_id: str | None,
    provider: AIProvider,
) -> dict:
    repo_path = get_settings().target_repo
    snapshot = build_targeted_snapshot(repo_path, category)
    result = await provider.detect_drift(proposed_decision, snapshot)
    if not result.get("drift_detected"):
        return result

    alert = repository.add_drift_alert(
        db=db,
        room_id=room_id,
        decision_id=decision_id,
        proposed_decision=proposed_decision,
        conflicting_file=result["conflicting_file"],
        conflicting_line=result["conflicting_line"],
        snippet=result["conflicting_code_snippet"],
        explanation=result["explanation"],
        severity=result["severity"],
    )

    if decision_id:
        conflicting_decision = find_related_decision(db, room_id, result["conflicting_file"], result["conflicting_code_snippet"])
        if conflicting_decision:
            repository.add_contradiction(db, decision_id, conflicting_decision["id"])

    return {
        **result,
        "drift_id": alert.id,
        "decision_id": decision_id,
    }


def find_related_decision(db: Session, room_id: str, conflicting_file: str, snippet: str) -> dict | None:
    snippet_lower = f"{conflicting_file} {snippet}".lower()
    for decision in repository.list_decisions(db, room_id):
        if any(token in snippet_lower for token in decision["description"].lower().split()):
            return decision
    return None
