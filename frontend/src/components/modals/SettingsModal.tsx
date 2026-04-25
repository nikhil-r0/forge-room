"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Settings as SettingsIcon, Loader2, Sparkles, Users, Shield } from "lucide-react"
import { updateRoomSettings, updateUserRole } from "@/lib/api"
import { useRoomStore } from "@/lib/useRoomStore"

export function SettingsModal({ roomId }: { roomId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const roomFocusMode = useRoomStore((s) => s.focusMode)
  const participants = useRoomStore((s) => s.participants)
  const creatorId = useRoomStore((s) => s.creatorId)
  const [repoPath, setRepoPath] = useState("")
  const [focusMode, setFocusMode] = useState(roomFocusMode)
  const [loading, setLoading] = useState(false)
  const [promotingId, setPromotingId] = useState<string | null>(null)
  const currentUser = useRoomStore((s) => s.currentUser)

  if (currentUser?.role !== "manager") return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await updateRoomSettings(roomId, repoPath || undefined, focusMode)
      toast.success("Settings updated!")
      setIsOpen(false)
    } catch (err) {
      toast.error("Update failed", { description: String(err) })
    } finally {
      setLoading(false)
    }
  }

  const handlePromote = async (userId: string) => {
    setPromotingId(userId)
    try {
      await updateUserRole(userId, "manager")
      toast.success("Member promoted to Manager!")
      // Local state update if needed, but snapshot usually handles it
    } catch (err) {
      toast.error("Promotion failed", { description: String(err) })
    } finally {
      setPromotingId(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 h-8 px-4 rounded-sm text-label-sm font-semibold uppercase tracking-widest text-on-surface-variant bg-surface-container-low hover:text-on-surface hover:bg-surface-container transition-all">
          <SettingsIcon className="w-3.5 h-3.5" />
          Config
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl bg-surface-container border-surface-container-high shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 bg-surface-container-lowest border-b border-surface-container-high">
          <DialogTitle className="text-xl font-bold tracking-tight text-on-surface flex items-center gap-2 uppercase">
            <SettingsIcon className="w-5 h-5 text-primary" />
            Arena Configuration
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-surface-container-high">
          {/* Main Settings */}
          <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-6">
            <div className="space-y-4">
               <div className="space-y-2">
                <label className="text-label-sm font-bold uppercase tracking-widest text-on-surface-variant">
                   Storage Repository
                </label>
                <Input
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  placeholder="/mount/shared/codebase"
                  className="bg-surface-container-highest border-primary/10 focus:border-primary transition-all font-mono text-xs"
                />
              </div>

              <div className="p-4 rounded-md bg-surface-container-highest border border-primary/5 flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-label-sm font-bold uppercase tracking-widest text-on-surface">AI Focus</span>
                  </div>
                  <p className="text-[10px] text-outline-variant max-w-[140px]">
                    Enables active agent supervision.
                  </p>
                </div>
                <Switch checked={focusMode} onCheckedChange={setFocusMode} />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary text-on-primary hover:bg-primary/90 font-bold uppercase tracking-widest rounded-sm transition-all"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Apply"}
            </Button>
          </form>

          {/* Team / Members */}
          <div className="w-full md:w-64 p-6 bg-surface-container-low flex flex-col gap-4">
             <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface">Deployed Team</h4>
             </div>

             <div className="flex flex-col gap-2 overflow-y-auto max-h-64">
                {participants.map(user => (
                   <div key={user.user_id} className="p-3 rounded-md bg-surface-container border border-surface-container-highest flex flex-col gap-1 relative overflow-hidden group">
                      <div className="flex items-center justify-between">
                         <span className="text-label-sm font-bold text-on-surface truncate pr-2">@{user.username}</span>
                         {user.role === 'manager' ? (
                            <Shield className="w-3 h-3 text-error" />
                         ) : (
                            <button 
                               type="button"
                               onClick={() => handlePromote(user.user_id)}
                               disabled={promotingId === user.user_id}
                               className="p-1 hover:bg-primary/10 rounded transition-all text-primary/50 hover:text-primary"
                               title="Promote to Manager"
                            >
                               {promotingId === user.user_id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Shield className="w-3 h-3" />}
                            </button>
                         )}
                      </div>
                      <div className="flex items-center gap-2">
                         <span className={`text-[8px] uppercase font-black tracking-tight px-1.5 py-0.5 rounded-full ${user.role === 'manager' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
                            {user.role}
                         </span>
                         {user.user_id === creatorId && (
                            <span className="text-[8px] uppercase font-black tracking-tight text-tertiary">Architect</span>
                         )}
                      </div>
                   </div>
                ))}
             </div>
             {participants.length === 0 && (
                <div className="p-4 rounded border border-dashed border-outline-variant/30 text-center text-[10px] text-outline-variant italic">
                   No visible operatives found.
                </div>
             )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

