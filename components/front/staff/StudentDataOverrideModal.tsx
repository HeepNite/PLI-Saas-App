"use client"

import React from "react"
import { Loader2, X, CheckCircle2, Clock, Package, DollarSign } from "lucide-react"
import { useAsyncFetch } from "@/components/front/hooks/useAsyncFetch"
import {
  FormState,
  SubmitState,
  TabDef,
  CourseOption,
  SessionItem,
  PackageOption,
  PackagePlanOption,
  PurchaseOption,
  hasFormValue,
  createEmptyFormState,
} from "./student-override/types"
import { AttendanceTabForm } from "./student-override/AttendanceTabForm"
import { PaymentTabForm } from "./student-override/PaymentTabForm"
import { PackageTabForm } from "./student-override/PackageTabForm"
import { StatsTabForm } from "./student-override/StatsTabForm"
import { ConfirmDialog } from "./student-override/ConfirmDialog"
import { useAddPackageGrant } from "./student-override/useAddPackageGrant"

// ============================================================
// Types
// ============================================================

type OverrideModalProps = {
  open: boolean
  onClose: () => void
  studentId: string
  studentName: string
  currentRole: "owner" | "admin" | "staff"
  /** Called when a change is successfully saved — useful for updating audit entry indicators */
  onSuccess?: () => void
}

