"use client"

import { QRCodeSVG } from "qrcode.react"
import { Copy, QrCode, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface QRSharePanelProps {
  roomId: string
}

export function QRSharePanel({ roomId }: QRSharePanelProps) {
  const [open, setOpen] = useState(false)
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/room/${roomId}`
      : `/room/${roomId}`

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl)
    toast.success("Link Copied", { description: shareUrl })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-8 px-3 rounded-sm text-label-sm font-semibold uppercase tracking-widest text-on-surface-variant bg-surface-container-low hover:text-primary hover:bg-surface-container transition-all"
      >
        <QrCode className="w-3.5 h-3.5" />
        Share
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative bg-surface-container-low border border-surface-container-high rounded-lg p-8 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-300">
        {/* Close */}
        <button
          onClick={() => setOpen(false)}
          className="absolute top-3 right-3 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-primary/10 rounded-lg mb-3">
            <QrCode className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-on-surface">Share Room</h3>
          <p className="text-sm text-on-surface-variant mt-1">
            Scan to join this ForgeRoom session
          </p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-6">
          <div className="bg-white p-4 rounded-lg shadow-inner">
            <QRCodeSVG
              value={shareUrl}
              size={200}
              level="H"
              bgColor="#ffffff"
              fgColor="#0f172a"
            />
          </div>
        </div>

        {/* Link + Copy */}
        <div className="flex items-center gap-2 bg-surface-container-lowest rounded-sm border border-surface-container-high p-2">
          <span className="flex-1 text-xs text-on-surface-variant font-mono truncate px-2">
            {shareUrl}
          </span>
          <button
            onClick={copyLink}
            className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-sm text-label-sm font-semibold uppercase tracking-widest text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <Copy className="w-3 h-3" />
            Copy
          </button>
        </div>

        {/* Room ID badge */}
        <div className="text-center mt-4">
          <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-mono">
            Room: <span className="text-primary">{roomId}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
