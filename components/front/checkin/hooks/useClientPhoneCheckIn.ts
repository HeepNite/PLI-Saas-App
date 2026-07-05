"use client"

import React from "react"

type CheckInResult = {
  status: "checked_in" | "already_checked_in" | "rejected" | "window_closed"
  attendance?: {
    id: string
    status: string
    checkedInAt: string
    courseSlug: string
    courseTitle: string
    startsAt: string
  }
  cashPending?: boolean
  cashAmount?: number
  package?: {
    id: string
    packageLabel: string | null
    isUnlimited: boolean
    remainingCredits: number | null
  } | null
  points?: {
    awarded: number
    milestone: number | null
    attendanceCount: number
    milestoneEvery: number
  }
  message?: string
  courseTitle?: string
  consecutiveOffer?: {
    linkedCourseSlug: string
    linkedCourseTitle: string
    dropInConsecutiveCents: number | null
    discountPercent: number
  } | null
}

type UseClientPhoneCheckInParams = {
  courseSlug: string
  date: string
  time: string
  durationMinutes?: number
}

export function useClientPhoneCheckIn(params: UseClientPhoneCheckInParams) {
  const [loading, setLoading] = React.useState(true)
  const [result, setResult] = React.useState<CheckInResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const calledRef = React.useRef(false)

  React.useEffect(() => {
    if (calledRef.current) return
    if (!params.courseSlug || !params.date || !params.time) {
      setLoading(false)
      setError("Missing check-in parameters.")
      return
    }

    calledRef.current = true
    const controller = new AbortController()

    void (async () => {
      try {
        const res = await fetch("/api/checkin/qr/client-phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseSlug: params.courseSlug,
            date: params.date,
            time: params.time,
            durationMinutes: params.durationMinutes,
          }),
          signal: controller.signal,
        })

        if (res.status === 401) {
          setError("sign_in_required")
          return
        }

        const data = await res.json()

        if (!res.ok) {
          setError(data?.error || "Unable to check in.")
          return
        }

        setResult(data as CheckInResult)
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError("Unable to check in. Please try again.")
      } finally {
        setLoading(false)
      }
    })()

    return () => controller.abort()
  }, [params.courseSlug, params.date, params.time, params.durationMinutes])

  return { loading, result, error }
}
