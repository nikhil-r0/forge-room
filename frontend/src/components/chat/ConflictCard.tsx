"use client"

import { useState } from "react"
import { AlertCircle, Gavel } from "lucide-react"
import { castVote, resolveConflict } from "@/lib/api"
import { useRoomStore } from "@/lib/useRoomStore"
import type { ConflictPayload, VoteChoice } from "@/lib/types"
import { toast } from "sonner"

interface ConflictCardProps {
  conflict: ConflictPayload
}

export function ConflictCard({ conflict }: ConflictCardProps) {
  const { roomId, currentUser } = useRoomStore()
  const [voting, setVoting] = useState(false)
  
  const myVote = currentUser ? conflict.votes[currentUser.user_id] ?? null : null
  const voteCountA = conflict.votes_tally["a"] || 0
  const voteCountB = conflict.votes_tally["b"] || 0
  const totalVoters = voteCountA + voteCountB

  const handleVote = async (option: VoteChoice) => {
    if (!currentUser || myVote || !roomId || voting) return
    setVoting(true)
    try {
      await castVote(roomId, conflict.conflict_id, currentUser.user_id, option)
    } catch (err) {
      toast.error("Vote failed", { description: String(err) })
    } finally {
      setVoting(false)
    }
  }

  const handleResolve = async (option: "a" | "b") => {
    if (!currentUser || currentUser.role !== "manager" || !roomId || voting) return
    setVoting(true)
    try {
      await resolveConflict(roomId, conflict.conflict_id, option)
      toast.success(`Conflict Override Applied`, { description: `Option ${option.toUpperCase()} finalized.`})
    } catch (err) {
      toast.error("Override failed", { description: String(err) })
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

      <div className="bg-tertiary-container/5 py-3 px-4 border-t border-tertiary-container/10 relative z-10 flex items-center justify-between">
        <p className="text-[10px] text-tertiary-container/70 font-medium uppercase tracking-widest">
          {conflict.resolved
            ? `Resolved — ${totalVoters} vote${totalVoters !== 1 ? "s" : ""} cast`
            : `${totalVoters} vote${totalVoters !== 1 ? "s" : ""} cast`}
        </p>

        {/* Manager Override Controls */}
        {!conflict.resolved && (
          <div className="flex items-center gap-2">
            <button
              disabled={currentUser?.role !== "manager" || voting}
              onClick={() => handleResolve("a")}
              className="px-3 py-1 flex items-center gap-1.5 rounded-sm bg-tertiary-container/10 border border-tertiary-container/30 hover:border-tertiary-container/80 text-[10px] font-bold uppercase tracking-widest text-tertiary-container transition-colors disabled:opacity-40"
              title={currentUser?.role !== "manager" ? "Manager Access Required" : "Force Option A"}
            >
              <Gavel className="w-3 h-3" /> A
            </button>
            <button
              disabled={currentUser?.role !== "manager" || voting}
              onClick={() => handleResolve("b")}
              className="px-3 py-1 flex items-center gap-1.5 rounded-sm bg-tertiary-container/10 border border-tertiary-container/30 hover:border-tertiary-container/80 text-[10px] font-bold uppercase tracking-widest text-tertiary-container transition-colors disabled:opacity-40"
              title={currentUser?.role !== "manager" ? "Manager Access Required" : "Force Option B"}
            >
              <Gavel className="w-3 h-3" /> B
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
