"use client"

import React from "react"
import dynamic from "next/dynamic"
import GlassyCard from "@/components/front/courses/GlassyCard"
import { Flame, Medal, Star, Trophy, X, Music2, Camera } from "lucide-react"
import { demoCourses } from "@/constants/courses"
import type { CourseData } from "@/constants/courses"
import { useUser } from "@clerk/nextjs"
import { useCatalogCourses } from "@/components/front/hooks/useCatalogCourses"
import { useStudentPinStatus } from "@/components/front/hooks/useStudentPinStatus"
import CalendarPicker from "@/components/front/ui/CalendarPicker"
import { getAvailableTimesForCourseDate, isSlotInPastForTimeZone } from "@/lib/class-schedule"
import {
  buildBookingPrefillContact,
  buildProfileFormState,
  getPackageAssignmentSummary,
  getProfileCompletionPercent,
  type ProfileSnapshot,
} from "./profile-utils"

const EnrollModal = dynamic(() => import("../courses/EnrollModal"), { ssr: false })

type ProfileStatus = "NEW" | "ACTIVE" | "ALUMNI"

const statusLabel: Record<ProfileStatus, string> = {
  NEW: "New",
  ACTIVE: "Active",
  ALUMNI: "Alumni",
}

const NY_TIMEZONE = "America/New_York"
const AVAILABILITY_CACHE_TTL_MS = 45_000
const CHECK_IN_OPEN_WINDOW_HOURS = 2
const CHECK_IN_OPEN_WINDOW_MS = CHECK_IN_OPEN_WINDOW_HOURS * 60 * 60 * 1000

const toProfileStatus = (value: unknown): ProfileStatus => {
  if (value === "NEW" || value === "ACTIVE" || value === "ALUMNI") return value
  return "NEW"
}

const mockProfile = {
  name: "Student",
  level: "Beginner",
  status: "ACTIVE" as ProfileStatus,
  email: "",
  phone: "",
  phoneVerified: false,
  avatar: "/images/Teaches/elvira-portrait.jpg",
  packages: [
    { label: "Morning 3-week pack", remaining: 6 },
    { label: "Practice video access", remaining: 1 },
  ],
  promos: ["New student promo (used)", "Winter bonus 10%"],
  stats: {
    classesTaken: 18,
    streak: "3 weeks",
    lastClass: "Thursday 11:00 AM",
  },
  coins: {
    current: 320,
    goal: 500,
    freeClassesEarned: 1,
  },
  attendance: [
    { label: "Oct", value: 5 },
    { label: "Nov", value: 4 },
    { label: "Dec", value: 6 },
    { label: "Jan", value: 3 },
  ],
  medals: ["5 classes", "10 classes", "1 active month"],
  moments: [
    "/images/carousel/_DSC1079.JPG",
    "/images/carousel/_DSC1087.JPG",
    "/images/carousel/_DSC1076.JPG",
    "/images/carousel/_DSC1082.JPG",
  ],
  preferredCourses: ["salsa-femenina-matutina", "salsa-nocturno"],
  schedule: {
    recurring: "Tuesday 7:00 PM",
    nextClass: "Tuesday 7:00 PM",
    hasActiveBooking: false,
  },
  shoeTracking: {
    model: "Nike Flex",
    km: 320,
    maxKm: 500,
  },
}

type ProfileSaveResponse = {
  error?: string
  profile?: ProfileSnapshot | null
  profileComplete?: boolean
  pointsBalance?: number
}

type PackageSummary = {
  activePackages: number
  unlimitedPackages: number
  totalRemainingCredits: number
  nextExpiration: string | null
}

type ProfilePackageItem = {
  id: string
  packageId: string
  label: string
  courseSlug: string | null
  status: string
  isUnlimited: boolean
  totalCredits: number | null
  remainingCredits: number | null
  purchasedAt: string | null
  expiresAt: string | null
  lastUsedAt: string | null
  cadence: string | null
  source: string
}

type ActivityStats = {
  classesTaken: number
  weeklyAverage: number
  streakWeeks: number
  recurringLabel: string | null
  lastClassLabel: string | null
}

type MetricKey = "attendance" | "progress" | "rhythm"
type ActionRequestType = "CLASS_CHANGE" | "SUSPEND" | "CANCEL"

type BookingItem = {
  id: string
  status: string
  startsAt: string
  courseSlug: string
  courseTitle: string
  sessionId: string
  packagePurchaseId: string | null
  packageLabel: string | null
}

type AssignablePackage = {
  id: string
  packageId: string
  label: string
  courseSlug: string | null
  remainingCredits: number | null
  totalCredits: number | null
  isUnlimited: boolean
  expiresAt: string | null
}

type SlotAvailability = {
  time: string
  label: string
  isFull: boolean
  spotsLeft: number
  capacity: number
  isPast?: boolean
}

type CachedAvailabilityEntry = {
  slots: SlotAvailability[]
  cachedAt: number
}

type PointsEntry = {
  id: string
  type: string
  points: number
  createdAt: string
  meta?: Record<string, unknown> | null
}

type ActionRequestItem = {
  id: string
  type: ActionRequestType
  status: string
  message: string | null
  meta?: Record<string, unknown> | null
  createdAt: string
  resolvedAt: string | null
}

const analyticsMonths = ["Oct", "Nov", "Dec", "Jan"] as const
const analyticsMetricConfig: Record<MetricKey, { label: string; color: string; values: number[] }> = {
  attendance: {
    label: "Attendance",
    color: "var(--brand,#b61616)",
    values: [5, 4, 6, 3],
  },
  progress: {
    label: "Progress",
    color: "#ef6b6b",
    values: [2, 3, 4, 5],
  },
  rhythm: {
    label: "Rhythm",
    color: "#f59e0b",
    values: [1, 2, 3, 4],
  },
}

const actionRequestLabels: Record<ActionRequestType, string> = {
  CLASS_CHANGE: "Class change",
  SUSPEND: "Suspension",
  CANCEL: "Cancellation",
}

const actionRequestStatusLabel = (status: string) => {
  if (status === "PENDING") return "Pending"
  if (status === "PROCESSING") return "In progress"
  if (status === "RESOLVED") return "Resolved"
  if (status === "REJECTED") return "Rejected"
  return status
}

