"use client"

import React from "react"

export function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia(query)
    type LegacyMQ = MediaQueryList & {
      addListener?: (listener: (ev: MediaQueryListEvent) => void) => void
      removeListener?: (listener: (ev: MediaQueryListEvent) => void) => void
    }
    const legacy = mq as LegacyMQ
    const handle = () => setMatches(mq.matches)
    handle()

    if (mq.addEventListener) {
      mq.addEventListener("change", handle)
    } else {
      legacy.addListener?.(handle)
    }
    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener("change", handle)
      } else {
        legacy.removeListener?.(handle)
      }
    }
  }, [query])

  return matches
}
