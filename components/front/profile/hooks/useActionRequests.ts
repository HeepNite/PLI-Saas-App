import React from "react"
import type { ActionRequestItem } from "../profile-types"

export type ActionRequestsState = {
  actionRequests: ActionRequestItem[]
  actionRequestsLoading: boolean
  actionRequestsError: string | null
  loadActionRequests: () => Promise<void>
}

export function useActionRequests(canLoadProtectedData: boolean): ActionRequestsState {
  const [actionRequests, setActionRequests] = React.useState<ActionRequestItem[]>([])
  const [actionRequestsLoading, setActionRequestsLoading] = React.useState(false)
  const [actionRequestsError, setActionRequestsError] = React.useState<string | null>(null)

  const loadActionRequests = React.useCallback(async () => {
    if (!canLoadProtectedData) return
    setActionRequestsLoading(true)
    setActionRequestsError(null)
    try {
      const res = await fetch("/api/profile/requests")
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setActionRequestsError(data?.error || "Could not load your requests.")
        return
      }
      setActionRequests(Array.isArray(data?.requests) ? data.requests : [])
    } catch {
      setActionRequestsError("Could not load your requests.")
    } finally {
      setActionRequestsLoading(false)
    }
  }, [canLoadProtectedData])

  return {
    actionRequests,
    actionRequestsLoading,
    actionRequestsError,
    loadActionRequests,
  }
}
