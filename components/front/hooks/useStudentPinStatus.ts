"use client"

import React from "react"

export type StudentPinClientStatus = {
  enabled: boolean
  enrolled: boolean
  locked: boolean
  needsEnrollment: boolean
  permanent: { status: string | null; failedAttempts: number; lockedAt: string | null; lastVerifiedAt: string | null }
  provisional: { active: boolean; expiresAt: string | null }
}

const emptyStatus: StudentPinClientStatus = {
  enabled: false,
  enrolled: false,
  locked: false,
  needsEnrollment: false,
  permanent: { status: null, failedAttempts: 0, lockedAt: null, lastVerifiedAt: null },
  provisional: { active: false, expiresAt: null },
}

export const useStudentPinStatus = (active: boolean) => {
  const [status, setStatus] = React.useState<StudentPinClientStatus>(emptyStatus)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    if (!active) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/profile/pin")
      if (response.status === 404) {
        setStatus(emptyStatus)
        return
      }
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(data?.error || "Could not load PIN status.")
        return
      }
      setStatus({ ...emptyStatus, ...data, enabled: true })
    } catch {
      setError("Could not load PIN status.")
    } finally {
      setLoading(false)
    }
  }, [active])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  return { status, loading, error, refresh, setStatus }
}
