"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Check, Code2, Loader2, GitCommit, Rocket, Terminal } from "lucide-react"
import { executeSpec } from "@/lib/api"
import { useRoomStore } from "@/lib/useRoomStore"
import { toast } from "sonner"
import type { DecisionPayload, SkillPayload } from "@/lib/types"

interface ExecutionModalProps {
  isOpen: boolean
  onClose: () => void
  specMarkdown: string
  approvedDecisions: DecisionPayload[]
  activeSkills: SkillPayload[]
  onSuccess: (summary: string) => void
}

type ExecutionStatus = "idle" | "running" | "success" | "error"

export function ExecutionModal({ 
  isOpen, 
  onClose, 
  specMarkdown, 
  approvedDecisions,
  activeSkills,
  onSuccess 
}: ExecutionModalProps) {
  const roomId = useRoomStore((s) => s.roomId)
  const [status, setStatus] = useState<ExecutionStatus>("idle")
  const [commitMessage, setCommitMessage] = useState("Implement approved architecture specification")
  const [push, setPush] = useState(false)
  const [summary, setSummary] = useState("")

  const handleRun = async () => {
    if (!roomId) {
      toast.error("No active room ID found")
      return
    }
    setStatus("running")
    try {
      const result = await executeSpec(roomId, specMarkdown, approvedDecisions, activeSkills, commitMessage, push)
      setSummary(result.summary)
      setStatus("success")
      toast.success("Changes Applied Successfully")
    } catch (err) {
      toast.error("Execution Failed", { description: String(err) })
      setStatus("error")
    }
  }

  const handleClose = () => {
    if (status === "running") return
    if (status === "success") {
      onSuccess(summary)
    }
    setStatus("idle")
    setSummary("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col bg-surface-container-low border-0 p-0 shadow-2xl rounded-sm overflow-hidden animate-in fade-in zoom-in duration-300">
        <DialogHeader className="p-6 bg-surface-container-highest border-b border-surface-dim relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-tertiary to-primary-container animate-shimmer" />
          
          <div className="flex items-center gap-4 mt-2">
            <div className="p-2.5 bg-primary/10 rounded-md relative group">
              <Rocket className="w-6 h-6 text-primary relative z-10" />
              <div className="absolute inset-0 bg-primary/20 scale-0 group-hover:scale-150 transition-transform duration-700 rounded-full" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-on-surface uppercase italic">
                Execution Engine
              </DialogTitle>
              <DialogDescription className="text-body-md text-on-surface-variant font-medium">
                Implementing architecture into the codebase via Gemini CLI.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-surface-dim">
          {status === "idle" || status === "error" ? (
            <div className="space-y-6">
              <div className="p-4 bg-surface-container-highest rounded-sm border border-outline-variant/30">
                <div className="flex items-center gap-2 mb-3">
                  <GitCommit className="w-4 h-4 text-primary" />
                  <span className="text-label-sm font-bold uppercase tracking-widest text-on-surface-variant">
                    Git Configuration
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-outline-variant font-bold mb-1.5 block">
                      Commit Message
                    </label>
                    <input 
                      type="text"
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-sm px-3 py-2 text-body-md focus:border-primary/50 focus:outline-none transition-all"
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder="Implementing spec..."
                    />
                  </div>
                  <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setPush(!push)}>
                    <div className={`w-8 h-4 rounded-full relative transition-colors ${push ? 'bg-primary' : 'bg-surface-container-highest'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${push ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-label-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
                      Push to remote after commit
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-surface-container-low/50 rounded-sm border border-dashed border-outline-variant/30 opacity-60">
                <p className="text-body-sm text-center italic">
                  This will read your current codebase, generate the necessary changes to match the specification, apply the diffs, and create a git commit.
                </p>
              </div>
            </div>
          ) : status === "running" ? (
            <div className="h-64 flex flex-col items-center justify-center gap-6">
              <div className="relative">
                <Loader2 className="w-16 h-16 animate-spin text-primary opacity-20" />
                <Rocket className="absolute inset-0 m-auto w-8 h-8 text-primary animate-pulse" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-lg font-bold text-on-surface uppercase tracking-widest animate-pulse">
                  Reasoning & Executing...
                </h3>
                <p className="text-body-sm text-on-surface-variant max-w-xs">
                  Gemini is analyzing the repository and performing structural modifications.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center gap-2 mb-2">
                  <Terminal className="w-4 h-4 text-primary" />
                  <span className="text-label-sm font-bold uppercase tracking-widest text-tertiary">
                    Execution Summary
                  </span>
                </div>
                <div className="p-6 bg-[#0c0c0c] rounded-md font-mono text-xs leading-relaxed text-[#00ff9f] border border-primary/20 shadow-inner overflow-x-auto whitespace-pre-wrap max-h-96">
                   {summary}
                </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 bg-surface-container-highest border-t border-surface-dim flex justify-between items-center sm:justify-between w-full">
          <button
            onClick={handleClose}
            className="text-label-sm font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
          >
            {status === "success" ? "Back to Room" : "Cancel"}
          </button>
          
          {status !== "success" && (
            <button
              onClick={handleRun}
              disabled={status === "running"}
              className="relative overflow-hidden group h-12 px-8 rounded-sm flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-label-sm text-on-primary-fixed bg-gradient-to-br from-primary to-primary-container hover:scale-[0.98] transition-transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              < Rocket className="w-4 h-4 relative z-10" />
              <span className="relative z-10">
                {status === "running" ? "Executing..." : "Apply Changes"}
              </span>
            </button>
          )}

          {status === "success" && (
            <button
              onClick={handleClose}
              className="h-10 px-6 rounded-sm flex items-center gap-2 font-bold uppercase tracking-widest text-label-sm text-on-primary bg-primary hover:bg-primary-hover shadow-md"
            >
              <Check className="w-4 h-4" />
              Done
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
