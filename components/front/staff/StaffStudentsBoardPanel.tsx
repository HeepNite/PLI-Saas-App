"use client"

import React from "react"
import Image from "next/image"
import { Mail, MapPin, Phone, RefreshCw } from "lucide-react"

import {
  type CardVariantConfig,
  type CardContext,
  type HistoryStudentCardAggregate,
  type StudentProfileCard,
  buildHistoryStudentPaidEntries,
  resolveHistoryStudentCardAmountPaidCents,
} from "@/components/front/staff/historyCardAggregates"
import { ClerkSyncMismatchBanner } from "@/components/front/staff/ClerkSyncMismatchBanner"
import {
  checkInStateTone,
  resolveStudentPinTone,
} from "./paymentState"
import {
  formatIsoDateLong,
  formatStudentPaymentCardDateTimeLabel,
  formatStudentPaymentCardSlotLabel,
} from "./studentPaymentCardFormatters"
import {
  getInitials,
  getOpenPaymentIds,
  paymentStateTone,
  PROFILE_CARD_BADGE_CLASS,
  resolveProfileCardBadges,
  resolveProfileCardDetailRows,
  resolveProfileSettlementControl,
  splitCustomerName,
} from "./staffPaymentCardPresentation"
import StaffPaymentsBoardControls from "./StaffPaymentsBoardControls"
import type { PaymentRow } from "./staffAdminTypes"
import type { StaffRole } from "@/lib/security/staff-role"
import { canOperateStudentEdits } from "@/lib/security/staff-access"
import type { StaffCategory } from "@/lib/security/staff-category"
import CreateStudentModal from "./CreateStudentModal"
import type { useStaffCreateStudentAdmin } from "./useStaffCreateStudentAdmin"

type FastClassActionPromoOffer = {
  linkedCourseSlug: string
  linkedCourseTitle: string
  linkedFromCourseSlug: string
  priceCents: number
}

type FastClassActionResponse = {
  mode: "fast_pay" | "fast_sign_in" | "promo_cash"
  promoOffer?: FastClassActionPromoOffer | null
  error?: string
}

// ---------------------------------------------------------------------------
// Local helpers (panel-private, moved from StaffUsersAdminClient so callers
// no longer need to thread date formatters through props).
// ---------------------------------------------------------------------------

const formatTerminalAlertDateTime = (value: string | null) => {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(parsed)
}

const formatTerminalAlertRelative = (value: string | null, nowTs: number) => {
  if (!value) return null
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  const diffMs = parsed - nowTs
  if (diffMs <= 0) return "ending now"
  const diffMinutes = Math.max(1, Math.ceil(diffMs / 60_000))
  return diffMinutes === 1 ? "ends in 1 min" : `ends in ${diffMinutes} min`
}

// ---------------------------------------------------------------------------
// Grouped prop types — kept narrow so the surface is human-readable.
// ---------------------------------------------------------------------------

type ClerkSyncMismatch = {
  userId: string
  clerkId: string
  email: string | null
  fields: Array<"name" | "email" | "phone">
  clerk: { name: string | null; email: string | null; phone: string | null }
  db: { name: string | null; email: string | null; phone: string | null }
}

type ClerkSyncHealth = {
  clerkUsers: number
  dbUsersWithClerkId: number
  missingCount: number
  missingUsers: Array<{ clerkId: string; email: string | null }>
  mismatchedCount?: number
  mismatchedUsers?: ClerkSyncMismatch[]
}

export type TerminalPinAlert = {
  terminalId: string
  terminalName: string
  terminalLocation: string | null
  severity: "warning" | "cooldown" | "emergency"
  label: string
  message: string
  blockedUntil: string | null
  missCount: number
}

export type StudentsBoardLoadingProps = {
  paymentsLoading: boolean
  onRefreshPaymentsBoard: () => void
}

export type StudentsBoardClerkSyncProps = {
  canManageClerkSync: boolean
  clerkSyncLoading: boolean
  clerkSyncRepairing: boolean
  clerkSyncError: string | null
  clerkSyncMessage: string | null
  clerkSyncHealth: ClerkSyncHealth | null
  onCheckClerkSync: () => void
  onRepairClerkSync: () => void
  clerkMismatchByUserId: Map<string, ClerkSyncMismatch>
  clerkSyncUserBusyId: string | null
  onSyncClerkUser: (userId: string) => void
}

export type StudentsBoardTerminalAlertsProps = {
  prioritizedTerminalPinAlerts: TerminalPinAlert[]
  hasAnyTerminalPinAlerts: boolean
  nowTs: number
}

export type StudentsBoardPaginationProps = {
  currentPage: number
  totalPages: number
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>
}

export type PaymentBackedStudentCard = HistoryStudentCardAggregate<PaymentRow>
export type AnyStudentCardForPanel = PaymentBackedStudentCard | StudentProfileCard

export type StudentsBoardCardsProps = {
  displayedStudentCards: AnyStudentCardForPanel[]
  filteredStudentCardsCount: number
  searchResultCards: AnyStudentCardForPanel[] | null
  shouldPreservePaymentBoard: boolean
  cardContext: CardContext
  cardVariant: CardVariantConfig
  studentSearchQuery: string
  historyFrom: string
  historyTo: string
  selectedPaymentIds: string[]
  selectPaymentIds: (ids: string[]) => void
  deselectPaymentIds: (ids: string[]) => void
  onSettlementBulkUpdate: (
    action: "mark_paid" | "mark_pending",
    ids: string[],
  ) => void
  paymentHistoryStudentId: string | null
  attendanceHistoryStudentId: string | null
  setPaymentHistoryAnchor: React.Dispatch<React.SetStateAction<HTMLElement | null>>
  setAttendanceHistoryAnchor: React.Dispatch<React.SetStateAction<HTMLElement | null>>
  setPaymentHistoryStudentId: React.Dispatch<React.SetStateAction<string | null>>
  setAttendanceHistoryStudentId: React.Dispatch<React.SetStateAction<string | null>>
  setAuditHistoryAnchor: React.Dispatch<React.SetStateAction<HTMLElement | null>>
  setAuditHistoryStudentId: React.Dispatch<React.SetStateAction<string | null>>
  setAuditHistoryStudentName: React.Dispatch<React.SetStateAction<string | null>>
  usersWithAuditEntries: Set<string>
  canOperateStudentPins: boolean
  openStudentPinModal: (payment: PaymentRow) => void
  openStudentPinModalForProfile: (student: StudentProfileCard) => void
  openOverrideModal: (studentId: string, studentName: string) => void
  currentRole: StaffRole
  currentCategory: StaffCategory | null
  formatMoney: (cents: number, currency?: string) => string
}

