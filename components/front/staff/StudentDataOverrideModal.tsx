"use client"

import React from "react"
import { Loader2, X, AlertTriangle, CheckCircle2, Clock, Package, DollarSign } from "lucide-react"

// ============================================================
// Types
// ============================================================

type EntityType = "attendance" | "payment" | "package" | "stats"

type OverrideModalProps = {
  open: boolean
  onClose: () => void
  studentId: string
  studentName: string
  currentRole: "owner" | "admin" | "staff"
  /** Called when a change is successfully saved — useful for updating audit entry indicators */
  onSuccess?: () => void
}

type TabDef = {
  key: EntityType
  label: string
  icon: React.ComponentType<{ className?: string }>
}

type SessionItem = {
  id: string
  courseSlug: string
  title: string | null
  startsAt: string
  location: string | null
  existingAttendanceStatus: string | null
  existingAttendancePaymentSource?: "package" | "dropin" | null
}

type CourseOption = {
  slug: string
  title: string
}

type PackageOption = {
  id: string
  label: string
  status: string
  remainingCredits: number | null
  usedCredits: number | null
  totalCredits: number | null
  isUnlimited: boolean
  expiresAt: string | null
}

type PurchaseOption = {
  id: string
  label: string
  amount: number
  currency: string
  status: string
  settlementStatus: string
  outstandingBalance: number
  paymentMethod: string
  createdAt: string
}

type FormState = {
  entity: EntityType
  reason: string
  // Attendance fields
  attendanceAction: "add" | "remove" | "update"
  attendanceSessionIds: string[]
  attendanceStatus: string
  // Payment fields
  paymentPurchaseId: string
  paymentAmount: string
  paymentSettlementStatus: string
  paymentOutstandingBalance: string
  paymentMethod: string
  // Package fields
  packagePurchaseId: string
  packageRemainingCredits: string
  packageUsedCredits: string
  packageExpiresAt: string
  packageStatus: string
  // Stats fields
  statsCompletedClasses: string
  statsPackageClassesUsed: string
}

type SubmitState = "idle" | "submitting" | "success" | "error"

const TABS: TabDef[] = [
  { key: "attendance", label: "Attendance", icon: Clock },
  { key: "payment", label: "Payment", icon: DollarSign },
  { key: "package", label: "Package", icon: Package },
  { key: "stats", label: "Stats", icon: CheckCircle2 },
]

const ATTENDANCE_ACTIONS = [
  { value: "add", label: "Add attendance" },
  { value: "remove", label: "Remove attendance" },
  { value: "update", label: "Update status" },
]

const ATTENDANCE_STATUSES = [
  { value: "checked_in", label: "Checked in" },
  { value: "checked_in_no_package", label: "Checked in (drop-in)" },
  { value: "checked_out", label: "Checked out" },
  { value: "scheduled", label: "Scheduled" },
  { value: "no_show", label: "No show" },
]

/** Maps raw attendance status to user-friendly display label */
function formatAttendanceStatus(status: string): string {
  switch (status) {
    case "checked_in":
      return "checked in"
    case "checked_in_no_package":
      return "drop-in"
    case "checked_out":
      return "checked out"
    case "scheduled":
      return "scheduled"
    case "no_show":
      return "no show"
    default:
      return status.replace(/_/g, " ")
  }
}

function formatAttendanceBadge(session: SessionItem): string {
  if (session.existingAttendancePaymentSource === "package") return "package"
  if (session.existingAttendancePaymentSource === "dropin") return "drop-in"
  return formatAttendanceStatus(session.existingAttendanceStatus ?? "")
}

const SETTLEMENT_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
]

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "transfer", label: "Transfer" },
  { value: "other", label: "Other" },
]

const PACKAGE_STATUSES = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
]

const hasFormValue = (value: string) => value.trim().length > 0

function createEmptyFormState(): FormState {
  return {
    entity: "attendance",
    reason: "",
    attendanceAction: "add",
    attendanceSessionIds: [],
    attendanceStatus: "checked_in",
    paymentPurchaseId: "",
    paymentAmount: "",
    paymentSettlementStatus: "pending",
    paymentOutstandingBalance: "",
    paymentMethod: "cash",
    packagePurchaseId: "",
    packageRemainingCredits: "",
    packageUsedCredits: "",
    packageExpiresAt: "",
    packageStatus: "active",
    statsCompletedClasses: "",
    statsPackageClassesUsed: "",
  }
}

