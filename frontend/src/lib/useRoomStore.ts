// ─── ForgeRoom Zustand Store ───

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BlameEdge,
  BlameNode,
  ConflictPayload,
  DecisionPayload,
  DriftAlertPayload,
  SkillPayload,
  UIMessage,
  User,
} from "./types";

interface RoomState {
  // ── Connection ──
  roomId: string | null;
  displayName: string;
  connected: boolean;
  currentUser: User | null;
  participants: User[];
  creatorId: string | null;

  // ── Chat ──
  messages: UIMessage[];

  // ── Spec State (from spec_update WS payload) ──
  currentGoal: string;
  approvedDecisions: DecisionPayload[];
  pendingTasks: string[];
  openConflicts: number;
  activeSkills: SkillPayload[];

  // ── Blame Graph ──
  blameNodes: BlameNode[];
  blameEdges: BlameEdge[];

  // ── Conflicts ──
  conflicts: ConflictPayload[];

  // ── Drift Alerts ──
  driftAlerts: DriftAlertPayload[];

  // ── UI State ──
  focusMode: boolean;
  timeSaved: number;
  executionSummary: string;
  isDiffModalOpen: boolean;
  isRiskModalOpen: boolean;
  isGenerating: boolean;
  riskAutopsyMarkdown: string;
  exportMarkdown: string;

  // ── Actions ──
  setRoom: (roomId: string, displayName: string) => void;
  setConnected: (connected: boolean) => void;

  addMessage: (message: UIMessage) => void;

  setSpecState: (data: {
    current_goal: string;
    approved_decisions: DecisionPayload[];
    pending_tasks: string[];
    open_conflicts: number;
    active_skills?: SkillPayload[];
    focus_mode?: boolean;
  }) => void;

  setBlameGraph: (nodes: BlameNode[], edges: BlameEdge[]) => void;

  addConflict: (conflict: ConflictPayload) => void;
  updateConflict: (conflict: ConflictPayload) => void;

  addDriftAlert: (alert: DriftAlertPayload) => void;

  setFocusMode: (mode: boolean) => void;
  incrementTimeSaved: (hours?: number) => void;

  setExecutionSummary: (summary: string) => void;
  setDiffModalOpen: (open: boolean) => void;
  setRiskModalOpen: (open: boolean) => void;
  setGenerating: (generating: boolean) => void;
  setRiskAutopsy: (markdown: string) => void;
  setExportMarkdown: (markdown: string) => void;

  // ── Hydrate from snapshot ──
  hydrateFromSnapshot: (snapshot: {
    room_id: string;
    creator_id?: string;
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
    participants: User[];
  }) => void;

  reset: () => void;
  setCurrentUser: (user: User | null) => void;
}

const initialState = {
  roomId: null as string | null,
  displayName: "",
  connected: false,
  messages: [] as UIMessage[],
  currentGoal: "",
  approvedDecisions: [] as DecisionPayload[],
  pendingTasks: [] as string[],
  openConflicts: 0,
  activeSkills: [] as SkillPayload[],
  blameNodes: [] as BlameNode[],
  blameEdges: [] as BlameEdge[],
  conflicts: [] as ConflictPayload[],
  driftAlerts: [] as DriftAlertPayload[],
  focusMode: false,
  timeSaved: 0,
  executionSummary: "",
  isDiffModalOpen: false,
  isRiskModalOpen: false,
  isGenerating: false,
  riskAutopsyMarkdown: "",
  exportMarkdown: "",
  currentUser: null as User | null,
  participants: [] as User[],
  creatorId: null as string | null,
};

export const useRoomStore = create<RoomState>()(
  persist(
    (set) => ({
      ...initialState,

  setRoom: (roomId, displayName) => set({ roomId, displayName }),
  setConnected: (connected) => set({ connected }),

  addMessage: (message) =>
    set((s) => {
      // Deduplicate by ID just in case
      if (s.messages.some(m => m.id === message.id)) return s;
      const sorted = [...s.messages, message].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      return { messages: sorted };
    }),

  setSpecState: (data) =>
    set((s) => ({
      currentGoal: data.current_goal,
      approvedDecisions: data.approved_decisions ?? [],
      pendingTasks: data.pending_tasks ?? [],
      openConflicts: data.open_conflicts ?? 0,
      activeSkills: data.active_skills ?? s.activeSkills,
      focusMode: data.focus_mode !== undefined ? data.focus_mode : s.focusMode,
    })),

  setBlameGraph: (nodes, edges) =>
    set({ blameNodes: nodes, blameEdges: edges }),

  addConflict: (conflict) =>
    set((s) => {
      // Avoid duplicate
      if (s.conflicts.some((c) => c.conflict_id === conflict.conflict_id))
        return s;
      return { conflicts: [...s.conflicts, conflict] };
    }),

  updateConflict: (conflict) =>
    set((s) => ({
      conflicts: s.conflicts.map((c) =>
        c.conflict_id === conflict.conflict_id ? conflict : c
      ),
    })),

  addDriftAlert: (alert) =>
    set((s) => {
      if (s.driftAlerts.some((a) => a.drift_id === alert.drift_id)) return s;
      return { driftAlerts: [...s.driftAlerts, alert] };
    }),

  setFocusMode: (mode) => set({ focusMode: mode }),
  incrementTimeSaved: (hours = 0.5) =>
    set((s) => ({ timeSaved: s.timeSaved + hours })),

  setExecutionSummary: (summary) => set({ executionSummary: summary }),
  setDiffModalOpen: (open) => set({ isDiffModalOpen: open }),
  setRiskModalOpen: (open) => set({ isRiskModalOpen: open }),
  setGenerating: (generating) => set({ isGenerating: generating }),
  setRiskAutopsy: (markdown) => set({ riskAutopsyMarkdown: markdown }),
  setExportMarkdown: (markdown) => set({ exportMarkdown: markdown }),

  hydrateFromSnapshot: (snapshot) =>
    set({
      roomId: snapshot.room_id,
      creatorId: snapshot.creator_id || null,
      currentGoal: snapshot.current_goal,
      focusMode: snapshot.focus_mode,
      pendingTasks: snapshot.pending_tasks,
      approvedDecisions: snapshot.approved_decisions,
      conflicts: snapshot.pending_conflicts,
      blameNodes: snapshot.blame_graph_nodes,
      blameEdges: snapshot.blame_graph_edges,
      driftAlerts: snapshot.last_drift_alerts,
      activeSkills: snapshot.active_skills || [],
      participants: snapshot.participants || [],
      messages: snapshot.messages.map((m) => ({
        id: Math.random().toString(36).substr(2, 9),
        type:
          m.sender === "Supervisor"
            ? "supervisor"
            : m.sender.startsWith("@")
            ? "agent_skill"
            : "human",
        sender: m.sender,
        content: m.message,
        timestamp: new Date(m.timestamp),
      })),
      openConflicts: snapshot.pending_conflicts.filter((c) => !c.resolved)
        .length,
    }),

  reset: () => set((state) => ({ ...initialState, currentUser: state.currentUser })),
  setCurrentUser: (user) => set({ currentUser: user }),
}), {
  name: "forgeroom-auth-storage",
  partialize: (state) => ({ currentUser: state.currentUser }),
}));
