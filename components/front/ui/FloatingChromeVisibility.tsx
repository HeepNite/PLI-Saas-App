"use client"

import React from "react"

type FloatingChromeContextValue = {
  hidden: boolean
  registerSuppression: () => () => void
}

const FloatingChromeContext = React.createContext<FloatingChromeContextValue | null>(null)

export function FloatingChromeProvider({ children }: { children: React.ReactNode }) {
  const [suppressors, setSuppressors] = React.useState<ReadonlySet<symbol>>(() => new Set())

  const registerSuppression = React.useCallback(() => {
    const token = Symbol("floating-chrome-suppression")
    setSuppressors((current) => new Set(current).add(token))

    return () => {
      setSuppressors((current) => {
        const next = new Set(current)
        next.delete(token)
        return next
      })
    }
  }, [])

  const value = React.useMemo(
    () => ({ hidden: suppressors.size > 0, registerSuppression }),
    [registerSuppression, suppressors],
  )

  return <FloatingChromeContext.Provider value={value}>{children}</FloatingChromeContext.Provider>
}

export function SuppressFloatingChrome() {
  const registerSuppression = React.useContext(FloatingChromeContext)?.registerSuppression

  React.useEffect(() => registerSuppression?.(), [registerSuppression])

  return null
}

export function useFloatingChromeHidden() {
  return React.useContext(FloatingChromeContext)?.hidden ?? false
}
