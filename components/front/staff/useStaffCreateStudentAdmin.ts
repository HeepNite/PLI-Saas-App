import React from "react"

export type CreateStudentFormState = {
  email: string
  phone: string
  name: string
  amountCents: string
  paymentMode: "cash" | "card_qr" | ""
  note: string
}

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

const INITIAL_FORM: CreateStudentFormState = {
  email: "",
  phone: "",
  name: "",
  amountCents: "",
  paymentMode: "",
  note: "",
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

  const openModal = React.useCallback(() => {
    setForm(INITIAL_FORM)
    setError(null)
    setResult(null)
    setIsOpen(true)
  }, [])

  const closeModal = React.useCallback(() => {
    setIsOpen(false)
    setForm(INITIAL_FORM)
    setError(null)
    setResult(null)
  }, [])

  const updateField = React.useCallback(
    <K extends keyof CreateStudentFormState>(field: K, value: CreateStudentFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const submit = React.useCallback(async () => {
    setError(null)
    setSubmitting(true)

    const amountCents = form.amountCents.trim() ? Math.round(Number(form.amountCents) * 100) : 0

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
        }),
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
    if (submitting) return false
    if (!form.email.trim() && !form.phone.trim()) return false
    if (hasAmount && !form.paymentMode) return false
    return true
  }, [form.email, form.phone, form.paymentMode, hasAmount, submitting])

  return {
    isOpen,
    form,
    submitting,
    error,
    result,
    hasAmount,
    canSubmit,
    openModal,
    closeModal,
    updateField,
    submit,
  }
}
