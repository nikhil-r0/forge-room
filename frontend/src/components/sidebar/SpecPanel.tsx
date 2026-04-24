"use client"

import ReactMarkdown from "react-markdown"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Brain, ChevronRight, Focus, Loader2 } from "lucide-react"
import type { DecisionPayload } from "@/lib/types"

interface SpecPanelProps {
  currentGoal: string
  approvedDecisions: DecisionPayload[]
  pendingTasks: string[]
  openConflicts: number
  isLocked: boolean
  isGenerating: boolean
  onGenerateCode: () => void
}

const riskColor = (score: number) => {
  if (score <= 3) return "text-[#22c55e]"
  if (score <= 6) return "text-[#eab308]"
  return "text-error"
}

const categoryBadge = (cat: string) => {
  const colors: Record<string, string> = {
    auth: "bg-purple-500/15 text-purple-400",
    database: "bg-blue-500/15 text-blue-400",
    api: "bg-emerald-500/15 text-emerald-400",
    frontend: "bg-cyan-500/15 text-cyan-400",
    infra: "bg-orange-500/15 text-orange-400",
    security: "bg-rose-500/15 text-rose-400",
    general: "bg-slate-500/15 text-slate-400",
  }
  return colors[cat] ?? colors.general
}

export function SpecPanel({
  currentGoal,
  approvedDecisions,
  pendingTasks,
  openConflicts,
  isLocked,
  isGenerating,
  onGenerateCode,
}: SpecPanelProps) {
  return (
    <>
      <div className="p-4 bg-surface-container-highest flex items-center justify-between shadow-sm z-10 w-full shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-node" />
          <h2 className="font-bold text-label-sm uppercase tracking-widest text-on-surface flex items-center gap-2">
            <Focus className="w-4 h-4 text-primary" />
            Living Spec
          </h2>
        </div>
      </div>

      <ScrollArea className="flex-1 w-full bg-surface-container-low">
        <div className="p-6 space-y-10">
          {/* Open Conflicts Warning */}
          {openConflicts > 0 && (
            <div className="px-3 py-2 rounded-sm bg-tertiary/10 border border-tertiary/30 animate-pulse">
              <p className="text-[11px] font-bold uppercase tracking-widest text-tertiary text-center">
                ⚠ {openConflicts} conflict{openConflicts > 1 ? "s" : ""} pending resolution
              </p>
            </div>
          )}

          {/* Goal Section */}
          <section className="space-y-4">
            <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-none bg-primary/80" />
              Current Goal
            </h3>
            <div className="prose prose-sm prose-invert text-body-md text-on-surface leading-loose">
              {currentGoal ? (
                <ReactMarkdown>{currentGoal}</ReactMarkdown>
              ) : (
                <span className="text-outline-variant italic">No goal set yet.</span>
              )}
            </div>
          </section>

          {/* Approved Decisions Section */}
          <section className="space-y-4">
            <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-none bg-[#34d399]/80" />
              Decisions
              {approvedDecisions.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[9px] rounded-sm bg-[#34d399]/20 text-[#34d399] font-bold">
                  {approvedDecisions.length}
                </span>
              )}
            </h3>
            <ul className="space-y-3">
              {approvedDecisions.map((decision) => (
                <li
                  key={decision.id}
                  className="flex gap-3 text-body-md text-on-surface items-start animate-in slide-in-from-right-4 duration-300"
                >
                  <ChevronRight className="w-4 h-4 text-[#34d399] shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{decision.description}</span>
                    <div className="flex gap-2 mt-1">
                      <span
                        className={`text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-sm ${categoryBadge(decision.category)}`}
                      >
                        {decision.category}
                      </span>
                      <span
                        className={`text-[9px] uppercase tracking-widest font-bold ${riskColor(decision.risk_score)}`}
                      >
                        risk {decision.risk_score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
              {approvedDecisions.length === 0 && (
                <li className="text-label-sm text-outline-variant italic uppercase tracking-widest">
                  No decisions approved yet.
                </li>
              )}
            </ul>
          </section>

          {/* Pending Tasks Section */}
          <section className="space-y-4">
            <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-none bg-tertiary/80" />
              Open Tasks
              {pendingTasks.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[9px] rounded-sm bg-tertiary/20 text-tertiary font-bold">
                  {pendingTasks.length}
                </span>
              )}
            </h3>
            <ul className="space-y-3">
              {pendingTasks.map((task, i) => (
                <li
                  key={i}
                  className="flex gap-3 text-body-md text-on-surface-variant items-center"
                >
                  <div className="w-4 h-4 border border-outline-variant rounded-sm shrink-0 bg-surface-container-highest" />
                  <span>{task}</span>
                </li>
              ))}
              {pendingTasks.length === 0 && (
                <li className="text-label-sm text-outline-variant italic uppercase tracking-widest">
                  No tasks pending.
                </li>
              )}
            </ul>
          </section>
        </div>
      </ScrollArea>

      <div className="p-6 bg-surface-container-highest w-full shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-10 relative">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <button
          className={`w-full relative overflow-hidden group py-4 rounded-sm transition-all duration-300 font-bold uppercase tracking-widest text-label-sm flex items-center justify-center gap-3 ${
            isLocked || isGenerating
              ? "bg-surface-container-highest text-outline-variant cursor-not-allowed border border-outline-variant/30"
              : "bg-surface-container-lowest text-primary hover:bg-primary/10 border border-primary/20"
          }`}
          disabled={isLocked || isGenerating}
          onClick={onGenerateCode}
        >
          {!isLocked && !isGenerating && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          )}
          {isGenerating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Brain
              className={`w-5 h-5 ${isLocked ? "opacity-40" : "transition-transform group-hover:scale-110"}`}
            />
          )}
          {isGenerating ? "Starting…" : "Execute Spec"}
        </button>
        {isLocked && (
          <p className="text-[10px] text-center mt-4 text-error font-medium uppercase tracking-widest flex items-center justify-center gap-2">
            <div className="w-1 h-1 rounded-full bg-error animate-pulse-node" />
            Locked (Conflict Pending)
          </p>
        )}
      </div>
    </>
  )
}
