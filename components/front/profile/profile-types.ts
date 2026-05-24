// Re-export types from profile-utils so consumers have a single import source
export type {
  ProfileFormState,
  ProfileUserSnapshot,
  ClerkUserSnapshot,
  ProfileSnapshot,
  ProfileUserSource,
  PackageAssignmentSummaryInput,
  PackageAssignmentSummary,
} from "./profile-utils"

export type ProfileStatus = "NEW" | "ACTIVE" | "ALUMNI"

export type ProfileSaveResponse = {
  error?: string
  profile?: import("./profile-utils").ProfileSnapshot | null
  profileComplete?: boolean
  pointsBalance?: number
}

export type PackageSummary = {
  activePackages: number
  unlimitedPackages: number
  totalRemainingCredits: number
  nextExpiration: string | null
}

export type ProfilePackageItem = {
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

export type ActivityStats = {
  classesTaken: number
  weeklyAverage: number
  streakWeeks: number
  recurringLabel: string | null
  lastClassLabel: string | null
}

export type MetricKey = "attendance" | "progress" | "rhythm"
export type ActionRequestType = "CLASS_CHANGE" | "SUSPEND" | "CANCEL"

export type BookingItem = {
  id: string
  status: string
  startsAt: string
  courseSlug: string
  courseTitle: string
  sessionId: string
  packagePurchaseId: string | null
  packageLabel: string | null
}

export type AssignablePackage = {
  id: string
  packageId: string
  label: string
  courseSlug: string | null
  remainingCredits: number | null
  totalCredits: number | null
  isUnlimited: boolean
  expiresAt: string | null
}

export type SlotAvailability = {
  time: string
  label: string
  isFull: boolean
  spotsLeft: number
  capacity: number
  isPast?: boolean
}

export type CachedAvailabilityEntry = {
  slots: SlotAvailability[]
  cachedAt: number
}

export type PointsEntry = {
  id: string
  type: string
  points: number
  createdAt: string
  meta?: Record<string, unknown> | null
}

export type ActionRequestItem = {
  id: string
  type: ActionRequestType
  status: string
  message: string | null
  meta?: Record<string, unknown> | null
  createdAt: string
  resolvedAt: string | null
}
