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

// ---------------------------------------------------------------------------
// Data reducer
// ---------------------------------------------------------------------------

type DataState = {
  rows: StaffUserRow[]
  loading: boolean
  query: string
  categoryFilter: StaffCategory | "all"
  busyUserId: string | null
  presenceMenuUserId: string | null
}

type DataAction =
  | { type: "SET_ROWS"; payload: StaffUserRow[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_QUERY"; payload: string }
  | { type: "SET_CATEGORY_FILTER"; payload: StaffCategory | "all" }
  | { type: "SET_BUSY_USER_ID"; payload: string | null }
  | { type: "SET_PRESENCE_MENU_USER_ID"; payload: string | null }
  | { type: "UPDATE_ROW_AVATAR"; payload: { userId: string; imageUrl: string } }
  | { type: "UPDATE_ROW_PAYMENT_MODEL_ID"; payload: { userId: string; paymentModelId: string | null } }
  | { type: "RESET_ACCESS_DENIED" }

const initialDataState: DataState = {
  rows: [],
  loading: true,
  query: "",
  categoryFilter: "all",
  busyUserId: null,
  presenceMenuUserId: null,
}

function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case "SET_ROWS":
      return { ...state, rows: action.payload }
    case "SET_LOADING":
      return { ...state, loading: action.payload }
    case "SET_QUERY":
      return { ...state, query: action.payload }
    case "SET_CATEGORY_FILTER":
      return { ...state, categoryFilter: action.payload }
    case "SET_BUSY_USER_ID":
      return { ...state, busyUserId: action.payload }
    case "SET_PRESENCE_MENU_USER_ID":
      return { ...state, presenceMenuUserId: action.payload }
    case "UPDATE_ROW_AVATAR":
      return {
        ...state,
        rows: state.rows.map((row) =>
          row.id === action.payload.userId ? { ...row, avatarUrl: action.payload.imageUrl } : row
        ),
      }
    case "UPDATE_ROW_PAYMENT_MODEL_ID":
      return {
        ...state,
        rows: state.rows.map((row) =>
          row.id === action.payload.userId ? { ...row, paymentModelId: action.payload.paymentModelId } : row
        ),
      }
    case "RESET_ACCESS_DENIED":
      return { ...state, loading: false, rows: [] }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Payroll reducer
// ---------------------------------------------------------------------------

type PayrollState = {
  payrollModelOptions: StaffPaymentModelOption[]
  payrollModelLoading: boolean
  payrollModelError: string | null
  payrollModelActionByUserId: Record<string, PayrollModelActionState>
}

type PayrollAction =
  | { type: "SET_PAYROLL_OPTIONS"; payload: StaffPaymentModelOption[] }
  | { type: "SET_PAYROLL_LOADING"; payload: boolean }
  | { type: "SET_PAYROLL_ERROR"; payload: string | null }
  | { type: "SET_PAYROLL_ACTION"; payload: { userId: string; state: PayrollModelActionState } }
  | { type: "RESET_PAYROLL_OPTIONS" }

const initialPayrollState: PayrollState = {
  payrollModelOptions: [],
  payrollModelLoading: false,
  payrollModelError: null,
  payrollModelActionByUserId: {},
}

function payrollReducer(state: PayrollState, action: PayrollAction): PayrollState {
  switch (action.type) {
    case "SET_PAYROLL_OPTIONS":
      return { ...state, payrollModelOptions: action.payload }
    case "SET_PAYROLL_LOADING":
      return { ...state, payrollModelLoading: action.payload }
    case "SET_PAYROLL_ERROR":
      return { ...state, payrollModelError: action.payload }
    case "SET_PAYROLL_ACTION":
      return {
        ...state,
        payrollModelActionByUserId: {
          ...state.payrollModelActionByUserId,
          [action.payload.userId]: action.payload.state,
        },
      }
    case "RESET_PAYROLL_OPTIONS":
      return { ...state, payrollModelOptions: [], payrollModelError: null }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Clerk sync reducer
// ---------------------------------------------------------------------------

type ClerkSyncState = {
  clerkSyncHealth: ClerkSyncHealth | null
  clerkSyncLoading: boolean
  clerkSyncRepairing: boolean
  clerkSyncError: string | null
  clerkSyncMessage: string | null
  clerkSyncUserBusyId: string | null
}

type ClerkSyncAction =
  | { type: "SET_CLERK_SYNC_HEALTH"; payload: ClerkSyncHealth | null }
  | { type: "SET_CLERK_SYNC_LOADING"; payload: boolean }
  | { type: "SET_CLERK_SYNC_REPAIRING"; payload: boolean }
  | { type: "SET_CLERK_SYNC_ERROR"; payload: string | null }
  | { type: "SET_CLERK_SYNC_MESSAGE"; payload: string | null }
  | { type: "SET_CLERK_SYNC_USER_BUSY_ID"; payload: string | null }
  | { type: "CLERK_SYNC_BEGIN_HEALTH_FETCH" }
  | { type: "CLERK_SYNC_BEGIN_REPAIR" }
  | { type: "CLERK_SYNC_BEGIN_USER_SYNC"; payload: string }

const initialClerkSyncState: ClerkSyncState = {
  clerkSyncHealth: null,
  clerkSyncLoading: false,
  clerkSyncRepairing: false,
  clerkSyncError: null,
  clerkSyncMessage: null,
  clerkSyncUserBusyId: null,
}

function clerkSyncReducer(state: ClerkSyncState, action: ClerkSyncAction): ClerkSyncState {
  switch (action.type) {
    case "SET_CLERK_SYNC_HEALTH":
      return { ...state, clerkSyncHealth: action.payload }
    case "SET_CLERK_SYNC_LOADING":
      return { ...state, clerkSyncLoading: action.payload }
    case "SET_CLERK_SYNC_REPAIRING":
      return { ...state, clerkSyncRepairing: action.payload }
    case "SET_CLERK_SYNC_ERROR":
      return { ...state, clerkSyncError: action.payload }
    case "SET_CLERK_SYNC_MESSAGE":
      return { ...state, clerkSyncMessage: action.payload }
    case "SET_CLERK_SYNC_USER_BUSY_ID":
      return { ...state, clerkSyncUserBusyId: action.payload }
    case "CLERK_SYNC_BEGIN_HEALTH_FETCH":
      return { ...state, clerkSyncLoading: true, clerkSyncError: null }
    case "CLERK_SYNC_BEGIN_REPAIR":
      return { ...state, clerkSyncRepairing: true, clerkSyncError: null, clerkSyncMessage: null }
    case "CLERK_SYNC_BEGIN_USER_SYNC":
      return { ...state, clerkSyncUserBusyId: action.payload, clerkSyncError: null, clerkSyncMessage: null }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

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

  const [dataState, dispatchData] = React.useReducer(dataReducer, initialDataState)
  const [payrollState, dispatchPayroll] = React.useReducer(payrollReducer, initialPayrollState)
  const [clerkSyncState, dispatchClerkSync] = React.useReducer(clerkSyncReducer, initialClerkSyncState)

  // Keep a ref to the latest data state so SetStateAction functional-update forms can resolve
  const dataStateRef = React.useRef(dataState)
  dataStateRef.current = dataState

  // Convenience destructures so callbacks below read naturally
  const { rows, loading, query, categoryFilter, busyUserId, presenceMenuUserId } = dataState
  const { payrollModelOptions, payrollModelLoading, payrollModelError, payrollModelActionByUserId } = payrollState
  const {
    clerkSyncHealth,
    clerkSyncLoading,
    clerkSyncRepairing,
    clerkSyncError,
    clerkSyncMessage,
    clerkSyncUserBusyId,
  } = clerkSyncState

  const fetchRows = React.useCallback(async (search?: string, category?: StaffCategory | "all", options?: FetchRowsOptions) => {
    if (fetchInFlightRef.current) return
    if (Date.now() < backoffUntilRef.current) return

    fetchInFlightRef.current = true
    const showLoader = options?.showLoader ?? true
    const enforceMinDelay = options?.enforceMinDelay ?? showLoader
    const startedAt = Date.now()
    if (showLoader) dispatchData({ type: "SET_LOADING", payload: true })
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
        if (showLoader) dispatchData({ type: "SET_ROWS", payload: [] })
        return
      }
      consecutiveFailuresRef.current = 0
      backoffUntilRef.current = 0
      dispatchData({ type: "SET_ROWS", payload: Array.isArray(data?.items) ? data.items : [] })
    } catch {
      consecutiveFailuresRef.current += 1
      const backoffMs = Math.min(
        STAFF_USERS_NORMAL_REFRESH_MS * Math.pow(2, consecutiveFailuresRef.current),
        STAFF_PRESENCE_BACKOFF_MAX_MS
      )
      backoffUntilRef.current = Date.now() + backoffMs
      setError("Network error while loading staff users")
      if (showLoader) dispatchData({ type: "SET_ROWS", payload: [] })
    } finally {
      fetchInFlightRef.current = false
      if (enforceMinDelay) await ensureMinimumLoadingTime(startedAt)
      if (showLoader) dispatchData({ type: "SET_LOADING", payload: false })
    }
  }, [ensureMinimumLoadingTime, handleStaffAuthFailure, setError])

  const updateRowAvatar = React.useCallback((userId: string, imageUrl: string) => {
    dispatchData({ type: "UPDATE_ROW_AVATAR", payload: { userId, imageUrl } })
  }, [])

  const fetchClerkSyncHealth = React.useCallback(async () => {
    if (!canManageClerkSync) return
    dispatchClerkSync({ type: "CLERK_SYNC_BEGIN_HEALTH_FETCH" })
    try {
      const res = await fetch("/api/staff/users/sync-clerk/health", {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        dispatchClerkSync({ type: "SET_CLERK_SYNC_HEALTH", payload: null })
        dispatchClerkSync({
          type: "SET_CLERK_SYNC_ERROR",
          payload: typeof data?.error === "string" ? data.error : "Unable to check user sync status.",
        })
        return
      }
      dispatchClerkSync({
        type: "SET_CLERK_SYNC_HEALTH",
        payload: {
          clerkUsers: typeof data?.clerkUsers === "number" ? data.clerkUsers : 0,
          dbUsersWithClerkId: typeof data?.dbUsersWithClerkId === "number" ? data.dbUsersWithClerkId : 0,
          missingCount: typeof data?.missingCount === "number" ? data.missingCount : 0,
          missingUsers: Array.isArray(data?.missingUsers) ? data.missingUsers : [],
          mismatchedCount: typeof data?.mismatchedCount === "number" ? data.mismatchedCount : 0,
          mismatchedUsers: Array.isArray(data?.mismatchedUsers) ? data.mismatchedUsers : [],
        },
      })
    } catch {
      dispatchClerkSync({ type: "SET_CLERK_SYNC_HEALTH", payload: null })
      dispatchClerkSync({ type: "SET_CLERK_SYNC_ERROR", payload: "Network error while checking user sync status." })
    } finally {
      dispatchClerkSync({ type: "SET_CLERK_SYNC_LOADING", payload: false })
    }
  }, [canManageClerkSync, handleStaffAuthFailure])

  const repairClerkSync = React.useCallback(async () => {
    if (!canManageClerkSync) return
    dispatchClerkSync({ type: "CLERK_SYNC_BEGIN_REPAIR" })
    try {
      const res = await fetch("/api/staff/users/sync-clerk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        dispatchClerkSync({
          type: "SET_CLERK_SYNC_ERROR",
          payload: typeof data?.error === "string" ? data.error : "Unable to sync users.",
        })
        return
      }
      const missingAfterSync = typeof data?.missingAfterSync === "number" ? data.missingAfterSync : 0
      const synced = typeof data?.synced === "number" ? data.synced : 0
      dispatchClerkSync({
        type: "SET_CLERK_SYNC_MESSAGE",
        payload:
          missingAfterSync === 0
            ? `${synced} users are now up to date.`
            : `Repair finished, but ${missingAfterSync} users still need attention.`,
      })
      await fetchClerkSyncHealth()
      await fetchRows(query, categoryFilter, { showLoader: false, enforceMinDelay: false })
    } catch {
      dispatchClerkSync({ type: "SET_CLERK_SYNC_ERROR", payload: "Network error while syncing users." })
    } finally {
      dispatchClerkSync({ type: "SET_CLERK_SYNC_REPAIRING", payload: false })
    }
  }, [canManageClerkSync, categoryFilter, fetchClerkSyncHealth, fetchRows, handleStaffAuthFailure, query])

  const syncClerkUser = React.useCallback(async (userId: string) => {
    if (!canManageClerkSync || !userId) return
    dispatchClerkSync({ type: "CLERK_SYNC_BEGIN_USER_SYNC", payload: userId })
    try {
      const res = await fetch(`/api/staff/users/sync-clerk/${encodeURIComponent(userId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        dispatchClerkSync({
          type: "SET_CLERK_SYNC_ERROR",
          payload: typeof data?.error === "string" ? data.error : "Unable to sync user.",
        })
        return
      }
      dispatchClerkSync({ type: "SET_CLERK_SYNC_MESSAGE", payload: "Student synced from Clerk (phone preserved)." })
      await fetchClerkSyncHealth()
      await fetchRows(query, categoryFilter, { showLoader: false, enforceMinDelay: false })
    } catch {
      dispatchClerkSync({ type: "SET_CLERK_SYNC_ERROR", payload: "Network error while syncing user." })
    } finally {
      dispatchClerkSync({ type: "SET_CLERK_SYNC_USER_BUSY_ID", payload: null })
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
    dispatchPayroll({ type: "SET_PAYROLL_LOADING", payload: true })
    dispatchPayroll({ type: "SET_PAYROLL_ERROR", payload: null })
    try {
      const res = await fetch("/api/staff/payroll/payment-models", {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        dispatchPayroll({ type: "SET_PAYROLL_OPTIONS", payload: [] })
        dispatchPayroll({
          type: "SET_PAYROLL_ERROR",
          payload: typeof data?.error === "string" ? data.error : "Failed to load payroll models",
        })
        return
      }
      dispatchPayroll({
        type: "SET_PAYROLL_OPTIONS",
        payload: Array.isArray(data?.items)
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
          : [],
      })
    } catch {
      dispatchPayroll({ type: "SET_PAYROLL_OPTIONS", payload: [] })
      dispatchPayroll({ type: "SET_PAYROLL_ERROR", payload: "Network error while loading payroll models" })
    } finally {
      dispatchPayroll({ type: "SET_PAYROLL_LOADING", payload: false })
    }
  }, [handleStaffAuthFailure])

  const updateStaffPayrollModel = React.useCallback(async (userId: string, paymentModelId: string | null) => {
    dispatchPayroll({ type: "SET_PAYROLL_ACTION", payload: { userId, state: { status: "saving", message: "Saving payroll model..." } } })
    try {
      const res = await fetch(`/api/staff/users/${userId}/payroll-model`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentModelId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        dispatchPayroll({
          type: "SET_PAYROLL_ACTION",
          payload: {
            userId,
            state: {
              status: "error",
              message: typeof data?.error === "string" ? data.error : "Unable to update payroll model.",
            },
          },
        })
        return
      }
      dispatchData({
        type: "UPDATE_ROW_PAYMENT_MODEL_ID",
        payload: {
          userId,
          paymentModelId: typeof data?.paymentModelId === "string" ? data.paymentModelId : null,
        },
      })
      dispatchPayroll({
        type: "SET_PAYROLL_ACTION",
        payload: {
          userId,
          state: {
            status: "success",
            message: paymentModelId ? "Payroll model updated." : "Using school default payroll model.",
          },
        },
      })
    } catch {
      dispatchPayroll({
        type: "SET_PAYROLL_ACTION",
        payload: { userId, state: { status: "error", message: "Network error while updating payroll model." } },
      })
    }
  }, [handleStaffAuthFailure])

  const runAction = React.useCallback(async (userId: string, action: string, payload?: Record<string, unknown>) => {
    dispatchData({ type: "SET_BUSY_USER_ID", payload: userId })
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
      dispatchData({ type: "SET_BUSY_USER_ID", payload: null })
    }
  }, [categoryFilter, fetchRows, query, setError])

  const revokeStaff = React.useCallback(async (userId: string) => {
    dispatchData({ type: "SET_BUSY_USER_ID", payload: userId })
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
      dispatchData({ type: "SET_BUSY_USER_ID", payload: null })
    }
  }, [categoryFilter, fetchRows, query, setError])

  React.useEffect(() => {
    if (!canAccessUsersNav) {
      dispatchData({ type: "RESET_ACCESS_DENIED" })
      dispatchPayroll({ type: "RESET_PAYROLL_OPTIONS" })
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
      dispatchData({ type: "SET_PRESENCE_MENU_USER_ID", payload: null })
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
    setQuery: (value: string) => dispatchData({ type: "SET_QUERY", payload: value }),
    busyUserId,
    categoryFilter,
    setCategoryFilter: (value: StaffCategory | "all") => dispatchData({ type: "SET_CATEGORY_FILTER", payload: value }),
    payrollModelOptions,
    payrollModelLoading,
    payrollModelError,
    payrollModelActionByUserId,
    presenceMenuUserId,
    setPresenceMenuUserId: (action: React.SetStateAction<string | null>) => {
      const next = typeof action === "function" ? action(dataStateRef.current.presenceMenuUserId) : action
      dispatchData({ type: "SET_PRESENCE_MENU_USER_ID", payload: next })
    },
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
