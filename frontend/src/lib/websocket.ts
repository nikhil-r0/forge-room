// ─── ForgeRoom WebSocket Client ───

import { toast } from "sonner";
import { useRoomStore } from "./useRoomStore";
import { MessageType } from "./types";
import type { UIMessage, ConflictPayload, DriftAlertPayload } from "./types";

const getWsUrl = (port: number) => {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    return `ws://${host}:${port}`;
  }
  return `ws://localhost:${port}`;
};

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? getWsUrl(8002);

let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const messageQueue: string[] = [];

// ─── Connection ───

export function connectWebSocket(roomId: string, userId: string) {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const url = `${WS_BASE}/ws/${roomId}/${userId}`;
  ws = new WebSocket(url);

  ws.onopen = () => {
    reconnectAttempts = 0;
    useRoomStore.getState().setConnected(true);
    // Flush queued messages
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift()!;
      ws?.send(msg);
    }
  };

  ws.onclose = () => {
    useRoomStore.getState().setConnected(false);
    scheduleReconnect(roomId, userId);
  };

  ws.onerror = () => {
    ws?.close();
  };

  ws.onmessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      console.error("[WS] JSON Parse Error. Raw data:", event.data);
      return;
    }

    try {
      routeMessage(data);
    } catch (err) {
      console.error("[WS] Route Message Error:", err, "Data:", data);
    }
  };
}

export function disconnectWebSocket() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  reconnectTimeout = null;
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // suppress reconnect
  if (ws) {
    ws.close();
    ws = null;
  }
  useRoomStore.getState().setConnected(false);
}

export function sendMessage(payload: { message: string; display_name?: string }) {
  const raw = JSON.stringify({ payload });
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(raw);
  } else {
    messageQueue.push(raw);
  }
}

// ─── Reconnect ───

function scheduleReconnect(roomId: string, userId: string) {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
  const delay = Math.min(1000 * 2 ** reconnectAttempts, 30_000);
  reconnectAttempts++;
  reconnectTimeout = setTimeout(() => connectWebSocket(roomId, userId), delay);
}

// ─── Message Router ───

function routeMessage(data: Record<string, unknown>) {
  const type = data.type as MessageType;
  const payload = (data.payload ?? {}) as Record<string, unknown>;
  const senderId = (data.sender_id as string) ?? "system";
  const store = useRoomStore.getState();

  switch (type) {
    case MessageType.CHAT: {
      const displayName =
        (payload.display_name as string) ?? senderId.replace("user:", "");
      const msg: UIMessage = {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        type: "human",
        sender: displayName,
        content: (payload.message as string) ?? "",
        timestamp: new Date(data.timestamp as string),
      };
      store.addMessage(msg);
      break;
    }

    case MessageType.SPEC_UPDATE: {
      store.setSpecState(payload as {
        current_goal: string;
        approved_decisions: [];
        pending_tasks: string[];
        open_conflicts: number;
      });
      // Add supervisor message to chat
      const specMsg: UIMessage = {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        type: "supervisor",
        sender: "Supervisor",
        content: `Spec updated. Current goal: ${payload.current_goal ?? ""}`,
        timestamp: new Date(data.timestamp as string),
      };
      store.addMessage(specMsg);
      break;
    }

    case MessageType.BLAME_GRAPH: {
      const nodes = (payload.nodes ?? []) as [];
      const edges = (payload.edges ?? []) as [];
      store.setBlameGraph(nodes, edges);
      break;
    }

    case MessageType.CONFLICT: {
      const conflict = payload as unknown as ConflictPayload;
      store.addConflict(conflict);
      // Render as chat message
      const conflictMsg: UIMessage = {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        type: "conflict",
        sender: "Supervisor",
        content: conflict.summary,
        timestamp: new Date(data.timestamp as string),
        payload: conflict as unknown as Record<string, unknown>,
      };
      store.addMessage(conflictMsg);
      store.incrementTimeSaved(0.5);
      break;
    }

    case MessageType.VOTE_RESULT: {
      const conflict = payload as unknown as ConflictPayload;
      store.updateConflict(conflict);
      if (conflict.resolved) {
        toast.success("Conflict Resolved", {
          description: `Winner: Option ${conflict.winner?.toUpperCase()}`,
        });
        store.incrementTimeSaved(0.5);
      }
      break;
    }

    case MessageType.DRIFT_ALERT: {
      const alert = payload as unknown as DriftAlertPayload;
      store.addDriftAlert(alert);
      const driftMsg: UIMessage = {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        type: "drift_alert",
        sender: "DriftDetector",
        content: alert.explanation,
        timestamp: new Date(data.timestamp as string),
        payload: alert as unknown as Record<string, unknown>,
      };
      store.addMessage(driftMsg);
      break;
    }

    case MessageType.AGENT_RESPONSE: {
      const agentMsg: UIMessage = {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        type: "agent_skill",
        sender: (payload.agent_name as string) ?? "Agent",
        content: (payload.response as string) ?? "",
        timestamp: new Date(data.timestamp as string),
      };
      store.addMessage(agentMsg);
      break;
    }

    case MessageType.ERROR: {
      toast.error("Server Error", {
        description: (payload.message as string) ?? "Unknown error",
      });
      break;
    }

    default:
      console.warn("[WS] Unknown message type:", type);
  }
}
