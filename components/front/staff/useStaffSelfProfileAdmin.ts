import React from "react"

import {
  normalizeStaffProfilePaymentInfo,
  resolveStaffProfilePaymentSummaryCards,
  toStaffProfilePaymentInfoPayload,
} from "@/lib/staff/profile-payment"
import type { StaffRole } from "@/lib/security/staff-role"
import {
  PAYMENT_PREFERENCES,
  type StaffCategory,
  type StaffPaymentInfo,
  type StaffPaymentPreference,
} from "@/lib/security/staff-category"
import type { StaffRequestStatus } from "@/lib/security/staff-request"

import { normalizeCategoryForRole } from "./staffAdminConstants"
import type {
  ProfileRequestFormState,
  SelfProfileSnapshot,
  StaffPaymentForm,
  StaffProfileForm,
  StaffUserRow,
} from "./staffAdminTypes"
import {
  buildSelfRecommendations,
  computeSelfPerformanceScore,
} from "./staffSelfProfileMetrics"

type Input = {
  currentRole: StaffRole
  currentUserId: string
  resolvedCurrentCategory: StaffCategory
  profileForm: StaffProfileForm
  setProfileForm: React.Dispatch<React.SetStateAction<StaffProfileForm>>
  ensureMinimumLoadingTime: (startedAt: number) => Promise<void>
  handleStaffAuthFailure: (status: number) => boolean
  fetchStaffRequests: (status?: StaffRequestStatus | "all", options?: { scope?: "all" | "mine" }) => Promise<void>
}

const parsePaymentPreferenceValue = (value: unknown): StaffPaymentPreference | null => {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  return PAYMENT_PREFERENCES.includes(normalized as StaffPaymentPreference)
    ? (normalized as StaffPaymentPreference)
    : null
}

export const createEmptyStaffPaymentForm = (): StaffPaymentForm => ({
  paymentPreference: "",
  cbu: "",
  alias: "",
  accountHolder: "",
  mercadoPagoId: "",
  bankName: "",
  routingNumber: "",
  accountNumber: "",
  zelleId: "",
  venmoUser: "",
  accountType: "",
})

const createStaffPaymentForm = (
  paymentPreference: StaffPaymentPreference | null,
  paymentInfo: StaffPaymentInfo | null
): StaffPaymentForm => ({
  paymentPreference: paymentPreference ?? "",
  cbu: paymentInfo?.cbu ?? "",
  alias: paymentInfo?.alias ?? "",
  accountHolder: paymentInfo?.accountHolder ?? "",
  mercadoPagoId: paymentInfo?.mercadoPagoId ?? "",
  bankName: paymentInfo?.bankName ?? "",
  routingNumber: paymentInfo?.routingNumber ?? "",
  accountNumber: paymentInfo?.accountNumber ?? "",
  zelleId: paymentInfo?.zelleId ?? "",
  venmoUser: paymentInfo?.venmoUser ?? "",
  accountType: paymentInfo?.accountType ?? "",
})

const toPaymentInfoPayload = (form: StaffPaymentForm): StaffPaymentInfo | null => {
  const paymentInfo = toStaffProfilePaymentInfoPayload({
    cbu: form.cbu,
    alias: form.alias,
    accountHolder: form.accountHolder,
    mercadoPagoId: form.mercadoPagoId,
    bankName: form.bankName,
    routingNumber: form.routingNumber,
    accountNumber: form.accountNumber,
    zelleId: form.zelleId,
    venmoUser: form.venmoUser,
    accountType: form.accountType,
  })
  return paymentInfo && Object.keys(paymentInfo).length > 0 ? paymentInfo : null
}

const createEmptyProfileRequestForm = (): ProfileRequestFormState => ({
  type: "STAFF_SCHEDULE_CHANGE",
  message: "",
  startDate: "",
  endDate: "",
  preferredShift: "",
  consultTopic: "",
})

