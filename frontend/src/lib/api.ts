// ─── ForgeRoom REST API Client ───

import type {
  ConflictPayload,
  DecisionPayload,
  ExportResponse,
  RoomSnapshot,
  SkillPayload,
  VoteChoice,
  User,
  SignupRequest,
  LoginRequest,
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
    credentials: "include",
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

// ─── Skills (Orchestrator :8000) ───

export async function addSkill(
  roomId: string,
  name: string,
  content?: string,
  sourceUrl?: string
): Promise<SkillPayload> {
  const body: Record<string, any> = { name };
  if (content) body.content = content;
  if (sourceUrl) body.source_url = sourceUrl;

  return json(`${ORCHESTRATOR}/api/rooms/${roomId}/skills`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateRoomSettings(
  roomId: string,
  targetRepo?: string,
  focusMode?: boolean
): Promise<{ status: string }> {
  return json(`${ORCHESTRATOR}/api/rooms/${roomId}/settings`, {
    method: "POST",
    body: JSON.stringify({ 
      target_repo: targetRepo,
      focus_mode: focusMode 
    }),
  });
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
  executorId: string,
  specMarkdown: string,
  approvedDecisions: DecisionPayload[],
  activeSkills: SkillPayload[] = [],
  commitMessage?: string,
  push = false
): Promise<{ summary: string; status: string; snapshot?: any }> {
  return json(`${EXECUTION}/api/execute-spec`, {
    method: "POST",
    body: JSON.stringify({
      room_id: roomId,
      executor_id: executorId,
      spec_markdown: specMarkdown,
      approved_decisions: approvedDecisions,
      active_skills: activeSkills,
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
  return json(`${ORCHESTRATOR}/api/rooms/${roomId}/export`, {
    method: "POST",
  });
}

// ─── Authentication (Orchestrator :8000) ───

export async function signup(username: string, password: string): Promise<{ user_id: string }> {
  return json(`${ORCHESTRATOR}/api/auth/signup`, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function login(username: string, password: string): Promise<User> {
  return json(`${ORCHESTRATOR}/api/auth/login`, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function getMe(): Promise<User> {
  return json(`${ORCHESTRATOR}/api/auth/me`);
}

export async function logout(): Promise<{ status: string }> {
  return json(`${ORCHESTRATOR}/api/auth/logout`, { method: "POST" });
}

export async function getMyRooms(): Promise<{ room_id: string; current_goal: string; status: string }[]> {
  return json(`${ORCHESTRATOR}/api/users/me/rooms`);
}

export async function joinRoom(roomId: string): Promise<{ status: string }> {
  return json(`${ORCHESTRATOR}/api/rooms/${roomId}/join`, { method: "POST" });
}

export async function resolveConflict(
  roomId: string,
  conflictId: string,
  winner: "a" | "b"
): Promise<{ status: string; decision_id: string }> {
  return json(`${ORCHESTRATOR}/api/rooms/${roomId}/conflicts/${conflictId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ winner }),
  });
}

export async function getUsers(): Promise<User[]> {
  return json(`${ORCHESTRATOR}/api/users`);
}

export async function updateUserRole(userId: string, role: "manager" | "member"): Promise<{ status: string }> {
  return json(`${ORCHESTRATOR}/api/users/${userId}/role`, {
    method: "POST",
    body: JSON.stringify({ role }),
  });
}
