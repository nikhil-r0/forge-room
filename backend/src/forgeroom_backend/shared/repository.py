from __future__ import annotations

import uuid
from collections import Counter
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from .blame import build_blame_graph
from .contracts import (
    AgentPayload,
    ChatMessageIn,
    ConflictPayload,
    DecisionCategory,
    DecisionPayload,
    DriftAlertPayload,
    RoomSnapshot,
    SkillPayload,
    VoteChoice,
)
from .models import AgentRun, ChatMessage, Conflict, Decision, DecisionRelation, DriftAlert, ExportRecord, Room, Skill, Vote


def create_room(db: Session, current_goal: str, focus_mode: bool) -> Room:
    room = Room(id=str(uuid.uuid4())[:8], current_goal=current_goal, focus_mode=focus_mode)
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def get_room(db: Session, room_id: str) -> Room | None:
    return db.get(Room, room_id)


def store_chat_messages(db: Session, room_id: str, messages: list[dict]) -> None:
    for message in messages:
        created_at = message["timestamp"]
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        db.add(
            ChatMessage(
                room_id=room_id,
                sender_id=message["sender"],
                message=message["message"],
                created_at=created_at,
            )
        )
    db.commit()


def recent_chat_messages(db: Session, room_id: str, limit: int = 20) -> list[ChatMessage]:
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.room_id == room_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )
    return list(reversed(db.scalars(stmt).all()))


def list_decisions(db: Session, room_id: str) -> list[dict]:
    decisions = db.scalars(select(Decision).where(Decision.room_id == room_id).order_by(Decision.created_at.asc())).all()
    relations = db.scalars(
        select(DecisionRelation).where(DecisionRelation.decision_id.in_([decision.id for decision in decisions]))
    ).all()

    depends_by_id: dict[str, list[str]] = {}
    contradicts_by_id: dict[str, list[str]] = {}
    for relation in relations:
        bucket = depends_by_id if relation.relation_type == "depends_on" else contradicts_by_id
        bucket.setdefault(relation.decision_id, []).append(relation.related_decision_id)

    return [
        {
            "id": decision.id,
            "timestamp": decision.created_at.isoformat() if decision.created_at else None,
            "description": decision.description,
            "category": decision.category,
            "depends_on": depends_by_id.get(decision.id, []),
            "contradicts": contradicts_by_id.get(decision.id, []),
            "risk_score": decision.risk_score,
        }
        for decision in decisions
    ]


def find_duplicate_decision(db: Session, room_id: str, description: str) -> Decision | None:
    normalized = description.strip().lower()
    decisions = db.scalars(select(Decision).where(Decision.room_id == room_id)).all()
    for decision in decisions:
        if decision.description.strip().lower() == normalized:
            return decision
    return None


def add_decision(
    db: Session,
    room_id: str,
    description: str,
    category: str,
    depends_on: list[str],
    risk_score: float = 0.0,
) -> Decision:
    decision = Decision(
        id=str(uuid.uuid4()),
        room_id=room_id,
        description=description,
        category=category,
        risk_score=risk_score,
    )
    db.add(decision)
    db.flush()

    for related_id in depends_on:
        db.add(DecisionRelation(decision_id=decision.id, related_decision_id=related_id, relation_type="depends_on"))

    db.commit()
    db.refresh(decision)
    return decision


def add_contradiction(db: Session, decision_id: str, related_decision_id: str) -> None:
    exists = db.scalar(
        select(DecisionRelation).where(
            DecisionRelation.decision_id == decision_id,
            DecisionRelation.related_decision_id == related_decision_id,
            DecisionRelation.relation_type == "contradicts",
        )
    )
    if exists:
        return
    db.add(DecisionRelation(decision_id=decision_id, related_decision_id=related_decision_id, relation_type="contradicts"))
    db.commit()


def add_pending_tasks(db: Session, room_id: str, tasks: list[str]) -> list[str]:
    room = get_room(db, room_id)
    existing = set(room.pending_tasks or [])
    combined = list(room.pending_tasks or [])
    for task in tasks:
        if task not in existing:
            combined.append(task)
            existing.add(task)
    room.pending_tasks = combined
    db.commit()
    return combined


