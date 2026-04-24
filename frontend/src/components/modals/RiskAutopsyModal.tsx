"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { AlertTriangle, Download, ShieldCheck } from "lucide-react"
import ReactMarkdown from "react-markdown"

interface RiskAutopsyModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirmExport: () => void
  riskAutopsyMarkdown: string
  exportMarkdown: string
  roomId: string
}

export function RiskAutopsyModal({
  isOpen,
  onClose,
  onConfirmExport,
  riskAutopsyMarkdown,
  exportMarkdown,
  roomId,
}: RiskAutopsyModalProps) {
  // Parse confidence score from markdown
  const confidenceMatch = riskAutopsyMarkdown.match(/Confidence Score:\s*(\d+)/i)
  const confidence = confidenceMatch ? parseInt(confidenceMatch[1], 10) : 85

  const handleDownload = () => {
    const blob = new Blob([exportMarkdown], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `forgeroom-session-${roomId}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    onConfirmExport()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col bg-surface-container-low border-0 p-0 shadow-2xl rounded-sm overflow-hidden">
        <DialogHeader className="p-6 bg-surface-container-highest border-b border-surface-dim relative z-10">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-tertiary to-tertiary-container" />
          <div className="flex items-center gap-3 mb-2 mt-2">
            <div className="p-2 bg-surface-container-low rounded-md relative overflow-hidden group">
              <ShieldCheck className="w-5 h-5 text-tertiary relative z-10" />
              <div className="absolute inset-0 bg-tertiary/20 scale-0 group-hover:scale-150 transition-transform duration-500 rounded-full" />
            </div>
            <DialogTitle className="text-lg font-bold tracking-tight text-on-surface uppercase">
              Risk Autopsy Report
            </DialogTitle>
          </div>
          <DialogDescription className="text-body-md text-on-surface-variant leading-relaxed">
            Final review of session decisions before exporting.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-surface-dim">
          <div className="flex gap-6 items-start">
            {/* Confidence Score */}
            <div className="flex flex-col items-center justify-center bg-surface-container p-6 rounded-md border border-surface-container-highest shrink-0 w-48 shadow-inner">
              <span
                className={`text-6xl font-black drop-shadow-md mb-2 ${
                  confidence >= 70
                    ? "text-[#34d399]"
                    : confidence >= 50
                      ? "text-tertiary-container"
                      : "text-error"
                }`}
              >
                {confidence}%
              </span>
              <span className="text-label-sm uppercase tracking-widest text-on-surface-variant">
                Confidence
              </span>
            </div>

            {/* Risk autopsy content */}
            <div className="flex-1 prose prose-sm prose-invert max-w-none text-on-surface">
              {riskAutopsyMarkdown ? (
                <ReactMarkdown>{riskAutopsyMarkdown}</ReactMarkdown>
              ) : (
                <div className="p-4 bg-surface-container rounded-sm border border-tertiary/20 flex gap-3 shadow-sm">
                  <AlertTriangle className="w-5 h-5 text-tertiary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-label-sm font-bold uppercase tracking-wider text-on-surface mb-1">
                      No Risk Data
                    </h4>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      No decisions have been made yet. The risk autopsy will be generated after architectural decisions are recorded.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-surface-container-highest border-t border-surface-dim flex justify-end items-center gap-4 relative z-10">
          <button
            onClick={onClose}
            className="text-label-sm font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Review Chat
          </button>
          <button
            onClick={handleDownload}
            className="relative overflow-hidden group h-12 px-6 rounded-sm flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-label-sm text-on-primary-fixed bg-gradient-to-br from-tertiary to-tertiary-container hover:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(254,177,39,0.2)]"
          >
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            <Download className="w-4 h-4 relative z-10" />
            <span className="relative z-10">Download Report</span>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
