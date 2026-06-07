import React from "react"

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
    const navSuffix = navParam ? `?nav=${encodeURIComponent(navParam)}` : ""
    if (status === 401) {
      setError("Staff session expired. Please validate your PIN again.")
      window.location.href = `/staff/checkin${navSuffix}`
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
  }
}