const TABS: TabDef[] = [
  { key: "attendance", label: "Attendance", icon: Clock },
  { key: "payment", label: "Payment", icon: DollarSign },
  { key: "package", label: "Package", icon: Package },
  { key: "stats", label: "Stats", icon: CheckCircle2 },
]

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

  // Course selector state (for choosing any course, not just student's courses)
  const [selectedCourseSlug, setSelectedCourseSlug] = React.useState<string>("")

  // Package selector state
  const [showManualPackageId, setShowManualPackageId] = React.useState(false)

  // Tracks purchases deleted in this session so they can be filtered out optimistically
  const [deletedPurchaseIds, setDeletedPurchaseIds] = React.useState<ReadonlySet<string>>(new Set())

  const isAttendanceTab = open && form.entity === "attendance"
  const isPackageTab = open && form.entity === "package"
  const isPaymentTab = open && form.entity === "payment"

  const { data: coursesData, loading: coursesLoading } = useAsyncFetch<CourseOption[]>(
    "/api/catalog/courses",
    isAttendanceTab,
    (json) => {
      const raw = json as { courses?: { slug: string; title?: string }[] }
      return (raw.courses ?? []).map((c) => ({ slug: c.slug, title: c.title || c.slug }))
    },
  )
  const allCourses = coursesData ?? []

  const sessionsUrl = isAttendanceTab
    ? `/api/staff/students/${encodeURIComponent(studentId)}/sessions${selectedCourseSlug ? `?courseSlug=${encodeURIComponent(selectedCourseSlug)}` : ""}`
    : null
  const { data: sessionsData, loading: sessionsLoading, error: sessionsError } = useAsyncFetch<SessionItem[]>(
    sessionsUrl,
    isAttendanceTab,
    (json) => {
      const raw = json as { data?: { sessions?: SessionItem[] } }
      return raw.data?.sessions ?? []
    },
  )
  const availableSessions = sessionsData ?? []

  const { data: packagesData, loading: packagesLoading, error: packagesError } = useAsyncFetch<PackageOption[]>(
    `/api/staff/students/${encodeURIComponent(studentId)}/packages`,
    isPackageTab,
    (json) => {
      const raw = json as { data?: { packages?: PackageOption[] } }
      return (raw.data?.packages ?? []) as PackageOption[]
    },
  )
  const availablePackages = packagesData ?? []

  const { data: purchasesData, loading: purchasesLoading, error: purchasesError } = useAsyncFetch<PurchaseOption[]>(
    `/api/staff/students/${encodeURIComponent(studentId)}/payments`,
    isPaymentTab,
    (json) => {
      const raw = json as { data?: { purchases?: PurchaseOption[] } }
      return (raw.data?.purchases ?? []) as PurchaseOption[]
    },
  )
  const availablePurchases = (purchasesData ?? []).filter((p) => !deletedPurchaseIds.has(p.id))

  const { data: plansData, loading: plansLoading, error: plansError } = useAsyncFetch<PackagePlanOption[]>(
    "/api/staff/school/packages/picker",
    isPackageTab,
    (json) => {
      const raw = json as { data?: { items?: PackagePlanOption[] } }
      return (raw.data?.items ?? []) as PackagePlanOption[]
    },
  )
  const availablePlans = plansData ?? []

  const addPackageGrant = useAddPackageGrant({
    studentId,
    onGranted: () => {
      onSuccess?.()
    },
  })

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

  const resetAddPackageGrant = addPackageGrant.reset

  const resetForm = React.useCallback(() => {
    setForm(createEmptyFormState())
    setSubmitState("idle")
    setErrorMessage(null)
    setSuccessMessage(null)
    setConfirmOpen(false)
    setSelectedCourseSlug("")
    setShowManualPackageId(false)
    setDeletedPurchaseIds(new Set())
    resetAddPackageGrant()
  }, [resetAddPackageGrant])

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

  // Auto-select package purchase when packages load
  React.useEffect(() => {
    if (!packagesData) return
    setForm((prev) => {
      if (prev.entity !== "package") return prev
      if (prev.packagePurchaseId && packagesData.some((item) => item.id === prev.packagePurchaseId)) {
        return prev
      }
      if (packagesData.length === 1) {
        return { ...prev, packagePurchaseId: packagesData[0].id }
      }
      return { ...prev, packagePurchaseId: "" }
    })
  }, [packagesData])

  // Auto-select and populate fields when purchases load
  React.useEffect(() => {
    if (!purchasesData) return
    setForm((prev) => {
      if (prev.entity !== "payment") return prev
      if (prev.paymentPurchaseId && purchasesData.some((p) => p.id === prev.paymentPurchaseId)) {
        return prev
      }
      if (purchasesData.length === 1) {
        const p = purchasesData[0]
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
  }, [purchasesData])

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
      setDeletedPurchaseIds((prev) => new Set([...prev, form.paymentPurchaseId]))
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

                {/* Entity-specific tab forms */}
                {form.entity === "attendance" && (
                  <AttendanceTabForm
                    form={form}
                    allCourses={allCourses}
                    coursesLoading={coursesLoading}
                    availableSessions={availableSessions}
                    sessionsLoading={sessionsLoading}
                    sessionsError={sessionsError}
                    visibleAttendanceSessions={visibleAttendanceSessions}
                    selectedCourseSlug={selectedCourseSlug}
                    onCourseChange={(slug) => {
                      setSelectedCourseSlug(slug)
                      setForm((prev) => ({ ...prev, attendanceSessionIds: [] }))
                    }}
                    onActionChange={(action) => {
                      setForm((prev) => ({
                        ...prev,
                        attendanceAction: action,
                        attendanceSessionIds: [],
                      }))
                      setErrorMessage(null)
                      setSuccessMessage(null)
                    }}
                    onStatusChange={(status) => updateField("attendanceStatus", status)}
                    onToggleSession={toggleSession}
                  />
                )}

                {form.entity === "payment" && (
                  <PaymentTabForm
                    form={form}
                    availablePurchases={availablePurchases}
                    purchasesLoading={purchasesLoading}
                    purchasesError={purchasesError}
                    submitState={submitState}
                    onPurchaseSelect={handlePurchaseSelect}
                    onFieldChange={updateField}
                    onDeletePurchase={() => void handleDeletePurchase()}
                    formatPurchaseSummary={formatPurchaseSummary}
                  />
                )}

                {form.entity === "package" && (
                  <PackageTabForm
                    form={form}
                    availablePackages={availablePackages}
                    packagesLoading={packagesLoading}
                    packagesError={packagesError}
                    showManualPackageId={showManualPackageId}
                    onToggleManualPackageId={() => setShowManualPackageId((prev) => !prev)}
                    onFieldChange={updateField}
                    formatPackageSummary={formatPackageSummary}
                    addPackage={{
                      plans: availablePlans,
                      plansLoading,
                      plansError,
                      selectedPlanId: addPackageGrant.selectedPlanId,
                      expiresAt: addPackageGrant.expiresAt,
                      reason: addPackageGrant.reason,
                      state: addPackageGrant.state,
                      errorMessage: addPackageGrant.errorMessage,
                      duplicate: addPackageGrant.duplicate,
                      grantedPurchaseId: addPackageGrant.grantedPurchaseId,
                      onSelectPlan: addPackageGrant.setSelectedPlanId,
                      onExpiresAtChange: addPackageGrant.setExpiresAt,
                      onReasonChange: addPackageGrant.setReason,
                      onSubmit: addPackageGrant.submit,
                      onConfirmDuplicate: addPackageGrant.confirmDuplicateAndResubmit,
                      onStartAnother: addPackageGrant.reset,
                    }}
                  />
                )}

                {form.entity === "stats" && (
                  <StatsTabForm
                    form={form}
                    onFieldChange={updateField}
                  />
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
        <ConfirmDialog
          studentName={studentName}
          entityType={form.entity}
          reason={form.reason}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void handleSubmit()}
        />
      )}
    </>
  )
}
