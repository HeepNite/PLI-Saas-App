"use client"

import React from "react"
import dynamic from "next/dynamic"
import GlassyCard from "@/components/front/courses/GlassyCard"
import { Flame, Medal, Star, Trophy, X, Music2 } from "lucide-react"
import { demoCourses } from "@/constants/courses"
import type { CourseData } from "@/constants/courses"
import { useUser } from "@clerk/nextjs"
import { useCatalogCourses } from "@/components/front/hooks/useCatalogCourses"
import { useStudentPinStatus } from "@/components/front/hooks/useStudentPinStatus"
import CalendarPicker from "@/components/front/ui/CalendarPicker"
import {
  buildBookingPrefillContact,
} from "./profile-utils"
import type {
  ActionRequestItem,
  ActionRequestType,
} from "./profile-types"
import {
  NY_TIMEZONE,
  CHECK_IN_OPEN_WINDOW_HOURS,
  CHECK_IN_OPEN_WINDOW_MS,
  actionRequestLabels,
} from "./profile-constants"
import {
  actionRequestStatusLabel,
  actionRequestMetaLabel,
  getPendingProcessLabel,
  getProcessTypeTone,
  isPendingRequestStatus,
  formatDateKeyInTimeZone,
  formatDateTimeInTimeZone,
} from "./profile-formatters"
import { mockProfile } from "./mock-profile"
import { usePointsHistory } from "./hooks/usePointsHistory"
import { useActionRequests } from "./hooks/useActionRequests"
import { useStudentPinForm } from "./hooks/useStudentPinForm"
import { useProfilePackages } from "./hooks/useProfilePackages"
import { useProfileForm } from "./hooks/useProfileForm"
import { useStickyRails } from "./hooks/useStickyRails"
import { useFloatingFooterOffset } from "./hooks/useFloatingFooterOffset"
import { useAvailabilityCache } from "./hooks/useAvailabilityCache"
import { useProfileBookings } from "./hooks/useProfileBookings"
import { useRescheduleFlow } from "./hooks/useRescheduleFlow"
import { useAssignClassesFlow } from "./hooks/useAssignClassesFlow"
import { useActionRequestModal } from "./hooks/useActionRequestModal"
import { useAnalyticsChartData } from "./hooks/useAnalyticsChartData"
import { useAgendaCalendar } from "./hooks/useAgendaCalendar"
import { StudentMomentsCard } from "./sections/StudentMomentsCard"
import { PliCoinsCard } from "./sections/PliCoinsCard"
import { PointsHistoryCard } from "./sections/PointsHistoryCard"
import { MedalsCard } from "./sections/MedalsCard"
import { GearCard } from "./sections/GearCard"
import { ProfileLeftRail } from "./sections/ProfileLeftRail"
import { ProfileFormCard } from "./sections/ProfileFormCard"
import { StudentPinCard } from "./sections/StudentPinCard"
import { AnalyticsCard } from "./sections/AnalyticsCard"

const EnrollModal = dynamic(() => import("../courses/EnrollModal"), { ssr: false })

