import React from "react"
import type { PointsEntry } from "../profile-types"

export type PointsHistoryState = {
  pointsBalance: number
  setPointsBalance: React.Dispatch<React.SetStateAction<number>>
  freeClassThreshold: number
  freeClassesAvailable: number
  pointsToNextFreeClass: number
  pointsEntries: PointsEntry[]
  pointsLoading: boolean
  pointsError: string | null
  loadPointsHistory: () => Promise<void>
}

export function usePointsHistory(canLoadProtectedData: boolean): PointsHistoryState {
  const [pointsBalance, setPointsBalance] = React.useState(0)
  const [freeClassThreshold, setFreeClassThreshold] = React.useState(500)
  const [freeClassesAvailable, setFreeClassesAvailable] = React.useState(0)
  const [pointsToNextFreeClass, setPointsToNextFreeClass] = React.useState(500)
  const [pointsEntries, setPointsEntries] = React.useState<PointsEntry[]>([])
  const [pointsLoading, setPointsLoading] = React.useState(false)
  const [pointsError, setPointsError] = React.useState<string | null>(null)

  const loadPointsHistory = React.useCallback(async () => {
    if (!canLoadProtectedData) return
    setPointsLoading(true)
    setPointsError(null)
    try {
      const res = await fetch("/api/profile/points")
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setPointsError(data?.error || "Could not load points history.")
        return
      }
      setPointsBalance(typeof data?.balance === "number" ? data.balance : 0)
      setFreeClassThreshold(
        typeof data?.freeClassThreshold === "number" && data.freeClassThreshold > 0 ? data.freeClassThreshold : 500
      )
      setFreeClassesAvailable(
        typeof data?.freeClassesAvailable === "number" ? Math.max(0, data.freeClassesAvailable) : 0
      )
      setPointsToNextFreeClass(
        typeof data?.pointsToNextFreeClass === "number"
          ? Math.max(0, data.pointsToNextFreeClass)
          : Math.max(0, 500 - (typeof data?.balance === "number" ? data.balance : 0))
      )
      setPointsEntries(Array.isArray(data?.entries) ? data.entries : [])
    } catch {
      setPointsError("Could not load points history.")
    } finally {
      setPointsLoading(false)
    }
  }, [canLoadProtectedData])

  return {
    pointsBalance,
    setPointsBalance,
    freeClassThreshold,
    freeClassesAvailable,
    pointsToNextFreeClass,
    pointsEntries,
    pointsLoading,
    pointsError,
    loadPointsHistory,
  }
}