def current_pending_tasks(db: Session, room_id: str) -> list[str]:
    room = get_room(db, room_id)
    return list(room.pending_tasks or [])


def remove_pending_tasks(db: Session, room_id: str, tasks: list[str]) -> list[str]:
    room = get_room(db, room_id)
    existing = list(room.pending_tasks or [])
    
    # Fuzzy removal (case-insensitive and trimmed)
    to_remove = {t.strip().lower() for t in tasks}
    updated = [t for t in existing if t.strip().lower() not in to_remove]
    
    room.pending_tasks = updated
    db.commit()
    return updated


def update_room_goal(db: Session, room_id: str, current_goal: str) -> None:
    room = get_room(db, room_id)
    room.current_goal = current_goal
    db.commit()


def add_conflict(db: Session, room_id: str, summary: str, option_a: str, option_b: str, context: str) -> Conflict:
    conflict = Conflict(
        id=str(uuid.uuid4()),
        room_id=room_id,
        summary=summary,
        option_a=option_a,
        option_b=option_b,
        context=context,
    )
    db.add(conflict)
    db.commit()
    db.refresh(conflict)
    return conflict


def list_conflicts(db: Session, room_id: str) -> list[ConflictPayload]:
    conflicts = db.scalars(select(Conflict).where(Conflict.room_id == room_id).order_by(Conflict.created_at.asc())).all()
    votes = db.scalars(select(Vote).where(Vote.conflict_id.in_([conflict.id for conflict in conflicts]))).all() if conflicts else []
    votes_by_conflict: dict[str, dict[str, VoteChoice]] = {}
    for vote in votes:
        votes_by_conflict.setdefault(vote.conflict_id, {})[vote.user_id] = VoteChoice(vote.choice)

    return [
        ConflictPayload(
            conflict_id=conflict.id,
            summary=conflict.summary,
            option_a=conflict.option_a,
            option_b=conflict.option_b,
            context=conflict.context,
            votes=votes_by_conflict.get(conflict.id, {}),
            votes_tally={
                "a": sum(1 for v in votes_by_conflict.get(conflict.id, {}).values() if v == VoteChoice.A),
                "b": sum(1 for v in votes_by_conflict.get(conflict.id, {}).values() if v == VoteChoice.B),
            },
            resolved=conflict.resolved,
            winner=VoteChoice(conflict.winner) if conflict.winner else None,
        )
        for conflict in conflicts
    ]


def cast_vote(db: Session, conflict_id: str, user_id: str, choice: VoteChoice) -> ConflictPayload:
    vote = db.scalar(select(Vote).where(Vote.conflict_id == conflict_id, Vote.user_id == user_id))
    if vote is None:
        vote = Vote(conflict_id=conflict_id, user_id=user_id, choice=choice.value)
        db.add(vote)
    else:
        vote.choice = choice.value

    conflict = db.get(Conflict, conflict_id)
    db.flush()

    votes = db.scalars(select(Vote).where(Vote.conflict_id == conflict_id)).all()
    tally = Counter(v.choice for v in votes)
    if tally["a"] >= 2 or tally["b"] >= 2 or (len(votes) >= 2 and tally["a"] != tally["b"]):
        conflict.resolved = True
        conflict.winner = "a" if tally["a"] >= tally["b"] else "b"

    db.commit()
    return list_conflicts(db, conflict.room_id)[-1]


