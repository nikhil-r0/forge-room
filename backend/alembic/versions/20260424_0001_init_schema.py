"""initial schema

Revision ID: 20260424_0001
Revises:
Create Date: 2026-04-24 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260424_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rooms",
        sa.Column("id", sa.String(length=16), primary_key=True),
        sa.Column("current_goal", sa.Text(), nullable=False),
        sa.Column("focus_mode", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("pending_tasks", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("session_start", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("room_id", sa.String(length=16), sa.ForeignKey("rooms.id"), nullable=False),
        sa.Column("sender_id", sa.String(length=128), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_chat_messages_room_id", "chat_messages", ["room_id"])
    op.create_index("ix_chat_messages_created_at", "chat_messages", ["created_at"])

    op.create_table(
        "decisions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("room_id", sa.String(length=16), sa.ForeignKey("rooms.id"), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("risk_score", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_decisions_room_id", "decisions", ["room_id"])

    op.create_table(
        "decision_relations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("decision_id", sa.String(length=64), sa.ForeignKey("decisions.id"), nullable=False),
        sa.Column("related_decision_id", sa.String(length=64), sa.ForeignKey("decisions.id"), nullable=False),
        sa.Column("relation_type", sa.String(length=32), nullable=False),
        sa.UniqueConstraint("decision_id", "related_decision_id", "relation_type", name="uq_decision_relation"),
    )

    op.create_table(
        "conflicts",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("room_id", sa.String(length=16), sa.ForeignKey("rooms.id"), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("option_a", sa.Text(), nullable=False),
        sa.Column("option_b", sa.Text(), nullable=False),
        sa.Column("context", sa.Text(), nullable=False),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("winner", sa.String(length=8), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_conflicts_room_id", "conflicts", ["room_id"])

    op.create_table(
        "votes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("conflict_id", sa.String(length=64), sa.ForeignKey("conflicts.id"), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("choice", sa.String(length=8), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("conflict_id", "user_id", name="uq_vote_conflict_user"),
    )

    op.create_table(
        "drift_alerts",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("room_id", sa.String(length=16), sa.ForeignKey("rooms.id"), nullable=False),
        sa.Column("decision_id", sa.String(length=64), sa.ForeignKey("decisions.id"), nullable=True),
        sa.Column("proposed_decision", sa.Text(), nullable=False),
        sa.Column("conflicting_file", sa.Text(), nullable=False),
        sa.Column("conflicting_line", sa.Integer(), nullable=False),
        sa.Column("snippet", sa.Text(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_drift_alerts_room_id", "drift_alerts", ["room_id"])

    op.create_table(
        "agent_runs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("room_id", sa.String(length=16), sa.ForeignKey("rooms.id"), nullable=False),
        sa.Column("agent_name", sa.String(length=64), nullable=False),
        sa.Column("response", sa.Text(), nullable=False),
        sa.Column("referenced_files", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_agent_runs_room_id", "agent_runs", ["room_id"])

    op.create_table(
        "exports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("room_id", sa.String(length=16), sa.ForeignKey("rooms.id"), nullable=False),
        sa.Column("markdown", sa.Text(), nullable=False),
        sa.Column("risk_autopsy", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_exports_room_id", "exports", ["room_id"])


def downgrade() -> None:
    op.drop_index("ix_exports_room_id", table_name="exports")
    op.drop_table("exports")
    op.drop_index("ix_agent_runs_room_id", table_name="agent_runs")
    op.drop_table("agent_runs")
    op.drop_index("ix_drift_alerts_room_id", table_name="drift_alerts")
    op.drop_table("drift_alerts")
    op.drop_table("votes")
    op.drop_index("ix_conflicts_room_id", table_name="conflicts")
    op.drop_table("conflicts")
    op.drop_table("decision_relations")
    op.drop_index("ix_decisions_room_id", table_name="decisions")
    op.drop_table("decisions")
    op.drop_index("ix_chat_messages_created_at", table_name="chat_messages")
    op.drop_index("ix_chat_messages_room_id", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_table("rooms")
