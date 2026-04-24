"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog"
import { AlertTriangle, Download, ShieldCheck } from "lucide-react"

interface RiskAutopsyModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirmExport: () => void
}

export function RiskAutopsyModal({ isOpen, onClose, onConfirmExport }: RiskAutopsyModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl bg-surface-container-low border-0 p-0 shadow-2xl rounded-sm overflow-hidden">
                <DialogHeader className="p-6 bg-surface-container-highest border-b border-surface-dim relative z-10">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-tertiary to-tertiary-container"></div>
                    <div className="flex items-center gap-3 mb-2 mt-2">
                        <div className="p-2 bg-surface-container-low rounded-md relative overflow-hidden group">
                            <ShieldCheck className="w-5 h-5 text-tertiary relative z-10" />
                            <div className="absolute inset-0 bg-tertiary/20 scale-0 group-hover:scale-150 transition-transform duration-500 rounded-full"></div>
                        </div>
                        <DialogTitle className="text-lg font-bold tracking-tight text-on-surface uppercase">Risk Autopsy Report</DialogTitle>
                    </div>
                    <DialogDescription className="text-body-md text-on-surface-variant leading-relaxed">
                        Final review of the ForgeRoom session decisions before exporting the Living Spec.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 bg-surface-dim flex gap-6 items-start">
                    {/* Confidence Score Big Display */}
                    <div className="flex flex-col items-center justify-center bg-surface-container p-6 rounded-md border border-surface-container-highest shrink-0 w-48 shadow-inner">
                        <span className="text-display-lg text-6xl font-black text-tertiary-container drop-shadow-md mb-2">91%</span>
                        <span className="text-label-sm uppercase tracking-widest text-on-surface-variant">Confidence</span>
                    </div>

                    {/* Risk Items */}
                    <div className="flex-1 space-y-4">
                        <div className="p-4 bg-surface-container rounded-sm border border-tertiary/20 flex gap-3 shadow-sm">
                            <AlertTriangle className="w-5 h-5 text-tertiary shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-label-sm font-bold uppercase tracking-wider text-on-surface mb-1">State Management Ambiguity</h4>
                                <p className="text-sm text-on-surface-variant leading-relaxed">
                                    The conflict regarding "React Context vs Zustand" was resolved late in the session. Ensure all subsequent code generation aligns exclusively with Zustand.
                                </p>
                            </div>
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
                        onClick={onConfirmExport}
                        className="relative overflow-hidden group h-12 px-6 rounded-sm flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-label-sm text-on-primary-fixed bg-gradient-to-br from-tertiary to-tertiary-container hover:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(254,177,39,0.2)]"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                        <Download className="w-4 h-4 relative z-10" />
                        <span className="relative z-10">Confirm Export</span>
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
