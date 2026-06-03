import React from "react"

type OverrideModalStudent = { id: string; name: string }

export function useStaffStudentAuditAdmin() {
  const [overrideModalStudent, setOverrideModalStudent] = React.useState<OverrideModalStudent | null>(null)
  const [usersWithAuditEntries, setUsersWithAuditEntries] = React.useState<Set<string>>(new Set())

  const overrideModalOpen = overrideModalStudent !== null

  const openOverrideModal = React.useCallback((studentId: string, studentName: string) => {
    setOverrideModalStudent({ id: studentId, name: studentName })
  }, [])

  const closeOverrideModal = React.useCallback(() => {
    setOverrideModalStudent(null)
  }, [])

  const markUserHasAuditEntries = React.useCallback((userId: string) => {
    setUsersWithAuditEntries((prev) => new Set(prev).add(userId))
  }, [])

  // Check if a user has audit entries in the current month (for showing the change-history button)
  const checkUserHasAuditEntries = React.useCallback(async (userId: string) => {
    if (usersWithAuditEntries.has(userId)) return

    try {
      const res = await fetch(`/api/staff/students/${encodeURIComponent(userId)}/audit-log?pageSize=50`)
      if (!res.ok) return

      const json = await res.json()
      const payload = json.data ?? json
      const entries = Array.isArray(payload?.entries) ? payload.entries : []
      const now = new Date()
      const hasCurrentMonthEntries = entries.some((entry: { createdAt?: string }) => {
        if (!entry.createdAt) return false
        const createdAt = new Date(entry.createdAt)
        return createdAt.getFullYear() === now.getFullYear() && createdAt.getMonth() === now.getMonth()
      })

      if (hasCurrentMonthEntries) {
        markUserHasAuditEntries(userId)
      }
    } catch {
      // Silently fail — user just won't see the button
    }
  }, [markUserHasAuditEntries, usersWithAuditEntries])

  return {
    overrideModalStudent,
    overrideModalOpen,
    usersWithAuditEntries,
    openOverrideModal,
    closeOverrideModal,
    markUserHasAuditEntries,
    checkUserHasAuditEntries,
  }
}