// ============================================================
// Component
// ============================================================

export default function StudentDataOverrideModal({
  open,
  onClose,
  studentId,
  studentName,
  currentRole,
  onSuccess,
}: OverrideModalProps) {
  const [form, setForm] = React.useState<FormState>(createEmptyFormState)
  const [submitState, setSubmitState] = React.useState<SubmitState>("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  // Session picker state
  const [availableSessions, setAvailableSessions] = React.useState<SessionItem[]>([])
  const [sessionsLoading, setSessionsLoading] = React.useState(false)
  const [sessionsError, setSessionsError] = React.useState<string | null>(null)

  // Course selector state (for choosing any course, not just student's courses)
  const [allCourses, setAllCourses] = React.useState<CourseOption[]>([])
  const [selectedCourseSlug, setSelectedCourseSlug] = React.useState<string>("")
  const [coursesLoading, setCoursesLoading] = React.useState(false)

  // Package selector state
  const [availablePackages, setAvailablePackages] = React.useState<PackageOption[]>([])
  const [packagesLoading, setPackagesLoading] = React.useState(false)
  const [packagesError, setPackagesError] = React.useState<string | null>(null)
  const [showManualPackageId, setShowManualPackageId] = React.useState(false)

  // Purchase selector state
  const [availablePurchases, setAvailablePurchases] = React.useState<PurchaseOption[]>([])
  const [purchasesLoading, setPurchasesLoading] = React.useState(false)
  const [purchasesError, setPurchasesError] = React.useState<string | null>(null)

  const updateField = React.useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
      setErrorMessage(null)
      setSuccessMessage(null)
    },
    []
  )

  const toggleSession = React.useCallback(
    (sessionId: string) => {
      setForm((prev) => {
        const ids = prev.attendanceSessionIds
        if (ids.includes(sessionId)) {
          return { ...prev, attendanceSessionIds: ids.filter((id) => id !== sessionId) }
        }
        return { ...prev, attendanceSessionIds: [...ids, sessionId] }
      })
      setErrorMessage(null)
    },
    []
  )

  const resetForm = React.useCallback(() => {
    setForm(createEmptyFormState())
    setSubmitState("idle")
    setErrorMessage(null)
    setSuccessMessage(null)
    setConfirmOpen(false)
    setAvailableSessions([])
    setSessionsLoading(false)
    setSessionsError(null)
    setSelectedCourseSlug("")
    setAvailablePackages([])
    setPackagesLoading(false)
    setPackagesError(null)
    setShowManualPackageId(false)
    setAvailablePurchases([])
    setPurchasesLoading(false)
    setPurchasesError(null)
  }, [])

  const formatPackageSummary = React.useCallback((pkg: PackageOption): string => {
    const statusLabel = pkg.status ? pkg.status.charAt(0).toUpperCase() + pkg.status.slice(1) : "Unknown"
    const creditsLabel = pkg.isUnlimited
      ? "Unlimited"
      : pkg.totalCredits !== null
        ? `${Math.max(0, pkg.remainingCredits ?? 0)} left · ${Math.max(0, pkg.usedCredits ?? 0)} used of ${pkg.totalCredits}`
        : `${Math.max(0, pkg.remainingCredits ?? 0)} credits left`
    const expiresLabel = pkg.expiresAt
      ? `Expires ${new Date(pkg.expiresAt).toLocaleDateString()}`
      : "No expiry"
    const shortId = pkg.id.length > 8 ? `${pkg.id.slice(0, 8)}…` : pkg.id

    return `${pkg.label} · ${statusLabel} · ${creditsLabel} · ${expiresLabel} · ${shortId}`
  }, [])

  const formatPurchaseSummary = React.useCallback((p: PurchaseOption): string => {
    const amountLabel = `$${(p.amount / 100).toFixed(2)}`
    const statusLabel = p.settlementStatus.charAt(0).toUpperCase() + p.settlementStatus.slice(1)
    const dateLabel = new Date(p.createdAt).toLocaleDateString()
    const shortId = p.id.length > 8 ? `${p.id.slice(0, 8)}…` : p.id
    return `${p.label} · ${amountLabel} · ${statusLabel} · ${dateLabel} · ${shortId}`
  }, [])

  const handleClose = React.useCallback(() => {
    if (submitState === "submitting") return
    resetForm()
    onClose()
  }, [onClose, resetForm, submitState])

  // Fetch all courses when modal opens and entity is attendance
  React.useEffect(() => {
    if (!open || form.entity !== "attendance") return

    let cancelled = false
    setCoursesLoading(true)

    fetch("/api/catalog/courses")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load courses")
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          const courses: CourseOption[] = (data.courses ?? []).map((c: { slug: string; title?: string }) => ({
            slug: c.slug,
            title: c.title || c.slug,
          }))
          setAllCourses(courses)
          setCoursesLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAllCourses([])
          setCoursesLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, form.entity])

  // Fetch available sessions when modal opens and entity is attendance
  // Re-fetch when selectedCourseSlug changes
  React.useEffect(() => {
    if (!open || form.entity !== "attendance") return

    let cancelled = false
    setSessionsLoading(true)
    setSessionsError(null)
    setAvailableSessions([])

    const url = new URL(`/api/staff/students/${encodeURIComponent(studentId)}/sessions`, window.location.origin)
    if (selectedCourseSlug) {
      url.searchParams.set("courseSlug", selectedCourseSlug)
    }

    fetch(url.toString())
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load sessions")
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          setAvailableSessions(data.data?.sessions ?? [])
          setSessionsLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSessionsError(err instanceof Error ? err.message : "Failed to load sessions")
          setSessionsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, form.entity, studentId, selectedCourseSlug])

  // Fetch package purchases when package tab is active
  React.useEffect(() => {
    if (!open || form.entity !== "package") return

    let cancelled = false
    setPackagesLoading(true)
    setPackagesError(null)

    fetch(`/api/staff/students/${encodeURIComponent(studentId)}/packages`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load package purchases")
        return res.json()
      })
      .then((data) => {
        if (cancelled) return

        const packages = (data?.data?.packages ?? []) as PackageOption[]
        setAvailablePackages(packages)
        setPackagesLoading(false)

        setForm((prev) => {
          if (prev.entity !== "package") return prev
          if (prev.packagePurchaseId && packages.some((item) => item.id === prev.packagePurchaseId)) {
            return prev
          }
          if (packages.length === 1) {
            return { ...prev, packagePurchaseId: packages[0].id }
          }
          return { ...prev, packagePurchaseId: "" }
        })
      })
      .catch((err) => {
        if (cancelled) return
        setPackagesError(err instanceof Error ? err.message : "Failed to load package purchases")
        setPackagesLoading(false)
        setAvailablePackages([])
      })

    return () => {
      cancelled = true
    }
  }, [open, form.entity, studentId])

  // Fetch purchases when payment tab is active
  React.useEffect(() => {
    if (!open || form.entity !== "payment") return

    let cancelled = false
    setPurchasesLoading(true)
    setPurchasesError(null)

    fetch(`/api/staff/students/${encodeURIComponent(studentId)}/payments`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load purchases")
        return res.json()
      })
      .then((data) => {
        if (cancelled) return

        const purchases = (data?.data?.purchases ?? []) as PurchaseOption[]
        setAvailablePurchases(purchases)
        setPurchasesLoading(false)

        setForm((prev) => {
          if (prev.entity !== "payment") return prev
          if (prev.paymentPurchaseId && purchases.some((p) => p.id === prev.paymentPurchaseId)) {
            return prev
          }
          if (purchases.length === 1) {
            const p = purchases[0]
            return {
              ...prev,
              paymentPurchaseId: p.id,
              paymentAmount: (p.amount / 100).toFixed(2),
              paymentSettlementStatus: p.settlementStatus,
              paymentOutstandingBalance: (p.outstandingBalance / 100).toFixed(2),
              paymentMethod: p.paymentMethod,
            }
          }
          return { ...prev, paymentPurchaseId: "" }
        })
      })
      .catch((err) => {
        if (cancelled) return
        setPurchasesError(err instanceof Error ? err.message : "Failed to load purchases")
        setPurchasesLoading(false)
        setAvailablePurchases([])
      })

    return () => {
      cancelled = true
    }
  }, [open, form.entity, studentId])

  const handlePurchaseSelect = React.useCallback((purchaseId: string) => {
    const purchase = availablePurchases.find((p) => p.id === purchaseId)
    if (purchase) {
      setForm((prev) => ({
        ...prev,
        paymentPurchaseId: purchaseId,
        paymentAmount: (purchase.amount / 100).toFixed(2),
        paymentSettlementStatus: purchase.settlementStatus,
        paymentOutstandingBalance: (purchase.outstandingBalance / 100).toFixed(2),
        paymentMethod: purchase.paymentMethod,
      }))
    } else {
      updateField("paymentPurchaseId", purchaseId)
    }
    setErrorMessage(null)
  }, [availablePurchases, updateField])

  const handleDeletePurchase = React.useCallback(async () => {
    if (!form.paymentPurchaseId || !form.reason.trim()) {
      setErrorMessage("Please provide a reason before deleting.")
      return
    }

    setSubmitState("submitting")
    setErrorMessage(null)

    try {
      const res = await fetch(`/api/staff/students/${encodeURIComponent(studentId)}/payments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: form.paymentPurchaseId,
          reason: form.reason.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Unknown error" }))
        setErrorMessage(data.error || "Failed to delete purchase.")
        setSubmitState("error")
        return
      }

      setSubmitState("success")
      setSuccessMessage("Purchase deleted successfully.")
      // Remove from local list
      setAvailablePurchases((prev) => prev.filter((p) => p.id !== form.paymentPurchaseId))
      setForm((prev) => ({
        ...prev,
        paymentPurchaseId: "",
        paymentAmount: "",
        paymentSettlementStatus: "pending",
        paymentOutstandingBalance: "",
        paymentMethod: "cash",
      }))
      onSuccess?.()
    } catch {
      setErrorMessage("An unexpected error occurred.")
      setSubmitState("error")
    }
  }, [form.paymentPurchaseId, form.reason, studentId, onSuccess])

  const validate = React.useCallback((): string | null => {
    if (!form.reason.trim()) return "Reason is required."
    if (form.reason.trim().length > 500) return "Reason must be 500 characters or less."

    switch (form.entity) {
      case "attendance": {
        if (form.attendanceSessionIds.length === 0) return "Select at least one session for attendance changes."
        break
      }
      case "payment": {
        if (!form.paymentPurchaseId.trim()) return "Purchase ID is required for payment changes."
        if (form.paymentAmount && (isNaN(Number(form.paymentAmount)) || Number(form.paymentAmount) < 0)) {
          return "Amount must be a non-negative number."
        }
        break
      }
      case "package": {
        if (!form.packagePurchaseId.trim()) return "Select a package purchase before applying package changes."
        if (form.packageRemainingCredits && (isNaN(Number(form.packageRemainingCredits)) || Number(form.packageRemainingCredits) < 0)) {
          return "Remaining credits must be non-negative."
        }
        if (form.packageUsedCredits && (isNaN(Number(form.packageUsedCredits)) || Number(form.packageUsedCredits) < 0)) {
          return "Used credits must be non-negative."
        }
        break
      }
      case "stats": {
        if (hasFormValue(form.statsCompletedClasses) && (isNaN(Number(form.statsCompletedClasses)) || Number(form.statsCompletedClasses) < 0)) {
          return "Completed classes must be non-negative."
        }
        if (hasFormValue(form.statsPackageClassesUsed) && (isNaN(Number(form.statsPackageClassesUsed)) || Number(form.statsPackageClassesUsed) < 0)) {
          return "Package classes used must be non-negative."
        }
        break
      }
    }

    return null
  }, [form])

  const visibleAttendanceSessions = React.useMemo(() => {
    if (form.attendanceAction === "add") {
      return availableSessions.filter((session) => session.existingAttendanceStatus === null)
    }

    return availableSessions.filter((session) => session.existingAttendanceStatus !== null)
  }, [availableSessions, form.attendanceAction])

  const handleSubmit = React.useCallback(async () => {
    const validationError = validate()
    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    setConfirmOpen(false)
    setSubmitState("submitting")
    setErrorMessage(null)

    try {
      let endpoint = ""
      const body: Record<string, unknown> = { reason: form.reason.trim() }

      switch (form.entity) {
        case "attendance":
          endpoint = `/api/staff/students/${encodeURIComponent(studentId)}/attendance`
          body.action = form.attendanceAction
          body.sessionIds = form.attendanceSessionIds
          body.status = form.attendanceStatus
          break

        case "payment":
          endpoint = `/api/staff/students/${encodeURIComponent(studentId)}/payments`
          body.purchaseId = form.paymentPurchaseId.trim()
          if (form.paymentAmount) body.amount = Math.round(Number(form.paymentAmount) * 100)
          if (form.paymentSettlementStatus) body.settlementStatus = form.paymentSettlementStatus
          if (form.paymentOutstandingBalance) body.outstandingBalance = Math.round(Number(form.paymentOutstandingBalance) * 100)
          if (form.paymentMethod) body.paymentMethod = form.paymentMethod
          break

        case "package":
          endpoint = `/api/staff/students/${encodeURIComponent(studentId)}/packages`
          body.packagePurchaseId = form.packagePurchaseId.trim()
          if (form.packageRemainingCredits) body.remainingCredits = Number(form.packageRemainingCredits)
          if (form.packageUsedCredits) body.usedCredits = Number(form.packageUsedCredits)
          if (form.packageExpiresAt) body.expiresAt = form.packageExpiresAt
          if (form.packageStatus) body.status = form.packageStatus
          break

        case "stats":
          endpoint = `/api/staff/students/${encodeURIComponent(studentId)}/stats`
          if (hasFormValue(form.statsCompletedClasses)) body.completedClasses = Number(form.statsCompletedClasses)
          if (hasFormValue(form.statsPackageClassesUsed)) body.packageClassesUsed = Number(form.statsPackageClassesUsed)
          break
      }

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Unknown error" }))
        if (res.status === 403) {
          setErrorMessage("You don't have permission to perform this action.")
        } else if (res.status === 404) {
          setErrorMessage("The target record was not found.")
        } else if (res.status === 409) {
          setErrorMessage("The data was modified by someone else. Please refresh and try again.")
        } else if (res.status === 422 || res.status === 400) {
          setErrorMessage(data.error || "Invalid input. Please check your values.")
        } else {
          setErrorMessage(data.error || "An unexpected error occurred.")
        }
        setSubmitState("error")
        return
      }

      const resData = await res.json()
      setSubmitState("success")
      const processed = (resData?.data?.processed as number) ?? form.attendanceSessionIds.length
      setSuccessMessage(
        `Override applied to ${processed} session${processed !== 1 ? "s" : ""} successfully. Audit log entries created.`
      )
      onSuccess?.()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Network error. Please try again.")
      setSubmitState("error")
    }
  }, [form, studentId, validate, onSuccess])

  const handleConfirmClick = React.useCallback(() => {
    const validationError = validate()
    if (validationError) {
      setErrorMessage(validationError)
      return
    }
    setConfirmOpen(true)
  }, [validate])

  // Reset state when modal opens
  React.useEffect(() => {
    if (open) {
      resetForm()
    }
  }, [open, resetForm])

  if (!open) return null

  const isOwnerOrAdmin = currentRole === "owner" || currentRole === "admin"

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[150] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Override student data"
      >
        {/* Modal content */}
        <div className="w-full max-w-2xl rounded-2xl border border-black/15 bg-white shadow-[0_40px_90px_-40px_rgba(0,0,0,0.75)] dark:border-white/15 dark:bg-[#10131d]">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand,#b61616)]">Manual edit</p>
              <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">
                Edit student info — {studentName}
              </h3>
              <p className="mt-1 text-xs text-black/65 dark:text-white/65">
                Every change creates an immutable audit log entry.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/20 text-black/70 transition hover:bg-black/5 dark:border-white/20 dark:text-white/70 dark:hover:bg-white/5"
              aria-label="Close override modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Success state */}
          {submitState === "success" ? (
            <div className="p-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="font-medium text-emerald-800 dark:text-emerald-200">{successMessage}</p>
                    <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                      The change has been recorded and an audit entry was created.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                  >
                    Another override
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="border-b border-black/10 px-5 dark:border-white/10">
                <nav className="-mb-px flex gap-4" aria-label="Entity tabs">
                  {TABS.map((tab) => {
                    const Icon = tab.icon
                    const isActive = form.entity === tab.key
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => updateField("entity", tab.key)}
                        className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition ${
                          isActive
                            ? "border-[var(--brand,#b61616)] text-[var(--brand,#b61616)]"
                            : "border-transparent text-black/50 hover:text-black/70 dark:text-white/50 dark:hover:text-white/70"
                        }`}
                        aria-selected={isActive}
                        role="tab"
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    )
                  })}
                </nav>
              </div>

              {/* Form */}
              <div className="p-5">
                {/* Error message */}
                {errorMessage ? (
                  <div className="mb-4 rounded-lg border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
                    {errorMessage}
                  </div>
                ) : null}

                {/* Reason field (always visible) */}
                <label className="mb-4 block space-y-1">
                  <span className="text-xs text-black/65 dark:text-white/65">
                    Reason <span className="text-[var(--brand,#b61616)]">*</span>
                  </span>
                  <textarea
                    value={form.reason}
                    onChange={(e) => updateField("reason", e.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder="Explain why this override is needed..."
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder-white/30"
                  />
                  <span className="text-xs text-black/40 dark:text-white/40">{form.reason.length}/500</span>
                </label>

                {/* Entity-specific fields */}
                {form.entity === "attendance" && (
                  <div className="space-y-4">
                    <label className="block space-y-1">
                      <span className="text-xs text-black/65 dark:text-white/65">Action</span>
                      <select
                        value={form.attendanceAction}
                        onChange={(e) => {
                          setForm((prev) => ({
                            ...prev,
                            attendanceAction: e.target.value as FormState["attendanceAction"],
                            attendanceSessionIds: [],
                          }))
                          setErrorMessage(null)
                          setSuccessMessage(null)
                        }}
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      >
                        {ATTENDANCE_ACTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>

                    {/* Course selector - allows choosing any course */}
                    <label className="block space-y-1">
                      <span className="text-xs text-black/65 dark:text-white/65">Course</span>
                      <select
                        value={selectedCourseSlug}
                        onChange={(e) => {
                          setSelectedCourseSlug(e.target.value)
                          // Clear selected sessions when course changes
                          setForm((prev) => ({ ...prev, attendanceSessionIds: [] }))
                        }}
                        disabled={coursesLoading}
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white disabled:opacity-50"
                      >
                        <option value="">Student&apos;s courses (default)</option>
                        {allCourses.map((course) => (
                          <option key={course.slug} value={course.slug}>{course.title}</option>
                        ))}
                      </select>
                      <p className="text-[11px] text-black/40 dark:text-white/40">
                        Select a specific course or leave empty to show sessions from courses the student has interacted with.
                      </p>
                    </label>

                    {/* Session multi-select */}
                    <div className="space-y-1">
                      <span className="text-xs text-black/65 dark:text-white/65">
                        Sessions ({form.attendanceSessionIds.length} selected)
                      </span>
                      {sessionsLoading ? (
                        <div className="flex items-center gap-2 rounded-md border border-black/10 bg-black/[0.02] px-3 py-6 text-sm text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading sessions...
                        </div>
                      ) : sessionsError ? (
                        <div className="rounded-md border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/5 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
                          {sessionsError}
                        </div>
                      ) : visibleAttendanceSessions.length === 0 ? (
                        <div className="rounded-md border border-black/10 bg-black/[0.02] px-3 py-6 text-center text-sm text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
                          {form.attendanceAction === "add"
                            ? "No sessions without existing attendance found in the current date range."
                            : "No existing attendance records found in the current date range."}
                        </div>
                      ) : (
                        <div className="max-h-52 overflow-y-auto rounded-md border border-black/15 bg-white dark:border-white/15 dark:bg-white/5">
                          {(() => {
                            const todayDateStr = new Date().toLocaleDateString()
                            return visibleAttendanceSessions.map((session) => {
                              const isSelected = form.attendanceSessionIds.includes(session.id)
                              const isToday = new Date(session.startsAt).toLocaleDateString() === todayDateStr

                              return (
                                <label
                                  key={session.id}
                                  className={`flex items-start gap-3 border-b border-black/5 px-3 py-2.5 last:border-b-0 transition-colors dark:border-white/5 ${
                                    isSelected
                                      ? "bg-[var(--brand,#b61616)]/5 dark:bg-[var(--brand,#b61616)]/10"
                                      : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                                  } cursor-pointer`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSession(session.id)}
                                    className="mt-0.5 h-4 w-4 rounded border-black/30 text-[var(--brand,#b61616)] focus:ring-[var(--brand,#b61616)] dark:border-white/30"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-sm font-medium text-black dark:text-white truncate">
                                        {session.title || session.courseSlug}
                                      </span>
                                      {isToday && (
                                        <span className="inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                          Today
                                        </span>
                                      )}
                                      {session.existingAttendanceStatus && (
                                        <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                          session.existingAttendancePaymentSource === "package"
                                            ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                                            : session.existingAttendancePaymentSource === "dropin" || session.existingAttendanceStatus === "checked_in_no_package"
                                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                            : session.existingAttendanceStatus === "no_show"
                                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                        }`}>
                                          {formatAttendanceBadge(session)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-0.5 text-xs text-black/50 dark:text-white/50">
                                      {new Date(session.startsAt).toLocaleString(undefined, {
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                      {session.location ? ` · ${session.location}` : ""}
                                      <span className="ml-1.5 text-black/30 dark:text-white/30">
                                        {session.id.slice(0, 8)}
                                      </span>
                                    </div>
                                  </div>
                                </label>
                              )
                            })
                          })()}
                        </div>
                      )}
                      {form.attendanceAction === "add" && (
                        <p className="text-[11px] text-black/40 dark:text-white/40">
                          Sessions with existing attendance are hidden for &quot;add&quot; action.
                        </p>
                      )}
                      {(form.attendanceAction === "remove" || form.attendanceAction === "update") && (
                        <p className="text-[11px] text-black/40 dark:text-white/40">
                          Only sessions with an existing attendance record are shown.
                        </p>
                      )}
                    </div>

                    {form.attendanceAction !== "remove" ? <label className="block space-y-1">
                      <span className="text-xs text-black/65 dark:text-white/65">Status</span>
                      <select
                        value={form.attendanceStatus}
                        onChange={(e) => updateField("attendanceStatus", e.target.value)}
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      >
                        {ATTENDANCE_STATUSES.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label> : null}
                  </div>
                )}

                {form.entity === "payment" && (
                  <div className="space-y-4">
                    <label className="block space-y-1">
                      <span className="text-xs text-black/65 dark:text-white/65">
                        Purchase <span className="text-[var(--brand,#b61616)]">*</span>
                      </span>
                      {purchasesLoading ? (
                        <div className="flex items-center gap-2 rounded-md border border-black/10 bg-black/[0.02] px-3 py-2 text-sm text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading purchases...
                        </div>
                      ) : purchasesError ? (
                        <div className="rounded-md border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/5 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
                          {purchasesError}
                        </div>
                      ) : availablePurchases.length === 0 ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                          No purchases found for this student.
                        </div>
                      ) : (
                        <>
                          <select
                            value={form.paymentPurchaseId}
                            onChange={(e) => handlePurchaseSelect(e.target.value)}
                            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                          >
                            <option value="">Select purchase</option>
                            {availablePurchases.map((p) => (
                              <option key={p.id} value={p.id}>
                                {formatPurchaseSummary(p)}
                              </option>
                            ))}
                          </select>
                          {availablePurchases.length === 1 && form.paymentPurchaseId ? (
                            <p className="text-[11px] text-black/45 dark:text-white/45">
                              Auto-selected: {formatPurchaseSummary(availablePurchases[0])}
                            </p>
                          ) : null}
                        </>
                      )}
                    </label>

                    {form.paymentPurchaseId && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={submitState === "submitting"}
                          onClick={() => {
                            if (confirm("Are you sure you want to permanently delete this purchase? This cannot be undone.")) {
                              void handleDeletePurchase()
                            }
                          }}
                          className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40"
                        >
                          Delete this purchase
                        </button>
                        <span className="text-[11px] text-black/40 dark:text-white/40">
                          Permanently removes the purchase record
                        </span>
                      </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-xs text-black/65 dark:text-white/65">Amount (USD)</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.paymentAmount}
                          onChange={(e) => updateField("paymentAmount", e.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-xs text-black/65 dark:text-white/65">Outstanding Balance (USD)</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.paymentOutstandingBalance}
                          onChange={(e) => updateField("paymentOutstandingBalance", e.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-xs text-black/65 dark:text-white/65">Settlement Status</span>
                        <select
                          value={form.paymentSettlementStatus}
                          onChange={(e) => updateField("paymentSettlementStatus", e.target.value)}
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        >
                          {SETTLEMENT_STATUSES.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="block space-y-1">
                        <span className="text-xs text-black/65 dark:text-white/65">Payment Method</span>
                        <select
                          value={form.paymentMethod}
                          onChange={(e) => updateField("paymentMethod", e.target.value)}
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        >
                          {PAYMENT_METHODS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                )}

                {form.entity === "package" && (
                  <div className="space-y-4">
                    <label className="block space-y-1">
                      <span className="text-xs text-black/65 dark:text-white/65">
                        Package purchase <span className="text-[var(--brand,#b61616)]">*</span>
                      </span>
                      {packagesLoading ? (
                        <div className="flex items-center gap-2 rounded-md border border-black/10 bg-black/[0.02] px-3 py-2 text-sm text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading package purchases...
                        </div>
                      ) : packagesError ? (
                        <div className="rounded-md border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/5 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
                          {packagesError}
                        </div>
                      ) : availablePackages.length === 0 ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                          No package purchases found for this student.
                        </div>
                      ) : (
                        <>
                          <select
                            value={form.packagePurchaseId}
                            onChange={(e) => updateField("packagePurchaseId", e.target.value)}
                            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                          >
                            <option value="">Select package purchase</option>
                            {availablePackages.map((pkg) => (
                              <option key={pkg.id} value={pkg.id}>
                                {formatPackageSummary(pkg)}
                              </option>
                            ))}
                          </select>
                          {availablePackages.length === 1 && form.packagePurchaseId ? (
                            <p className="text-[11px] text-black/45 dark:text-white/45">
                              Auto-selected: {formatPackageSummary(availablePackages[0])}
                            </p>
                          ) : null}
                        </>
                      )}
                    </label>

                    {availablePackages.length === 0 ? (
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setShowManualPackageId((prev) => !prev)}
                          className="text-xs font-medium text-[var(--brand,#b61616)] underline-offset-2 hover:underline"
                        >
                          {showManualPackageId ? "Hide manual UUID entry" : "Use manual UUID entry (advanced)"}
                        </button>
                        {showManualPackageId ? (
                          <input
                            type="text"
                            value={form.packagePurchaseId}
                            onChange={(e) => updateField("packagePurchaseId", e.target.value)}
                            placeholder="package-purchase-uuid"
                            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                          />
                        ) : null}
                      </div>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-xs text-black/65 dark:text-white/65">Remaining Credits</span>
                        <input
                          type="number"
                          min="0"
                          value={form.packageRemainingCredits}
                          onChange={(e) => updateField("packageRemainingCredits", e.target.value)}
                          placeholder="0"
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-xs text-black/65 dark:text-white/65">Used Credits</span>
                        <input
                          type="number"
                          min="0"
                          value={form.packageUsedCredits}
                          onChange={(e) => updateField("packageUsedCredits", e.target.value)}
                          placeholder="0"
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-xs text-black/65 dark:text-white/65">Expires At</span>
                        <input
                          type="date"
                          value={form.packageExpiresAt}
                          onChange={(e) => updateField("packageExpiresAt", e.target.value)}
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-xs text-black/65 dark:text-white/65">Status</span>
                        <select
                          value={form.packageStatus}
                          onChange={(e) => updateField("packageStatus", e.target.value)}
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        >
                          {PACKAGE_STATUSES.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                )}

                {form.entity === "stats" && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>Stats are derived values. Only correct them when you know the ground truth differs from the computed stat.</p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-xs text-black/65 dark:text-white/65">Completed Classes</span>
                        <input
                          type="number"
                          min="0"
                          value={form.statsCompletedClasses}
                          onChange={(e) => updateField("statsCompletedClasses", e.target.value)}
                          placeholder="0"
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-xs text-black/65 dark:text-white/65">Package Classes Used</span>
                        <input
                          type="number"
                          min="0"
                          value={form.statsPackageClassesUsed}
                          onChange={(e) => updateField("statsPackageClassesUsed", e.target.value)}
                          placeholder="0"
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-6 flex items-center justify-end gap-3 border-t border-black/10 pt-4 dark:border-white/10">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={submitState === "submitting"}
                    className="rounded-lg border border-black/20 px-4 py-2 text-sm font-medium text-black transition hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:text-white dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmClick}
                    disabled={submitState === "submitting" || !isOwnerOrAdmin}
                    className="rounded-lg bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand,#b61616)]/90 disabled:opacity-50"
                  >
                    {submitState === "submitting" ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      "Apply override"
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirmation dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-black/15 bg-white p-6 shadow-2xl dark:border-white/15 dark:bg-[#10131d]">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-amber-500" />
              <div>
                <h4 className="text-lg font-semibold text-black dark:text-white">Confirm override</h4>
                <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                  You are about to manually override <strong>{form.entity}</strong> data for <strong>{studentName}</strong>.
                  This action cannot be undone and will be permanently recorded in the audit log.
                </p>
              </div>
            </div>

            {form.reason && (
              <div className="mt-4 rounded-lg border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-xs text-black/50 dark:text-white/50">Reason:</p>
                <p className="mt-1 text-sm text-black dark:text-white">{form.reason}</p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-black/20 px-4 py-2 text-sm font-medium text-black transition hover:bg-black/5 dark:border-white/20 dark:text-white dark:hover:bg-white/5"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                className="rounded-lg bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand,#b61616)]/90"
              >
                Confirm override
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
