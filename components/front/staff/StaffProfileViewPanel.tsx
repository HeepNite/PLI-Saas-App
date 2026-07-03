"use client"

import React from "react"
import { ChevronDown } from "lucide-react"

import { PAYMENT_PREFERENCE_LABELS } from "./staffAdminConstants"
import StaffProfilePaymentSection from "./StaffProfilePaymentSection"
import StaffProfileRequestsSection from "./StaffProfileRequestsSection"
import ProfileHeader from "./profile/ProfileHeader"
import ProfileMetricsCards from "./profile/ProfileMetricsCards"
import ProfilePaymentForm from "./profile/ProfilePaymentForm"
import ProfileScheduleSection from "./profile/ProfileScheduleSection"
import ProfileRequestCreateForm from "./profile/ProfileRequestCreateForm"
import ProfileRequestHistory from "./profile/ProfileRequestHistory"
import ProfileRecommendations from "./profile/ProfileRecommendations"
import type { StaffProfileViewPanelProps } from "./profile/profileTypes"

export type { StaffProfileViewPanelProps }

function togglePaymentExpanded(
  setProfilePaymentExpanded: React.Dispatch<React.SetStateAction<boolean>>,
  setProfilePaymentError: React.Dispatch<React.SetStateAction<string | null>>,
  setProfilePaymentSuccess: React.Dispatch<React.SetStateAction<string | null>>,
) {
  setProfilePaymentExpanded((prev) => !prev)
  setProfilePaymentError(null)
  setProfilePaymentSuccess(null)
}

export default function StaffProfileViewPanel(props: StaffProfileViewPanelProps) {
  const {
    isProfileView,
    resolvedSelfProfile,
    selfProfileRow,
    selfProfileLoading,
    selfIsOnline,
    selfLiveSessionMinutes,
    selfPerformanceScore,
    selfRecommendations,
    profilePaymentExpanded,
    profilePaymentSummaryCards,
    profilePaymentForm,
    profilePaymentSaving,
    profilePaymentError,
    profilePaymentSuccess,
    profileScheduleMonth,
    profileScheduleMonthLabel,
    profileCalendarCells,
    selfScheduleEntries,
    selfScheduleByDay,
    selfCalendarGoogleHref,
    selfCalendarIcsDataUri,
    profileRequestForm,
    profileRequestSubmitting,
    profileRequestError,
    profileRequestSuccess,
    profileRequestStatusFilter,
    selectedProfileRequestType,
    requestsSummary,
    requestsLoading,
    staffRequests,
    setProfilePaymentExpanded,
    setProfilePaymentError,
    setProfilePaymentSuccess,
    setProfilePaymentForm,
    setProfileScheduleMonth,
    setProfileRequestForm,
    setProfileRequestStatusFilter,
    openProfileModal,
    saveProfilePaymentInfo,
    submitProfileRequest,
    getInitials,
    formatDurationLabel,
    formatIsoDate,
  } = props

  if (!isProfileView) return null

  const togglePayment = () =>
    togglePaymentExpanded(setProfilePaymentExpanded, setProfilePaymentError, setProfilePaymentSuccess)

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      <ProfileHeader
        resolvedSelfProfile={resolvedSelfProfile}
        selfProfileRow={selfProfileRow}
        selfProfileLoading={selfProfileLoading}
        selfIsOnline={selfIsOnline}
        selfLiveSessionMinutes={selfLiveSessionMinutes}
        openProfileModal={openProfileModal}
        getInitials={getInitials}
        formatDurationLabel={formatDurationLabel}
      />

      <ProfileMetricsCards
        resolvedSelfProfile={resolvedSelfProfile}
        selfPerformanceScore={selfPerformanceScore}
      />

      <StaffProfilePaymentSection
        resolvedSelfProfile={resolvedSelfProfile}
        profilePaymentExpanded={profilePaymentExpanded}
        profilePaymentSummaryCards={profilePaymentSummaryCards}
        onToggleExpanded={togglePayment}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand,#b61616)]">Payment information</p>
            <h4 className="mt-1 text-base font-semibold text-black dark:text-white">How you prefer to get paid</h4>
            <p className="text-xs text-black/60 dark:text-white/60">
              Keep your cash/card/credits preference and payout details updated.
            </p>
          </div>
          <button
            type="button"
            onClick={togglePayment}
            className="inline-flex items-center gap-2 rounded-md border border-black/20 px-3 py-2 text-xs font-semibold text-black transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#b61616)] dark:border-white/20 dark:text-white"
          >
            {profilePaymentExpanded ? "Hide payment form" : "Edit payment details"}
            <ChevronDown className={`h-4 w-4 transition ${profilePaymentExpanded ? "rotate-180" : ""}`} />
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.05]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/55 dark:text-white/55">Preference</p>
            <p className="mt-1 text-sm font-semibold text-black dark:text-white">
              {resolvedSelfProfile.paymentPreference
                ? PAYMENT_PREFERENCE_LABELS[resolvedSelfProfile.paymentPreference]
                : "Not set"}
            </p>
          </div>
          {profilePaymentSummaryCards.map((card) => (
            <div
              key={`self-profile-payment-summary-${card.label}`}
              className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.05]"
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-black/55 dark:text-white/55">{card.label}</p>
              <p className="mt-1 text-sm font-semibold text-black dark:text-white">{card.value}</p>
              {card.hint ? (
                <p className="text-xs text-black/60 dark:text-white/60">{card.hint}</p>
              ) : null}
            </div>
          ))}
        </div>

        <ProfilePaymentForm
          resolvedSelfProfile={resolvedSelfProfile}
          profilePaymentForm={profilePaymentForm}
          profilePaymentSaving={profilePaymentSaving}
          profilePaymentError={profilePaymentError}
          profilePaymentSuccess={profilePaymentSuccess}
          setProfilePaymentForm={setProfilePaymentForm}
          setProfilePaymentSuccess={setProfilePaymentSuccess}
          saveProfilePaymentInfo={saveProfilePaymentInfo}
        />
      </StaffProfilePaymentSection>

      <ProfileScheduleSection
        profileScheduleMonth={profileScheduleMonth}
        profileScheduleMonthLabel={profileScheduleMonthLabel}
        profileCalendarCells={profileCalendarCells}
        selfScheduleEntries={selfScheduleEntries}
        selfScheduleByDay={selfScheduleByDay}
        selfCalendarGoogleHref={selfCalendarGoogleHref}
        selfCalendarIcsDataUri={selfCalendarIcsDataUri}
        setProfileScheduleMonth={setProfileScheduleMonth}
      />

      <StaffProfileRequestsSection>
        <ProfileRequestCreateForm
          profileRequestForm={profileRequestForm}
          profileRequestSubmitting={profileRequestSubmitting}
          profileRequestError={profileRequestError}
          profileRequestSuccess={profileRequestSuccess}
          selectedProfileRequestType={selectedProfileRequestType}
          setProfileRequestForm={setProfileRequestForm}
          submitProfileRequest={submitProfileRequest}
        />

        <ProfileRequestHistory
          profileRequestStatusFilter={profileRequestStatusFilter}
          requestsSummary={requestsSummary}
          requestsLoading={requestsLoading}
          staffRequests={staffRequests}
          setProfileRequestStatusFilter={setProfileRequestStatusFilter}
          formatIsoDate={formatIsoDate}
        />
      </StaffProfileRequestsSection>

      <ProfileRecommendations selfRecommendations={selfRecommendations} />
    </article>
  )
}
