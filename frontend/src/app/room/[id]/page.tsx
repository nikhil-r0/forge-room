"use client"

import { useState, useRef, useEffect } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import {
    Send,
    Brain,
    User,
    ShieldAlert,
    Zap,
    Plus,
    ChevronRight,
    Download,
    Flame
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ConflictCard } from "@/components/chat/ConflictCard"
import { SpecPanel } from "@/components/sidebar/SpecPanel"
import { DiffModal } from "@/components/modals/DiffModal"
import { RiskAutopsyModal } from "@/components/modals/RiskAutopsyModal"
import { ThemeToggle } from "@/components/ThemeToggle"
import { DriftAlertCard } from "@/components/chat/DriftAlertCard"

// --- Types ---

type MessageType = "human" | "supervisor" | "agent_skill" | "conflict" | "drift_alert"

interface Message {
    id: string
    type: MessageType
    sender: string
    content: string
    timestamp: Date
    payload?: any
}

// --- Components ---

const MessageBubble = ({ message }: { message: Message }) => {
    const isHuman = message.type === "human"
    const isSupervisor = message.type === "supervisor"
    const isAgent = message.type === "agent_skill"

    return (
        <div className={cn(
            "mb-4 flex flex-col group",
            isHuman ? "items-end" : "items-start"
        )}>
            <div className="flex items-center gap-2 mb-1 px-1">
                {isAgent && <span className="text-label-sm text-primary uppercase tracking-widest font-semibold">@{message.sender}</span>}
                {isSupervisor && <span className="text-label-sm text-tertiary-container uppercase tracking-widest font-semibold flex items-center gap-1"><ShieldAlert className="w-3 h-3" />Supervisor</span>}
                {isHuman && <span className="text-label-sm text-on-surface-variant uppercase tracking-widest">{message.sender}</span>}
                <span className="text-[10px] text-outline-variant opacity-0 group-hover:opacity-100 transition-opacity">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>

            <div className={cn(
                "max-w-[80%] px-4 py-3 text-body-md rounded-md transition-all duration-200",
                isHuman ? "bg-surface-container-highest text-on-surface" : "bg-surface-container-low text-on-surface",
                isSupervisor && "bg-tertiary-container/10 shadow-[0_0_15px_rgba(254,177,39,0.1)] relative before:absolute before:inset-0 before:ring-1 before:ring-tertiary-container/30 before:rounded-md",
                isAgent && "bg-surface-container-high"
            )}>
                {message.content}
            </div>
        </div>
    )
}

