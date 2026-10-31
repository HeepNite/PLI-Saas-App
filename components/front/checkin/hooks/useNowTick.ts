import * as React from "react"

type UseNowTickOptions = {
  /** When false no interval is registered. Defaults to true. */
  enabled?: boolean
  /** Also emit one tick as soon as the interval is (re)registered. Defaults to false. */
  immediate?: boolean
}

/**
 * Calls `onTick(new Date())` every `intervalMs` while enabled and clears the interval on
 * cleanup. The latest `onTick` is always used without restarting the interval.
 */
export function useNowTick(
  intervalMs: number,
  onTick: (now: Date) => void,
  { enabled = true, immediate = false }: UseNowTickOptions = {}
) {
  const onTickRef = React.useRef(onTick)
  React.useEffect(() => {
    onTickRef.current = onTick
  }, [onTick])

  React.useEffect(() => {
    if (!enabled) return
    if (immediate) onTickRef.current(new Date())
    const intervalId = window.setInterval(() => onTickRef.current(new Date()), intervalMs)
    return () => window.clearInterval(intervalId)
  }, [enabled, immediate, intervalMs])
}
