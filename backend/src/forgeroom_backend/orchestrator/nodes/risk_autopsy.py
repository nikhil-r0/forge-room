from __future__ import annotations

from sqlalchemy.orm import Session

from ...shared import repository
from ..providers import AIProvider


async def generate_risk_autopsy(db: Session, room_id: str, provider: AIProvider) -> str:
    decisions = repository.list_decisions(db, room_id)
    conflicts = repository.list_conflicts(db, room_id)
    drifts = repository.list_drift_alerts(db, room_id)
    return await provider.risk_autopsy(
        decisions=decisions,
        conflicts_resolved=len([conflict for conflict in conflicts if conflict.resolved]),
        drift_alerts=len(drifts),
    )