export default function ProfilePageClient() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { courses: catalogCourses } = useCatalogCourses()
  const sourceCourses = React.useMemo(
    () => (catalogCourses.length ? catalogCourses : demoCourses),
    [catalogCourses]
  )
  const [e2eAuthBypass, setE2eAuthBypass] = React.useState(false)
  const [coursePickerOpen, setCoursePickerOpen] = React.useState(false)
  const [selectedCourse, setSelectedCourse] = React.useState<CourseData | null>(null)
  const [enrollOpen, setEnrollOpen] = React.useState(false)
  const canLoadProtectedData = (isLoaded && isSignedIn) || e2eAuthBypass

  // --- Extracted hooks (Slice 2) ---
  const {
    pointsBalance, setPointsBalance: setPointsBalanceFromPoints,
    freeClassThreshold, freeClassesAvailable, pointsToNextFreeClass,
    pointsEntries, pointsLoading, pointsError, loadPointsHistory,
  } = usePointsHistory(canLoadProtectedData)

  const {
    actionRequests, actionRequestsLoading, actionRequestsError, loadActionRequests,
  } = useActionRequests(canLoadProtectedData)

  const { packagesData, packagesSummary, activityStats, monthlyAttendance } = useProfilePackages(canLoadProtectedData)
  const {
    activeMetric,
    setActiveMetric,
    hoverPoint,
    setHoverPoint,
    chartWidth,
    chartHeight,
    paddingX,
    paddingY,
    points,
    targetValues,
    targetPoints,
    pathD,
    targetPathD,
    yTicks,
    pieSegments,
    pieGradient,
  } = useAnalyticsChartData(monthlyAttendance)

  const onPointsBalanceChange = React.useCallback((balance: number) => {
    setPointsBalanceFromPoints(balance)
  }, [setPointsBalanceFromPoints])

  const {
    profileLoading, profileSaving, profileError, profileSaved,
    profileComplete, setShowProfileForm,
    profileFormMounted, profileFormVisible,
    profileUser, profileForm, setProfileForm,
    avatarUploading, avatarError, fileInputRef,
    completionPercent, avatarSrc,
    handleAvatarUpload, handleProfileSave,
  } = useProfileForm(canLoadProtectedData, user, onPointsBalanceChange, loadPointsHistory)

  const { status: pinStatus, loading: pinLoading, error: pinStatusError, refresh: refreshPinStatus } = useStudentPinStatus(canLoadProtectedData)
  const {
    pinCurrentValue, setPinCurrentValue,
    pinNextValue, setPinNextValue,
    pinConfirmValue, setPinConfirmValue,
    pinRecoveryMode, setPinRecoveryMode,
    pinSaving, pinFormError, setPinFormError, pinFormSuccess, setPinFormSuccess,
    submitStudentPin,
  } = useStudentPinForm(pinStatus, refreshPinStatus)

  const [selectedBookingId, setSelectedBookingId] = React.useState<string>("")
  const [assignPackageId, setAssignPackageId] = React.useState("")
  const { clearAvailabilityCache, fetchAvailability } = useAvailabilityCache()
  const {
    bookings,
    assignablePackages,
    bookingsLoading,
    bookingsError,
    checkInSubmittingId,
    checkInError,
    checkInSuccess,
    setCheckInSuccess,
    loadBookings,
    submitBookingCheckIn,
  } = useProfileBookings({
    canLoadProtectedData,
    clearAvailabilityCache,
    loadPointsHistory,
    setSelectedBookingId,
    setAssignPackageId,
  })
  const currentCoins = Math.max(0, pointsBalance)
  const progress = Math.min(100, Math.round((currentCoins / Math.max(1, freeClassThreshold)) * 100))
  const shoeProgress = Math.min(100, Math.round((mockProfile.shoeTracking.km / mockProfile.shoeTracking.maxKm) * 100))
  const stickyTop = 76
  const { gridRef, leftRailRef, rightRailRef } = useStickyRails(stickyTop)
  useFloatingFooterOffset()
  const bookingPrefillContact = React.useMemo(
    () => buildBookingPrefillContact(profileForm, profileUser, user),
    [profileForm, profileUser, user]
  )
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
  const {
    mobileAgendaOpenDay,
    setMobileAgendaOpenDay,
    agendaMonth,
    setAgendaMonth,
    agendaYear,
    setAgendaYear,
    calendarDays,
    agendaMonthLabel,
    agendaYears,
    bookingEventsByDay,
    pendingBookingEventsByDay,
    nextBookedClass,
  } = useAgendaCalendar({
    visibleBookings,
    pendingBookings,
    classRequestsByAttendance,
    activityStats,
  })
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
  const suspendablePackages = React.useMemo(() => assignablePackages, [assignablePackages])
  const {
    changeModalOpen,
    rescheduleStep,
    setRescheduleStep,
    rescheduleCourseSlug,
    setRescheduleCourseSlug,
    rescheduleDate,
    setRescheduleDate,
    rescheduleTime,
    setRescheduleTime,
    availability,
    availabilityLoading,
    rescheduleSaving,
    rescheduleError,
    setRescheduleError,
    rescheduleSuccess,
    rescheduleCourseOptions,
    rescheduleScopedBookings,
    rescheduleBookedTimesForSelectedDate,
    isCurrentRescheduleSlot,
    isRescheduleDateBlocked,
    getRescheduleDateBlockReason,
    hydrateRescheduleFromBooking,
    openChangeClassModalForBooking,
    openChangeClassModal,
    closeChangeClassModal,
    continueRescheduleStep,
    submitPrimaryReschedule,
  } = useRescheduleFlow({
    bookings,
    visibleBookings,
    selectedBooking,
    selectedBookingId,
    setSelectedBookingId,
    sourceCourses,
    fetchAvailability,
    clearAvailabilityCache,
    loadBookings,
    loadActionRequests,
  })
  const {
    requestModalType,
    requestMessage,
    setRequestMessage,
    requestSuspendStart,
    setRequestSuspendStart,
    requestSuspendEnd,
    setRequestSuspendEnd,
    requestSuspendPackageId,
    setRequestSuspendPackageId,
    requestCancelBookingId,
    setRequestCancelBookingId,
    requestCancelDecision,
    setRequestCancelDecision,
    requestSubmitting,
    requestSubmitError,
    setRequestSubmitError,
    requestSubmitSuccess,
    requestCancelBooking,
    openRequestModal,
    closeRequestModal,
    submitActionRequest,
  } = useActionRequestModal({
    suspendablePackages,
    visibleBookings,
    selectedBooking,
    loadActionRequests,
    openChangeClassModalForBooking,
  })
  const todayNyDateKey = formatDateKeyInTimeZone(new Date(), NY_TIMEZONE)
  const pendingAssignablePackages = React.useMemo(
    () => assignablePackages.filter((pkg) => pkg.isUnlimited || (pkg.remainingCredits ?? 0) > 0),
    [assignablePackages]
  )

  const selectedBookingCourse = React.useMemo(() => {
    if (!selectedBooking) return null
    return sourceCourses.find((course) => course.slug === selectedBooking.courseSlug) || null
  }, [selectedBooking, sourceCourses])

  const {
    assignDate,
    setAssignDate,
    assignTime,
    setAssignTime,
    assignAvailability,
    assignAvailabilityLoading,
    assignSlots,
    assigning,
    assignError,
    setAssignError,
    assignSuccess,
    setAssignSuccess,
    selectedPackageForAssign,
    selectedPackageCourse,
    selectedPackageAssignmentStats,
    assignUnavailableDates,
    assignBookedTimesForSelectedDate,
    addAssignSlot,
    removeAssignSlot,
    submitAssignClasses,
  } = useAssignClassesFlow({
    assignPackageId,
    assignablePackages,
    bookings,
    sourceCourses,
    todayNyDateKey,
    fetchAvailability,
    clearAvailabilityCache,
    loadBookings,
    loadPointsHistory,
    loadActionRequests,
  })

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    setE2eAuthBypass(params.get("e2eAuth") === "1")
  }, [])

  React.useEffect(() => {
    void loadPointsHistory()
    void loadActionRequests()
    void loadBookings()
  }, [loadPointsHistory, loadActionRequests, loadBookings])

  React.useEffect(() => {
    if (visibleBookings.length === 0) {
      setSelectedBookingId("")
      return
    }
    setSelectedBookingId((prev) =>
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
    if (!checkInSuccess) return
    const id = window.setTimeout(() => setCheckInSuccess(null), 4000)
    return () => window.clearTimeout(id)
  }, [checkInSuccess, setCheckInSuccess])

  const medalItems = [
    { label: "5 classes", icon: Trophy },
    { label: "10 classes", icon: Medal },
    { label: "1 active month", icon: Flame },
    { label: "Consistencia", icon: Star },
  ]

  const latestPointEntries = pointsEntries.slice(0, 6)
  const latestActionRequests = actionRequests.slice(0, 5)
  const rescheduleStepItems = [
    { id: 1 as const, label: "Reassignment" },
    { id: 2 as const, label: "Confirmation" },
    { id: 3 as const, label: "Assign pending" },
  ]
  const handleProfileFieldChange = React.useCallback((field: keyof typeof profileForm, value: string) => {
    setProfileForm((s) => ({ ...s, [field]: value }))
  }, [setProfileForm])

  return (
    <main className="min-h-[70vh] bg-background">
      <div className="w-full px-[10px] lg:px-[15px] py-8">
        <div ref={gridRef} className="relative grid grid-cols-1 gap-6 lg:items-start lg:grid-cols-[minmax(250px,290px)_minmax(0,1fr)_15rem]">
          {/* Left */}
          <ProfileLeftRail
            leftRailRef={leftRailRef}
            fileInputRef={fileInputRef}
            avatarUploading={avatarUploading}
            avatarError={avatarError}
            avatarSrc={avatarSrc}
            profileUser={profileUser}
            activityStats={activityStats}
            setShowProfileForm={setShowProfileForm}
            completionPercent={completionPercent}
            profileComplete={profileComplete}
            packagesData={packagesData}
            packagesSummary={packagesSummary}
            handleAvatarUpload={handleAvatarUpload}
          />

          {/* Center */}
          <section className="flex flex-col gap-6">
            <ProfileFormCard
              profileFormMounted={profileFormMounted}
              profileFormVisible={profileFormVisible}
              pointsBalance={pointsBalance}
              profileForm={profileForm}
              profileComplete={profileComplete}
              profileSaving={profileSaving}
              profileLoading={profileLoading}
              profileError={profileError}
              profileSaved={profileSaved}
              userEmail={user?.primaryEmailAddress?.emailAddress || ""}
              userPhone={user?.primaryPhoneNumber?.phoneNumber || ""}
              onClose={() => setShowProfileForm(false)}
              onSave={handleProfileSave}
              onProfileFieldChange={handleProfileFieldChange}
            />

            <StudentPinCard
              pinStatus={pinStatus}
              pinLoading={pinLoading}
              pinStatusError={pinStatusError}
              pinRecoveryMode={pinRecoveryMode}
              pinCurrentValue={pinCurrentValue}
              pinNextValue={pinNextValue}
              pinConfirmValue={pinConfirmValue}
              pinSaving={pinSaving}
              pinFormError={pinFormError}
              pinFormSuccess={pinFormSuccess}
              onPinCurrentChange={setPinCurrentValue}
              onPinNextChange={setPinNextValue}
              onPinConfirmChange={setPinConfirmValue}
              onToggleRecoveryMode={() => {
                setPinRecoveryMode((prev) => !prev)
                setPinFormError(null)
                setPinFormSuccess(null)
                setPinCurrentValue("")
              }}
              onSubmit={() => {
                void submitStudentPin()
              }}
            />

            <StudentMomentsCard moments={mockProfile.moments} />

            <AnalyticsCard
              activeMetric={activeMetric}
              activityStats={activityStats}
              chartWidth={chartWidth}
              chartHeight={chartHeight}
              paddingX={paddingX}
              paddingY={paddingY}
              points={points}
              targetValues={targetValues}
              targetPoints={targetPoints}
              pathD={pathD}
              targetPathD={targetPathD}
              yTicks={yTicks}
              pieSegments={pieSegments}
              pieGradient={pieGradient}
              hoverPoint={hoverPoint}
              onMetricChange={setActiveMetric}
              onHoverPointChange={setHoverPoint}
            />

            <PliCoinsCard
              pointsToNextFreeClass={pointsToNextFreeClass}
              freeClassThreshold={freeClassThreshold}
              progress={progress}
              currentCoins={currentCoins}
              freeClassesAvailable={freeClassesAvailable}
            />

            <PointsHistoryCard
              pointsBalance={pointsBalance}
              pointsError={pointsError}
              pointsLoading={pointsLoading}
              latestPointEntries={latestPointEntries}
            />

            <MedalsCard medalItems={medalItems} />

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

            <GearCard
              model={mockProfile.shoeTracking.model}
              usedKm={mockProfile.shoeTracking.km}
              maxKm={mockProfile.shoeTracking.maxKm}
              shoeProgress={shoeProgress}
            />
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
