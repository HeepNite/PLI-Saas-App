import type { StaffRole } from "@/lib/security/staff-role"
import type { StaffCategory, StaffPaymentPreference } from "@/lib/security/staff-category"
import type { StaffRequestStatus, StaffRequestType } from "@/lib/security/staff-request"

export type ReportsObjectiveFilter =
  | "all"
  | "monday_sales"
  | "class_quality"
  | "retention"
  | "package_mix"
  | "pending_recovery"

export type CoursePublicationMode = "publish_now" | "coming_soon" | "launch_date"
export type CourseSpecialDiscountType = "none" | "valentines_desc" | "christmas_desc" | "custom"

export const CATEGORY_OPTIONS: StaffCategory[] = ["front_desk", "manager", "teacher", "guest"]
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export const REPORT_OBJECTIVE_OPTIONS: Array<{ key: ReportsObjectiveFilter; label: string }> = [
  { key: "all", label: "All goals" },
  { key: "monday_sales", label: "Increase Monday sales" },
  { key: "class_quality", label: "Improve class quality" },
  { key: "retention", label: "Improve retention" },
  { key: "package_mix", label: "Grow package conversion" },
  { key: "pending_recovery", label: "Recover pending payments" },
]

export const REPORT_OBJECTIVE_LABELS: Record<Exclude<ReportsObjectiveFilter, "all">, string> = {
  monday_sales: "Monday sales",
  class_quality: "Class quality",
  retention: "Retention",
  package_mix: "Package conversion",
  pending_recovery: "Pending recovery",
}

export const REPORT_SUGGESTIONS_SOURCE_LABELS: Record<"local" | "mock" | "custom-http", string> = {
  local: "Local rules",
  mock: "Mock provider",
  "custom-http": "External API",
}

export const CATEGORY_LABELS: Record<StaffCategory, string> = {
  front_desk: "Front desk",
  manager: "Managers",
  teacher: "Teachers",
  guest: "Guest",
  partner: "Partner",
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  admin: "GM",
  staff: "Staff",
}

export const ROLE_FORM_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  admin: "Admin (GM)",
  staff: "Staff",
}

export const PAYMENT_PREFERENCE_LABELS: Record<StaffPaymentPreference, string> = {
  cash: "Cash",
  direct_deposit: "Direct Deposit (ACH)",
  zelle: "Zelle / Venmo",
  mercadopago: "Mercado Pago",
  stripe: "Stripe Payouts",
  credits: "Internal Credits (Internship)",
}

export const REQUEST_TYPE_LABELS: Record<StaffRequestType, string> = {
  STAFF_DAY_OFF: "Day off",
  STAFF_SHIFT_SWAP: "Shift swap",
  STAFF_SCHEDULE_CHANGE: "Schedule change",
  STAFF_PAY_ADVANCE: "Pay advance",
  STAFF_SHIFT_COVER: "Shift cover",
  STAFF_GENERAL_QUERY: "General query",
}

export const PROFILE_REQUEST_TYPE_OPTIONS: Array<{ value: StaffRequestType; label: string; hint: string }> = [
  { value: "STAFF_SCHEDULE_CHANGE", label: "Schedule change", hint: "Request a shift/time update." },
  { value: "STAFF_DAY_OFF", label: "Vacation / day off", hint: "Ask for day off or vacation range." },
  { value: "STAFF_PAY_ADVANCE", label: "Payment request", hint: "Ask payroll/pay advance support." },
  { value: "STAFF_SHIFT_SWAP", label: "Shift swap", hint: "Swap shift with another teammate." },
  { value: "STAFF_GENERAL_QUERY", label: "Consultation", hint: "General question or support request." },
]

export const REQUEST_STATUS_OPTIONS: StaffRequestStatus[] = ["PENDING", "IN_REVIEW", "APPROVED", "REJECTED"]
export const PROFILE_REQUEST_STATUS_OPTIONS: Array<StaffRequestStatus | "all"> = ["all", "PENDING", "IN_REVIEW", "APPROVED", "REJECTED"]

export const WEEKDAY_LABELS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
export const SCHOOL_COURSE_KINDS = ["course", "program", "bootcamp", "workshop", "convention", "congress"]
export const SPECIAL_EVENT_COURSE_KINDS = new Set(["bootcamp", "workshop", "convention", "congress"])

export const COURSE_KIND_DATE_TONE: Record<string, "course" | "program" | "bootcamp" | "workshop" | "convention" | "event" | "warning"> = {
  course: "course",
  program: "program",
  bootcamp: "bootcamp",
  workshop: "workshop",
  convention: "convention",
  congress: "event",
}

export const COURSE_KIND_LABELS: Record<string, string> = {
  course: "Course",
  program: "Program",
  bootcamp: "Bootcamp",
  workshop: "Workshop",
  convention: "Convention",
  congress: "Congress",
}

export const COURSE_KIND_REVIEW_HINTS: Record<string, string> = {
  course: "Base weekly format.",
  program: "Class path by module.",
  bootcamp: "Intensive with limited spots.",
  workshop: "Themed special session.",
  convention: "Single high-impact event.",
  congress: "Congress-style event with full program blocks.",
}

export const COURSE_PUBLICATION_MODE_OPTIONS: Array<{ value: CoursePublicationMode; label: string }> = [
  { value: "publish_now", label: "Publish now" },
  { value: "coming_soon", label: "Coming soon" },
  { value: "launch_date", label: "Launch date" },
]

export const COURSE_SPECIAL_DISCOUNT_OPTIONS: Array<{ value: CourseSpecialDiscountType; label: string }> = [
  { value: "none", label: "No special discount" },
  { value: "valentines_desc", label: "San Valentin desc" },
  { value: "christmas_desc", label: "Navidad desc" },
  { value: "custom", label: "Custom discount" },
]

export const QUICK_SCHEDULE_SLOT_COUNT = 12
export const DEFAULT_QUICK_SCHEDULE_TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"]
export const SCHOOL_SCHEDULE_SHORTCUTS_STORAGE_KEY = "pli:staff:school:schedule-shortcuts:v1"
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const SCHEDULE_SHORTCUT_TONES = [
  "bg-gradient-to-br from-[var(--brand,#b61616)]/14 via-[var(--brand,#b61616)]/8 to-transparent dark:from-[var(--brand,#b61616)]/26 dark:via-[#1a1430]/58 dark:to-[#0a0f23]/88",
  "bg-gradient-to-br from-[#f59e0b]/14 via-[var(--brand,#b61616)]/8 to-transparent dark:from-[#f59e0b]/18 dark:via-[#221631]/56 dark:to-[#0a0f23]/88",
  "bg-gradient-to-br from-[#3b82f6]/12 via-[var(--brand,#b61616)]/8 to-transparent dark:from-[#2563eb]/14 dark:via-[#171b38]/58 dark:to-[#0a0f23]/88",
]

export const getFixedCategoryForRole = (role: StaffRole): StaffCategory | null => {
  if (role === "owner") return "partner"
  if (role === "admin") return "manager"
  return null
}

export const normalizeCategoryForRole = (role: StaffRole, category: StaffCategory): StaffCategory =>
  getFixedCategoryForRole(role) || category
