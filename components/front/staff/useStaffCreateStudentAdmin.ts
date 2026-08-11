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
}

export type CreateStudentSessionOption = {
  id: string
  courseSlug: string
  title: string
  startsAt: string
  durationMinutes: number | null
  isCurrent: boolean
}

export type CreateStudentResult = {
  userId: string
  clerkUserId: string
  isExisting: boolean
  purchaseId?: string
  paymentMode?: "cash" | "card_qr"
  stripeCheckoutUrl?: string
  attendanceId?: string
  activation: {
    emailInvitationAttempted: boolean
    phoneSignInAvailable: boolean
  }
}

const INITIAL_FORM: CreateStudentFormState = {
  email: "",
  phone: "",
  name: "",
  amountCents: "",
  paymentMode: "",
  note: "",
  createAttendance: false,
  attendanceDate: "",
  attendanceSessionId: "",
  recoveryTicket: "",
}

export const getTodayStaffDate = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const year = parts.find((part) => part.type === "year")?.value ?? ""
  const month = parts.find((part) => part.type === "month")?.value ?? ""
  const day = parts.find((part) => part.type === "day")?.value ?? ""
  return year && month && day ? `${year}-${month}-${day}` : now.toISOString().slice(0, 10)
}

export const STAFF_ATTENDANCE_BACKFILL_DAYS = 14

const addDaysToDateKey = (dateKey: string, days: number) => {
  const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10))
  const value = new Date(Date.UTC(year, month - 1, day + days))
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`
}

export const getEarliestStaffAttendanceDate = (now = new Date()) =>
  addDaysToDateKey(getTodayStaffDate(now), -STAFF_ATTENDANCE_BACKFILL_DAYS)

export const getStudentAttendanceDateBounds = (now = new Date()) => ({
  minimum: getEarliestStaffAttendanceDate(now),
  maximum: getTodayStaffDate(now),
})

export const buildCreateStudentSessionsRequestUrl = (date: string) => {
  const query = date ? `?date=${encodeURIComponent(date)}` : ""
  return `/api/staff/students/sessions${query}`
}

export const createInitialStudentForm = (sessions: CreateStudentSessionOption[] = []): CreateStudentFormState => {
  const defaultSession = sessions.find((session) => session.isCurrent) || null
  return {
    ...INITIAL_FORM,
    attendanceDate: getTodayStaffDate(),
    createAttendance: Boolean(defaultSession),
    attendanceSessionId: defaultSession?.id || "",
  }
}

export const buildCreateStudentRequestBody = (form: CreateStudentFormState) => {
  const amountCents = form.amountCents.trim() ? Math.round(Number(form.amountCents) * 100) : 0
  return {
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    name: form.name.trim() || undefined,
    amountCents,
    paymentMode: amountCents > 0 ? form.paymentMode || undefined : undefined,
    note: form.note.trim() || undefined,
    recoveryTicket: form.recoveryTicket || undefined,
    checkIn: form.createAttendance
      ? { enabled: true, date: form.attendanceDate || undefined, sessionId: form.attendanceSessionId || undefined }
      : undefined,
  }
}

export const canSubmitCreateStudentForm = (input: {
  form: CreateStudentFormState
  hasAmount: boolean
  submitting: boolean
}) => {
  if (input.submitting) return false
  if (!input.form.email.trim() && !input.form.phone.trim()) return false
  if (input.hasAmount && !input.form.paymentMode) return false
  if (input.form.createAttendance && !input.form.attendanceSessionId) return false
  return true
}

export const reconcileCreateStudentFormWithSessions = (
  form: CreateStudentFormState,
  sessions: CreateStudentSessionOption[]
): CreateStudentFormState => {
  if (form.attendanceSessionId && sessions.some((session) => session.id === form.attendanceSessionId)) {
    return form
  }

  const defaultSession = sessions.find((session) => session.isCurrent) || null
  return {
    ...form,
    createAttendance: form.createAttendance || Boolean(defaultSession),
    attendanceSessionId: defaultSession?.id || "",
  }
}

export const updateCreateStudentFormField = <K extends keyof CreateStudentFormState>(
  form: CreateStudentFormState,
  field: K,
  value: CreateStudentFormState[K]
): CreateStudentFormState => {
  if (field === "attendanceDate") {
    return { ...form, attendanceDate: value as string, attendanceSessionId: "" }
  }

  return { ...form, [field]: value }
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
  const [attendanceSessions, setAttendanceSessions] = React.useState<CreateStudentSessionOption[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<CreateStudentResult | null>(null)

  const openModal = React.useCallback(() => {
    setForm(createInitialStudentForm(attendanceSessions))
    setError(null)
    setResult(null)
    setIsOpen(true)
  }, [attendanceSessions])

  const closeModal = React.useCallback(() => {
    setIsOpen(false)
    setForm(createInitialStudentForm(attendanceSessions))
    setError(null)
    setResult(null)
  }, [attendanceSessions])

  React.useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    const loadSessions = async () => {
      try {
        const res = await fetch(buildCreateStudentSessionsRequestUrl(form.attendanceDate))
        if (!res.ok) return
        const data = await res.json().catch(() => ({}))
        const sessions = Array.isArray(data.items) ? data.items as CreateStudentSessionOption[] : []
        if (cancelled) return
        setAttendanceSessions(sessions)
        setForm((prev) => reconcileCreateStudentFormWithSessions(prev, sessions))
      } catch {
        // Attendance is optional; leave manual creation usable if sessions cannot load.
      }
    }

    void loadSessions()

    return () => {
      cancelled = true
    }
  }, [form.attendanceDate, isOpen])

  const updateField = React.useCallback(
    <K extends keyof CreateStudentFormState>(field: K, value: CreateStudentFormState[K]) => {
      setForm((prev) => updateCreateStudentFormField(prev, field, value))
    },
    []
  )

  const submit = React.useCallback(async () => {
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch("/api/staff/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCreateStudentRequestBody(form)),
      })

      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        const data = await res.json().catch(() => ({}))
        setError(data.error || `Request failed (${res.status})`)
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

  const hasAmount = React.useMemo(() => {
    const parsed = Number(form.amountCents)
    return Number.isFinite(parsed) && parsed > 0
  }, [form.amountCents])

  const canSubmit = React.useMemo(() => {
    return canSubmitCreateStudentForm({ form, hasAmount, submitting })
  }, [form, hasAmount, submitting])

  return {
    isOpen,
    form,
    submitting,
    error,
    result,
    attendanceSessions,
    hasAmount,
    canSubmit,
    openModal,
    closeModal,
    updateField,
    submit,
  }
}