export const useStaffSelfProfileAdmin = ({
  currentRole,
  currentUserId,
  resolvedCurrentCategory,
  profileForm,
  setProfileForm,
  ensureMinimumLoadingTime,
  handleStaffAuthFailure,
  fetchStaffRequests,
}: Input) => {
  const [profileRequestStatusFilter, setProfileRequestStatusFilter] = React.useState<StaffRequestStatus | "all">("all")
  const [selfProfileLoading, setSelfProfileLoading] = React.useState(false)
  const [selfProfileSnapshot, setSelfProfileSnapshot] = React.useState<SelfProfileSnapshot | null>(null)
  const [profilePaymentExpanded, setProfilePaymentExpanded] = React.useState(false)
  const [profilePaymentSaving, setProfilePaymentSaving] = React.useState(false)
  const [profilePaymentError, setProfilePaymentError] = React.useState<string | null>(null)
  const [profilePaymentSuccess, setProfilePaymentSuccess] = React.useState<string | null>(null)
  const [profilePaymentForm, setProfilePaymentForm] = React.useState<StaffPaymentForm>(() => createEmptyStaffPaymentForm())
  const [profileRequestSubmitting, setProfileRequestSubmitting] = React.useState(false)
  const [profileRequestSuccess, setProfileRequestSuccess] = React.useState<string | null>(null)
  const [profileRequestError, setProfileRequestError] = React.useState<string | null>(null)
  const [profileRequestForm, setProfileRequestForm] = React.useState<ProfileRequestFormState>(createEmptyProfileRequestForm)

  const selfProfileRow = React.useMemo<StaffUserRow>(
    () => ({
      id: currentUserId,
      paymentModelId: null,
      email: "",
      phone: "",
      avatarUrl: "",
      location: "",
      hasPin: false,
      firstName: profileForm.firstName || "Staff",
      lastName: profileForm.lastName || "Member",
      role: currentRole,
      category: resolvedCurrentCategory,
      payrollHoursWorked: null,
      payrollHourlyRate: null,
      payrollStatus: null,
      payrollPaydayWeekday: null,
      payrollDelayEntries: [],
      performanceRating: null,
      performanceReviewsCount: null,
      performanceReviewCycleDays: null,
      teacherType: "full_time",
      teacherAssignedUserId: "",
      teacherRecurrenceUnit: "month",
      teacherRecurrenceInterval: null,
      teacherCourseSlugs: [],
      teacherWeekdays: [],
      teacherShiftStart: "",
      teacherShiftEnd: "",
      teacherWeeklyHours: null,
      teacherBonusTargetHours: null,
      banned: false,
      locked: false,
      online: false,
      authOnline: false,
      lastActiveAt: null,
      staffLastCheckInAt: null,
      createdAt: Date.now(),
      lastSignInAt: null,
    }),
    [currentRole, currentUserId, profileForm.firstName, profileForm.lastName, resolvedCurrentCategory]
  )

  const resolvedSelfProfile = React.useMemo<SelfProfileSnapshot>(() => {
    if (selfProfileSnapshot) return selfProfileSnapshot
    return {
      firstName: profileForm.firstName || "Staff",
      lastName: profileForm.lastName || "Member",
      imageUrl: "",
      location: profileForm.location || "",
      role: currentRole,
      category: resolvedCurrentCategory,
      paymentPreference: null,
      assignedPaymentPreference: null,
      paymentInfo: null,
      metrics: {
        performanceRating: null,
        performanceReviewsCount: null,
        performanceReviewCycleDays: null,
        payrollHoursWorked: null,
        payrollHourlyRate: null,
        payrollStatus: null,
        payrollPaydayWeekday: null,
      },
      presence: {
        online: false,
        authOnline: false,
        lastSignInAt: null,
        staffLastCheckInAt: null,
        status: null,
      },
      teaching: {
        teacherCourseSlugs: [],
        teacherWeekdays: [],
        teacherShiftStart: "",
        teacherShiftEnd: "",
      },
    }
  }, [currentRole, profileForm.firstName, profileForm.lastName, profileForm.location, resolvedCurrentCategory, selfProfileSnapshot])

  const selfPerformanceScore = React.useMemo(
    () => computeSelfPerformanceScore(resolvedSelfProfile.metrics),
    [resolvedSelfProfile.metrics]
  )
  const selfRecommendations = React.useMemo(
    () => buildSelfRecommendations(resolvedSelfProfile.metrics),
    [resolvedSelfProfile.metrics]
  )
  const profilePaymentSummaryCards = React.useMemo(
    () => resolveStaffProfilePaymentSummaryCards(resolvedSelfProfile.paymentInfo),
    [resolvedSelfProfile.paymentInfo]
  )

  const fetchSelfProfile = React.useCallback(async () => {
    const startedAt = Date.now()
    setSelfProfileLoading(true)
    try {
      const res = await fetch(`/api/staff/users/${currentUserId}/profile`, {
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setProfileRequestError(typeof data?.error === "string" ? data.error : "Failed to load your profile.")
        return
      }

      // The profile endpoint wraps user fields inside data.user; payment
      // fields (paymentPreference, assignedPaymentPreference, paymentInfo)
      // live at the top level of the response.
      const user = typeof data?.user === "object" && data.user ? data.user as Record<string, unknown> : data
      const profile = typeof user.profile === "object" && user.profile ? user.profile as Record<string, unknown> : {}

      const firstName = typeof user.firstName === "string" ? user.firstName : ""
      const lastName = typeof user.lastName === "string" ? user.lastName : ""
      const location = typeof profile.location === "string" ? profile.location : typeof user.location === "string" ? user.location : ""
      const imageUrl = typeof user.imageUrl === "string" ? user.imageUrl : ""
      const rawRole = typeof user.role === "string" ? user.role : currentRole
      const nextRole: StaffRole = rawRole === "owner" || rawRole === "admin" || rawRole === "staff" ? rawRole : currentRole
      const rawCategory = typeof user.category === "string" ? user.category : resolvedCurrentCategory
      const nextCategory = normalizeCategoryForRole(nextRole, rawCategory as StaffCategory)
      const paymentPreference = parsePaymentPreferenceValue(data?.paymentPreference)
      const assignedPaymentPreference = parsePaymentPreferenceValue(data?.assignedPaymentPreference)
      const paymentInfo = normalizeStaffProfilePaymentInfo(data?.paymentInfo)
      const metrics = typeof user.metrics === "object" && user.metrics ? user.metrics as Record<string, unknown> : {}
      const presence = typeof user.presence === "object" && user.presence ? user.presence as Record<string, unknown> : {}
      const teaching = typeof user.teaching === "object" && user.teaching ? user.teaching as Record<string, unknown> : {}
      const statusValue = presence.status === "online" || presence.status === "offline"
        ? presence.status
        : null
      const payrollStatus = metrics.payrollStatus === "paid" || metrics.payrollStatus === "pending"
        ? metrics.payrollStatus
        : null
      const parsedLastCheckIn = typeof presence.staffLastCheckInAt === "number"
        ? presence.staffLastCheckInAt
        : typeof presence.staffLastCheckInAt === "string"
          ? Date.parse(presence.staffLastCheckInAt)
          : Number.NaN
      const sanitizeCourseSlugs = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
      const sanitizeWeekdays = (value: unknown): number[] => Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : []
      const sanitizeTimeValue = (value: unknown): string => typeof value === "string" ? value : ""

      setSelfProfileSnapshot({
        firstName,
        lastName,
        imageUrl,
        location,
        role: nextRole,
        category: nextCategory,
        paymentPreference,
        assignedPaymentPreference,
        paymentInfo,
        metrics: {
          performanceRating: typeof metrics.performanceRating === "number" ? metrics.performanceRating : null,
          performanceReviewsCount: typeof metrics.performanceReviewsCount === "number" ? metrics.performanceReviewsCount : null,
          performanceReviewCycleDays: typeof metrics.performanceReviewCycleDays === "number" ? metrics.performanceReviewCycleDays : null,
          payrollHoursWorked: typeof metrics.payrollHoursWorked === "number" ? metrics.payrollHoursWorked : null,
          payrollHourlyRate: typeof metrics.payrollHourlyRate === "number" ? metrics.payrollHourlyRate : null,
          payrollStatus,
          payrollPaydayWeekday: typeof metrics.payrollPaydayWeekday === "number" ? metrics.payrollPaydayWeekday : null,
        },
        presence: {
          online: Boolean(presence.online),
          authOnline: Boolean(presence.authOnline),
          lastSignInAt:
            typeof presence.lastSignInAt === "number" && Number.isFinite(presence.lastSignInAt)
              ? presence.lastSignInAt
              : null,
          staffLastCheckInAt: Number.isFinite(parsedLastCheckIn) ? parsedLastCheckIn : null,
          status: statusValue,
        },
        teaching: {
          teacherCourseSlugs: sanitizeCourseSlugs(teaching.teacherCourseSlugs),
          teacherWeekdays: sanitizeWeekdays(teaching.teacherWeekdays),
          teacherShiftStart: sanitizeTimeValue(teaching.teacherShiftStart),
          teacherShiftEnd: sanitizeTimeValue(teaching.teacherShiftEnd),
        },
      })
      setProfilePaymentForm(createStaffPaymentForm(paymentPreference, paymentInfo))
      setProfilePaymentError(null)

      setProfileForm((prev) => ({
        ...prev,
        firstName: firstName || prev.firstName,
        lastName: lastName || prev.lastName,
        location: location || prev.location,
        role: nextRole,
        category: nextCategory,
      }))
    } catch {
      setProfileRequestError("Network error while loading your profile.")
    } finally {
      await ensureMinimumLoadingTime(startedAt)
      setSelfProfileLoading(false)
    }
  }, [currentRole, currentUserId, ensureMinimumLoadingTime, handleStaffAuthFailure, resolvedCurrentCategory, setProfileForm])

  const saveProfilePaymentInfo = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfilePaymentSaving(true)
    setProfilePaymentError(null)
    setProfilePaymentSuccess(null)

    const isRequestFlow = profilePaymentForm.paymentPreference !== "" && profilePaymentForm.paymentPreference !== resolvedSelfProfile.assignedPaymentPreference

    try {
      const res = await fetch(isRequestFlow ? "/api/staff/payroll/change-requests" : `/api/staff/users/${currentUserId}/profile`, {
        method: isRequestFlow ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRequestFlow ? {
          requestedMethod: profilePaymentForm.paymentPreference,
          requestedInfo: toPaymentInfoPayload(profilePaymentForm),
          reason: "Staff requested change via profile portal"
        } : {
          paymentPreference: profilePaymentForm.paymentPreference || null,
          paymentInfo: toPaymentInfoPayload(profilePaymentForm),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setProfilePaymentError(typeof data?.error === "string" ? data.error : `Unable to ${isRequestFlow ? "submit change request" : "save payment information"}.`)
        return
      }

      if (isRequestFlow) {
        setProfilePaymentSuccess("Payment change request submitted for review.")
      } else {
        const nextPaymentPreference = parsePaymentPreferenceValue(data?.paymentPreference)
        const nextPaymentInfo = normalizeStaffProfilePaymentInfo(data?.paymentInfo)
        setProfilePaymentForm(createStaffPaymentForm(nextPaymentPreference, nextPaymentInfo))
        setSelfProfileSnapshot((prev) => prev ? { ...prev, paymentPreference: nextPaymentPreference, paymentInfo: nextPaymentInfo } : prev)
        setProfilePaymentSuccess("Payment information updated.")
      }
    } catch {
      setProfilePaymentError("Network error while saving payment information.")
    } finally {
      setProfilePaymentSaving(false)
    }
  }, [currentUserId, handleStaffAuthFailure, profilePaymentForm, resolvedSelfProfile.assignedPaymentPreference])

  const submitProfileRequest = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileRequestSubmitting(true)
    setProfileRequestError(null)
    setProfileRequestSuccess(null)

    const message = profileRequestForm.message.trim()
    if (message.length < 6) {
      setProfileRequestError("Add more detail in the request message.")
      setProfileRequestSubmitting(false)
      return
    }

    const meta: Record<string, unknown> = {}
    if (profileRequestForm.startDate) meta.startDate = profileRequestForm.startDate
    if (profileRequestForm.endDate) meta.endDate = profileRequestForm.endDate
    if (profileRequestForm.preferredShift.trim()) meta.preferredShift = profileRequestForm.preferredShift.trim()
    if (profileRequestForm.consultTopic.trim()) meta.consultTopic = profileRequestForm.consultTopic.trim()

    try {
      const res = await fetch("/api/staff/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: profileRequestForm.type, message, meta }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setProfileRequestError(typeof data?.error === "string" ? data.error : "Unable to submit request.")
        return
      }
      setProfileRequestSuccess("Request submitted. Staff management will review it shortly.")
      setProfileRequestForm((prev) => ({ ...prev, message: "", startDate: "", endDate: "", preferredShift: "", consultTopic: "" }))
      await fetchStaffRequests(profileRequestStatusFilter, { scope: "mine" })
    } catch {
      setProfileRequestError("Network error while submitting request.")
    } finally {
      setProfileRequestSubmitting(false)
    }
  }, [fetchStaffRequests, handleStaffAuthFailure, profileRequestForm, profileRequestStatusFilter])

  return {
    profileRequestStatusFilter,
    setProfileRequestStatusFilter,
    selfProfileLoading,
    selfProfileRow,
    resolvedSelfProfile,
    selfPerformanceScore,
    selfRecommendations,
    profilePaymentSummaryCards,
    profilePaymentExpanded,
    setProfilePaymentExpanded,
    profilePaymentSaving,
    profilePaymentError,
    setProfilePaymentError,
    profilePaymentSuccess,
    setProfilePaymentSuccess,
    profilePaymentForm,
    setProfilePaymentForm,
    profileRequestSubmitting,
    profileRequestSuccess,
    profileRequestError,
    profileRequestForm,
    setProfileRequestForm,
    fetchSelfProfile,
    saveProfilePaymentInfo,
    submitProfileRequest,
  }
}
