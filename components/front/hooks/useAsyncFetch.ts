import { useEffect, useState } from "react"

interface AsyncFetchResult<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Fetches data from a URL when enabled, with automatic cancellation on unmount
 * or dependency change. Returns { data, loading, error }.
 */
export function useAsyncFetch<T>(
  url: string | null,
  enabled: boolean,
  transform: (json: unknown) => T,
): AsyncFetchResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !url) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (!cancelled) {
          setData(transform(json))
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Fetch failed")
          setLoading(false)
          setData(null)
        }
      })

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled])

  return { data, loading, error }
}
