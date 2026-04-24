from __future__ import annotations

from sqlalchemy.orm import Session

from ...shared import repository
from ..providers import AIProvider


async def supervisor_node(db: Session, room_id: str, provider: AIProvider) -> dict:
    import logging
    logger = logging.getLogger("orchestrator.node.supervisor")
    
    room = repository.get_room(db, room_id)
    chat_history = repository.serialize_recent_chat(db, room_id)
    existing_decisions = repository.list_decisions(db, room_id)
    active_skills = repository.list_skills(db, room_id)
    
    logger.debug(f"Analyzing room {room_id}. Goal: {room.current_goal}. Msg count: {len(chat_history)}. Skills: {len(active_skills)}")
    
    result = await provider.analyze_supervisor(
        chat_history, 
        existing_decisions, 
        room.current_goal,
        active_skills=[s.model_dump(mode="json") for s in active_skills]
    )
    
    logger.debug(f"Supervisor Reasoning Result: {result}")

    if result.get("new_goal"):
        repository.update_room_goal(db, room_id, result["new_goal"])

    new_decision_ids: list[str] = []
    pending_drift_checks: list[dict] = []
    for item in result.get("new_decisions", []):
        duplicate = repository.find_duplicate_decision(db, room_id, item["description"])
        if duplicate:
            continue
        decision = repository.add_decision(
            db=db,
            room_id=room_id,
            description=item["description"],
            category=item.get("category", "general"),
            depends_on=item.get("depends_on", []),
        )
        new_decision_ids.append(decision.id)
        pending_drift_checks.append(
            {
                "decision_id": decision.id,
                "proposed_decision": decision.description,
                "category": decision.category,
            }
        )

    tasks = repository.add_pending_tasks(db, room_id, result.get("new_tasks", []))
    if result.get("completed_tasks"):
        tasks = repository.remove_pending_tasks(db, room_id, result["completed_tasks"])

    conflict_payload = None
    if result.get("conflict_detected") and result.get("conflict"):
        conflict = result["conflict"]
        conflict_payload = repository.add_conflict(
            db,
            room_id,
            summary=conflict["summary"],
            option_a=conflict["option_a"],
            option_b=conflict["option_b"],
            context=conflict["context"],
        )

    snapshot = repository.snapshot_room(db, room_id, new_decision_ids=set(new_decision_ids))
    state = snapshot.model_dump(mode="json")
    state["pending_tasks"] = tasks
    state["_pending_drift_checks"] = pending_drift_checks
    state["_new_decision_ids"] = new_decision_ids
    if conflict_payload:
        state["pending_conflicts"] = repository.snapshot_room(db, room_id).pending_conflicts
    return state
