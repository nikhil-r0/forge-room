from __future__ import annotations

from typing import TypedDict


class ForgeRoomState(TypedDict, total=False):
    room_id: str
    chat_history: list[dict]
    approved_decisions: list[dict]
    pending_conflicts: list[dict]
    current_goal: str
    pending_tasks: list[str]
    blame_graph_nodes: list[dict]
    blame_graph_edges: list[dict]
    last_drift_alerts: list[dict]
    session_start: str
    focus_mode: bool
    _pending_drift_checks: list[dict]
    _new_decision_ids: list[str]
