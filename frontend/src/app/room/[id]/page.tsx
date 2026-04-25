"use client"

import { useState, useRef, useEffect, useCallback, Suspense, lazy } from "react"
import ReactMarkdown from "react-markdown"
import { useParams, useSearchParams } from "next/navigation"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import {
  Send,
  ShieldAlert,
  Plus,
  Download,
  Flame,
  Loader2,
  Wifi,
  WifiOff,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ConflictCard } from "@/components/chat/ConflictCard"
import { ConflictsPanel } from "@/components/sidebar/ConflictsPanel"
import { SpecPanel } from "@/components/sidebar/SpecPanel"
import { ExecutionModal } from "@/components/modals/ExecutionModal"
import { RiskAutopsyModal } from "@/components/modals/RiskAutopsyModal"
import { ThemeToggle } from "@/components/ThemeToggle"
import { DriftAlertCard } from "@/components/chat/DriftAlertCard"
import { QRSharePanel } from "@/components/room/QRSharePanel"
import { useRoomStore } from "@/lib/useRoomStore"
import { connectWebSocket, disconnectWebSocket, sendMessage } from "@/lib/websocket"
import { getRoom, executeSpec, exportSession, invokeAgent, getMe, addSkill, updateRoomSettings } from "@/lib/api"
import { AuthModal } from "@/components/modals/AuthModal"
import { SettingsModal } from "@/components/modals/SettingsModal"
import type { UIMessage, ConflictPayload, DriftAlertPayload } from "@/lib/types"

// Lazy-load React Flow to avoid SSR issues
const BlameGraph = lazy(() => import("@/components/graph/BlameGraph"))

// ─── MessageBubble ───

