import React from "react"

import { useAuth } from "@clerk/nextjs"

import {
  getDefaultStaffPortalSection,
  hasExplicitStaffPermission,
  resolveStaffPortalSections,
  type StaffPortalSection,
} from "@/lib/security/staff-access"
import type { StaffCategory } from "@/lib/security/staff-category"
import type { StaffRole } from "@/lib/security/staff-role"

import type { StaffPortalNavItem } from "./StaffPortalNavButton"
import type { StaffUserRow } from "./staffAdminTypes"

const MIN_LOADING_DELAY_MS = 3000
const STAFF_USERS_NORMAL_REFRESH_MS = 60_000
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type SearchParamsReader = {
  get: (name: string) => string | null
}

export type StaffAuthedFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

type UseStaffAuthedFetchOptions = {
  getToken?: (options?: { skipCache?: boolean }) => Promise<string | null>
}

/**
 * Wraps `fetch` for the staff admin panel so a single transient 401 (e.g. a
 * Safari/iOS session-cookie eviction) does not force a full logout. On a 401
 * it forces a Clerk token refresh and retries the SAME request exactly once,
 * then returns the response as-is.
 *
 * This wrapper does NOT handle a genuinely-dead session itself: on a persistent
 * 401 it returns the 401 response, and the CALLER's existing
 * `handleStaffAuthFailure(res.status)` check remains the single redirect choke
 * point. Keeping the redirect in one place avoids a double invocation.
 *
 * ASSUMPTION (see design Decision 2, to be confirmed at verify): Clerk's
 * browser SDK keeps the `__session` cookie in sync with the active session,
 * so `getToken({ skipCache: true })` re-mints the token and updates the
 * cookie in time for the immediate cookie-based retry to authenticate. If
 * live verification shows a timing race (retry still 401s despite a fresh
 * token), the documented fallback is to attach the freshly returned token as
 * `Authorization: Bearer <token>` on the retry only — isolated to this
 * wrapper, no other call-site changes required.
 *
 * Retry state is a request-LOCAL variable, not React state or a ref: it is
 * scoped to a single invocation of `staffAuthedFetch`, so concurrent pollers
 * and re-renders never share or extend the retry bound (at most one retry
 * per failed request, never a loop).
 *
 * NOTE: the retry re-sends the SAME `init`. This is safe for the Slice-1 GET
 * pollers (no body). Future POST call sites with a single-use body (e.g. a
 * ReadableStream) must clone/guard the body before adopting this wrapper.
 */
function useStaffAuthedFetch({ getToken }: UseStaffAuthedFetchOptions): StaffAuthedFetch {
  return React.useCallback<StaffAuthedFetch>(async (input, init) => {
    const res = await fetch(input, init)
    if (res.status !== 401) return res

    // Force a Clerk token refresh before the single retry. `getToken` can be
    // undefined while Clerk is still initializing, and can reject when offline —
    // in both cases we still retry once; a persistent 401 surfaces to the caller.
    try {
      await getToken?.({ skipCache: true })
    } catch {
      // ignore refresh failure; the retry (and the caller) handle a real 401
    }
    return fetch(input, init)
  }, [getToken])
}

type UseStaffPortalShellAdminOptions = {
  currentRole: StaffRole
  resolvedCurrentCategory: StaffCategory
  navItems: StaffPortalNavItem[]
  searchParams: SearchParamsReader
  expandAssistantRail: () => void
  setError: (message: string | null) => void
}

