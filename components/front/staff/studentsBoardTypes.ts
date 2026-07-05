import React from "react"
import type { CardVariantConfig, CardContext, HistoryStudentCardAggregate, StudentProfileCard } from "@/components/front/staff/historyCardAggregates"
import type { PaymentRow } from "./staffAdminTypes"
import type { StaffRole } from "@/lib/security/staff-role"
import type { StaffCategory } from "@/lib/security/staff-category"
import type StaffPaymentsBoardControls from "./StaffPaymentsBoardControls"
import type { useStaffCreateStudentAdmin } from "./useStaffCreateStudentAdmin"

export type FastClassActionPromoOffer = {
  linkedCourseSlug: string
  linkedCourseTitle: string
  linkedFromCourseSlug: string
  priceCents: number
}

export type FastClassActionResponse = {
  mode: "fast_pay" | "fast_sign_in" | "promo_cash"
  promoOffer?: FastClassActionPromoOffer | null
  code?: "pending_payment" | "completed_purchase" | string
  error?: string
}

export type FastClassActionOptions = {
  previewOnly?: boolean
  includeConsecutive?: boolean
}

export type ClerkSyncMismatch = {
  userId: string
  clerkId: string
  email: string | null
  fields: Array<"name" | "email" | "phone">
  clerk: { name: string | null; email: string | null; phone: string | null }
  db: { name: string | null; email: string | null; phone: string | null }
}

export type ClerkSyncHealth = {
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

export type StudentsBoardCreateStudentProps = ReturnType<typeof useStaffCreateStudentAdmin> | null

export type StaffStudentsBoardPanelProps = {
  isStudentsView: boolean
  loadingStatus: StudentsBoardLoadingProps
  staffUserPresenceMessage: string | null
  clerkSync: StudentsBoardClerkSyncProps
  terminalAlerts: StudentsBoardTerminalAlertsProps
  controls: StaffPaymentsBoardControlsProps
  cards: StudentsBoardCardsProps
  pagination: StudentsBoardPaginationProps
  createStudent?: StudentsBoardCreateStudentProps
}
