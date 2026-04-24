"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight, Terminal, Zap, Shield, GitBranch, Loader2 } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle"
import { createRoom } from "@/lib/api"
import { useRoomStore } from "@/lib/useRoomStore"
import { toast } from "sonner"

export default function Home() {
  const [name, setName] = useState("")
  const [goal, setGoal] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const setRoom = useRoomStore((s) => s.setRoom)

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      const { room_id } = await createRoom(goal.trim() || "No goal set yet")
      setRoom(room_id, name.trim())
      router.push(`/room/${room_id}?name=${encodeURIComponent(name.trim())}`)
    } catch (err) {
      toast.error("Failed to create room", { description: String(err) })
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-surface flex flex-col items-center justify-center p-4 sm:p-24 overflow-hidden transition-colors duration-500">
      {/* Theme Toggle */}
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Ambient Background */}
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
        <div className="w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] mix-blend-screen opacity-50 dark:opacity-100" />
      </div>
      <div className="absolute top-1/4 right-1/4 z-0 pointer-events-none">
        <div className="w-[400px] h-[400px] bg-tertiary/5 rounded-full blur-[100px] opacity-0 dark:opacity-60" />
      </div>

      {/* Central Card */}
      <div className="relative z-10 w-full max-w-md bg-surface-container-low border border-surface-container-high p-8 sm:p-12 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-1000">
        {/* Header */}
        <div className="flex flex-col items-center mb-10">
          <div className="group relative w-16 h-16 bg-gradient-to-tr from-primary to-primary-container rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-primary/20 rotate-3 hover:rotate-6 transition-transform duration-500">
            <Terminal className="w-8 h-8 text-on-primary-fixed" />
            <div className="absolute inset-0 bg-white/20 blur-xl scale-0 group-hover:scale-150 transition-transform duration-700 rounded-full" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface text-center mb-2">
            ForgeRoom
          </h1>
          <p className="text-body-md text-on-surface-variant text-center">
            AI-powered collaborative architecture decisions.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleCreateRoom} className="flex flex-col gap-5">
          <div className="space-y-2">
            <label className="text-label-sm font-bold uppercase tracking-widest text-on-surface-variant ml-1">
              Display Name
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-primary-container rounded-lg blur opacity-0 group-hover:opacity-30 transition duration-500" />
              <Input
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="relative h-14 bg-surface-container-lowest border-surface-container-high text-on-surface placeholder:text-on-surface-variant/40 rounded-lg px-5 focus-visible:ring-1 focus-visible:ring-primary shadow-inner text-body-md transition-all font-medium"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-label-sm font-bold uppercase tracking-widest text-on-surface-variant ml-1">
              Project Goal <span className="text-outline-variant font-normal">(optional)</span>
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-tertiary to-tertiary-container rounded-lg blur opacity-0 group-hover:opacity-20 transition duration-500" />
              <Input
                placeholder="e.g., Build user authentication system"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="relative h-14 bg-surface-container-lowest border-surface-container-high text-on-surface placeholder:text-on-surface-variant/40 rounded-lg px-5 focus-visible:ring-1 focus-visible:ring-tertiary shadow-inner text-body-md transition-all font-medium"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={!name.trim() || loading}
            className="relative overflow-hidden group h-14 rounded-lg w-full flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-label-sm shadow-[0_0_40px_rgba(0,209,255,0.15)] text-on-primary-fixed bg-gradient-to-br from-primary to-primary-container hover:scale-[0.98] transition-all disabled:opacity-50"
          >
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            {loading ? (
              <Loader2 className="w-4 h-4 relative z-10 animate-spin" />
            ) : (
              <>
                <span className="relative z-10">Create ForgeRoom</span>
                <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Feature highlights */}
      <div className="relative z-10 mt-12 grid grid-cols-3 gap-6 max-w-lg">
        {[
          { icon: Zap, label: "AI Supervisor", desc: "Real-time conflict detection" },
          { icon: Shield, label: "Drift Detection", desc: "Code vs. spec monitoring" },
          { icon: GitBranch, label: "Blame Graph", desc: "Decision dependency map" },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex flex-col items-center text-center gap-2">
            <div className="p-2 bg-surface-container-low rounded-md border border-surface-container-high">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <span className="text-[10px] uppercase tracking-widest text-on-surface font-bold">{label}</span>
            <span className="text-[9px] text-on-surface-variant">{desc}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-label-sm text-on-surface-variant tracking-widest uppercase opacity-40">
        Athernex • ForgeRoom
      </div>
    </div>
  )
}
