import React from "react"

export type CreateStudentFormState = {
  email: string
  phone: string
  name: string
  amountCents: string
  paymentMode: "cash" | "card_qr" | ""
  note: string
  createAttendance: boolean
  attendanceDate: string
  attendanceSessionId: string
  recoveryTicket: string
  packagePlanId: string
  packageReason: string
}

export type CreateStudentSessionOption = { id: string; courseSlug: string; title: string; startsAt: string; durationMinutes: number | null; isCurrent: boolean }
export type CreateStudentPackagePlanOption = { id: string; label: string; priceCents: number | null }

export type CreateStudentResult = {
  userId: string
  clerkUserId: string
  isExisting: boolean
  purchaseId?: string
  paymentMode?: "cash" | "card_qr"
  stripeCheckoutUrl?: string
  activation: {
    emailInvitationAttempted: boolean
    phoneSignInAvailable: boolean
  }
}

const getTodayNewYork = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)?.value || ""
  return `${part("year")}-${part("month")}-${part("day")}`
}

const getHistoricalDateMinimum = (todayNewYork: string) => {
  const [year, month, day] = todayNewYork.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day - 14)).toISOString().slice(0, 10)
}

export const getStudentAttendanceDateBounds = () => {
  const maximum = getTodayNewYork()
  return { minimum: getHistoricalDateMinimum(maximum), maximum }
}

const INITIAL_FORM: CreateStudentFormState = {
  email: "",
  phone: "",
  name: "",
  amountCents: "",
  paymentMode: "",
  note: "",
  createAttendance: false,
  attendanceDate: getTodayNewYork(),
  attendanceSessionId: "",
  recoveryTicket: "",
  packagePlanId: "",
  packageReason: "",
}

type UseStaffCreateStudentAdminOptions = {
  onSuccess: () => Promise<void>
  handleStaffAuthFailure: (status: number) => boolean
}

export function useStaffCreateStudentAdmin({
  onSuccess,
  handleStaffAuthFailure,
}: UseStaffCreateStudentAdminOptions) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [form, setForm] = React.useState<CreateStudentFormState>(INITIAL_FORM)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<CreateStudentResult | null>(null)
  const [attendanceSessions, setAttendanceSessions] = React.useState<CreateStudentSessionOption[]>([])
  const [packagePlans, setPackagePlans] = React.useState<CreateStudentPackagePlanOption[]>([])
  const [packagePlansLoading, setPackagePlansLoading] = React.useState(false)

  const openModal = React.useCallback(() => {
    setForm(INITIAL_FORM)
    setError(null)
    setResult(null)
    setIsOpen(true)
  }, [])

  const closeModal = React.useCallback(() => {
    setIsOpen(false)
    setForm(INITIAL_FORM)
    setAttendanceSessions([])
    setPackagePlans([])
    setError(null)
    setResult(null)
  }, [])

  const updateField = React.useCallback(
    <K extends keyof CreateStudentFormState>(field: K, value: CreateStudentFormState[K]) => {
      const clearsAttendanceSelection = field === "attendanceDate" || (field === "createAttendance" && !value)
      setForm((prev) => ({ ...prev, [field]: value, ...(clearsAttendanceSelection ? { attendanceSessionId: "" } : {}) }))
      if (clearsAttendanceSelection) setAttendanceSessions([])
    },
    []
  )

  const submit = React.useCallback(async () => {
    setError(null)
    setSubmitting(true)

    const hasPackage = Boolean(form.packagePlanId)
    const amountCents = hasPackage || !form.amountCents.trim() ? 0 : Math.round(Number(form.amountCents) * 100)

    try {
      const res = await fetch("/api/staff/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          name: form.name.trim() || undefined,
          amountCents,
          paymentMode: amountCents > 0 ? form.paymentMode || undefined : undefined,
          note: form.note.trim() || undefined,
          recoveryTicket: form.recoveryTicket || undefined,
          checkIn: form.createAttendance ? { enabled: true, date: form.attendanceDate, sessionId: form.attendanceSessionId || undefined } : undefined,
          package: form.packagePlanId ? { packagePlanId: form.packagePlanId, reason: form.packageReason.trim() } : undefined,
        }),
      })

      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        const data = await res.json().catch(() => ({}))
        setError(data.error || (res.status === 409 ? "This user already exists in the system." : `Request failed (${res.status})`))
        return
      }

      const data: CreateStudentResult = await res.json()
      setResult(data)
      await onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setSubmitting(false)
    }
  }, [form, handleStaffAuthFailure, onSuccess])

  React.useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setPackagePlansLoading(true)
    void fetch("/api/staff/students/package-plans")
      .then(async (res) => {
        if (res.ok) return res.json()
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Unable to load package plans (${res.status})`)
      })
      .then((data) => {
        if (!cancelled) setPackagePlans(Array.isArray(data.items) ? data.items : [])
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load package plans")
      })
      .finally(() => {
        if (!cancelled) setPackagePlansLoading(false)
      })
    return () => { cancelled = true }
  }, [isOpen])

  React.useEffect(() => {
    if (!isOpen || !form.createAttendance) {
      setAttendanceSessions([])
      return
    }
    let cancelled = false
    setAttendanceSessions([])
    void fetch(`/api/staff/students/sessions?date=${encodeURIComponent(form.attendanceDate)}`)
      .then(async (res) => {
        if (res.ok) return res.json()
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Unable to load class sessions (${res.status})`)
      })
      .then((data) => {
        if (!cancelled) setAttendanceSessions(Array.isArray(data.items) ? data.items : [])
      })
      .catch((reason) => {
        if (cancelled) return
        setAttendanceSessions([])
        setError(reason instanceof Error ? reason.message : "Unable to load class sessions")
      })
    return () => { cancelled = true }
  }, [form.attendanceDate, form.createAttendance, isOpen])

  const hasAmount = React.useMemo(() => {
    const parsed = Number(form.amountCents)
    return Number.isFinite(parsed) && parsed > 0
  }, [form.amountCents])

  const canSubmit = React.useMemo(() => {
    if (submitting) return false
    if (!form.email.trim() && !form.phone.trim()) return false
    if (!form.packagePlanId && hasAmount && !form.paymentMode) return false
    if (form.createAttendance && !form.attendanceSessionId) return false
    if (form.packagePlanId && !form.packageReason.trim()) return false
    return true
  }, [form.email, form.phone, form.paymentMode, form.createAttendance, form.attendanceSessionId, form.packagePlanId, form.packageReason, hasAmount, submitting])

  return {
    isOpen,
    form,
    submitting,
    error,
    result,
    attendanceSessions,
    packagePlans,
    packagePlansLoading,
    hasAmount,
    canSubmit,
    openModal,
    closeModal,
    updateField,
    submit,
  }
}
