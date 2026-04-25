from __future__ import annotations

from sqlalchemy.orm import Session

from .nodes.drift_detector import run_drift_detection
from .nodes.supervisor import supervisor_node
from .providers import AIProvider


class ForgeRoomGraph:
    def __init__(self, provider: AIProvider | None = None) -> None:
        self.provider = provider or AIProvider()

    async def run(self, db: Session, room_id: str, execution_summary: str | None = None) -> dict:
        import logging
        logger = logging.getLogger("orchestrator.graph")
        
        logger.info(f"  [NODE] -> Entering Supervisor Node")
        state = await supervisor_node(db, room_id, self.provider, execution_summary=execution_summary)
        
        drift_alerts = []
        pending_checks = state.get("_pending_drift_checks", [])
        if pending_checks:
            logger.info(f"  [NODE] -> supervisor found {len(pending_checks)} decisions requiring drift check")
            
        for check in pending_checks:
            logger.info(f"  [NODE] -> Entering Drift Detection for: {check['proposed_decision'][:50]}...")
            drift = await run_drift_detection(
                db=db,
                room_id=room_id,
                proposed_decision=check["proposed_decision"],
                category=check["category"],
                decision_id=check["decision_id"],
                provider=self.provider,
            )
            if drift.get("drift_detected"):
                logger.warning(f"  ⚠️ DRIFT DETECTED in {drift.get('conflicting_file')}")
                drift_alerts.append(drift)

        if drift_alerts:
            # Refresh snapshot to get updated state including new drift alerts
            snapshot = repository_snapshot(db, room_id)
            # Merge: keep the supervisor's state but update blame graph and drift alerts
            state["blame_graph_nodes"] = snapshot["blame_graph_nodes"]
            state["blame_graph_edges"] = snapshot["blame_graph_edges"]
            state["last_drift_alerts"] = snapshot["last_drift_alerts"]

        return state


def repository_snapshot(db: Session, room_id: str) -> dict:
    from ..shared.repository import snapshot_room

    return snapshot_room(db, room_id).model_dump(mode="json")
