// ─── ForgeRoom Shared Types (mirrors backend Pydantic contracts) ───

export enum MessageType {
  CHAT = "chat",
  CONFLICT = "conflict",
  SPEC_UPDATE = "spec_update",
  BLAME_GRAPH = "blame_graph",
  DRIFT_ALERT = "drift_alert",
  VOTE_CAST = "vote_cast",
  VOTE_RESULT = "vote_result",
  AGENT_RESPONSE = "agent_response",
  STATUS = "status",
  ERROR = "error",
}

export type VoteChoice = "a" | "b";

export interface DecisionPayload {
  id: string;
  timestamp: string;
  description: string;
  category: string;
  depends_on: string[];
  contradicts: string[];
  risk_score: number;
}

export interface ConflictPayload {
  conflict_id: string;
  summary: string;
  option_a: string;
  option_b: string;
  context: string;
  votes: Record<string, VoteChoice>;
  votes_tally: Record<string, number>;
  resolved: boolean;
  winner: VoteChoice | null;
}

export interface User {
  user_id: string;
  username: string;
}

export interface BlameNode {
  id: string;
  label: string;
  category: string;
  risk_score: number;
  is_new: boolean;
}

export interface BlameEdge {
  id: string;
  source: string;
  target: string;
  type: "depends_on" | "contradicts";
}

export interface DriftAlertPayload {
  drift_id: string;
  proposed_decision: string;
  conflicting_file: string;
  conflicting_line: number;
  conflicting_code_snippet: string;
  explanation: string;
  severity: "low" | "medium" | "high";
  decision_id: string | null;
}

export interface WSMessage {
  type: MessageType;
  room_id: string;
  sender_id: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface ChatPayload {
  message: string;
  display_name?: string;
}

export interface SpecPayload {
  current_goal: string;
  approved_decisions: DecisionPayload[];
  pending_tasks: string[];
  open_conflicts: number;
}

export interface SkillPayload {
  id: number;
  name: string;
  content: string;
  source_url?: string;
  created_at: string;
}

export interface RoomSnapshot {
  room_id: string;
  current_goal: string;
  focus_mode: boolean;
  pending_tasks: string[];
  approved_decisions: DecisionPayload[];
  pending_conflicts: ConflictPayload[];
  blame_graph_nodes: BlameNode[];
  blame_graph_edges: BlameEdge[];
  last_drift_alerts: DriftAlertPayload[];
  active_skills: SkillPayload[];
  messages: { sender: string; message: string; timestamp: string }[];
  session_start: string;
}

export interface ExportResponse {
  room_id: string;
  markdown: string;
  risk_autopsy: string;
}

// ─── UI-level message type (for chat rendering) ───

export type UIMessageType =
  | "human"
  | "supervisor"
  | "agent_skill"
  | "conflict"
  | "drift_alert";

export interface UIMessage {
  id: string;
  type: UIMessageType;
  sender: string;
  display_name?: string;
  content: string;
  timestamp: Date;
  payload?: Record<string, unknown>;
}
