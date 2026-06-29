import React from "react"

export type CreateStudentFormState = {
  email: string
  phone: string
  name: string
  amountCents: string
  paymentMode: "cash" | "card_qr" | ""
  note: string
  createAttendance: boolean
  attendanceSessionId: string
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
  attendanceSessionId: "",
}

export const createInitialStudentForm = (sessions: CreateStudentSessionOption[] = []): CreateStudentFormState => {
  const defaultSession = sessions.find((session) => session.isCurrent) || null
  return {
    ...INITIAL_FORM,
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
    checkIn: form.createAttendance
      ? { enabled: true, sessionId: form.attendanceSessionId || undefined }
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
    createAttendance: Boolean(defaultSession),
    attendanceSessionId: defaultSession?.id || "",
  }
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
        const res = await fetch("/api/staff/students/sessions")
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
  }, [isOpen])

  const updateField = React.useCallback(
    <K extends keyof CreateStudentFormState>(field: K, value: CreateStudentFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }))
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