def add_drift_alert(
    db: Session,
    room_id: str,
    decision_id: str | None,
    proposed_decision: str,
    conflicting_file: str,
    conflicting_line: int,
    snippet: str,
    explanation: str,
    severity: str,
) -> DriftAlert:
    alert = DriftAlert(
        id=str(uuid.uuid4()),
        room_id=room_id,
        decision_id=decision_id,
        proposed_decision=proposed_decision,
        conflicting_file=conflicting_file,
        conflicting_line=conflicting_line,
        snippet=snippet,
        explanation=explanation,
        severity=severity,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def list_drift_alerts(db: Session, room_id: str) -> list[DriftAlertPayload]:
    alerts = db.scalars(select(DriftAlert).where(DriftAlert.room_id == room_id).order_by(DriftAlert.created_at.asc())).all()
    return [
        DriftAlertPayload(
            drift_id=alert.id,
            proposed_decision=alert.proposed_decision,
            conflicting_file=alert.conflicting_file,
            conflicting_line=alert.conflicting_line,
            conflicting_code_snippet=alert.snippet,
            explanation=alert.explanation,
            severity=alert.severity,
            decision_id=alert.decision_id,
        )
        for alert in alerts
    ]


def add_skill(db: Session, room_id: str, name: str, content: str, source_url: str | None = None) -> Skill:
    skill = Skill(room_id=room_id, name=name, content=content, source_url=source_url)
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


def list_skills(db: Session, room_id: str) -> list[SkillPayload]:
    skills = db.scalars(select(Skill).where(Skill.room_id == room_id).order_by(Skill.created_at.asc())).all()
    return [
        SkillPayload(
            id=skill.id,
            name=skill.name,
            content=skill.content,
            source_url=skill.source_url,
            created_at=skill.created_at,
        )
        for skill in skills
    ]


def add_agent_run(db: Session, room_id: str, payload: AgentPayload) -> None:
    db.add(
        AgentRun(
            room_id=room_id,
            agent_name=payload.agent_name,
            response=payload.response,
            referenced_files=payload.referenced_files,
        )
    )
    db.commit()


def save_export(db: Session, room_id: str, markdown: str, risk_autopsy: str) -> None:
    db.add(ExportRecord(room_id=room_id, markdown=markdown, risk_autopsy=risk_autopsy))
    db.commit()


def snapshot_room(db: Session, room_id: str, new_decision_ids: set[str] | None = None) -> RoomSnapshot:
    room = get_room(db, room_id)
    decisions = list_decisions(db, room_id)
    nodes, edges = build_blame_graph(decisions, new_ids=new_decision_ids)
    decision_models = [
        DecisionPayload(
            id=decision["id"],
            timestamp=decision["timestamp"],
            description=decision["description"],
            category=DecisionCategory(decision["category"]),
            depends_on=decision["depends_on"],
            contradicts=decision["contradicts"],
            risk_score=decision["risk_score"],
        )
        for decision in decisions
    ]
    return RoomSnapshot(
        room_id=room.id,
        current_goal=room.current_goal,
        focus_mode=room.focus_mode,
        pending_tasks=current_pending_tasks(db, room_id),
        approved_decisions=decision_models,
        pending_conflicts=list_conflicts(db, room_id),
        blame_graph_nodes=nodes,
        blame_graph_edges=edges,
        last_drift_alerts=list_drift_alerts(db, room_id),
        active_skills=list_skills(db, room_id),
        messages=[
            ChatMessageIn(sender=msg["sender"], message=msg["message"], timestamp=datetime.fromisoformat(msg["timestamp"]))
            for msg in serialize_recent_chat(db, room_id)
        ],
        session_start=room.session_start,
    )


def serialize_recent_chat(db: Session, room_id: str, limit: int = 40) -> list[dict]:
    # Fetch human messages
    chats = db.scalars(
        select(ChatMessage)
        .where(ChatMessage.room_id == room_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    ).all()
    
    # Fetch agent responses
    agents = db.scalars(
        select(AgentRun)
        .where(AgentRun.room_id == room_id)
        .order_by(AgentRun.created_at.desc())
        .limit(limit)
    ).all()
    
    combined = []
    for c in chats:
        combined.append({
            "sender": c.sender_id, 
            "message": c.message, 
            "timestamp": c.created_at.isoformat()
        })
    
    for a in agents:
        # Prefix with @ for frontend hydration, except for specialized agents like Supervisor
        # Supervisor messages might be in ChatMessage or AgentRun depending on implementation
        # Here we follow the convention used in useRoomStore.ts
        sender = a.agent_name
        if sender != "Supervisor" and not sender.startswith("@"):
            sender = f"@{sender}"
            
        combined.append({
            "sender": sender, 
            "message": a.response, 
            "timestamp": a.created_at.isoformat()
        })
    
    combined.sort(key=lambda x: x["timestamp"])
    return combined[-limit:]
