"use client"

import { useState } from "react"
import { useRoomStore } from "@/lib/useRoomStore"
import { signup, login, getMe } from "@/lib/api"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, LogIn, UserPlus } from "lucide-react"
interface AuthModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps = {}) {
  const [internalOpen, setInternalOpen] = useState(true)
  const [isLogin, setIsLogin] = useState(true)

  const isOpen = open !== undefined ? open : internalOpen
  const setIsOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const setCurrentUser = useRoomStore((s) => s.setCurrentUser)
  const currentUser = useRoomStore((s) => s.currentUser)

  if (currentUser) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)

    try {
      if (isLogin) {
        const res = await login(username, password)
        setCurrentUser({ user_id: res.user_id, username: res.username, role: res.role })
        toast.success("Welcome back!")
      } else {
        await signup(username, password)
        // Auto login after signup
        const res = await login(username, password)
        setCurrentUser({ user_id: res.user_id, username: res.username, role: res.role })
        toast.success("Account created!")
      }
      setIsOpen(false)
    } catch (err) {
      toast.error(isLogin ? "Login failed" : "Signup failed", {
        description: String(err),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md bg-surface-container border-surface-container-high shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-on-surface flex items-center gap-2">
            {isLogin ? <LogIn className="w-5 h-5 text-primary" /> : <UserPlus className="w-5 h-5 text-primary" />}
            {isLogin ? "Login to ForgeRoom" : "Join the Forge"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-label-sm font-bold uppercase tracking-widest text-on-surface-variant">
              Username
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="nikhil"
              className="bg-surface-container-highest border-primary/10 focus:border-primary transition-all font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-label-sm font-bold uppercase tracking-widest text-on-surface-variant">
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-surface-container-highest border-primary/10 focus:border-primary transition-all"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-primary text-on-primary hover:bg-primary/90 font-bold uppercase tracking-widest rounded-sm transition-all"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isLogin ? "Login" : "Sign Up"}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-label-sm text-primary hover:underline font-bold uppercase tracking-widest"
            >
              {isLogin ? "Need an account? Sign up" : "Already have an account? Login"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
