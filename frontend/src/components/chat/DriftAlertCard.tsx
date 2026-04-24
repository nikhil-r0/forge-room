import { AlertTriangle, Code2 } from "lucide-react"

interface DriftAlertCardProps {
    alertTitle: string
    alertMessage: string
    codeSnippet?: string
}

export function DriftAlertCard({ alertTitle, alertMessage, codeSnippet }: DriftAlertCardProps) {
    return (
        <div className="my-4 relative overflow-hidden rounded-md bg-error/10 shadow-[0_0_20px_rgba(225,29,72,0.15)] before:absolute before:inset-0 before:ring-1 before:ring-error/40 before:rounded-md animate-shake">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-error to-transparent opacity-70"></div>

            <div className="p-4 border-b border-error/10 bg-error/5 relative z-10 flex gap-3">
                <div className="bg-error/20 p-2 rounded-sm h-fit">
                    <AlertTriangle className="w-5 h-5 text-error" />
                </div>
                <div>
                    <h3 className="text-label-sm font-bold uppercase tracking-widest text-error mb-1">
                        {alertTitle}
                    </h3>
                    <p className="text-body-md text-on-surface leading-loose">
                        {alertMessage}
                    </p>
                </div>
            </div>

            {codeSnippet && (
                <div className="p-4 bg-surface-container-low relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <Code2 className="w-4 h-4 text-on-surface-variant" />
                        <span className="text-label-sm uppercase tracking-widest text-on-surface-variant font-mono">Divergent Code block</span>
                    </div>
                    <pre className="font-mono text-xs p-3 bg-surface-container-lowest rounded-sm border border-error/20 text-error overflow-x-auto selection:bg-error/30">
                        <code>{codeSnippet}</code>
                    </pre>
                </div>
            )}
        </div>
    )
}
