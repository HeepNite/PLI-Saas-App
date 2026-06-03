import React from "react"
import type { CachedAvailabilityEntry, SlotAvailability } from "../profile-types"
import { AVAILABILITY_CACHE_TTL_MS } from "../profile-constants"

export type AvailabilityCacheState = {
  clearAvailabilityCache: () => void
  fetchAvailability: (courseSlug: string, date: string, attendanceId?: string) => Promise<SlotAvailability[] | null>
}

export function useAvailabilityCache(): AvailabilityCacheState {
  const availabilityCacheRef = React.useRef<Map<string, CachedAvailabilityEntry>>(new Map())
  const availabilityInflightRef = React.useRef<Map<string, Promise<SlotAvailability[] | null>>>(new Map())

  const clearAvailabilityCache = React.useCallback(() => {
    availabilityCacheRef.current.clear()
    availabilityInflightRef.current.clear()
  }, [])

  const fetchAvailability = React.useCallback(async (courseSlug: string, date: string, attendanceId?: string) => {
    const cacheKey = `${courseSlug}|${date}|${attendanceId || ""}`
    const now = Date.now()

    const cached = availabilityCacheRef.current.get(cacheKey)
    if (cached && now - cached.cachedAt <= AVAILABILITY_CACHE_TTL_MS) {
      return cached.slots
    }

    const inflight = availabilityInflightRef.current.get(cacheKey)
    if (inflight) {
      return inflight
    }

    const request = (async () => {
      const query = new URLSearchParams({
        courseSlug,
        date,
        ...(attendanceId ? { excludeAttendanceId: attendanceId } : {}),
      })
      const res = await fetch(`/api/profile/bookings/availability?${query.toString()}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) return null
      const slots = Array.isArray(data?.slots) ? (data.slots as SlotAvailability[]) : []
      availabilityCacheRef.current.set(cacheKey, { slots, cachedAt: Date.now() })
      return slots
    })()

    availabilityInflightRef.current.set(cacheKey, request)
    try {
      return await request
    } finally {
      availabilityInflightRef.current.delete(cacheKey)
    }
  }, [])

  return { clearAvailabilityCache, fetchAvailability }
}
