"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight, Terminal, Loader2 } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog"
import { createRoom, getMe } from "@/lib/api"
import { useRoomStore } from "@/lib/useRoomStore"
import { toast } from "sonner"

export function InitializeRoomModal() {
    const [name, setName] = useState("")
    const [goal, setGoal] = useState("")
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const router = useRouter()
    const setRoom = useRoomStore((s) => s.setRoom)

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return
        setLoading(true)
        try {
            const { room_id } = await createRoom(goal.trim() || "No goal set yet")
            // Refresh user to pick up new 'manager' role from server
            try {
                const me = await getMe()
                useRoomStore.getState().setCurrentUser(me)
            } catch (authErr) {
                console.warn("User refresh failed after room creation", authErr)
            }

            setRoom(room_id, name.trim())
            router.push(`/room/${room_id}?name=${encodeURIComponent(name.trim())}`)
        } catch (err) {
            toast.error("Failed to create room", { description: String(err) })
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    className="bg-primary hover:bg-primary/90 text-on-primary-fixed shadow-lg shadow-primary/20 font-bold uppercase tracking-widest text-xs px-6 py-5 rounded-full transition-all hover:scale-105 active:scale-95"
                >
                    Enter Arena
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-surface-container-low border border-surface-container-high p-0 overflow-hidden shadow-2xl rounded-2xl">
                <div className="relative p-8 sm:p-12">
                    {/* Ambient Background Glow inside modal */}
                    <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-20">
                        <div className="w-[300px] h-[300px] bg-primary/20 rounded-full blur-[60px]" />
                    </div>

                    <DialogHeader className="flex flex-col items-center mb-10 relative z-10">
                        <div className="group relative w-16 h-16 bg-gradient-to-tr from-primary to-primary-container rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-primary/20 rotate-3 hover:rotate-6 transition-transform duration-500">
                            <Terminal className="w-8 h-8 text-on-primary-fixed" />
                            <div className="absolute inset-0 bg-white/20 blur-xl scale-0 group-hover:scale-150 transition-transform duration-700 rounded-full" />
                        </div>
                        <DialogTitle className="text-3xl font-extrabold tracking-tight text-on-surface text-center mb-2">
                            Initialize Room
                        </DialogTitle>
                        <DialogDescription className="text-body-md text-on-surface-variant text-center">
                            Set your identity and mission goal.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateRoom} className="flex flex-col gap-5 relative z-10">
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
                                    <span className="relative z-10">Start Session</span>
                                    <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </Button>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    )
}
