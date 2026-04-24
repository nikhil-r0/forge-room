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
import { Check, Code2, Clipboard, Loader2 } from "lucide-react"
import { applyDiff } from "@/lib/api"
import { toast } from "sonner"

interface DiffModalProps {
  isOpen: boolean
  onClose: () => void
  diff: string
  onApprove: (commitHash: string | null) => void
}

type ApplyStep = "idle" | "applying" | "committing" | "pushing" | "done"

export function DiffModal({ isOpen, onClose, diff, onApprove }: DiffModalProps) {
  const [editedDiff, setEditedDiff] = useState(diff)
  const [step, setStep] = useState<ApplyStep>("idle")
  const [commitHash, setCommitHash] = useState<string | null>(null)

  // Sync editedDiff when diff prop changes
  if (diff !== editedDiff && step === "idle") {
    setEditedDiff(diff)
  }

  const renderDiffColored = () => {
    return editedDiff.split("\n").map((line, i) => {
      if (line.startsWith("+")) {
        return (
          <div key={i} className="text-[#34d399] bg-[#34d399]/5 px-2">
            {line}
          </div>
        )
      }
      if (line.startsWith("-")) {
        return (
          <div key={i} className="text-error bg-error/5 px-2">
            {line}
          </div>
        )
      }
      if (line.startsWith("@")) {
        return (
          <div key={i} className="text-primary px-2">
            {line}
          </div>
        )
      }
      return (
        <div key={i} className="px-2 text-on-surface-variant">
          {line}
        </div>
      )
    })
  }

  const handleApprove = async () => {
    setStep("applying")
    try {
      await new Promise((r) => setTimeout(r, 600))
      setStep("committing")
      const result = await applyDiff(
        editedDiff,
        "Approved architectural diff from ForgeRoom",
        false
      )
      setCommitHash(result.commit_hash)
      setStep("done")
      toast.success("Code Applied", {
        description: `Committed: ${result.commit_hash ?? "success"}`,
      })
      setTimeout(() => {
        onApprove(result.commit_hash)
        setStep("idle")
        setCommitHash(null)
      }, 1500)
    } catch (err) {
      toast.error("Apply Failed", { description: String(err) })
      setStep("idle")
    }
  }

  const stepLabels: Record<ApplyStep, string> = {
    idle: "",
    applying: "Applying diff…",
    committing: "Committing changes…",
    pushing: "Pushing to remote…",
    done: `Done ✓ ${commitHash ?? ""}`,
  }

  return (
    <Dialog open={isOpen} onOpenChange={step === "idle" ? onClose : undefined}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-surface-container-low border-0 p-0 shadow-2xl rounded-sm gap-0 overflow-hidden">
        <DialogHeader className="p-6 bg-surface-container-highest border-b border-surface-dim relative z-10">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary-container" />
          <div className="flex items-center gap-3 mb-2 mt-2">
            <div className="p-2 bg-surface-container-low rounded-md relative overflow-hidden group">
              <Code2 className="w-5 h-5 text-primary relative z-10" />
              <div className="absolute inset-0 bg-primary/20 scale-0 group-hover:scale-150 transition-transform duration-500 rounded-full" />
            </div>
            <DialogTitle className="text-lg font-bold tracking-tight text-on-surface uppercase">
              Approve & Execute Diff
            </DialogTitle>
          </div>
          <DialogDescription className="text-body-md text-on-surface-variant leading-relaxed">
            Review the generated patch. Edit if needed, then approve to commit.
          </DialogDescription>
        </DialogHeader>

        {/* Progress stepper */}
        {step !== "idle" && (
          <div className="px-6 py-3 bg-primary/5 border-b border-primary/10 flex items-center gap-3">
            {step !== "done" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            {step === "done" && <Check className="w-4 h-4 text-[#34d399]" />}
            <span className="text-label-sm font-bold uppercase tracking-widest text-primary">
              {stepLabels[step]}
            </span>
            {commitHash && step === "done" && (
              <span className="ml-auto text-[10px] font-mono bg-[#34d399]/10 text-[#34d399] px-2 py-0.5 rounded-sm">
                {commitHash}
              </span>
            )}
          </div>
        )}

        <div className="flex-1 flex overflow-hidden bg-surface-dim relative group">
          <div className="absolute inset-0 opacity-[0.03] pattern-grid-lg pointer-events-none" />

          <textarea
            value={editedDiff}
            onChange={(e) => setEditedDiff(e.target.value)}
            className="absolute inset-0 opacity-0 z-20 w-full h-full font-mono text-xs p-6 resize-none"
            spellCheck={false}
            disabled={step !== "idle"}
          />

          <div className="w-full h-full font-mono text-xs p-6 overflow-y-auto whitespace-pre z-10 selection:bg-primary/30">
            {renderDiffColored()}
          </div>
        </div>

        <DialogFooter className="p-6 bg-surface-container-highest border-t border-surface-dim flex justify-between items-center sm:justify-between w-full relative z-10">
          <button
            onClick={() => navigator.clipboard.writeText(editedDiff)}
            className="flex items-center gap-2 h-10 px-4 rounded-sm text-label-sm font-semibold uppercase tracking-widest text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all"
          >
            <Clipboard className="w-4 h-4" />
            Copy Raw
          </button>
          <div className="flex gap-4 items-center">
            <button
              onClick={onClose}
              disabled={step !== "idle"}
              className="text-label-sm font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-40"
            >
              Abort
            </button>
            <button
              onClick={handleApprove}
              disabled={step !== "idle"}
              className="relative overflow-hidden group h-12 px-6 rounded-sm flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-label-sm text-on-primary-fixed bg-gradient-to-br from-primary to-primary-container hover:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(0,209,255,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <Check className="w-4 h-4 relative z-10" />
              <span className="relative z-10">Execute Patch</span>
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
