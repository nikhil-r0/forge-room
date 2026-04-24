from __future__ import annotations

from .contracts import RoomSnapshot


def generate_markdown_export(snapshot: RoomSnapshot, risk_autopsy: str) -> str:
    decisions = "\n".join(
        f"- [{decision.category}] {decision.description} (risk {decision.risk_score:.1f})"
        for decision in snapshot.approved_decisions
    ) or "- None"
    conflicts = "\n".join(
        f"- {conflict.summary} | resolved={conflict.resolved} | winner={conflict.winner or 'pending'}"
        for conflict in snapshot.pending_conflicts
    ) or "- None"
    drifts = "\n".join(
        f"- {alert.proposed_decision} -> {alert.conflicting_file}:{alert.conflicting_line} ({alert.severity})"
        for alert in snapshot.last_drift_alerts
    ) or "- None"
    tasks = "\n".join(f"- {task}" for task in snapshot.pending_tasks) or "- None"

    return "\n".join(
        [
            f"# ForgeRoom Session {snapshot.room_id}",
            "",
            f"Current goal: {snapshot.current_goal}",
            f"Focus mode: {'on' if snapshot.focus_mode else 'off'}",
            "",
            "## Approved Decisions",
            decisions,
            "",
            "## Pending Tasks",
            tasks,
            "",
            "## Conflicts",
            conflicts,
            "",
            "## Drift Alerts",
            drifts,
            "",
            "## Risk Autopsy",
            risk_autopsy.strip(),
            "",
        ]
    )