export default function ChatRoom() {
    const { id: roomId } = useParams()
    const searchParams = useSearchParams()
    const userName = searchParams.get("name") || "Human"

    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            type: "supervisor",
            sender: "Supervisor",
            content: "Welcome to ForgeRoom. I'm monitoring this session for any conflicts.",
            timestamp: new Date()
        },
        {
            id: "2",
            type: "agent_skill",
            sender: "AppSec",
            content: "Initial security scan complete. No critical vulnerabilities found in the current spec.",
            timestamp: new Date()
        }
    ])
    const [input, setInput] = useState("")
    const [focusMode, setFocusMode] = useState(false)
    const [skillUrl, setSkillUrl] = useState("")
    const [timeSaved, setTimeSaved] = useState(1.5)

    const [isDiffModalOpen, setIsDiffModalOpen] = useState(false)
    const [currentDiff, setCurrentDiff] = useState("")

    const [isRiskModalOpen, setIsRiskModalOpen] = useState(false)

    const [specState, setSpecState] = useState({
        goal: "Implement **multi-tenant chat architecture** with conflict resolution using *shadcn/ui* components.",
        decisions: [
            "Use shadcn ScrollArea for history",
            "Implement real-time voting via WebSockets",
            "Modularize components for reuse"
        ],
        tasks: [
            "Integrate GeminiCLI for diff generation",
            "Implement session export functionality"
        ]
    })

    const hasConflict = messages.some(m => m.type === "conflict")

    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    const handleSendMessage = () => {
        if (!input.trim()) return
        const newMessage: Message = {
            id: Date.now().toString(),
            type: "human",
            sender: userName,
            content: input,
            timestamp: new Date()
        }
        setMessages([...messages, newMessage])
        setInput("")

        if (input.toLowerCase().includes("conflict")) {
            setTimeout(() => {
                const conflictMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    type: "conflict",
                    sender: "Supervisor",
                    content: "Conflict detected between @Frontend and @Arch over state management.",
                    timestamp: new Date(),
                    payload: {
                        summary: "Should we use React Context or a full-blown Zustand store for the global spec state?",
                        optionA: "React Context (Simple, built-in)",
                        optionB: "Zustand (Performant, scalable)"
                    }
                }
                setMessages(prev => [...prev, conflictMsg])
            }, 1000)
        }

        if (input.toLowerCase().includes("drift")) {
            setTimeout(() => {
                const driftMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    type: "drift_alert",
                    sender: "AppSec",
                    content: "Code diverges from Spec.",
                    timestamp: new Date(),
                    payload: {
                        alertTitle: "Critical Spec Divergence",
                        alertMessage: "The suggested middleware bypasses the JWT token validation defined in the overarching spec.",
                        codeSnippet: "+ // Temporary bypass for testing\n+ if (req.url === '/api/dev') return next();"
                    }
                }
                setMessages(prev => [...prev, driftMsg])
            }, 1000)
        }
    }

    const handleAddSkill = () => {
        if (!skillUrl.trim()) return
        toast.success("New Agent Ready", {
            description: `@${skillUrl.split('/').pop()?.replace('.md', '') || 'NewAgent'} has been tagged and is ready for use.`
        })
        setSkillUrl("")
    }

    const handleGenerateCode = () => {
        setCurrentDiff(`diff --git a/src/app/page.tsx b/src/app/page.tsx
index 1234567..89abcde 100644
--- a/src/app/page.tsx
+++ b/src/app/page.tsx
@@ -10,6 +10,10 @@ export default function Home() {
-  return <div>Hello</div>
+  return (
+    <div className="flex flex-col gap-4">
+      <h1 className="text-2xl font-bold">ForgeRoom</h1>
+      <p className="text-muted-foreground">Welcome to the forge.</p>
+    </div>
+  )`)
        setIsDiffModalOpen(true)
    }

    const handleApproveDiff = (updatedDiff: string) => {
        setIsDiffModalOpen(false)
        toast.success("Code Applied", {
            description: "The generated diff has been approved and executed successfully."
        })
        setTimeSaved(prev => prev + 0.5)
    }

    const handleExport = () => {
        setIsRiskModalOpen(true)
    }

    const handleConfirmExport = () => {
        setIsRiskModalOpen(false)
        const content = messages.map(m => `[${m.timestamp.toISOString()}] ${m.sender}: ${m.content}`).join('\n\n')
        const blob = new Blob([content], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `forge-room-${roomId}.md`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success("Session Exported", { description: "Your chat history has been downloaded as a .md file." })
    }

    return (
        <div className="flex flex-col h-screen bg-surface-dim text-on-surface font-sans antialiased overflow-hidden selection:bg-primary/30 transition-colors duration-500">
            <DiffModal
                isOpen={isDiffModalOpen}
                onClose={() => setIsDiffModalOpen(false)}
                diff={currentDiff}
                onApprove={handleApproveDiff}
            />

            <RiskAutopsyModal
                isOpen={isRiskModalOpen}
                onClose={() => setIsRiskModalOpen(false)}
                onConfirmExport={handleConfirmExport}
            />

            {/* Header: Uses background shift (surface-container-highest) instead of border */}
            <header className="h-16 flex items-center justify-between px-6 bg-surface-container-highest z-20 shrink-0 border-b border-surface/5 shadow-md">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-surface-container-low rounded-md relative overflow-hidden group hover:scale-[1.05] transition-transform cursor-pointer shadow-sm">
                        <Flame className="w-5 h-5 text-primary relative z-10" />
                        <div className="absolute inset-0 bg-primary/20 scale-0 group-hover:scale-150 transition-transform duration-500 rounded-full"></div>
                    </div>
                    <h1 className="font-bold text-lg hidden sm:block tracking-tight text-on-surface">ForgeRoom: Arena</h1>
                    <div className="px-2 py-1 rounded-sm bg-surface-container-lowest text-label-sm uppercase tracking-widest text-on-surface-variant font-mono">
                        Room: <span className="text-primary">{roomId?.slice(0, 8)}</span>
                    </div>
                </div>

                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                        <span className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-widest">AI Focus</span>
                        <div className="relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full shadow-inner" onClick={() => setFocusMode(!focusMode)}>
                            <div className={cn("absolute h-full w-full rounded-full transition-colors duration-200", focusMode ? "bg-primary" : "bg-surface-container-low")}></div>
                            <div className={cn("absolute h-4 w-4 rounded-full bg-surface transition-transform duration-200 shadow-sm", focusMode ? "translate-x-2" : "-translate-x-2")}></div>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center gap-5">
                        <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-low rounded-sm shadow-sm">
                            <div className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse-node shadow-[0_0_8px_rgba(254,177,39,0.8)]"></div>
                            <span className="text-label-sm font-semibold text-tertiary uppercase tracking-wider">
                                {timeSaved}h Saved
                            </span>
                        </div>

                        <ThemeToggle />

                        <button onClick={handleExport} className="flex items-center gap-2 h-8 px-4 rounded-sm text-label-sm font-semibold uppercase tracking-widest text-on-surface-variant bg-surface-container-low hover:text-on-surface hover:bg-surface-container transition-all">
                            <Download className="w-3.5 h-3.5" />
                            Export
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Column: Blame Graph */}
                <aside className="w-64 bg-surface-container-low flex-col hidden xl:flex shrink-0">
                    <div className="p-4 bg-surface-container-highest">
                        <h2 className="text-label-sm font-bold uppercase tracking-widest text-on-surface-variant">Blame Graph</h2>
                    </div>
                    <div className="flex-1 p-4 relative overflow-hidden flex flex-col items-center justify-start pt-8 gap-8">
                        <div className="absolute inset-0 opacity-[0.03] pattern-grid-lg"></div>

                        {/* Mock CSS Nodes */}
                        <div className="relative flex flex-col items-center gap-8 w-full z-10">
                            {/* Node 1 */}
                            <div className="w-40 h-10 bg-primary/20 border border-primary/50 rounded-sm flex items-center justify-center animate-pulse-node shadow-[0_0_15px_rgba(0,209,255,0.2)]">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-primary">Core Spec</span>
                            </div>

                            {/* Colored Edge */}
                            <div className="absolute top-10 left-1/2 w-0.5 h-8 bg-tertiary/50 -translate-x-1/2"></div>

                            {/* Node 2 (Conflict) */}
                            <div className="w-40 h-10 bg-tertiary-container/20 border border-tertiary-container/50 rounded-sm flex items-center justify-center shadow-[0_0_15px_rgba(254,177,39,0.2)]">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-tertiary-container">UI Framework (?)</span>
                            </div>

                            {/* Red Edge (Contradiction) */}
                            <div className="absolute top-28 left-[45%] w-0.5 h-8 bg-error -translate-x-1/2 border-l border-dashed border-error/50"></div>

                            {/* Node 3 (Drift) */}
                            <div className="absolute top-36 left-4 w-32 h-10 bg-error/20 border border-error/50 rounded-sm flex items-center justify-center shadow-[0_0_15px_rgba(225,29,72,0.2)] rotate-[-5deg]">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-error">Auth Bypass</span>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Chat Area */}
                <main className="flex-1 flex flex-col relative bg-surface-dim shrink-0">
                    <ScrollArea className="flex-1 px-8 py-6" ref={scrollRef}>
                        <div className="max-w-3xl mx-auto py-4">
                            {messages.map((msg) => {
                                if (msg.type === "conflict") {
                                    return (
                                        <ConflictCard
                                            key={msg.id}
                                            summary={msg.payload.summary}
                                            optionA={msg.payload.optionA}
                                            optionB={msg.payload.optionB}
                                            onResolve={() => {
                                                toast.success("Conflict Resolved")
                                                setTimeSaved(prev => prev + 0.5)
                                            }}
                                        />
                                    )
                                }
                                if (msg.type === "drift_alert") {
                                    return (
                                        <DriftAlertCard
                                            key={msg.id}
                                            alertTitle={msg.payload.alertTitle}
                                            alertMessage={msg.payload.alertMessage}
                                            codeSnippet={msg.payload.codeSnippet}
                                        />
                                    )
                                }
                                return <MessageBubble key={msg.id} message={msg} />
                            })}
                        </div>
                    </ScrollArea>

                    {/* Prompt Area */}
                    <div className="p-6 bg-surface-container-low">
                        <div className="max-w-3xl mx-auto space-y-4">
                            {/* Skill Adder Overlay */}
                            <div className="flex gap-2 items-center">
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
                                <button onClick={handleAddSkill} className="h-9 px-4 rounded-sm text-label-sm font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors">
                                    Register
                                </button>
                            </div>

                            {/* Chat Input */}
                            <div className="relative group/chat">
                                <input
                                    type="text"
                                    placeholder={focusMode ? "AI Focus Enabled. Terminal is read-only for agents." : "Draft a spec or chat with agents..."}
                                    className="w-full pr-14 pl-4 py-4 bg-surface-container-highest text-body-md text-on-surface placeholder:text-outline-variant border-b border-transparent focus:border-primary focus:outline-none rounded-sm transition-all"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                                />
                                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-primary scale-x-0 group-focus-within/chat:scale-x-100 transition-transform origin-left"></div>
                                <button
                                    className={cn(
                                        "absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-sm transition-all",
                                        input.trim() ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-outline-variant cursor-not-allowed"
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

                <aside className="w-80 bg-surface-container-low shrink-0 flex flex-col hidden lg:flex">
                    <SpecPanel
                        state={specState}
                        onGenerateCode={handleGenerateCode}
                        isLocked={hasConflict}
                    />
                </aside>
            </div>
        </div>
    )
}
