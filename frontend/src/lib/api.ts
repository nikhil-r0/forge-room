// ─── ForgeRoom REST API Client ───

import type {
  ConflictPayload,
  DecisionPayload,
  ExportResponse,
  RoomSnapshot,
  VoteChoice,
} from "./types";

const getBaseUrl = (port: number, protocol = "http") => {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    return `${protocol}://${host}:${port}`;
  }
  return `${protocol}://localhost:${port}`;
};

const ORCHESTRATOR = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? getBaseUrl(8000);
const EXECUTION = process.env.NEXT_PUBLIC_EXECUTION_URL ?? getBaseUrl(8001);
const WS_GATEWAY = process.env.NEXT_PUBLIC_WS_GATEWAY_URL ?? getBaseUrl(8002);

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${detail}`);
  }
  return res.json();
}

// ─── Room Management (Orchestrator :8000) ───

export async function createRoom(
  currentGoal = "No goal set yet"
): Promise<{ room_id: string }> {
  return json(`${ORCHESTRATOR}/api/rooms`, {
    method: "POST",
    body: JSON.stringify({ current_goal: currentGoal, focus_mode: false }),
  });
}

export async function getRoom(roomId: string): Promise<RoomSnapshot> {
  return json(`${ORCHESTRATOR}/api/rooms/${roomId}`);
}

// ─── Voting (WS Gateway :8002) ───

export async function castVote(
  roomId: string,
  conflictId: string,
  userId: string,
  vote: VoteChoice
): Promise<ConflictPayload> {
  return json(`${WS_GATEWAY}/api/rooms/${roomId}/vote`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, conflict_id: conflictId, vote }),
  });
}

// ─── Code Execution (Execution Bridge :8001) ───

export async function executeSpec(
  roomId: string,
  specMarkdown: string,
  approvedDecisions: DecisionPayload[],
  commitMessage?: string,
  push = false
): Promise<{ summary: string; status: string }> {
  return json(`${EXECUTION}/api/execute-spec`, {
    method: "POST",
    body: JSON.stringify({
      room_id: roomId,
      spec_markdown: specMarkdown,
      approved_decisions: approvedDecisions,
      commit_message: commitMessage,
      push,
    }),
  });
}


// ─── Agent Invocation (Orchestrator :8000) ───

export async function invokeAgent(
  roomId: string,
  agentName: string
): Promise<{
  agent_name: string;
  agent_emoji: string;
  response: string;
  referenced_files: string[];
}> {
  return json(`${ORCHESTRATOR}/api/rooms/${roomId}/agent`, {
    method: "POST",
    body: JSON.stringify({ agent_name: agentName }),
  });
}

// ─── Session Export (Orchestrator :8000) ───

export async function exportSession(
  roomId: string
): Promise<ExportResponse> {
  return json(`${ORCHESTRATOR}/api/rooms/${roomId}/export`);
}