type StaffPaymentsBoardControlsProps = React.ComponentProps<
  typeof StaffPaymentsBoardControls
>

const resolveMasonryColumnCount = () => {
  if (typeof window === "undefined") return 1
  if (window.matchMedia("(min-width: 1280px)").matches) return 3
  if (window.matchMedia("(min-width: 640px)").matches) return 2
  return 1
}

export type StudentsBoardCreateStudentProps = ReturnType<typeof useStaffCreateStudentAdmin> | null

export type StaffStudentsBoardPanelProps = {
  isStudentsView: boolean
  loadingStatus: StudentsBoardLoadingProps
  clerkSync: StudentsBoardClerkSyncProps
  terminalAlerts: StudentsBoardTerminalAlertsProps
  controls: StaffPaymentsBoardControlsProps
  cards: StudentsBoardCardsProps
  pagination: StudentsBoardPaginationProps
  createStudent?: StudentsBoardCreateStudentProps
}

const ClerkSyncContext = React.createContext<StudentsBoardClerkSyncProps | null>(null)

// ---------------------------------------------------------------------------
// Internal sub-components — kept inside this file to avoid file sprawl
// while still letting the main panel read top-down.
// ---------------------------------------------------------------------------

function ClerkSyncBanner({
  canManageClerkSync,
  clerkSyncLoading,
  clerkSyncRepairing,
  clerkSyncError,
  clerkSyncMessage,
  clerkSyncHealth,
  onCheckClerkSync,
  onRepairClerkSync,
}: StudentsBoardClerkSyncProps) {
  const hasMissing = (clerkSyncHealth?.missingCount ?? 0) > 0
  const hasMismatched = (clerkSyncHealth?.mismatchedCount ?? 0) > 0
  const shouldRender =
    canManageClerkSync &&
    (clerkSyncLoading || clerkSyncRepairing || clerkSyncError || hasMissing || hasMismatched)

  if (!shouldRender) return null

  const statusLabel = clerkSyncLoading
    ? "Checking users"
    : clerkSyncRepairing
      ? "Syncing users"
      : "Users need sync"

  const healthMessage = (() => {
    if (!clerkSyncHealth) return "Checking whether all users are ready to use the app."
    const missing = clerkSyncHealth.missingCount
    const mismatched = clerkSyncHealth.mismatchedCount ?? 0
    if (missing > 0 && mismatched > 0) {
      return `${missing} user${missing === 1 ? "" : "s"} missing and ${mismatched} with outdated info — sync recommended.`
    }
    if (missing > 0) {
      return `${missing} user${missing === 1 ? "" : "s"} need to be synced before they can use the app.`
    }
    if (mismatched > 0) {
      return `${mismatched} student${mismatched === 1 ? " has" : "s have"} outdated info vs Clerk. Sync per student in the cards below (phone is locked).`
    }
    return "All users are up to date."
  })()

  return (
    <div className="mb-4 rounded-2xl border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/8 p-3 shadow-[0_14px_28px_-20px_rgba(0,0,0,0.65)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--brand,#b61616)]/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand,#b61616)] dark:text-[var(--brand,#ff4b4b)]">
              {statusLabel}
            </span>
            <p className="text-sm text-black/70 dark:text-white/70">{healthMessage}</p>
          </div>
          {clerkSyncError ? (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{clerkSyncError}</p>
          ) : null}
          {clerkSyncMessage ? (
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-300">{clerkSyncMessage}</p>
          ) : null}
          {clerkSyncHealth && clerkSyncHealth.missingCount > 0 ? (
            <p className="mt-1 text-xs text-black/60 dark:text-white/60">
              Users to sync: {clerkSyncHealth.missingUsers
                .slice(0, 3)
                .map((user) => user.email || "User without email")
                .join(", ")}
              {clerkSyncHealth.missingCount > 3 ? ` +${clerkSyncHealth.missingCount - 3} more` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCheckClerkSync()}
            disabled={clerkSyncLoading || clerkSyncRepairing}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-black/20 px-3 text-xs font-medium text-black/70 transition hover:border-[var(--brand,#b61616)]/60 hover:text-[var(--brand,#b61616)] disabled:opacity-50 dark:border-white/20 dark:text-white/70"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${clerkSyncLoading ? "animate-spin" : ""}`} />
            Check users
          </button>
          <button
            type="button"
            onClick={() => onRepairClerkSync()}
            disabled={clerkSyncLoading || clerkSyncRepairing}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--brand,#b61616)]/60 bg-[var(--brand,#b61616)]/12 px-3 text-xs font-semibold text-[var(--brand,#b61616)] transition hover:bg-[var(--brand,#b61616)]/18 disabled:opacity-50 dark:text-[var(--brand,#ff4b4b)]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${clerkSyncRepairing ? "animate-spin" : ""}`} />
            {clerkSyncRepairing ? "Syncing..." : "Sync users"}
          </button>
        </div>
      </div>
    </div>
  )
}

function TerminalPinAlertsStrip({
  prioritizedTerminalPinAlerts,
  hasAnyTerminalPinAlerts,
  nowTs,
}: StudentsBoardTerminalAlertsProps) {
  if (prioritizedTerminalPinAlerts.length === 0) return null
  const refreshIntervalSeconds = hasAnyTerminalPinAlerts ? 5 : 10

  return (
    <div className="mb-4 rounded-2xl border border-[var(--brand,#b61616)]/18 bg-[linear-gradient(145deg,rgba(182,22,22,0.08),rgba(17,20,31,0.92))] p-3 shadow-[0_14px_28px_-20px_rgba(0,0,0,0.65)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand,#b61616)]">
            Terminal alerts
          </span>
          <p className="text-sm text-black/70 dark:text-white/70">
            PIN issues needing attention from terminal flow.
          </p>
        </div>
        <p className="text-xs text-black/55 dark:text-white/55">
          Auto-refresh every {refreshIntervalSeconds}s
        </p>
      </div>
      <div className="mt-3 grid gap-2 xl:grid-cols-2">
        {prioritizedTerminalPinAlerts.map((alert) => (
          <div
            key={`${alert.terminalId}-${alert.severity}-${alert.blockedUntil || "open"}`}
            className={`rounded-xl border px-3 py-2 text-sm dark:bg-white/[0.04] ${
              alert.severity === "emergency"
                ? "border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/8"
                : alert.severity === "cooldown"
                  ? "border-amber-500/25 bg-amber-500/8"
                  : "border-yellow-500/20 bg-yellow-500/8"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-black dark:text-white">{alert.terminalName}</span>
                {alert.terminalLocation ? (
                  <span className="text-[11px] uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
                    {alert.terminalLocation}
                  </span>
                ) : null}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                  alert.severity === "emergency"
                    ? "bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                    : alert.severity === "cooldown"
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                      : "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300"
                }`}
              >
                {alert.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-black/60 dark:text-white/60">
              Misses: {alert.missCount}
              {alert.blockedUntil
                ? ` · ${formatTerminalAlertRelative(alert.blockedUntil, nowTs)}`
                : ""}
            </p>
            <p className="mt-1 text-sm text-black/75 dark:text-white/75">{alert.message}</p>
            {alert.blockedUntil ? (
              <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                Until {formatTerminalAlertDateTime(alert.blockedUntil)}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main panel component
// ---------------------------------------------------------------------------

export default function StaffStudentsBoardPanel({
  isStudentsView,
  loadingStatus,
  clerkSync,
  terminalAlerts,
  controls,
  cards,
  pagination,
  createStudent,
}: StaffStudentsBoardPanelProps) {
  if (!isStudentsView) return null

  const { paymentsLoading, onRefreshPaymentsBoard } = loadingStatus
  const { currentPage, totalPages, setCurrentPage } = pagination

  return (
    <article
      id="students-payments"
      className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5"
    >
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Students</p>
          <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">
            Student payment board
          </h3>
          <p className="mt-1 text-sm text-black/65 dark:text-white/65">
            Grid view by student with class payment status, check-in and active package.
          </p>
        </div>
        <div className="mt-2 flex shrink-0 items-center gap-2">
          {createStudent && (
            <button
              type="button"
              onClick={createStudent.openModal}
              className="inline-flex items-center gap-1 h-9 whitespace-nowrap rounded-full border border-[var(--brand,#b61616)]/40 bg-[var(--brand,#b61616)]/10 px-3 text-xs font-medium text-[var(--brand,#b61616)] transition hover:bg-[var(--brand,#b61616)]/20 dark:border-[var(--brand,#b61616)]/40 dark:text-[var(--brand,#b61616)]"
              aria-label="Create new student"
            >
              + New student
            </button>
          )}
          <button
            type="button"
            onClick={() => onRefreshPaymentsBoard()}
            disabled={paymentsLoading}
            className="inline-flex items-center gap-1 h-9 whitespace-nowrap rounded-full border border-black/20 px-3 text-xs font-medium text-black/70 transition hover:border-[var(--brand,#b61616)]/60 hover:text-[var(--brand,#b61616)] disabled:opacity-50 dark:border-white/20 dark:text-white/70 dark:hover:border-[var(--brand,#b61616)]/60 dark:hover:text-[var(--brand,#b61616)]"
            aria-label="Refresh payments board"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${paymentsLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {createStudent && (
        <CreateStudentModal
          isOpen={createStudent.isOpen}
          form={createStudent.form}
          submitting={createStudent.submitting}
          error={createStudent.error}
          result={createStudent.result}
          hasAmount={createStudent.hasAmount}
          canSubmit={createStudent.canSubmit}
          onClose={createStudent.closeModal}
          onUpdateField={createStudent.updateField}
          onSubmit={createStudent.submit}
        />
      )}

      <ClerkSyncBanner {...clerkSync} />
      <TerminalPinAlertsStrip {...terminalAlerts} />

      <StaffPaymentsBoardControls {...controls} />

      <ClerkSyncContext.Provider value={clerkSync}>
        <StudentCardsGrid
          {...cards}
          paymentsLoading={paymentsLoading}
          onRefreshPaymentsBoard={onRefreshPaymentsBoard}
        />
      </ClerkSyncContext.Provider>

      {totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-4 py-3 text-sm text-white/80 shadow-[0_16px_32px_-24px_rgba(0,0,0,0.8)] backdrop-blur">
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white/85 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs uppercase tracking-[0.16em] text-white/55">
            Page {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white/85 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      ) : null}
    </article>
  )
}

// ---------------------------------------------------------------------------
// StudentCardsGrid — heavy card rendering kept as its own sub-component so the
// main panel reads top-down. Identical markup/behavior to the legacy block.
// ---------------------------------------------------------------------------

type StudentCardsGridProps = StudentsBoardCardsProps & {
  paymentsLoading: boolean
  onRefreshPaymentsBoard: () => void
}

const hasUsablePackageCredit = (activePackage: { remainingCredits: number | null; isUnlimited: boolean } | null | undefined) => {
  if (!activePackage) return false
  if (activePackage.isUnlimited) return true
  return typeof activePackage.remainingCredits === "number" && activePackage.remainingCredits > 0
}

const resolveFastClassActionLabel = (activePackage: { remainingCredits: number | null; isUnlimited: boolean } | null | undefined) =>
  hasUsablePackageCredit(activePackage) ? "Fast Sign-in" : "Fast Pay"

async function postFastClassAction(userId: string, promoOffer?: FastClassActionPromoOffer) {
  const response = await fetch("/api/staff/students/fast-class-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      promoOffer
        ? { userId, acceptConsecutive: true, promo: promoOffer }
        : { userId },
    ),
  })
  const payload = await response.json().catch(() => ({})) as FastClassActionResponse
  if (!response.ok) {
    throw new Error(payload.error || "Fast class action failed")
  }
  return payload
}

function StudentCardsGrid(props: StudentCardsGridProps) {
  const {
    paymentsLoading,
    displayedStudentCards,
    filteredStudentCardsCount,
    searchResultCards,
    shouldPreservePaymentBoard,
    cardContext,
    studentSearchQuery,
    historyFrom,
    historyTo,
  } = props
  const [masonryColumnCount, setMasonryColumnCount] = React.useState(resolveMasonryColumnCount)

  React.useEffect(() => {
    const mediaQueries = [
      window.matchMedia("(min-width: 1280px)"),
      window.matchMedia("(min-width: 640px)"),
    ]
    const updateColumnCount = () => setMasonryColumnCount(resolveMasonryColumnCount())

    updateColumnCount()
    mediaQueries.forEach((query) => query.addEventListener("change", updateColumnCount))
    return () => mediaQueries.forEach((query) => query.removeEventListener("change", updateColumnCount))
  }, [])

  const renderStudentCard = (student: AnyStudentCardForPanel) =>
    student.source === "profile" ? (
      <ProfileStudentCard
        key={`student-card-${student.key}`}
        student={student}
        {...props}
      />
    ) : (
      <PaymentStudentCard
        key={`student-card-${student.key}`}
        student={student}
        {...props}
      />
    )

  const getCardPurchaseSource = (card: AnyStudentCardForPanel): string | undefined =>
    card.source === "payment" ? card.latestPayment.purchaseSource : undefined

  const { webCards, kioskCards } = React.useMemo(() => {
    const web: AnyStudentCardForPanel[] = []
    const kiosk: AnyStudentCardForPanel[] = []
    for (const card of displayedStudentCards) {
      const source = getCardPurchaseSource(card)
      if (source === "kiosk") {
        kiosk.push(card)
      } else {
        web.push(card)
      }
    }
    return { webCards: web, kioskCards: kiosk }
  }, [displayedStudentCards])

  const buildMasonryColumns = React.useCallback(
    (cards: AnyStudentCardForPanel[]) =>
      cards.reduce<Array<AnyStudentCardForPanel[]>>(
        (columns, student, index) => {
          columns[index % columns.length].push(student)
          return columns
        },
        Array.from({ length: masonryColumnCount }, () => []),
      ),
    [masonryColumnCount],
  )

  const webMasonryColumns = React.useMemo(() => buildMasonryColumns(webCards), [buildMasonryColumns, webCards])
  const kioskMasonryColumns = React.useMemo(() => buildMasonryColumns(kioskCards), [buildMasonryColumns, kioskCards])

  const hasBothSections = webCards.length > 0 && kioskCards.length > 0

  return (
    <>
      {cardContext === "global-search" ? (
        <p
          aria-live="polite"
          className="mt-5 rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-black/70 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70"
        >
          Search results for &quot;{studentSearchQuery.trim()}&quot;
        </p>
      ) : null}

      <div className="mt-5">
        {paymentsLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`students-skeleton-${index}`}
                className="h-[190px] rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 shimmer"
              />
            ))}
          </div>
        ) : cardContext === "global-search" && (searchResultCards?.length ?? 0) === 0 ? (
          <p className="col-span-full rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
            No students found.
          </p>
        ) : !searchResultCards &&
          !shouldPreservePaymentBoard &&
          filteredStudentCardsCount === 0 ? (
          <p className="col-span-full rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-black/65 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65">
            {cardContext === "history" && (!historyFrom || !historyTo)
              ? "Select a range to load payment history."
              : cardContext === "history" && historyFrom > historyTo
                ? "History range must start on or before the end date."
                : "No student payments found."}
          </p>
        ) : (
          <div className="space-y-6">
            {webCards.length > 0 && (
              <section>
                {hasBothSections && (
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-400/80">
                    Web / Front desk
                  </p>
                )}
                <div className="grid max-h-none grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {webMasonryColumns.map((column, columnIndex) => (
                    <div key={`web-card-column-${columnIndex}`} className="flex flex-col gap-5">
                      {column.map(renderStudentCard)}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {kioskCards.length > 0 && (
              <section>
                {hasBothSections && (
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400/80">
                    Kiosk / Terminal
                  </p>
                )}
                <div className="grid max-h-none grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {kioskMasonryColumns.map((column, columnIndex) => (
                    <div key={`kiosk-card-column-${columnIndex}`} className="flex flex-col gap-5">
                      {column.map(renderStudentCard)}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// ProfileStudentCard — render profile-source student cards (no payment yet).
// ---------------------------------------------------------------------------

type FastClassActionControlsProps = {
  activePackage: { remainingCredits: number | null; isUnlimited: boolean } | null | undefined
  disabled?: boolean
  studentName: string
  userId: string | null
  onRefreshPaymentsBoard: () => void
}

function FastClassActionControls({
  activePackage,
  disabled = false,
  studentName,
  userId,
  onRefreshPaymentsBoard,
}: FastClassActionControlsProps) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [promoOffer, setPromoOffer] = React.useState<FastClassActionPromoOffer | null>(null)
  const label = resolveFastClassActionLabel(activePackage)
  const isDisabled = disabled || busy || !userId

  const runFastAction = async () => {
    if (!userId) return
    setBusy(true)
    setError(null)
    try {
      const result = await postFastClassAction(userId)
      await onRefreshPaymentsBoard()
      setPromoOffer(result.promoOffer || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fast class action failed")
    } finally {
      setBusy(false)
    }
  }

  const acceptPromo = async () => {
    if (!userId || !promoOffer) return
    setBusy(true)
    setError(null)
    try {
      await postFastClassAction(userId, promoOffer)
      setPromoOffer(null)
      await onRefreshPaymentsBoard()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Promo check-in failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={runFastAction}
        disabled={isDisabled}
        className="rounded-md border border-emerald-300/35 bg-emerald-400/12 px-2 py-1 text-[11px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`${label} for ${studentName}`}
      >
        {busy ? "Working…" : label}
      </button>
      {error ? <p className="col-span-full text-[11px] text-red-300">{error}</p> : null}
      {promoOffer ? (
        <div className="col-span-full rounded-xl border border-amber-300/30 bg-amber-400/10 p-3 text-xs text-amber-50">
          <p className="font-semibold">Staying for the next class?</p>
          <p className="mt-1 text-amber-50/80">{promoOffer.linkedCourseTitle}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={acceptPromo}
              disabled={busy}
              className="rounded-md bg-amber-300 px-2.5 py-1 text-[11px] font-semibold text-black disabled:opacity-50"
            >
              Yes, add promo
            </button>
            <button
              type="button"
              onClick={() => setPromoOffer(null)}
              disabled={busy}
              className="rounded-md border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white/80 disabled:opacity-50"
            >
              No
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}

type ProfileStudentCardProps = StudentCardsGridProps & {
  student: StudentProfileCard
}

function ProfileStudentCard({
  student,
  selectedPaymentIds,
  selectPaymentIds,
  deselectPaymentIds,
  onSettlementBulkUpdate,
  setAuditHistoryAnchor,
  setAuditHistoryStudentId,
  setAuditHistoryStudentName,
  usersWithAuditEntries,
  canOperateStudentPins,
  openStudentPinModalForProfile,
  openOverrideModal,
  currentRole,
  currentCategory,
  paymentsLoading,
  onRefreshPaymentsBoard,
}: ProfileStudentCardProps) {
  const canEditStudentInfo = canOperateStudentEdits(currentRole, currentCategory)
  // Mirror legacy logic: identity, badges, detail rows and settlement control.
  const identity = splitCustomerName(student.displayName, student.email)
  const initials = getInitials(identity.firstName, identity.lastName, student.email)
  const badges = resolveProfileCardBadges(student)
  const detailRows = resolveProfileCardDetailRows(student)
  const settlementControl = resolveProfileSettlementControl(student)
  const isProfileSettlementSelected = settlementControl
    ? selectedPaymentIds.includes(settlementControl.paymentId)
    : false

  return (
    <article
      className={`relative rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 p-4 text-white ${settlementControl ? "pt-9" : ""}`}
    >
      {settlementControl ? (
        isProfileSettlementSelected ? (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSettlementBulkUpdate("mark_paid", [settlementControl.paymentId])}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--brand,#b61616)]/20 border border-[var(--brand,#b61616)]/40 px-2 py-1 text-[10px] font-semibold text-[var(--brand,#ff4b4b)] hover:bg-[var(--brand,#b61616)]/30 transition-colors"
            >
              Mark paid
            </button>
            <button
              type="button"
              onClick={() => deselectPaymentIds([settlementControl.paymentId])}
              className="inline-flex items-center rounded-md bg-black/30 px-1.5 py-1 text-[10px] text-white/60 hover:text-white/80 transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <label className="absolute right-3 top-3 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-black/30 px-2 py-1 text-[10px] text-white/80 backdrop-blur-sm">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[var(--brand,#b61616)]"
              checked={isProfileSettlementSelected}
              onChange={(event) => {
                const checked = event.target.checked
                if (checked) {
                  selectPaymentIds([settlementControl.paymentId])
                } else {
                  deselectPaymentIds([settlementControl.paymentId])
                }
              }}
            />
            Select
          </label>
        )
      ) : null}
      <header className="flex items-center gap-3">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-black/35 text-lg font-bold shadow-[0_14px_30px_-18px_rgba(0,0,0,0.85)]">
          {student.avatarUrl ? (
            <Image
              src={student.avatarUrl}
              alt={student.displayName}
              fill
              unoptimized
              sizes="64px"
              className="h-full w-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-lg font-semibold leading-tight">{student.displayName}</h4>
          <p className="mt-1 truncate text-[12px] text-white/70">
            Registered · {formatIsoDateLong(student.registeredAt)}
          </p>
        </div>
      </header>

      <ProfileClerkBanner student={student} />

      <div className="mt-4 w-full grid grid-cols-2 gap-2.5">
        {badges.map((badge) => (
          <span
            key={badge.key}
            title={badge.title}
            className={`${PROFILE_CARD_BADGE_CLASS} ${badge.tone}`}
          >
            {badge.label}
          </span>
        ))}
      </div>

      <div className="mt-4 space-y-2.5 border-t border-white/10 pt-3.5 text-xs text-white/85">
        {detailRows.map((row) => {
          const isOutstandingBalanceRow = row.key === "outstanding-balance"
          const baseRowClasses = "inline-flex w-full items-center justify-between gap-2 text-white/75"
          const rowClass = isOutstandingBalanceRow
            ? `${baseRowClasses} border-b border-[var(--brand,#b61616)]/40 pb-2 text-[var(--brand,#ff8b8b)]`
            : baseRowClasses
          const labelClass = `inline-flex items-center gap-1 ${
            isOutstandingBalanceRow
              ? "text-[var(--brand,#ff9e9e)]"
              : row.key === "location" || row.key === "email" || row.key === "phone"
                ? "text-white/70"
                : ""
          }`
          const valueClass = `truncate text-right ${
            isOutstandingBalanceRow ? "text-[var(--brand,#ffc0c0)]" : ""
          }`

          return (
            <p key={row.key} className={rowClass}>
              <span className={labelClass}>
                {row.key === "location" ? <MapPin className="h-3 w-3" /> : null}
                {row.key === "email" ? <Mail className="h-3 w-3" /> : null}
                {row.key === "phone" ? <Phone className="h-3 w-3" /> : null}
                {row.label}
              </span>
              <span className={valueClass}>{row.value}</span>
            </p>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <FastClassActionControls
          activePackage={student.activePackage}
          disabled={paymentsLoading}
          studentName={student.displayName}
          userId={student.userId}
          onRefreshPaymentsBoard={onRefreshPaymentsBoard}
        />
        <button
          type="button"
          onClick={() => {
            if (typeof window === "undefined" || !student.email || student.email === "—") return
            const subject = encodeURIComponent(`Student profile update · ${student.displayName}`)
            window.location.href = `mailto:${encodeURIComponent(student.email)}?subject=${subject}`
          }}
          className="rounded-md border border-white/20 px-2 py-1 text-[11px]"
        >
          Notify
        </button>
        {canOperateStudentPins && student.userId ? (
          <button
            type="button"
            onClick={() => openStudentPinModalForProfile(student)}
            className="rounded-md border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-[11px] font-semibold text-cyan-100"
          >
            {student.provisionalPinExpiresAt ? "Reissue PIN" : "Prov PIN"}
          </button>
        ) : null}
        {canEditStudentInfo && student.userId ? (
          <button
            type="button"
            onClick={() => openOverrideModal(student.userId, student.displayName)}
            className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/15 transition-colors"
          >
            Edit info
          </button>
        ) : null}
      </div>

      {canEditStudentInfo &&
        student.userId &&
        usersWithAuditEntries.has(student.userId) && (
          <div className="mt-3">
            <button
              type="button"
              onClick={(e) => {
                setAuditHistoryAnchor(e.currentTarget)
                setAuditHistoryStudentId(student.userId)
                setAuditHistoryStudentName(student.displayName)
              }}
              className="w-full rounded-md border border-white/15 px-2 py-1.5 text-[11px] text-white/60 hover:text-white/80 hover:border-white/25 transition-colors"
            >
              Change history
            </button>
          </div>
        )}
    </article>
  )
}

// Placeholder for the optional clerk-sync mismatch banner on the profile card
// header. Receives clerk sync context via React context to keep prop wiring
// readable; the legacy code wired it directly so we keep that behavior by
// reading from the closure via a small wrapper.
type ProfileClerkBannerProps = { student: StudentProfileCard }

function ProfileClerkBanner({ student }: ProfileClerkBannerProps) {
  return <ClerkSyncUserBanner userId={student.userId} />
}

// ---------------------------------------------------------------------------
// PaymentStudentCard — render payment-backed student cards.
// ---------------------------------------------------------------------------

type PaymentStudentCardProps = StudentCardsGridProps & {
  student: PaymentBackedStudentCard
}

function PaymentStudentCard({
  student,
  cardVariant,
  selectedPaymentIds,
  selectPaymentIds,
  deselectPaymentIds,
  onSettlementBulkUpdate,
  paymentHistoryStudentId,
  attendanceHistoryStudentId,
  setPaymentHistoryAnchor,
  setAttendanceHistoryAnchor,
  setPaymentHistoryStudentId,
  setAttendanceHistoryStudentId,
  setAuditHistoryAnchor,
  setAuditHistoryStudentId,
  setAuditHistoryStudentName,
  usersWithAuditEntries,
  canOperateStudentPins,
  openStudentPinModal,
  openOverrideModal,
  currentRole,
  currentCategory,
  formatMoney,
  paymentsLoading,
  onRefreshPaymentsBoard,
}: PaymentStudentCardProps) {
  const canEditStudentInfo = canOperateStudentEdits(currentRole, currentCategory)
  const payment = student.latestPayment
  const identity = splitCustomerName(payment.customerName, payment.customerEmail)
  const initials = getInitials(identity.firstName, identity.lastName, payment.customerEmail)
  const packageLabel = payment.activePackage?.label || "No active package"
  const packageValue = payment.activePackage
    ? payment.activePackage.isUnlimited
      ? "Unlimited"
      : payment.activePackage.totalCredits
        ? `${Math.max(0, payment.activePackage.remainingCredits || 0)} of ${payment.activePackage.totalCredits} remaining`
        : `${Math.max(0, payment.activePackage.remainingCredits || 0)} credits remaining`
    : "—"
  const outstandingBalanceLabel =
    typeof payment.outstandingBalance === "number" && payment.outstandingBalance > 0
      ? formatMoney(payment.outstandingBalance, payment.currency)
      : null
  const paidEntries =
    cardVariant.context === "daily"
      ? buildHistoryStudentPaidEntries(student.allPayments)
      : student.allPayments.filter((entry) => entry.classPaid).slice(0, 12)
  const totalSpentCents = resolveHistoryStudentCardAmountPaidCents(student, cardVariant.context)
  const totalSpentLabel = formatMoney(totalSpentCents, payment.currency)
  const subtitleSlotLabel = formatStudentPaymentCardSlotLabel(payment.classDate, payment.classTime)
  const courseUnion = [
    ...new Set(
      student.allPayments.map((entry) => entry.courseTitle || entry.courseSlug).filter(Boolean),
    ),
  ]
  const studentOpenIds = getOpenPaymentIds(student.allPayments)
  const studentSelectableIds =
    studentOpenIds.length > 0
      ? studentOpenIds
      : student.allPayments.filter((p) => p.paymentChannel === "cash").map((p) => p.id)
  const isSelected = studentSelectableIds.some((id) => selectedPaymentIds.includes(id))
  const studentPinLabel = payment.studentPin.enabled
    ? payment.studentPin.provisionalActive
      ? "Prov PIN"
      : "Enrolled PIN"
    : null
  const studentPinTone = resolveStudentPinTone(payment.studentPin)
  const pointsHistoryEntries = payment.pointsHistory.slice(0, 10)

  return (
    <article
      className={`relative rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5 p-4 text-white ${
        payment.paymentChannel === "cash" ? "pt-9" : ""
      }`}
    >
      {payment.paymentChannel === "cash" ||
      (typeof payment.outstandingBalance === "number" && payment.outstandingBalance > 0) ? (
        isSelected ? (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                onSettlementBulkUpdate(
                  payment.settlementStatus === "paid" ? "mark_pending" : "mark_paid",
                  payment.settlementStatus === "paid"
                    ? [payment.id]
                    : getOpenPaymentIds(student.allPayments),
                )
              }
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                payment.settlementStatus === "paid"
                  ? "bg-amber-500/30 border border-amber-500/50 text-amber-200 hover:bg-amber-500/40"
                  : "bg-emerald-500/30 border border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/40"
              }`}
            >
              {payment.settlementStatus === "paid" ? "Mark pending" : "Mark paid"}
            </button>
            <button
              type="button"
              onClick={() => deselectPaymentIds(studentSelectableIds)}
              className="inline-flex items-center rounded-md bg-black/40 border border-white/20 px-1.5 py-1 text-[10px] text-white/60 hover:text-white/80 transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <label className="absolute right-3 top-3 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-black/30 px-2 py-1 text-[10px] text-white/80 backdrop-blur-sm">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[var(--brand,#b61616)]"
              checked={isSelected}
              onChange={(event) => {
                const checked = event.target.checked
                if (checked) {
                  selectPaymentIds(studentSelectableIds)
                } else {
                  deselectPaymentIds(studentSelectableIds)
                }
              }}
            />
            Select
          </label>
        )
      ) : null}
      <header className="flex items-center gap-3">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-black/35 text-lg font-bold shadow-[0_14px_30px_-18px_rgba(0,0,0,0.85)]">
          {payment.customerAvatarUrl ? (
            <Image
              src={payment.customerAvatarUrl}
              alt={identity.fullName}
              fill
              unoptimized
              sizes="64px"
              className="h-full w-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-lg font-semibold leading-tight">{identity.fullName}</h4>
          <span className="group relative block cursor-help">
            <p
              className="mt-1 truncate text-[12px] text-white/70"
              title={
                cardVariant.showHistoryTooltip
                  ? courseUnion.join(" · ") || "No class slots"
                  : `${payment.courseTitle} · ${subtitleSlotLabel}`
              }
            >
              {cardVariant.showHistorySubtitle
                ? `${student.totalPayments} records · ${courseUnion.slice(0, 2).join(" · ") || "No class slots"}`
                : `${payment.courseTitle} · ${subtitleSlotLabel}`}
            </p>
            <span className="pointer-events-none invisible absolute bottom-full left-0 z-30 mb-1 w-max max-w-[18rem] rounded-md border border-white/20 bg-[#131622]/95 px-2.5 py-1.5 text-left text-[11px] text-white/90 opacity-0 shadow-[0_16px_24px_-14px_rgba(0,0,0,0.8)] transition-all duration-150 group-hover:visible group-hover:opacity-100">
              {cardVariant.showHistoryTooltip
                ? courseUnion.join(" · ") || "No class slots in range"
                : `${payment.courseTitle} · ${subtitleSlotLabel}`}
            </span>
          </span>
        </div>
      </header>

      <PaymentClerkBanner payment={payment} />


      <div className="mt-4 w-full grid grid-cols-2 gap-1.5">
        <button
          type="button"
          ref={(el) => {
            if (el && paymentHistoryStudentId === payment.userId) {
              setPaymentHistoryAnchor(el)
            }
          }}
          onClick={() => {
            setPaymentHistoryStudentId(payment.userId)
            setAttendanceHistoryStudentId(null)
            setAttendanceHistoryAnchor(null)
          }}
          className={`w-full flex cursor-pointer items-center justify-center rounded-md border px-3 py-1.5 text-[11px] font-semibold hover:opacity-80 transition-opacity ${paymentStateTone(payment)}`}
        >
          Pmt History
        </button>
        <button
          type="button"
          ref={(el) => {
            if (el && attendanceHistoryStudentId === payment.userId) {
              setAttendanceHistoryAnchor(el)
            }
          }}
          onClick={() => {
            setAttendanceHistoryStudentId(payment.userId)
            setPaymentHistoryStudentId(null)
            setPaymentHistoryAnchor(null)
          }}
          className={`w-full flex cursor-pointer items-center justify-center rounded-md border px-3 py-1.5 text-[11px] font-semibold hover:opacity-80 transition-opacity ${checkInStateTone(payment)}`}
        >
          Attendance
        </button>
        {studentPinLabel && studentPinTone ? (
          <span
            className={`w-full flex items-center justify-center rounded-md border px-3 py-1.5 text-[11px] font-semibold ${studentPinTone}`}
          >
            {studentPinLabel}
          </span>
        ) : (
          <span className="w-full flex items-center justify-center rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/30">
            —
          </span>
        )}
        <span className="group relative w-full flex cursor-help items-center justify-center rounded-md border border-amber-400/35 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200">
          Points: {payment.pointsBalance}
          <span className="pointer-events-auto invisible absolute bottom-full left-0 z-[200] max-h-44 w-[16rem] -translate-x-1/2 translate-y-1 overflow-y-auto overscroll-contain rounded-md border border-white/20 bg-[#131622]/95 px-2.5 py-1.5 text-left text-[11px] text-white/90 opacity-0 shadow-[0_16px_24px_-14px_rgba(0,0,0,0.8)] transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
            <span className="font-semibold text-white">Points history</span>
            <span className="mt-1 block border-t border-white/10" />
            {pointsHistoryEntries.length === 0 ? (
              <span className="mt-1 block text-white/70">No points events yet.</span>
            ) : (
              pointsHistoryEntries.map((entry, index) => (
                <span
                  key={`points-history-${entry.id}`}
                  className={`block text-white/85 ${index === 0 ? "mt-1" : "mt-1 border-t border-white/10 pt-1"}`}
                >
                  <span className="font-semibold text-amber-200">
                    {entry.points > 0 ? `+${entry.points}` : entry.points}
                  </span>
                  <span className="ml-1 capitalize">
                    {entry.type.replaceAll("_", " ").toLowerCase()}
                  </span>
                  <span className="mt-0.5 block text-white/65">
                    {formatStudentPaymentCardDateTimeLabel(entry.createdAt)}
                  </span>
                </span>
              ))
            )}
          </span>
        </span>
      </div>

      <div className="mt-4 space-y-2.5 border-t border-white/10 pt-3.5 text-xs text-white/85">
        <p className="inline-flex w-full items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-white/70">
            <MapPin className="h-3 w-3" />
            Location
          </span>
          <span className="truncate text-right">{payment.location || "—"}</span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-white/70">
            <Mail className="h-3 w-3" />
            Email
          </span>
          <span className="truncate text-right">{payment.customerEmail || "—"}</span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-white/70">
            <Phone className="h-3 w-3" />
            Phone
          </span>
          <span className="truncate text-right">{payment.customerPhone || "—"}</span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
          <span>Package</span>
          <span className="truncate text-right">{packageLabel}</span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
          <span>Amount paid</span>
          <span className="group relative max-w-[62%] cursor-help text-right">
            <span className="truncate text-right">{totalSpentLabel}</span>
            <span className="pointer-events-auto invisible absolute bottom-full right-0 z-[200] max-h-52 w-[17rem] overflow-y-auto overscroll-contain rounded-md border border-white/20 bg-[#131622]/95 px-2.5 py-1.5 text-left text-[11px] text-white/90 opacity-0 shadow-[0_16px_24px_-14px_rgba(0,0,0,0.8)] transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <span className="font-semibold text-white">Paid entries</span>
              <span className="mt-1 block border-t border-white/10" />
              {paidEntries.length === 0 ? (
                <span className="mt-1 block text-white/70">No paid entries in this selection.</span>
              ) : (
                paidEntries.slice(0, 12).map((entry, index) => (
                  <span
                    key={`paid-history-${entry.id}`}
                    className={`block text-white/85 ${index === 0 ? "mt-1" : "mt-1 border-t border-white/10 pt-1"}`}
                  >
                    <span className="block">{entry.courseTitle || "Package payment"}</span>
                    <span className="mt-0.5 block text-white/65">
                      {formatMoney(entry.amount, entry.currency)} ·{" "}
                      {formatStudentPaymentCardDateTimeLabel(entry.createdAt)}
                    </span>
                  </span>
                ))
              )}
            </span>
          </span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
          <span>Credits</span>
          <span>{packageValue}</span>
        </p>
        {outstandingBalanceLabel ? (
          <p className="inline-flex w-full items-center justify-between gap-2 border-b border-[var(--brand,#b61616)]/40 pb-2 text-[var(--brand,#ff9e9e)]">
            <span>Outstanding balance</span>
            <span className="group relative text-[var(--brand,#ffc0c0)]">
              <span className="cursor-help">{outstandingBalanceLabel}</span>
              <span className="pointer-events-auto invisible absolute bottom-full right-0 z-[200] max-h-52 w-[17rem] overflow-y-auto overscroll-contain rounded-md border border-white/20 bg-[#131622]/95 px-2.5 py-1.5 text-left text-[11px] text-white/90 opacity-0 shadow-[0_16px_24px_-14px_rgba(0,0,0,0.8)] transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <span className="font-semibold text-white">Outstanding balance breakdown:</span>
                <span className="mt-1 block border-t border-white/10" />
                {student.allPayments
                  .filter(
                    (entry) =>
                      (typeof entry.outstandingBalance === "number" &&
                        entry.outstandingBalance > 0) ||
                      entry.settlementStatus === "pending",
                  )
                  .slice(0, 12)
                  .map((entry, index) => (
                    <span
                      key={`outstanding-${entry.id}`}
                      className={`block text-white/85 ${index === 0 ? "mt-1" : "mt-1 border-t border-white/10 pt-1"}`}
                    >
                      <span className="block">{entry.courseTitle || "Package payment"}</span>
                      <span className="mt-0.5 block text-white/65">
                        {formatMoney(entry.amount, entry.currency)}
                      </span>
                    </span>
                  ))}
                <span className="mt-2 border-t border-white/10 pt-2 block font-semibold text-white/90">
                  Total: {outstandingBalanceLabel}
                </span>
              </span>
            </span>
          </p>
        ) : null}
        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
          <span>Purchased courses</span>
          <span>{student.coursesPurchasedCount}</span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
          <span>Completed classes</span>
          <span className="group relative cursor-help">
            <span>{student.completedClassesTotal}</span>
            <span className="pointer-events-auto invisible absolute bottom-full right-0 z-[200] max-h-52 w-[17rem] overflow-y-auto overscroll-contain rounded-md border border-white/20 bg-[#131622]/95 px-2.5 py-1.5 text-left text-[11px] text-white/90 opacity-0 shadow-[0_16px_24px_-14px_rgba(0,0,0,0.8)] transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <span className="font-semibold text-white">Completed classes</span>
              <span className="mt-1 block border-t border-white/10" />
              {student.allPayments.filter(
                (p) =>
                  p.checkInStatus === "checked_in" ||
                  p.checkInStatus === "checked_in_no_package" ||
                  p.checkInStatus === "checked_out",
              ).length === 0 ? (
                <span className="mt-1 block text-white/70">No completed classes yet.</span>
              ) : (
                student.allPayments
                  .filter(
                    (p) =>
                      p.checkInStatus === "checked_in" ||
                      p.checkInStatus === "checked_in_no_package" ||
                      p.checkInStatus === "checked_out",
                  )
                  .slice(0, 12)
                  .map((entry, index) => (
                    <span
                      key={`completed-${entry.id}`}
                      className={`block text-white/85 ${index === 0 ? "mt-1" : "mt-1 border-t border-white/10 pt-1"}`}
                    >
                      <span className="block">{entry.courseTitle || "Class"}</span>
                      <span className="mt-0.5 block text-white/65">
                        {formatStudentPaymentCardSlotLabel(entry.classDate, entry.classTime)}
                      </span>
                    </span>
                  ))
              )}
            </span>
          </span>
        </p>
        <p className="inline-flex w-full items-center justify-between gap-2 text-white/75">
          <span>Package classes used</span>
          <span>{student.packageClassesUsedTotal}</span>
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <FastClassActionControls
          activePackage={payment.activePackage}
          disabled={paymentsLoading}
          studentName={identity.fullName}
          userId={payment.userId}
          onRefreshPaymentsBoard={onRefreshPaymentsBoard}
        />
        <button
          type="button"
          onClick={() => {
            if (typeof window === "undefined" || !payment.customerEmail || payment.customerEmail === "—")
              return
            const subject = encodeURIComponent(`Class payment update · ${payment.courseTitle}`)
            window.location.href = `mailto:${encodeURIComponent(payment.customerEmail)}?subject=${subject}`
          }}
          className="rounded-md border border-white/20 px-2 py-1 text-[11px]"
        >
          Notify
        </button>
        {canOperateStudentPins && payment.userId ? (
          <button
            type="button"
            onClick={() => openStudentPinModal(payment)}
            className="rounded-md border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-[11px] font-semibold text-cyan-100"
          >
            {payment.studentPin.provisionalActive ? "Reissue PIN" : "Prov PIN"}
          </button>
        ) : null}
        {canEditStudentInfo && payment.userId ? (
          <button
            type="button"
            onClick={() => openOverrideModal(payment.userId, identity.fullName)}
            className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/15 transition-colors"
          >
            Edit info
          </button>
        ) : null}
      </div>

      {canEditStudentInfo &&
        payment.userId &&
        usersWithAuditEntries.has(payment.userId) && (
          <div className="mt-3">
            <button
              type="button"
              onClick={(e) => {
                setAuditHistoryAnchor(e.currentTarget)
                setAuditHistoryStudentId(payment.userId)
                setAuditHistoryStudentName(identity.fullName)
              }}
              className="w-full rounded-md border border-white/15 px-2 py-1.5 text-[11px] text-white/60 hover:text-white/80 hover:border-white/25 transition-colors"
            >
              Change history
            </button>
          </div>
        )}
    </article>
  )
}

function PaymentClerkBanner({ payment }: { payment: PaymentRow }) {
  return <ClerkSyncUserBanner userId={payment.userId ?? null} />
}

// ClerkSyncUserBanner — single source for both ProfileClerkBanner and
// PaymentClerkBanner. Reads the panel-local `ClerkSyncContext` (kept
// intentionally per Batch 18) and renders the `ClerkSyncMismatchBanner`
// only when a mismatch exists for the given user. Returns `null` for empty
// userId so callers can pass nullable values without extra guards.
function ClerkSyncUserBanner({ userId }: { userId: string | null }) {
  const clerkSync = React.useContext(ClerkSyncContext)
  if (!clerkSync || !userId) return null
  const { canManageClerkSync, clerkMismatchByUserId, clerkSyncUserBusyId, onSyncClerkUser } = clerkSync
  if (!canManageClerkSync || !clerkMismatchByUserId.has(userId)) return null
  const mismatch = clerkMismatchByUserId.get(userId)
  if (!mismatch) return null
  return (
    <ClerkSyncMismatchBanner
      mismatch={mismatch}
      busy={clerkSyncUserBusyId === userId}
      onSync={() => onSyncClerkUser(userId)}
    />
  )
}