function MessageBubble({ message }: { message: UIMessage }) {
  const isHuman = message.type === "human"
  const isSupervisor = message.type === "supervisor"
  const isAgent = message.type === "agent_skill"

  return (
    <div className={cn("mb-4 flex flex-col group", isHuman ? "items-end" : "items-start")}>
      <div className="flex items-center gap-2 mb-1 px-1">
        {isAgent && (
          <span className="text-label-sm text-primary uppercase tracking-widest font-semibold">
            @{message.sender}
          </span>
        )}
        {isSupervisor && (
          <span className="text-label-sm text-tertiary-container uppercase tracking-widest font-semibold flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            Supervisor
          </span>
        )}
        {isHuman && (
          <span className="text-label-sm text-on-surface-variant uppercase tracking-widest">
            {message.display_name || message.sender}
          </span>
        )}
        <span className="text-[10px] text-outline-variant opacity-0 group-hover:opacity-100 transition-opacity">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div
        className={cn(
          "max-w-[80%] px-4 py-3 text-body-md rounded-md transition-all duration-200",
          isHuman
            ? "bg-surface-container-highest text-on-surface"
            : "bg-surface-container-low text-on-surface",
          isSupervisor &&
          "bg-tertiary-container/10 shadow-[0_0_15px_rgba(254,177,39,0.1)] relative before:absolute before:inset-0 before:ring-1 before:ring-tertiary-container/30 before:rounded-md",
          isAgent && "bg-surface-container-high"
        )}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-surface-container-highest prose-pre:border prose-pre:border-outline-variant/30">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

// ─── Main Room Component ───

function ChatRoomContent() {
  const { id: roomId } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const urlName = searchParams.get("name") || "Human"

  const roomIdFromStore = useRoomStore((s) => s.roomId);
  const displayName = useRoomStore((s) => s.displayName);
  const connected = useRoomStore((s) => s.connected);
  const messages = useRoomStore((s) => s.messages);
  const currentGoal = useRoomStore((s) => s.currentGoal);
  const approvedDecisions = useRoomStore((s) => s.approvedDecisions);
  const pendingTasks = useRoomStore((s) => s.pendingTasks);
  const openConflicts = useRoomStore((s) => s.openConflicts);
  const conflicts = useRoomStore((s) => s.conflicts);
  const activeSkills = useRoomStore((s) => s.activeSkills);
  const focusMode = useRoomStore((s) => s.focusMode);
  const timeSaved = useRoomStore((s) => s.timeSaved);
  const isDiffModalOpen = useRoomStore((s) => s.isDiffModalOpen);
  const isRiskModalOpen = useRoomStore((s) => s.isRiskModalOpen);
  const isGenerating = useRoomStore((s) => s.isGenerating);
  const riskAutopsyMarkdown = useRoomStore((s) => s.riskAutopsyMarkdown);
  const exportMarkdown = useRoomStore((s) => s.exportMarkdown);
  const currentUser = useRoomStore((s) => s.currentUser);
  const store = useRoomStore();

  const userName = displayName || urlName
  const [input, setInput] = useState("")
  const [skillUrl, setSkillUrl] = useState("")
  const [skillName, setSkillName] = useState("")
  const [loaded, setLoaded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Mentions logic
  const allAgents = [
    { name: "AppSec", desc: "Security Auditing & Threat Modeling" },
    { name: "Implementer", desc: "Code Synchronization" },
    { name: "Supervisor", desc: "Goal & Task Manager" },
    ...activeSkills.map(s => ({ name: s.name, desc: "Custom Skill" }))
  ]
  
  const lastWord = input.split(' ').pop() || ""
  const showMentions = lastWord.startsWith('@')
  const mentionQuery = showMentions ? lastWord.substring(1).toLowerCase() : ""
  const filteredAgents = showMentions 
    ? allAgents.filter(a => a.name.toLowerCase().includes(mentionQuery))
    : []

  const handleMentionSelect = (agentName: string) => {
    const words = input.split(' ')
    words.pop() // remove the partial mention
    const prefix = words.join(' ')
    setInput(prefix + (prefix ? ' ' : '') + `@${agentName} `)
    inputRef.current?.focus()
  }

  const hasUnresolvedConflict = store.conflicts.some((c) => !c.resolved)

  // ─── Initialize: load room + connect WS ───
  const authCheckedRef = useRef(false)

  useEffect(() => {
    if (!roomId) return

    const init = async () => {
      let activeUser = currentUser;
      
      // Sync identity once per room mount to pick up role changes (like Manager promotion)
      if (!authCheckedRef.current) {
        try {
          const me = await getMe()
          store.setCurrentUser(me)
          activeUser = me;
          authCheckedRef.current = true;
        } catch (err) {
          if (!activeUser) {
             console.warn("Guest mode: No user found.")
          }
        }
      }

      try {
        const userName = activeUser?.username || "Human"
        const userId = activeUser?.user_id || "Guest-" + Math.random().toString(36).slice(2, 6)

        // Prevent double init if same user and room
        if (loaded && store.roomId === roomId && store.displayName === userName) return

        // Set room info
        store.setRoom(roomId as string, userName)

        // Load existing state
        const snapshot = await getRoom(roomId as string)
        store.hydrateFromSnapshot(snapshot)

        if (!loaded) {
          store.addMessage({
            id: "welcome",
            type: "supervisor",
            sender: "Supervisor",
            content: `Welcome to ForgeRoom, ${userName}.`,
            timestamp: new Date(),
          })
        }

        // Connect WebSocket using user_id
        connectWebSocket(roomId as string, userId)
        setLoaded(true)
      } catch (err) {
        console.error("Room initialization failed", err)
      }
    }

    init()

    return () => {
      disconnectWebSocket()
      authCheckedRef.current = false // Reset for potential re-mount
    }
  }, [roomId])

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ─── Handlers ───

  const handleSendMessage = useCallback(() => {
    if (!input.trim()) return
    sendMessage({ message: input, display_name: userName })

    // Check for agent invocations
    const store = useRoomStore.getState()
    if (store.focusMode) {
      const agentMatch = input.match(/@([\w-]+)/i)
      if (agentMatch) {
        const agentName = agentMatch[1]
        invokeAgent(roomId as string, agentName).catch(() =>
          toast.error(`Agent @${agentName} not available`)
        )
      }
    }

    setInput("")
  }, [input, userName, roomId])


  const handleAddSkill = async () => {
    if (!skillUrl.trim()) return
    
    // Default name from URL if name field is empty
    const finalName = skillName.trim() || skillUrl.split("/").pop()?.replace(".md", "") || "NewAgent"
    
    // Duplicate check
    const isDuplicate = activeSkills.some(s => s.name.toLowerCase() === finalName.toLowerCase())
    if (isDuplicate) {
      toast.error("Duplicate Skill", { description: `A skill named "${finalName}" is already registered.` })
      return
    }

    try {
      await addSkill(roomId as string, finalName, undefined, skillUrl)
      toast.success("New Agent Ready", {
        description: `@${finalName} has been registered.`,
      })
      setSkillUrl("")
      setSkillName("")
    } catch (err) {
      toast.error("Failed to register agent", { description: String(err) })
    }
  }

  const handleGenerateCode = () => {
    store.setDiffModalOpen(true)
  }

  const handleExecutionSuccess = (summary: string) => {
    store.setExecutionSummary(summary)
    store.incrementTimeSaved(1.0) // Implementing code saves more time!
    toast.success("Execution Complete")
  }

  const handleExport = async () => {
    try {
      const result = await exportSession(roomId as string)
      store.setRiskAutopsy(result.risk_autopsy)
      store.setExportMarkdown(result.markdown)
      store.setRiskModalOpen(true)
    } catch (err) {
      toast.error("Export failed", { description: String(err) })
    }
  }

  const handleConfirmExport = () => {
    store.setRiskModalOpen(false)
    toast.success("Session Exported", {
      description: "Your risk autopsy has been downloaded.",
    })
  }

  return (
    <div className="flex flex-col h-screen bg-surface-dim text-on-surface font-sans antialiased overflow-hidden selection:bg-primary/30 transition-colors duration-500">
      <AuthModal />
      <ExecutionModal
        isOpen={isDiffModalOpen}
        onClose={() => store.setDiffModalOpen(false)}
        specMarkdown={`# ${currentGoal}\n\n## Decisions\n${approvedDecisions.map((d) => `- [${d.category}] ${d.description}`).join("\n")}\n\n## Tasks\n${pendingTasks.map((t) => `- ${t}`).join("\n")}`}
        approvedDecisions={approvedDecisions}
        activeSkills={activeSkills}
        onSuccess={handleExecutionSuccess}
      />

      <RiskAutopsyModal
        isOpen={isRiskModalOpen}
        onClose={() => store.setRiskModalOpen(false)}
        onConfirmExport={handleConfirmExport}
        riskAutopsyMarkdown={riskAutopsyMarkdown}
        exportMarkdown={exportMarkdown}
        roomId={roomId as string}
      />

      {/* ─── Header ─── */}
      <header className="h-16 flex items-center justify-between px-6 bg-surface-container-highest z-20 shrink-0 border-b border-surface/5 shadow-md">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-surface-container-low rounded-md relative overflow-hidden group hover:scale-[1.05] transition-transform cursor-pointer shadow-sm">
            <Flame className="w-5 h-5 text-primary relative z-10" />
            <div className="absolute inset-0 bg-primary/20 scale-0 group-hover:scale-150 transition-transform duration-500 rounded-full" />
          </div>
          <h1 className="font-bold text-lg hidden sm:block tracking-tight text-on-surface">
            ForgeRoom
          </h1>
          <div className="px-2 py-1 rounded-sm bg-surface-container-lowest text-label-sm uppercase tracking-widest text-on-surface-variant font-mono">
            Room: <span className="text-primary">{(roomId as string)?.slice(0, 8)}</span>
          </div>
          {/* Connection indicator */}
          <div className="flex items-center gap-1">
            {connected ? (
              <Wifi className="w-3 h-3 text-[#34d399]" />
            ) : (
              <WifiOff className="w-3 h-3 text-error animate-pulse" />
            )}
            <span className="text-[9px] uppercase tracking-widest text-on-surface-variant">
              {connected ? "Live" : "Disconnected"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          {/* Focus Mode Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-widest">
              AI Focus
            </span>
            <div
              className="relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full shadow-inner"
              onClick={async () => {
                const newMode = !focusMode;
                store.setFocusMode(newMode);
                try {
                  await updateRoomSettings(roomId as string, undefined, newMode);
                } catch (err) {
                  toast.error("Failed to sync Focus Mode to server");
                  // Optional: revert local state if API fails
                  // store.setFocusMode(!newMode);
                }
              }}
            >
              <div
                className={cn(
                  "absolute h-full w-full rounded-full transition-colors duration-200",
                  focusMode ? "bg-primary" : "bg-surface-container-low"
                )}
              />
              <div
                className={cn(
                  "absolute h-4 w-4 rounded-full bg-surface transition-transform duration-200 shadow-sm",
                  focusMode ? "translate-x-2" : "-translate-x-2"
                )}
              />
            </div>
          </div>

          <div className="hidden md:flex items-center gap-5">
            {/* Time Saved */}
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-low rounded-sm shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse-node shadow-[0_0_8px_rgba(254,177,39,0.8)]" />
              <span className="text-label-sm font-semibold text-tertiary uppercase tracking-wider">
                {timeSaved.toFixed(1)}h Saved
              </span>
            </div>

            {/* QR Share */}
            <QRSharePanel roomId={roomId as string} />

            <ThemeToggle />

            <SettingsModal roomId={roomId as string} />

            <button
              onClick={handleExport}
              className="flex items-center gap-2 h-8 px-4 rounded-sm text-label-sm font-semibold uppercase tracking-widest text-on-surface-variant bg-surface-container-low hover:text-on-surface hover:bg-surface-container transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden h-full">
        {/* ─── Left Column: Conflicts & Polls ─── */}
        <ConflictsPanel conflicts={conflicts} />

        {/* ─── Main Chat Area ─── */}
        <main className="flex-1 flex flex-col relative bg-surface-dim shrink-0">
          <ScrollArea className="flex-1 px-8 py-6" ref={scrollRef}>
            <div className="max-w-3xl mx-auto py-4">
              {messages.map((msg) => {
                if (msg.type === "conflict" && msg.payload) {
                  const p = msg.payload as unknown as ConflictPayload
                  const pseudoMessage: UIMessage = {
                    id: msg.id,
                    type: "human",
                    sender: "System",
                    display_name: "Arbitrator",
                    timestamp: msg.timestamp,
                    content: `📊 **Poll Started:** ${p.summary}\n\n*Check the open conflicts panel on the left to vote.*`
                  }
                  return <MessageBubble key={msg.id} message={pseudoMessage} />
                }
                if (msg.type === "drift_alert" && msg.payload) {
                  const p = msg.payload as unknown as DriftAlertPayload
                  return (
                    <DriftAlertCard
                      key={msg.id}
                      alertTitle={`Drift: ${p.conflicting_file}:${p.conflicting_line}`}
                      alertMessage={p.explanation}
                      codeSnippet={p.conflicting_code_snippet}
                    />
                  )
                }
                return <MessageBubble key={msg.id} message={msg} />
              })}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          </ScrollArea>

          {/* ─── Prompt Area ─── */}
          <div className="p-6 bg-surface-container-low">
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Skill Adder */}
              <div className="flex gap-2 items-center">
                <div className="relative w-48 group/skill-name">
                  <input
                    type="text"
                    placeholder="Skill Name (Optional)"
                    className="w-full px-3 py-2 bg-surface-container-lowest text-label-sm text-on-surface placeholder:text-outline-variant border border-transparent focus:border-outline-variant/30 focus:outline-none rounded-sm transition-all"
                    value={skillName}
                    onChange={(e) => setSkillName(e.target.value)}
                  />
                </div>
                <div className="relative flex-1 group/skill">
                  <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline-variant" />
                  <input
                    type="text"
                    placeholder="Paste SKILL.md URL..."
                    className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest text-label-sm text-on-surface placeholder:text-outline-variant border border-transparent focus:border-outline-variant/30 focus:outline-none rounded-sm transition-all"
                    value={skillUrl}
                    onChange={(e) => setSkillUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddSkill()}
                  />
                </div>
                <button
                  onClick={handleAddSkill}
                  className="h-9 px-4 rounded-sm text-label-sm font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors"
                >
                  Register
                </button>
              </div>

              {/* Chat Input */}
              <div className="relative group/chat">
                {/* Mentions Popup */}
                {showMentions && focusMode && filteredAgents.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 w-72 bg-surface-container border border-outline-variant/20 rounded-sm shadow-2xl overflow-hidden z-50">
                    <div className="p-2 border-b border-outline-variant/10 bg-surface-container-low">
                      <span className="text-[10px] font-bold text-outline-variant uppercase tracking-widest">
                        Available Agents
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredAgents.map(agent => (
                        <button 
                          key={agent.name}
                          className="w-full text-left px-3 py-2 hover:bg-primary/10 transition-colors flex flex-col border-b border-outline-variant/5 last:border-0"
                          onClick={() => handleMentionSelect(agent.name)}
                        >
                          <span className="font-bold text-sm text-primary">@{agent.name}</span>
                          <span className="text-[11px] text-outline-variant truncate">{agent.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className={cn(
                  "relative flex items-center bg-surface-container-highest rounded-sm transition-all border-b-2 border-transparent",
                  focusMode ? "border-primary/40 shadow-[0_4px_20px_rgba(var(--primary-rgb),0.1)]" : "border-outline-variant/10"
                )}>
                  {focusMode && (
                    <Sparkles className="absolute left-4 w-4 h-4 text-primary animate-pulse" />
                  )}
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={
                      focusMode
                        ? "Draft a spec or chat with AI agents... (type @ to mention)"
                        : "AI Focus Silenced. Normal chat active..."
                    }
                    disabled={false}
                    className={cn(
                      "w-full pr-14 py-4 bg-transparent text-body-md text-on-surface placeholder:text-outline-variant focus:outline-none transition-all",
                      focusMode ? "pl-11" : "pl-4"
                    )}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                  />
                </div>
                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-primary scale-x-0 group-focus-within/chat:scale-x-100 transition-transform origin-left" />
                <button
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-sm transition-all",
                    input.trim()
                      ? "bg-primary/10 text-primary hover:bg-primary/20"
                      : "text-outline-variant cursor-not-allowed opacity-50"
                  )}
                  onClick={handleSendMessage}
                  disabled={!input.trim()}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* ─── Right Column: Living Spec ─── */}
        <aside className="w-80 bg-surface-container-low shrink-0 flex flex-col hidden lg:flex border-l border-surface-container-high/30">
          <SpecPanel
            currentGoal={currentGoal}
            approvedDecisions={approvedDecisions}
            pendingTasks={pendingTasks}
            activeSkills={activeSkills}
            openConflicts={openConflicts}
            isLocked={hasUnresolvedConflict}
            isGenerating={isGenerating}
            userRole={currentUser?.role || "member"}
            onGenerateCode={handleGenerateCode}
          />
        </aside>
      </div>
    </div>
  )
}

export default function ChatRoom() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    }>
      <ChatRoomContent />
    </Suspense>
  )
}
