"use client"

import React from "react"
import { useSearchParams } from "next/navigation"
import {
  Bot,
  CircleDollarSign,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GraduationCap,
  ImagePlus,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  RefreshCw,
  Search,
  School,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { demoCourses } from "@/constants/courses"
import CalendarPicker from "@/components/front/ui/CalendarPicker"
import type { StaffRole } from "@/lib/security/staff-role"
import { type StaffCategory } from "@/lib/security/staff-category"
import type { StaffRequestStatus, StaffRequestType } from "@/lib/security/staff-request"
import { POINTS_RULE_DEFINITIONS } from "@/lib/points/constants"

type StaffUserRow = {
  id: string
  email: string
  phone: string
  avatarUrl: string
  location: string
  hasPin: boolean
  firstName: string
  lastName: string
  role: StaffRole
  category: StaffCategory
  payrollHoursWorked: number | null
  payrollHourlyRate: number | null
  payrollStatus: "paid" | "pending" | null
  payrollPaydayWeekday: number | null
  payrollDelayEntries: PayrollDelayEntry[]
  performanceRating: number | null
  performanceReviewsCount: number | null
  performanceReviewCycleDays: number | null
  teacherType: string
  teacherAssignedUserId: string
  teacherRecurrenceUnit: "month" | "year"
  teacherRecurrenceInterval: number | null
  teacherCourseSlugs: string[]
  teacherWeekdays: number[]
  teacherShiftStart: string
  teacherShiftEnd: string
  teacherWeeklyHours: number | null
  teacherBonusTargetHours: number | null
  banned: boolean
  locked: boolean
  online: boolean
  lastActiveAt: number | null
  staffLastCheckInAt: number | null
  createdAt: number
  lastSignInAt: number | null
}

type ScheduleEvent = {
  attendanceId: string
  status: string
  startsAtIso: string
  timeLabel: string
  courseSlug: string
  courseTitle: string
  userId: string
  userName: string
  userEmail: string
  userPhone: string
}

type PaymentRow = {
  id: string
  userId: string
  courseSlug: string
  courseTitle: string
  customerName: string
  customerEmail: string
  customerPhone: string
  amount: number
  currency: string
  paymentStatus: string
  settlementStatus: "pending" | "paid"
  settlementNote: string
  settledAt: string | null
  createdAt: string
  updatedAt: string
}

type PaymentSummary = {
  totalItems: number
  totalCollected: number
  pendingSettlement: number
  paidSettlement: number
}

type StaffRequestRow = {
  id: string
  type: StaffRequestType
  status: StaffRequestStatus
  message: string
  meta: Record<string, unknown>
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  user: {
    id: string
    name: string
    email: string
    phone: string
  }
}

type StaffRequestSummary = {
  total: number
  pending: number
  inReview: number
  approved: number
  rejected: number
}

type PayrollStaffRow = {
  userId: string
  name: string
  role: StaffRole
  category: StaffCategory
  hoursWorked: number | null
  hourlyRate: number | null
  amountCents: number | null
  status: "paid" | "pending" | "unknown"
  delayDays: number | null
  paydayWeekday: number | null
  paydayLabel: string
  dueDateLabel: string | null
  delayEntries: PayrollDelayEntry[]
}

type PayrollDelayEntry = {
  id: string
  dateLabel: string
  expectedTime: string
  actualTime: string
  delayMinutes: number
}

type PayrollDelayModalState = {
  row: PayrollStaffRow
  entries: PayrollDelayEntry[]
  totalDelayMinutes: number
  lateDays: number
}

type StaffProfileForm = {
  firstName: string
  lastName: string
  role: StaffRole
  category: StaffCategory
  birthDate: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string
  personalNote: string
  location: string
  gallery: string[]
  pin: string
  clearPin: boolean
}

type SchoolCourseRow = {
  id: string
  slug: string
  title: string
  kind: string
  category: string | null
  description: string | null
  coverImageUrl: string | null
  previewVideoUrl: string | null
  dropInPriceCents: number | null
  firstClassPriceCents: number | null
  level: string | null
  durationMinutes: number | null
  location: string | null
  availableWeekdays: number[]
  availableTimes: string[]
  scheduleRules: unknown | null
  active: boolean
  createdAt: string
}

type SchoolPackageRow = {
  id: string
  key: string
  courseSlug: string | null
  label: string
  description: string | null
  priceCents: number | null
  cadence: string | null
  totalCredits: number | null
  makeUps: number
  validDays: number
  isUnlimited: boolean
  active: boolean
  createdAt: string
}

type PointsRuleRow = {
  id: string
  key: string
  label: string
  description: string | null
  eventType: string
  points: number
  active: boolean
  createdAt: string
}

type CourseFormState = {
  slug: string
  title: string
  kind: string
  category: string
  description: string
  previewImageUrl: string
  previewVideoUrl: string
  dropInPriceCents: string
  firstClassPriceCents: string
  level: string
  durationMinutes: string
  location: string
  availableTimesCsv: string
  active: boolean
}

type CourseScheduleSlot = {
  date?: string
  weekday?: number
  recurring?: boolean
  time: string
}

type CourseScheduleRuleEntry = {
  weekday: number
  times: string[]
}

type CourseSpecialEventEntry = {
  date: string
  times: string[]
  label: string | null
}

type CourseScheduleRulesPayload = {
  mode: "regular" | "special_event"
  weeklyDaysTarget: number
  repeatAllMonth: boolean
  recurrenceMode: "indefinite" | "until_date"
  recurrenceEndsAt: string | null
  rules: CourseScheduleRuleEntry[]
  specialEvents: CourseSpecialEventEntry[]
}

type PackageFormState = {
  key: string
  courseSlug: string
  label: string
  description: string
  priceCents: string
  cadence: string
  totalCredits: string
  makeUps: string
  validDays: string
  isUnlimited: boolean
  active: boolean
}

type PointsRuleFormState = {
  templateKey: string
  points: string
  active: boolean
}

type PointsAssignFormState = {
  userEmail: string
  type: string
  points: string
  note: string
  eventKey: string
}

type NavItem = {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const CATEGORY_OPTIONS: StaffCategory[] = ["front_desk", "manager", "teacher", "guest_staff"]
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "users", label: "User Management", icon: Users },
  { key: "students", label: "Students", icon: GraduationCap },
  { key: "security", label: "Security", icon: ShieldCheck },
  { key: "schedule", label: "School", icon: School },
  { key: "assistant", label: "AI Assistant", icon: Bot },
  { key: "settings", label: "Settings", icon: Settings },
]

const CATEGORY_LABELS: Record<StaffCategory, string> = {
  front_desk: "Front desk",
  manager: "Managers",
  teacher: "Profesores",
  guest_staff: "Guest staff",
  partner: "Partner",
}

const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  admin: "GM",
  staff: "Staff",
}
const ROLE_FORM_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  admin: "Admin (GM)",
  staff: "Staff",
}

const getFixedCategoryForRole = (role: StaffRole): StaffCategory | null => {
  if (role === "owner") return "partner"
  if (role === "admin") return "manager"
  return null
}

const normalizeCategoryForRole = (role: StaffRole, category: StaffCategory): StaffCategory =>
  getFixedCategoryForRole(role) || category

const REQUEST_TYPE_LABELS: Record<StaffRequestType, string> = {
  STAFF_DAY_OFF: "Day off",
  STAFF_SHIFT_SWAP: "Shift swap",
  STAFF_SCHEDULE_CHANGE: "Schedule change",
  STAFF_PAY_ADVANCE: "Pay advance",
  STAFF_SHIFT_COVER: "Shift cover",
}

const REQUEST_STATUS_OPTIONS: StaffRequestStatus[] = ["PENDING", "IN_REVIEW", "APPROVED", "REJECTED"]
const WEEKDAY_LABELS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const SCHOOL_COURSE_KINDS = ["course", "program", "bootcamp", "workshop", "convention"]
const SPECIAL_EVENT_COURSE_KINDS = new Set(["bootcamp", "workshop", "convention"])
const COURSE_KIND_DATE_TONE: Record<string, "course" | "program" | "bootcamp" | "workshop" | "convention"> = {
  course: "course",
  program: "program",
  bootcamp: "bootcamp",
  workshop: "workshop",
  convention: "convention",
}
const COURSE_KIND_LABELS: Record<string, string> = {
  course: "Curso",
  program: "Programa",
  bootcamp: "Bootcamp",
  workshop: "Workshop",
  convention: "Convención",
}
const COURSE_KIND_REVIEW_HINTS: Record<string, string> = {
  course: "Formato base semanal.",
  program: "Ruta de clases por módulo.",
  bootcamp: "Intensivo con cupos limitados.",
  workshop: "Sesión especial temática.",
  convention: "Evento único de alto impacto.",
}
const DEFAULT_QUICK_SCHEDULE_TIMES = ["09:00", "10:00", "11:00", "18:00", "19:00", "20:00"]
const SCHOOL_SCHEDULE_SHORTCUTS_STORAGE_KEY = "pli:staff:school:schedule-shortcuts:v1"
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const SCHEDULE_SHORTCUT_TONES = [
  "bg-gradient-to-br from-[var(--brand,#b61616)]/14 via-[var(--brand,#b61616)]/8 to-transparent dark:from-[var(--brand,#b61616)]/26 dark:via-[#1a1430]/58 dark:to-[#0a0f23]/88",
  "bg-gradient-to-br from-[#f59e0b]/14 via-[var(--brand,#b61616)]/8 to-transparent dark:from-[#f59e0b]/18 dark:via-[#221631]/56 dark:to-[#0a0f23]/88",
  "bg-gradient-to-br from-[#3b82f6]/12 via-[var(--brand,#b61616)]/8 to-transparent dark:from-[#2563eb]/14 dark:via-[#171b38]/58 dark:to-[#0a0f23]/88",
]

const statusLabel = (row: StaffUserRow) => {
  if (row.banned) return "Banned"
  if (row.locked) return "Locked"
  return row.online ? "Online" : "Offline"
}

const formatDate = (value: number | null) => {
  if (!value) return "—"
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return "—"
  }
}

const toEmbedVideoUrl = (input: string) => {
  const value = input.trim()
  if (!value) return ""
  if (value.includes("youtube.com/watch?v=")) {
    const id = value.split("watch?v=")[1]?.split("&")[0]
    return id ? `https://www.youtube.com/embed/${id}` : value
  }
  if (value.includes("youtu.be/")) {
    const id = value.split("youtu.be/")[1]?.split("?")[0]
    return id ? `https://www.youtube.com/embed/${id}` : value
  }
  if (value.includes("vimeo.com/")) {
    const id = value.split("vimeo.com/")[1]?.split("?")[0]
    return id ? `https://player.vimeo.com/video/${id}` : value
  }
  return value
}