export function useStaffPortalShellAdmin({
  currentRole,
  resolvedCurrentCategory,
  navItems,
  searchParams,
  expandAssistantRail,
  setError,
}: UseStaffPortalShellAdminOptions) {
  const { getToken } = useAuth()
  const [nowTs, setNowTs] = React.useState(() => Date.now())
  const defaultNav = getDefaultStaffPortalSection(currentRole, resolvedCurrentCategory) || "profile"
  const [activeNav, setActiveNav] = React.useState<StaffPortalSection>(defaultNav)

  const allowedNavSections = React.useMemo(
    () => resolveStaffPortalSections(currentRole, resolvedCurrentCategory),
    [currentRole, resolvedCurrentCategory]
  )
  const visibleNavItems = React.useMemo(
    () => navItems.filter((item) => allowedNavSections.includes(item.key)),
    [allowedNavSections, navItems]
  )

  const canAccessUsersNav = allowedNavSections.includes("users")
  const canAccessStudentsNav = allowedNavSections.includes("students")
  const canAccessSchoolNav = allowedNavSections.includes("schedule")
  const canAccessTerminalsNav = allowedNavSections.includes("terminals")
  const canAccessReportsNav = allowedNavSections.includes("reports")
  const canAccessAssistantNav = allowedNavSections.includes("assistant")
  const canAccessSettingsNav = allowedNavSections.includes("settings")
  const canAccessProfileNav = allowedNavSections.includes("profile")
  const canManageTerminalSetup = currentRole === "owner" || currentRole === "admin"
  const canOperateStudentPins = hasExplicitStaffPermission(currentRole, resolvedCurrentCategory, "studentPinOps")
  const canManageClerkSync = currentRole === "owner" || currentRole === "admin"
  const isStudentsView = activeNav === "students" && canAccessStudentsNav
  const isReportsView = activeNav === "reports" && canAccessReportsNav
  const isSchoolView = activeNav === "schedule" && canAccessSchoolNav
  const isTerminalView = activeNav === "terminals" && canAccessTerminalsNav
  const isAssistantView = activeNav === "assistant" && canAccessAssistantNav
  const isSettingsView = activeNav === "settings" && canAccessSettingsNav
  const isProfileView = activeNav === "profile" && canAccessProfileNav
  const showStaffOps = activeNav === "users" && canAccessUsersNav

  const activeNavLabel = React.useMemo(
    () => visibleNavItems.find((item) => item.key === activeNav)?.label ?? "Current section",
    [activeNav, visibleNavItems]
  )

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setNowTs(Date.now())
    }, STAFF_USERS_NORMAL_REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [])

  React.useEffect(() => {
    if (allowedNavSections.length === 0) return
    if (!allowedNavSections.includes(activeNav)) {
      const next = getDefaultStaffPortalSection(currentRole, resolvedCurrentCategory) || allowedNavSections[0]
      setActiveNav(next)
    }
  }, [activeNav, allowedNavSections, currentRole, resolvedCurrentCategory])

  React.useEffect(() => {
    const nav = searchParams.get("nav")
    if (!nav) return
    if (!allowedNavSections.includes(nav as StaffPortalSection)) return
    setActiveNav(nav as StaffPortalSection)
  }, [allowedNavSections, searchParams])

  const handleNavSelection = React.useCallback((nextNav: StaffPortalSection) => {
    setActiveNav(nextNav)
    if (nextNav === "assistant") {
      expandAssistantRail()
    }
  }, [expandAssistantRail])

  const assignableRoles = React.useMemo<StaffRole[]>(() => {
    return currentRole === "owner" ? ["owner", "admin", "staff"] : ["admin", "staff"]
  }, [currentRole])

  const canManageTarget = React.useCallback(
    (target: StaffUserRow) => {
      if (currentRole === "owner") return true
      if (target.role === "owner") return false
      return true
    },
    [currentRole]
  )

  const ensureMinimumLoadingTime = React.useCallback(async (startedAt: number) => {
    const elapsed = Date.now() - startedAt
    if (elapsed < MIN_LOADING_DELAY_MS) {
      await wait(MIN_LOADING_DELAY_MS - elapsed)
    }
  }, [])

  const handleStaffAuthFailure = React.useCallback((status: number) => {
    if (typeof window === "undefined") return false
    const navParam = new URL(window.location.href).searchParams.get("nav")
    const navQuery = navParam ? `&nav=${encodeURIComponent(navParam)}` : ""
    if (status === 401) {
      setError("Staff session expired. Please validate your PIN again.")
      // Send an expired session to the actual staff LOGIN screen (mode="login",
      // which creates a session), NOT /staff/checkin (attendance-only — it does
      // not re-authenticate). The `error` param also prevents the log-in page's
      // authenticated-redirect loop when a stale Clerk cookie is still present.
      window.location.href = `/staff/log-in?error=session_expired${navQuery}`
      return true
    }
    // 403 from data endpoints means the user lacks permission for that
    // specific resource, NOT that their session is invalid. Redirecting to
    // /staff/resolve would cause an infinite loop because resolve sends the
    // user right back to the portal. Instead, surface the error in-place and
    // let the caller decide how to degrade gracefully.
    if (status === 403) {
      setError("You don't have permission for this action.")
      return true
    }
    return false
  }, [setError])

  const staffAuthedFetch = useStaffAuthedFetch({ getToken })

  return {
    nowTs,
    activeNav,
    setActiveNav,
    allowedNavSections,
    visibleNavItems,
    canAccessUsersNav,
    canAccessStudentsNav,
    canAccessSchoolNav,
    canAccessTerminalsNav,
    canManageTerminalSetup,
    canAccessReportsNav,
    canAccessAssistantNav,
    canAccessSettingsNav,
    canAccessProfileNav,
    canOperateStudentPins,
    canManageClerkSync,
    isStudentsView,
    isReportsView,
    isSchoolView,
    isTerminalView,
    isAssistantView,
    isSettingsView,
    isProfileView,
    showStaffOps,
    activeNavLabel,
    handleNavSelection,
    assignableRoles,
    canManageTarget,
    ensureMinimumLoadingTime,
    handleStaffAuthFailure,
    staffAuthedFetch,
  }
}
