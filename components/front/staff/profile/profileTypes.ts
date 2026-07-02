import type React from "react"
import type { StaffPaymentPreference } from "@/lib/security/staff-category"
import type { StaffRequestStatus, StaffRequestType } from "@/lib/security/staff-request"
import type { StaffProfilePaymentSummaryCard } from "@/lib/staff/profile-payment"
import type {
  ProfileRequestFormState,
  SelfProfileSnapshot,
  StaffPaymentForm,
  StaffRequestRow,
  StaffRequestSummary,
  StaffUserRow,
} from "../staffAdminTypes"

export type ProfileCalendarCell = {
  day: number
  dateKey: string
  inMonth: boolean
}

export type ProfileScheduleEntry = {
  id: string
  dateKey: string
  title: string
  timeLabel: string
}

export type ProfileRequestTypeOption = {
  value: StaffRequestType
  label: string
  hint: string
}

export type StaffProfileViewPanelProps = {
  isProfileView: boolean
  resolvedSelfProfile: SelfProfileSnapshot
  selfProfileRow: StaffUserRow
  selfProfileLoading: boolean
  selfIsOnline: boolean
  selfLiveSessionMinutes: number | null
  selfPerformanceScore: number
  selfRecommendations: string[]
  profilePaymentExpanded: boolean
  profilePaymentSummaryCards: StaffProfilePaymentSummaryCard[]
  profilePaymentForm: StaffPaymentForm
  profilePaymentSaving: boolean
  profilePaymentError: string | null
  profilePaymentSuccess: string | null
  profileScheduleMonth: Date
  profileScheduleMonthLabel: string
  profileCalendarCells: ProfileCalendarCell[]
  selfScheduleEntries: ProfileScheduleEntry[]
  selfScheduleByDay: Record<string, ProfileScheduleEntry[]>
  selfCalendarGoogleHref: string
  selfCalendarIcsDataUri: string
  profileRequestForm: ProfileRequestFormState
  profileRequestSubmitting: boolean
  profileRequestError: string | null
  profileRequestSuccess: string | null
  profileRequestStatusFilter: StaffRequestStatus | "all"
  selectedProfileRequestType: ProfileRequestTypeOption
  requestsSummary: StaffRequestSummary
  requestsLoading: boolean
  staffRequests: StaffRequestRow[]
  setProfilePaymentExpanded: React.Dispatch<React.SetStateAction<boolean>>
  setProfilePaymentError: React.Dispatch<React.SetStateAction<string | null>>
  setProfilePaymentSuccess: React.Dispatch<React.SetStateAction<string | null>>
  setProfilePaymentForm: React.Dispatch<React.SetStateAction<StaffPaymentForm>>
  setProfileScheduleMonth: React.Dispatch<React.SetStateAction<Date>>
  setProfileRequestForm: React.Dispatch<React.SetStateAction<ProfileRequestFormState>>
  setProfileRequestStatusFilter: (value: StaffRequestStatus | "all") => void
  openProfileModal: (row: StaffUserRow) => void | Promise<void>
  saveProfilePaymentInfo: (event: React.FormEvent<HTMLFormElement>) => void
  submitProfileRequest: (event: React.FormEvent<HTMLFormElement>) => void
  getInitials: (firstName: string, lastName: string, fallback: string) => string
  formatDurationLabel: (minutes: number) => string
  formatIsoDate: (value: string | null) => string
}
