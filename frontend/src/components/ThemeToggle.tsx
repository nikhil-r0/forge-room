"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
    const { theme, setTheme, resolvedTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    // After mounting, we have access to the theme
    React.useEffect(() => setMounted(true), [])

    if (!mounted) {
        return (
            <button className="relative w-10 h-10 flex items-center justify-center rounded-md border border-outline-variant bg-surface-container-low text-on-surface-variant">
                <span className="sr-only">Toggle theme loading</span>
            </button>
        )
    }

    return (
        <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="relative w-10 h-10 flex items-center justify-center rounded-md border border-outline-variant bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all group"
            title="Toggle Theme"
        >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-sky-400 group-hover:drop-shadow-md" />
            <span className="sr-only">Toggle theme</span>
        </button>
    )
}
