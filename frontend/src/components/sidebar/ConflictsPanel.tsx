import { ScrollArea } from "@/components/ui/scroll-area"
import { ConflictCard } from "@/components/chat/ConflictCard"
import { ShieldAlert } from "lucide-react"
import type { ConflictPayload } from "@/lib/types"

interface ConflictsPanelProps {
  conflicts: ConflictPayload[]
}

export function ConflictsPanel({ conflicts }: ConflictsPanelProps) {
  return (
    <aside className="w-[340px] bg-surface-container-low shrink-0 flex flex-col hidden lg:flex border-r border-surface-container-high/30 z-10">
      <div className="p-4 bg-surface-container-highest flex flex-col justify-center shadow-sm w-full shrink-0 border-b border-surface-container-high/50 min-h-[56px] absolute z-10">
        <h2 className="font-bold text-label-sm uppercase tracking-widest text-on-surface flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-tertiary" />
          Active Polls & Conflicts
        </h2>
      </div>

      <ScrollArea className="flex-1 w-full mt-[56px]">
        <div className="p-4 space-y-4">
          {conflicts.length === 0 ? (
            <p className="text-xs text-outline-variant italic text-center py-8">
              No architectural conflicts open.
            </p>
          ) : (
            conflicts.map((conflict) => (
              <ConflictCard key={conflict.conflict_id} conflict={conflict} />
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
