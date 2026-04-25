"use client"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getUsers, updateUserRole } from "@/lib/api"
import { useRoomStore } from "@/lib/useRoomStore"
import { ShieldAlert, Users, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { User } from "@/lib/types"

interface AccessControlModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccessControlModal({ open, onOpenChange }: AccessControlModalProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const currentUser = useRoomStore((s) => s.currentUser)

  useEffect(() => {
    if (open && currentUser?.role === "manager") {
      setLoading(true)
      getUsers()
        .then(data => setUsers(data))
        .catch(err => toast.error("Failed to load developers", { description: String(err) }))
        .finally(() => setLoading(false))
    }
  }, [open, currentUser])

  const handleRoleChange = async (userId: string, targetRole: "manager" | "member") => {
    if (userId === currentUser?.user_id && targetRole === "member") {
      toast.error("Cannot demote yourself.", { description: "You must retain active manager status." })
      return
    }

    setUpdatingId(userId)
    try {
      await updateUserRole(userId, targetRole)
      setUsers(users.map(u => u.user_id === userId ? { ...u, role: targetRole } : u))
      toast.success("Role Updated Successfully")
    } catch (err) {
      toast.error("Failed to re-assign role", { description: String(err) })
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-surface-container border-surface-container-high shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 bg-surface-container-lowest border-b border-surface-container-high">
          <DialogTitle className="flex items-center gap-3 text-lg font-black tracking-tight uppercase text-on-surface">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-primary" />
            </div>
            Team Administration
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col p-6 max-h-[60vh] overflow-y-auto">
          {loading ? (
             <div className="flex items-center justify-center py-10">
               <Loader2 className="w-8 h-8 animate-spin text-primary" />
             </div>
          ) : (
            <div className="flex flex-col gap-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2 mb-2">
                <Users className="w-3 h-3" /> Registered Identity Matrix
              </h4>
              <div className="flex border border-surface-container-high rounded-t-md bg-surface-container-lowest px-4 py-2 font-bold uppercase tracking-widest text-[10px] text-on-surface-variant">
                <div className="flex-[2]">Username</div>
                <div className="flex-1 text-center">Identity Role</div>
                <div className="flex-1 text-right">Access Tier</div>
              </div>
              <div className="flex flex-col border border-t-0 border-surface-container-high rounded-b-md overflow-hidden bg-surface-container-lowest divide-y divide-surface-container-high">
                {users.map((u) => (
                  <div key={u.user_id} className="flex px-4 py-3 items-center group transition-colors hover:bg-surface-container-low/50">
                     <div className="flex-[2] flex flex-col">
                        <span className="text-body-sm font-bold text-on-surface bg-on-surface/5 w-fit px-2 py-0.5 rounded-sm">@{u.username}</span>
                        {u.user_id === currentUser?.user_id && <span className="text-[10px] font-medium text-primary mt-1">You</span>}
                     </div>
                     <div className="flex-1 flex justify-center">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm ${u.role === 'manager' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
                           {u.role}
                        </span>
                     </div>
                     <div className="flex-1 flex justify-end">
                       <Select 
                          disabled={updatingId === u.user_id} 
                          value={u.role} 
                          onValueChange={(val: any) => handleRoleChange(u.user_id, val)}
                       >
                         <SelectTrigger className="w-[120px] h-8 text-[10px] uppercase font-bold tracking-widest bg-surface-container focus:ring-1 focus:ring-primary">
                            <SelectValue />
                         </SelectTrigger>
                         <SelectContent className="bg-surface-container shadow-2xl border-surface-container-highest">
                           <SelectItem value="member" className="text-[10px] uppercase tracking-widest font-bold focus:bg-surface-container-high">Member</SelectItem>
                           <SelectItem value="manager" disabled={u.user_id === currentUser?.user_id} className="text-[10px] uppercase tracking-widest font-bold focus:bg-surface-container-high text-error">Manager</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
