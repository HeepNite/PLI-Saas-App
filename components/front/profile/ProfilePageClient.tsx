"use client"

import React from "react"
import dynamic from "next/dynamic"
import { Flame, Medal, Star, Trophy } from "lucide-react"
import { demoCourses } from "@/constants/courses"
import type { CourseData } from "@/constants/courses"
import { useUser } from "@clerk/nextjs"
import { useCatalogCourses } from "@/components/front/hooks/useCatalogCourses"
import { useStudentPinStatus } from "@/components/front/hooks/useStudentPinStatus"
import {
  buildBookingPrefillContact,
} from "./profile-utils"
import type {
  ActionRequestItem,
} from "./profile-types"
import {
  NY_TIMEZONE,
} from "./profile-constants"
import {
  isPendingRequestStatus,
  formatDateKeyInTimeZone,
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
import { MobileActionCards } from "./sections/MobileActionCards"
import { AnalyticsCard } from "./sections/AnalyticsCard"
import { AssignClassesCard } from "./sections/AssignClassesCard"
import { ProfileRightRail } from "./sections/ProfileRightRail"
import { RescheduleModal } from "./modals/RescheduleModal"
import { ActionRequestModal } from "./modals/ActionRequestModal"
import { CoursePickerModal } from "./modals/CoursePickerModal"

const EnrollModal = dynamic(() => import("../courses/EnrollModal"), { ssr: false })

const MEDAL_ITEMS = [
  { label: "5 classes", icon: Trophy },
  { label: "10 classes", icon: Medal },
  { label: "1 active month", icon: Flame },
  { label: "Consistencia", icon: Star },
]

const RESCHEDULE_STEP_ITEMS: Array<{ id: 1 | 2 | 3; label: string }> = [
  { id: 1, label: "Reassignment" },
  { id: 2, label: "Confirmation" },
  { id: 3, label: "Assign pending" },
]

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
    checkInSuccess,
    setCheckInSuccess,
    loadBookings,
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
    suspendablePackages: assignablePackages,
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

  const latestPointEntries = pointsEntries.slice(0, 6)
  const latestActionRequests = actionRequests.slice(0, 5)
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

            <MobileActionCards
              onOpenCoursePicker={() => setCoursePickerOpen(true)}
              onOpenChangeClassModal={openChangeClassModal}
              onOpenRequestModal={openRequestModal}
              selectedBooking={selectedBooking}
              bookingsLoading={bookingsLoading}
              bookingsError={bookingsError}
              requestSubmitError={requestSubmitError}
              requestSubmitSuccess={requestSubmitSuccess}
              requestModalType={requestModalType}
              actionRequestsError={actionRequestsError}
              actionRequestsLoading={actionRequestsLoading}
              latestActionRequests={latestActionRequests}
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

            <MedalsCard medalItems={MEDAL_ITEMS} />

            <AssignClassesCard
              assignPackageId={assignPackageId}
              setAssignPackageId={setAssignPackageId}
              assignablePackages={assignablePackages}
              todayNyDateKey={todayNyDateKey}
              assignDate={assignDate}
              setAssignDate={setAssignDate}
              assignTime={assignTime}
              setAssignTime={setAssignTime}
              assignAvailability={assignAvailability}
              assignAvailabilityLoading={assignAvailabilityLoading}
              assignSlots={assignSlots}
              assigning={assigning}
              assignError={assignError}
              setAssignError={setAssignError}
              assignSuccess={assignSuccess}
              setAssignSuccess={setAssignSuccess}
              selectedPackageForAssign={selectedPackageForAssign}
              selectedPackageCourse={selectedPackageCourse}
              selectedPackageAssignmentStats={selectedPackageAssignmentStats}
              assignUnavailableDates={assignUnavailableDates}
              assignBookedTimesForSelectedDate={assignBookedTimesForSelectedDate}
              addAssignSlot={addAssignSlot}
              removeAssignSlot={removeAssignSlot}
              submitAssignClasses={submitAssignClasses}
              agendaState={{
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
              }}
              pendingBookings={pendingBookings}
              visibleBookings={visibleBookings}
              classRequestsByAttendance={classRequestsByAttendance}
            />

            <GearCard
              model={mockProfile.shoeTracking.model}
              usedKm={mockProfile.shoeTracking.km}
              maxKm={mockProfile.shoeTracking.maxKm}
              shoeProgress={shoeProgress}
            />
          </section>

          <ProfileRightRail
            rightRailRef={rightRailRef}
            onOpenCoursePicker={() => setCoursePickerOpen(true)}
            bookingsLoading={bookingsLoading}
            selectedBooking={selectedBooking}
            bookingsError={bookingsError}
            onOpenChangeClassModal={openChangeClassModal}
            onOpenRequestModal={openRequestModal}
            requestSubmitError={requestSubmitError}
            requestSubmitSuccess={requestSubmitSuccess}
            requestModalType={requestModalType}
            actionRequestsError={actionRequestsError}
            actionRequestsLoading={actionRequestsLoading}
            latestActionRequests={latestActionRequests}
          />
        </div>
      </div>

      {changeModalOpen && selectedBooking && (
        <RescheduleModal
          isOpen={changeModalOpen}
          selectedBooking={selectedBooking}
          visibleBookings={visibleBookings}
          sourceCourses={sourceCourses}
          todayNyDateKey={todayNyDateKey}
          pendingAssignablePackages={pendingAssignablePackages}
          selectedBookingCourseAvailableWeekdays={selectedBookingCourse?.schedule.availableWeekdays}
          nyTimezone={NY_TIMEZONE}
          rescheduleStepItems={RESCHEDULE_STEP_ITEMS}
          rescheduleStep={rescheduleStep}
          setRescheduleStep={setRescheduleStep}
          rescheduleCourseSlug={rescheduleCourseSlug}
          setRescheduleCourseSlug={setRescheduleCourseSlug}
          rescheduleDate={rescheduleDate}
          setRescheduleDate={setRescheduleDate}
          rescheduleTime={rescheduleTime}
          setRescheduleTime={setRescheduleTime}
          availability={availability}
          availabilityLoading={availabilityLoading}
          rescheduleSaving={rescheduleSaving}
          rescheduleError={rescheduleError}
          setRescheduleError={setRescheduleError}
          rescheduleSuccess={rescheduleSuccess}
          rescheduleCourseOptions={rescheduleCourseOptions}
          rescheduleScopedBookings={rescheduleScopedBookings}
          rescheduleBookedTimesForSelectedDate={rescheduleBookedTimesForSelectedDate}
          isCurrentRescheduleSlot={isCurrentRescheduleSlot}
          isRescheduleDateBlocked={isRescheduleDateBlocked}
          getRescheduleDateBlockReason={getRescheduleDateBlockReason}
          hydrateRescheduleFromBooking={hydrateRescheduleFromBooking}
          closeChangeClassModal={closeChangeClassModal}
          continueRescheduleStep={continueRescheduleStep}
          submitPrimaryReschedule={submitPrimaryReschedule}
          setSelectedBookingId={setSelectedBookingId}
        />
      )}

      <ActionRequestModal
        requestModalType={requestModalType}
        closeRequestModal={closeRequestModal}
        requestSuspendPackageId={requestSuspendPackageId}
        setRequestSuspendPackageId={setRequestSuspendPackageId}
        suspendablePackages={assignablePackages}
        requestSuspendStart={requestSuspendStart}
        setRequestSuspendStart={setRequestSuspendStart}
        requestSuspendEnd={requestSuspendEnd}
        setRequestSuspendEnd={setRequestSuspendEnd}
        requestCancelBookingId={requestCancelBookingId}
        setRequestCancelBookingId={setRequestCancelBookingId}
        setRequestCancelDecision={setRequestCancelDecision}
        setRequestSubmitError={setRequestSubmitError}
        visibleBookings={visibleBookings}
        requestCancelBooking={requestCancelBooking}
        requestCancelDecision={requestCancelDecision}
        requestMessage={requestMessage}
        setRequestMessage={setRequestMessage}
        requestSubmitError={requestSubmitError}
        submitActionRequest={submitActionRequest}
        requestSubmitting={requestSubmitting}
      />

      <CoursePickerModal
        coursePickerOpen={coursePickerOpen}
        setCoursePickerOpen={setCoursePickerOpen}
        orderedCourses={orderedCourses}
        preferredSet={preferredSet}
        setSelectedCourse={setSelectedCourse}
        setEnrollOpen={setEnrollOpen}
      />

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
