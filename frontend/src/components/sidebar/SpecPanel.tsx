"use client"

import ReactMarkdown from "react-markdown"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Brain, Zap, ChevronRight, Focus } from "lucide-react"

interface SpecPanelProps {
    state: {
        goal: string
        decisions: string[]
        tasks: string[]
    }
    onGenerateCode: () => void
    isLocked: boolean
}

export function SpecPanel({ state, onGenerateCode, isLocked }: SpecPanelProps) {
    return (
        <>
            <div className="p-4 bg-surface-container-highest flex items-center justify-between shadow-sm z-10 w-full shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-node"></div>
                    <h2 className="font-bold text-label-sm uppercase tracking-widest text-on-surface flex items-center gap-2">
                        <Focus className="w-4 h-4 text-primary" />
                        Living Spec
                    </h2>
                </div>
            </div>

            <ScrollArea className="flex-1 w-full bg-surface-container-low">
                <div className="p-6 space-y-10">
                    {/* Goal Section */}
                    <section className="space-y-4">
                        <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-none bg-primary/80" />
                            Current Goal
                        </h3>
                        <div className="prose prose-sm prose-invert text-body-md text-on-surface leading-loose">
                            <ReactMarkdown>
                                {state.goal}
                            </ReactMarkdown>
                        </div>
                    </section>

                    {/* Approved Decisions Section */}
                    <section className="space-y-4">
                        <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-none bg-[#34d399]/80" />
                            Approved Decisions
                        </h3>
                        <ul className="space-y-3">
                            {state.decisions.map((decision, i) => (
                                <li key={i} className="flex gap-3 text-body-md text-on-surface items-center">
                                    <ChevronRight className="w-4 h-4 text-[#34d399] shrink-0" />
                                    <span>{decision}</span>
                                </li>
                            ))}
                            {state.decisions.length === 0 && (
                                <li className="text-label-sm text-outline-variant italic uppercase tracking-widest">No decisions approved yet.</li>
                            )}
                        </ul>
                    </section>

                    {/* Pending Tasks Section */}
                    <section className="space-y-4">
                        <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-none bg-tertiary/80" />
                            Pending Tasks
                        </h3>
                        <ul className="space-y-3">
                            {state.tasks.map((task, i) => (
                                <li key={i} className="flex gap-3 text-body-md text-on-surface-variant items-center">
                                    <div className="w-4 h-4 border border-outline-variant rounded-sm shrink-0 bg-surface-container-highest" />
                                    <span>{task}</span>
                                </li>
                            ))}
                            {state.tasks.length === 0 && (
                                <li className="text-label-sm text-outline-variant italic uppercase tracking-widest">No tasks pending.</li>
                            )}
                        </ul>
                    </section>
                </div>
            </ScrollArea>

            <div className="p-6 bg-surface-container-highest w-full shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-10 relative">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
                <button
                    className={`w-full relative overflow-hidden group py-4 rounded-sm transition-all duration-300 font-bold uppercase tracking-widest text-label-sm flex items-center justify-center gap-3 ${isLocked
                            ? "bg-surface-container-highest text-outline-variant cursor-not-allowed border border-outline-variant/30"
                            : "bg-surface-container-lowest text-primary hover:bg-primary/10 border border-primary/20"
                        }`}
                    disabled={isLocked}
                    onClick={onGenerateCode}
                >
                    {!isLocked && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>}
                    <Brain className={`w-5 h-5 ${isLocked ? "opacity-40" : "transition-transform group-hover:scale-110"}`} />
                    Generate Code
                </button>
                {isLocked && (
                    <p className="text-[10px] text-center mt-4 text-error font-medium uppercase tracking-widest flex items-center justify-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-error animate-pulse-node"></div>
                        Locked (Conflict Pending)
                    </p>
                )}
            </div>
        </>
    )
}