const formatRequestDate = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T12:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString("en-US", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const actionRequestMetaLabel = (request: ActionRequestItem) => {
  if (request.type === "SUSPEND") {
    const start = formatRequestDate(request.meta?.startDate)
    const end = formatRequestDate(request.meta?.endDate)
    const packageLabel = typeof request.meta?.packageLabel === "string" ? request.meta.packageLabel : ""
    if (start && end && packageLabel) return `${packageLabel} · from ${start} to ${end}`
    if (start && end) return `From ${start} to ${end}`
  }
  if (request.type === "CANCEL") {
    const effective = formatRequestDate(request.meta?.effectiveDate)
    const courseTitle = typeof request.meta?.courseTitle === "string" ? request.meta.courseTitle : ""
    if (effective && courseTitle) return `${courseTitle} · effective from ${effective}`
    if (effective) return `Effective from ${effective}`
  }
  return null
}

const getPendingProcessLabel = (request: ActionRequestItem | undefined) => {
  if (!request) return "Process"
  const type = actionRequestLabels[request.type] || request.type
  const status = actionRequestStatusLabel(request.status).toLowerCase()
  return `${type} (${status})`
}

const getProcessTypeTone = (type?: ActionRequestType | null) => {
  if (type === "CANCEL") {
    return {
      border: "rgba(239,68,68,0.45)",
      bg: "rgba(239,68,68,0.16)",
      text: "#fecaca",
      dot: "#f87171",
    }
  }
  if (type === "CLASS_CHANGE") {
    return {
      border: "rgba(59,130,246,0.45)",
      bg: "rgba(59,130,246,0.16)",
      text: "#bfdbfe",
      dot: "#60a5fa",
    }
  }
  if (type === "SUSPEND") {
    return {
      border: "rgba(245,158,11,0.45)",
      bg: "rgba(245,158,11,0.16)",
      text: "#fde68a",
      dot: "#fbbf24",
    }
  }
  return {
    border: "rgba(255,255,255,0.22)",
    bg: "rgba(255,255,255,0.08)",
    text: "rgba(255,255,255,0.82)",
    dot: "rgba(255,255,255,0.7)",
  }
}

const isPendingRequestStatus = (status: string) => status === "PENDING" || status === "PROCESSING"

const addDaysToIsoDate = (isoDate: string, days: number) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate
  const parsed = new Date(`${isoDate}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

const pointsTypeLabel = (type: string) => {
  if (type === "PROFILE_COMPLETED") return "Profile completed"
  if (type === "PACKAGE_PURCHASE") return "Package purchase"
  if (type === "PACKAGE_ASSIGNMENT") return "Class assignment"
  if (type === "CONSECUTIVE_ATTENDANCE") return "Consecutive attendance"
  if (type === "REFERRAL_BONUS") return "Referral"
  if (type === "CLASS_MILESTONE") return "Class milestone"
  return type
}

const formatDateKeyInTimeZone = (value: string | Date, timeZone = NY_TIMEZONE) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const year = parts.find((item) => item.type === "year")?.value ?? ""
  const month = parts.find((item) => item.type === "month")?.value ?? ""
  const day = parts.find((item) => item.type === "day")?.value ?? ""
  if (!year || !month || !day) return ""
  return `${year}-${month}-${day}`
}

const formatTimeKeyInTimeZone = (value: string | Date, timeZone = NY_TIMEZONE) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const hour = parts.find((item) => item.type === "hour")?.value ?? ""
  const minute = parts.find((item) => item.type === "minute")?.value ?? ""
  if (!hour || !minute) return ""
  return `${hour}:${minute}`
}

const formatDateTimeInTimeZone = (
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  },
  locale = "en-US",
  timeZone = NY_TIMEZONE
) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone,
  }).format(date)
}

export default function ProfilePageClient() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { courses: catalogCourses } = useCatalogCourses()
  const sourceCourses = React.useMemo(
    () => (catalogCourses.length ? catalogCourses : demoCourses),
    [catalogCourses]
  )
  const [e2eAuthBypass, setE2eAuthBypass] = React.useState(false)
  const [activeMetric, setActiveMetric] = React.useState<MetricKey>("attendance")
  const [hoverPoint, setHoverPoint] = React.useState<{ label: string; value: number; x: number; y: number; idx: number } | null>(null)
  const [coursePickerOpen, setCoursePickerOpen] = React.useState(false)
  const [selectedCourse, setSelectedCourse] = React.useState<CourseData | null>(null)
  const [enrollOpen, setEnrollOpen] = React.useState(false)
  const [profileLoading, setProfileLoading] = React.useState(false)
  const [profileSaving, setProfileSaving] = React.useState(false)
  const [profileError, setProfileError] = React.useState<string | null>(null)
  const [profileSaved, setProfileSaved] = React.useState(false)
  const [profileComplete, setProfileComplete] = React.useState(false)
  const [showProfileForm, setShowProfileForm] = React.useState(true)
  const [profileFormMounted, setProfileFormMounted] = React.useState(true)
  const [profileFormVisible, setProfileFormVisible] = React.useState(true)
  const [pointsBalance, setPointsBalance] = React.useState(0)
  const [packagesData, setPackagesData] = React.useState<ProfilePackageItem[]>([])
  const [packagesSummary, setPackagesSummary] = React.useState<PackageSummary>({
    activePackages: 0,
    unlimitedPackages: 0,
    totalRemainingCredits: 0,
    nextExpiration: null,
  })
  const [activityStats, setActivityStats] = React.useState<ActivityStats>({
    classesTaken: mockProfile.stats.classesTaken,
    weeklyAverage: 3.4,
    streakWeeks: 3,
    recurringLabel: mockProfile.schedule.recurring,
    lastClassLabel: mockProfile.stats.lastClass,
  })
  const [monthlyAttendance, setMonthlyAttendance] = React.useState<Array<{ label: string; value: number }>>(
    mockProfile.attendance
  )
  const [pointsEntries, setPointsEntries] = React.useState<PointsEntry[]>([])
  const [pointsLoading, setPointsLoading] = React.useState(false)
  const [pointsError, setPointsError] = React.useState<string | null>(null)
  const [freeClassThreshold, setFreeClassThreshold] = React.useState(500)
  const [freeClassesAvailable, setFreeClassesAvailable] = React.useState(0)
  const [pointsToNextFreeClass, setPointsToNextFreeClass] = React.useState(500)
  const [actionRequests, setActionRequests] = React.useState<ActionRequestItem[]>([])
  const [actionRequestsLoading, setActionRequestsLoading] = React.useState(false)
  const [actionRequestsError, setActionRequestsError] = React.useState<string | null>(null)
  const [bookings, setBookings] = React.useState<BookingItem[]>([])
  const [assignablePackages, setAssignablePackages] = React.useState<AssignablePackage[]>([])
  const [bookingsLoading, setBookingsLoading] = React.useState(false)
  const [bookingsError, setBookingsError] = React.useState<string | null>(null)
  const [checkInSubmittingId, setCheckInSubmittingId] = React.useState<string | null>(null)
  const [checkInError, setCheckInError] = React.useState<string | null>(null)
  const [checkInSuccess, setCheckInSuccess] = React.useState<string | null>(null)
  const [changeModalOpen, setChangeModalOpen] = React.useState(false)
  const [rescheduleStep, setRescheduleStep] = React.useState<1 | 2 | 3>(1)
  const [selectedBookingId, setSelectedBookingId] = React.useState<string>("")
  const [rescheduleCourseSlug, setRescheduleCourseSlug] = React.useState("")
  const [rescheduleDate, setRescheduleDate] = React.useState("")
  const [rescheduleTime, setRescheduleTime] = React.useState("")
  const [availability, setAvailability] = React.useState<SlotAvailability[]>([])
  const [availabilityLoading, setAvailabilityLoading] = React.useState(false)
  const [rescheduleSaving, setRescheduleSaving] = React.useState(false)
  const [rescheduleError, setRescheduleError] = React.useState<string | null>(null)
  const [rescheduleSuccess, setRescheduleSuccess] = React.useState<string | null>(null)
  const [assignPackageId, setAssignPackageId] = React.useState("")
  const [assignDate, setAssignDate] = React.useState("")
  const [assignTime, setAssignTime] = React.useState("")
  const [assignAvailability, setAssignAvailability] = React.useState<SlotAvailability[]>([])
  const [assignAvailabilityLoading, setAssignAvailabilityLoading] = React.useState(false)
  const [assignSlots, setAssignSlots] = React.useState<Array<{ date: string; time: string }>>([])
  const [assigning, setAssigning] = React.useState(false)
  const [assignError, setAssignError] = React.useState<string | null>(null)
  const [assignSuccess, setAssignSuccess] = React.useState<string | null>(null)
  const [requestModalType, setRequestModalType] = React.useState<ActionRequestType | null>(null)
  const [requestMessage, setRequestMessage] = React.useState("")
  const [requestSuspendStart, setRequestSuspendStart] = React.useState("")
  const [requestSuspendEnd, setRequestSuspendEnd] = React.useState("")
  const [requestSuspendPackageId, setRequestSuspendPackageId] = React.useState("")
  const [requestCancelEffectiveDate, setRequestCancelEffectiveDate] = React.useState("")
  const [requestCancelBookingId, setRequestCancelBookingId] = React.useState("")
  const [requestCancelDecision, setRequestCancelDecision] = React.useState<"REASSIGN" | "REFUND" | null>(null)
  const [requestSubmitting, setRequestSubmitting] = React.useState(false)
  const [requestSubmitError, setRequestSubmitError] = React.useState<string | null>(null)
  const [requestSubmitSuccess, setRequestSubmitSuccess] = React.useState<string | null>(null)
  const [mobileAgendaOpenDay, setMobileAgendaOpenDay] = React.useState<number | null>(null)
  const [pinCurrentValue, setPinCurrentValue] = React.useState("")
  const [pinNextValue, setPinNextValue] = React.useState("")
  const [pinConfirmValue, setPinConfirmValue] = React.useState("")
  const [pinRecoveryMode, setPinRecoveryMode] = React.useState(false)
  const [pinSaving, setPinSaving] = React.useState(false)
  const [pinFormError, setPinFormError] = React.useState<string | null>(null)
  const [pinFormSuccess, setPinFormSuccess] = React.useState<string | null>(null)
  const profileSavedTimeout = React.useRef<number | null>(null)
  const availabilityCacheRef = React.useRef<Map<string, CachedAvailabilityEntry>>(new Map())
  const availabilityInflightRef = React.useRef<Map<string, Promise<SlotAvailability[] | null>>>(new Map())
  const rescheduleAvailabilityRequestRef = React.useRef(0)
  const assignAvailabilityRequestRef = React.useRef(0)
  const currentCoins = Math.max(0, pointsBalance)
  const progress = Math.min(100, Math.round((currentCoins / Math.max(1, freeClassThreshold)) * 100))
  const shoeProgress = Math.min(100, Math.round((mockProfile.shoeTracking.km / mockProfile.shoeTracking.maxKm) * 100))
  const [profileUser, setProfileUser] = React.useState({
    name: "",
    email: "",
    phone: "",
    phoneVerified: false,
    imageUrl: "",
    level: mockProfile.level,
    status: mockProfile.status,
  })
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [avatarUploading, setAvatarUploading] = React.useState(false)
  const [avatarError, setAvatarError] = React.useState<string | null>(null)
  const [profileForm, setProfileForm] = React.useState(() => buildProfileFormState(null, null))
  const [agendaMonth, setAgendaMonth] = React.useState(() => new Date().getMonth())
  const [agendaYear, setAgendaYear] = React.useState(() => new Date().getFullYear())
  const stickyTop = 76
  const gridRef = React.useRef<HTMLDivElement>(null)
  const leftRailRef = React.useRef<HTMLDivElement>(null)
  const rightRailRef = React.useRef<HTMLDivElement>(null)
  const bookingPrefillContact = React.useMemo(
    () => buildBookingPrefillContact(profileForm, profileUser, user),
    [profileForm, profileUser, user]
  )
  const canLoadProtectedData = (isLoaded && isSignedIn) || e2eAuthBypass
  const { status: pinStatus, loading: pinLoading, error: pinStatusError, refresh: refreshPinStatus } = useStudentPinStatus(canLoadProtectedData)

  const preferredSet = React.useMemo(() => new Set(mockProfile.preferredCourses), [])
  const orderedCourses = React.useMemo(() => {
    const preferred = sourceCourses.filter((course) => preferredSet.has(course.slug))
    const rest = sourceCourses.filter((course) => !preferredSet.has(course.slug))
    return [...preferred, ...rest]
  }, [preferredSet, sourceCourses])

  const classRequestsByAttendance = React.useMemo(() => {
    const map = new Map<string, ActionRequestItem>()
    for (const request of actionRequests) {
      if (!isPendingRequestStatus(request.status)) continue
      const attendanceId = typeof request.meta?.attendanceId === "string" ? request.meta.attendanceId.trim() : ""
      if (!attendanceId) continue
      if (!map.has(attendanceId)) map.set(attendanceId, request)
    }
    return map
  }, [actionRequests])
  const pendingBookings = React.useMemo(
    () => bookings.filter((item) => classRequestsByAttendance.has(item.id)),
    [bookings, classRequestsByAttendance]
  )
  const visibleBookings = React.useMemo(
    () => bookings.filter((item) => !classRequestsByAttendance.has(item.id)),
    [bookings, classRequestsByAttendance]
  )
  const selectedBooking = React.useMemo(
    () => visibleBookings.find((item) => item.id === selectedBookingId) || visibleBookings[0] || null,
    [visibleBookings, selectedBookingId]
  )
  const nextCheckInBooking = React.useMemo(() => {
    const now = Date.now()
    return (
      visibleBookings.find((booking) => {
        const startsAtMs = new Date(booking.startsAt).getTime()
        if (Number.isNaN(startsAtMs)) return false
        return startsAtMs <= now + CHECK_IN_OPEN_WINDOW_MS
      }) || null
    )
  }, [visibleBookings])
  const pendingCheckInBooking = React.useMemo(() => {
    if (nextCheckInBooking) return null
    return visibleBookings[0] || null
  }, [nextCheckInBooking, visibleBookings])
  const checkInOpensAtLabel = React.useMemo(() => {
    if (!pendingCheckInBooking) return ""
    const startsAtMs = new Date(pendingCheckInBooking.startsAt).getTime()
    if (Number.isNaN(startsAtMs)) return ""
    return formatDateTimeInTimeZone(new Date(startsAtMs - CHECK_IN_OPEN_WINDOW_MS), {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    })
  }, [pendingCheckInBooking])
  const requestCancelBooking = React.useMemo(
    () => visibleBookings.find((item) => item.id === requestCancelBookingId) || null,
    [visibleBookings, requestCancelBookingId]
  )
  const suspendablePackages = React.useMemo(() => assignablePackages, [assignablePackages])
  const selectedBookingDateKey = React.useMemo(
    () => (selectedBooking ? formatDateKeyInTimeZone(selectedBooking.startsAt, NY_TIMEZONE) : ""),
    [selectedBooking]
  )
  const selectedBookingTimeKey = React.useMemo(
    () => (selectedBooking ? formatTimeKeyInTimeZone(selectedBooking.startsAt, NY_TIMEZONE) : ""),
    [selectedBooking]
  )
  const isCurrentRescheduleSlot = React.useCallback(
    (date: string, time: string) => {
      if (!selectedBookingDateKey || !selectedBookingTimeKey) return false
      return date === selectedBookingDateKey && time === selectedBookingTimeKey
    },
    [selectedBookingDateKey, selectedBookingTimeKey]
  )
  const rescheduleCourseOptions = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const booking of visibleBookings) {
      if (!map.has(booking.courseSlug)) {
        map.set(booking.courseSlug, booking.courseTitle)
      }
    }
    return Array.from(map.entries()).map(([slug, title]) => ({ slug, title }))
  }, [visibleBookings])
  const rescheduleScopedBookings = React.useMemo(() => {
    if (!rescheduleCourseSlug) return visibleBookings
    return visibleBookings.filter((booking) => booking.courseSlug === rescheduleCourseSlug)
  }, [rescheduleCourseSlug, visibleBookings])
  const rescheduleBookedTimesByDate = React.useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const booking of bookings) {
      if (booking.id === selectedBookingId) continue
      const dateKey = formatDateKeyInTimeZone(booking.startsAt, NY_TIMEZONE)
      const timeKey = formatTimeKeyInTimeZone(booking.startsAt, NY_TIMEZONE)
      if (!dateKey || !timeKey) continue
      const current = map.get(dateKey) || new Set<string>()
      current.add(timeKey)
      map.set(dateKey, current)
    }
    return map
  }, [bookings, selectedBookingId])
  const rescheduleBookedTimesForSelectedDate = React.useMemo(() => {
    if (!rescheduleDate) return new Set<string>()
    return rescheduleBookedTimesByDate.get(rescheduleDate) || new Set<string>()
  }, [rescheduleBookedTimesByDate, rescheduleDate])
  const todayNyDateKey = formatDateKeyInTimeZone(new Date(), NY_TIMEZONE)
  const isRescheduleDateBlocked = React.useCallback(
    (dateIso: string) => {
      if (!selectedBooking?.courseSlug) return false
      const availableTimes = getAvailableTimesForCourseDate(selectedBooking.courseSlug, dateIso, sourceCourses)
      if (!availableTimes.length) return false
      const futureTimes = availableTimes.filter((time) => !isSlotInPastForTimeZone(dateIso, time, NY_TIMEZONE))
      if (!futureTimes.length) return true
      const occupied = rescheduleBookedTimesByDate.get(dateIso)
      if (!occupied || occupied.size === 0) return false
      return futureTimes.every((time) => occupied.has(time))
    },
    [rescheduleBookedTimesByDate, selectedBooking?.courseSlug]
  )
  const getRescheduleDateBlockReason = React.useCallback(
    (dateIso: string) => {
      if (!selectedBooking?.courseSlug) return undefined
      const availableTimes = getAvailableTimesForCourseDate(selectedBooking.courseSlug, dateIso, sourceCourses)
      if (!availableTimes.length) return undefined
      const futureTimes = availableTimes.filter((time) => !isSlotInPastForTimeZone(dateIso, time, NY_TIMEZONE))
      if (!futureTimes.length) return "The time slots for this day have already passed."
      const occupied = rescheduleBookedTimesByDate.get(dateIso)
      if (occupied && futureTimes.every((time) => occupied.has(time))) {
        return "That time slot on that day is already taken by another class."
      }
      return undefined
    },
    [rescheduleBookedTimesByDate, selectedBooking?.courseSlug, sourceCourses]
  )
  const pendingAssignablePackages = React.useMemo(
    () => assignablePackages.filter((pkg) => pkg.isUnlimited || (pkg.remainingCredits ?? 0) > 0),
    [assignablePackages]
  )

  const selectedBookingCourse = React.useMemo(() => {
    if (!selectedBooking) return null
    return sourceCourses.find((course) => course.slug === selectedBooking.courseSlug) || null
  }, [selectedBooking, sourceCourses])

  const selectedPackageForAssign = React.useMemo(
    () => assignablePackages.find((item) => item.id === assignPackageId) || null,
    [assignPackageId, assignablePackages]
  )
  const selectedPackageCourse = React.useMemo(() => {
    if (!selectedPackageForAssign?.courseSlug) return null
    return sourceCourses.find((course) => course.slug === selectedPackageForAssign.courseSlug) || null
  }, [selectedPackageForAssign, sourceCourses])
  const selectedPackageAssignmentStats = React.useMemo(() => {
    if (!selectedPackageForAssign) return null
    const assignedBookingsCount = bookings.filter(
      (booking) => booking.packagePurchaseId === selectedPackageForAssign.id
    ).length
    return getPackageAssignmentSummary({
      isUnlimited: selectedPackageForAssign.isUnlimited,
      totalCredits: selectedPackageForAssign.totalCredits,
      remainingCredits: selectedPackageForAssign.remainingCredits,
      queuedCount: assignSlots.length,
      assignedBookingsCount,
    })
  }, [assignSlots.length, bookings, selectedPackageForAssign])
  const assignBookedTimesByDate = React.useMemo(() => {
    const map = new Map<string, Set<string>>()
    if (!selectedPackageForAssign?.courseSlug) return map
    for (const booking of bookings) {
      if (booking.courseSlug !== selectedPackageForAssign.courseSlug) continue
      const dateKey = formatDateKeyInTimeZone(booking.startsAt)
      const timeKey = formatTimeKeyInTimeZone(booking.startsAt)
      if (!dateKey || !timeKey) continue
      const current = map.get(dateKey) || new Set<string>()
      current.add(timeKey)
      map.set(dateKey, current)
    }
    return map
  }, [bookings, selectedPackageForAssign?.courseSlug])
  const assignUnavailableDates = React.useMemo(() => {
    if (!selectedPackageForAssign?.courseSlug) return [] as string[]
    const dates: string[] = []
    for (const [dateKey, bookedTimes] of assignBookedTimesByDate.entries()) {
      const availableTimes = getAvailableTimesForCourseDate(selectedPackageForAssign.courseSlug, dateKey, sourceCourses)
      if (!availableTimes.length) continue
      const futureTimes = availableTimes.filter((time) => !isSlotInPastForTimeZone(dateKey, time, NY_TIMEZONE))
      if (!futureTimes.length) {
        dates.push(dateKey)
        continue
      }
      const allTaken = futureTimes.every((slot) => bookedTimes.has(slot))
      if (allTaken) dates.push(dateKey)
    }
    const todayAvailableTimes = getAvailableTimesForCourseDate(
      selectedPackageForAssign.courseSlug,
      todayNyDateKey,
      sourceCourses
    )
    if (
      todayAvailableTimes.length > 0 &&
      todayAvailableTimes.every((time) => isSlotInPastForTimeZone(todayNyDateKey, time, NY_TIMEZONE)) &&
      !dates.includes(todayNyDateKey)
    ) {
      dates.push(todayNyDateKey)
    }
    return dates
  }, [assignBookedTimesByDate, selectedPackageForAssign?.courseSlug, sourceCourses, todayNyDateKey])
  const assignBookedTimesForSelectedDate = React.useMemo(() => {
    if (!assignDate) return new Set<string>()
    return assignBookedTimesByDate.get(assignDate) || new Set<string>()
  }, [assignBookedTimesByDate, assignDate])

  const loadPointsHistory = React.useCallback(async () => {
    if (!canLoadProtectedData) return
    setPointsLoading(true)
    setPointsError(null)
    try {
      const res = await fetch("/api/profile/points")
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setPointsError(data?.error || "Could not load points history.")
        return
      }
      setPointsBalance(typeof data?.balance === "number" ? data.balance : 0)
      setFreeClassThreshold(
        typeof data?.freeClassThreshold === "number" && data.freeClassThreshold > 0 ? data.freeClassThreshold : 500
      )
      setFreeClassesAvailable(
        typeof data?.freeClassesAvailable === "number" ? Math.max(0, data.freeClassesAvailable) : 0
      )
      setPointsToNextFreeClass(
        typeof data?.pointsToNextFreeClass === "number"
          ? Math.max(0, data.pointsToNextFreeClass)
          : Math.max(0, 500 - (typeof data?.balance === "number" ? data.balance : 0))
      )
      setPointsEntries(Array.isArray(data?.entries) ? data.entries : [])
    } catch {
      setPointsError("Could not load points history.")
    } finally {
      setPointsLoading(false)
    }
  }, [canLoadProtectedData])

  const loadActionRequests = React.useCallback(async () => {
    if (!canLoadProtectedData) return
    setActionRequestsLoading(true)
    setActionRequestsError(null)
    try {
      const res = await fetch("/api/profile/requests")
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setActionRequestsError(data?.error || "Could not load your requests.")
        return
      }
      setActionRequests(Array.isArray(data?.requests) ? data.requests : [])
    } catch {
      setActionRequestsError("Could not load your requests.")
    } finally {
      setActionRequestsLoading(false)
    }
  }, [canLoadProtectedData])

  const clearAvailabilityCache = React.useCallback(() => {
    availabilityCacheRef.current.clear()
    availabilityInflightRef.current.clear()
  }, [])

  const fetchAvailability = React.useCallback(
    async (courseSlug: string, date: string, attendanceId?: string) => {
      const cacheKey = `${courseSlug}|${date}|${attendanceId || ""}`
      const now = Date.now()

      const cached = availabilityCacheRef.current.get(cacheKey)
      if (cached && now - cached.cachedAt <= AVAILABILITY_CACHE_TTL_MS) {
        return cached.slots
      }

      const inflight = availabilityInflightRef.current.get(cacheKey)
      if (inflight) {
        return inflight
      }

      const request = (async () => {
        const query = new URLSearchParams({
          courseSlug,
          date,
          ...(attendanceId ? { excludeAttendanceId: attendanceId } : {}),
        })
        const res = await fetch(`/api/profile/bookings/availability?${query.toString()}`)
        const data = await res.json().catch(() => null)
        if (!res.ok) return null
        const slots = Array.isArray(data?.slots) ? (data.slots as SlotAvailability[]) : []
        availabilityCacheRef.current.set(cacheKey, { slots, cachedAt: Date.now() })
        return slots
      })()

      availabilityInflightRef.current.set(cacheKey, request)
      try {
        return await request
      } finally {
        availabilityInflightRef.current.delete(cacheKey)
      }
    },
    []
  )

  const loadBookings = React.useCallback(async () => {
    if (!canLoadProtectedData) return
    setBookingsLoading(true)
    setBookingsError(null)
    try {
      const res = await fetch("/api/profile/bookings")
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setBookingsError(data?.error || "Unable to load your scheduled classes.")
        return
      }
      clearAvailabilityCache()
      const bookingsData = Array.isArray(data?.bookings) ? (data.bookings as BookingItem[]) : []
      const packagesData = Array.isArray(data?.packages) ? (data.packages as AssignablePackage[]) : []
      setBookings(bookingsData)
      setAssignablePackages(packagesData)
      if (bookingsData.length > 0) {
        setSelectedBookingId((prev) => (prev && bookingsData.some((item) => item.id === prev) ? prev : bookingsData[0].id))
      } else {
        setSelectedBookingId("")
      }
      setAssignPackageId((prev) => (prev && packagesData.some((item) => item.id === prev) ? prev : packagesData[0]?.id || ""))
      return { bookings: bookingsData, packages: packagesData }
    } catch {
      setBookingsError("Unable to load your scheduled classes.")
      return null
    } finally {
      setBookingsLoading(false)
    }
  }, [canLoadProtectedData, clearAvailabilityCache])

  const loadAvailability = React.useCallback(
    async (courseSlug: string, date: string, attendanceId?: string) => {
      if (!courseSlug || !date) {
        setAvailability([])
        return
      }
      const requestId = ++rescheduleAvailabilityRequestRef.current
      setAvailabilityLoading(true)
      try {
        const slots = await fetchAvailability(courseSlug, date, attendanceId)
        if (requestId !== rescheduleAvailabilityRequestRef.current) return
        if (!slots) {
          setAvailability([])
          return
        }
        setAvailability(slots)
      } catch {
        if (requestId !== rescheduleAvailabilityRequestRef.current) return
        setAvailability([])
      } finally {
        if (requestId !== rescheduleAvailabilityRequestRef.current) return
        setAvailabilityLoading(false)
      }
    },
    [fetchAvailability]
  )

  const loadAssignAvailability = React.useCallback(
    async (courseSlug: string, date: string) => {
      if (!courseSlug || !date) {
        setAssignAvailability([])
        return
      }
      const requestId = ++assignAvailabilityRequestRef.current
      setAssignAvailabilityLoading(true)
      try {
        const slots = await fetchAvailability(courseSlug, date)
        if (requestId !== assignAvailabilityRequestRef.current) return
        if (!slots) {
          setAssignAvailability([])
          return
        }
        setAssignAvailability(slots)
      } catch {
        if (requestId !== assignAvailabilityRequestRef.current) return
        setAssignAvailability([])
      } finally {
        if (requestId !== assignAvailabilityRequestRef.current) return
        setAssignAvailabilityLoading(false)
      }
    },
    [fetchAvailability]
  )

  const hydrateRescheduleFromBooking = React.useCallback(
    (booking: BookingItem | null) => {
      if (!booking) {
        setRescheduleDate("")
        setRescheduleTime("")
        setAvailability([])
        return
      }
      const startsAt = new Date(booking.startsAt)
      if (Number.isNaN(startsAt.getTime())) {
        setRescheduleDate("")
        setRescheduleTime("")
        setAvailability([])
        return
      }
      const dateIso = formatDateKeyInTimeZone(startsAt, NY_TIMEZONE)
      const timeKey = formatTimeKeyInTimeZone(startsAt, NY_TIMEZONE)
      setRescheduleDate(dateIso)
      setRescheduleTime(timeKey)
      if (dateIso) {
        void loadAvailability(booking.courseSlug, dateIso, booking.id)
      } else {
        setAvailability([])
      }
    },
    [loadAvailability]
  )

  const openChangeClassModalForBooking = React.useCallback(
    (bookingId: string) => {
      const booking = visibleBookings.find((item) => item.id === bookingId) || null
      if (!booking) {
        setRescheduleError("You don't have a scheduled class to change.")
        return false
      }
      setRescheduleError(null)
      setRescheduleSuccess(null)
      setRescheduleStep(1)
      setSelectedBookingId(booking.id)
      setRescheduleCourseSlug(booking.courseSlug)
      hydrateRescheduleFromBooking(booking)
      setChangeModalOpen(true)
      return true
    },
    [hydrateRescheduleFromBooking, visibleBookings]
  )

  const openChangeClassModal = () => {
    if (!selectedBooking) {
      setRescheduleError("You don't have a scheduled class to change.")
      return
    }
    openChangeClassModalForBooking(selectedBooking.id)
  }

  const closeChangeClassModal = () => {
    setChangeModalOpen(false)
    setRescheduleStep(1)
    setRescheduleCourseSlug("")
    setRescheduleError(null)
    setRescheduleSuccess(null)
  }

  const openSuspendModal = () => {
    if (!suspendablePackages.length) {
      setRequestSubmitError("You don't have active packages to suspend.")
      return
    }
    const today = formatDateKeyInTimeZone(new Date(), NY_TIMEZONE) || new Date().toISOString().slice(0, 10)
    setRequestModalType("SUSPEND")
    setRequestMessage("")
    setRequestSuspendStart(today)
    setRequestSuspendEnd(addDaysToIsoDate(today, 14))
    setRequestSuspendPackageId(suspendablePackages[0]?.id || "")
    setRequestCancelBookingId("")
    setRequestCancelDecision(null)
    setRequestCancelEffectiveDate("")
    setRequestSubmitError(null)
    setRequestSubmitSuccess(null)
  }

  const openCancelModal = () => {
    if (!visibleBookings.length) {
      setRequestSubmitError("You don't have assigned classes available to cancel.")
      return
    }
    const booking = selectedBooking || visibleBookings[0]
    const effectiveDate = booking ? formatDateKeyInTimeZone(booking.startsAt, NY_TIMEZONE) : ""
    setRequestModalType("CANCEL")
    setRequestMessage("")
    setRequestCancelBookingId(booking?.id || "")
    setRequestCancelDecision(null)
    setRequestCancelEffectiveDate(effectiveDate)
    setRequestSuspendPackageId("")
    setRequestSuspendStart("")
    setRequestSuspendEnd("")
    setRequestSubmitError(null)
    setRequestSubmitSuccess(null)
  }

  const closeRequestModal = () => {
    setRequestModalType(null)
    setRequestMessage("")
    setRequestSuspendStart("")
    setRequestSuspendEnd("")
    setRequestSuspendPackageId("")
    setRequestCancelEffectiveDate("")
    setRequestCancelBookingId("")
    setRequestCancelDecision(null)
    setRequestSubmitError(null)
  }

  const submitActionRequest = async () => {
    if (!requestModalType) return
    const message = requestMessage.trim()
    let meta: Record<string, unknown> | undefined

    if (requestModalType === "SUSPEND") {
      if (!requestSuspendPackageId) {
        setRequestSubmitError("Select a package to suspend.")
        return
      }
      if (!requestSuspendStart || !requestSuspendEnd) {
        setRequestSubmitError("Select start and end dates for the suspension.")
        return
      }
      if (requestSuspendEnd < requestSuspendStart) {
        setRequestSubmitError("End date cannot be earlier than start date.")
        return
      }
      meta = {
        startDate: requestSuspendStart,
        endDate: requestSuspendEnd,
        packagePurchaseId: requestSuspendPackageId,
      }
    }

    if (requestModalType === "CANCEL") {
      if (!requestCancelBookingId) {
        setRequestSubmitError("Select the class you want to cancel.")
        return
      }
      if (!requestCancelDecision) {
        setRequestSubmitError("Select whether you want to reassign or request a refund.")
        return
      }
      if (requestCancelDecision === "REASSIGN") {
        closeRequestModal()
        openChangeClassModalForBooking(requestCancelBookingId)
        return
      }
      const booking = visibleBookings.find((item) => item.id === requestCancelBookingId) || null
      if (!booking) {
        setRequestSubmitError("We couldn't find the selected class to cancel.")
        return
      }
      const effectiveDate = requestCancelEffectiveDate || formatDateKeyInTimeZone(booking.startsAt, NY_TIMEZONE)
      if (!effectiveDate) {
        setRequestSubmitError("We couldn't determine the effective date for cancellation.")
        return
      }
      meta = {
        effectiveDate,
        attendanceId: booking.id,
        refundRequested: true,
      }
    }

    setRequestSubmitting(true)
    setRequestSubmitError(null)
    try {
      const res = await fetch("/api/profile/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: requestModalType,
          message,
          meta,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setRequestSubmitError(data?.error || "Could not create the request.")
        return
      }
      setRequestSubmitSuccess(`${actionRequestLabels[requestModalType].toLowerCase()} request sent.`)
      closeRequestModal()
      await loadActionRequests()
    } catch {
      setRequestSubmitError("Could not create the request.")
    } finally {
      setRequestSubmitting(false)
    }
  }

  const submitStudentPin = async () => {
    if (!pinRecoveryMode && pinStatus.enrolled && !/^\d{4}$/.test(pinCurrentValue)) {
      setPinFormError("Enter your current 4-digit PIN.")
      return
    }
    if (!/^\d{4}$/.test(pinNextValue)) {
      setPinFormError("New PIN must be exactly 4 digits.")
      return
    }
    if (pinNextValue !== pinConfirmValue) {
      setPinFormError("PIN confirmation does not match.")
      return
    }

    setPinSaving(true)
    setPinFormError(null)
    setPinFormSuccess(null)
    try {
      const res = await fetch("/api/profile/pin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPin: pinRecoveryMode ? undefined : pinCurrentValue,
          nextPin: pinNextValue,
          confirmPin: pinConfirmValue,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setPinFormError(data?.error || "Could not update your PIN.")
        return
      }
      setPinCurrentValue("")
      setPinNextValue("")
      setPinConfirmValue("")
      setPinFormSuccess(pinRecoveryMode ? "PIN recovered successfully." : "PIN updated successfully.")
      await refreshPinStatus()
    } catch {
      setPinFormError("Could not update your PIN.")
    } finally {
      setPinSaving(false)
    }
  }

  const openRequestModal = (type: ActionRequestType) => {
    if (type === "SUSPEND") {
      openSuspendModal()
      return
    }
    if (type === "CANCEL") {
      openCancelModal()
      return
    }
    setRequestSubmitError("This request type is handled from 'Change class'.")
  }

  const continueRescheduleStep = () => {
    if (!selectedBooking || !rescheduleDate || !rescheduleTime) {
      setRescheduleError("Select date and time.")
      return
    }
    if (isSlotInPastForTimeZone(rescheduleDate, rescheduleTime, NY_TIMEZONE)) {
      setRescheduleError("That time slot has already passed.")
      return
    }
    if (isCurrentRescheduleSlot(rescheduleDate, rescheduleTime)) {
      setRescheduleError("You can't reassign to the same day and current time slot.")
      return
    }
    if (rescheduleBookedTimesForSelectedDate.has(rescheduleTime)) {
      setRescheduleError("That time slot on that day is already taken by another class.")
      return
    }
    setRescheduleError(null)
    setRescheduleSuccess(null)
    setRescheduleStep(2)
  }

  const postReschedule = async (attendanceId: string, date: string, time: string) => {
    const res = await fetch("/api/profile/bookings/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceId, date, time }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        ok: false as const,
        error: data?.error || "Unable to change class.",
      }
    }
    return { ok: true as const }
  }

  const submitPrimaryReschedule = async () => {
    if (!selectedBooking || !rescheduleDate || !rescheduleTime) {
      setRescheduleError("Select date and time.")
      return
    }
    setRescheduleSaving(true)
    setRescheduleError(null)
    setRescheduleSuccess(null)
    const primaryId = selectedBooking.id
    try {
      const result = await postReschedule(primaryId, rescheduleDate, rescheduleTime)
      if (!result.ok) {
        setRescheduleError(result.error)
        return
      }
      clearAvailabilityCache()

      const refreshed = await loadBookings()
      await loadActionRequests()

      const refreshedPackages = refreshed?.packages || []
      const hasPendingAssignments = refreshedPackages.some((pkg) => pkg.isUnlimited || (pkg.remainingCredits ?? 0) > 0)
      setRescheduleSuccess("Class rescheduled successfully.")
      if (hasPendingAssignments) {
        setRescheduleStep(3)
      } else {
        window.setTimeout(() => closeChangeClassModal(), 700)
      }
    } catch {
      setRescheduleError("Unable to change class.")
    } finally {
      setRescheduleSaving(false)
    }
  }

  const addAssignSlot = () => {
    if (!assignPackageId) {
      setAssignError("Select a package.")
      return
    }
    if (!assignDate || !assignTime) {
      setAssignError("Select date and time to add the class.")
      return
    }
    if (isSlotInPastForTimeZone(assignDate, assignTime, NY_TIMEZONE)) {
      setAssignError("That time slot has already passed.")
      return
    }
    if (assignBookedTimesForSelectedDate.has(assignTime)) {
      setAssignError("That time slot is already reserved by you.")
      return
    }
    const slotKey = `${assignDate}|${assignTime}`
    if (assignSlots.some((slot) => `${slot.date}|${slot.time}` === slotKey)) {
      setAssignError("That time slot is already added.")
      return
    }
    setAssignError(null)
    setAssignSuccess(null)
    setAssignSlots((prev) => [...prev, { date: assignDate, time: assignTime }])
    setAssignTime("")
  }

  const removeAssignSlot = (index: number) => {
    setAssignSlots((prev) => prev.filter((_, idx) => idx !== index))
  }

  const submitAssignClasses = async () => {
    if (!assignPackageId) {
      setAssignError("Select a package.")
      return
    }
    const cleaned = assignSlots
      .map((slot) => ({ date: slot.date.trim(), time: slot.time.trim() }))
      .filter((slot) => slot.date && slot.time)
    if (!cleaned.length) {
      setAssignError("Add at least one class to assign.")
      return
    }

    setAssigning(true)
    setAssignError(null)
    setAssignSuccess(null)
    try {
      const res = await fetch("/api/profile/bookings/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packagePurchaseId: assignPackageId,
          assignments: cleaned,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setAssignError(data?.error || "Unable to assign package classes.")
        return
      }
      setAssignSuccess("Package classes assigned successfully.")
      setAssignSlots([])
      setAssignDate("")
      setAssignTime("")
      setAssignAvailability([])
      clearAvailabilityCache()
      await Promise.all([loadBookings(), loadPointsHistory(), loadActionRequests()])
    } catch {
      setAssignError("Unable to assign package classes.")
    } finally {
      setAssigning(false)
    }
  }

  const submitBookingCheckIn = async (attendanceId: string) => {
    if (!attendanceId) return
    setCheckInSubmittingId(attendanceId)
    setCheckInError(null)
    setCheckInSuccess(null)
    try {
      const res = await fetch("/api/profile/bookings/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setCheckInError(data?.error || "Could not register your check-in.")
        return
      }

      const alreadyCheckedIn = Boolean(data?.alreadyCheckedIn)
      const pointsAwarded = typeof data?.points?.awarded === "number" ? data.points.awarded : 0
      const milestone = typeof data?.points?.milestone === "number" ? data.points.milestone : null
      let message = alreadyCheckedIn
        ? "This class was already marked as checked in."
        : "Check-in recorded successfully."
      if (!alreadyCheckedIn && pointsAwarded > 0) {
        message += ` +${pointsAwarded} points`
        if (milestone) message += ` (milestone ${milestone})`
        message += "."
      }
      setCheckInSuccess(message)
      await Promise.all([loadBookings(), loadPointsHistory()])
    } catch {
      setCheckInError("Could not register your check-in.")
    } finally {
      setCheckInSubmittingId(null)
    }
  }


  React.useEffect(() => {
    const grid = gridRef.current
    const left = leftRailRef.current
    const right = rightRailRef.current
    if (!grid || !left || !right) return

    let frame = 0

    const reset = (el: HTMLDivElement) => {
      el.style.position = ""
      el.style.top = ""
      el.style.left = ""
      el.style.width = ""
      el.style.zIndex = ""
    }

    const update = () => {
      if (window.innerWidth < 1024) {
        reset(left)
        reset(right)
        return
      }

      const scrollY = window.scrollY
      const gridRect = grid.getBoundingClientRect()
      const gridTop = gridRect.top + scrollY
      const gridBottom = gridTop + grid.offsetHeight
      const gridLeft = gridRect.left + window.scrollX
      const gridWidth = gridRect.width

      const leftParent = left.parentElement as HTMLElement | null
      const rightParent = right.parentElement as HTMLElement | null
      const leftWidth = leftParent?.getBoundingClientRect().width ?? left.getBoundingClientRect().width
      const rightWidth = rightParent?.getBoundingClientRect().width ?? right.getBoundingClientRect().width

      const apply = (el: HTMLDivElement, leftPos: number, width: number) => {
        if (scrollY + stickyTop < gridTop) {
          reset(el)
          return
        }

        const reachedBottom = scrollY + stickyTop + el.offsetHeight >= gridBottom
        if (reachedBottom) {
          el.style.position = "absolute"
          el.style.top = `${Math.max(0, grid.offsetHeight - el.offsetHeight)}px`
          el.style.left = `${Math.round(leftPos - gridLeft)}px`
          el.style.width = `${Math.round(width)}px`
          el.style.zIndex = "20"
          return
        }

        el.style.position = "fixed"
        el.style.top = `${stickyTop}px`
        el.style.left = `${Math.round(leftPos)}px`
        el.style.width = `${Math.round(width)}px`
        el.style.zIndex = "20"
      }

      apply(left, gridLeft, leftWidth)
      apply(right, gridLeft + gridWidth - rightWidth, rightWidth)
    }

    const onScroll = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    const resizeObserver = new ResizeObserver(() => onScroll())
    resizeObserver.observe(grid)
    resizeObserver.observe(left)
    resizeObserver.observe(right)

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    update()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      reset(left)
      reset(right)
    }
  }, [stickyTop])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    setE2eAuthBypass(params.get("e2eAuth") === "1")
  }, [])

  React.useEffect(() => {
    if (!canLoadProtectedData) return
    let active = true
    setProfileLoading(true)
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return
        const profile = data.profile
        const userPayload = data.user || {}
        const nameFromPayload =
          userPayload.name || [userPayload.firstName, userPayload.lastName].filter(Boolean).join(" ").trim()
        setProfileUser({
          name: nameFromPayload || user?.fullName || "",
          email: userPayload.email || user?.primaryEmailAddress?.emailAddress || "",
          phone: userPayload.phone || user?.primaryPhoneNumber?.phoneNumber || "",
          phoneVerified: Boolean(user?.primaryPhoneNumber?.verification?.status === "verified"),
          imageUrl: user?.imageUrl || "",
          level: mockProfile.level,
          status: toProfileStatus(userPayload.status),
        })
        setPointsBalance(data.pointsBalance || 0)
        setProfileComplete(Boolean(data.profileComplete))
        setProfileForm(buildProfileFormState(profile, data.user || user))
      })
      .catch(() => {
        if (!active) return
        setProfileUser({
          name: user?.fullName || "",
          email: user?.primaryEmailAddress?.emailAddress || "",
          phone: user?.primaryPhoneNumber?.phoneNumber || "",
          phoneVerified: Boolean(user?.primaryPhoneNumber?.verification?.status === "verified"),
          imageUrl: user?.imageUrl || "",
          level: mockProfile.level,
          status: "NEW",
        })
        setProfileError("We couldn't load your profile.")
      })
      .finally(() => {
        if (!active) return
        setProfileLoading(false)
      })
    return () => {
      active = false
    }
  }, [canLoadProtectedData, user])

  React.useEffect(() => {
    if (!canLoadProtectedData) return
    let active = true
    Promise.all([
      fetch("/api/profile/packages").then((res) => (res.ok ? res.json() : null)),
      fetch("/api/profile/activity").then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([packagesPayload, activityPayload]) => {
        if (!active) return
        if (packagesPayload?.packages) {
          setPackagesData(packagesPayload.packages)
          setPackagesSummary(
            packagesPayload.summary || {
              activePackages: 0,
              unlimitedPackages: 0,
              totalRemainingCredits: 0,
              nextExpiration: null,
            }
          )
        }
        if (activityPayload?.stats) {
          setActivityStats({
            classesTaken: activityPayload.stats.classesTaken ?? 0,
            weeklyAverage: activityPayload.stats.weeklyAverage ?? 0,
            streakWeeks: activityPayload.stats.streakWeeks ?? 0,
            recurringLabel: activityPayload.stats.recurringLabel ?? null,
            lastClassLabel: activityPayload.stats.lastClassLabel ?? null,
          })
        }
        if (Array.isArray(activityPayload?.monthlyAttendance) && activityPayload.monthlyAttendance.length) {
          setMonthlyAttendance(activityPayload.monthlyAttendance)
        }
      })
      .catch(() => {
        // keep current fallback UI values if profile activity endpoints fail
      })
    return () => {
      active = false
    }
  }, [canLoadProtectedData])

  React.useEffect(() => {
    void loadPointsHistory()
    void loadActionRequests()
    void loadBookings()
  }, [loadPointsHistory, loadActionRequests, loadBookings])

  React.useEffect(() => {
    if (visibleBookings.length === 0) {
      setSelectedBookingId("")
      setRequestCancelBookingId("")
      return
    }
    setSelectedBookingId((prev) =>
      prev && visibleBookings.some((booking) => booking.id === prev) ? prev : visibleBookings[0].id
    )
    setRequestCancelBookingId((prev) =>
      prev && visibleBookings.some((booking) => booking.id === prev) ? prev : visibleBookings[0].id
    )
  }, [visibleBookings])

  React.useEffect(() => {
    if (typeof document === "undefined") return
    const update = () => {
      document.body.dataset.profilePage = "true"
      document.body.dataset.profileMobile = window.innerWidth < 1024 ? "true" : "false"
    }
    update()
    window.addEventListener("resize", update)
    return () => {
      delete document.body.dataset.profilePage
      delete document.body.dataset.profileMobile
      window.removeEventListener("resize", update)
    }
  }, [])

  React.useEffect(() => {
    if (profileComplete) {
      setShowProfileForm(false)
    }
  }, [profileComplete])

  React.useEffect(() => {
    if (showProfileForm) {
      setProfileFormMounted(true)
      requestAnimationFrame(() => setProfileFormVisible(true))
      return
    }
    setProfileFormVisible(false)
    const id = window.setTimeout(() => setProfileFormMounted(false), 280)
    return () => window.clearTimeout(id)
  }, [showProfileForm])

  React.useEffect(() => {
    return () => {
      if (profileSavedTimeout.current) {
        window.clearTimeout(profileSavedTimeout.current)
      }
    }
  }, [])

  React.useEffect(() => {
    if (!requestSubmitSuccess) return
    const id = window.setTimeout(() => setRequestSubmitSuccess(null), 3500)
    return () => window.clearTimeout(id)
  }, [requestSubmitSuccess])

  React.useEffect(() => {
    if (!checkInSuccess) return
    const id = window.setTimeout(() => setCheckInSuccess(null), 4000)
    return () => window.clearTimeout(id)
  }, [checkInSuccess])

  React.useEffect(() => {
    if (requestModalType !== "SUSPEND") return
    if (requestSuspendPackageId) return
    if (!suspendablePackages.length) return
    setRequestSuspendPackageId(suspendablePackages[0].id)
  }, [requestModalType, requestSuspendPackageId, suspendablePackages])

  React.useEffect(() => {
    if (requestModalType !== "CANCEL") return
    if (!requestCancelBookingId && visibleBookings.length > 0) {
      setRequestCancelBookingId(visibleBookings[0].id)
      return
    }
    if (!requestCancelBooking) return
    const nextEffectiveDate = formatDateKeyInTimeZone(requestCancelBooking.startsAt, NY_TIMEZONE)
    if (!nextEffectiveDate) return
    if (nextEffectiveDate !== requestCancelEffectiveDate) {
      setRequestCancelEffectiveDate(nextEffectiveDate)
    }
  }, [requestCancelBooking, requestCancelBookingId, requestCancelEffectiveDate, requestModalType, visibleBookings])

  React.useEffect(() => {
    if (!changeModalOpen || !selectedBooking || !rescheduleDate) return
    void loadAvailability(selectedBooking.courseSlug, rescheduleDate, selectedBooking.id)
  }, [changeModalOpen, selectedBooking, rescheduleDate, loadAvailability])

  React.useEffect(() => {
    if (!rescheduleTime) return
    const validSelection = availability.some(
      (slot) =>
        slot.time === rescheduleTime &&
        !slot.isFull &&
        !slot.isPast &&
        !rescheduleBookedTimesForSelectedDate.has(slot.time) &&
        !isCurrentRescheduleSlot(rescheduleDate, slot.time)
    )
    if (!validSelection) {
      setRescheduleTime("")
    }
  }, [availability, isCurrentRescheduleSlot, rescheduleBookedTimesForSelectedDate, rescheduleDate, rescheduleTime])

  React.useEffect(() => {
    if (!rescheduleDate) return
    if (!isRescheduleDateBlocked(rescheduleDate)) return
    const blockReason = getRescheduleDateBlockReason(rescheduleDate)
    setRescheduleDate("")
    setRescheduleTime("")
    setAvailability([])
    setRescheduleError(blockReason || "That day no longer has available time slots.")
  }, [getRescheduleDateBlockReason, isRescheduleDateBlocked, rescheduleDate])

  React.useEffect(() => {
    if (!changeModalOpen || !rescheduleCourseSlug) return
    const scoped = bookings.filter((booking) => booking.courseSlug === rescheduleCourseSlug)
    if (!scoped.length) return
    if (!scoped.some((booking) => booking.id === selectedBookingId)) {
      const first = scoped[0]
      setSelectedBookingId(first.id)
      hydrateRescheduleFromBooking(first)
    }
  }, [
    bookings,
    changeModalOpen,
    hydrateRescheduleFromBooking,
    rescheduleCourseSlug,
    selectedBookingId,
  ])

  React.useEffect(() => {
    setAssignSlots([])
    setAssignDate("")
    setAssignTime("")
    setAssignAvailability([])
    setAssignError(null)
    setAssignSuccess(null)
  }, [assignPackageId])

  React.useEffect(() => {
    if (!assignDate || !selectedPackageForAssign?.courseSlug) {
      setAssignAvailability([])
      return
    }
    void loadAssignAvailability(selectedPackageForAssign.courseSlug, assignDate)
  }, [assignDate, selectedPackageForAssign?.courseSlug, loadAssignAvailability])

  React.useEffect(() => {
    if (!assignTime) return
    const validSelection = assignAvailability.some(
      (slot) => slot.time === assignTime && !slot.isFull && !slot.isPast && !assignBookedTimesForSelectedDate.has(slot.time)
    )
    if (!validSelection) {
      setAssignTime("")
    }
  }, [assignAvailability, assignBookedTimesForSelectedDate, assignTime])

  React.useEffect(() => {
    if (!assignDate) return
    if (assignUnavailableDates.includes(assignDate)) {
      const scheduleTimes = selectedPackageForAssign?.courseSlug
        ? getAvailableTimesForCourseDate(selectedPackageForAssign.courseSlug, assignDate, sourceCourses)
        : []
      const allTimesPast =
        scheduleTimes.length > 0 &&
        scheduleTimes.every((time) => isSlotInPastForTimeZone(assignDate, time, NY_TIMEZONE))
      setAssignDate("")
      setAssignTime("")
      setAssignAvailability([])
      setAssignError(allTimesPast ? "The time slots for that day have already passed." : "That date is already fully booked by you.")
    }
  }, [assignDate, assignUnavailableDates, selectedPackageForAssign?.courseSlug, sourceCourses])

  React.useEffect(() => {
    if (mobileAgendaOpenDay === null) return
    const hasEventsForDay = visibleBookings.some((booking) => {
      const startsAt = new Date(booking.startsAt)
      if (Number.isNaN(startsAt.getTime())) return false
      return (
        startsAt.getFullYear() === agendaYear &&
        startsAt.getMonth() === agendaMonth &&
        startsAt.getDate() === mobileAgendaOpenDay
      )
    })
    if (!hasEventsForDay) {
      setMobileAgendaOpenDay(null)
    }
  }, [agendaMonth, agendaYear, mobileAgendaOpenDay, visibleBookings])

  React.useEffect(() => {
    const footer = document.getElementById("site-footer")
    if (!footer) return
    const baseOffset = 24
    const updateOffset = () => {
      const rect = footer.getBoundingClientRect()
      const overlap = Math.max(0, window.innerHeight - rect.top)
      const next = overlap > 0 ? overlap + baseOffset : baseOffset
      document.documentElement.style.setProperty("--floating-offset", `${next}px`)
    }
    updateOffset()
    window.addEventListener("scroll", updateOffset, { passive: true })
    window.addEventListener("resize", updateOffset)
    return () => {
      document.documentElement.style.removeProperty("--floating-offset")
      window.removeEventListener("scroll", updateOffset)
      window.removeEventListener("resize", updateOffset)
    }
  }, [])


  const completionPercent = React.useMemo(
    () => getProfileCompletionPercent(profileForm),
    [profileForm]
  )

  const avatarSrc =
    profileUser.imageUrl ||
    user?.imageUrl ||
    user?.externalAccounts?.[0]?.imageUrl ||
    mockProfile.avatar

  const handleAvatarUpload = async (file: File) => {
    setAvatarError(null)
    setAvatarUploading(true)
    try {
      if (file.size > 5 * 1024 * 1024) {
        setAvatarError("La imagen supera los 5MB.")
        return
      }
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAvatarError(data?.error || "Could not update avatar.")
        return
      }
      setProfileUser((prev) => ({ ...prev, imageUrl: data?.imageUrl || prev.imageUrl }))
    } catch {
      setAvatarError("Could not update avatar.")
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleProfileSave = async () => {
    setProfileSaving(true)
    setProfileError(null)
    setProfileSaved(false)
    try {
      const billingLine1 = profileForm.billingLine1.trim()
      const billingLine2 = profileForm.billingLine2.trim()
      const billingCity = profileForm.billingCity.trim()
      const billingState = profileForm.billingState.trim()
      const billingPostalCode = profileForm.billingPostalCode.trim()
      const billingCountry = profileForm.billingCountry.trim()
      const hasBillingData = [billingLine1, billingLine2, billingCity, billingState, billingPostalCode, billingCountry].some(Boolean)

      if (hasBillingData && (!billingLine1 || !billingCity || !billingState || !billingPostalCode || !billingCountry)) {
        setProfileError("Complete the billing address (line 1, city, state, ZIP, and country).")
        return
      }

      const payload = {
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        birthDate: profileForm.birthDate,
        emergencyContactName: profileForm.emergencyContactName,
        emergencyContactRelation: profileForm.emergencyContactRelation,
        emergencyContactPhone: profileForm.emergencyContactPhone,
        billingAddress: hasBillingData
          ? {
              line1: billingLine1,
              line2: billingLine2 || null,
              city: billingCity,
              state: billingState,
              postalCode: billingPostalCode,
              country: billingCountry,
            }
          : null,
      }

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      let data: ProfileSaveResponse | null = null
      try {
        data = await res.json()
      } catch {
        data = null
      }
      if (!res.ok) {
        const fallback = res.status ? `Could not save profile (${res.status}).` : "Could not save profile."
        setProfileError(data?.error || fallback)
        return
      }
      setProfileComplete(Boolean(data?.profileComplete))
      setPointsBalance(typeof data?.pointsBalance === "number" ? data.pointsBalance : 0)
      if (data?.profile) {
        setProfileForm(buildProfileFormState(data.profile, user))
      }
      void loadPointsHistory()
      setProfileSaved(true)
      if (profileSavedTimeout.current) {
        window.clearTimeout(profileSavedTimeout.current)
      }
      profileSavedTimeout.current = window.setTimeout(() => setProfileSaved(false), 2500)
    } catch {
      setProfileError("Could not save profile.")
    } finally {
      setProfileSaving(false)
    }
  }

  const chartLabels = React.useMemo(() => {
    if (!monthlyAttendance.length) return analyticsMonths
    return monthlyAttendance.map((item) => item.label.split(" ")[0]).slice(0, 4)
  }, [monthlyAttendance])
  const attendanceSeriesValues = React.useMemo(() => {
    if (!monthlyAttendance.length) return analyticsMetricConfig.attendance.values
    return monthlyAttendance.map((item) => item.value).slice(0, 4)
  }, [monthlyAttendance])
  const activeSeriesValues = React.useMemo(() => {
    if (activeMetric === "attendance") return attendanceSeriesValues
    return analyticsMetricConfig[activeMetric].values
  }, [activeMetric, attendanceSeriesValues])
  const series = {
    ...analyticsMetricConfig[activeMetric],
    values: activeSeriesValues.length > 1 ? activeSeriesValues : [...activeSeriesValues, ...analyticsMetricConfig[activeMetric].values].slice(0, 4),
  }
  const maxValue = Math.max(...series.values, 6)
  const chartWidth = 520
  const chartHeight = 170
  const paddingX = 20
  const paddingY = 10
  const gridCount = 5
  const stepX = (chartWidth - paddingX * 2) / (series.values.length - 1)
  const toPoint = (value: number, index: number) => {
    const x = paddingX + index * stepX
    const y = chartHeight - paddingY - (value / maxValue) * (chartHeight - paddingY * 2)
    return { x, y }
  }
  const points = series.values.map((value, index) => ({
    value,
    label: chartLabels[index] || analyticsMonths[index],
    ...toPoint(value, index),
    idx: index,
  }))
  const pathD = points
    .map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ")
  const targetValues = series.values.map((value, idx) => {
    const prev = series.values[idx - 1] ?? value
    const next = series.values[idx + 1] ?? value
    return Math.max(1, Math.round((value + prev + next) / 3))
  })
  const targetPoints = targetValues.map((value, index) => ({
    value,
    label: chartLabels[index] || analyticsMonths[index],
    ...toPoint(value, index),
  }))
  const targetPathD = targetPoints.map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")
  const yTicks = Array.from({ length: gridCount }).map((_, idx) => {
    const ratio = idx / (gridCount - 1)
    const y = paddingY + ratio * (chartHeight - paddingY * 2)
    const value = Math.round(maxValue - ratio * maxValue)
    return { y, value }
  })

  const pieSegments = [
    { label: "Attendance", value: 42, color: "var(--brand,#b61616)" },
    { label: "Progress", value: 34, color: "#ef6b6b" },
    { label: "Rhythm", value: 24, color: "#f59e0b" },
  ]
  const pieStops = pieSegments.reduce<{ value: number; color: string }[]>((acc, segment) => {
    const total = acc.reduce((sum, s) => sum + s.value, 0)
    acc.push({ value: total + segment.value, color: segment.color })
    return acc
  }, [])
  const pieGradient = pieStops
    .map((stop, idx) => {
      const start = idx === 0 ? 0 : pieStops[idx - 1].value
      return `${stop.color} ${start}% ${stop.value}%`
    })
    .join(", ")

  const medalItems = [
    { label: "5 classes", icon: Trophy },
    { label: "10 classes", icon: Medal },
    { label: "1 active month", icon: Flame },
    { label: "Consistencia", icon: Star },
  ]

  const buildCalendar = (year: number, monthIndex: number) => {
    const firstDay = new Date(year, monthIndex, 1)
    const lastDay = new Date(year, monthIndex + 1, 0)
    const startWeekday = firstDay.getDay()
    const totalDays = lastDay.getDate()
    const days: Array<{ day: number; isCurrent: boolean }> = []
    for (let i = 0; i < startWeekday; i += 1) {
      days.push({ day: 0, isCurrent: false })
    }
    for (let day = 1; day <= totalDays; day += 1) {
      days.push({ day, isCurrent: true })
    }
    while (days.length % 7 !== 0) {
      days.push({ day: 0, isCurrent: false })
    }
    return days
  }
  const calendarDays = React.useMemo(() => buildCalendar(agendaYear, agendaMonth), [agendaYear, agendaMonth])
  const agendaMonthLabel = React.useMemo(() => {
    const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(agendaYear, agendaMonth, 1))
    return monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
  }, [agendaMonth, agendaYear])
  const agendaYears = React.useMemo(() => {
    const current = new Date().getFullYear()
    return Array.from({ length: 7 }, (_, index) => current - 1 + index)
  }, [])
  const bookingEventsByDay = React.useMemo(() => {
    const grouped = new Map<number, Array<{ id: string; time: string; courseTitle: string }>>()
    for (const booking of visibleBookings) {
      const startsAt = new Date(booking.startsAt)
      if (Number.isNaN(startsAt.getTime())) continue
      if (startsAt.getFullYear() !== agendaYear || startsAt.getMonth() !== agendaMonth) continue
      const day = startsAt.getDate()
      const list = grouped.get(day) || []
      list.push({
        id: booking.id,
        time: formatDateTimeInTimeZone(startsAt, { hour: "numeric", minute: "2-digit" }),
        courseTitle: booking.courseTitle,
      })
      grouped.set(day, list)
    }
    return grouped
  }, [agendaMonth, agendaYear, visibleBookings])
  const pendingBookingEventsByDay = React.useMemo(() => {
    const grouped = new Map<
      number,
      Array<{ id: string; time: string; courseTitle: string; processLabel: string; processType: ActionRequestType | null }>
    >()
    for (const booking of pendingBookings) {
      const startsAt = new Date(booking.startsAt)
      if (Number.isNaN(startsAt.getTime())) continue
      if (startsAt.getFullYear() !== agendaYear || startsAt.getMonth() !== agendaMonth) continue
      const request = classRequestsByAttendance.get(booking.id)
      const day = startsAt.getDate()
      const list = grouped.get(day) || []
      list.push({
        id: booking.id,
        time: formatDateTimeInTimeZone(startsAt, { hour: "numeric", minute: "2-digit" }),
        courseTitle: booking.courseTitle,
        processLabel: getPendingProcessLabel(request),
        processType: request?.type || null,
      })
      grouped.set(day, list)
    }
    return grouped
  }, [agendaMonth, agendaYear, classRequestsByAttendance, pendingBookings])
  const nextBookedClass = React.useMemo(() => {
    if (!visibleBookings.length) {
      return {
        scheduleLabel: activityStats.lastClassLabel || mockProfile.schedule.nextClass,
        courseTitle: "",
      }
    }
    const next = visibleBookings.find((booking) => new Date(booking.startsAt).getTime() >= Date.now()) || visibleBookings[0]
    const startsAt = new Date(next.startsAt)
    if (Number.isNaN(startsAt.getTime())) {
      return {
        scheduleLabel: activityStats.lastClassLabel || mockProfile.schedule.nextClass,
        courseTitle: next.courseTitle || "",
      }
    }
    return {
      scheduleLabel: formatDateTimeInTimeZone(startsAt, {
        weekday: "long",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      }),
      courseTitle: next.courseTitle || "",
    }
  }, [activityStats.lastClassLabel, visibleBookings])
  const latestPointEntries = pointsEntries.slice(0, 6)
  const latestActionRequests = actionRequests.slice(0, 5)
  const rescheduleStepItems = [
    { id: 1 as const, label: "Reassignment" },
    { id: 2 as const, label: "Confirmation" },
    { id: 3 as const, label: "Assign pending" },
  ]

  return (
    <main className="min-h-[70vh] bg-background">
      <div className="w-full px-[10px] lg:px-[15px] py-8">
        <div ref={gridRef} className="relative grid grid-cols-1 gap-6 lg:items-start lg:grid-cols-[minmax(250px,290px)_minmax(0,1fr)_15rem]">
          {/* Left */}
          <aside className="lg:self-start">
            <div ref={leftRailRef} className="profile-left-rail space-y-4">
            <GlassyCard className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative h-full w-full overflow-hidden"
                    aria-label="Change avatar"
                    title="Change avatar"
                    disabled={avatarUploading}
                    data-testid="avatar-upload-trigger"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarSrc} alt={profileUser.name || mockProfile.name} className="h-full w-full object-cover" />
                    <span
                      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                      data-testid="avatar-edit-overlay"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-semibold tracking-[0.08em] uppercase">Edit photo</span>
                    </span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleAvatarUpload(file)
                      e.currentTarget.value = ""
                    }}
                  />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Student</p>
                  <h2 className="text-lg font-semibold">{profileUser.name || mockProfile.name}</h2>
                  <p className="text-xs text-zinc-600 dark:text-white/60">{mockProfile.level}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-white/10 px-3 py-2">
                  <p className="text-[color:var(--brand)]">Status</p>
                  <p className="font-semibold">{statusLabel[profileUser.status]}</p>
                </div>
                <div className="rounded-md border border-white/10 px-3 py-2">
                  <p className="text-[color:var(--brand)]">Phone</p>
                  <p className="font-semibold">{profileUser.phoneVerified ? "Verified" : "Unverified"}</p>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-white/70">
                <p>{profileUser.email || mockProfile.email}</p>
                <p>{profileUser.phone || mockProfile.phone}</p>
              </div>
              {avatarError && <p className="mt-2 text-xs text-red-400">{avatarError}</p>}
              {avatarUploading && <p className="mt-2 text-xs text-zinc-600 dark:text-white/60">Updating avatar...</p>}

              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Activity</p>
                <p className="mt-2">Classes taken: <strong>{activityStats.classesTaken}</strong></p>
                <p>Streak: <strong>{activityStats.streakWeeks} weeks</strong></p>
                <p>Last class: <strong>{activityStats.lastClassLabel || "—"}</strong></p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowProfileForm(true)}
                  className="rounded-md border border-black/10 bg-black/[0.03] px-3 py-2 text-xs font-semibold text-zinc-800 hover:border-black/20 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:border-white/30"
                >
                  Edit profile
                </button>
                {(() => {
                  const ringColor =
                    completionPercent >= 80 ? "rgba(34,197,94,1)" : completionPercent >= 50 ? "rgba(245,158,11,1)" : "rgba(182,22,22,1)"
                  return (
                    <div
                      className="relative h-10 w-10 rounded-full p-[2px]"
                      style={{ background: `conic-gradient(${ringColor} ${completionPercent}%, rgba(255,255,255,0.12) 0)` }}
                    >
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-black/70 text-[11px] font-semibold text-white">
                    {completionPercent}%
                  </div>
                    </div>
                  )
                })()}
                {!profileComplete && (
                  <span className="text-[11px] text-[var(--brand,#b61616)]">Complete your profile and earn points</span>
                )}
              </div>

              <div className="mt-5 border-t border-white/10 pt-6">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Packages and promos</p>
                <div className="mt-3 space-y-3 text-sm">
                  {packagesData.length > 0 ? (
                    packagesData.map((pkg) => (
                      <div key={pkg.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <p className="font-semibold">{pkg.label}</p>
                        <p className="text-xs text-zinc-600 dark:text-white/60">
                          {pkg.isUnlimited ? "Unlimited" : `Remaining: ${pkg.remainingCredits ?? 0}`}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-white/40">
                          {pkg.expiresAt
                            ? `Expires: ${formatDateTimeInTimeZone(pkg.expiresAt, {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                              })}`
                            : "No expiration"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-600 dark:text-white/60">
                      You do not have active packages.
                    </div>
                  )}
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="font-semibold">Summary</p>
                    <p className="text-xs text-zinc-600 dark:text-white/60">
                      Active: {packagesSummary.activePackages} · Credits: {packagesSummary.totalRemainingCredits}
                      {packagesSummary.unlimitedPackages > 0 ? ` · Unlimiteds: ${packagesSummary.unlimitedPackages}` : ""}
                    </p>
                  </div>
                </div>
              </div>
            </GlassyCard>
            </div>
          </aside>

          {/* Center */}
          <section className="flex flex-col gap-6">
            {profileFormMounted && (
            <div
              className={`order-1 transition-all duration-300 ease-out overflow-hidden ${
                profileFormVisible ? "max-h-[1600px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-2"
              }`}
            >
            <GlassyCard className="p-5 relative">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Profile</p>
                  <h3 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-white">Complete your profile and earn points</h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-white/60">
                    By completing your profile, you earn points to redeem benefits.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-full border border-[var(--brand,#b61616)]/60 bg-[rgba(182,22,22,0.15)] px-4 py-2 text-sm font-semibold text-[var(--brand,#b61616)] shadow-[0_0_20px_rgba(182,22,22,0.25)]">
                    PLI Coins: <span className="text-zinc-900 dark:text-white">{pointsBalance}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProfileForm(false)}
                    className="rounded-full border border-black/10 bg-black/[0.05] p-2 text-zinc-700 hover:text-zinc-900 dark:border-white/10 dark:bg-black/40 dark:text-white/70 dark:hover:text-white"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <fieldset className="space-y-2">
                  <label className="text-sm font-medium">First name</label>
                  <input
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm((s) => ({ ...s, firstName: e.target.value }))}
                    className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-white/15 dark:text-white/90 dark:placeholder:text-white/40"
                    placeholder="Your first name"
                  />
                </fieldset>
                <fieldset className="space-y-2">
                  <label className="text-sm font-medium">Last name</label>
                  <input
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm((s) => ({ ...s, lastName: e.target.value }))}
                    className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-white/15 dark:text-white/90 dark:placeholder:text-white/40"
                    placeholder="Your last name"
                  />
                </fieldset>
                <fieldset className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Email</label>
                  <input
                    value={user?.primaryEmailAddress?.emailAddress || ""}
                    readOnly
                    className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-600 dark:border-white/15 dark:text-white/60"
                  />
                </fieldset>
                <fieldset className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <input
                    value={user?.primaryPhoneNumber?.phoneNumber || ""}
                    readOnly
                    className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-600 dark:border-white/15 dark:text-white/60"
                  />
                </fieldset>
                <fieldset className="space-y-2">
                  <label className="text-sm font-medium">Birthday</label>
                  <input
                    type="date"
                    value={profileForm.birthDate}
                    onChange={(e) => setProfileForm((s) => ({ ...s, birthDate: e.target.value }))}
                    className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                  />
                </fieldset>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Emergency contact</p>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <fieldset className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <input
                      value={profileForm.emergencyContactName}
                      onChange={(e) => setProfileForm((s) => ({ ...s, emergencyContactName: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                      placeholder="Full name"
                    />
                  </fieldset>
                  <fieldset className="space-y-2">
                    <label className="text-sm font-medium">Relationship</label>
                    <input
                      value={profileForm.emergencyContactRelation}
                      onChange={(e) => setProfileForm((s) => ({ ...s, emergencyContactRelation: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                      placeholder="Ex: Mother, Father, Friend"
                    />
                  </fieldset>
                  <fieldset className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium">Phone</label>
                    <input
                      value={profileForm.emergencyContactPhone}
                      onChange={(e) => setProfileForm((s) => ({ ...s, emergencyContactPhone: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                      placeholder="Number"
                    />
                  </fieldset>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Billing address</p>
                <p className="mt-2 text-xs text-zinc-600 dark:text-white/60">
                  Used only for card payments (Stripe). You can edit it anytime.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <fieldset className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium">Line 1</label>
                    <input
                      value={profileForm.billingLine1}
                      onChange={(e) => setProfileForm((s) => ({ ...s, billingLine1: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                      placeholder="Street and number"
                    />
                  </fieldset>
                  <fieldset className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium">Line 2 (optional)</label>
                    <input
                      value={profileForm.billingLine2}
                      onChange={(e) => setProfileForm((s) => ({ ...s, billingLine2: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                      placeholder="Apt, floor, unit"
                    />
                  </fieldset>
                  <fieldset className="space-y-2">
                    <label className="text-sm font-medium">City</label>
                    <input
                      value={profileForm.billingCity}
                      onChange={(e) => setProfileForm((s) => ({ ...s, billingCity: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                      placeholder="City"
                    />
                  </fieldset>
                  <fieldset className="space-y-2">
                    <label className="text-sm font-medium">State</label>
                    <input
                      value={profileForm.billingState}
                      onChange={(e) => setProfileForm((s) => ({ ...s, billingState: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                      placeholder="State"
                    />
                  </fieldset>
                  <fieldset className="space-y-2">
                    <label className="text-sm font-medium">ZIP / Postal code</label>
                    <input
                      value={profileForm.billingPostalCode}
                      onChange={(e) => setProfileForm((s) => ({ ...s, billingPostalCode: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                      placeholder="ZIP"
                    />
                  </fieldset>
                  <fieldset className="space-y-2">
                    <label className="text-sm font-medium">Country</label>
                    <input
                      value={profileForm.billingCountry}
                      onChange={(e) => setProfileForm((s) => ({ ...s, billingCountry: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                      placeholder="Country"
                    />
                  </fieldset>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-zinc-600 dark:text-white/60">
                  {profileComplete ? "Profile complete. Keep earning points!" : "Complete your profile to earn 10 points."}
                </div>
                <button
                  type="button"
                  onClick={handleProfileSave}
                  disabled={profileSaving || profileLoading}
                  className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {profileSaving ? "Saving..." : "Save profile"}
                </button>
              </div>
              {profileError && <p className="mt-2 text-sm text-red-400">{profileError}</p>}
              {profileSaved && !profileError && (
                <p className="mt-2 text-sm text-emerald-300">Profile saved.</p>
              )}
            </GlassyCard>
            </div>
            )}

            {(pinStatus.enabled || pinLoading || pinStatusError) && (
              <GlassyCard className="order-[1.5] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Student PIN</p>
                    <h3 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-white">
                      {pinStatus.needsEnrollment ? "Set your kiosk PIN" : "Manage your kiosk PIN"}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-white/60">
                      Use a personal 4-digit PIN for kiosk identification and recovery.
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-700 dark:text-white/70">
                    {pinStatus.locked ? "Locked" : pinStatus.needsEnrollment ? "Not enrolled" : "Active"}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--brand,#b61616)]">Status</p>
                    <p className="mt-2 font-semibold">{pinStatus.needsEnrollment ? "Enrollment required" : pinStatus.locked ? "Locked after failed attempts" : "Ready for kiosk use"}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--brand,#b61616)]">Attempts</p>
                    <p className="mt-2 font-semibold">{pinStatus.permanent.failedAttempts} / 5 failed attempts</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--brand,#b61616)]">Recovery</p>
                    <p className="mt-2 font-semibold">{pinStatus.provisional.active ? "Staff provisional PIN active" : "Account recovery available"}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {!pinRecoveryMode && pinStatus.enrolled && (
                    <fieldset className="space-y-2">
                      <label className="text-sm font-medium">Current PIN</label>
                      <input
                        inputMode="numeric"
                        maxLength={4}
                        type="password"
                        value={pinCurrentValue}
                        onChange={(e) => setPinCurrentValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                        placeholder="Current PIN"
                      />
                    </fieldset>
                  )}
                  <fieldset className="space-y-2">
                    <label className="text-sm font-medium">New PIN</label>
                    <input
                      inputMode="numeric"
                      maxLength={4}
                      type="password"
                      value={pinNextValue}
                      onChange={(e) => setPinNextValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                      placeholder="4 digits"
                    />
                  </fieldset>
                  <fieldset className="space-y-2">
                    <label className="text-sm font-medium">Confirm PIN</label>
                    <input
                      inputMode="numeric"
                      maxLength={4}
                      type="password"
                      value={pinConfirmValue}
                      onChange={(e) => setPinConfirmValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:border-white/15 dark:text-white/90"
                      placeholder="Repeat PIN"
                    />
                  </fieldset>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {pinStatus.enrolled && (
                    <button
                      type="button"
                      onClick={() => {
                        setPinRecoveryMode((prev) => !prev)
                        setPinFormError(null)
                        setPinFormSuccess(null)
                        setPinCurrentValue("")
                      }}
                      className="rounded-md border border-black/10 bg-black/[0.03] px-3 py-2 text-xs font-semibold text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                    >
                      {pinRecoveryMode ? "Use current PIN instead" : "Forgot your PIN? Recover from account"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void submitStudentPin()}
                    disabled={pinSaving || pinLoading}
                    className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {pinSaving ? "Saving..." : pinStatus.needsEnrollment ? "Enroll PIN" : pinRecoveryMode ? "Recover PIN" : "Update PIN"}
                  </button>
                </div>

                {pinStatusError && <p className="mt-3 text-sm text-red-400">{pinStatusError}</p>}
                {pinFormError && <p className="mt-3 text-sm text-red-400">{pinFormError}</p>}
                {pinFormSuccess && !pinFormError && <p className="mt-3 text-sm text-emerald-300">{pinFormSuccess}</p>}
              </GlassyCard>
            )}

            <GlassyCard className="order-2 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Student moments</p>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {mockProfile.moments.map((src, idx) => (
                  <div key={`moment-${idx}`} className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="moment" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </GlassyCard>

            <GlassyCard className="order-8 p-4">
              <div className="relative overflow-visible rounded-3xl border border-white/10 bg-gradient-to-br from-[#120b14] via-[#0f0b12] to-[#0b0b0f] p-5 shadow-[0_30px_120px_-60px_rgba(182,22,22,0.8)]">
                <div className="pointer-events-none absolute -left-24 -top-20 h-40 w-40 rounded-full bg-[radial-gradient(circle_at_center,rgba(182,22,22,0.45),transparent_70%)] blur-3xl" />
                <div className="pointer-events-none absolute right-10 top-6 h-24 w-24 rounded-full bg-[radial-gradient(circle_at_center,rgba(239,107,107,0.4),transparent_70%)] blur-3xl" />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Analytics</p>
                    <p className="mt-2 text-sm text-white/70">Overall student progress.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">Filters</span>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">This month</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(["attendance", "progress", "rhythm"] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveMetric(key)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        activeMetric === key
                          ? "border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.22)] text-white shadow-[0_12px_30px_-16px_rgba(182,22,22,0.8)]"
                          : "border-white/10 text-white/70 hover:border-white/30"
                      }`}
                    >
                      {analyticsMetricConfig[key].label}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-1 lg:grid-cols-[0.65fr_2.75fr_0.85fr] gap-4 items-stretch">
                  <div className="space-y-3 h-full flex flex-col">
                    <div className="relative min-h-[148px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-[#0b0b0f]/80 px-5 py-4 flex-1 flex flex-col justify-between text-center">
                      <div className="pointer-events-none absolute -left-10 -top-10 h-24 w-24 rounded-full bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.35),transparent_70%)] blur-2xl" />
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Total classes</p>
                      <p className="mt-2 text-[52px] font-semibold leading-none tracking-tight text-white">{activityStats.classesTaken}</p>
                      <p className="mt-2 text-[11px] text-white/50">+12% vs previous month</p>
                    </div>
                    <div className="min-h-[148px] rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-[#0b0b0f]/80 px-5 py-4 flex-1 flex flex-col justify-between text-center">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Weekly average</p>
                      <p className="mt-2 text-[52px] font-semibold leading-none tracking-tight text-white">{activityStats.weeklyAverage}</p>
                      <p className="mt-2 text-[11px] text-white/50">Streak: {activityStats.streakWeeks} weeks</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 h-full flex flex-col">
                    <div className="flex items-center justify-between text-[11px] text-white/60">
                      <span>{analyticsMetricConfig[activeMetric].label}</span>
                      <span>Last 4 months</span>
                    </div>
                    <div className="mt-2 flex flex-col overflow-visible">
                      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#141017] via-[#0d0b12] to-[#09090d] px-3 pb-2 pt-3 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)]">
                        <div className="pointer-events-none absolute right-4 top-3 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] text-white/70">
                          Estimated progress
                        </div>
                        <div className="grid grid-cols-[40px_1fr] gap-2">
                          <div className="relative h-[185px] text-[10px] text-white/40">
                            {yTicks.map((tick) => (
                              <span
                                key={`y-label-${tick.value}`}
                                className="absolute right-1"
                                style={{ top: `${(tick.y / chartHeight) * 100}%`, transform: "translateY(-50%)" }}
                              >
                                {tick.value}
                              </span>
                            ))}
                          </div>
                          <div className="relative h-[185px]">
                            <svg
                              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                              preserveAspectRatio="xMidYMid meet"
                              className="h-full w-full"
                            >
                              <defs>
                                <linearGradient id="lineGlow" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="rgba(182,22,22,0.25)" />
                                  <stop offset="50%" stopColor="rgba(182,22,22,0.95)" />
                                  <stop offset="100%" stopColor="rgba(182,22,22,0.4)" />
                                </linearGradient>
                                <linearGradient id="areaGlow" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="rgba(182,22,22,0.5)" />
                                  <stop offset="55%" stopColor="rgba(182,22,22,0.2)" />
                                  <stop offset="100%" stopColor="rgba(11,11,15,0)" />
                                </linearGradient>
                                <linearGradient id="targetGlow" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="rgba(245,158,11,0.4)" />
                                  <stop offset="100%" stopColor="rgba(245,158,11,0.95)" />
                                </linearGradient>
                              </defs>
                              {yTicks.map((tick) => (
                                <line
                                  key={`grid-${tick.value}`}
                                  x1={paddingX}
                                  x2={chartWidth - paddingX}
                                  y1={tick.y}
                                  y2={tick.y}
                                  stroke="rgba(255,255,255,0.08)"
                                  strokeDasharray="4 6"
                                />
                              ))}
                              <path
                                d={`${pathD} L ${chartWidth - paddingX} ${chartHeight - paddingY} L ${paddingX} ${chartHeight - paddingY} Z`}
                                fill="url(#areaGlow)"
                              />
                              <path
                                d={pathD}
                                fill="none"
                                stroke="url(#lineGlow)"
                                strokeWidth="3"
                                strokeLinecap="round"
                                style={{ filter: "drop-shadow(0 0 8px rgba(182,22,22,0.6))" }}
                              />
                              <path
                                d={targetPathD}
                                fill="none"
                                stroke="url(#targetGlow)"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                              {targetPoints.map((point, idx) => (
                                <circle
                                  key={`target-${point.label}`}
                                  cx={point.x}
                                  cy={point.y}
                                  r={hoverPoint?.idx === idx ? 4.5 : 3}
                                  fill="rgba(245,158,11,0.95)"
                                  stroke="rgba(255,255,255,0.6)"
                                  strokeWidth="1"
                                />
                              ))}
                              {hoverPoint && (
                                <line
                                  x1={hoverPoint.x}
                                  x2={hoverPoint.x}
                                  y1={paddingY}
                                  y2={chartHeight - paddingY}
                                  stroke="rgba(255,255,255,0.35)"
                                  strokeDasharray="4 6"
                                />
                              )}
                              {points.map((point, idx) => {
                                const isActive = hoverPoint?.idx === idx
                                return (
                                  <g
                                    key={`${point.label}-${point.value}`}
                                    onMouseEnter={() =>
                                      setHoverPoint({ label: point.label, value: point.value, x: point.x, y: point.y, idx: point.idx })
                                    }
                                    onMouseLeave={() => setHoverPoint(null)}
                                  >
                                    <circle cx={point.x} cy={point.y} r={isActive ? 18 : 12} fill="rgba(182,22,22,0.2)" />
                                    <circle
                                      cx={point.x}
                                      cy={point.y}
                                      r={isActive ? 7 : 6}
                                      fill="#fff"
                                      stroke="rgba(182,22,22,0.85)"
                                      strokeWidth="2"
                                    />
                                  </g>
                                )
                              })}
                            </svg>
                            {hoverPoint && (
                              <div
                                className="pointer-events-none absolute z-10 min-w-[170px] rounded-2xl border border-white/10 bg-[#151018] px-4 py-3 text-[11px] text-white/80 shadow-[0_25px_55px_-30px_rgba(0,0,0,0.85)] backdrop-blur-md"
                                style={{
                                  left: `clamp(12%, ${(hoverPoint.x / chartWidth) * 100}%, 88%)`,
                                  top: `clamp(18%, ${(hoverPoint.y / chartHeight) * 100}%, 78%)`,
                                  transform: "translate(-50%, -40%)",
                                }}
                              >
                                <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                                  {hoverPoint.label} 2026
                                </p>
                                <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <p className="text-white/50">{analyticsMetricConfig[activeMetric].label}</p>
                                    <p className="text-sm font-semibold text-white">{hoverPoint.value}</p>
                                  </div>
                                  <div>
                                    <p className="text-white/50">Goal</p>
                                    <p className="text-sm font-semibold text-white">{targetValues[hoverPoint.idx]}</p>
                                  </div>
                                </div>
                                <div className="mt-3 flex items-center gap-3 text-[10px] text-white/50">
                                  <span className="inline-flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-[var(--brand,#b61616)]" />
                                    Current
                                  </span>
                                  <span className="inline-flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                                    Target
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-1 relative h-3 text-[11px] text-white/50 overflow-visible ml-[40px]">
                        {points.map((point) => (
                          <span
                            key={`label-${point.label}`}
                            className="absolute"
                            style={{
                              left: `${(point.x / chartWidth) * 100}%`,
                              transform: "translateX(-50%)",
                            }}
                          >
                            {point.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 h-full flex flex-col">
                    <div className="relative min-h-[148px] overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-4 flex-1 flex flex-col">
                      <div className="pointer-events-none absolute -right-10 -bottom-10 h-24 w-24 rounded-full bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.4),transparent_70%)] blur-2xl" />
                      <div className="flex items-center gap-2 text-[11px] text-white/60">
                        <span className="h-2 w-2 rounded-full bg-[var(--brand,#b61616)]" />
                        Distribution
                      </div>
                      <div className="mt-3 flex flex-1 flex-col">
                        <div className="flex flex-1 items-center justify-center">
                          <div className="relative h-32 w-32">
                          <div
                            className="absolute inset-0 rounded-full"
                            style={{ background: `conic-gradient(${pieGradient})` }}
                          />
                          <div className="absolute inset-[10px] rounded-full bg-[#0b0b0f] border border-white/10 flex items-center justify-center">
                            <div className="text-center">
                              <p className="text-[10px] text-white/60">Total</p>
                              <p className="text-lg font-semibold text-white">100%</p>
                            </div>
                          </div>
                          <div className="absolute -bottom-4 left-1/2 h-6 w-16 -translate-x-1/2 rounded-full bg-[var(--brand,#b61616)]/30 blur-xl" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="space-y-2 text-[11px] text-white/70">
                        {pieSegments.map((seg) => (
                          <div key={seg.label} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ background: seg.color }} />
                              <span>{seg.label}</span>
                            </div>
                            <span className="text-white/50">{seg.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </GlassyCard>

            <GlassyCard className="order-5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">PLI Coins</p>
                  <p className="mt-2 text-sm text-zinc-700 dark:text-white/70">
                    You are <strong>{pointsToNextFreeClass}</strong> points away from a free class.
                  </p>
                </div>
                <div className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                  Goal: {freeClassThreshold} PLI Coins
                </div>
              </div>
              <div className="relative mt-4 h-28 overflow-hidden rounded-2xl border border-white/10">
                <div className="absolute inset-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/carousel/_DSC1087.JPG"
                    alt="Free class"
                    className="h-full w-full object-cover grayscale"
                  />
                </div>
                <div className="absolute inset-0 overflow-hidden" style={{ width: `${progress}%` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/carousel/_DSC1087.JPG"
                    alt="Free class progress"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-3 left-3 text-sm font-semibold text-white">
                  {currentCoins} / {freeClassThreshold} PLI Coins
                </div>
              </div>
              <p className="mt-3 text-xs text-zinc-600 dark:text-white/60">
                Available free classes: <strong>{freeClassesAvailable}</strong>
              </p>
            </GlassyCard>

            <GlassyCard className="order-6 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Points history</p>
                  <p className="mt-2 text-sm text-zinc-700 dark:text-white/70">Recent balance movements.</p>
                </div>
                <div className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs font-semibold text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-white/80">
                  Balance: {pointsBalance}
                </div>
              </div>
              {pointsError && <p className="mt-3 text-xs text-red-400">{pointsError}</p>}
              {pointsLoading ? (
                <div className="mt-4 space-y-2">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={`points-skeleton-${idx}`} className="h-10 animate-pulse rounded-lg border border-white/10 bg-white/5" />
                  ))}
                </div>
              ) : latestPointEntries.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {latestPointEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-semibold text-zinc-800 dark:text-white/90">{pointsTypeLabel(entry.type)}</p>
                        <p className="text-xs text-zinc-600 dark:text-white/55">
                          {formatDateTimeInTimeZone(entry.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          entry.points >= 0
                            ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                            : "border border-red-500/30 bg-red-500/10 text-red-400"
                        }`}
                      >
                        {entry.points >= 0 ? `+${entry.points}` : entry.points}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-xs text-zinc-600 dark:text-white/60">You do not have any point activity yet.</p>
              )}
            </GlassyCard>

            <GlassyCard className="order-7 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Medals</p>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {medalItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="flex flex-col items-center gap-2 text-center">
                      <div className="relative">
                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[var(--brand,#b61616)] to-[#f97316] p-[2px] shadow-[0_12px_40px_-20px_rgba(182,22,22,0.85)]">
                          <div className="flex h-full w-full items-center justify-center rounded-full bg-black/70">
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                        </div>
                        <div className="absolute -bottom-2 left-1/2 h-4 w-10 -translate-x-1/2 rounded-full bg-[var(--brand,#b61616)]/40 blur-sm" />
                      </div>
                      <p className="text-xs text-zinc-700 dark:text-white/80">{item.label}</p>
                    </div>
                  )
                })}
              </div>
            </GlassyCard>

            <GlassyCard className="order-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Agenda</p>
                  <p className="mt-2 text-sm text-zinc-700 dark:text-white/70">
                    Your scheduled classes and real-time slots.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextMonth = agendaMonth - 1
                      if (nextMonth < 0) {
                        setAgendaMonth(11)
                        setAgendaYear((prev) => prev - 1)
                        return
                      }
                      setAgendaMonth(nextMonth)
                    }}
                    className="rounded-full border border-black/10 px-2 py-1 text-xs text-zinc-600 dark:border-white/10 dark:text-white/60"
                    aria-label="Previous month"
                  >
                    ‹
                  </button>
                  <select
                    value={agendaYear}
                    onChange={(event) => setAgendaYear(Number(event.target.value))}
                    className="rounded-full border border-black/10 bg-transparent px-2 py-1 text-xs text-zinc-600 dark:border-white/10 dark:text-white/60"
                  >
                    {agendaYears.map((year) => (
                      <option key={`agenda-year-${year}`} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const nextMonth = agendaMonth + 1
                      if (nextMonth > 11) {
                        setAgendaMonth(0)
                        setAgendaYear((prev) => prev + 1)
                        return
                      }
                      setAgendaMonth(nextMonth)
                    }}
                    className="rounded-full border border-black/10 px-2 py-1 text-xs text-zinc-600 dark:border-white/10 dark:text-white/60"
                    aria-label="Next month"
                  >
                    ›
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>{agendaMonthLabel} {agendaYear}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date()
                      setAgendaMonth(now.getMonth())
                      setAgendaYear(now.getFullYear())
                    }}
                    className="rounded-full border border-black/10 px-3 py-1 text-xs text-zinc-600 dark:border-white/10 dark:text-white/60"
                  >
                    Today
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-7 text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-white/40">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="py-2 text-center">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px rounded-lg border border-black/10 bg-black/[0.03] text-sm dark:border-white/10 dark:bg-white/5">
                  {calendarDays.map((day, idx) => {
                    const dayEvents = day.day > 0 ? bookingEventsByDay.get(day.day) || [] : []
                    const pendingDayEvents = day.day > 0 ? pendingBookingEventsByDay.get(day.day) || [] : []
                    const pendingTypes = Array.from(
                      new Set(
                        pendingDayEvents
                          .map((entry) => entry.processType)
                          .filter((type): type is ActionRequestType => Boolean(type))
                      )
                    )
                    const pendingTone = pendingTypes.length === 1 ? getProcessTypeTone(pendingTypes[0]) : getProcessTypeTone(null)
                    const pendingProcessLabels = Array.from(new Set(pendingDayEvents.map((entry) => entry.processLabel)))
                    const pendingBadgeText =
                      pendingProcessLabels.length === 1
                        ? pendingProcessLabels[0]
                        : `${pendingDayEvents.length} processes in progress`
                    const mobileOpen = mobileAgendaOpenDay === day.day && dayEvents.length > 0
                    return (
                      <div
                        key={`cal-${idx}`}
                        className={`relative min-h-[72px] border border-black/5 px-2 py-2 text-right text-xs dark:border-white/5 ${
                          day.isCurrent ? "text-zinc-700 dark:text-white/80" : "text-zinc-300 dark:text-white/20"
                        }`}
                      >
                        {day.day > 0 && (
                          <>
                            <div>{day.day}</div>
                            {dayEvents.slice(0, 2).map((entry) => (
                              <div
                                key={`calendar-entry-${entry.id}`}
                                className="group relative mt-2 hidden items-center gap-1 rounded-full bg-[var(--brand,#b61616)]/70 px-2 py-1 text-[10px] text-left text-white sm:inline-flex"
                              >
                                Class {entry.time}
                                <div className="pointer-events-none absolute left-1/2 top-0 z-30 w-44 -translate-x-1/2 -translate-y-[108%] rounded-xl border border-white/10 bg-[#16111a]/95 px-3 py-2 text-left text-[11px] opacity-0 shadow-[0_20px_55px_-30px_rgba(0,0,0,0.8)] transition group-hover:opacity-100">
                                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--brand,#b61616)]">Class</p>
                                  <p className="mt-1 text-white">{entry.courseTitle}</p>
                                  <p className="mt-1 text-white/70">{entry.time}</p>
                                </div>
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="mt-1 hidden text-[10px] text-[var(--brand,#b61616)] sm:block">
                                +{dayEvents.length - 2} more
                              </div>
                            )}
                            {pendingDayEvents.length > 0 && (
                              <div
                                className="group relative mt-1 hidden sm:inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px]"
                                style={{
                                  borderColor: pendingTone.border,
                                  background: pendingTone.bg,
                                  color: pendingTone.text,
                                }}
                              >
                                {pendingBadgeText}
                                <div
                                  className="pointer-events-none absolute left-1/2 top-0 z-30 w-56 -translate-x-1/2 -translate-y-[108%] rounded-xl border bg-[#16111a]/95 px-3 py-2 text-left text-[11px] opacity-0 shadow-[0_20px_55px_-30px_rgba(0,0,0,0.8)] transition group-hover:opacity-100"
                                  style={{ borderColor: pendingTone.border }}
                                >
                                  {pendingDayEvents.map((entry) => (
                                    <p
                                      key={`pending-day-${entry.id}`}
                                      className="mt-1 first:mt-0"
                                      style={{ color: getProcessTypeTone(entry.processType).text }}
                                    >
                                      {entry.processLabel} · {entry.courseTitle} · {entry.time}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                            {dayEvents.length > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setMobileAgendaOpenDay((prev) => (prev === day.day ? null : day.day))}
                                  className="mt-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand,#b61616)]/80 text-white sm:hidden"
                                  aria-label={`View classes for day ${day.day}`}
                                >
                                  <Music2 className="h-3.5 w-3.5" aria-hidden />
                                </button>
                                {mobileOpen && (
                                  <div className="absolute left-1/2 top-9 z-30 w-[11rem] -translate-x-1/2 rounded-xl border border-white/10 bg-[#16111a]/95 p-2 text-left shadow-[0_20px_55px_-30px_rgba(0,0,0,0.8)] sm:hidden">
                                    {dayEvents.map((entry) => (
                                      <div key={`mobile-agenda-${entry.id}`} className="rounded-md px-2 py-1.5">
                                        <p className="text-[11px] font-semibold text-white">{entry.courseTitle}</p>
                                        <p className="text-[10px] text-white/70">{entry.time}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                            {pendingDayEvents.length > 0 && (
                              <div
                                className="mt-1 sm:hidden text-[10px]"
                                style={{ color: pendingTone.text }}
                              >
                                {pendingBadgeText}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm">
                Next class: <strong>{nextBookedClass.scheduleLabel}</strong>
                {nextBookedClass.courseTitle && (
                  <span className="ml-2 text-zinc-600 dark:text-white/65">· {nextBookedClass.courseTitle}</span>
                )}
              </div>
              {pendingBookings.length > 0 && (
                <div className="mt-3 rounded-lg border border-black/10 bg-black/[0.03] px-3 py-3 text-sm dark:border-white/10 dark:bg-white/5">
                  <p className="font-semibold text-zinc-800 dark:text-white">Processes for assigned classes</p>
                  <div className="mt-2 space-y-2 text-xs">
                    {pendingBookings.slice(0, 3).map((booking) => {
                      const request = classRequestsByAttendance.get(booking.id)
                      const tone = getProcessTypeTone(request?.type)
                      return (
                        <div
                          key={`pending-booking-inline-${booking.id}`}
                          className="rounded-md border px-2 py-1.5"
                          style={{ borderColor: tone.border, background: tone.bg }}
                        >
                          <p style={{ color: tone.text }}>
                            <span className="font-semibold">{getPendingProcessLabel(request)}</span> · {booking.courseTitle} ·{" "}
                            {formatDateTimeInTimeZone(booking.startsAt)}
                          </p>
                        </div>
                      )
                    })}
                    {pendingBookings.length > 3 && (
                      <p className="text-zinc-700 dark:text-white/65">+{pendingBookings.length - 3} more in progress.</p>
                    )}
                  </div>
                </div>
              )}
              {visibleBookings.length === 0 && (
                <div className="mt-3 rounded-lg border border-[var(--brand,#b61616)]/40 bg-[rgba(182,22,22,0.1)] px-3 py-3 text-sm">
                  You do not have scheduled classes. Would you like to book now?
                </div>
              )}
            </GlassyCard>

            <GlassyCard id="assign-classes-section" className="order-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Assign classes</p>
                  <p className="mt-2 text-sm text-zinc-700 dark:text-white/70">
                    Organize your remaining classes with available package time slots.
                  </p>
                </div>
                {selectedPackageForAssign && (
                  <span className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                    {selectedPackageForAssign.isUnlimited
                      ? "Unlimited"
                      : `${selectedPackageForAssign.remainingCredits ?? 0} credits`}
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <label className="text-xs uppercase tracking-[0.16em] text-zinc-600 dark:text-white/50">Package</label>
                  <select
                    value={assignPackageId}
                    onChange={(event) => setAssignPackageId(event.target.value)}
                    className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                  >
                    <option value="">Select a package</option>
                    {assignablePackages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.label} {pkg.isUnlimited ? "(Unlimited)" : `(${pkg.remainingCredits ?? 0} credits)`}
                      </option>
                    ))}
                  </select>
                  {selectedPackageForAssign && (
                    <div className="rounded-lg border border-white/10 bg-black/[0.04] px-3 py-2 text-xs text-zinc-700 dark:bg-white/5 dark:text-white/65">
                      <p>
                        Class:{" "}
                        <strong className="text-zinc-900 dark:text-white">
                          {selectedPackageCourse?.title || selectedPackageForAssign.courseSlug || "No class"}
                        </strong>
                      </p>
                      <p className="mt-1">
                        Schedule: {selectedPackageCourse?.schedule.day || "According to calendar"}
                      </p>
                      {selectedPackageAssignmentStats && (
                        <div className="mt-2 rounded-md border border-black/10 bg-black/[0.03] px-2 py-2 text-[11px] dark:border-white/10 dark:bg-white/5">
                          <p>
                            Assigned package classes:{" "}
                            <strong className="text-zinc-900 dark:text-white">
                              {selectedPackageAssignmentStats.assigned}
                            </strong>
                          </p>
                          <p className="mt-1">
                            Package classes left to assign:{" "}
                            <strong className="text-zinc-900 dark:text-white">
                              {selectedPackageAssignmentStats.isUnlimited
                                ? "No limit"
                                : selectedPackageAssignmentStats.remaining ?? 0}
                            </strong>
                          </p>
                          {selectedPackageAssignmentStats.queued > 0 && (
                            <p className="mt-1 text-[10px] text-zinc-600 dark:text-white/55">
                              Includes {selectedPackageAssignmentStats.queued} class(es) in &quot;Classes to confirm&quot;.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-600 dark:text-white/50">New time slot</p>
                  <div className="mt-3">
                    <CalendarPicker
                      value={assignDate}
                      onChange={(value) => {
                        setAssignDate(value)
                        setAssignTime("")
                        setAssignError(null)
                        setAssignSuccess(null)
                      }}
                      timezone="America/New_York"
                      minDate={todayNyDateKey}
                      availableWeekdays={selectedPackageCourse?.schedule.availableWeekdays}
                      unavailableDates={assignUnavailableDates}
                      allowClear
                      compact
                      className="bg-white/5"
                    />
                  </div>
                  <p className="mt-3 text-xs text-zinc-600 dark:text-white/50">Available time slots</p>
                  {assignAvailabilityLoading ? (
                    <div className="mt-2 h-10 animate-pulse rounded-md border border-white/10 bg-white/5" />
                  ) : assignAvailability.length > 0 ? (
                    <div className="mt-2">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {assignAvailability.map((slot) => {
                          const alreadyBooked = assignBookedTimesForSelectedDate.has(slot.time)
                          const isPast = Boolean(slot.isPast)
                          const disabled = slot.isFull || alreadyBooked || isPast
                          return (
                            <button
                              key={`assign-availability-${slot.time}`}
                              type="button"
                              onClick={() => setAssignTime(slot.time)}
                              disabled={disabled}
                              className={`rounded-md border px-2 py-2 text-xs transition ${
                                disabled
                                  ? "cursor-not-allowed border-white/10 bg-white/5 text-zinc-500 dark:text-white/35"
                                  : assignTime === slot.time
                                    ? "border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.22)] text-zinc-900 dark:text-white"
                                    : "border-white/15 bg-white/10 text-zinc-800 dark:bg-white/5 dark:text-white/80 hover:border-white/35"
                              }`}
                            >
                              <span className="block">{slot.label}</span>
                              <span className="mt-1 block text-[10px] text-zinc-500 dark:text-white/55">
                                {alreadyBooked
                                  ? "Already booked"
                                  : isPast
                                    ? "Past time slot"
                                    : slot.isFull
                                      ? "Full"
                                      : `${slot.spotsLeft} spots`}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      {assignAvailability.every(
                        (slot) => slot.isFull || Boolean(slot.isPast) || assignBookedTimesForSelectedDate.has(slot.time)
                      ) && (
                        <p className="mt-2 text-xs text-zinc-600 dark:text-white/55">
                          No available time slots for that date.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-600 dark:text-white/55">
                      Select a package and a date to view time slots.
                    </p>
                  )}

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={addAssignSlot}
                      disabled={!assignDate || !assignTime}
                      className="rounded-md border border-[var(--brand,#b61616)]/60 px-3 py-2 text-xs font-semibold text-[var(--brand,#b61616)] disabled:opacity-50"
                    >
                      Add class
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-600 dark:text-white/50">Classes to confirm</p>
                {assignSlots.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {assignSlots.map((slot, idx) => (
                      <div
                        key={`assign-list-${slot.date}-${slot.time}-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-black/[0.04] px-3 py-2 text-sm dark:bg-white/5"
                      >
                        <span>
                          {formatDateTimeInTimeZone(`${slot.date}T${slot.time}:00`)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAssignSlot(idx)}
                          className="rounded-md border border-white/15 px-2 py-1 text-xs font-semibold text-zinc-700 dark:text-white/80"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-zinc-600 dark:text-white/55">
                    You have not added classes for this package yet.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-zinc-600 dark:text-white/60">
                    You earn 2.5 points for assigning this package for the first time.
                  </p>
                  <button
                    type="button"
                    onClick={submitAssignClasses}
                    disabled={assigning || !assignSlots.length || !assignPackageId}
                    className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {assigning ? "Assigning..." : "Assign classes"}
                  </button>
                </div>
              </div>
              {assignError && <p className="mt-3 text-xs text-red-400">{assignError}</p>}
              {assignSuccess && <p className="mt-3 text-xs text-emerald-300">{assignSuccess}</p>}
            </GlassyCard>

            <GlassyCard className="order-9 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Gear</p>
              <div className="mt-4 flex items-center gap-4">
                <div className="h-20 w-28 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/shoes-pli.svg" alt="Shoes" className="h-full w-full object-cover" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-zinc-800 dark:text-white/80">Shoes: {mockProfile.shoeTracking.model}</p>
                  <div className="mt-2 h-3 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-[var(--brand,#b61616)]" style={{ width: `${shoeProgress}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-zinc-600 dark:text-white/60">
                    {mockProfile.shoeTracking.km} km used · Recommended replacement at {mockProfile.shoeTracking.maxKm} km.
                  </p>
                </div>
                <span className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                  {shoeProgress}% life
                </span>
              </div>
            </GlassyCard>
          </section>

          {/* Right */}
          <aside className="lg:w-[15rem] lg:justify-self-end lg:self-start">
            <div ref={rightRailRef} className="profile-right-rail space-y-4">
            <GlassyCard className="p-4">
              <h3 className="text-base font-semibold">Book new class</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-white/60">Schedule a new class available in your time slot.</p>
              <button
                className="mt-4 w-full rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white"
                onClick={() => setCoursePickerOpen(true)}
              >
                Book
              </button>
            </GlassyCard>
            <GlassyCard className="p-4">
              <h3 className="text-base font-semibold">Change class</h3>
              {bookingsLoading ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-white/60">Loading next class...</p>
              ) : selectedBooking ? (
                <div className="mt-2 space-y-2 text-sm">
                  <p className="text-zinc-800 dark:text-white/80">{selectedBooking.courseTitle}</p>
                  <p className="text-zinc-600 dark:text-white/60">
                    {formatDateTimeInTimeZone(selectedBooking.startsAt)}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-600 dark:text-white/60">You do not have a scheduled class to change.</p>
              )}
              {bookingsError && <p className="mt-2 text-xs text-red-400">{bookingsError}</p>}
              <button
                type="button"
                className="mt-4 w-full rounded-md border border-black/10 px-4 py-2 text-sm font-semibold text-zinc-700 dark:border-white/10 dark:text-white/80"
                onClick={openChangeClassModal}
                disabled={!selectedBooking}
              >
                Change
              </button>
            </GlassyCard>
            <GlassyCard className="p-4">
              <h3 className="text-base font-semibold">Check-in</h3>
              {bookingsLoading ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-white/60">Loading classes...</p>
              ) : nextCheckInBooking ? (
                <div className="mt-2 space-y-2 text-sm">
                  <p className="text-zinc-800 dark:text-white/80">{nextCheckInBooking.courseTitle}</p>
                  <p className="text-zinc-600 dark:text-white/60">
                    {formatDateTimeInTimeZone(nextCheckInBooking.startsAt)}
                  </p>
                </div>
              ) : pendingCheckInBooking ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-white/60">
                  Check-in opens {CHECK_IN_OPEN_WINDOW_HOURS} hours before.
                  {checkInOpensAtLabel ? ` Available from ${checkInOpensAtLabel}.` : ""}
                </p>
              ) : (
                <p className="mt-2 text-sm text-zinc-600 dark:text-white/60">
                  You do not have pending classes to check in.
                </p>
              )}
              <button
                type="button"
                className="mt-4 w-full rounded-md border border-[var(--brand,#b61616)]/50 px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-60 dark:text-white/80"
                onClick={() => {
                  if (!nextCheckInBooking) return
                  void submitBookingCheckIn(nextCheckInBooking.id)
                }}
                disabled={!nextCheckInBooking || Boolean(checkInSubmittingId)}
              >
                {checkInSubmittingId === nextCheckInBooking?.id ? "Recording..." : "Mark check-in"}
              </button>
              {checkInError && <p className="mt-2 text-xs text-red-400">{checkInError}</p>}
              {checkInSuccess && <p className="mt-2 text-xs text-emerald-500 dark:text-emerald-300">{checkInSuccess}</p>}
            </GlassyCard>
            <GlassyCard className="p-4">
              <h3 className="text-base font-semibold">Suspend / Cancel</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-white/60">
                Cancellation: choose a class and decide whether to reassign or request a refund.
                Suspension: only for active packages.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-zinc-700 dark:border-white/10 dark:text-white/80"
                  onClick={() => openRequestModal("SUSPEND")}
                >
                  Suspend package
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[var(--brand,#b61616)]/50 px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-white/80"
                  onClick={() => openRequestModal("CANCEL")}
                >
                  Cancel class
                </button>
              </div>
              {requestSubmitError && !requestModalType && (
                <p className="mt-3 text-xs text-red-400">{requestSubmitError}</p>
              )}
              {requestSubmitSuccess && (
                <p className="mt-3 text-xs text-emerald-500 dark:text-emerald-300">{requestSubmitSuccess}</p>
              )}
            </GlassyCard>
            <GlassyCard className="p-4">
              <h3 className="text-base font-semibold">Recent requests</h3>
              {actionRequestsError && <p className="mt-2 text-xs text-red-400">{actionRequestsError}</p>}
              {actionRequestsLoading ? (
                <div className="mt-3 space-y-2">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={`request-skeleton-${idx}`} className="h-14 animate-pulse rounded-lg border border-white/10 bg-white/5" />
                  ))}
                </div>
              ) : latestActionRequests.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {latestActionRequests.map((request) => {
                    const metaLabel = actionRequestMetaLabel(request)
                    const tone = getProcessTypeTone(request.type)
                    return (
                      <div
                        key={request.id}
                        className="rounded-lg border px-3 py-2"
                        style={{ borderColor: tone.border, background: tone.bg }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-zinc-800 dark:text-white/85">
                            {actionRequestLabels[request.type as ActionRequestType] || request.type}
                          </p>
                          <span
                            className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]"
                            style={{ borderColor: tone.border, color: tone.text }}
                          >
                            {actionRequestStatusLabel(request.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-600 dark:text-white/55">
                          {formatDateTimeInTimeZone(request.createdAt)}
                        </p>
                        {metaLabel && <p className="mt-1 text-xs text-zinc-700 dark:text-white/70">{metaLabel}</p>}
                        {request.message && (
                          <p className="mt-1 line-clamp-2 text-xs text-zinc-700 dark:text-white/70">{request.message}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="mt-3 text-xs text-zinc-600 dark:text-white/60">No requests for now.</p>
              )}
            </GlassyCard>
            </div>
          </aside>
        </div>
      </div>

      {changeModalOpen && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" data-lenis-prevent>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-br from-[#151118] via-[#0d0b12] to-[#09090d] p-5 shadow-[0_30px_120px_-50px_rgba(0,0,0,0.85)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Change class</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Step-by-step reschedule</h3>
                <p className="mt-1 text-sm text-white/65">
                  Reassign your main class and, if you want, continue with package classes.
                </p>
              </div>
              <button
                type="button"
                onClick={closeChangeClassModal}
                className="rounded-full border border-white/10 bg-black/40 p-2 text-white/70 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {rescheduleStepItems.map((step) => {
                  const active = rescheduleStep === step.id
                  const done = rescheduleStep > step.id
                  return (
                    <div
                      key={`reschedule-step-${step.id}`}
                      className={`rounded-lg border px-3 py-2 text-[11px] uppercase tracking-[0.14em] transition ${
                        active
                          ? "border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.2)] text-white"
                          : done
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                            : "border-white/10 bg-black/20 text-white/55"
                      }`}
                    >
                      Step {step.id}
                      <p className="mt-1 text-[10px] normal-case tracking-normal">{step.label}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {rescheduleStep === 1 && (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/50">Selected course</p>
                    <select
                      value={rescheduleCourseSlug || selectedBooking.courseSlug}
                      onChange={(event) => {
                        const slug = event.target.value
                        setRescheduleCourseSlug(slug)
                      const nextBooking = visibleBookings.find((item) => item.courseSlug === slug) || null
                        if (!nextBooking) return
                        setSelectedBookingId(nextBooking.id)
                        hydrateRescheduleFromBooking(nextBooking)
                      }}
                      className="mt-2 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                    >
                      {rescheduleCourseOptions.map((course) => (
                        <option key={`reschedule-course-${course.slug}`} value={course.slug}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/50">Booked class</p>
                    <select
                      value={selectedBooking.id}
                      onChange={(event) => {
                        const nextId = event.target.value
                        setSelectedBookingId(nextId)
                      const nextBooking = visibleBookings.find((item) => item.id === nextId) || null
                        hydrateRescheduleFromBooking(nextBooking)
                      }}
                      className="mt-2 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                    >
                      {rescheduleScopedBookings.map((item) => (
                        <option key={`booking-option-${item.id}`} value={item.id}>
                          Booking: {formatDateTimeInTimeZone(item.startsAt)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
                  <p className="font-semibold text-white">{selectedBooking.courseTitle}</p>
                  <p className="mt-1">Current booking: {formatDateTimeInTimeZone(selectedBooking.startsAt)}</p>
                  {selectedBooking.packageLabel && <p className="mt-1">Package: {selectedBooking.packageLabel}</p>}
                </div>

                <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/50">New time slot</p>
                <div className="mt-2">
                    <CalendarPicker
                      value={rescheduleDate}
                    onChange={(value) => {
                      setRescheduleDate(value)
                      setRescheduleTime("")
                      setRescheduleError(null)
                    }}
                    timezone={NY_TIMEZONE}
                    minDate={todayNyDateKey}
                    availableWeekdays={selectedBookingCourse?.schedule.availableWeekdays}
                    isDateDisabled={isRescheduleDateBlocked}
                    getDateDisabledReason={getRescheduleDateBlockReason}
                    allowClear
                    className="bg-white/5"
                  />
                </div>
                <div className="mt-3">
                  <p className="text-xs text-white/50">Time</p>
                  {availabilityLoading ? (
                    <div className="mt-2 h-10 animate-pulse rounded-md border border-white/10 bg-white/5" />
                  ) : availability.length > 0 ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {availability.map((slot) => {
                        const timeTaken = rescheduleBookedTimesForSelectedDate.has(slot.time)
                        const sameAsCurrent = isCurrentRescheduleSlot(rescheduleDate, slot.time)
                        const isPast = Boolean(slot.isPast)
                        const disabled = slot.isFull || timeTaken || sameAsCurrent || isPast
                        const disabledReason = sameAsCurrent
                          ? "This is already your current booking."
                          : timeTaken
                            ? "That time slot on that day is already taken by another class."
                            : isPast
                              ? "That time slot has already passed."
                            : undefined
                        return (
                          <button
                            key={`reschedule-slot-${slot.time}`}
                            type="button"
                            onClick={() => setRescheduleTime(slot.time)}
                            disabled={disabled}
                            title={disabledReason}
                            className={`rounded-md border px-3 py-2 text-sm transition ${
                              disabled
                                ? "cursor-not-allowed border-white/10 bg-white/5 text-white/35"
                                : rescheduleTime === slot.time
                                  ? "border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.22)] text-white"
                                  : "border-white/15 bg-white/5 text-white/80 hover:border-white/35"
                            }`}
                          >
                            <span className="block">{slot.label}</span>
                            <span className="mt-1 block text-[10px] text-white/50">
                              {sameAsCurrent
                                ? "Current"
                                : timeTaken
                                  ? "Taken"
                                  : isPast
                                    ? "Past time slot"
                                    : slot.isFull
                                      ? "Full"
                                      : `${slot.spotsLeft} spots`}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-white/55">Select a date to view time slots.</p>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={continueRescheduleStep}
                    className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={!selectedBooking || !rescheduleDate || !rescheduleTime}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {rescheduleStep === 2 && (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Confirmation</p>
                <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/80">
                  <p>
                    <span className="text-white/60">Course:</span> {selectedBooking.courseTitle}
                  </p>
                  <p className="mt-1">
                    <span className="text-white/60">Current booking:</span> {formatDateTimeInTimeZone(selectedBooking.startsAt)}
                  </p>
                  <p className="mt-1">
                    <span className="text-white/60">New time slot:</span> {formatDateTimeInTimeZone(`${rescheduleDate}T${rescheduleTime}:00`)}
                  </p>
                  {selectedBooking.packageLabel && (
                    <p className="mt-1">
                      <span className="text-white/60">Package:</span> {selectedBooking.packageLabel}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRescheduleStep(1)}
                    className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white/80"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={submitPrimaryReschedule}
                    disabled={rescheduleSaving}
                    className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {rescheduleSaving ? "Saving..." : "Confirm main class"}
                  </button>
                </div>
              </div>
            )}

            {rescheduleStep === 3 && (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Pending classes</p>
                <p className="mt-2 text-sm text-white/75">
                  {pendingAssignablePackages.length > 0
                    ? "These are the package classes you still have left to assign."
                    : "You don't have pending credits to assign in active packages."}
                </p>
                {pendingAssignablePackages.length > 0 && (
                  <div className="mt-3 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2">
                    {pendingAssignablePackages.map((pkg) => (
                      <div key={`pkg-pending-${pkg.id}`} className="rounded-md border border-white/10 px-3 py-2 text-xs text-white/75">
                        <p className="font-semibold text-white">{pkg.label}</p>
                        <p className="mt-1">
                          Pending: {pkg.isUnlimited ? "Unlimited" : `${pkg.remainingCredits ?? 0} credits`}
                        </p>
                        <p className="mt-1 text-white/60">
                          Course: {sourceCourses.find((course) => course.slug === pkg.courseSlug)?.title || pkg.courseSlug || "No course"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRescheduleStep(1)}
                    className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white/80"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={closeChangeClassModal}
                    className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white/80"
                  >
                    Finish
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeChangeClassModal()
                      window.setTimeout(() => {
                        document.getElementById("assign-classes-section")?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        })
                      }, 120)
                    }}
                    disabled={!pendingAssignablePackages.length}
                    className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Assign pending classes
                  </button>
                </div>
              </div>
            )}

            {rescheduleError && <p className="mt-3 text-xs text-red-400">{rescheduleError}</p>}
            {rescheduleSuccess && <p className="mt-3 text-xs text-emerald-300">{rescheduleSuccess}</p>}
          </div>
        </div>
      )}

      {requestModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" data-lenis-prevent>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-gradient-to-br from-[#16121a] via-[#0e0c13] to-[#09090d] p-5 shadow-[0_30px_120px_-50px_rgba(0,0,0,0.85)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Request</p>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  {requestModalType === "SUSPEND" ? "Suspend package" : "Cancel class"}
                </h3>
                <p className="mt-1 text-sm text-white/60">
                  {requestModalType === "SUSPEND"
                    ? "Suspension applies only to active packages."
                    : "Choose the class and decide if you want to reassign or request a refund."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRequestModal}
                className="rounded-full border border-white/10 bg-black/40 p-2 text-white/70 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {requestModalType === "SUSPEND" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-white">Package</label>
                    <select
                      value={requestSuspendPackageId}
                      onChange={(event) => setRequestSuspendPackageId(event.target.value)}
                      className="mt-2 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Select a package</option>
                      {suspendablePackages.map((pkg) => (
                        <option key={`suspend-package-${pkg.id}`} value={pkg.id}>
                          {pkg.label} {pkg.isUnlimited ? "(Unlimited)" : `(${pkg.remainingCredits ?? 0} credits)`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-white">Suspension start</label>
                      <input
                        type="date"
                        value={requestSuspendStart}
                        onChange={(event) => setRequestSuspendStart(event.target.value)}
                        className="mt-2 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-white">Suspension end</label>
                      <input
                        type="date"
                        value={requestSuspendEnd}
                        onChange={(event) => setRequestSuspendEnd(event.target.value)}
                        min={requestSuspendStart || undefined}
                        className="mt-2 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {requestModalType === "CANCEL" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-white">Assigned class</label>
                    <select
                      value={requestCancelBookingId}
                      onChange={(event) => {
                        setRequestCancelBookingId(event.target.value)
                        setRequestCancelDecision(null)
                        setRequestSubmitError(null)
                      }}
                      className="mt-2 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Select a class</option>
                      {visibleBookings.map((booking) => (
                        <option key={`cancel-booking-${booking.id}`} value={booking.id}>
                          {booking.courseTitle} · {formatDateTimeInTimeZone(booking.startsAt)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {requestCancelBooking && (
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85">
                      <p className="font-semibold text-white">{requestCancelBooking.courseTitle}</p>
                      <p className="mt-1 text-xs text-white/65">{formatDateTimeInTimeZone(requestCancelBooking.startsAt)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">Do you want to reassign this class?</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRequestCancelDecision("REASSIGN")
                          setRequestSubmitError(null)
                        }}
                        className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                          requestCancelDecision === "REASSIGN"
                            ? "border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.2)] text-white"
                            : "border-white/15 text-white/80 hover:border-white/40"
                        }`}
                      >
                        Yes, reassign
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRequestCancelDecision("REFUND")
                          setRequestSubmitError(null)
                        }}
                        className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                          requestCancelDecision === "REFUND"
                            ? "border-[var(--brand,#b61616)] bg-[rgba(182,22,22,0.2)] text-white"
                            : "border-white/15 text-white/80 hover:border-white/40"
                        }`}
                      >
                        No, refund
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <label className="text-sm font-medium text-white">Details (optional)</label>
              <textarea
                value={requestMessage}
                onChange={(event) => setRequestMessage(event.target.value)}
                rows={4}
                placeholder={
                  requestModalType === "SUSPEND"
                    ? "Ex: I am traveling for two weeks and resuming later."
                    : requestCancelDecision === "REASSIGN"
                      ? "You can add context before moving to the change."
                      : "Ex: for now I will not continue."
                }
                className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/45"
              />
              {requestSubmitError && <p className="text-xs text-red-400">{requestSubmitError}</p>}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeRequestModal}
                className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-white/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitActionRequest}
                disabled={requestSubmitting || (requestModalType === "CANCEL" && !requestCancelDecision)}
                className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {requestSubmitting ? "Processing..." : "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {coursePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" data-lenis-prevent>
          <div className="relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#141017] via-[#0d0b12] to-[#09090d] p-6 shadow-[0_30px_120px_-50px_rgba(0,0,0,0.85)] flex flex-col">
            <button
              className="absolute right-5 top-5 rounded-full border border-white/10 bg-black/40 p-2 text-white/70 hover:text-white"
              onClick={() => setCoursePickerOpen(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Book</p>
                <h3 className="mt-2 text-lg font-semibold text-white">Choose the class you want to book</h3>
                <p className="mt-1 text-sm text-white/60">We show the classes you choose the most first.</p>
              </div>
            </div>

            <div className="mt-6 flex-1 min-h-0 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {orderedCourses.map((course) => (
                <button
                  key={course.slug}
                  type="button"
                  onClick={() => {
                    setSelectedCourse(course)
                    setCoursePickerOpen(false)
                    setEnrollOpen(true)
                  }}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-[var(--brand,#b61616)]/60 hover:bg-white/10"
                >
                  <div className="relative mb-4 aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={course.heroMedia?.image ?? "/images/carousel/_DSC1079.JPG"}
                      alt={course.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{course.title}</p>
                      <p className="mt-1 text-xs text-white/60">{course.level} · {course.duration}</p>
                    </div>
                    {preferredSet.has(course.slug) && (
                      <span className="rounded-full border border-[var(--brand,#b61616)]/60 bg-[rgba(182,22,22,0.15)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--brand,#b61616)]">
                        Preferred
                      </span>
                    )}
                  </div>
                  <div className="mt-4 text-xs text-white/60">
                    <p>{course.schedule.day}</p>
                    <p>{course.location.address}</p>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-[11px] text-white/70">
                    <span className="rounded-full border border-white/10 px-2 py-1">View details</span>
                    <span className="rounded-full border border-white/10 px-2 py-1">Book</span>
                  </div>
                </button>
              ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedCourse && (
        <EnrollModal
          course={selectedCourse}
          open={enrollOpen}
          initialStep={1}
          onCloseAction={() => setEnrollOpen(false)}
          prefillContact={bookingPrefillContact}
          useDraft={false}
        />
      )}
    </main>
  )
}
