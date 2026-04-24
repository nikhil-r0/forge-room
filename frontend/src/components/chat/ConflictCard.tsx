"use client"

import { useState } from "react"
import { AlertCircle } from "lucide-react"
import { castVote } from "@/lib/api"
import { useRoomStore } from "@/lib/useRoomStore"
import type { ConflictPayload, VoteChoice } from "@/lib/types"
import { toast } from "sonner"

interface ConflictCardProps {
  conflict: ConflictPayload
}

export function ConflictCard({ conflict }: ConflictCardProps) {
  const { roomId, displayName } = useRoomStore()
  const [voting, setVoting] = useState(false)
  const myVote = conflict.votes[displayName] ?? null
  const voteCountA = Object.values(conflict.votes).filter((v) => v === "a").length
  const voteCountB = Object.values(conflict.votes).filter((v) => v === "b").length
  const totalVoters = Object.keys(conflict.votes).length

  const handleVote = async (option: VoteChoice) => {
    if (myVote || !roomId || voting) return
    setVoting(true)
    try {
      await castVote(roomId, conflict.conflict_id, displayName, option)
    } catch (err) {
      toast.error("Vote failed", { description: String(err) })
    } finally {
      setVoting(false)
    }
  }

  return (
    <div className="my-6 relative overflow-hidden rounded-md bg-tertiary-container/10 shadow-[0_0_20px_rgba(254,177,39,0.05)] before:absolute before:inset-0 before:ring-1 before:ring-tertiary-container/30 before:rounded-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-tertiary-container to-transparent opacity-50" />

      <div className="p-4 border-b border-tertiary-container/10 bg-tertiary-container/5 relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-tertiary-container animate-pulse-node shadow-[0_0_8px_rgba(254,177,39,0.8)]" />
          <AlertCircle className="w-4 h-4 text-tertiary-container" />
          <h3 className="text-label-sm font-bold uppercase tracking-widest text-tertiary-container">
            {conflict.resolved ? "Conflict Resolved" : "Conflict Detected"}
          </h3>
          {conflict.resolved && conflict.winner && (
            <span className="ml-auto text-[10px] uppercase tracking-widest text-tertiary bg-tertiary/10 px-2 py-0.5 rounded-sm font-bold">
              Winner: Option {conflict.winner.toUpperCase()}
            </span>
          )}
        </div>
        <p className="text-body-md text-on-surface leading-loose">
          {conflict.summary}
        </p>
      </div>

      <div className="p-4 grid grid-cols-2 gap-4 relative z-10">
        <button
          className={`relative p-4 rounded-sm flex flex-col gap-3 justify-start items-start text-left transition-all overflow-hidden border ${
            myVote === "a" || (conflict.resolved && conflict.winner === "a")
              ? "border-tertiary-container bg-tertiary-container/10"
              : "border-tertiary-container/20 bg-surface-container-lowest hover:bg-tertiary-container/5"
          }`}
          onClick={() => handleVote("a")}
          disabled={myVote !== null || conflict.resolved || voting}
        >
          <div
            className="absolute bottom-0 left-0 h-1 bg-tertiary-container transition-all duration-500"
            style={{ width: totalVoters > 0 ? `${(voteCountA / Math.max(totalVoters, 1)) * 100}%` : "0%" }}
          />
          <span className="text-body-md font-medium text-on-surface">
            {conflict.option_a}
          </span>
          <span className="text-label-sm text-tertiary uppercase tracking-widest">
            {voteCountA} Vote{voteCountA !== 1 ? "s" : ""}
          </span>
        </button>

        <button
          className={`relative p-4 rounded-sm flex flex-col gap-3 justify-start items-start text-left transition-all overflow-hidden border ${
            myVote === "b" || (conflict.resolved && conflict.winner === "b")
              ? "border-tertiary-container bg-tertiary-container/10"
              : "border-tertiary-container/20 bg-surface-container-lowest hover:bg-tertiary-container/5"
          }`}
          onClick={() => handleVote("b")}
          disabled={myVote !== null || conflict.resolved || voting}
        >
          <div
            className="absolute bottom-0 left-0 h-1 bg-tertiary-container transition-all duration-500"
            style={{ width: totalVoters > 0 ? `${(voteCountB / Math.max(totalVoters, 1)) * 100}%` : "0%" }}
          />
          <span className="text-body-md font-medium text-on-surface">
            {conflict.option_b}
          </span>
          <span className="text-label-sm text-tertiary uppercase tracking-widest">
            {voteCountB} Vote{voteCountB !== 1 ? "s" : ""}
          </span>
        </button>
      </div>

      <div className="bg-tertiary-container/5 py-3 text-center border-t border-tertiary-container/10 relative z-10">
        <p className="text-[10px] text-tertiary-container/70 font-medium uppercase tracking-widest">
          {conflict.resolved
            ? `Resolved — ${totalVoters} vote${totalVoters !== 1 ? "s" : ""} cast`
            : `${totalVoters} vote${totalVoters !== 1 ? "s" : ""} cast`}
        </p>
      </div>
    </div>
  )
}
