import React from "react"

import type { StaffCategory } from "@/lib/security/staff-category"
import type {
  PayrollModelActionState,
  ScheduleEvent,
  StaffPaymentModelOption,
  StaffUserRow,
} from "./staffAdminTypes"

export type ClerkSyncMismatch = {
  userId: string
  clerkId: string
  email: string | null
  fields: Array<"name" | "email" | "phone">
  clerk: { name: string | null; email: string | null; phone: string | null }
  db: { name: string | null; email: string | null; phone: string | null }
}

export type ClerkSyncHealth = {
  clerkUsers: number
  dbUsersWithClerkId: number
  missingCount: number
  missingUsers: Array<{ clerkId: string; email: string | null }>
  mismatchedCount?: number
  mismatchedUsers?: ClerkSyncMismatch[]
}

type FetchRowsOptions = { showLoader?: boolean; enforceMinDelay?: boolean }

type UseStaffDirectoryAdminInput = {
  canAccessUsersNav: boolean
  canManageClerkSync: boolean
  shouldFetchClerkSyncHealth: boolean
  scheduleEventsByDay: Record<string, ScheduleEvent[]>
  ensureMinimumLoadingTime: (startedAt: number) => Promise<void>
  handleStaffAuthFailure: (status: number) => boolean
  isInsideCriticalClassWindow: (eventsByDay: Record<string, ScheduleEvent[]>, nowMs?: number) => boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
  enableAutoRefresh?: boolean
}

const STAFF_USERS_CRITICAL_REFRESH_MS = 15_000
const STAFF_USERS_NORMAL_REFRESH_MS = 60_000
const STAFF_PRESENCE_BACKOFF_MAX_MS = 300_000

