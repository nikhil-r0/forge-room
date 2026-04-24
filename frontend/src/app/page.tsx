"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Hammer } from "lucide-react"

import { ArrowRight, Terminal } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle"

export default function Home() {
  const [name, setName] = useState("")
  const router = useRouter()

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const mockRoomId = Math.random().toString(36).substring(7)
    router.push(`/room/${mockRoomId}?name=${encodeURIComponent(name)}`)
  }

  return (
    <div className="relative min-h-screen bg-surface flex flex-col items-center justify-center p-4 sm:p-24 overflow-hidden transition-colors duration-500">
      {/* Theme Toggle Positioned in Top Right */}
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Ambient Background Glow */}
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
        <div className="w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] mix-blend-screen opacity-50 dark:opacity-100"></div>
      </div>

      {/* Central Card Container */}
      <div className="relative z-10 w-full max-w-md bg-surface-container-low border border-surface-container-high p-8 sm:p-12 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-1000">

        {/* Header */}
        <div className="flex flex-col items-center mb-10">
          <div className="group relative w-16 h-16 bg-gradient-to-tr from-primary to-primary-container rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-primary/20 rotate-3 hover:rotate-6 transition-transform duration-500">
            <Terminal className="w-8 h-8 text-on-primary-fixed" />
            <div className="absolute inset-0 bg-white/20 blur-xl scale-0 group-hover:scale-150 transition-transform duration-700 rounded-full"></div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface text-center mb-2">
            ForgeRoom
          </h1>
          <p className="text-body-md text-on-surface-variant text-center">
            The multi-tenant reasoning environment.
          </p>
        </div>

        {/* Form Elements */}
        <form onSubmit={handleCreateRoom} className="flex flex-col gap-5">
          <div className="space-y-2">
            <label className="text-label-sm font-bold uppercase tracking-widest text-on-surface-variant ml-1">
              Identification
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-primary-container rounded-lg blur opacity-0 group-hover:opacity-30 transition duration-500"></div>
              <Input
                placeholder="Enter Display Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="relative h-14 bg-surface-container-lowest border-surface-container-high text-on-surface placeholder:text-on-surface-variant/40 rounded-lg px-5 focus-visible:ring-1 focus-visible:ring-primary shadow-inner text-body-md transition-all font-medium"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={!name.trim()}
            className="relative overflow-hidden group h-14 rounded-lg w-full flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-label-sm shadow-[0_0_40px_rgba(0,209,255,0.15)] text-on-primary-fixed bg-gradient-to-br from-primary to-primary-container hover:scale-[0.98] transition-all"
          >
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            <span className="relative z-10">Initialize Room</span>
            <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
          </Button>
        </form>
      </div>

      {/* Minimal Footer */}
      <div className="absolute bottom-6 text-label-sm text-on-surface-variant tracking-widest uppercase opacity-40">
        System Initialized
      </div>
    </div>
  )
}