const normalizeClockTime = (value: string) => {
  const [hours, minutes] = value.split(":")
  const h = Number(hours)
  const m = Number(minutes)
  if (!Number.isInteger(h) || !Number.isInteger(m)) return ""
  if (h < 0 || h > 23 || m < 0 || m > 59) return ""
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

const formatClockLabel = (value: string) => {
  const normalized = normalizeClockTime(value)
  if (!normalized) return value
  const [hours, minutes] = normalized.split(":").map(Number)
  const suffix = hours >= 12 ? "PM" : "AM"
  const hour12 = hours % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`
}

const toLocalIsoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

const toCourseScheduleWeekday = (isoDate: string) => {
  const date = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.getDay()
}

const getCourseSlotWeekday = (slot: CourseScheduleSlot) => {
  if (typeof slot.weekday === "number" && slot.weekday >= 0 && slot.weekday <= 6) return slot.weekday
  if (slot.date) return toCourseScheduleWeekday(slot.date)
  return null
}

const getCourseSlotKey = (slot: CourseScheduleSlot) => {
  const time = normalizeClockTime(slot.time)
  if (typeof slot.weekday === "number") return `w:${slot.weekday}|${time}`
  return `d:${slot.date || ""}|${time}`
}

const formatCourseSlotLabel = (slot: CourseScheduleSlot) => {
  const timeLabel = formatClockLabel(slot.time)
  if (typeof slot.weekday === "number") {
    const weekdayLabel = WEEKDAY_LABELS[slot.weekday] || `Day ${slot.weekday}`
    return `Every ${weekdayLabel} · ${timeLabel}`
  }
  return `${slot.date || "—"} · ${timeLabel}`
}

const compareCourseSlots = (a: CourseScheduleSlot, b: CourseScheduleSlot) => {
  const aWeekday = getCourseSlotWeekday(a)
  const bWeekday = getCourseSlotWeekday(b)
  const aTime = normalizeClockTime(a.time)
  const bTime = normalizeClockTime(b.time)
  if (aWeekday !== null && bWeekday !== null && aWeekday !== bWeekday) return aWeekday - bWeekday
  if (aTime !== bTime) return aTime.localeCompare(bTime)
  const aDate = a.date || ""
  const bDate = b.date || ""
  return aDate.localeCompare(bDate)
}

const deriveCourseScheduleData = (slots: CourseScheduleSlot[]) => {
  if (slots.length === 0) {
    return { weekdays: [] as number[], times: [] as string[] }
  }
  const weekdays = [...new Set(slots.map((slot) => getCourseSlotWeekday(slot)).filter((item): item is number => item !== null))].sort(
    (a, b) => a - b
  )
  const times = [...new Set(slots.map((slot) => normalizeClockTime(slot.time)).filter(Boolean))].sort()
  return { weekdays, times }
}

const normalizeCourseScheduleRules = (value: unknown): CourseScheduleRulesPayload | null => {
  if (!value || typeof value !== "object") return null
  const source = value as Record<string, unknown>
  const rulesInput = Array.isArray(source.rules) ? source.rules : []
  const grouped = new Map<number, Set<string>>()

  for (const rule of rulesInput) {
    if (!rule || typeof rule !== "object") continue
    const candidate = rule as Record<string, unknown>
    const weekday =
      typeof candidate.weekday === "number" && Number.isInteger(candidate.weekday) && candidate.weekday >= 0 && candidate.weekday <= 6
        ? candidate.weekday
        : null
    if (weekday === null) continue
    const times = Array.isArray(candidate.times)
      ? candidate.times.map((time) => normalizeClockTime(String(time))).filter(Boolean)
      : []
    if (times.length === 0) continue
    if (!grouped.has(weekday)) grouped.set(weekday, new Set<string>())
    const bucket = grouped.get(weekday)!
    times.forEach((time) => bucket.add(time))
  }

  const rules = [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekday, times]) => ({
      weekday,
      times: [...times].sort(),
    }))

  const specialEventsInput = Array.isArray(source.specialEvents) ? source.specialEvents : []
  const specialEventsMap = new Map<string, Set<string>>()
  for (const item of specialEventsInput) {
    if (!item || typeof item !== "object") continue
    const candidate = item as Record<string, unknown>
    const date = typeof candidate.date === "string" && ISO_DATE_REGEX.test(candidate.date.trim()) ? candidate.date.trim() : ""
    if (!date) continue
    const times = Array.isArray(candidate.times)
      ? candidate.times.map((time) => normalizeClockTime(String(time))).filter(Boolean)
      : []
    if (times.length === 0) continue
    if (!specialEventsMap.has(date)) specialEventsMap.set(date, new Set<string>())
    const bucket = specialEventsMap.get(date)!
    times.forEach((time) => bucket.add(time))
  }
  const specialEvents = [...specialEventsMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, times]) => ({
      date,
      times: [...times].sort(),
      label: "Special event",
    }))

  if (rules.length === 0 && specialEvents.length === 0) return null

  const target = Number(source.weeklyDaysTarget)
  const weeklyDaysTarget = Number.isFinite(target) ? Math.max(1, Math.min(7, Math.round(target))) : Math.max(1, Math.min(7, rules.length))
  const repeatAllMonth = typeof source.repeatAllMonth === "boolean" ? source.repeatAllMonth : true
  const recurrenceMode = source.recurrenceMode === "until_date" ? "until_date" : "indefinite"
  const recurrenceEndsAt = recurrenceMode === "until_date" && typeof source.recurrenceEndsAt === "string" ? source.recurrenceEndsAt : null
  const modeSource = source.mode === "special_event" ? "special_event" : source.mode === "regular" ? "regular" : null
  const mode: "regular" | "special_event" = modeSource || (specialEvents.length > 0 && rules.length === 0 ? "special_event" : "regular")

  return {
    mode,
    weeklyDaysTarget,
    repeatAllMonth,
    recurrenceMode,
    recurrenceEndsAt,
    rules,
    specialEvents,
  }
}

const buildSlotsFromScheduleRules = (payload: CourseScheduleRulesPayload) => {
  const slots: CourseScheduleSlot[] = []
  for (const rule of payload.rules) {
    for (const time of rule.times) {
      const normalized = normalizeClockTime(time)
      if (!normalized) continue
      slots.push({ weekday: rule.weekday, recurring: true, time: normalized })
    }
  }
  for (const event of payload.specialEvents) {
    for (const time of event.times) {
      const normalized = normalizeClockTime(time)
      if (!normalized) continue
      slots.push({ date: event.date, time: normalized })
    }
  }
  return slots.sort(compareCourseSlots)
}

const deriveRulesFromScheduleSlots = (slots: CourseScheduleSlot[]): CourseScheduleRuleEntry[] => {
  const grouped = new Map<number, Set<string>>()
  for (const slot of slots) {
    if (typeof slot.weekday !== "number") continue
    const normalized = normalizeClockTime(slot.time)
    if (!normalized) continue
    if (!grouped.has(slot.weekday)) grouped.set(slot.weekday, new Set<string>())
    grouped.get(slot.weekday)!.add(normalized)
  }
  return [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekday, times]) => ({
      weekday,
      times: [...times].sort(),
    }))
}

const deriveSpecialEventsFromScheduleSlots = (slots: CourseScheduleSlot[]): CourseSpecialEventEntry[] => {
  const grouped = new Map<string, Set<string>>()
  for (const slot of slots) {
    if (!slot.date || !ISO_DATE_REGEX.test(slot.date)) continue
    const normalized = normalizeClockTime(slot.time)
    if (!normalized) continue
    if (!grouped.has(slot.date)) grouped.set(slot.date, new Set<string>())
    grouped.get(slot.date)!.add(normalized)
  }
  return [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, times]) => ({
      date,
      times: [...times].sort(),
      label: "Special event",
    }))
}

const formatIsoDate = (value: string | null) => {
  if (!value) return "—"
  const time = Date.parse(value)
  if (Number.isNaN(time)) return "—"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(time))
}

const formatMoney = (amount: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format((amount || 0) / 100)

const centsToUsdInput = (cents: number | null | undefined) => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return ""
  const value = (cents / 100).toFixed(2)
  return value.endsWith(".00") ? value.slice(0, -3) : value
}

const usdInputToCents = (value: string) => {
  const clean = value.trim().replace(",", ".")
  if (!clean) return null
  const parsed = Number(clean)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

const formatUsdInputLabel = (value: string) => {
  const parsed = Number(value.trim().replace(",", "."))
  if (!Number.isFinite(parsed) || parsed < 0) return "—"
  return `$${parsed.toFixed(2)}`
}

const formatMinutesLabel = (minutes: number) => {
  if (minutes <= 0) return "On time"
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  if (hours <= 0) return `${restMinutes}m`
  if (restMinutes <= 0) return `${hours}h`
  return `${hours}h ${restMinutes}m`
}

const getInitials = (firstName: string, lastName: string, email: string) => {
  const a = firstName?.trim()?.[0] || ""
  const b = lastName?.trim()?.[0] || ""
  const initials = `${a}${b}`.toUpperCase()
  if (initials) return initials
  return (email?.trim()?.[0] || "S").toUpperCase()
}

const getStatusTone = (row: StaffUserRow) => {
  if (row.banned) return "text-red-300 border-red-500/40 bg-red-500/10"
  if (row.locked) return "text-amber-300 border-amber-500/40 bg-amber-500/10"
  if (row.online) return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
  return "text-zinc-300 border-zinc-500/40 bg-zinc-500/10"
}

const monthKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`

const toDateKey = (year: number, monthIndex: number, day: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`

const buildCalendar = (year: number, monthIndex: number) => {
  const firstDay = new Date(year, monthIndex, 1)
  const offset = firstDay.getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate()

  const cells: Array<{ day: number; dateKey: string; inMonth: boolean }> = []

  for (let i = offset - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    const prevMonth = monthIndex === 0 ? 11 : monthIndex - 1
    const prevYear = monthIndex === 0 ? year - 1 : year
    cells.push({ day, dateKey: toDateKey(prevYear, prevMonth, day), inMonth: false })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, dateKey: toDateKey(year, monthIndex, day), inMonth: true })
  }

  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - (offset + daysInMonth) + 1
    const nextMonth = monthIndex === 11 ? 0 : monthIndex + 1
    const nextYear = monthIndex === 11 ? year + 1 : year
    cells.push({ day: nextDay, dateKey: toDateKey(nextYear, nextMonth, nextDay), inMonth: false })
  }

  return cells
}

const startOfDay = (value: Date) => {
  const out = new Date(value)
  out.setHours(0, 0, 0, 0)
  return out
}

const previousWeekday = (base: Date, weekday: number) => {
  const out = startOfDay(base)
  const diff = (out.getDay() - weekday + 7) % 7
  out.setDate(out.getDate() - diff)
  return out
}

const MIN_LOADING_DELAY_MS = 3000
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type StaffUsersAdminClientProps = {
  currentRole: StaffRole
  currentUserId: string
}

export default function StaffUsersAdminClient({ currentRole, currentUserId }: StaffUsersAdminClientProps) {
  const searchParams = useSearchParams()
  const stickyTop = 0
  const gridRef = React.useRef<HTMLDivElement>(null)
  const leftRailRef = React.useRef<HTMLDivElement>(null)
  const rightRailRef = React.useRef<HTMLDivElement>(null)

  const [rows, setRows] = React.useState<StaffUserRow[]>([])
  const [nowTs, setNowTs] = React.useState(() => Date.now())
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  const [busyUserId, setBusyUserId] = React.useState<string | null>(null)
  const [activeNav, setActiveNav] = React.useState("users")
  const [categoryFilter, setCategoryFilter] = React.useState<StaffCategory | "all">("all")

  const [email, setEmail] = React.useState("")
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [newRole, setNewRole] = React.useState<StaffRole>("staff")
  const [newCategory, setNewCategory] = React.useState<StaffCategory>("guest_staff")
  const [createBusy, setCreateBusy] = React.useState(false)
  const [createMessage, setCreateMessage] = React.useState<string | null>(null)
  const [pinStaffUserId, setPinStaffUserId] = React.useState("")
  const [pinCode, setPinCode] = React.useState("")
  const [pinBusy, setPinBusy] = React.useState(false)
  const [pinMessage, setPinMessage] = React.useState<string | null>(null)
  const [pinError, setPinError] = React.useState<string | null>(null)

  const [scheduleMonth, setScheduleMonth] = React.useState(() => new Date())
  const [scheduleLoading, setScheduleLoading] = React.useState(false)
  const [scheduleEventsByDay, setScheduleEventsByDay] = React.useState<Record<string, ScheduleEvent[]>>({})

  const [payments, setPayments] = React.useState<PaymentRow[]>([])
  const [paymentsSummary, setPaymentsSummary] = React.useState<PaymentSummary>({
    totalItems: 0,
    totalCollected: 0,
    pendingSettlement: 0,
    paidSettlement: 0,
  })
  const [paymentsLoading, setPaymentsLoading] = React.useState(false)
  const [paymentsFilter, setPaymentsFilter] = React.useState<"all" | "pending" | "paid">("all")
  const [paymentBusyId, setPaymentBusyId] = React.useState<string | null>(null)

  const [staffRequests, setStaffRequests] = React.useState<StaffRequestRow[]>([])
  const [requestsSummary, setRequestsSummary] = React.useState<StaffRequestSummary>({
    total: 0,
    pending: 0,
    inReview: 0,
    approved: 0,
    rejected: 0,
  })
  const [requestsLoading, setRequestsLoading] = React.useState(false)
  const [requestStatusFilter, setRequestStatusFilter] = React.useState<StaffRequestStatus | "all">("PENDING")
  const [requestBusyId, setRequestBusyId] = React.useState<string | null>(null)

  const [profileModalOpen, setProfileModalOpen] = React.useState(false)
  const [profileTarget, setProfileTarget] = React.useState<StaffUserRow | null>(null)
  const [profileLoading, setProfileLoading] = React.useState(false)
  const [profileSaving, setProfileSaving] = React.useState(false)
  const [profileError, setProfileError] = React.useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = React.useState<string | null>(null)
  const [profileHasPin, setProfileHasPin] = React.useState(false)
  const [profileCanEditRole, setProfileCanEditRole] = React.useState(false)
  const [profileAvatarUploading, setProfileAvatarUploading] = React.useState(false)
  const [profileAvatarError, setProfileAvatarError] = React.useState<string | null>(null)
  const [profileGalleryUploading, setProfileGalleryUploading] = React.useState(false)
  const [presenceMenuUserId, setPresenceMenuUserId] = React.useState<string | null>(null)
  const [delayModal, setDelayModal] = React.useState<PayrollDelayModalState | null>(null)
  const [teacherUserId, setTeacherUserId] = React.useState("")
  const [teacherReviewCycleDays, setTeacherReviewCycleDays] = React.useState(30)
  const [teacherAssignedUserId, setTeacherAssignedUserId] = React.useState("")
  const [teacherRecurrenceUnit, setTeacherRecurrenceUnit] = React.useState<"month" | "year">("month")
  const [teacherRecurrenceInterval, setTeacherRecurrenceInterval] = React.useState(1)
  const [teacherCourseSlugs, setTeacherCourseSlugs] = React.useState<string[]>([])
  const [teacherSaving, setTeacherSaving] = React.useState(false)
  const [teacherSuccess, setTeacherSuccess] = React.useState<string | null>(null)
  const [teacherError, setTeacherError] = React.useState<string | null>(null)
  const [metricsView, setMetricsView] = React.useState<"current" | "previous_cycle">("current")
  const [metricsSaving, setMetricsSaving] = React.useState(false)
  const [metricsSuccess, setMetricsSuccess] = React.useState<string | null>(null)
  const [metricsError, setMetricsError] = React.useState<string | null>(null)
  const [schoolLoading, setSchoolLoading] = React.useState(false)
  const [schoolBusy, setSchoolBusy] = React.useState<null | "course" | "package" | "rule" | "assign">(null)
  const [schoolError, setSchoolError] = React.useState<string | null>(null)
  const [schoolSuccess, setSchoolSuccess] = React.useState<string | null>(null)
  const [schoolCourses, setSchoolCourses] = React.useState<SchoolCourseRow[]>([])
  const [schoolPackages, setSchoolPackages] = React.useState<SchoolPackageRow[]>([])
  const [schoolPointsRules, setSchoolPointsRules] = React.useState<PointsRuleRow[]>([])
  const [courseForm, setCourseForm] = React.useState<CourseFormState>({
    slug: "",
    title: "",
    kind: "course",
    category: "",
    description: "",
    previewImageUrl: "",
    previewVideoUrl: "",
    dropInPriceCents: "",
    firstClassPriceCents: "",
    level: "Beginner",
    durationMinutes: "55",
    location: "54 Coles St, Jersey City, NJ",
    availableTimesCsv: "",
    active: true,
  })
  const [courseWeekdays, setCourseWeekdays] = React.useState<number[]>([])
  const [courseScheduleDate, setCourseScheduleDate] = React.useState("")
  const [courseScheduleDates, setCourseScheduleDates] = React.useState<string[]>([])
  const [courseRecurringWeekdays, setCourseRecurringWeekdays] = React.useState<number[]>([])
  const [courseMirrorEnabled, setCourseMirrorEnabled] = React.useState(false)
  const [courseMirrorWeekdays, setCourseMirrorWeekdays] = React.useState<number[]>([])
  const [courseRepeatAllMonth, setCourseRepeatAllMonth] = React.useState(true)
  const [courseRecurrenceMode, setCourseRecurrenceMode] = React.useState<"indefinite" | "until_date">("indefinite")
  const [courseRecurrenceEndsAt, setCourseRecurrenceEndsAt] = React.useState("")
  const [courseScheduleTime, setCourseScheduleTime] = React.useState("10:00")
  const [courseScheduleSlots, setCourseScheduleSlots] = React.useState<CourseScheduleSlot[]>([])
  const [quickScheduleTimes, setQuickScheduleTimes] = React.useState<string[]>(DEFAULT_QUICK_SCHEDULE_TIMES)
  const [editingQuickTimeIndex, setEditingQuickTimeIndex] = React.useState<number | null>(null)
  const [quickTimeDraft, setQuickTimeDraft] = React.useState("")
  const [scheduleTimePickerOpen, setScheduleTimePickerOpen] = React.useState(false)
  const [courseLocalImagePreview, setCourseLocalImagePreview] = React.useState("")
  const [courseLocalVideoPreview, setCourseLocalVideoPreview] = React.useState("")
  const [courseLocalImageName, setCourseLocalImageName] = React.useState("")
  const [courseLocalVideoName, setCourseLocalVideoName] = React.useState("")
  const [courseHydratedFromQuery, setCourseHydratedFromQuery] = React.useState(false)
  const courseImageInputRef = React.useRef<HTMLInputElement>(null)
  const courseVideoInputRef = React.useRef<HTMLInputElement>(null)
  const scheduleTimePickerRef = React.useRef<HTMLDivElement>(null)
  const [packageForm, setPackageForm] = React.useState<PackageFormState>({
    key: "",
    courseSlug: "",
    label: "",
    description: "",
    priceCents: "",
    cadence: "",
    totalCredits: "",
    makeUps: "0",
    validDays: "180",
    isUnlimited: false,
    active: true,
  })
  const [pointsRuleForm, setPointsRuleForm] = React.useState<PointsRuleFormState>({
    templateKey: POINTS_RULE_DEFINITIONS[0]?.key || "profile-completed",
    points: "10",
    active: true,
  })
  const [pointsAssignForm, setPointsAssignForm] = React.useState<PointsAssignFormState>({
    userEmail: "",
    type: "MANUAL_STAFF_ASSIGNMENT",
    points: "10",
    note: "",
    eventKey: "",
  })
  const [profileForm, setProfileForm] = React.useState<StaffProfileForm>({
    firstName: "",
    lastName: "",
    role: "staff",
    category: "guest_staff",
    birthDate: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    personalNote: "",
    location: "",
    gallery: [],
    pin: "",
    clearPin: false,
  })

  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(SCHOOL_SCHEDULE_SHORTCUTS_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { quick?: unknown }
      if (Array.isArray(parsed.quick)) {
        const nextQuick = parsed.quick
          .map((item) => normalizeClockTime(String(item)))
          .filter((item): item is string => Boolean(item))
        if (nextQuick.length > 0) setQuickScheduleTimes([...nextQuick].sort((a, b) => a.localeCompare(b)))
      }
    } catch {
      // ignore corrupted local storage
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(
        SCHOOL_SCHEDULE_SHORTCUTS_STORAGE_KEY,
        JSON.stringify({
          quick: quickScheduleTimes,
        })
      )
    } catch {
      // ignore storage write failures
    }
  }, [quickScheduleTimes])

  const isStudentsView = activeNav === "students"
  const isSchoolView = activeNav === "schedule"
  const isSpecialEventCourse = SPECIAL_EVENT_COURSE_KINDS.has(courseForm.kind)
  const showStaffOps = !isStudentsView && !isSchoolView
  const assignableRoles = React.useMemo<StaffRole[]>(() => {
    return currentRole === "owner" ? ["owner", "admin", "staff"] : ["admin", "staff"]
  }, [currentRole])
  const canManageTarget = React.useCallback(
    (target: StaffUserRow) => {
      if (currentRole === "owner") return true
      if (target.role === "owner") return false
      return true
    },
    [currentRole]
  )
  const ensureMinimumLoadingTime = React.useCallback(async (startedAt: number) => {
    const elapsed = Date.now() - startedAt
    if (elapsed < MIN_LOADING_DELAY_MS) {
      await wait(MIN_LOADING_DELAY_MS - elapsed)
    }
  }, [])

  const handleStaffAuthFailure = React.useCallback((status: number) => {
    if (typeof window === "undefined") return false
    if (status === 401) {
      setError("Staff session expired. Please sign in again.")
      window.location.href = "/staff/sign-in?next=/staff/portal"
      return true
    }
    if (status === 403) {
      setError("Insufficient staff permissions. Resolving access...")
      window.location.href = "/staff/resolve"
      return true
    }
    return false
  }, [])

  const fetchRows = React.useCallback(async (
    search?: string,
    category?: StaffCategory | "all",
    options?: { showLoader?: boolean; enforceMinDelay?: boolean }
  ) => {
    const showLoader = options?.showLoader ?? true
    const enforceMinDelay = options?.enforceMinDelay ?? showLoader
    const startedAt = Date.now()
    if (showLoader) setLoading(true)
    setError(null)
    try {
      const url = new URL("/api/staff/users", window.location.origin)
      if (search?.trim()) url.searchParams.set("q", search.trim())
      if (category && category !== "all") url.searchParams.set("category", category)
      const res = await fetch(url.toString(), { headers: { "Content-Type": "application/json" } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setError(typeof data?.error === "string" ? data.error : "Failed to load staff users")
        if (showLoader) setRows([])
        return
      }
      setRows(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setError("Network error while loading staff users")
      if (showLoader) setRows([])
    } finally {
      if (enforceMinDelay) await ensureMinimumLoadingTime(startedAt)
      if (showLoader) setLoading(false)
    }
  }, [ensureMinimumLoadingTime, handleStaffAuthFailure])

  const fetchSchedule = React.useCallback(async (month: Date) => {
    const startedAt = Date.now()
    setScheduleLoading(true)
    try {
      const url = new URL("/api/staff/schedule", window.location.origin)
      url.searchParams.set("month", monthKey(month))
      const res = await fetch(url.toString(), { headers: { "Content-Type": "application/json" } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        return
      }
      setScheduleEventsByDay((data?.eventsByDay as Record<string, ScheduleEvent[]>) || {})
    } catch {
      setScheduleEventsByDay({})
    } finally {
      await ensureMinimumLoadingTime(startedAt)
      setScheduleLoading(false)
    }
  }, [ensureMinimumLoadingTime, handleStaffAuthFailure])

  const fetchPayments = React.useCallback(async (settlementFilter: "all" | "pending" | "paid" = "all") => {
    const startedAt = Date.now()
    setPaymentsLoading(true)
    try {
      const url = new URL("/api/staff/payments", window.location.origin)
      if (settlementFilter !== "all") {
        url.searchParams.set("settlement", settlementFilter)
      }
      const res = await fetch(url.toString(), { headers: { "Content-Type": "application/json" } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setError(typeof data?.error === "string" ? data.error : "Failed to load payments")
        setPayments([])
        return
      }
      setPayments(Array.isArray(data?.items) ? data.items : [])
      setPaymentsSummary(
        data?.summary || {
          totalItems: 0,
          totalCollected: 0,
          pendingSettlement: 0,
          paidSettlement: 0,
        }
      )
    } catch {
      setError("Network error while loading payments")
      setPayments([])
    } finally {
      await ensureMinimumLoadingTime(startedAt)
      setPaymentsLoading(false)
    }
  }, [ensureMinimumLoadingTime, handleStaffAuthFailure])

  const fetchStaffRequests = React.useCallback(async (status: StaffRequestStatus | "all" = "PENDING") => {
    const startedAt = Date.now()
    setRequestsLoading(true)
    try {
      const url = new URL("/api/staff/requests", window.location.origin)
      if (status !== "all") {
        url.searchParams.set("status", status)
      }
      const res = await fetch(url.toString(), { headers: { "Content-Type": "application/json" } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setError(typeof data?.error === "string" ? data.error : "Failed to load staff requests")
        setStaffRequests([])
        return
      }
      setStaffRequests(Array.isArray(data?.items) ? data.items : [])
      setRequestsSummary(
        data?.summary || {
          total: 0,
          pending: 0,
          inReview: 0,
          approved: 0,
          rejected: 0,
        }
      )
    } catch {
      setError("Network error while loading staff requests")
      setStaffRequests([])
    } finally {
      await ensureMinimumLoadingTime(startedAt)
      setRequestsLoading(false)
    }
  }, [ensureMinimumLoadingTime, handleStaffAuthFailure])

  const fetchSchoolData = React.useCallback(async (options?: { showLoader?: boolean }) => {
    const showLoader = options?.showLoader ?? true
    const startedAt = Date.now()
    if (showLoader) setSchoolLoading(true)
    setSchoolError(null)
    try {
      const [coursesRes, packagesRes, rulesRes] = await Promise.all([
        fetch("/api/staff/school/courses", { headers: { "Content-Type": "application/json" } }),
        fetch("/api/staff/school/packages", { headers: { "Content-Type": "application/json" } }),
        fetch("/api/staff/school/points-rules", { headers: { "Content-Type": "application/json" } }),
      ])
      const [coursesData, packagesData, rulesData] = await Promise.all([
        coursesRes.json().catch(() => ({})),
        packagesRes.json().catch(() => ({})),
        rulesRes.json().catch(() => ({})),
      ])
      if (!coursesRes.ok || !packagesRes.ok || !rulesRes.ok) {
        const authStatuses = [coursesRes.status, packagesRes.status, rulesRes.status]
        if (authStatuses.some((status) => status === 401) && authStatuses.some((status) => handleStaffAuthFailure(status))) {
          return
        }
        const nextError =
          (typeof coursesData?.error === "string" && coursesData.error) ||
          (typeof packagesData?.error === "string" && packagesData.error) ||
          (typeof rulesData?.error === "string" && rulesData.error) ||
          "Failed to load school catalog."
        setSchoolError(nextError)
        return
      }
      setSchoolCourses(Array.isArray(coursesData?.items) ? coursesData.items : [])
      setSchoolPackages(Array.isArray(packagesData?.items) ? packagesData.items : [])
      setSchoolPointsRules(Array.isArray(rulesData?.items) ? rulesData.items : [])
    } catch {
      setSchoolError("Network error while loading school catalog.")
    } finally {
      if (showLoader) {
        await ensureMinimumLoadingTime(startedAt)
        setSchoolLoading(false)
      }
    }
  }, [ensureMinimumLoadingTime, handleStaffAuthFailure])

  const saveCourseCatalog = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setSchoolError(null)
    setSchoolSuccess(null)
    setSchoolBusy("course")
    try {
      const derivedSchedule = deriveCourseScheduleData(courseScheduleSlots)
      const derivedRules = deriveRulesFromScheduleSlots(courseScheduleSlots)
      const derivedSpecialEvents = deriveSpecialEventsFromScheduleSlots(courseScheduleSlots)
      const fallbackTimes = courseForm.availableTimesCsv
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
      const times = derivedSchedule.times.length > 0 ? derivedSchedule.times : fallbackTimes
      const weekdays = derivedSchedule.weekdays.length > 0 ? derivedSchedule.weekdays : courseWeekdays
      const scheduleRulesPayload: CourseScheduleRulesPayload | null = (() => {
        const rules =
          isSpecialEventCourse
            ? []
            : derivedRules.length > 0
            ? derivedRules
            : weekdays.length > 0 && times.length > 0
              ? weekdays.map((weekday) => ({ weekday, times }))
              : []
        const specialEvents = derivedSpecialEvents
        if (rules.length === 0 && specialEvents.length === 0) return null
        const derivedWeeklyTarget = [...new Set(rules.map((rule) => rule.weekday))].length
        return {
          mode: isSpecialEventCourse ? "special_event" : "regular",
          weeklyDaysTarget: Math.max(1, Math.min(7, derivedWeeklyTarget || courseRecurringWeekdays.length || 1)),
          repeatAllMonth: courseRepeatAllMonth,
          recurrenceMode: courseRecurrenceMode,
          recurrenceEndsAt:
            courseRecurrenceMode === "until_date" && courseRecurrenceEndsAt.trim() ? courseRecurrenceEndsAt.trim() : null,
          rules,
          specialEvents,
        }
      })()
      const res = await fetch("/api/staff/school/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: courseForm.slug,
          title: courseForm.title,
          kind: courseForm.kind,
          category: courseForm.category,
          description: courseForm.description,
          coverImageUrl: courseForm.previewImageUrl,
          previewVideoUrl: courseForm.previewVideoUrl,
          dropInPriceCents: usdInputToCents(courseForm.dropInPriceCents),
          firstClassPriceCents: usdInputToCents(courseForm.firstClassPriceCents),
          level: courseForm.level,
          durationMinutes: courseForm.durationMinutes,
          location: courseForm.location,
          availableWeekdays: weekdays,
          availableTimes: times,
          scheduleRules: scheduleRulesPayload,
          active: courseForm.active,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSchoolError(typeof data?.error === "string" ? data.error : "Unable to save course.")
        return
      }
      setSchoolSuccess(typeof data?.message === "string" ? data.message : "Course saved.")
      await fetchSchoolData({ showLoader: false })
      setCourseForm((prev) => ({
        ...prev,
        slug: "",
        title: "",
        description: "",
        previewImageUrl: "",
        previewVideoUrl: "",
        dropInPriceCents: "",
        firstClassPriceCents: "",
        availableTimesCsv: "",
      }))
      setCourseWeekdays([])
      setCourseScheduleDate("")
      setCourseScheduleDates([])
      setCourseRecurringWeekdays([])
      setCourseMirrorEnabled(false)
      setCourseMirrorWeekdays([])
      setCourseRepeatAllMonth(true)
      setCourseRecurrenceMode("indefinite")
      setCourseRecurrenceEndsAt("")
      setCourseScheduleSlots([])
      setEditingQuickTimeIndex(null)
      setQuickTimeDraft("")
      setScheduleTimePickerOpen(false)
      setCourseHydratedFromQuery(false)
      setCourseLocalImagePreview((prev) => {
        if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
        return ""
      })
      setCourseLocalVideoPreview((prev) => {
        if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
        return ""
      })
      setCourseLocalImageName("")
      setCourseLocalVideoName("")
    } catch {
      setSchoolError("Network error while saving course.")
    } finally {
      setSchoolBusy(null)
    }
  }, [
    courseForm,
    courseRecurrenceEndsAt,
    courseRecurrenceMode,
    courseRecurringWeekdays,
    courseRepeatAllMonth,
    courseScheduleSlots,
    courseWeekdays,
    fetchSchoolData,
    isSpecialEventCourse,
  ])

  const savePackagePlan = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setSchoolError(null)
    setSchoolSuccess(null)
    setSchoolBusy("package")
    try {
      const res = await fetch("/api/staff/school/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: packageForm.key,
          courseSlug: packageForm.courseSlug,
          label: packageForm.label,
          description: packageForm.description,
          priceCents: packageForm.priceCents,
          cadence: packageForm.cadence,
          totalCredits: packageForm.totalCredits,
          makeUps: packageForm.makeUps,
          validDays: packageForm.validDays,
          isUnlimited: packageForm.isUnlimited,
          active: packageForm.active,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSchoolError(typeof data?.error === "string" ? data.error : "Unable to save package.")
        return
      }
      setSchoolSuccess(typeof data?.message === "string" ? data.message : "Package saved.")
      await fetchSchoolData({ showLoader: false })
      setPackageForm((prev) => ({ ...prev, key: "", label: "", description: "" }))
    } catch {
      setSchoolError("Network error while saving package.")
    } finally {
      setSchoolBusy(null)
    }
  }, [fetchSchoolData, packageForm])

  const savePointsRule = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setSchoolError(null)
    setSchoolSuccess(null)
    setSchoolBusy("rule")
    try {
      const template = POINTS_RULE_DEFINITIONS.find((item) => item.key === pointsRuleForm.templateKey)
      if (!template) {
        setSchoolError("Invalid points rule template.")
        return
      }
      const res = await fetch("/api/staff/school/points-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: template.key,
          label: template.label,
          eventType: template.eventType,
          points: pointsRuleForm.points,
          description: template.description,
          active: pointsRuleForm.active,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSchoolError(typeof data?.error === "string" ? data.error : "Unable to save points rule.")
        return
      }
      setSchoolSuccess(typeof data?.message === "string" ? data.message : "Points rule saved.")
      await fetchSchoolData({ showLoader: false })
    } catch {
      setSchoolError("Network error while saving points rule.")
    } finally {
      setSchoolBusy(null)
    }
  }, [fetchSchoolData, pointsRuleForm])

  const assignPointsManually = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setSchoolError(null)
    setSchoolSuccess(null)
    setSchoolBusy("assign")
    try {
      const res = await fetch("/api/staff/school/points-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: pointsAssignForm.userEmail,
          points: pointsAssignForm.points,
          type: pointsAssignForm.type,
          note: pointsAssignForm.note,
          eventKey: pointsAssignForm.eventKey,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSchoolError(typeof data?.error === "string" ? data.error : "Unable to assign points.")
        return
      }
      setSchoolSuccess(typeof data?.message === "string" ? data.message : "Points assigned.")
      setPointsAssignForm((prev) => ({ ...prev, points: "10", note: "", eventKey: "" }))
    } catch {
      setSchoolError("Network error while assigning points.")
    } finally {
      setSchoolBusy(null)
    }
  }, [pointsAssignForm])

  const openProfileModal = React.useCallback(async (row: StaffUserRow) => {
    const startedAt = Date.now()
    setProfileModalOpen(true)
    setProfileTarget(row)
    setProfileLoading(true)
    setProfileError(null)
    setProfileSuccess(null)
    setProfileCanEditRole(false)
    try {
      const res = await fetch(`/api/staff/users/${row.id}/profile`, {
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setProfileError(typeof data?.error === "string" ? data.error : "Failed to load staff profile")
        return
      }
      const user = data?.user || {}
      const profile = user.profile || {}
      const profileImageUrl = typeof user.imageUrl === "string" ? user.imageUrl : row.avatarUrl || ""
      const profileGallery = Array.isArray(profile.gallery)
        ? profile.gallery.filter((item: unknown): item is string => typeof item === "string")
        : []
      setProfileCanEditRole(Boolean(data?.canEditRole))
      setProfileHasPin(Boolean(user.hasPin))
      setProfileAvatarError(null)
      setProfileTarget((prev) => (prev ? { ...prev, avatarUrl: profileImageUrl } : prev))
      const resolvedRole: StaffRole =
        user?.role === "owner" || user?.role === "admin" || user?.role === "staff" ? user.role : row.role
      const resolvedCategory: StaffCategory =
        user?.category === "front_desk" ||
        user?.category === "manager" ||
        user?.category === "teacher" ||
        user?.category === "guest_staff" ||
        user?.category === "partner"
          ? user.category
          : row.category

      setProfileForm({
        firstName: typeof user.firstName === "string" ? user.firstName : row.firstName || "",
        lastName: typeof user.lastName === "string" ? user.lastName : row.lastName || "",
        role: resolvedRole,
        category: normalizeCategoryForRole(resolvedRole, resolvedCategory),
        birthDate: typeof profile.birthDate === "string" ? profile.birthDate : "",
        addressLine1: typeof profile.addressLine1 === "string" ? profile.addressLine1 : "",
        addressLine2: typeof profile.addressLine2 === "string" ? profile.addressLine2 : "",
        city: typeof profile.city === "string" ? profile.city : "",
        state: typeof profile.state === "string" ? profile.state : "",
        postalCode: typeof profile.postalCode === "string" ? profile.postalCode : "",
        country: typeof profile.country === "string" ? profile.country : "",
        personalNote: typeof profile.personalNote === "string" ? profile.personalNote : "",
        location: typeof profile.location === "string" ? profile.location : row.location || "",
        gallery: profileGallery.slice(0, 6),
        pin: "",
        clearPin: false,
      })
    } catch {
      setProfileError("Network error while loading staff profile")
    } finally {
      await ensureMinimumLoadingTime(startedAt)
      setProfileLoading(false)
    }
  }, [ensureMinimumLoadingTime])

  React.useEffect(() => {
    fetchRows(undefined, categoryFilter)
  }, [fetchRows, categoryFilter])

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchRows(query, categoryFilter, { showLoader: false, enforceMinDelay: false })
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [fetchRows, query, categoryFilter])

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setNowTs(Date.now())
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  React.useEffect(() => {
    if (!presenceMenuUserId) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest("[data-presence-menu]")) return
      setPresenceMenuUserId(null)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [presenceMenuUserId])

  const selectedPinStaff = React.useMemo(
    () => rows.find((row) => row.id === pinStaffUserId) || null,
    [rows, pinStaffUserId]
  )

  React.useEffect(() => {
    if (rows.length === 0) {
      setPinStaffUserId("")
      return
    }
    const stillExists = rows.some((row) => row.id === pinStaffUserId)
    if (stillExists) return
    const firstWithPin = rows.find((row) => row.hasPin)
    setPinStaffUserId((firstWithPin || rows[0]).id)
  }, [rows, pinStaffUserId])

  React.useEffect(() => {
    fetchSchedule(scheduleMonth)
  }, [fetchSchedule, scheduleMonth])

  React.useEffect(() => {
    fetchPayments(paymentsFilter)
  }, [fetchPayments, paymentsFilter])

  React.useEffect(() => {
    fetchStaffRequests(requestStatusFilter)
  }, [fetchStaffRequests, requestStatusFilter])

  React.useEffect(() => {
    if (!isSchoolView) return
    void fetchSchoolData({ showLoader: true })
  }, [fetchSchoolData, isSchoolView])

  React.useEffect(() => {
    const nav = searchParams.get("nav")
    if (!nav) return
    if (!NAV_ITEMS.some((item) => item.key === nav)) return
    setActiveNav(nav)
  }, [searchParams])

  React.useEffect(() => {
    const selectedSlug = searchParams.get("course")
    if (!selectedSlug) {
      setCourseHydratedFromQuery(false)
      return
    }
    if (!isSchoolView || courseHydratedFromQuery || schoolCourses.length === 0) return
    const selected = schoolCourses.find((item) => item.slug === selectedSlug)
    if (!selected) return
    const parsedRules = normalizeCourseScheduleRules(selected.scheduleRules)
    const scheduleSlotsFromRules = parsedRules ? buildSlotsFromScheduleRules(parsedRules) : []
    const defaultWeekdays = parsedRules
      ? [...new Set(parsedRules.rules.map((rule) => rule.weekday))].sort((a, b) => a - b)
      : selected.availableWeekdays
    const defaultTimes = parsedRules
      ? [...new Set(parsedRules.rules.flatMap((rule) => rule.times).map((time) => normalizeClockTime(time)).filter(Boolean))].sort()
      : selected.availableTimes.map((time) => normalizeClockTime(time)).filter(Boolean)
    setCourseForm((prev) => ({
      ...prev,
      slug: selected.slug,
      title: selected.title,
      kind: selected.kind,
      category: selected.category || "",
      description: selected.description || "",
      previewImageUrl: selected.coverImageUrl || "",
      previewVideoUrl: selected.previewVideoUrl || "",
      dropInPriceCents: centsToUsdInput(selected.dropInPriceCents),
      firstClassPriceCents: centsToUsdInput(selected.firstClassPriceCents),
      level: selected.level || "",
      durationMinutes: selected.durationMinutes?.toString() || "",
      location: selected.location || "",
      availableTimesCsv: selected.availableTimes.join(","),
      active: selected.active,
    }))
    setCourseWeekdays(defaultWeekdays)
    setCourseRecurringWeekdays(defaultWeekdays)
    setCourseScheduleSlots(scheduleSlotsFromRules)
    setCourseRepeatAllMonth(parsedRules?.repeatAllMonth ?? true)
    setCourseRecurrenceMode(parsedRules?.recurrenceMode || "indefinite")
    setCourseRecurrenceEndsAt(parsedRules?.recurrenceEndsAt || "")
    setCourseMirrorEnabled(false)
    setCourseMirrorWeekdays([])
    setQuickScheduleTimes((prev) => {
      const merged = [...new Set([...defaultTimes, ...prev])].sort((a, b) => a.localeCompare(b))
      return merged.slice(0, Math.max(prev.length, DEFAULT_QUICK_SCHEDULE_TIMES.length))
    })
    setEditingQuickTimeIndex(null)
    setQuickTimeDraft("")
    setScheduleTimePickerOpen(false)
    setCourseHydratedFromQuery(true)
  }, [courseHydratedFromQuery, isSchoolView, schoolCourses, searchParams])

  React.useEffect(() => {
    if (packageForm.courseSlug) return
    const firstCourseSlug = schoolCourses[0]?.slug || demoCourses[0]?.slug || ""
    if (!firstCourseSlug) return
    setPackageForm((prev) => ({ ...prev, courseSlug: firstCourseSlug }))
  }, [packageForm.courseSlug, schoolCourses])

  React.useEffect(() => {
    return () => {
      if (courseLocalImagePreview.startsWith("blob:")) URL.revokeObjectURL(courseLocalImagePreview)
      if (courseLocalVideoPreview.startsWith("blob:")) URL.revokeObjectURL(courseLocalVideoPreview)
    }
  }, [courseLocalImagePreview, courseLocalVideoPreview])

  const scheduleDerivedData = React.useMemo(() => deriveCourseScheduleData(courseScheduleSlots), [courseScheduleSlots])
  const scheduleCalendarMap = React.useMemo(() => {
    const map = new Map<string, string[]>()
    const appendTime = (isoDate: string, rawTime: string) => {
      const normalized = normalizeClockTime(rawTime)
      if (!normalized) return
      const existing = map.get(isoDate) || []
      if (!existing.includes(normalized)) {
        const next = [...existing, normalized].sort()
        map.set(isoDate, next)
      }
    }

    const recurring = courseScheduleSlots.filter(
      (slot): slot is CourseScheduleSlot & { weekday: number } =>
        typeof slot.weekday === "number" && slot.weekday >= 0 && slot.weekday <= 6 && !!normalizeClockTime(slot.time)
    )
    const explicitDates = courseScheduleSlots.filter((slot) => typeof slot.date === "string" && !!slot.date)

    for (const slot of explicitDates) {
      appendTime(slot.date!, slot.time)
    }

    if (recurring.length > 0) {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      start.setMonth(start.getMonth() - 1)
      const end = new Date(start)
      end.setFullYear(end.getFullYear() + 2)

      for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
        const weekday = cursor.getDay()
        const isoDate = toLocalIsoDate(cursor)
        for (const slot of recurring) {
          if (slot.weekday !== weekday) continue
          appendTime(isoDate, slot.time)
        }
      }
    }

    return map
  }, [courseScheduleSlots])
  const getCourseScheduleDateTooltip = React.useCallback(
    (isoDate: string) => {
      const times = scheduleCalendarMap.get(isoDate)
      if (!times || times.length === 0) return undefined
      return `${courseForm.title || "Curso"} · ${times.map((time) => formatClockLabel(time)).join(", ")}`
    },
    [courseForm.title, scheduleCalendarMap]
  )
  const getCourseScheduleDateTone = React.useCallback(
    (isoDate: string) => {
      const times = scheduleCalendarMap.get(isoDate)
      if (!times || times.length === 0) return undefined
      return COURSE_KIND_DATE_TONE[courseForm.kind] || "course"
    },
    [courseForm.kind, scheduleCalendarMap]
  )

  const previewMediaUrl = courseLocalImagePreview || courseForm.previewImageUrl.trim()
  const selectedCourseKindLabel = COURSE_KIND_LABELS[courseForm.kind] || "Curso"
  const selectedCourseKindReviewLabel = `Review del ${selectedCourseKindLabel.toLowerCase()}`
  const courseReviewVariants = React.useMemo(
    () =>
      SCHOOL_COURSE_KINDS.map((kind) => ({
        kind,
        label: COURSE_KIND_LABELS[kind] || kind,
        hint: COURSE_KIND_REVIEW_HINTS[kind] || "",
        active: courseForm.kind === kind,
      })),
    [courseForm.kind]
  )
  const previewEditorHref = courseForm.slug.trim()
    ? `/staff/school/course/${courseForm.slug.trim()}`
    : "/staff/portal?nav=schedule"
  const previewPublicHref = courseForm.slug.trim() ? `/cursos/${courseForm.slug.trim()}` : ""

  const getCourseShareUrl = React.useCallback(() => {
    if (!previewPublicHref) return ""
    if (typeof window === "undefined") return previewPublicHref
    return `${window.location.origin}${previewPublicHref}`
  }, [previewPublicHref])

  const copyCourseLink = React.useCallback(async () => {
    const link = getCourseShareUrl()
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setSchoolSuccess("Link del curso copiado.")
      setSchoolError(null)
    } catch {
      setSchoolError("No se pudo copiar el link del curso.")
    }
  }, [getCourseShareUrl])

  const shareCourse = React.useCallback(
    (platform: "facebook" | "x" | "whatsapp" | "instagram" | "tiktok") => {
      const link = getCourseShareUrl()
      if (!link || typeof window === "undefined") return
      const encodedUrl = encodeURIComponent(link)
      const text = encodeURIComponent(`Mirá este curso: ${courseForm.title || "Nuevo curso PLI"}`)
      if (platform === "instagram" || platform === "tiktok") {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          void navigator.clipboard
            .writeText(link)
            .then(() => {
              setSchoolSuccess("Link copiado. Pegalo en la publicación de la red social.")
              setSchoolError(null)
            })
            .catch(() => {
              setSchoolError("No se pudo copiar el link del curso.")
            })
        }
        const socialHref = platform === "instagram" ? "https://www.instagram.com/" : "https://www.tiktok.com/"
        window.open(socialHref, "_blank", "noopener,noreferrer")
        return
      }
      const href =
        platform === "facebook"
          ? `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
          : platform === "x"
            ? `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`
            : `https://wa.me/?text=${text}%20${encodedUrl}`
      window.open(href, "_blank", "noopener,noreferrer")
    },
    [courseForm.title, getCourseShareUrl]
  )

  const addCourseScheduleSlot = React.useCallback(() => {
    const time = normalizeClockTime(courseScheduleTime)
    if (!time) return

    if (isSpecialEventCourse) {
      const dates = courseScheduleDates.length > 0 ? courseScheduleDates : []
      if (dates.length === 0) {
        setSchoolError("Seleccioná al menos una fecha en el calendario para conectar el horario del evento.")
        return
      }
      const blockedDate = dates.find((date) => getSpecialEventConflictReason(date, time))
      if (blockedDate) {
        setSchoolError(getSpecialEventConflictReason(blockedDate, time) || "Ese horario ya está ocupado.")
        return
      }
      setCourseScheduleSlots((prev) => {
        const next = [...prev]
        for (const date of dates) {
          const slot: CourseScheduleSlot = { date, time }
          const key = getCourseSlotKey(slot)
          if (next.some((item) => getCourseSlotKey(item) === key)) continue
          next.push(slot)
        }
        return next.sort(compareCourseSlots)
      })
      setCourseScheduleDate("")
      setCourseScheduleDates([])
      setCourseScheduleTime(normalizeClockTime(quickScheduleTimes[0] || "") || "10:00")
      setScheduleTimePickerOpen(false)
      setSchoolError(null)
      return
    }

    const recurringBase = [...new Set(courseRecurringWeekdays)].sort((a, b) => a - b)
    const mirrorWeekdays = courseMirrorEnabled
      ? courseMirrorWeekdays.filter((weekday) => !recurringBase.includes(weekday))
      : []
    const recurringWeekdays = [...new Set([...recurringBase, ...mirrorWeekdays])].sort((a, b) => a - b)
    if (recurringWeekdays.length === 0) return
    if (!quickScheduleTimes.includes(time) && typeof window !== "undefined") {
      const shouldAddShortcut = window.confirm("¿Querés agregar este horario a tus atajos?")
      if (shouldAddShortcut) {
        setQuickScheduleTimes((prev) => [...new Set([...prev, time])].sort((a, b) => a.localeCompare(b)))
      }
    }
    setCourseScheduleSlots((prev) => {
      const next = [...prev]
      for (const weekday of recurringWeekdays) {
        const candidate: CourseScheduleSlot = { weekday, recurring: true, time }
        const key = getCourseSlotKey(candidate)
        if (next.some((slot) => getCourseSlotKey(slot) === key)) continue
        next.push(candidate)
      }
      return next.sort(compareCourseSlots)
    })
    setCourseScheduleDate("")
    setCourseScheduleDates([])
    setCourseRecurringWeekdays([])
    setCourseMirrorEnabled(false)
    setCourseMirrorWeekdays([])
    setCourseScheduleTime(normalizeClockTime(quickScheduleTimes[0] || "") || "10:00")
    setScheduleTimePickerOpen(false)
  }, [
    courseMirrorEnabled,
    courseMirrorWeekdays,
    courseRecurringWeekdays,
    courseScheduleDates,
    courseScheduleTime,
    isSpecialEventCourse,
    quickScheduleTimes,
    setSchoolError,
    setScheduleTimePickerOpen,
  ])

  const removeCourseScheduleSlot = React.useCallback((slotKey: string) => {
    setCourseScheduleSlots((prev) => prev.filter((slot) => getCourseSlotKey(slot) !== slotKey))
  }, [])

  const toggleCourseRecurringWeekday = React.useCallback((weekday: number) => {
    setCourseRecurringWeekdays((prev) => {
      if (prev.includes(weekday)) return prev.filter((item) => item !== weekday)
      return [...prev, weekday].sort((a, b) => a - b)
    })
  }, [])

  const toggleCourseMirrorWeekday = React.useCallback((weekday: number) => {
    setCourseMirrorWeekdays((prev) => {
      if (prev.includes(weekday)) return prev.filter((item) => item !== weekday)
      return [...prev, weekday].sort((a, b) => a - b)
    })
  }, [])

  const handleCourseLocalImage = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) return
    const nextUrl = URL.createObjectURL(file)
    setCourseLocalImagePreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
      return nextUrl
    })
    setCourseLocalImageName(file.name)
  }, [])

  const handleCourseLocalVideo = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("video/")) return
    const nextUrl = URL.createObjectURL(file)
    setCourseLocalVideoPreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
      return nextUrl
    })
    setCourseLocalVideoName(file.name)
  }, [])

  const runAction = async (userId: string, action: string, payload?: Record<string, unknown>) => {
    setBusyUserId(userId)
    setError(null)
    try {
      const res = await fetch(`/api/staff/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Action failed")
        return
      }
      await fetchRows(query, categoryFilter)
    } catch {
      setError("Network error while updating staff user")
    } finally {
      setBusyUserId(null)
    }
  }

  const revokeStaff = async (userId: string) => {
    setBusyUserId(userId)
    setError(null)
    try {
      const res = await fetch(`/api/staff/users/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to remove staff access")
        return
      }
      await fetchRows(query, categoryFilter)
    } catch {
      setError("Network error while removing staff access")
    } finally {
      setBusyUserId(null)
    }
  }

  const updateSettlementStatus = async (purchaseId: string, action: "mark_paid" | "mark_pending") => {
    setPaymentBusyId(purchaseId)
    setError(null)
    try {
      const res = await fetch(`/api/staff/payments/${purchaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to update settlement")
        return
      }
      await fetchPayments(paymentsFilter)
    } catch {
      setError("Network error while updating settlement")
    } finally {
      setPaymentBusyId(null)
    }
  }

  const updateRequestStatus = async (requestId: string, status: StaffRequestStatus) => {
    setRequestBusyId(requestId)
    setError(null)
    try {
      const res = await fetch(`/api/staff/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to update request")
        return
      }
      await fetchStaffRequests(requestStatusFilter)
    } catch {
      setError("Network error while updating request")
    } finally {
      setRequestBusyId(null)
    }
  }

  const saveProfileModal = async () => {
    if (!profileTarget) return
    setProfileSaving(true)
    setProfileError(null)
    setProfileSuccess(null)
    try {
      const res = await fetch(`/api/staff/users/${profileTarget.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setProfileError(typeof data?.error === "string" ? data.error : "Unable to save profile")
        return
      }
      setProfileSuccess("Staff profile updated.")
      if (data?.user?.role === "owner" || data?.user?.role === "admin" || data?.user?.role === "staff") {
        setProfileForm((prev) => ({ ...prev, role: data.user.role }))
      }
      if (
        data?.user?.category === "front_desk" ||
        data?.user?.category === "manager" ||
        data?.user?.category === "teacher" ||
        data?.user?.category === "guest_staff" ||
        data?.user?.category === "partner"
      ) {
        setProfileForm((prev) => ({ ...prev, category: data.user.category }))
      }
      setProfileHasPin(Boolean(data?.user?.hasPin))
      setProfileForm((prev) => ({ ...prev, pin: "", clearPin: false }))
      await fetchRows(query, categoryFilter)
      closeProfileModal()
    } catch {
      setProfileError("Network error while saving profile")
    } finally {
      setProfileSaving(false)
    }
  }

  const uploadProfileAvatar = async (file: File) => {
    if (!profileTarget) return
    setProfileAvatarUploading(true)
    setProfileAvatarError(null)
    setProfileError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`/api/staff/users/${profileTarget.id}/avatar`, {
        method: "PATCH",
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setProfileAvatarError(typeof data?.error === "string" ? data.error : "Unable to upload avatar.")
        return
      }
      const nextImage = typeof data?.imageUrl === "string" ? data.imageUrl : ""
      if (nextImage) {
        setRows((prev) => prev.map((row) => (row.id === profileTarget.id ? { ...row, avatarUrl: nextImage } : row)))
        setProfileTarget((prev) => (prev ? { ...prev, avatarUrl: nextImage } : prev))
        setProfileSuccess("Avatar updated.")
      }
    } catch {
      setProfileAvatarError("Network error while uploading avatar.")
    } finally {
      setProfileAvatarUploading(false)
    }
  }

  const uploadProfileGalleryImages = async (files: FileList | File[]) => {
    if (!profileTarget) return
    const picked = Array.from(files)
    if (picked.length === 0) return
    setProfileGalleryUploading(true)
    setProfileError(null)
    try {
      for (const file of picked) {
        const formData = new FormData()
        formData.append("file", file)
        const res = await fetch(`/api/staff/users/${profileTarget.id}/gallery-upload`, {
          method: "POST",
          body: formData,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setProfileError(typeof data?.error === "string" ? data.error : "Unable to upload gallery image.")
          return
        }
        const nextUrl = typeof data?.url === "string" ? data.url : ""
        if (!nextUrl) continue
        setProfileForm((prev) => {
          if (prev.gallery.includes(nextUrl) || prev.gallery.length >= 6) return prev
          return { ...prev, gallery: [...prev.gallery, nextUrl] }
        })
      }
    } catch {
      setProfileError("Network error while uploading gallery images.")
    } finally {
      setProfileGalleryUploading(false)
    }
  }

  const closeProfileModal = () => {
    setProfileModalOpen(false)
    setProfileTarget(null)
    setProfileError(null)
    setProfileSuccess(null)
    setProfileCanEditRole(false)
    setProfileAvatarError(null)
    setProfileGalleryUploading(false)
  }

  const createStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreateMessage(null)
    setError(null)
    setCreateBusy(true)
    try {
      const res = await fetch("/api/staff/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          role: newRole,
          category: normalizeCategoryForRole(newRole, newCategory),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to create staff user")
        return
      }

      if (data?.mode === "invited") {
        setCreateMessage(`Invitation sent to ${data?.invitation?.emailAddress || email}`)
      } else {
        setCreateMessage("Existing user promoted to staff")
      }

      setEmail("")
      setFirstName("")
      setLastName("")
      setNewRole("staff")
      setNewCategory("guest_staff")
      await fetchRows(query, categoryFilter)
    } catch {
      setError("Network error while creating staff user")
    } finally {
      setCreateBusy(false)
    }
  }

  const verifyStaffPin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPinError(null)
    setPinMessage(null)
    if (!selectedPinStaff) {
      setPinError("Select staff user.")
      return
    }
    if (!selectedPinStaff.hasPin) {
      setPinError("Selected user does not have a PIN configured yet.")
      return
    }
    const safeEmail = selectedPinStaff.email.trim().toLowerCase()
    const safePin = pinCode.trim()
    if (!/^\d{4}$/.test(safePin)) {
      setPinError("PIN must be exactly 4 digits.")
      return
    }
    setPinBusy(true)
    try {
      const res = await fetch("/api/staff/checkin/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedPinStaff.id, pin: safePin }),
      })
      const data = await res.json().catch(() => ({} as Record<string, unknown>))
      if (!res.ok) {
        setPinError(typeof data?.error === "string" ? data.error : "Invalid PIN")
        return
      }
      const name =
        typeof data?.staff?.name === "string" && data.staff.name.trim()
          ? data.staff.name.trim()
          : `${selectedPinStaff.firstName} ${selectedPinStaff.lastName}`.trim() || safeEmail
      const checkedInAtMs =
        typeof data?.checkedInAt === "string" && Number.isFinite(Date.parse(data.checkedInAt))
          ? Date.parse(data.checkedInAt)
          : Date.now()
      setRows((prev) =>
        prev.map((row) =>
          row.id === selectedPinStaff.id
            ? {
                ...row,
                online: true,
                lastActiveAt: checkedInAtMs,
                lastSignInAt: checkedInAtMs,
                staffLastCheckInAt: checkedInAtMs,
              }
            : row
        )
      )
      setPinMessage(`Check-in registrado para ${name}. Abriendo panel...`)
      setPinCode("")
      const signInUrl = typeof data?.signInUrl === "string" ? data.signInUrl : ""
      if (signInUrl) {
        window.setTimeout(() => {
          window.location.assign(signInUrl)
        }, 450)
      }
    } catch {
      setPinError("Network error while verifying PIN")
    } finally {
      setPinBusy(false)
    }
  }

  const openPendingPayments = () => {
    setActiveNav("students")
    setPaymentsFilter("pending")
    requestAnimationFrame(() => {
      const el = document.getElementById("students-payments")
      el?.scrollIntoView({ block: "start", behavior: "smooth" })
    })
  }

  const calendarCells = React.useMemo(
    () => buildCalendar(scheduleMonth.getFullYear(), scheduleMonth.getMonth()),
    [scheduleMonth]
  )

  const scheduleMonthLabel = React.useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
      }).format(scheduleMonth),
    [scheduleMonth]
  )

  const courseOptions = React.useMemo(() => {
    const base = demoCourses.map((course) => ({
      slug: course.slug,
      title: course.title,
    }))
    for (const course of schoolCourses) {
      if (base.some((item) => item.slug === course.slug)) continue
      base.push({
        slug: course.slug,
        title: course.title,
      })
    }
    return base
  }, [schoolCourses])

  const selectedPointsRuleTemplate = React.useMemo(
    () => POINTS_RULE_DEFINITIONS.find((item) => item.key === pointsRuleForm.templateKey) || null,
    [pointsRuleForm.templateKey]
  )
  const selectedPointsRuleRecord = React.useMemo(
    () => schoolPointsRules.find((item) => item.key === pointsRuleForm.templateKey) || null,
    [schoolPointsRules, pointsRuleForm.templateKey]
  )

  React.useEffect(() => {
    if (!selectedPointsRuleTemplate) return
    const nextPoints = selectedPointsRuleRecord ? String(selectedPointsRuleRecord.points) : String(selectedPointsRuleTemplate.defaultPoints)
    const nextActive = selectedPointsRuleRecord ? selectedPointsRuleRecord.active : true
    setPointsRuleForm((prev) => {
      if (prev.points === nextPoints && prev.active === nextActive) return prev
      return {
        ...prev,
        points: nextPoints,
        active: nextActive,
      }
    })
  }, [selectedPointsRuleRecord, selectedPointsRuleTemplate])

  React.useEffect(() => {
    setCourseMirrorWeekdays((prev) => prev.filter((weekday) => !courseRecurringWeekdays.includes(weekday)))
    if (courseRecurringWeekdays.length !== 1) {
      setCourseMirrorEnabled(false)
    }
  }, [courseRecurringWeekdays])

  React.useEffect(() => {
    if (courseRecurrenceMode === "indefinite" && courseRecurrenceEndsAt) {
      setCourseRecurrenceEndsAt("")
    }
  }, [courseRecurrenceEndsAt, courseRecurrenceMode])

  React.useEffect(() => {
    if (!scheduleTimePickerOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!scheduleTimePickerRef.current) return
      if (scheduleTimePickerRef.current.contains(event.target as Node)) return
      setScheduleTimePickerOpen(false)
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [scheduleTimePickerOpen])

  const scheduleSlotTimeUsage = React.useMemo(() => {
    const counter = new Map<string, number>()
    for (const slot of courseScheduleSlots) {
      const normalized = normalizeClockTime(slot.time)
      if (!normalized) continue
      counter.set(normalized, (counter.get(normalized) || 0) + 1)
    }
    return counter
  }, [courseScheduleSlots])

  const scheduleTimeCourseUsage = React.useMemo(() => {
    const counter = new Map<string, number>()
    for (const course of schoolCourses) {
      const courseTimes = new Set<string>()
      const parsedRules = normalizeCourseScheduleRules(course.scheduleRules)
      if (parsedRules) {
        for (const rule of parsedRules.rules) {
          for (const rawTime of rule.times) {
            const normalized = normalizeClockTime(rawTime)
            if (normalized) courseTimes.add(normalized)
          }
        }
      } else {
        for (const rawTime of course.availableTimes) {
          const normalized = normalizeClockTime(rawTime)
          if (normalized) courseTimes.add(normalized)
        }
      }
      courseTimes.forEach((time) => counter.set(time, (counter.get(time) || 0) + 1))
    }
    return counter
  }, [schoolCourses])

  const externalRecurringSlotsMap = React.useMemo(() => {
    const map = new Map<string, { title: string; slug: string }[]>()
    const currentSlug = courseForm.slug.trim()
    for (const course of schoolCourses) {
      if (currentSlug && course.slug === currentSlug) continue
      const parsedRules = normalizeCourseScheduleRules(course.scheduleRules)
      const fallbackRules =
        !parsedRules && course.availableWeekdays.length > 0 && course.availableTimes.length > 0
          ? course.availableWeekdays.map((weekday) => ({
              weekday,
              times: course.availableTimes,
            }))
          : []
      const rules = parsedRules?.rules || fallbackRules
      for (const rule of rules) {
        for (const rawTime of rule.times) {
          const time = normalizeClockTime(rawTime)
          if (!time) continue
          const key = `${rule.weekday}|${time}`
          const current = map.get(key) || []
          current.push({ title: course.title, slug: course.slug })
          map.set(key, current)
        }
      }
    }
    return map
  }, [courseForm.slug, schoolCourses])

  const externalSpecialEventSlots = React.useMemo(() => {
    const items: Array<{ date: string; time: string; title: string; slug: string }> = []
    const currentSlug = courseForm.slug.trim()
    for (const course of schoolCourses) {
      if (currentSlug && course.slug === currentSlug) continue
      const parsedRules = normalizeCourseScheduleRules(course.scheduleRules)
      if (!parsedRules || parsedRules.specialEvents.length === 0) continue
      for (const event of parsedRules.specialEvents) {
        for (const rawTime of event.times) {
          const time = normalizeClockTime(rawTime)
          if (!time) continue
          if (!ISO_DATE_REGEX.test(event.date)) continue
          items.push({ date: event.date, time, title: course.title, slug: course.slug })
        }
      }
    }
    return items
  }, [courseForm.slug, schoolCourses])

  const externalSpecialEventSlotMap = React.useMemo(() => {
    const map = new Map<string, { title: string; slug: string }[]>()
    for (const item of externalSpecialEventSlots) {
      const key = `${item.date}|${item.time}`
      const current = map.get(key) || []
      current.push({ title: item.title, slug: item.slug })
      map.set(key, current)
    }
    return map
  }, [externalSpecialEventSlots])

  const regularSlotsBlockedByEvents = React.useMemo(() => {
    if (isSpecialEventCourse) return [] as Array<{ date: string; time: string; title: string }>
    const recurringSlots = courseScheduleSlots.filter(
      (slot): slot is CourseScheduleSlot & { weekday: number } =>
        typeof slot.weekday === "number" && slot.weekday >= 0 && slot.weekday <= 6
    )
    if (recurringSlots.length === 0) return [] as Array<{ date: string; time: string; title: string }>
    const entries: Array<{ date: string; time: string; title: string }> = []
    const seen = new Set<string>()
    for (const recurringSlot of recurringSlots) {
      const time = normalizeClockTime(recurringSlot.time)
      if (!time) continue
      for (const specialSlot of externalSpecialEventSlots) {
        if (specialSlot.time !== time) continue
        const eventWeekday = toCourseScheduleWeekday(specialSlot.date)
        if (eventWeekday !== recurringSlot.weekday) continue
        const key = `${specialSlot.date}|${time}|${specialSlot.slug}`
        if (seen.has(key)) continue
        seen.add(key)
        entries.push({ date: specialSlot.date, time, title: specialSlot.title })
      }
    }
    return entries.sort((a, b) => `${a.date}|${a.time}`.localeCompare(`${b.date}|${b.time}`))
  }, [courseScheduleSlots, externalSpecialEventSlots, isSpecialEventCourse])

  const regularScheduleWarningMessage = React.useMemo(() => {
    if (regularSlotsBlockedByEvents.length === 0) return null
    const first = regularSlotsBlockedByEvents[0]
    const next = regularSlotsBlockedByEvents.length > 1 ? ` +${regularSlotsBlockedByEvents.length - 1} más` : ""
    return `Warning: hay eventos especiales que chocan con este horario (${first.date} · ${formatClockLabel(first.time)} · ${first.title}${next}). Ese día se salta la clase regular y continúa en el próximo día disponible.`
  }, [regularSlotsBlockedByEvents])

  const getSpecialEventConflictReason = React.useCallback(
    (isoDate: string, rawTime: string) => {
      const time = normalizeClockTime(rawTime)
      if (!time || !ISO_DATE_REGEX.test(isoDate)) return undefined
      const existingDateSlot = externalSpecialEventSlotMap.get(`${isoDate}|${time}`)
      if (existingDateSlot && existingDateSlot.length > 0) {
        return `Bloqueado: ${existingDateSlot[0].title} ya usa ${formatClockLabel(time)} ese día.`
      }
      const weekday = toCourseScheduleWeekday(isoDate)
      if (weekday !== null) {
        const recurring = externalRecurringSlotsMap.get(`${weekday}|${time}`)
        if (recurring && recurring.length > 0) {
          return `Bloqueado: ${recurring[0].title} tiene clase regular a ${formatClockLabel(time)}.`
        }
      }
      return undefined
    },
    [externalRecurringSlotsMap, externalSpecialEventSlotMap]
  )

  const getSpecialEventDateDisabledReason = React.useCallback(
    (isoDate: string) => {
      if (!isSpecialEventCourse) return undefined
      return getSpecialEventConflictReason(isoDate, courseScheduleTime)
    },
    [courseScheduleTime, getSpecialEventConflictReason, isSpecialEventCourse]
  )

  const scheduleTimeOptions = React.useMemo(() => {
    const options: string[] = []
    for (let hour = 0; hour < 24; hour++) {
      options.push(`${String(hour).padStart(2, "0")}:00`)
      options.push(`${String(hour).padStart(2, "0")}:30`)
    }
    return options
  }, [])

  const startEditingQuickTime = React.useCallback(
    (index: number) => {
      const current = quickScheduleTimes[index] || ""
      setEditingQuickTimeIndex(index)
      setQuickTimeDraft(current)
    },
    [quickScheduleTimes]
  )

  const commitQuickTimeEdit = React.useCallback(() => {
    if (editingQuickTimeIndex === null) return
    const normalized = normalizeClockTime(quickTimeDraft)
    if (!normalized) {
      setEditingQuickTimeIndex(null)
      setQuickTimeDraft("")
      return
    }
    setQuickScheduleTimes((prev) => {
      if (!prev[editingQuickTimeIndex]) return prev
      const next = [...prev]
      next[editingQuickTimeIndex] = normalized
      return next.sort((a, b) => a.localeCompare(b))
    })
    setEditingQuickTimeIndex(null)
    setQuickTimeDraft("")
  }, [editingQuickTimeIndex, quickTimeDraft])

  const loadCourseIntoForm = React.useCallback((item: SchoolCourseRow) => {
    const parsedRules = normalizeCourseScheduleRules(item.scheduleRules)
    const scheduleSlotsFromRules = parsedRules ? buildSlotsFromScheduleRules(parsedRules) : []
    const defaultWeekdays = parsedRules
      ? [...new Set(parsedRules.rules.map((rule) => rule.weekday))].sort((a, b) => a - b)
      : item.availableWeekdays
    const defaultTimes = parsedRules
      ? [...new Set(parsedRules.rules.flatMap((rule) => rule.times).map((time) => normalizeClockTime(time)).filter(Boolean))].sort()
      : item.availableTimes.map((time) => normalizeClockTime(time)).filter(Boolean)
    setCourseForm({
      slug: item.slug,
      title: item.title,
      kind: item.kind,
      category: item.category || "",
      description: item.description || "",
      previewImageUrl: item.coverImageUrl || "",
      previewVideoUrl: item.previewVideoUrl || "",
      dropInPriceCents: centsToUsdInput(item.dropInPriceCents),
      firstClassPriceCents: centsToUsdInput(item.firstClassPriceCents),
      level: item.level || "",
      durationMinutes: item.durationMinutes?.toString() || "",
      location: item.location || "",
      availableTimesCsv: item.availableTimes.join(","),
      active: item.active,
    })
    setCourseWeekdays(defaultWeekdays)
    setCourseScheduleDate("")
    setCourseScheduleDates([])
    setCourseRecurringWeekdays(defaultWeekdays)
    setCourseScheduleSlots(scheduleSlotsFromRules)
    setCourseRepeatAllMonth(parsedRules?.repeatAllMonth ?? true)
    setCourseRecurrenceMode(parsedRules?.recurrenceMode || "indefinite")
    setCourseRecurrenceEndsAt(parsedRules?.recurrenceEndsAt || "")
    setCourseMirrorEnabled(false)
    setCourseMirrorWeekdays([])
    setQuickScheduleTimes((prev) => {
      const merged = [...new Set([...defaultTimes, ...prev])].sort((a, b) => a.localeCompare(b))
      return merged.slice(0, Math.max(prev.length, DEFAULT_QUICK_SCHEDULE_TIMES.length))
    })
    setEditingQuickTimeIndex(null)
    setQuickTimeDraft("")
    setScheduleTimePickerOpen(false)
    setCourseHydratedFromQuery(true)
  }, [])

  const rowById = React.useMemo(() => {
    return rows.reduce<Record<string, StaffUserRow>>((acc, row) => {
      acc[row.id] = row
      return acc
    }, {})
  }, [rows])

  const getLiveSessionMinutes = React.useCallback(
    (row: StaffUserRow) => {
      if (!row.online) return null
      if (!row.staffLastCheckInAt) return null
      const diff = nowTs - row.staffLastCheckInAt
      if (!Number.isFinite(diff) || diff < 0) return null
      return Math.floor(diff / 60_000)
    },
    [nowTs]
  )

  const teacherRows = React.useMemo(
    () => rows.filter((row) => row.category === "teacher" || row.role === "owner" || row.role === "admin"),
    [rows]
  )

  React.useEffect(() => {
    if (teacherRows.length === 0) {
      setTeacherUserId("")
      return
    }
    if (!teacherRows.some((row) => row.id === teacherUserId)) {
      setTeacherUserId(teacherRows[0].id)
    }
  }, [teacherRows, teacherUserId])

  const selectedTeacher = React.useMemo(
    () => teacherRows.find((row) => row.id === teacherUserId) || null,
    [teacherRows, teacherUserId]
  )
  const assignedTeacher = React.useMemo(
    () => teacherRows.find((row) => row.id === teacherAssignedUserId) || null,
    [teacherRows, teacherAssignedUserId]
  )

  React.useEffect(() => {
    if (teacherRows.length === 0) {
      setTeacherAssignedUserId("")
      return
    }
    if (!teacherAssignedUserId || !teacherRows.some((row) => row.id === teacherAssignedUserId)) {
      setTeacherAssignedUserId(teacherRows[0].id)
    }
  }, [teacherRows, teacherAssignedUserId])

  const teacherRating = React.useMemo(() => {
    if (!selectedTeacher) return 0
    if (typeof selectedTeacher.performanceRating !== "number" || !Number.isFinite(selectedTeacher.performanceRating)) {
      return 0
    }
    return Math.max(0, Math.min(5, Math.round(selectedTeacher.performanceRating * 10) / 10))
  }, [selectedTeacher])

  React.useEffect(() => {
    if (!selectedTeacher) return
    setTeacherReviewCycleDays(
      typeof selectedTeacher.performanceReviewCycleDays === "number" && Number.isFinite(selectedTeacher.performanceReviewCycleDays)
        ? Math.max(7, Math.min(90, Math.round(selectedTeacher.performanceReviewCycleDays)))
        : 30
    )
    setTeacherAssignedUserId(selectedTeacher.teacherAssignedUserId || selectedTeacher.id)
    setTeacherRecurrenceUnit(selectedTeacher.teacherRecurrenceUnit === "year" ? "year" : "month")
    setTeacherRecurrenceInterval(
      typeof selectedTeacher.teacherRecurrenceInterval === "number" &&
      Number.isFinite(selectedTeacher.teacherRecurrenceInterval)
        ? Math.max(1, Math.min(12, Math.round(selectedTeacher.teacherRecurrenceInterval)))
        : 1
    )
    setTeacherCourseSlugs(selectedTeacher.teacherCourseSlugs?.length ? selectedTeacher.teacherCourseSlugs : [])
    setMetricsSuccess(null)
    setMetricsError(null)
  }, [selectedTeacher])

  const teacherPunctualityScore = React.useMemo(() => {
    if (!selectedTeacher) return 100
    const entries = Array.isArray(selectedTeacher.payrollDelayEntries) ? selectedTeacher.payrollDelayEntries : []
    if (entries.length === 0) return 100
    const totalDelay = entries.reduce((sum, item) => sum + item.delayMinutes, 0)
    const avgDelay = totalDelay / Math.max(entries.length, 1)
    return Math.max(50, Math.round(100 - avgDelay * 1.6))
  }, [selectedTeacher])

  const teacherHoursWorked = React.useMemo(() => {
    if (!selectedTeacher || typeof selectedTeacher.payrollHoursWorked !== "number") return 0
    return Math.max(0, selectedTeacher.payrollHoursWorked)
  }, [selectedTeacher])

  const teacherBonusTargetHours = React.useMemo(() => {
    if (!selectedTeacher || typeof selectedTeacher.teacherBonusTargetHours !== "number") return 30
    return Math.max(1, Math.round(selectedTeacher.teacherBonusTargetHours))
  }, [selectedTeacher])

  const teacherWeekdaysCount = React.useMemo(() => {
    if (!selectedTeacher || !Array.isArray(selectedTeacher.teacherWeekdays)) return 0
    return selectedTeacher.teacherWeekdays.length
  }, [selectedTeacher])

  const teacherBonusProgress = React.useMemo(() => {
    const goal = Math.max(1, teacherBonusTargetHours)
    return Math.min(100, Math.round((teacherHoursWorked / goal) * 100))
  }, [teacherBonusTargetHours, teacherHoursWorked])

  const teacherRatingPercent = React.useMemo(() => {
    if (teacherRating <= 0) return 0
    return Math.round((teacherRating / 5) * 100)
  }, [teacherRating])

  const teacherMetrics = React.useMemo(
    () => [
      { key: "rating", label: "Star rating", value: teacherRatingPercent, color: "#ff6b6b", valueLabel: teacherRating > 0 ? `${teacherRating.toFixed(1)} / 5` : "No data" },
      { key: "hours", label: "Hours vs bonus target", value: teacherBonusProgress, color: "#b61616", valueLabel: `${teacherHoursWorked.toFixed(1)}h / ${Math.max(1, teacherBonusTargetHours)}h` },
      { key: "punctuality", label: "Punctuality", value: teacherPunctualityScore, color: "#f59e0b", valueLabel: `${teacherPunctualityScore}%` },
    ],
    [teacherBonusProgress, teacherBonusTargetHours, teacherHoursWorked, teacherPunctualityScore, teacherRating, teacherRatingPercent]
  )

  const visibleTeacherMetrics = React.useMemo(() => {
    if (metricsView === "current") return teacherMetrics
    return teacherMetrics.map((metric) => {
      const value =
        metric.key === "hours"
          ? Math.max(0, Math.round(metric.value * 0.88))
          : metric.key === "punctuality"
            ? Math.max(0, Math.round(metric.value * 0.93))
            : Math.max(0, Math.round(metric.value * 0.9))
      return { ...metric, value }
    })
  }, [metricsView, teacherMetrics])

  const teacherDonutStyle = React.useMemo(() => {
    const total = visibleTeacherMetrics.reduce((sum, metric) => sum + metric.value, 0)
    if (total <= 0) {
      return {
        background: "conic-gradient(rgba(255,255,255,0.18) 0 100%)",
      } as React.CSSProperties
    }
    const ratingShare = Math.round((visibleTeacherMetrics[0].value / total) * 100)
    const hoursShare = Math.round((visibleTeacherMetrics[1].value / total) * 100)
    const firstStop = ratingShare
    const secondStop = Math.min(100, firstStop + hoursShare)
    return {
      background: `conic-gradient(${visibleTeacherMetrics[0].color} 0 ${firstStop}%, ${visibleTeacherMetrics[1].color} ${firstStop}% ${secondStop}%, ${visibleTeacherMetrics[2].color} ${secondStop}% 100%)`,
    } as React.CSSProperties
  }, [visibleTeacherMetrics])

  const teacherMetricsAverage = React.useMemo(() => {
    if (visibleTeacherMetrics.length === 0) return 0
    return Math.round(visibleTeacherMetrics.reduce((sum, metric) => sum + metric.value, 0) / visibleTeacherMetrics.length)
  }, [visibleTeacherMetrics])

  const teacherAiTips = React.useMemo(() => {
    if (!selectedTeacher) return []
    const tips: string[] = []
    if (teacherPunctualityScore < 85) {
      tips.push("Puntualidad baja: reforzar check-in 10 minutos antes del inicio.")
    }
    if (teacherRating < 4) {
      tips.push("Rating menor a 4.0: sugerir clase observada + feedback dirigido por IA.")
    }
    if (teacherBonusProgress < 70) {
      tips.push("Horas por debajo de meta de bono: ofrecer cobertura de turnos en días disponibles.")
    }
    if (teacherWeekdaysCount <= 2) {
      tips.push("Disponibilidad corta: abrir al menos 1 día extra para mejorar continuidad de agenda.")
    }
    if (tips.length === 0) {
      tips.push("Rendimiento estable: mantener ciclo de evaluación y subir objetivo de bono de forma gradual.")
    }
    return tips.slice(0, 3)
  }, [selectedTeacher, teacherPunctualityScore, teacherRating, teacherBonusProgress, teacherWeekdaysCount])

  const toggleTeacherCourse = React.useCallback((courseSlug: string) => {
    setTeacherCourseSlugs((prev) => {
      if (prev.includes(courseSlug)) {
        return prev.filter((slug) => slug !== courseSlug)
      }
      return [...prev, courseSlug]
    })
  }, [])

  const saveTeacherPerformance = async () => {
    if (!selectedTeacher) return
    if (teacherCourseSlugs.length === 0) {
      setTeacherError("Select at least one course for this program template.")
      setTeacherSuccess(null)
      return
    }
    if (!teacherAssignedUserId) {
      setTeacherError("Select the assigned teacher for this program.")
      setTeacherSuccess(null)
      return
    }
    setTeacherSaving(true)
    setTeacherError(null)
    setTeacherSuccess(null)
    try {
      const res = await fetch(`/api/staff/users/${selectedTeacher.id}/performance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedTeacherUserId: teacherAssignedUserId,
          recurrenceUnit: teacherRecurrenceUnit,
          recurrenceInterval: teacherRecurrenceInterval,
          courseSlugs: teacherCourseSlugs,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTeacherError(typeof data?.error === "string" ? data.error : "Unable to save performance settings.")
        return
      }
      setTeacherSuccess("Teaching assignment saved.")
      await fetchRows(query, categoryFilter, { showLoader: false, enforceMinDelay: false })
    } catch {
      setTeacherError("Network error while saving settings.")
    } finally {
      setTeacherSaving(false)
    }
  }

  const saveTeacherReviewCycle = async () => {
    if (!selectedTeacher) return
    setMetricsSaving(true)
    setMetricsError(null)
    setMetricsSuccess(null)
    try {
      const res = await fetch(`/api/staff/users/${selectedTeacher.id}/performance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewCycleDays: teacherReviewCycleDays,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMetricsError(typeof data?.error === "string" ? data.error : "Unable to save review cycle.")
        return
      }
      setMetricsSuccess("Review cycle saved.")
      await fetchRows(query, categoryFilter, { showLoader: false, enforceMinDelay: false })
    } catch {
      setMetricsError("Network error while saving review cycle.")
    } finally {
      setMetricsSaving(false)
    }
  }

  const payrollRows = React.useMemo<PayrollStaffRow[]>(() => {
    const today = new Date()
    return rows.map((row) => {
      const hoursWorked = typeof row.payrollHoursWorked === "number" ? row.payrollHoursWorked : null
      const hourlyRate = typeof row.payrollHourlyRate === "number" ? row.payrollHourlyRate : null
      const amountCents = hoursWorked !== null && hourlyRate !== null ? Math.round(hoursWorked * hourlyRate * 100) : null
      const paydayWeekday = row.payrollPaydayWeekday
      const paydayLabel = paydayWeekday !== null ? WEEKDAY_LABELS_LONG[paydayWeekday] : "Not configured"
      const dueDate = paydayWeekday !== null ? previousWeekday(today, paydayWeekday) : null
      const status: PayrollStaffRow["status"] = row.payrollStatus || "unknown"
      const delayDays =
        status === "pending" && dueDate
          ? Math.max(0, Math.floor((startOfDay(today).getTime() - dueDate.getTime()) / 86_400_000))
          : status === "paid"
            ? 0
            : null

      return {
        userId: row.id,
        name: `${row.firstName} ${row.lastName}`.trim() || row.email,
        role: row.role,
        category: row.category,
        hoursWorked,
        hourlyRate,
        amountCents,
        status,
        delayDays,
        paydayWeekday,
        paydayLabel,
        dueDateLabel: dueDate ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(dueDate) : null,
        delayEntries: Array.isArray(row.payrollDelayEntries) ? row.payrollDelayEntries : [],
      }
    })
  }, [rows])

  const payrollSummary = React.useMemo(() => {
    const totals = payrollRows.reduce(
      (acc, row) => {
        if (typeof row.amountCents === "number") {
          acc.total += row.amountCents
        }
        if (row.status === "paid" && typeof row.amountCents === "number") {
          acc.paid += row.amountCents
          acc.paidCount += 1
        } else if (row.status === "pending" && typeof row.amountCents === "number") {
          acc.pending += row.amountCents
          acc.pendingCount += 1
          if (typeof row.delayDays === "number") {
            acc.maxDelay = Math.max(acc.maxDelay, row.delayDays)
          }
        }
        return acc
      },
      { total: 0, paid: 0, pending: 0, paidCount: 0, pendingCount: 0, maxDelay: 0 }
    )

    const fridayCount = payrollRows.filter((row) => row.paydayWeekday === 5).length
    const exceptions = payrollRows
      .filter((row) => typeof row.paydayWeekday === "number" && row.paydayWeekday !== 5)
      .map((row) => ({
        id: row.userId,
        name: row.name,
        dayLabel: WEEKDAY_LABELS_LONG[row.paydayWeekday!],
      }))

    return { ...totals, fridayCount, exceptions }
  }, [payrollRows])

  const openDelayDetails = React.useCallback((row: PayrollStaffRow) => {
    const entries = row.delayEntries
    const totalDelayMinutes = entries.reduce((sum, item) => sum + item.delayMinutes, 0)
    const lateDays = entries.filter((item) => item.delayMinutes > 0).length
    setDelayModal({
      row,
      entries,
      totalDelayMinutes,
      lateDays,
    })
  }, [])

  const closeDelayDetails = React.useCallback(() => {
    setDelayModal(null)
  }, [])

  React.useEffect(() => {
    const grid = gridRef.current
    const left = leftRailRef.current
    const right = rightRailRef.current
    if (!grid || !left || !right) return

    let frame = 0

    const reset = (el: HTMLElement) => {
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

      const apply = (el: HTMLElement, leftPos: number, width: number) => {
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

    const observer = new ResizeObserver(() => onScroll())
    observer.observe(grid)
    observer.observe(left)
    observer.observe(right)

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    update()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      reset(left)
      reset(right)
    }
  }, [stickyTop])

  return (
    <>
      <div ref={gridRef} className="relative grid gap-4 lg:items-start lg:grid-cols-[86px_minmax(0,1fr)_330px] xl:grid-cols-[90px_minmax(0,1fr)_360px]">
      <aside className="lg:self-start">
        <div
          ref={leftRailRef}
          className="relative z-40 rounded-2xl border border-black/10 bg-white/80 p-3 shadow-[0_20px_46px_-24px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#11131a]/90 lg:h-fit"
        >
          <div className="flex flex-col items-center gap-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = activeNav === item.key
            return (
              <button
                key={item.key}
                type="button"
                onFocus={() => setActiveNav(item.key)}
                onClick={() => setActiveNav(item.key)}
                className={`group relative z-10 flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                  active
                    ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/20 text-[var(--brand,#ff3c3c)]"
                    : "border-black/10 bg-white/70 text-black/70 hover:border-[var(--brand,#b61616)]/45 hover:text-[var(--brand,#ff3c3c)] dark:border-white/10 dark:bg-white/[0.02] dark:text-white/70"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-[200] -translate-y-1/2 whitespace-nowrap rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-black opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100 dark:border-white/10 dark:bg-[#0f1117] dark:text-white">
                  {item.label}
                </span>
              </button>
            )
          })}
          </div>
        </div>
      </aside>

      <section className="space-y-4">
        {showStaffOps ? (
          <article
            id="staff-create"
            className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5"
          >
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Staff access</p>
          <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Invite or promote user</h3>
          <p className="mt-1 text-sm text-black/65 dark:text-white/65">
            Assign role and department in one step. If the user exists, we promote directly.
          </p>

          <form onSubmit={createStaff} className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-12">
            <input
              name="staffEmail"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@email.com"
              className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white xl:col-span-4"
            />
            <input
              name="staffFirstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white xl:col-span-2"
            />
            <input
              name="staffLastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white xl:col-span-2"
            />
            <select
              name="staffRole"
              value={newRole}
              onChange={(e) => {
                const nextRole = e.target.value as StaffRole
                setNewRole(nextRole)
                setNewCategory((prev) => normalizeCategoryForRole(nextRole, prev))
              }}
              className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white xl:col-span-2"
            >
              {assignableRoles.map((role) => (
                <option key={`create-role-${role}`} value={role}>
                  {ROLE_FORM_LABELS[role]}
                </option>
              ))}
            </select>
            <select
              name="staffCategory"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as StaffCategory)}
              disabled={Boolean(getFixedCategoryForRole(newRole))}
              className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white xl:col-span-2"
            >
              {((getFixedCategoryForRole(newRole) ? [getFixedCategoryForRole(newRole)!] : CATEGORY_OPTIONS) as StaffCategory[]).map((category) => (
                <option key={`create-category-${category}`} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={createBusy}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 xl:col-span-12"
            >
              {createBusy ? "Processing..." : "Create / invite staff user"}
              <ChevronRight className="h-4 w-4" />
            </button>
          </form>

          {createMessage ? (
            <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {createMessage}
            </p>
          ) : null}

          {error ? (
            <p className="mt-3 rounded-md border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
              {error}
            </p>
          ) : null}
          </article>
        ) : null}

        {showStaffOps ? (
          <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
            <header className="mb-3">
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Check-in</p>
              <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">PIN terminal access</h3>
              <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                Select an employee and validate PIN to register check-in and open that staff panel.
              </p>
            </header>

            <form onSubmit={verifyStaffPin} className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_170px_auto]">
              <select
                name="pinStaffUserId"
                value={pinStaffUserId}
                onChange={(event) => setPinStaffUserId(event.target.value)}
                className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              >
                {rows.length === 0 ? (
                  <option value="">No staff users</option>
                ) : (
                  rows.map((row) => {
                    const name = `${row.firstName} ${row.lastName}`.trim() || row.email
                    return (
                      <option key={`pin-user-${row.id}`} value={row.id}>
                        {name}
                        {row.hasPin ? "" : " (PIN not configured)"}
                      </option>
                    )
                  })
                )}
              </select>
              <input
                name="pinCode"
                value={pinCode}
                onChange={(event) => setPinCode(event.target.value.replace(/[^\d]/g, "").slice(0, 8))}
                placeholder="PIN"
                inputMode="numeric"
                className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm tracking-[0.2em] text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              />
              <button
                type="submit"
                disabled={pinBusy}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--brand,#b61616)]/50 bg-[var(--brand,#b61616)]/15 px-4 py-2 text-sm font-semibold text-[var(--brand,#ff4b4b)] transition disabled:opacity-60"
              >
                <KeyRound className="h-4 w-4" />
                {pinBusy ? "Checking..." : "Check-in + login"}
              </button>
            </form>
            <p className="mt-3 text-xs text-black/55 dark:text-white/55">
              Seleccioná empleado + PIN para loguearlo y registrar su entrada.
            </p>

            {pinMessage ? (
              <p className="mt-3 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {pinMessage}
              </p>
            ) : null}
            {pinError ? (
              <p className="mt-3 rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#ff4b4b)]">
                {pinError}
              </p>
            ) : null}
          </article>
        ) : null}

        {showStaffOps ? (
          <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
          <header className="mb-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Staff users</p>
              <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Team board</h3>
            </div>
          </header>

          <div className="mb-4 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  categoryFilter === "all"
                    ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                    : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                }`}
              >
                All
              </button>
              {CATEGORY_OPTIONS.map((category) => (
                <button
                  key={`filter-${category}`}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    categoryFilter === category
                      ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                      : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                  }`}
                >
                  {CATEGORY_LABELS[category]}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                fetchRows(query, categoryFilter)
              }}
              className="flex w-full items-center gap-2 xl:w-[420px] xl:flex-none"
            >
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45 dark:text-white/45" />
                <input
                  name="staffSearch"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search email or name"
                  className="w-full rounded-md border border-black/15 bg-white py-2 pl-9 pr-3 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
              </div>
              <button type="submit" className="rounded-md border border-black/20 px-3 py-2 text-sm dark:border-white/20">
                Search
              </button>
              <button
                type="button"
                onClick={() => fetchRows(query, categoryFilter)}
                className="inline-flex items-center gap-1 rounded-md border border-black/20 px-3 py-2 text-sm dark:border-white/20"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </form>
          </div>

          {!loading && rows.length === 0 ? (
            <p className="rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
              No staff users found.
            </p>
          ) : null}

          <div className="mt-16 grid grid-cols-1 gap-4 lg:mt-24 xl:grid-cols-3">
            {loading
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={`staff-skeleton-${idx}`}
                    className="h-72 rounded-xl border border-black/10 bg-black/5 shimmer dark:border-white/10 dark:bg-white/[0.03]"
                  />
                ))
              : rows.map((row) => {
                  const rowBusy = busyUserId === row.id
                  const canManageRow = canManageTarget(row)
                  const initials = getInitials(row.firstName, row.lastName, row.email)
                  const statusTone = getStatusTone(row)
                  const fullName = `${row.firstName} ${row.lastName}`.trim() || "No name"
                  const rowPayroll = payrollRows.find((item) => item.userId === row.id)
                  const liveSessionMinutes = getLiveSessionMinutes(row)
                  return (
                    <article
                      key={row.id}
                      className="relative mt-10 cursor-pointer rounded-[18px] border border-white/10 bg-[linear-gradient(155deg,rgba(182,22,22,0.36)_0%,rgba(56,20,67,0.84)_48%,rgba(18,24,46,0.95)_100%)] p-4 pt-12 text-white shadow-[0_20px_36px_-22px_rgba(0,0,0,0.75)] transition hover:border-[var(--brand,#b61616)]/45"
                      onClick={() => {
                        if (!canManageRow) {
                          setError("Admins cannot manage Owner accounts.")
                          return
                        }
                        void openProfileModal(row)
                      }}
                    >
                      <button
                        type="button"
                        className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/10 text-white/80"
                        aria-label="More options"
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!canManageRow) {
                            setError("Admins cannot manage Owner accounts.")
                            return
                          }
                          void openProfileModal(row)
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      <header className="text-center">
                        <div className="absolute left-1/2 top-0 flex h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-[20px] border border-white/20 bg-black/35 shadow-[0_14px_30px_-18px_rgba(0,0,0,0.85)]">
                          {row.avatarUrl ? (
                            <img src={row.avatarUrl} alt={fullName} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-2xl font-bold">{initials}</span>
                          )}
                        </div>
                        <h4 className="mx-auto mt-1 max-w-[220px] truncate text-2xl font-semibold leading-tight">{fullName}</h4>
                        <div className="mt-2 flex items-center justify-center gap-4">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              if (rowPayroll) openDelayDetails(rowPayroll)
                            }}
                            className="inline-flex rounded-full bg-[#2e6dff] px-2 py-0.5 text-[11px] font-medium"
                          >
                            {ROLE_LABELS[row.role]}
                          </button>
                          <div className="relative inline-flex" data-presence-menu>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setPresenceMenuUserId((prev) => (prev === row.id ? null : row.id))
                              }}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${statusTone}`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {statusLabel(row)}
                            </button>
                            {presenceMenuUserId === row.id ? (
                              <div className="absolute left-1/2 top-[calc(100%+8px)] z-50 w-44 -translate-x-1/2 rounded-md border border-black/15 bg-white/95 p-2 shadow-[0_16px_34px_-20px_rgba(0,0,0,0.8)] backdrop-blur dark:border-white/15 dark:bg-[#0f1525]/95">
                                {row.online ? (
                                  <button
                                    type="button"
                                    disabled={rowBusy || !canManageRow}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      setPresenceMenuUserId(null)
                                      void runAction(row.id, "force_logout")
                                    }}
                                    className="inline-flex w-full items-center justify-center rounded-md border border-[var(--brand,#b61616)]/55 bg-[var(--brand,#b61616)]/15 px-2 py-1.5 text-xs font-semibold text-[var(--brand,#ff4b4b)] disabled:opacity-60"
                                  >
                                    {rowBusy ? "Logging out..." : "Log out user"}
                                  </button>
                                ) : (
                                  <p className="text-center text-xs text-black/65 dark:text-white/65">User is offline</p>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </header>

                      <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-xs text-white/85">
                        <p className="inline-flex w-full items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-white/70">
                            <MapPin className="h-3.5 w-3.5" />
                            Location
                          </span>
                          <span className="truncate text-right">{row.location || "—"}</span>
                        </p>
                        <p className="inline-flex w-full items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-white/70">
                            <Mail className="h-3.5 w-3.5" />
                            Email
                          </span>
                          <span className="truncate text-right">{row.email || "—"}</span>
                        </p>
                        <p className="inline-flex w-full items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-white/70">
                            <Phone className="h-3.5 w-3.5" />
                            Phone
                          </span>
                          <span className="truncate text-right">{row.phone || "—"}</span>
                        </p>
                        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
                          <span>Last sign in</span>
                          <span>{formatDate(row.lastSignInAt)}</span>
                        </p>
                        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
                          <span>Online now</span>
                          <span>{row.online ? "Yes" : "No"}</span>
                        </p>
                        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
                          <span>Live session</span>
                          <span>{liveSessionMinutes !== null ? formatMinutesLabel(liveSessionMinutes) : "—"}</span>
                        </p>
                        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
                          <span>PIN access</span>
                          <span>{row.hasPin ? "Configured" : "Not set"}</span>
                        </p>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          disabled={rowBusy || !canManageRow}
                          onClick={() => runAction(row.id, row.locked ? "unlock" : "lock")}
                          className="rounded-md border border-white/20 px-2 py-1 text-xs"
                        >
                          {row.locked ? "Unlock" : "Lock"}
                        </button>
                        <button
                          type="button"
                          disabled={rowBusy || !canManageRow}
                          onClick={() => runAction(row.id, row.banned ? "unban" : "ban")}
                          className="rounded-md border border-white/20 px-2 py-1 text-xs"
                        >
                          {row.banned ? "Unban" : "Ban"}
                        </button>
                        <button
                          type="button"
                          disabled={rowBusy || !canManageRow || row.id === currentUserId}
                          onClick={() => revokeStaff(row.id)}
                          className="rounded-md border border-[var(--brand,#b61616)]/70 px-2 py-1 text-xs text-[var(--brand,#ff4b4b)]"
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  )
                })}
          </div>
          </article>
        ) : null}

        {showStaffOps ? (
          <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
            <header className="mb-4">
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Staff assignment</p>
              <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Teacher-course assignment</h3>
              <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                Assign teachers to programs and courses. Shift, hours, bonus and operational schedules are managed in Courses/Programs.
              </p>
            </header>

            {teacherRows.length === 0 ? (
              <p className="rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
                No teacher-capable staff found yet.
              </p>
            ) : (
              <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="teacherSelect" className="text-xs uppercase tracking-[0.25em] text-black/60 dark:text-white/60">
                    Selected teacher
                  </label>
                  <select
                    id="teacherSelect"
                    name="teacherSelect"
                    value={teacherUserId}
                    onChange={(event) => setTeacherUserId(event.target.value)}
                    className="rounded-md border border-black/15 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                  >
                    {teacherRows.map((row) => (
                      <option key={`teacher-row-${row.id}`} value={row.id}>
                        {`${row.firstName} ${row.lastName}`.trim() || row.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                  <p className="text-xs uppercase tracking-[0.25em] text-black/60 dark:text-white/60">Teaching assignment</p>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs text-black/65 dark:text-white/65">Assigned teacher (program)</span>
                      <select
                        name="teacherAssignedUserId"
                        value={teacherAssignedUserId}
                        onChange={(event) => setTeacherAssignedUserId(event.target.value)}
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      >
                        {teacherRows.map((row) => (
                          <option key={`assigned-teacher-${row.id}`} value={row.id}>
                            {`${row.firstName} ${row.lastName}`.trim() || row.email}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
                      <label className="space-y-1">
                        <span className="text-xs text-black/65 dark:text-white/65">Recurrence</span>
                        <select
                          name="teacherRecurrenceUnit"
                          value={teacherRecurrenceUnit}
                          onChange={(event) => setTeacherRecurrenceUnit(event.target.value === "year" ? "year" : "month")}
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        >
                          <option value="month">Monthly</option>
                          <option value="year">Yearly</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs text-black/65 dark:text-white/65">Every</span>
                        <input
                          name="teacherRecurrenceInterval"
                          type="number"
                          min={1}
                          max={12}
                          step={1}
                          value={teacherRecurrenceInterval}
                          onChange={(event) => setTeacherRecurrenceInterval(Math.max(1, Math.min(12, Number(event.target.value) || 1)))}
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                    <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Program courses</p>
                    <p className="mt-1 text-xs text-black/60 dark:text-white/60">
                      Add one or many classes to this program template. You can re-assign another teacher later without recreating the program.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {courseOptions.map((course) => {
                        const active = teacherCourseSlugs.includes(course.slug)
                        return (
                          <button
                            key={`teacher-course-${course.slug}`}
                            type="button"
                            onClick={() => toggleTeacherCourse(course.slug)}
                            className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                              active
                                ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/12 text-[var(--brand,#ff4b4b)]"
                                : "border-black/15 bg-white/80 text-black/80 dark:border-white/15 dark:bg-white/5 dark:text-white/80"
                            }`}
                          >
                            {course.title}
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-2 text-xs text-black/60 dark:text-white/60">
                      {teacherCourseSlugs.length > 0
                        ? `${teacherCourseSlugs.length} classes assigned to this program.`
                        : "No classes selected yet."}
                    </p>
                  </div>

                  <div className="mt-3 rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-xs text-black/70 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/70">
                    Program owner: <span className="font-semibold text-black dark:text-white">{selectedTeacher ? `${selectedTeacher.firstName} ${selectedTeacher.lastName}`.trim() || selectedTeacher.email : "—"}</span> ·
                    Assigned teacher:{" "}
                    <span className="font-semibold text-black dark:text-white">
                      {assignedTeacher ? `${assignedTeacher.firstName} ${assignedTeacher.lastName}`.trim() || assignedTeacher.email : "—"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={saveTeacherPerformance}
                    disabled={teacherSaving || !selectedTeacher}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                  >
                    {teacherSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save assignment"
                    )}
                  </button>
                </div>
              </div>
            )}

            {teacherSuccess ? (
              <p className="mt-3 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {teacherSuccess}
              </p>
            ) : null}
            {teacherError ? (
              <p className="mt-3 rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#ff4b4b)]">
                {teacherError}
              </p>
            ) : null}
          </article>
        ) : null}

        {isSchoolView ? (
          <div className="space-y-4">
            <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">School builder</p>
                  <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Cursos, paquetes y asignación de puntos</h3>
                  <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                    School está separado de staff users. Acá gestionás solo catálogo académico.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void fetchSchoolData({ showLoader: true })}
                  className="inline-flex items-center justify-center rounded-md border border-[var(--brand,#b61616)]/50 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm font-semibold text-[var(--brand,#ff4b4b)] transition hover:bg-[var(--brand,#b61616)]/15"
                >
                  {schoolLoading ? "Refreshing..." : "Refresh school data"}
                </button>
              </header>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Courses</p>
                  <p className="mt-1 text-2xl font-semibold text-black dark:text-white">{schoolCourses.length}</p>
                </div>
                <div className="rounded-lg border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Packages</p>
                  <p className="mt-1 text-2xl font-semibold text-black dark:text-white">{schoolPackages.length}</p>
                </div>
                <div className="rounded-lg border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Points rules</p>
                  <p className="mt-1 text-2xl font-semibold text-black dark:text-white">{schoolPointsRules.length}</p>
                </div>
              </div>

              {schoolError ? (
                <p className="mt-4 rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#ff4b4b)]">
                  {schoolError}
                </p>
              ) : null}
              {schoolSuccess ? (
                <p className="mt-4 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                  {schoolSuccess}
                </p>
              ) : null}
            </article>

            <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
              <header className="mb-4">
                <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Course studio</p>
                <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Constructor + preview visual</h3>
                <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                  Definí datos del curso y previsualizá en tiempo real como un canvas.
                </p>
              </header>

              <div className="grid grid-cols-1 gap-4">
                <form onSubmit={saveCourseCatalog} className="rounded-xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand,#b61616)]">Curso</p>
                  <h4 className="mt-2 text-lg font-semibold text-black dark:text-white">Crear o actualizar curso</h4>
                  <input ref={courseImageInputRef} name="courseLocalImage" type="file" accept="image/*" className="hidden" onChange={handleCourseLocalImage} />
                  <input ref={courseVideoInputRef} name="courseLocalVideo" type="file" accept="video/*" className="hidden" onChange={handleCourseLocalVideo} />
                  <div className="mt-3 space-y-2">
                    <input
                      name="courseSlug"
                      value={courseForm.slug}
                      onChange={(event) => setCourseForm((prev) => ({ ...prev, slug: event.target.value }))}
                      placeholder="slug (ej: salsa-femenina-matutina)"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    />
                    <input
                      name="courseTitle"
                      value={courseForm.title}
                      onChange={(event) => setCourseForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Título"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    />
                    <textarea
                      name="courseDescription"
                      value={courseForm.description}
                      onChange={(event) => setCourseForm((prev) => ({ ...prev, description: event.target.value }))}
                      placeholder="Descripción corta del curso"
                      rows={3}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        name="courseKind"
                        value={courseForm.kind}
                        onChange={(event) => setCourseForm((prev) => ({ ...prev, kind: event.target.value }))}
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      >
                        {SCHOOL_COURSE_KINDS.map((kind) => (
                          <option key={`course-kind-${kind}`} value={kind}>
                            {kind}
                          </option>
                        ))}
                      </select>
                      <input
                        name="courseCategory"
                        value={courseForm.category}
                        onChange={(event) => setCourseForm((prev) => ({ ...prev, category: event.target.value }))}
                        placeholder="Categoría"
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        name="courseLevel"
                        value={courseForm.level}
                        onChange={(event) => setCourseForm((prev) => ({ ...prev, level: event.target.value }))}
                        placeholder="Nivel"
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      />
                      <input
                        name="courseDurationMinutes"
                        type="number"
                        min={0}
                        max={600}
                        value={courseForm.durationMinutes}
                        onChange={(event) => setCourseForm((prev) => ({ ...prev, durationMinutes: event.target.value }))}
                        placeholder="Duración (min)"
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        name="courseDropInPrice"
                        type="number"
                        step="0.01"
                        min={0}
                        value={courseForm.dropInPriceCents}
                        onChange={(event) => setCourseForm((prev) => ({ ...prev, dropInPriceCents: event.target.value }))}
                        placeholder="Drop-in USD (ej: 20)"
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      />
                      <input
                        name="courseFirstClassPrice"
                        type="number"
                        step="0.01"
                        min={0}
                        value={courseForm.firstClassPriceCents}
                        onChange={(event) => setCourseForm((prev) => ({ ...prev, firstClassPriceCents: event.target.value }))}
                        placeholder="First class USD (ej: 15)"
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      />
                    </div>
                    <input
                      name="courseLocation"
                      value={courseForm.location}
                      onChange={(event) => setCourseForm((prev) => ({ ...prev, location: event.target.value }))}
                      placeholder="Ubicación"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />

                    <div className="rounded-lg border border-black/10 bg-white/75 p-2.5 dark:border-white/10 dark:bg-white/[0.02]">
                      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Media assets</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-black/60 dark:text-white/60">Video</p>
                          <input
                            name="coursePreviewVideoUrl"
                            value={courseForm.previewVideoUrl}
                            onChange={(event) => setCourseForm((prev) => ({ ...prev, previewVideoUrl: event.target.value }))}
                            placeholder="URL video preview (YouTube/Vimeo/MP4)"
                            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => courseVideoInputRef.current?.click()}
                            className="inline-flex w-full items-center justify-center rounded-md border border-black/15 bg-white px-3 py-2 text-xs font-semibold text-black/80 transition hover:bg-white/80 dark:border-white/15 dark:bg-white/[0.04] dark:text-white/80"
                          >
                            Cargar video local
                          </button>
                          {courseLocalVideoName ? <p className="text-xs text-black/60 dark:text-white/60">Local video: {courseLocalVideoName}</p> : null}
                        </div>
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-black/60 dark:text-white/60">Imagen</p>
                          <input
                            name="coursePreviewImageUrl"
                            value={courseForm.previewImageUrl}
                            onChange={(event) => setCourseForm((prev) => ({ ...prev, previewImageUrl: event.target.value }))}
                            placeholder="URL imagen de portada"
                            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => courseImageInputRef.current?.click()}
                            className="inline-flex w-full items-center justify-center rounded-md border border-black/15 bg-white px-3 py-2 text-xs font-semibold text-black/80 transition hover:bg-white/80 dark:border-white/15 dark:bg-white/[0.04] dark:text-white/80"
                          >
                            Cargar imagen local
                          </button>
                          {courseLocalImageName ? <p className="text-xs text-black/60 dark:text-white/60">Local image: {courseLocalImageName}</p> : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-black/10 bg-white/75 p-2.5 dark:border-white/10 dark:bg-white/[0.02]">
                      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">
                        {isSpecialEventCourse ? "Eventos especiales (calendar builder)" : "Horarios (builder guiado)"}
                      </p>
                      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                        <div className="space-y-3">
                          {isSpecialEventCourse ? (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 dark:border-amber-400/35 dark:bg-amber-500/10">
                              <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300">Modo evento especial</p>
                              <p className="mt-1 text-xs text-amber-100/90">
                                Este curso usa fechas únicas. El builder semanal queda deshabilitado y los slots se cargan desde el calendario.
                              </p>
                            </div>
                          ) : (
                            <>
                              <div className="rounded-lg border border-black/10 bg-white/65 p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                                <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">1) Seleccioná los días</p>
                                <div className="mt-1 grid grid-cols-7 gap-1.5">
                                  {WEEKDAY_LABELS.map((label, weekday) => {
                                    const active = courseRecurringWeekdays.includes(weekday)
                                    return (
                                      <button
                                        key={`course-weekday-toggle-${weekday}`}
                                        type="button"
                                        onClick={() => toggleCourseRecurringWeekday(weekday)}
                                        className={`h-11 rounded-md border text-sm font-semibold transition ${
                                          active
                                            ? "border-[var(--brand,#b61616)]/70 bg-[var(--brand,#b61616)]/20 text-[var(--brand,#ff4b4b)]"
                                            : "border-black/20 text-black/70 hover:border-[var(--brand,#b61616)]/45 dark:border-white/20 dark:text-white/70"
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    )
                                  })}
                                </div>
                                <p className="mt-1 text-xs text-black/55 dark:text-white/55">
                                  Seleccionados: {courseRecurringWeekdays.length}
                                </p>
                              </div>

                              {courseRecurringWeekdays.length === 1 ? (
                                <div className="rounded-lg border border-black/10 bg-white/65 p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">
                                    2) ¿Este horario se repite en otro día?
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setCourseMirrorEnabled(true)}
                                      className={`rounded-md border px-3 py-1 text-xs font-semibold ${
                                        courseMirrorEnabled
                                          ? "border-[var(--brand,#b61616)]/70 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#ff4b4b)]"
                                          : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                                      }`}
                                    >
                                      Sí, repetir
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCourseMirrorEnabled(false)
                                        setCourseMirrorWeekdays([])
                                      }}
                                      className={`rounded-md border px-3 py-1 text-xs font-semibold ${
                                        !courseMirrorEnabled
                                          ? "border-[var(--brand,#b61616)]/70 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#ff4b4b)]"
                                          : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                                      }`}
                                    >
                                      No
                                    </button>
                                  </div>
                                  {courseMirrorEnabled ? (
                                    <div className="mt-2 grid grid-cols-7 gap-1.5">
                                      {WEEKDAY_LABELS.map((label, weekday) => {
                                        const disabled = courseRecurringWeekdays.includes(weekday)
                                        const active = courseMirrorWeekdays.includes(weekday)
                                        return (
                                          <button
                                            key={`mirror-weekday-${weekday}`}
                                            type="button"
                                            onClick={() => toggleCourseMirrorWeekday(weekday)}
                                            disabled={disabled}
                                            className={`h-9 rounded-md border text-xs font-semibold transition ${
                                              active
                                                ? "border-[var(--brand,#b61616)]/70 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#ff4b4b)]"
                                                : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                                            } ${disabled ? "cursor-not-allowed opacity-35" : ""}`}
                                          >
                                            {label}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </>
                          )}

                          <div className="rounded-lg border border-black/10 bg-white/65 p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">
                              {isSpecialEventCourse ? "2) Horario para fechas del evento" : "3) Horario para los días elegidos"}
                            </p>
                            {isSpecialEventCourse ? (
                              <div className="mt-2 rounded-md border border-black/10 bg-black/[0.02] p-2 dark:border-white/10 dark:bg-white/[0.02]">
                                <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/55">Fechas del evento</p>
                                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                                  <input
                                    type="date"
                                    value={courseScheduleDate}
                                    onChange={(event) => setCourseScheduleDate(event.target.value)}
                                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const date = courseScheduleDate.trim()
                                      if (!date) return
                                      setCourseScheduleDates((prev) => [...new Set([...prev, date])].sort())
                                      setCourseScheduleDate("")
                                    }}
                                    className="rounded-md border border-[var(--brand,#b61616)]/55 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm font-semibold text-[var(--brand,#ff4b4b)]"
                                  >
                                    Agregar fecha
                                  </button>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {courseScheduleDates.length === 0 ? (
                                    <span className="text-xs text-black/55 dark:text-white/55">Sin fechas seleccionadas.</span>
                                  ) : (
                                    courseScheduleDates.map((date) => (
                                      <button
                                        key={`special-event-date-chip-${date}`}
                                        type="button"
                                        onClick={() => setCourseScheduleDates((prev) => prev.filter((item) => item !== date))}
                                        className="rounded-full border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-2 py-0.5 text-xs text-[var(--brand,#ff4b4b)]"
                                      >
                                        {date} ×
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            ) : null}
                            <div className="mt-2 rounded-md border border-black/10 bg-black/[0.02] p-2 dark:border-white/10 dark:bg-white/[0.02]">
                              <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/55">Atajos (editable)</p>
                              <div className="grid grid-cols-3 gap-2">
                                {quickScheduleTimes.map((time, index) => {
                                  const isEditing = editingQuickTimeIndex === index
                                  if (isEditing) {
                                    return (
                                      <div
                                        key={`quick-time-edit-${index}`}
                                        className="rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 p-2"
                                      >
                                        <input
                                          id={`quick-time-edit-${index}`}
                                          name={`quickTimeEdit${index}`}
                                          type="time"
                                          value={quickTimeDraft}
                                          onChange={(event) => setQuickTimeDraft(event.target.value)}
                                          className="h-8 w-full rounded border border-black/20 bg-white/85 px-2 text-xs text-black outline-none dark:border-white/20 dark:bg-white/10 dark:text-white"
                                        />
                                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                                          <button
                                            type="button"
                                            onClick={commitQuickTimeEdit}
                                            className="rounded border border-black/20 px-2 py-1 text-[11px] font-semibold text-black/80 dark:border-white/20 dark:text-white/80"
                                          >
                                            Save
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingQuickTimeIndex(null)
                                              setQuickTimeDraft("")
                                            }}
                                            className="rounded border border-black/20 px-2 py-1 text-[11px] text-black/70 dark:border-white/20 dark:text-white/70"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  }
                                  const normalizedTime = normalizeClockTime(time)
                                  const isActive = normalizedTime === normalizeClockTime(courseScheduleTime)
                                  const usageCount = normalizedTime ? scheduleSlotTimeUsage.get(normalizedTime) || 0 : 0
                                  const usageCourseCount = normalizedTime ? scheduleTimeCourseUsage.get(normalizedTime) || 0 : 0
                                  const isMostUsed = usageCount > 3 || usageCourseCount > 3
                                  const usageBadgeLabel =
                                    usageCourseCount > 0
                                      ? `${usageCourseCount} curso${usageCourseCount === 1 ? "" : "s"}`
                                      : usageCount > 0
                                        ? `${usageCount} uso${usageCount === 1 ? "" : "s"}`
                                        : "Sin uso"
                                  const usageBadgeTone =
                                    usageCourseCount > 0
                                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                                      : usageCount > 0
                                        ? "border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/18 text-[var(--brand,#ff8a8a)]"
                                        : "border-black/20 bg-white/60 text-black/60 dark:border-white/20 dark:bg-white/5 dark:text-white/60"
                                  return (
                                    <div
                                      key={`quick-time-${time}-${index}`}
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => normalizedTime && setCourseScheduleTime(normalizedTime)}
                                      onKeyDown={(event) => {
                                        if (!normalizedTime) return
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault()
                                          setCourseScheduleTime(normalizedTime)
                                        }
                                      }}
                                      className={`min-h-[144px] cursor-pointer rounded-md border p-3 transition ${SCHEDULE_SHORTCUT_TONES[index % SCHEDULE_SHORTCUT_TONES.length]} ${
                                        isActive
                                          ? "border-[var(--brand,#b61616)]/70 shadow-[0_0_0_1px_rgba(182,22,22,0.35)]"
                                          : "border-black/20 dark:border-white/20"
                                      }`}
                                    >
                                      <div className="flex items-center justify-center gap-1.5">
                                        <Star
                                          className={`h-3 w-3 ${isMostUsed ? "text-[#f59e0b]" : "text-black/35 dark:text-white/35"}`}
                                          fill={isMostUsed ? "currentColor" : "none"}
                                        />
                                        <span
                                          className={`inline-flex max-w-[88px] items-center justify-center truncate rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none ${usageBadgeTone}`}
                                          title={usageBadgeLabel}
                                        >
                                          {usageBadgeLabel}
                                        </span>
                                        <Star
                                          className={`h-3 w-3 ${isMostUsed ? "text-[#f59e0b]" : "text-black/35 dark:text-white/35"}`}
                                          fill={isMostUsed ? "currentColor" : "none"}
                                        />
                                      </div>
                                      <div className="mt-2 border-t border-black/15 pt-2 dark:border-white/15">
                                        <div className="flex items-center justify-center">
                                          <span className="text-xl font-bold text-black dark:text-white">{formatClockLabel(time)}</span>
                                        </div>
                                      </div>
                                      <div className="mt-2 border-t border-black/15 pt-2 dark:border-white/15">
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation()
                                            startEditingQuickTime(index)
                                          }}
                                          className="w-full rounded-md border border-black/20 bg-black/5 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-black/70 transition hover:border-[var(--brand,#b61616)]/50 hover:bg-[var(--brand,#b61616)]/10 hover:text-black dark:border-white/20 dark:bg-white/[0.04] dark:text-white/70 dark:hover:text-white"
                                          title="Editar horario"
                                          aria-label="Editar horario"
                                        >
                                          Edit
                                        </button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                            <div ref={scheduleTimePickerRef} className="relative mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                              <button
                                type="button"
                                onClick={() => setScheduleTimePickerOpen((prev) => !prev)}
                                className="flex w-full items-center justify-between rounded-md border border-black/15 bg-white px-3 py-2 text-left text-sm text-black outline-none transition hover:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                              >
                                <span>{formatClockLabel(courseScheduleTime)}</span>
                                <Clock3 className="h-4 w-4 text-black/55 dark:text-white/55" />
                              </button>
                              <button
                                type="button"
                                onClick={addCourseScheduleSlot}
                                className="rounded-md border border-[var(--brand,#b61616)]/55 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm font-semibold text-[var(--brand,#ff4b4b)]"
                              >
                                {isSpecialEventCourse
                                  ? courseScheduleDates.length > 1
                                    ? "Add event slots"
                                    : "Add event slot"
                                  : courseRecurringWeekdays.length > 0 || courseScheduleDates.length > 1
                                    ? "Add slots"
                                    : "Add slot"}
                              </button>
                              {scheduleTimePickerOpen ? (
                                <div className="absolute left-0 top-[calc(100%+0.45rem)] z-30 w-full rounded-md border border-black/10 bg-white/95 p-2 shadow-xl dark:border-white/10 dark:bg-[#141821]/95">
                                  <div className="grid max-h-48 grid-cols-3 gap-1 overflow-y-auto sm:grid-cols-4">
                                    {scheduleTimeOptions.map((option) => {
                                      const active = normalizeClockTime(courseScheduleTime) === option
                                      return (
                                        <button
                                          key={`schedule-time-option-${option}`}
                                          type="button"
                                          onClick={() => {
                                            setCourseScheduleTime(option)
                                            setScheduleTimePickerOpen(false)
                                          }}
                                          className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${
                                            active
                                              ? "border-[var(--brand,#b61616)]/70 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#ff4b4b)]"
                                              : "border-black/15 text-black/80 hover:border-[var(--brand,#b61616)]/50 dark:border-white/15 dark:text-white/80"
                                          }`}
                                        >
                                          {formatClockLabel(option)}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            {!isSpecialEventCourse && regularScheduleWarningMessage ? (
                              <div className="mt-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200">
                                {regularScheduleWarningMessage}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-3">
                          {isSpecialEventCourse ? (
                            <div className="rounded-lg border border-[var(--brand,#b61616)]/25 bg-[var(--brand,#b61616)]/8 p-2.5">
                              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--brand,#ff8a8a)]">Regla de prioridad</p>
                              <p className="mt-1 text-xs text-[var(--brand,#ffd0d0)]">
                                Los eventos especiales tienen prioridad sobre clases regulares. Si hay choque, el horario regular continúa en el siguiente día disponible.
                              </p>
                            </div>
                          ) : (
                            <div className="rounded-lg border border-black/10 bg-white/65 p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                              <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">4) Repetición y vigencia</p>
                              <label className="mt-1 inline-flex items-center gap-2 text-xs text-black/75 dark:text-white/75">
                                <input
                                  type="checkbox"
                                  checked={courseRepeatAllMonth}
                                  onChange={(event) => setCourseRepeatAllMonth(event.target.checked)}
                                />
                                Repetir durante todo el mes visible
                              </label>
                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                <select
                                  name="courseRecurrenceMode"
                                  value={courseRecurrenceMode}
                                  onChange={(event) => setCourseRecurrenceMode(event.target.value === "until_date" ? "until_date" : "indefinite")}
                                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                                >
                                  <option value="indefinite">Indefinido</option>
                                  <option value="until_date">Con fecha de expiración</option>
                                </select>
                                <input
                                  name="courseRecurrenceEndsAt"
                                  type="date"
                                  value={courseRecurrenceEndsAt}
                                  onChange={(event) => setCourseRecurrenceEndsAt(event.target.value)}
                                  disabled={courseRecurrenceMode !== "until_date"}
                                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] disabled:opacity-45 dark:border-white/15 dark:bg-white/5 dark:text-white"
                                />
                              </div>
                            </div>
                          )}

                          <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-black/10 bg-white/70 p-2 text-xs dark:border-white/10 dark:bg-white/[0.02]">
                            {schoolLoading ? (
                              <div className="space-y-1.5 animate-pulse">
                                <div className="h-7 rounded-md bg-black/10 dark:bg-white/10" />
                                <div className="h-7 rounded-md bg-black/10 dark:bg-white/10" />
                                <div className="h-7 rounded-md bg-black/10 dark:bg-white/10" />
                              </div>
                            ) : courseScheduleSlots.length === 0 ? (
                              <p className="text-black/60 dark:text-white/60">No slots selected yet.</p>
                            ) : (
                              courseScheduleSlots.map((slot) => {
                                const slotKey = getCourseSlotKey(slot)
                                return (
                                  <div
                                    key={`course-slot-${slotKey}`}
                                    className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1 ${
                                      slot.date
                                        ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
                                        : "border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.02]"
                                    }`}
                                  >
                                    <span>{formatCourseSlotLabel(slot)}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeCourseScheduleSlot(slotKey)}
                                      className="rounded-md border border-black/15 px-2 py-0.5 text-[11px] dark:border-white/20"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                )
                              })
                            )}
                          </div>

                          <div className="rounded-md border border-black/10 bg-white/70 p-2 text-xs dark:border-white/10 dark:bg-white/[0.02]">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">{selectedCourseKindReviewLabel}</p>
                            {schoolLoading ? (
                              <div className="mt-2 animate-pulse space-y-2">
                                <div className="h-16 rounded-md bg-black/10 dark:bg-white/10" />
                                <div className="h-4 rounded bg-black/10 dark:bg-white/10" />
                                <div className="h-4 rounded bg-black/10 dark:bg-white/10" />
                              </div>
                            ) : (
                              <div className="mt-2 grid grid-cols-[64px_minmax(0,1fr)] gap-2">
                                <div className="h-16 w-16 overflow-hidden rounded-md border border-black/10 bg-black/10 dark:border-white/10 dark:bg-white/10">
                                  {previewMediaUrl ? (
                                    <img src={previewMediaUrl} alt="Course thumbnail" className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-black/45 dark:text-white/45">
                                      No img
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 space-y-1">
                                  <p className="truncate text-sm font-semibold text-black dark:text-white">{courseForm.title || "Sin título"}</p>
                                  <p className="truncate text-black/65 dark:text-white/65">Tipo: {selectedCourseKindLabel}</p>
                                  <p className="truncate text-black/65 dark:text-white/65">Slug: {courseForm.slug || "—"}</p>
                                  <p className="text-black/75 dark:text-white/75">
                                    Drop-in: {formatUsdInputLabel(courseForm.dropInPriceCents)} · First class: {formatUsdInputLabel(courseForm.firstClassPriceCents)}
                                  </p>
                                  <p className="truncate text-black/75 dark:text-white/75">Dirección: {courseForm.location || "—"}</p>
                                </div>
                              </div>
                            )}
                            <div className="mt-3 border-t border-black/10 pt-2 dark:border-white/10">
                              <p className="text-[11px] uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Reviews por tipo</p>
                              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                                {courseReviewVariants.map((variant) => (
                                  <div
                                    key={`course-review-variant-${variant.kind}`}
                                    className={`rounded-md border px-2 py-1.5 ${
                                      variant.active
                                        ? "border-[var(--brand,#b61616)]/55 bg-[var(--brand,#b61616)]/10"
                                        : "border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black dark:text-white">{variant.label}</span>
                                      {variant.active ? (
                                        <span className="rounded-full border border-[var(--brand,#b61616)]/50 bg-[var(--brand,#b61616)]/15 px-1.5 py-0.5 text-[10px] text-[var(--brand,#ff4b4b)]">
                                          Activo
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-1 text-[11px] text-black/70 dark:text-white/70">{variant.hint}</p>
                                    <p className="mt-1 text-[11px] text-black/65 dark:text-white/65">
                                      {courseForm.title || "Sin título"} · {formatUsdInputLabel(courseForm.dropInPriceCents)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-md border border-black/10 bg-white/70 p-2 dark:border-white/10 dark:bg-white/[0.02] xl:col-span-2">
                          <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/55">Calendario mensual (solo preview)</p>
                          {schoolLoading ? (
                            <div className="space-y-2 animate-pulse">
                              <div className="h-8 rounded bg-black/10 dark:bg-white/10" />
                              <div className="h-56 rounded bg-black/10 dark:bg-white/10" />
                            </div>
                          ) : (
                            <CalendarPicker
                              value=""
                              onChange={() => {}}
                              values={[...scheduleCalendarMap.keys()].sort()}
                              multiple
                              onValuesChange={() => {}}
                              timezone="America/New_York"
                              className="!rounded-lg"
                              locked
                              getDateTooltip={getCourseScheduleDateTooltip}
                              getDateTone={getCourseScheduleDateTone}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={schoolBusy !== null}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
                  >
                    {schoolBusy === "course" ? "Guardando..." : "Guardar curso"}
                  </button>

                  <div className="mt-3 rounded-lg border border-black/10 bg-white/70 p-3 text-xs dark:border-white/10 dark:bg-white/[0.02]">
                    <p className="uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Saved courses</p>
                    <div className="mt-2 max-h-44 space-y-2 overflow-y-auto">
                      {schoolLoading ? (
                        <div className="space-y-2 animate-pulse">
                          <div className="h-12 rounded-md bg-black/10 dark:bg-white/10" />
                          <div className="h-12 rounded-md bg-black/10 dark:bg-white/10" />
                          <div className="h-12 rounded-md bg-black/10 dark:bg-white/10" />
                        </div>
                      ) : schoolCourses.length === 0 ? (
                        <p className="text-black/60 dark:text-white/60">Sin cursos creados todavía.</p>
                      ) : (
                        schoolCourses.map((item) => (
                          <div key={`course-row-${item.id}`} className="rounded-md border border-black/10 bg-black/[0.03] px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.02]">
                            <p className="font-semibold text-black dark:text-white">{item.title}</p>
                            <p className="text-black/65 dark:text-white/65">
                              {item.slug} · {item.kind}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => loadCourseIntoForm(item)}
                                className="rounded border border-black/20 px-2 py-0.5 text-[11px] text-black/80 dark:border-white/20 dark:text-white/80"
                              >
                                Cargar en form
                              </button>
                              <a
                                href={`/staff/school/course/${item.slug}`}
                                className="rounded border border-[var(--brand,#b61616)]/60 px-2 py-0.5 text-[11px] text-[var(--brand,#ff4b4b)]"
                              >
                                Editar curso
                              </a>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </form>

                <div className="rounded-xl border border-black/10 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.3),transparent_55%),linear-gradient(145deg,rgba(15,19,35,0.97),rgba(20,25,45,0.97))] p-4 dark:border-white/10">
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand,#b61616)]">Canvas preview</p>
                  <h4 className="mt-2 text-lg font-semibold text-white">Vista previa del curso</h4>

                  <div className="mt-3 grid gap-3 xl:grid-cols-2">
                    <div className="rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                      <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Home card preview</p>
                      <div className="relative mt-2 overflow-hidden rounded-2xl border border-black/10 bg-[#050810] dark:border-white/10">
                        {previewMediaUrl ? (
                          <img src={previewMediaUrl} alt="Home card preview" className="h-72 w-full object-cover" />
                        ) : (
                          <div className="flex h-72 items-center justify-center bg-black/35 text-xs uppercase tracking-[0.2em] text-white/55">Imagen del curso</div>
                        )}
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.15),rgba(0,0,0,0.75))]" />
                        <div className="absolute inset-x-0 bottom-0 p-3">
                          <div className="rounded-xl border border-white/20 bg-black/55 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--brand,#ff4b4b)]">HOME CARD</p>
                            <p className="mt-1 text-sm font-semibold text-white">{courseForm.title || "Course title"}</p>
                          </div>
                        </div>
                      </div>
                      <a
                        href={previewEditorHref}
                        className={`mt-2 inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${
                          courseForm.slug.trim()
                            ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/12 text-[var(--brand,#ff4b4b)]"
                            : "pointer-events-none border-black/15 text-black/40 dark:border-white/15 dark:text-white/40"
                        }`}
                      >
                        Editar home card
                      </a>
                    </div>

                    <div className="rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                      <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Single page preview</p>
                      <div className="relative mt-2 overflow-hidden rounded-2xl border border-black/10 bg-[#050810] dark:border-white/10">
                        {previewMediaUrl ? (
                          <img src={previewMediaUrl} alt="Single page preview" className="h-72 w-full object-cover" />
                        ) : (
                          <div className="flex h-72 items-center justify-center bg-black/35 text-xs uppercase tracking-[0.2em] text-white/55">Imagen del single page</div>
                        )}
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(210,52,52,0.4),transparent_55%),linear-gradient(180deg,rgba(0,0,0,0.3),rgba(0,0,0,0.78))]" />
                        <div className="absolute inset-x-0 bottom-0 p-3">
                          <div className="rounded-xl border border-white/20 bg-black/60 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--brand,#ff4b4b)]">SINGLE PAGE</p>
                            <p className="mt-1 text-sm font-semibold text-white">{courseForm.title || "Course title"}</p>
                            <p className="mt-1 text-xs text-white/80">
                              {scheduleDerivedData.times.length > 0
                                ? scheduleDerivedData.times.map((time) => formatClockLabel(time)).join(", ")
                                : "Horario por definir"}
                            </p>
                          </div>
                        </div>
                      </div>
                      <a
                        href={previewEditorHref}
                        className={`mt-2 inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${
                          courseForm.slug.trim()
                            ? "border-[var(--brand,#b61616)]/70 bg-[var(--brand,#b61616)]/14 text-[var(--brand,#ff6b6b)]"
                            : "pointer-events-none border-black/15 text-black/40 dark:border-white/15 dark:text-white/40"
                        }`}
                      >
                        Editar single page
                      </a>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/70">Publicar en redes</p>
                    <p className="mt-1 text-xs text-white/60">Publicá este curso directo desde el editor visual.</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => void copyCourseLink()}
                        disabled={!previewPublicHref}
                        className="rounded-md border border-white/20 bg-white/5 px-2 py-1.5 text-xs font-semibold text-white transition disabled:opacity-40"
                      >
                        Copy link
                      </button>
                      <button
                        type="button"
                        onClick={() => shareCourse("facebook")}
                        disabled={!previewPublicHref}
                        className="rounded-md border border-white/20 bg-white/5 px-2 py-1.5 text-xs font-semibold text-white transition disabled:opacity-40"
                      >
                        Facebook
                      </button>
                      <button
                        type="button"
                        onClick={() => shareCourse("x")}
                        disabled={!previewPublicHref}
                        className="rounded-md border border-white/20 bg-white/5 px-2 py-1.5 text-xs font-semibold text-white transition disabled:opacity-40"
                      >
                        X
                      </button>
                      <button
                        type="button"
                        onClick={() => shareCourse("whatsapp")}
                        disabled={!previewPublicHref}
                        className="rounded-md border border-white/20 bg-white/5 px-2 py-1.5 text-xs font-semibold text-white transition disabled:opacity-40"
                      >
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => shareCourse("instagram")}
                        disabled={!previewPublicHref}
                        className="rounded-md border border-white/20 bg-white/5 px-2 py-1.5 text-xs font-semibold text-white transition disabled:opacity-40"
                      >
                        Instagram
                      </button>
                      <button
                        type="button"
                        onClick={() => shareCourse("tiktok")}
                        disabled={!previewPublicHref}
                        className="rounded-md border border-white/20 bg-white/5 px-2 py-1.5 text-xs font-semibold text-white transition disabled:opacity-40"
                      >
                        TikTok
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <div className="grid gap-4 xl:grid-cols-2">
              <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
                <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Package builder</p>
                <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Crear o actualizar paquete</h3>

                <form onSubmit={savePackagePlan} className="mt-3 space-y-2">
                  <input
                    name="packageKey"
                    value={packageForm.key}
                    onChange={(event) => setPackageForm((prev) => ({ ...prev, key: event.target.value }))}
                    placeholder="Key (ej: morning-3-week)"
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    required
                  />
                  <input
                    name="packageLabel"
                    value={packageForm.label}
                    onChange={(event) => setPackageForm((prev) => ({ ...prev, label: event.target.value }))}
                    placeholder="Label"
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    required
                  />
                  <select
                    name="packageCourseSlug"
                    value={packageForm.courseSlug}
                    onChange={(event) => setPackageForm((prev) => ({ ...prev, courseSlug: event.target.value }))}
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                  >
                    {courseOptions.map((course) => (
                      <option key={`package-course-${course.slug}`} value={course.slug}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                  <input
                    name="packageDescription"
                    value={packageForm.description}
                    onChange={(event) => setPackageForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Descripción"
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      name="packagePriceCents"
                      type="number"
                      min={0}
                      value={packageForm.priceCents}
                      onChange={(event) => setPackageForm((prev) => ({ ...prev, priceCents: event.target.value }))}
                      placeholder="Precio en centavos"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                    <input
                      name="packageTotalCredits"
                      type="number"
                      min={0}
                      value={packageForm.totalCredits}
                      onChange={(event) => setPackageForm((prev) => ({ ...prev, totalCredits: event.target.value }))}
                      placeholder="Créditos"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      disabled={packageForm.isUnlimited}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      name="packageMakeUps"
                      type="number"
                      min={0}
                      value={packageForm.makeUps}
                      onChange={(event) => setPackageForm((prev) => ({ ...prev, makeUps: event.target.value }))}
                      placeholder="Make-ups"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                    <input
                      name="packageValidDays"
                      type="number"
                      min={1}
                      value={packageForm.validDays}
                      onChange={(event) => setPackageForm((prev) => ({ ...prev, validDays: event.target.value }))}
                      placeholder="Validez días"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                    <input
                      name="packageCadence"
                      value={packageForm.cadence}
                      onChange={(event) => setPackageForm((prev) => ({ ...prev, cadence: event.target.value }))}
                      placeholder="Cadencia"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white/60 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.02]">
                      <input
                        name="packageIsUnlimited"
                        type="checkbox"
                        checked={packageForm.isUnlimited}
                        onChange={(event) => setPackageForm((prev) => ({ ...prev, isUnlimited: event.target.checked }))}
                      />
                      Unlimited
                    </label>
                    <label className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white/60 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.02]">
                      <input
                        name="packageActive"
                        type="checkbox"
                        checked={packageForm.active}
                        onChange={(event) => setPackageForm((prev) => ({ ...prev, active: event.target.checked }))}
                      />
                      Active
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={schoolBusy !== null}
                    className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
                  >
                    {schoolBusy === "package" ? "Guardando..." : "Guardar paquete"}
                  </button>
                </form>

                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-md border border-black/10 bg-white/60 p-2 text-xs dark:border-white/10 dark:bg-white/[0.02]">
                  {schoolLoading ? (
                    <p className="text-black/60 dark:text-white/60">Cargando paquetes...</p>
                  ) : schoolPackages.length === 0 ? (
                    <p className="text-black/60 dark:text-white/60">Sin paquetes creados todavía.</p>
                  ) : (
                    schoolPackages.map((item) => (
                      <div key={`package-row-${item.id}`} className="rounded-md border border-black/10 bg-black/[0.03] px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.02]">
                        <p className="font-semibold text-black dark:text-white">{item.label}</p>
                        <p className="text-black/65 dark:text-white/65">
                          {item.key} · {item.courseSlug || "global"} · {item.totalCredits ?? "∞"} créditos
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
                <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Points builder</p>
                <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Reglas + asignación manual</h3>

                <form onSubmit={savePointsRule} className="mt-3 space-y-2">
                  <select
                    name="pointsRuleTemplate"
                    value={pointsRuleForm.templateKey}
                    onChange={(event) => setPointsRuleForm((prev) => ({ ...prev, templateKey: event.target.value }))}
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                  >
                    {POINTS_RULE_DEFINITIONS.map((item) => (
                      <option key={`points-template-${item.key}`} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      name="pointsRuleEventType"
                      value={selectedPointsRuleTemplate?.eventType || ""}
                      readOnly
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                    <input
                      name="pointsRulePoints"
                      type="number"
                      step="0.5"
                      value={pointsRuleForm.points}
                      onChange={(event) => setPointsRuleForm((prev) => ({ ...prev, points: event.target.value }))}
                      placeholder="Points"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    />
                  </div>
                  <p className="rounded-md border border-black/10 bg-white/60 px-3 py-2 text-xs text-black/70 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/70">
                    {selectedPointsRuleTemplate?.description || "Seleccioná una regla para configurar puntos."}
                  </p>
                  <label className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white/60 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.02]">
                    <input
                      name="pointsRuleActive"
                      type="checkbox"
                      checked={pointsRuleForm.active}
                      onChange={(event) => setPointsRuleForm((prev) => ({ ...prev, active: event.target.checked }))}
                    />
                    Regla activa
                  </label>
                  <button
                    type="submit"
                    disabled={schoolBusy !== null}
                    className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
                  >
                    {schoolBusy === "rule" ? "Guardando..." : "Guardar regla"}
                  </button>
                </form>

                <form onSubmit={assignPointsManually} className="mt-4 space-y-2 rounded-md border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                  <p className="text-xs uppercase tracking-[0.2em] text-black/65 dark:text-white/65">Asignación manual</p>
                  <input
                    name="pointsAssignUserEmail"
                    type="email"
                    value={pointsAssignForm.userEmail}
                    onChange={(event) => setPointsAssignForm((prev) => ({ ...prev, userEmail: event.target.value }))}
                    placeholder="Student email"
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      name="pointsAssignType"
                      value={pointsAssignForm.type}
                      onChange={(event) => setPointsAssignForm((prev) => ({ ...prev, type: event.target.value }))}
                      placeholder="Type"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                    <input
                      name="pointsAssignPoints"
                      type="number"
                      step="0.5"
                      value={pointsAssignForm.points}
                      onChange={(event) => setPointsAssignForm((prev) => ({ ...prev, points: event.target.value }))}
                      placeholder="Points"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    />
                  </div>
                  <input
                    name="pointsAssignNote"
                    value={pointsAssignForm.note}
                    onChange={(event) => setPointsAssignForm((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder="Note"
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                  />
                  <input
                    name="pointsAssignEventKey"
                    value={pointsAssignForm.eventKey}
                    onChange={(event) => setPointsAssignForm((prev) => ({ ...prev, eventKey: event.target.value }))}
                    placeholder="Event key (optional)"
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={schoolBusy !== null}
                    className="inline-flex w-full items-center justify-center rounded-md border border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 px-4 py-2 text-sm font-semibold text-[var(--brand,#ff4b4b)] transition disabled:opacity-60"
                  >
                    {schoolBusy === "assign" ? "Asignando..." : "Asignar puntos"}
                  </button>
                </form>

                <div className="mt-3 max-h-44 space-y-2 overflow-y-auto rounded-md border border-black/10 bg-white/60 p-2 text-xs dark:border-white/10 dark:bg-white/[0.02]">
                  {schoolLoading ? (
                    <p className="text-black/60 dark:text-white/60">Cargando reglas...</p>
                  ) : schoolPointsRules.length === 0 ? (
                    <p className="text-black/60 dark:text-white/60">Sin reglas definidas.</p>
                  ) : (
                    schoolPointsRules.map((item) => (
                      <div key={`points-rule-row-${item.id}`} className="rounded-md border border-black/10 bg-black/[0.03] px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.02]">
                        <p className="font-semibold text-black dark:text-white">{item.label}</p>
                        <p className="text-black/65 dark:text-white/65">
                          {item.eventType} · {item.points} · {item.active ? "active" : "inactive"}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </div>
          </div>
        ) : null}

        {showStaffOps ? (
          <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
            <header className="mb-4">
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Payroll</p>
              <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Control de pagos del staff</h3>
              <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                Horas trabajadas, pagos enviados y demora de pago por usuario.
              </p>
            </header>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(180px,0.5fr)]">
              <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="mb-2 hidden grid-cols-[minmax(0,1fr)_88px_120px_90px_90px_100px] gap-2 px-2 text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/55 md:grid">
                  <span>Staff user</span>
                  <span className="text-right">Hours</span>
                  <span className="text-right">Amount</span>
                  <span className="text-right">Status</span>
                  <span className="text-right">Delay</span>
                  <span className="text-right">Log out</span>
                </div>

                <div className="space-y-2">
                  {payrollRows.length === 0 ? (
                    <p className="rounded-lg border border-black/10 bg-white/65 px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/65">
                      No payroll rows available yet.
                    </p>
                  ) : (
                    payrollRows.map((item) => (
                      <div
                        key={`payroll-row-${item.userId}`}
                        className="grid gap-2 rounded-lg border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.02] md:grid-cols-[minmax(0,1fr)_88px_120px_90px_90px_100px] md:items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-black dark:text-white">{item.name}</p>
                          <p className="truncate text-xs text-black/60 dark:text-white/60">
                            {CATEGORY_LABELS[item.category]} · Pay day: {item.paydayLabel}
                          </p>
                        </div>
                        <div className="text-sm text-black md:text-right dark:text-white">
                          {(() => {
                            const sourceRow = rowById[item.userId]
                            const liveMinutes = sourceRow ? getLiveSessionMinutes(sourceRow) : null
                            const storedHours = typeof item.hoursWorked === "number" ? item.hoursWorked : null
                            if (storedHours !== null && liveMinutes !== null) {
                              const totalHours = storedHours + liveMinutes / 60
                              return (
                                <>
                                  <p>{`${totalHours.toFixed(1)}h`}</p>
                                  <p className="text-[11px] text-emerald-500 dark:text-emerald-300">
                                    Live +{formatMinutesLabel(liveMinutes)}
                                  </p>
                                </>
                              )
                            }
                            if (storedHours !== null) {
                              return <p>{`${storedHours.toFixed(1)}h`}</p>
                            }
                            if (liveMinutes !== null) {
                              return (
                                <>
                                  <p>{formatMinutesLabel(liveMinutes)}</p>
                                  <p className="text-[11px] text-emerald-500 dark:text-emerald-300">Live</p>
                                </>
                              )
                            }
                            return <p>—</p>
                          })()}
                        </div>
                        <p className="text-sm font-semibold text-black md:text-right dark:text-white">
                          {typeof item.amountCents === "number" ? formatMoney(item.amountCents) : "—"}
                        </p>
                        <p className="md:text-right">
                          <button
                            type="button"
                            onClick={() => openDelayDetails(item)}
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] transition hover:brightness-110 ${
                              item.status === "paid"
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                : item.status === "pending"
                                  ? "border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 text-[var(--brand,#ff4b4b)]"
                                  : "border-white/20 bg-white/5 text-white/75"
                            }`}
                          >
                            {item.status === "paid" ? "Paid" : item.status === "pending" ? "Pending" : "No data"}
                          </button>
                        </p>
                        <p className="md:text-right">
                          <button
                            type="button"
                            onClick={() => openDelayDetails(item)}
                            className="text-xs text-black/70 transition hover:text-[var(--brand,#b61616)] dark:text-white/70 dark:hover:text-[var(--brand,#ff4b4b)]"
                          >
                            {item.status === "paid"
                              ? "On time"
                              : item.status === "pending"
                                ? typeof item.delayDays === "number"
                                  ? item.delayDays > 0
                                    ? `${item.delayDays}d late`
                                    : "Due today"
                                  : "Pending"
                                : "—"}
                          </button>
                        </p>
                        <p className="md:text-right">
                          {(() => {
                            const sourceRow = rowById[item.userId]
                            const canLogout = Boolean(sourceRow?.online && sourceRow?.staffLastCheckInAt)
                            if (!canLogout) {
                              return <span className="text-xs text-black/60 dark:text-white/60">—</span>
                            }
                            return (
                              <button
                                type="button"
                                disabled={busyUserId === item.userId}
                                onClick={() => void runAction(item.userId, "force_logout")}
                                className="inline-flex rounded-md border border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/12 px-2 py-1 text-[11px] font-semibold text-[var(--brand,#ff4b4b)] disabled:opacity-60"
                              >
                                {busyUserId === item.userId ? "..." : "Log out"}
                              </button>
                            )
                          })()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-xl border border-black/10 bg-white/65 p-4 dark:border-white/10 dark:bg-[linear-gradient(160deg,rgba(182,22,22,0.35)_0%,rgba(32,18,51,0.88)_100%)]">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white/70 dark:border-white/20 dark:bg-white/10">
                    <CircleDollarSign className="h-4 w-4 text-[var(--brand,#ff4b4b)]" />
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.24em] text-black/55 dark:text-white/60">Total payroll</p>
                  <p className="mt-1 text-2xl font-semibold text-black dark:text-white">
                    {formatMoney(payrollSummary.total)}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border border-black/10 bg-white/70 px-2 py-1.5 text-black dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
                      Paid: {payrollSummary.paidCount} users
                    </div>
                    <div className="rounded-md border border-black/10 bg-white/70 px-2 py-1.5 text-black dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
                      Pending: {payrollSummary.pendingCount}
                    </div>
                    <div className="col-span-2 rounded-md border border-black/10 bg-white/70 px-2 py-1.5 text-black dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
                      <div className="flex items-center justify-between gap-2">
                        <span>Pending amount: {formatMoney(payrollSummary.pending)}</span>
                        <button
                          type="button"
                          disabled={payrollSummary.pending <= 0}
                          onClick={openPendingPayments}
                          className="rounded-md border border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/12 px-2 py-1 text-[11px] font-semibold text-[var(--brand,#ff4b4b)] transition disabled:opacity-45"
                        >
                          Pay
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-black/10 bg-white/65 p-4 dark:border-white/10 dark:bg-[linear-gradient(160deg,rgba(182,22,22,0.16)_0%,rgba(17,21,36,0.9)_100%)]">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white/70 dark:border-white/20 dark:bg-white/10">
                    <Clock3 className="h-4 w-4 text-[var(--brand,#ff4b4b)]" />
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.24em] text-black/55 dark:text-white/60">Pay day rules</p>
                  <div className="mt-2 space-y-2 text-sm text-black dark:text-white">
                    <div className="rounded-md border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.06]">
                      General cycle:{" "}
                      <span className="font-semibold">
                        {payrollSummary.fridayCount > 0 ? `Friday (${payrollSummary.fridayCount} users)` : "Not configured"}
                      </span>
                    </div>
                    <div className="rounded-md border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.06]">
                      {payrollSummary.exceptions.length === 0 ? (
                        <p className="text-sm">No exceptions configured.</p>
                      ) : (
                        <div className="space-y-1 text-xs">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/60">Exceptions</p>
                          {payrollSummary.exceptions.slice(0, 4).map((item) => (
                            <p key={`payday-exception-${item.id}`} className="truncate">
                              {item.name}: <span className="font-semibold">{item.dayLabel}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-black/65 dark:text-white/65">
                      Max payment delay:{" "}
                      <span className="font-semibold">
                        {payrollSummary.pendingCount > 0 ? `${payrollSummary.maxDelay} days` : "—"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ) : null}

        {isStudentsView ? (
          <article
            id="students-payments"
            className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5"
          >
          <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Payments</p>
              <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Settlement control</h3>
              <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                Track who is pending settlement and who was already paid.
              </p>
            </div>
            <div className="inline-flex flex-wrap items-center gap-2">
              {(["all", "pending", "paid"] as const).map((status) => (
                <button
                  key={`settlement-filter-${status}`}
                  type="button"
                  onClick={() => setPaymentsFilter(status)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    paymentsFilter === status
                      ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                      : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                  }`}
                >
                  {status === "all" ? "All" : status === "pending" ? "Pending" : "Paid"}
                </button>
              ))}
            </div>
          </header>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs text-black/60 dark:text-white/60">Collected</p>
              <p className="mt-1 text-lg font-semibold text-black dark:text-white">
                {formatMoney(paymentsSummary.totalCollected)}
              </p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs text-black/60 dark:text-white/60">Pending settle</p>
              <p className="mt-1 text-lg font-semibold text-black dark:text-white">{paymentsSummary.pendingSettlement}</p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs text-black/60 dark:text-white/60">Settled</p>
              <p className="mt-1 text-lg font-semibold text-black dark:text-white">{paymentsSummary.paidSettlement}</p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs text-black/60 dark:text-white/60">Records</p>
              <p className="mt-1 text-lg font-semibold text-black dark:text-white">{paymentsSummary.totalItems}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {paymentsLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`payments-skeleton-${index}`}
                  className="h-[74px] rounded-lg border border-black/10 bg-black/[0.03] shimmer dark:border-white/10 dark:bg-white/[0.03]"
                />
              ))
            ) : payments.length === 0 ? (
              <p className="rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
                No payments found.
              </p>
            ) : (
              payments.slice(0, 12).map((payment) => {
                const busy = paymentBusyId === payment.id
                return (
                  <div
                    key={payment.id}
                    className="grid gap-2 rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03] lg:grid-cols-[minmax(0,1fr)_auto_auto]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-black dark:text-white">{payment.courseTitle}</p>
                      <p className="text-xs text-black/60 dark:text-white/60">
                        {payment.customerName} · {payment.customerEmail}
                      </p>
                      <p className="text-xs text-black/55 dark:text-white/55">
                        {formatIsoDate(payment.createdAt)} · status {payment.paymentStatus}
                      </p>
                    </div>
                    <div className="text-sm font-semibold text-black dark:text-white">{formatMoney(payment.amount, payment.currency)}</div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        updateSettlementStatus(payment.id, payment.settlementStatus === "paid" ? "mark_pending" : "mark_paid")
                      }
                      className={`inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                        payment.settlementStatus === "paid"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : "border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 text-[var(--brand,#ff4b4b)]"
                      }`}
                    >
                      {busy ? "Saving..." : payment.settlementStatus === "paid" ? "Mark pending" : "Mark paid"}
                    </button>
                  </div>
                )
              })
            )}
          </div>
          </article>
        ) : null}

        {showStaffOps ? (
          <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
          <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Staff requests</p>
              <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Notifications and approvals</h3>
              <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                Day off, shift swaps, schedule changes and pay advance requests.
              </p>
            </div>
            <div className="inline-flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setRequestStatusFilter("all")}
                className={`rounded-full border px-3 py-1 text-xs ${
                  requestStatusFilter === "all"
                    ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                    : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                }`}
              >
                All
              </button>
              {REQUEST_STATUS_OPTIONS.map((status) => (
                <button
                  key={`request-filter-${status}`}
                  type="button"
                  onClick={() => setRequestStatusFilter(status)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    requestStatusFilter === status
                      ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                      : "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70"
                  }`}
                >
                  {status.replaceAll("_", " ")}
                </button>
              ))}
            </div>
          </header>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs text-black/60 dark:text-white/60">Total</p>
              <p className="mt-1 text-lg font-semibold text-black dark:text-white">{requestsSummary.total}</p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs text-black/60 dark:text-white/60">Pending</p>
              <p className="mt-1 text-lg font-semibold text-black dark:text-white">{requestsSummary.pending}</p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs text-black/60 dark:text-white/60">In review</p>
              <p className="mt-1 text-lg font-semibold text-black dark:text-white">{requestsSummary.inReview}</p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs text-black/60 dark:text-white/60">Approved</p>
              <p className="mt-1 text-lg font-semibold text-black dark:text-white">{requestsSummary.approved}</p>
            </div>
            <div className="rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs text-black/60 dark:text-white/60">Rejected</p>
              <p className="mt-1 text-lg font-semibold text-black dark:text-white">{requestsSummary.rejected}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {requestsLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`requests-skeleton-${index}`}
                  className="h-[74px] rounded-lg border border-black/10 bg-black/[0.03] shimmer dark:border-white/10 dark:bg-white/[0.03]"
                />
              ))
            ) : staffRequests.length === 0 ? (
              <p className="rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
                No staff requests found.
              </p>
            ) : (
              staffRequests.slice(0, 12).map((request) => {
                const busy = requestBusyId === request.id
                return (
                  <div
                    key={request.id}
                    className="grid gap-2 rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03] lg:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-black dark:text-white">
                        {REQUEST_TYPE_LABELS[request.type]} · {request.user.name}
                      </p>
                      <p className="text-xs text-black/60 dark:text-white/60">
                        {request.user.email} · {formatIsoDate(request.createdAt)}
                      </p>
                      {request.message ? (
                        <p className="mt-1 text-xs text-black/70 dark:text-white/70">{request.message}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] text-white">
                        {request.status.replaceAll("_", " ")}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updateRequestStatus(request.id, "IN_REVIEW")}
                        className="rounded-md border border-white/20 px-2 py-1 text-xs text-white"
                      >
                        Review
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updateRequestStatus(request.id, "APPROVED")}
                        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updateRequestStatus(request.id, "REJECTED")}
                        className="rounded-md border border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/10 px-2 py-1 text-xs text-[var(--brand,#ff4b4b)]"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          </article>
        ) : null}
        {showStaffOps ? (
          <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
          <header className="mb-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Team calendar</p>
              <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Who is coming and when</h3>
            </div>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScheduleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="rounded-md border border-black/20 p-1.5 dark:border-white/20"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium text-black dark:text-white">{scheduleMonthLabel}</span>
              <button
                type="button"
                onClick={() => setScheduleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="rounded-md border border-black/20 p-1.5 dark:border-white/20"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/55">
              {WEEKDAY_LABELS.map((label) => (
                <span key={`weekday-${label}`}>{label}</span>
              ))}
            </div>
            {scheduleLoading ? (
              <div className="mt-2 grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, index) => (
                  <div
                    key={`calendar-skeleton-${index}`}
                    className="min-h-[92px] rounded-md border border-black/10 bg-white/60 shimmer dark:border-white/10 dark:bg-white/[0.02]"
                  />
                ))}
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-7 gap-2">
                {calendarCells.map((cell, idx) => {
                  const events = scheduleEventsByDay[cell.dateKey] || []
                  return (
                    <div
                      key={`calendar-cell-${cell.dateKey}-${idx}`}
                      className={`min-h-[92px] rounded-md border p-1.5 ${
                        cell.inMonth
                          ? "border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/[0.02]"
                          : "border-black/5 bg-black/[0.02] opacity-60 dark:border-white/5 dark:bg-white/[0.01]"
                      }`}
                    >
                      <p className="mb-1 text-right text-xs text-black/70 dark:text-white/70">{cell.day}</p>
                      <div className="space-y-1">
                        {events.slice(0, 2).map((event) => (
                          <div key={`day-event-${event.attendanceId}`} className="group relative">
                            <div className="truncate rounded-full bg-[var(--brand,#b61616)]/90 px-2 py-0.5 text-[11px] text-white">
                              {event.timeLabel}
                            </div>
                            <div className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-72 rounded-md border border-black/15 bg-white p-2 text-xs text-black shadow-xl group-hover:block dark:border-white/15 dark:bg-[#11131a] dark:text-white">
                              <p className="font-semibold">{event.userName}</p>
                              <p className="mt-0.5 text-black/70 dark:text-white/70">{event.courseTitle}</p>
                              <p className="mt-0.5">Time: {event.timeLabel}</p>
                              <p className="mt-0.5">Email: {event.userEmail || "—"}</p>
                              <p className="mt-0.5">Phone: {event.userPhone || "—"}</p>
                              <p className="mt-0.5 capitalize">Status: {event.status.replaceAll("_", " ")}</p>
                            </div>
                          </div>
                        ))}
                        {events.length > 2 ? (
                          <p className="text-[11px] text-black/60 dark:text-white/60">+{events.length - 2} more</p>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          </article>
        ) : null}

        {showStaffOps ? (
          <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
            <header className="mb-4">
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Performance metrics</p>
              <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Bar and donut analytics</h3>
              <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                Read-only metrics for instructor audits by students and internal reviews.
              </p>
            </header>

            {teacherRows.length === 0 ? (
              <p className="rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
                No teacher metrics available yet.
              </p>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
                <div className="rounded-xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.24em] text-black/60 dark:text-white/60">Selected teacher</p>
                    <select
                      name="metricsTeacherSelect"
                      value={teacherUserId}
                      onChange={(event) => setTeacherUserId(event.target.value)}
                      className="rounded-md border border-black/15 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    >
                      {teacherRows.map((row) => (
                        <option key={`teacher-metrics-row-${row.id}`} value={row.id}>
                          {`${row.firstName} ${row.lastName}`.trim() || row.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-3 rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-black dark:text-white">
                        {selectedTeacher ? `${selectedTeacher.firstName} ${selectedTeacher.lastName}`.trim() || selectedTeacher.email : "—"}
                      </p>
                      <span className="rounded-full border border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--brand,#ff4b4b)]">
                        {selectedTeacher ? ROLE_LABELS[selectedTeacher.role] : "Staff"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <p className="text-sm text-black/70 dark:text-white/70">Current rating</p>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, index) => {
                          const value = index + 1
                          const active = value <= teacherRating
                          return (
                            <span
                              key={`teacher-star-metrics-${value}`}
                              className={`rounded-md border p-1 transition ${
                                active
                                  ? "border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/15 text-[var(--brand,#ff4b4b)]"
                                  : "border-black/15 text-black/40 dark:border-white/15 dark:text-white/45"
                              }`}
                            >
                              <Star className={`h-4 w-4 ${active ? "fill-current" : ""}`} />
                            </span>
                          )
                        })}
                      </div>
                      <span className="text-xs text-black/60 dark:text-white/60">
                        {teacherRating > 0 ? `${teacherRating.toFixed(1)} / 5` : "No ratings yet"} ·{" "}
                        {(selectedTeacher?.performanceReviewsCount || 0)} reviews
                      </span>
                    </div>

                    <div className="mt-4 rounded-md border border-black/10 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                      <p className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.25em] text-black/60 dark:text-white/60">
                        <Sparkles className="h-3.5 w-3.5" />
                        AI recommendations
                      </p>
                      <div className="mt-2 space-y-1.5 text-sm text-black/75 dark:text-white/75">
                        {teacherAiTips.map((tip, idx) => (
                          <p key={`teacher-ai-tip-metrics-${idx}`}>• {tip}</p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {visibleTeacherMetrics.map((metric) => (
                      <div key={`teacher-metric-${metric.key}`} className="rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-black dark:text-white">{metric.label}</p>
                          <p className="text-xs text-black/65 dark:text-white/65">{metric.valueLabel}</p>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(0, Math.min(100, metric.value))}%`, backgroundColor: metric.color }}
                          />
                        </div>
                        <p className="mt-1 text-right text-xs text-black/60 dark:text-white/60">{metric.value}%</p>
                      </div>
                    ))}
                  </div>

                </div>

                <div className="rounded-xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.24em] text-black/60 dark:text-white/60">Distribution</p>
                    <select
                      name="metricsView"
                      value={metricsView}
                      onChange={(event) => setMetricsView(event.target.value === "previous_cycle" ? "previous_cycle" : "current")}
                      className="rounded-md border border-black/15 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    >
                      <option value="current">Current cycle</option>
                      <option value="previous_cycle">Previous cycle</option>
                    </select>
                  </div>

                  <div className="mt-3 rounded-lg border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <label className="space-y-1">
                        <span className="text-xs text-black/65 dark:text-white/65">Review cycle (internal)</span>
                        <select
                          name="teacherReviewCycleDays"
                          value={teacherReviewCycleDays}
                          onChange={(event) => setTeacherReviewCycleDays(Number(event.target.value) || 30)}
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        >
                          {[15, 30, 45, 60].map((days) => (
                            <option key={`metrics-review-cycle-${days}`} value={days}>
                              Every {days} days
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={saveTeacherReviewCycle}
                        disabled={metricsSaving || !selectedTeacher}
                        className="inline-flex items-center justify-center rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                      >
                        {metricsSaving ? "Saving..." : "Save"}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-black/60 dark:text-white/60">
                      Internal comparison: the previous cycle is generated from current cycle values.
                    </p>
                    {metricsSuccess ? (
                      <p className="mt-2 text-xs text-emerald-300">{metricsSuccess}</p>
                    ) : null}
                    {metricsError ? (
                      <p className="mt-2 text-xs text-[var(--brand,#ff4b4b)]">{metricsError}</p>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-col items-center gap-4">
                    <div className="relative h-44 w-44 rounded-full p-3" style={teacherDonutStyle}>
                      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white/80 text-center dark:bg-[#121523]">
                        <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Score</p>
                        <p className="text-2xl font-semibold text-black dark:text-white">{teacherMetricsAverage}%</p>
                      </div>
                    </div>
                    <div className="w-full space-y-1.5">
                      {visibleTeacherMetrics.map((metric) => (
                        <div key={`teacher-metric-legend-${metric.key}`} className="flex items-center justify-between gap-2 rounded-md border border-black/10 bg-white/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.02]">
                          <span className="inline-flex items-center gap-2 text-black/80 dark:text-white/80">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metric.color }} />
                            {metric.label}
                          </span>
                          <span className="font-semibold text-black dark:text-white">{metric.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </article>
        ) : null}
      </section>

      <aside className="lg:self-start">
        <div
          ref={rightRailRef}
          className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_20px_46px_-24px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#11131a]/95 lg:h-[calc(100vh-3.75rem)]"
        >
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">AI Assistant</p>
          <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Admin copilot</h3>
          <p className="mt-1 text-sm text-black/65 dark:text-white/65">
            Use this panel to query staff workload and recommended actions.
          </p>

          <div className="mt-4 flex h-[calc(100%-8rem)] flex-col overflow-hidden rounded-xl border border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.02]">
            <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
              <div className="rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-black/80 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/80">
                Puedo filtrar quién está online, quién está bloqueado y preparar acciones en lote.
              </div>
              <div className="ml-auto max-w-[92%] rounded-lg border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/12 px-3 py-2 text-black dark:text-white">
                Show me today schedule with users.
              </div>
              <div className="rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-black/80 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/80">
                Listo. Revisá el calendario central: cada horario tiene tooltip con usuario, email y estado.
              </div>
            </div>

            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex items-center gap-2 border-t border-black/10 p-3 dark:border-white/10"
            >
              <input
                name="assistantPrompt"
                placeholder="Ask assistant..."
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
              />
              <button type="submit" className="rounded-md bg-[var(--brand,#b61616)] px-3 py-2 text-sm font-semibold text-white">
                Send
              </button>
            </form>
          </div>
        </div>
      </aside>
      </div>

      {delayModal ? (
        <div className="fixed inset-0 z-[139] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-black/15 bg-white shadow-[0_40px_90px_-40px_rgba(0,0,0,0.75)] dark:border-white/15 dark:bg-[#10131d]">
            <div className="flex items-start justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand,#b61616)]">Delay details</p>
                <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">{delayModal.row.name}</h3>
                <p className="mt-1 text-xs text-black/65 dark:text-white/65">
                  Total delay: {formatMinutesLabel(delayModal.totalDelayMinutes)} · Late days: {delayModal.lateDays}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDelayDetails}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/20 text-black/70 transition hover:bg-black/5 dark:border-white/20 dark:text-white/70 dark:hover:bg-white/5"
                aria-label="Close delay details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-[120px_1fr_1fr_84px] gap-2 rounded-md border border-black/10 bg-black/[0.03] px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-black/55 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/55">
                <span>Date</span>
                <span>Expected</span>
                <span>Checked in</span>
                <span className="text-right">Delay</span>
              </div>
              <div className="mt-2 space-y-2">
                {delayModal.entries.length === 0 ? (
                  <p className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm text-black/70 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70">
                    No delay records available for this user yet.
                  </p>
                ) : (
                  delayModal.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="grid grid-cols-[120px_1fr_1fr_84px] items-center gap-2 rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                    >
                      <span className="text-xs text-black/70 dark:text-white/70">{entry.dateLabel}</span>
                      <span>{entry.expectedTime}</span>
                      <span>{entry.actualTime}</span>
                      <span className="text-right text-xs font-semibold text-[var(--brand,#ff4b4b)]">
                        {entry.delayMinutes > 0 ? `+${entry.delayMinutes}m` : "On time"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {profileModalOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-black/15 bg-white shadow-[0_40px_90px_-40px_rgba(0,0,0,0.75)] dark:border-white/15 dark:bg-[#10131d]">
            <div className="flex items-start justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
              {profileLoading ? (
                <div className="w-full max-w-[70%] space-y-2">
                  <div className="h-3 w-28 rounded-full shimmer" />
                  <div className="h-7 w-56 rounded-full shimmer" />
                  <div className="h-3 w-full rounded-full shimmer" />
                </div>
              ) : (
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--brand,#b61616)]">Staff profile</p>
                  <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">
                    Editar {profileTarget ? `${profileTarget.firstName} ${profileTarget.lastName}`.trim() : "usuario"}
                  </h3>
                  <p className="mt-1 text-xs text-black/65 dark:text-white/65">
                    Podés cambiar datos personales y configurar PIN de acceso rápido.
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={closeProfileModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/20 text-black/70 transition hover:bg-black/5 dark:border-white/20 dark:text-white/70 dark:hover:bg-white/5"
                aria-label="Close profile editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {profileLoading ? (
              <div className="p-5">
                <div className="space-y-4 rounded-xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="h-10 rounded-md shimmer" />
                    <div className="h-10 rounded-md shimmer" />
                    <div className="h-10 rounded-md shimmer" />
                    <div className="h-10 rounded-md shimmer" />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="h-10 rounded-md shimmer md:col-span-2" />
                    <div className="h-10 rounded-md shimmer md:col-span-2" />
                    <div className="h-10 rounded-md shimmer" />
                    <div className="h-10 rounded-md shimmer" />
                  </div>
                  <div className="h-24 rounded-md shimmer" />
                  <div className="ml-auto h-10 w-40 rounded-md shimmer" />
                </div>
              </div>
            ) : (
              <form
                className="space-y-4 p-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  void saveProfileModal()
                }}
              >
                <section className="rounded-xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
                  <div className="grid gap-3 md:grid-cols-[112px_minmax(0,1fr)]">
                    <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-black/15 bg-white/70 dark:border-white/20 dark:bg-white/10">
                      {profileTarget?.avatarUrl ? (
                        <img
                          src={profileTarget.avatarUrl}
                          alt={`${profileForm.firstName} ${profileForm.lastName}`.trim() || profileTarget.email}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-black dark:text-white">
                          {getInitials(profileForm.firstName, profileForm.lastName, profileTarget?.email || "")}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-[var(--brand,#b61616)]">Avatar</p>
                        <p className="mt-1 text-xs text-black/65 dark:text-white/65">
                          Upload profile photo for this staff user.
                        </p>
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-black/20 px-3 py-2 text-xs font-medium text-black transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#b61616)] dark:border-white/20 dark:text-white">
                        {profileAvatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                        {profileAvatarUploading ? "Uploading..." : "Upload photo"}
                        <input
                          name="profileAvatar"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={profileAvatarUploading}
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (file) {
                              void uploadProfileAvatar(file)
                            }
                            event.currentTarget.value = ""
                          }}
                        />
                      </label>
                      {profileAvatarError ? (
                        <p className="rounded-md border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-2 py-1 text-xs text-[var(--brand,#b61616)]">
                          {profileAvatarError}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--brand,#b61616)]">Mini gallery</p>
                    <p className="mt-1 text-xs text-black/65 dark:text-white/65">
                      Upload images from local device (phone/PC). Up to 6 images.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-black/20 px-3 py-2 text-xs font-medium text-black transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#b61616)] dark:border-white/20 dark:text-white">
                        {profileGalleryUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ImagePlus className="h-4 w-4" />
                        )}
                        {profileGalleryUploading ? "Uploading..." : "Upload images"}
                        <input
                          name="profileGallery"
                          type="file"
                          multiple
                          accept="image/*"
                          className="hidden"
                          disabled={profileGalleryUploading || profileForm.gallery.length >= 6}
                          onChange={(event) => {
                            const files = event.target.files
                            if (files && files.length > 0) {
                              void uploadProfileGalleryImages(files)
                            }
                            event.currentTarget.value = ""
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setProfileForm((prev) => ({ ...prev, gallery: [] }))}
                        disabled={profileGalleryUploading || profileForm.gallery.length === 0}
                        className="inline-flex items-center gap-1 rounded-md border border-black/20 px-3 py-2 text-xs font-medium text-black transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#b61616)] dark:border-white/20 dark:text-white"
                      >
                        Clear all
                      </button>
                      <span className="text-xs text-black/60 dark:text-white/60">{profileForm.gallery.length}/6</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                      {profileForm.gallery.length === 0 ? (
                        <p className="col-span-full rounded-md border border-dashed border-black/20 px-3 py-4 text-center text-xs text-black/60 dark:border-white/20 dark:text-white/60">
                          No gallery images yet.
                        </p>
                      ) : (
                        profileForm.gallery.map((url, index) => (
                          <div key={`gallery-${index}`} className="relative overflow-hidden rounded-lg border border-black/15 dark:border-white/15">
                            <img src={url} alt={`Gallery ${index + 1}`} className="h-24 w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                setProfileForm((prev) => ({
                                  ...prev,
                                  gallery: prev.gallery.filter((_, idx) => idx !== index),
                                }))
                              }}
                              className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-black/55 text-white"
                              aria-label={`Remove image ${index + 1}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">First name</span>
                    <input
                      name="profileFirstName"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Last name</span>
                    <input
                      name="profileLastName"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Role</span>
                    <select
                      name="profileRole"
                      value={profileForm.role}
                      onChange={(e) => {
                        const nextRole = e.target.value as StaffRole
                        setProfileForm((prev) => ({
                          ...prev,
                          role: nextRole,
                          category: normalizeCategoryForRole(nextRole, prev.category),
                        }))
                      }}
                      disabled={!profileCanEditRole}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-white"
                    >
                      {assignableRoles.map((role) => (
                        <option key={`profile-role-${role}`} value={role}>
                          {ROLE_FORM_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Department</span>
                    <select
                      name="profileCategory"
                      value={profileForm.category}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, category: e.target.value as StaffCategory }))}
                      disabled={!profileCanEditRole || Boolean(getFixedCategoryForRole(profileForm.role))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-white"
                    >
                      {((getFixedCategoryForRole(profileForm.role)
                        ? [getFixedCategoryForRole(profileForm.role)!]
                        : CATEGORY_OPTIONS) as StaffCategory[]).map((category) => (
                        <option key={`profile-category-${category}`} value={category}>
                          {CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Birth date</span>
                    <input
                      name="profileBirthDate"
                      type="date"
                      value={profileForm.birthDate}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Location</span>
                    <input
                      name="profileLocation"
                      value={profileForm.location}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, location: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs text-black/65 dark:text-white/65">Address line 1</span>
                    <input
                      name="profileAddressLine1"
                      value={profileForm.addressLine1}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, addressLine1: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs text-black/65 dark:text-white/65">Address line 2</span>
                    <input
                      name="profileAddressLine2"
                      value={profileForm.addressLine2}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, addressLine2: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">City</span>
                    <input
                      name="profileCity"
                      value={profileForm.city}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, city: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">State</span>
                    <input
                      name="profileState"
                      value={profileForm.state}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, state: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Postal code</span>
                    <input
                      name="profilePostalCode"
                      value={profileForm.postalCode}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, postalCode: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">Country</span>
                    <input
                      name="profileCountry"
                      value={profileForm.country}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, country: e.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs text-black/65 dark:text-white/65">PIN (4 digits)</span>
                    <input
                      name="profilePin"
                      value={profileForm.pin}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 4)
                        setProfileForm((prev) => ({ ...prev, pin: value }))
                      }}
                      placeholder={profileHasPin ? "Configured — type new PIN to replace" : "Set PIN"}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <label className="inline-flex items-end gap-2 pb-2 text-sm text-black/70 dark:text-white/70">
                    <input
                      name="profileClearPin"
                      type="checkbox"
                      checked={profileForm.clearPin}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, clearPin: e.target.checked }))}
                      className="h-4 w-4 rounded border-black/20 bg-white text-[var(--brand,#b61616)]"
                    />
                    Clear current PIN
                  </label>
                </div>

                <label className="space-y-1">
                  <span className="text-xs text-black/65 dark:text-white/65">Personal note</span>
                  <textarea
                    name="profilePersonalNote"
                    value={profileForm.personalNote}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, personalNote: e.target.value }))}
                    rows={3}
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                  />
                </label>

                {profileError ? (
                  <p className="rounded-md border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#b61616)]">
                    {profileError}
                  </p>
                ) : null}
                {profileSuccess ? (
                  <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                    {profileSuccess}
                  </p>
                ) : null}

                <div className="flex justify-end gap-2 border-t border-black/10 pt-3 dark:border-white/10">
                  <button
                    type="button"
                    onClick={closeProfileModal}
                    className="rounded-md border border-black/20 px-3 py-2 text-sm text-black dark:border-white/20 dark:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {profileSaving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
