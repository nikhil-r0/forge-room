"use client"

import { InitializeRoomModal } from "@/components/landing/InitializeRoomModal"
import { ThemeToggle } from "@/components/ThemeToggle"
import { ArrowRight, Brain, Shield, Zap, GitBranch, Terminal, Layers, Code, Sparkles } from "lucide-react"

export default function Home() {
  return (
    <div className="relative min-h-screen bg-surface selection:bg-primary/30 selection:text-primary-container overflow-x-hidden">
      {/* ─── Header Navigation ─── */}
      <nav className="fixed top-0 left-0 w-full z-50 border-b border-surface-container-high/50 bg-surface/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Terminal className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xl font-black tracking-tighter text-on-surface uppercase">
              Forge<span className="text-primary">Room</span>
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-8 text-label-sm font-bold uppercase tracking-widest text-on-surface-variant/70">
              <a href="#features" className="hover:text-primary transition-colors">Features</a>
              <a href="#workflow" className="hover:text-primary transition-colors">Workflow</a>
            </div>
            <div className="h-6 w-px bg-surface-container-high" />
            <ThemeToggle />
            <InitializeRoomModal />
          </div>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="relative pt-40 pb-20 px-6 overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-full max-w-7xl pointer-events-none">
          <div className="absolute -top-64 -left-64 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[160px] animate-pulse" />
          <div className="absolute -top-32 -right-64 w-[500px] h-[500px] bg-tertiary/10 rounded-full blur-[140px] animate-pulse [animation-delay:2s]" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">Next-Gen Architecting Layer</span>
          </div>

          <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-on-surface mb-8 leading-[0.9] animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
            FORGE <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary/80 to-tertiary">SYSTEMS</span> <br />
            THROUGH DIALOGUE.
          </h1>

          <p className="max-w-2xl mx-auto text-lg md:text-xl text-on-surface-variant/80 mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
            ForgeRoom is the first reasoning-aware IDE extension where AI agents, supervisors, and humans collaborate to maintain a "Living Spec" that never drifts from reality.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-300">
            <InitializeRoomModal />
            <button className="flex items-center gap-2 px-8 py-5 rounded-full border border-surface-container-high text-label-sm font-bold uppercase tracking-widest text-on-surface hover:bg-surface-container-low transition-all">
              Watch Demo
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hero Interactive Element (Visual Hint) */}
        <div className="mt-24 max-w-6xl mx-auto relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-tertiary/20 rounded-2xl blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
          <div className="relative bg-surface-container-lowest border border-surface-container-high rounded-2xl aspect-video overflow-hidden shadow-2xl">
            <div className="p-4 bg-surface-container-high/30 border-b border-surface-container-high flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-error/40" />
              <div className="w-3 h-3 rounded-full bg-tertiary/40" />
              <div className="w-3 h-3 rounded-full bg-primary/40" />
            </div>
            <div className="p-8 flex gap-8 h-full">
              <div className="flex-1 bg-surface-dim rounded-lg border border-surface-container-high/50 p-6 flex flex-col gap-4">
                <div className="w-2/3 h-4 bg-primary/20 rounded animate-pulse" />
                <div className="w-full h-20 bg-surface-container rounded" />
                <div className="w-3/4 h-32 bg-tertiary/10 rounded" />
              </div>
              <div className="w-64 bg-surface-dim rounded-lg border border-surface-container-high/50 p-6">
                <div className="w-1/2 h-4 bg-primary/10 rounded mb-6" />
                <div className="space-y-4">
                  <div className="w-full h-2 bg-surface-container rounded" />
                  <div className="w-full h-2 bg-surface-container rounded" />
                  <div className="w-2/3 h-2 bg-surface-container rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section id="features" className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-on-surface mb-4 uppercase">
              The Protocol of Consistency
            </h2>
            <div className="h-1.5 w-20 bg-primary mx-auto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: "Reasoning Loop",
                desc: "Every architectural decision is debated by multiple AI agents until consensus is reached.",
                color: "text-primary"
              },
              {
                icon: Shield,
                title: "Drift Guard",
                desc: "Real-time monitoring that alerts you the moment code deviates from the approved specification.",
                color: "text-error"
              },
              {
                icon: GitBranch,
                title: "Blame Graph",
                desc: "Trace every line of code back to the human or AI decision that authorized it.",
                color: "text-tertiary"
              },
              {
                icon: Brain,
                title: "AI Supervisor",
                desc: "A high-reasoning observer that catches edge cases and security flaws before they hit the repo.",
                color: "text-primary"
              },
              {
                icon: Layers,
                title: "Multimodal Spec",
                desc: "Maintain documents, RFCs, and code in a single synchronized source of truth.",
                color: "text-tertiary"
              },
              {
                icon: Code,
                title: "Git-Native",
                desc: "Executes changes directly via git patches, maintaining full history and authorship.",
                color: "text-[#34d399]"
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="group p-8 bg-surface-container-low border border-surface-container-high rounded-2xl hover:bg-surface-container-lowest transition-all hover:shadow-xl hover:-translate-y-1"
              >
                <div className={`w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center mb-6 ${feature.color} group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-on-surface uppercase tracking-wider mb-3">{feature.title}</h3>
                <p className="text-on-surface-variant/70 leading-relaxed text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-20 border-t border-surface-container-high">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-primary" />
            <span className="font-black text-on-surface tracking-tighter uppercase">ForgeRoom</span>
          </div>
          <div className="flex gap-10 text-label-sm font-bold uppercase tracking-widest text-on-surface-variant/40">
            <span>© 2026 Athernex</span>
            <a href="#" className="hover:text-primary transition-colors">Github</a>
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