export const useStaffDirectoryAdmin = ({
  canAccessUsersNav,
  canManageClerkSync,
  shouldFetchClerkSyncHealth,
  scheduleEventsByDay,
  ensureMinimumLoadingTime,
  handleStaffAuthFailure,
  isInsideCriticalClassWindow,
  setError,
  enableAutoRefresh = true,
}: UseStaffDirectoryAdminInput) => {
  const fetchInFlightRef = React.useRef(false)
  const backoffUntilRef = React.useRef(0)
  const consecutiveFailuresRef = React.useRef(0)
  const [rows, setRows] = React.useState<StaffUserRow[]>([])
  const [payrollModelOptions, setPayrollModelOptions] = React.useState<StaffPaymentModelOption[]>([])
  const [payrollModelLoading, setPayrollModelLoading] = React.useState(false)
  const [payrollModelError, setPayrollModelError] = React.useState<string | null>(null)
  const [payrollModelActionByUserId, setPayrollModelActionByUserId] = React.useState<Record<string, PayrollModelActionState>>({})
  const [loading, setLoading] = React.useState(true)
  const [query, setQuery] = React.useState("")
  const [busyUserId, setBusyUserId] = React.useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = React.useState<StaffCategory | "all">("all")
  const [presenceMenuUserId, setPresenceMenuUserId] = React.useState<string | null>(null)
  const [clerkSyncHealth, setClerkSyncHealth] = React.useState<ClerkSyncHealth | null>(null)
  const [clerkSyncLoading, setClerkSyncLoading] = React.useState(false)
  const [clerkSyncRepairing, setClerkSyncRepairing] = React.useState(false)
  const [clerkSyncError, setClerkSyncError] = React.useState<string | null>(null)
  const [clerkSyncMessage, setClerkSyncMessage] = React.useState<string | null>(null)
  const [clerkSyncUserBusyId, setClerkSyncUserBusyId] = React.useState<string | null>(null)

  const fetchRows = React.useCallback(async (search?: string, category?: StaffCategory | "all", options?: FetchRowsOptions) => {
    if (fetchInFlightRef.current) return
    if (Date.now() < backoffUntilRef.current) return

    fetchInFlightRef.current = true
    const showLoader = options?.showLoader ?? true
    const enforceMinDelay = options?.enforceMinDelay ?? showLoader
    const startedAt = Date.now()
    if (showLoader) setLoading(true)
    setError(null)
    try {
      const url = new URL("/api/staff/users", window.location.origin)
      if (search?.trim()) url.searchParams.set("q", search.trim())
      if (category && category !== "all") url.searchParams.set("category", category)
      const res = await fetch(url.toString(), {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        if (res.status === 429 || res.status === 503) {
          const retryAfterSec = Number(res.headers.get("Retry-After")) || 5
          const backoffMs = Math.min(retryAfterSec * 1000, STAFF_PRESENCE_BACKOFF_MAX_MS)
          const jitter = Math.floor(Math.random() * 1000)
          backoffUntilRef.current = Date.now() + backoffMs + jitter
          consecutiveFailuresRef.current += 1
        }
        setError(typeof data?.error === "string" ? data.error : "Failed to load staff users")
        if (showLoader) setRows([])
        return
      }
      consecutiveFailuresRef.current = 0
      backoffUntilRef.current = 0
      setRows(Array.isArray(data?.items) ? data.items : [])
    } catch {
      consecutiveFailuresRef.current += 1
      const backoffMs = Math.min(
        STAFF_USERS_NORMAL_REFRESH_MS * Math.pow(2, consecutiveFailuresRef.current),
        STAFF_PRESENCE_BACKOFF_MAX_MS
      )
      backoffUntilRef.current = Date.now() + backoffMs
      setError("Network error while loading staff users")
      if (showLoader) setRows([])
    } finally {
      fetchInFlightRef.current = false
      if (enforceMinDelay) await ensureMinimumLoadingTime(startedAt)
      if (showLoader) setLoading(false)
    }
  }, [ensureMinimumLoadingTime, handleStaffAuthFailure, setError])

  const updateRowAvatar = React.useCallback((userId: string, imageUrl: string) => {
    setRows((prev) => prev.map((row) => (row.id === userId ? { ...row, avatarUrl: imageUrl } : row)))
  }, [])

  const fetchClerkSyncHealth = React.useCallback(async () => {
    if (!canManageClerkSync) return
    setClerkSyncLoading(true)
    setClerkSyncError(null)
    try {
      const res = await fetch("/api/staff/users/sync-clerk/health", {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setClerkSyncHealth(null)
        setClerkSyncError(typeof data?.error === "string" ? data.error : "Unable to check user sync status.")
        return
      }
      setClerkSyncHealth({
        clerkUsers: typeof data?.clerkUsers === "number" ? data.clerkUsers : 0,
        dbUsersWithClerkId: typeof data?.dbUsersWithClerkId === "number" ? data.dbUsersWithClerkId : 0,
        missingCount: typeof data?.missingCount === "number" ? data.missingCount : 0,
        missingUsers: Array.isArray(data?.missingUsers) ? data.missingUsers : [],
        mismatchedCount: typeof data?.mismatchedCount === "number" ? data.mismatchedCount : 0,
        mismatchedUsers: Array.isArray(data?.mismatchedUsers) ? data.mismatchedUsers : [],
      })
    } catch {
      setClerkSyncHealth(null)
      setClerkSyncError("Network error while checking user sync status.")
    } finally {
      setClerkSyncLoading(false)
    }
  }, [canManageClerkSync, handleStaffAuthFailure])

  const repairClerkSync = React.useCallback(async () => {
    if (!canManageClerkSync) return
    setClerkSyncRepairing(true)
    setClerkSyncError(null)
    setClerkSyncMessage(null)
    try {
      const res = await fetch("/api/staff/users/sync-clerk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setClerkSyncError(typeof data?.error === "string" ? data.error : "Unable to sync users.")
        return
      }
      const missingAfterSync = typeof data?.missingAfterSync === "number" ? data.missingAfterSync : 0
      const synced = typeof data?.synced === "number" ? data.synced : 0
      setClerkSyncMessage(
        missingAfterSync === 0
          ? `${synced} users are now up to date.`
          : `Repair finished, but ${missingAfterSync} users still need attention.`
      )
      await fetchClerkSyncHealth()
      await fetchRows(query, categoryFilter, { showLoader: false, enforceMinDelay: false })
    } catch {
      setClerkSyncError("Network error while syncing users.")
    } finally {
      setClerkSyncRepairing(false)
    }
  }, [canManageClerkSync, categoryFilter, fetchClerkSyncHealth, fetchRows, handleStaffAuthFailure, query])

  const syncClerkUser = React.useCallback(async (userId: string) => {
    if (!canManageClerkSync || !userId) return
    setClerkSyncUserBusyId(userId)
    setClerkSyncError(null)
    setClerkSyncMessage(null)
    try {
      const res = await fetch(`/api/staff/users/sync-clerk/${encodeURIComponent(userId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setClerkSyncError(typeof data?.error === "string" ? data.error : "Unable to sync user.")
        return
      }
      setClerkSyncMessage("Student synced from Clerk (phone preserved).")
      await fetchClerkSyncHealth()
      await fetchRows(query, categoryFilter, { showLoader: false, enforceMinDelay: false })
    } catch {
      setClerkSyncError("Network error while syncing user.")
    } finally {
      setClerkSyncUserBusyId(null)
    }
  }, [canManageClerkSync, categoryFilter, fetchClerkSyncHealth, fetchRows, handleStaffAuthFailure, query])

  const clerkMismatchByUserId = React.useMemo(() => {
    const map = new Map<string, ClerkSyncMismatch>()
    for (const mismatch of clerkSyncHealth?.mismatchedUsers ?? []) {
      map.set(mismatch.userId, mismatch)
    }
    return map
  }, [clerkSyncHealth])

  const fetchPayrollModelOptions = React.useCallback(async () => {
    setPayrollModelLoading(true)
    setPayrollModelError(null)
    try {
      const res = await fetch("/api/staff/payroll/payment-models", {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setPayrollModelOptions([])
        setPayrollModelError(typeof data?.error === "string" ? data.error : "Failed to load payroll models")
        return
      }
      setPayrollModelOptions(
        Array.isArray(data?.items)
          ? data.items
              .map((item: unknown) => {
                const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
                return {
                  id: typeof record.id === "string" ? record.id : "",
                  name: typeof record.name === "string" ? record.name.trim() : "",
                  active: record.active !== false,
                  isDefault: record.isDefault === true,
                }
              })
              .filter((item: { id: string; name: string }) => item.id && item.name)
          : []
      )
    } catch {
      setPayrollModelOptions([])
      setPayrollModelError("Network error while loading payroll models")
    } finally {
      setPayrollModelLoading(false)
    }
  }, [handleStaffAuthFailure])

  const updateStaffPayrollModel = React.useCallback(async (userId: string, paymentModelId: string | null) => {
    setPayrollModelActionByUserId((prev) => ({
      ...prev,
      [userId]: { status: "saving", message: "Saving payroll model..." },
    }))
    try {
      const res = await fetch(`/api/staff/users/${userId}/payroll-model`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentModelId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setPayrollModelActionByUserId((prev) => ({
          ...prev,
          [userId]: {
            status: "error",
            message: typeof data?.error === "string" ? data.error : "Unable to update payroll model.",
          },
        }))
        return
      }
      setRows((prev) =>
        prev.map((row) =>
          row.id === userId
            ? { ...row, paymentModelId: typeof data?.paymentModelId === "string" ? data.paymentModelId : null }
            : row
        )
      )
      setPayrollModelActionByUserId((prev) => ({
        ...prev,
        [userId]: {
          status: "success",
          message: paymentModelId ? "Payroll model updated." : "Using school default payroll model.",
        },
      }))
    } catch {
      setPayrollModelActionByUserId((prev) => ({
        ...prev,
        [userId]: { status: "error", message: "Network error while updating payroll model." },
      }))
    }
  }, [handleStaffAuthFailure])

  const runAction = React.useCallback(async (userId: string, action: string, payload?: Record<string, unknown>) => {
    setBusyUserId(userId)
    setError(null)
    try {
      const res = await fetch(`/api/staff/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(payload || {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Action failed")
        return
      }
      await fetchRows(query, categoryFilter)
    } catch {
      setError("Network error while updating staff user")
    } finally {
      setBusyUserId(null)
    }
  }, [categoryFilter, fetchRows, query, setError])

  const revokeStaff = React.useCallback(async (userId: string) => {
    setBusyUserId(userId)
    setError(null)
    try {
      const res = await fetch(`/api/staff/users/${userId}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to remove staff access")
        return
      }
      await fetchRows(query, categoryFilter)
    } catch {
      setError("Network error while removing staff access")
    } finally {
      setBusyUserId(null)
    }
  }, [categoryFilter, fetchRows, query, setError])

  React.useEffect(() => {
    if (!canAccessUsersNav) {
      setLoading(false)
      setRows([])
      setPayrollModelOptions([])
      setPayrollModelError(null)
      return
    }
    void fetchRows(undefined, categoryFilter)
    void fetchPayrollModelOptions()
  }, [canAccessUsersNav, fetchPayrollModelOptions, fetchRows, categoryFilter])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (!enableAutoRefresh) return
    if (!canAccessUsersNav) return
    let active = true
    let timeoutId: number | undefined
    const tick = () => {
      if (!active) return
      if (document.visibilityState !== "visible") return
      void fetchRows(query, categoryFilter, { showLoader: false, enforceMinDelay: false })
    }
    const scheduleNext = () => {
      if (!active) return
      const now = Date.now()
      const backoffRemaining = Math.max(0, backoffUntilRef.current - now)
      const baseInterval = isInsideCriticalClassWindow(scheduleEventsByDay, now)
        ? STAFF_USERS_CRITICAL_REFRESH_MS
        : STAFF_USERS_NORMAL_REFRESH_MS
      const delay = Math.max(baseInterval, backoffRemaining)
      timeoutId = window.setTimeout(() => {
        tick()
        scheduleNext()
      }, delay)
    }
    const handleVisibilityChange = () => {
      if (!active) return
      if (document.visibilityState !== "visible") return
      window.clearTimeout(timeoutId)
      void fetchRows(query, categoryFilter, { showLoader: false, enforceMinDelay: false })
      scheduleNext()
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    scheduleNext()
    return () => {
      active = false
      window.clearTimeout(timeoutId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [canAccessUsersNav, enableAutoRefresh, fetchRows, query, categoryFilter, scheduleEventsByDay, isInsideCriticalClassWindow])

  React.useEffect(() => {
    if (!presenceMenuUserId) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest("[data-presence-menu]")) return
      setPresenceMenuUserId(null)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [presenceMenuUserId])

  React.useEffect(() => {
    if (!shouldFetchClerkSyncHealth) return
    void fetchClerkSyncHealth()
  }, [fetchClerkSyncHealth, shouldFetchClerkSyncHealth])

  return {
    rows,
    loading,
    setError,
    query,
    setQuery,
    busyUserId,
    categoryFilter,
    setCategoryFilter,
    payrollModelOptions,
    payrollModelLoading,
    payrollModelError,
    payrollModelActionByUserId,
    presenceMenuUserId,
    setPresenceMenuUserId,
    clerkSyncHealth,
    clerkSyncLoading,
    clerkSyncRepairing,
    clerkSyncError,
    clerkSyncMessage,
    clerkSyncUserBusyId,
    clerkMismatchByUserId,
    fetchRows,
    updateRowAvatar,
    fetchClerkSyncHealth,
    repairClerkSync,
    syncClerkUser,
    updateStaffPayrollModel,
    runAction,
    revokeStaff,
  }
}
