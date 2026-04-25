"use client"
import { useState, useEffect } from "react"
import { useRoomStore } from "@/lib/useRoomStore"
import { getMyRooms, joinRoom, logout, getMe } from "@/lib/api"
import { Loader2, Menu, LogOut, Terminal, Hash, Plus, ArrowRight } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AuthModal } from "@/components/modals/AuthModal"
import { AccessControlModal } from "@/components/modals/AccessControlModal"

export function GlobalSidebar() {
  const [open, setOpen] = useState(false)
  const { currentUser, setCurrentUser, setRoom } = useRoomStore()
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [authOpen, setAuthOpen] = useState(false)
  const [accessOpen, setAccessOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (open && currentUser) {
      setLoading(true)
      getMyRooms()
        .then(data => setRooms(data))
        .catch(err => console.error(err))
        .finally(() => setLoading(false))
    }
  }, [open, currentUser])

  useEffect(() => {
    // Attempt auto login using HTTP-only cookie if Zustand state is lost but cookie exists
    if (!currentUser) {
      getMe().then(user => setCurrentUser(user)).catch(() => {})
    }
  }, [currentUser, setCurrentUser])

  const handleLogout = async () => {
    try {
      await logout()
      setCurrentUser(null)
      toast.success("Logged out successfully")
      router.push("/")
    } catch {}
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) return
    try {
        await joinRoom(joinCode.trim())
        setRoom(joinCode.trim(), "Guest")
        router.push(`/room/${joinCode.trim()}`)
        setOpen(false)
    } catch(err) {
        toast.error("Failed to join room", { description: String(err) })
    }
  }

  return (
    <>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="fixed top-5 right-6 z-[60] bg-surface-container-low/50 backdrop-blur border border-surface-container-high rounded-full w-12 h-12 shadow-xl hover:bg-surface-container-high hover:scale-105 active:scale-95 transition-all">
            <Menu className="w-6 h-6 text-on-surface" />
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-sm border-l border-surface-container-high bg-surface flex flex-col p-0">
          <SheetHeader className="p-6 border-b border-surface-container-high bg-surface-container-lowest">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Terminal className="w-5 h-5 text-primary" />
              </div>
              <SheetTitle className="text-xl font-black uppercase tracking-widest text-on-surface">
                Dashboard
              </SheetTitle>
            </div>
            
            {currentUser ? (
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container border border-surface-container-highest">
                  <div className="flex flex-col">
                    <span className="text-body-md font-bold text-on-surface">@{currentUser.username}</span>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-primary">{currentUser.role}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleLogout} className="text-error hover:text-error hover:bg-error/10">
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
                {currentUser.role === "manager" && (
                   <Button onClick={() => setAccessOpen(true)} className="w-full bg-error/10 text-error hover:bg-error/20 border-error/30 text-[10px] uppercase tracking-widest font-bold">
                      Manage Team Access
                   </Button>
                )}
              </div>
            ) : (
               <div className="mt-4">
                  <Button onClick={() => setAuthOpen(true)} className="w-full bg-primary hover:bg-primary/90 text-on-primary-fixed uppercase tracking-widest font-bold text-[10px]">
                    Sign In to ForgeRoom
                  </Button>
               </div>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
            {/* Join Room */}
            <div className="flex flex-col gap-3">
              <h4 className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant flex items-center gap-2">
                <Plus className="w-3 h-3" /> Connect to Arena
              </h4>
              <form onSubmit={handleJoin} className="flex items-center gap-2">
                <Input 
                   value={joinCode}
                   onChange={e => setJoinCode(e.target.value)}
                   placeholder="Room ID"
                   className="bg-surface-container-lowest h-10 text-body-sm font-mono placeholder:font-sans"
                />
                <Button type="submit" disabled={!joinCode.trim() || !currentUser} size="icon" className="h-10 w-10 shrink-0 bg-tertiary hover:bg-tertiary/90 text-on-tertiary">
                    <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            </div>

            {/* Previous Rooms Grid */}
            <div className="flex flex-col gap-3">
              <h4 className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant flex items-center gap-2">
                <Hash className="w-3 h-3" /> Previous Sessions
              </h4>
              
              {!currentUser ? (
                <div className="text-label-sm text-on-surface-variant/50 italic p-4 bg-surface-container-lowest rounded-md text-center">
                  Login to view history
                </div>
              ) : loading ? (
                 <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : rooms.length === 0 ? (
                 <div className="text-label-sm text-on-surface-variant/50 italic p-4 bg-surface-container-lowest rounded-md text-center">
                    No active sessions found.
                 </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {rooms.map((r, i) => (
                    <button 
                       key={i}
                       onClick={() => {
                          setOpen(false)
                          router.push(`/room/${r.room_id}`)
                       }}
                       className="group text-left flex flex-col p-3 rounded-md bg-surface-container-lowest border border-surface-container-high hover:border-primary/50 transition-all overflow-hidden relative"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex justify-between items-start">
                         <span className="text-label-sm font-bold text-on-surface font-mono">{r.room_id}</span>
                         {r.participants && r.participants.length > 0 && (
                            <div className="flex -space-x-1.5">
                               {r.participants.slice(0, 3).map((u: any, idx: number) => (
                                  <div key={idx} className="w-4 h-4 rounded-full bg-primary/20 border border-surface flex items-center justify-center text-[6px] font-bold text-primary uppercase">
                                     {u.username[0]}
                                  </div>
                               ))}
                               {r.participants.length > 3 && (
                                  <div className="w-4 h-4 rounded-full bg-surface-container-highest border border-surface flex items-center justify-center text-[6px] font-bold text-outline-variant">
                                     +{r.participants.length - 3}
                                  </div>
                               )}
                            </div>
                         )}
                      </div>
                      <span className="text-[10px] text-on-surface-variant line-clamp-1 mt-1">{r.current_goal}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
