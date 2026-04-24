"use client"

import { useState } from "react"
import { AlertCircle } from "lucide-react"

interface ConflictCardProps {
    summary: string
    optionA: string
    optionB: string
    onResolve: (decision: string) => void
}

export function ConflictCard({ summary, optionA, optionB, onResolve }: ConflictCardProps) {
    const [votes, setVotes] = useState({ a: 0, b: 0 })
    const [voted, setVoted] = useState<string | null>(null)

    const handleVote = (option: 'a' | 'b') => {
        if (voted) return
        setVotes(prev => ({ ...prev, [option]: prev[option] + 1 }))
        setVoted(option)
    }

    const totalVotes = 2
    const currentTotal = votes.a + votes.b

    // Simulate resolution once 2 votes are reached
    if (currentTotal === totalVotes && voted) {
        setTimeout(() => onResolve(votes.a > votes.b ? 'a' : 'b'), 500)
    }

    return (
        <div className="my-6 relative overflow-hidden rounded-md bg-tertiary-container/10 shadow-[0_0_20px_rgba(254,177,39,0.05)] before:absolute before:inset-0 before:ring-1 before:ring-tertiary-container/30 before:rounded-md animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-tertiary-container to-transparent opacity-50"></div>

            <div className="p-4 border-b border-tertiary-container/10 bg-tertiary-container/5 relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-tertiary-container animate-pulse-node shadow-[0_0_8px_rgba(254,177,39,0.8)]"></div>
                    <AlertCircle className="w-4 h-4 text-tertiary-container" />
                    <h3 className="text-label-sm font-bold uppercase tracking-widest text-tertiary-container">Conflict Detected</h3>
                </div>
                <p className="text-body-md text-on-surface leading-loose">
                    {summary}
                </p>
            </div>

            <div className="p-4 grid grid-cols-2 gap-4 relative z-10">
                <button
                    className={`relative p-4 rounded-sm flex flex-col gap-3 justify-start items-start text-left transition-all overflow-hidden border ${voted === 'a'
                            ? "border-tertiary-container bg-tertiary-container/10"
                            : "border-tertiary-container/20 bg-surface-container-lowest hover:bg-tertiary-container/5"
                        }`}
                    onClick={() => handleVote('a')}
                    disabled={voted !== null}
                >
                    <div className={`absolute bottom-0 left-0 h-1 bg-tertiary-container transition-all duration-500`} style={{ width: `${(votes.a / totalVotes) * 100}%` }}></div>
                    <span className="text-body-md font-medium text-on-surface">{optionA}</span>
                    <span className="text-label-sm text-tertiary uppercase tracking-widest">{votes.a} Votes</span>
                </button>

                <button
                    className={`relative p-4 rounded-sm flex flex-col gap-3 justify-start items-start text-left transition-all overflow-hidden border ${voted === 'b'
                            ? "border-tertiary-container bg-tertiary-container/10"
                            : "border-tertiary-container/20 bg-surface-container-lowest hover:bg-tertiary-container/5"
                        }`}
                    onClick={() => handleVote('b')}
                    disabled={voted !== null}
                >
                    <div className={`absolute bottom-0 left-0 h-1 bg-tertiary-container transition-all duration-500`} style={{ width: `${(votes.b / totalVotes) * 100}%` }}></div>
                    <span className="text-body-md font-medium text-on-surface">{optionB}</span>
                    <span className="text-label-sm text-tertiary uppercase tracking-widest">{votes.b} Votes</span>
                </button>
            </div>

            <div className="bg-tertiary-container/5 py-3 text-center border-t border-tertiary-container/10 relative z-10">
                <p className="text-[10px] text-tertiary-container/70 font-medium uppercase tracking-widest">
                    Requirement: {currentTotal}/{totalVotes} Humans Voted
                </p>
            </div>
        </div>
    )
}
