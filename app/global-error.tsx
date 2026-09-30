"use client"

import React from "react"

import { captureBoundaryError } from "@/lib/sentry/capture-boundary-error"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error("Global error:", error)
    captureBoundaryError(error, "global")
  }, [error])

  return (
    <html>
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            An unexpected error occurred. Please try again.
          </p>
          {error.digest ? <p className="text-xs text-black/40 dark:text-white/40">Reference: {error.digest}</p> : null}
          <button
            onClick={reset}
            className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
