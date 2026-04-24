"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog"
import { Check, Code2, Clipboard } from "lucide-react"

interface DiffModalProps {
    isOpen: boolean
    onClose: () => void
    diff: string
    onApprove: (updatedDiff: string) => void
}

export function DiffModal({ isOpen, onClose, diff, onApprove }: DiffModalProps) {
    const [editedDiff, setEditedDiff] = useState(diff)

    // A helper to render diff lines with red/green
    const renderDiffColored = () => {
        return editedDiff.split('\n').map((line, i) => {
            if (line.startsWith('+')) {
                return <div key={i} className="text-[#34d399] bg-[#34d399]/5 px-2">{line}</div>
            }
            if (line.startsWith('-')) {
                return <div key={i} className="text-error bg-error/5 px-2">{line}</div>
            }
            if (line.startsWith('@')) {
                return <div key={i} className="text-primary px-2">{line}</div>
            }
            return <div key={i} className="px-2 text-on-surface-variant">{line}</div>
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-surface-container-low border-0 p-0 shadow-2xl rounded-sm gap-0 overflow-hidden">
                <DialogHeader className="p-6 bg-surface-container-highest border-b border-surface-dim relative z-10">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary-container"></div>
                    <div className="flex items-center gap-3 mb-2 mt-2">
                        <div className="p-2 bg-surface-container-low rounded-md relative overflow-hidden group">
                            <Code2 className="w-5 h-5 text-primary relative z-10" />
                            <div className="absolute inset-0 bg-primary/20 scale-0 group-hover:scale-150 transition-transform duration-500 rounded-full"></div>
                        </div>
                        <DialogTitle className="text-lg font-bold tracking-tight text-on-surface uppercase">Approve & Execute Diff</DialogTitle>
                    </div>
                    <DialogDescription className="text-body-md text-on-surface-variant leading-relaxed">
                        Review the generated patch. The agent's code will be exactly as written below.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex overflow-hidden bg-surface-dim relative group">
                    <div className="absolute inset-0 opacity-[0.03] pattern-grid-lg pointer-events-none"></div>

                    <textarea
                        value={editedDiff}
                        onChange={(e) => setEditedDiff(e.target.value)}
                        className="absolute inset-0 opacity-0 z-20 w-full h-full font-mono text-xs p-6 resize-none"
                        spellCheck={false}
                    />

                    {/* Visual Overlay since textarea is transparent but interactive above */}
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
                            className="text-label-sm font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
                        >
                            Abort
                        </button>
                        <button
                            onClick={() => onApprove(editedDiff)}
                            className="relative overflow-hidden group h-12 px-6 rounded-sm flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-label-sm text-on-primary-fixed bg-gradient-to-br from-primary to-primary-container hover:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(0,209,255,0.2)]"
                        >
                            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                            <Check className="w-4 h-4 relative z-10" />
                            <span className="relative z-10">Execute Patch</span>
                        </button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
