from __future__ import annotations

from sqlalchemy.orm import Session

from ....shared import repository
from ....shared.settings import get_settings
from ...providers import AIProvider
from ...utils import build_targeted_snapshot


async def run_appsec_review(db: Session, room_id: str, provider: AIProvider):
    decisions = repository.list_decisions(db, room_id)
    snapshot = build_targeted_snapshot(get_settings().target_repo, "security")
    payload = await provider.appsec_review(decisions, snapshot)
    repository.add_agent_run(db, room_id, payload)
    return payload
