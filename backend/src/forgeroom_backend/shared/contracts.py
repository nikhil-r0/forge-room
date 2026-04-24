from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class MessageType(str, Enum):
    CHAT = "chat"
    CONFLICT = "conflict"
    SPEC_UPDATE = "spec_update"
    BLAME_GRAPH = "blame_graph"
    DRIFT_ALERT = "drift_alert"
    VOTE_CAST = "vote_cast"
    VOTE_RESULT = "vote_result"
    AGENT_RESPONSE = "agent_response"
    STATUS = "status"
    ERROR = "error"


class DecisionCategory(str, Enum):
    AUTH = "auth"
    DATABASE = "database"
    API = "api"
    FRONTEND = "frontend"
    INFRA = "infra"
    SECURITY = "security"
    GENERAL = "general"


class DriftSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class VoteChoice(str, Enum):
    A = "a"
    B = "b"


class DecisionPayload(BaseModel):
    id: str
    timestamp: datetime
    description: str
    category: DecisionCategory
    depends_on: list[str] = Field(default_factory=list)
    contradicts: list[str] = Field(default_factory=list)
    risk_score: float = 0.0


class ChatPayload(BaseModel):
    message: str
    display_name: str | None = None


class ConflictPayload(BaseModel):
    conflict_id: str
    summary: str
    option_a: str
    option_b: str
    context: str
    votes: dict[str, VoteChoice] = Field(default_factory=dict)
    resolved: bool = False
    winner: VoteChoice | None = None


class SpecPayload(BaseModel):
    current_goal: str
    approved_decisions: list[DecisionPayload]
    pending_tasks: list[str] = Field(default_factory=list)
    open_conflicts: int = 0


class BlameNode(BaseModel):
    id: str
    label: str
    category: str
    risk_score: float
    is_new: bool = False


class BlameEdge(BaseModel):
    id: str
    source: str
    target: str
    type: Literal["depends_on", "contradicts"]


class BlameGraphPayload(BaseModel):
    nodes: list[BlameNode] = Field(default_factory=list)
    edges: list[BlameEdge] = Field(default_factory=list)


class DriftAlertPayload(BaseModel):
    drift_id: str
    proposed_decision: str
    conflicting_file: str
    conflicting_line: int
    conflicting_code_snippet: str
    explanation: str
    severity: DriftSeverity
    decision_id: str | None = None


class AgentPayload(BaseModel):
    agent_name: str
    agent_emoji: str
    response: str
    referenced_files: list[str] = Field(default_factory=list)


class StatusPayload(BaseModel):
    code: str
    detail: str


class ErrorPayload(BaseModel):
    message: str


class WSMessage(BaseModel):
    type: MessageType
    room_id: str
    sender_id: str
    timestamp: datetime
    payload: dict[str, Any]


class RoomSnapshot(BaseModel):
    room_id: str
    current_goal: str
    focus_mode: bool
    pending_tasks: list[str]
    approved_decisions: list[DecisionPayload]
    pending_conflicts: list[ConflictPayload]
    blame_graph_nodes: list[BlameNode]
    blame_graph_edges: list[BlameEdge]
    last_drift_alerts: list[DriftAlertPayload]
    session_start: datetime


class ChatMessageIn(BaseModel):
    sender: str
    message: str
    timestamp: datetime


class ChatBatchRequest(BaseModel):
    room_id: str
    messages: list[ChatMessageIn]


class DriftCheckRequest(BaseModel):
    proposed_decision: str
    category: DecisionCategory


class CreateRoomRequest(BaseModel):
    current_goal: str = "No goal set yet"
    focus_mode: bool = False


class CreateRoomResponse(BaseModel):
    room_id: str


class VoteRequest(BaseModel):
    user_id: str
    conflict_id: str
    vote: VoteChoice


class ExecuteSpecRequest(BaseModel):
    spec_markdown: str
    approved_decisions: list[DecisionPayload]


class ExecuteSpecResponse(BaseModel):
    diff: str
    status: str


class ApplyDiffRequest(BaseModel):
    diff_text: str
    commit_message: str
    push: bool = False


class ApplyDiffResponse(BaseModel):
    status: str
    commit_hash: str | None = None
    detail: str | None = None


class AgentRequest(BaseModel):
    agent_name: str


class ExportResponse(BaseModel):
    room_id: str
    markdown: str
    risk_autopsy: str
