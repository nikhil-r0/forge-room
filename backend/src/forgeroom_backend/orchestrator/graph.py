from __future__ import annotations

from sqlalchemy.orm import Session

from .nodes.drift_detector import run_drift_detection
from .nodes.supervisor import supervisor_node
from .providers import AIProvider


class ForgeRoomGraph:
    def __init__(self, provider: AIProvider | None = None) -> None:
        self.provider = provider or AIProvider()

    async def run(self, db: Session, room_id: str) -> dict:
        state = await supervisor_node(db, room_id, self.provider)
        drift_alerts = []
        for check in state.get("_pending_drift_checks", []):
            drift = await run_drift_detection(
                db=db,
                room_id=room_id,
                proposed_decision=check["proposed_decision"],
                category=check["category"],
                decision_id=check["decision_id"],
                provider=self.provider,
            )
            if drift.get("drift_detected"):
                drift_alerts.append(drift)
        if drift_alerts:
            state = state | repository_snapshot(db, room_id)
            state["last_drift_alerts"] = repository_snapshot(db, room_id)["last_drift_alerts"]
        return state


def repository_snapshot(db: Session, room_id: str) -> dict:
    from ..shared.repository import snapshot_room

    return snapshot_room(db, room_id).model_dump(mode="json")
