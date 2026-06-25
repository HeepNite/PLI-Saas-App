/**
 * Canonical attendance / booking status constants.
 *
 * Every status array that was previously defined inline in individual route
 * files now lives here as a single source of truth.
 */

export const ATTENDANCE_STATUS = {
  CHECKED_IN: "checked_in",
  CHECKED_IN_NO_PACKAGE: "checked_in_no_package",
  CHECKED_OUT: "checked_out",
  SCHEDULED: "scheduled",
  NO_SHOW: "no_show",
} as const

/** Statuses that count as a successful attendance point (credit consumed or drop-in). */
export const ATTENDANCE_POINT_STATUSES: string[] = [
  ATTENDANCE_STATUS.CHECKED_IN,
  ATTENDANCE_STATUS.CHECKED_IN_NO_PACKAGE,
]

/** Statuses eligible for staff-initiated checkout. */
export const CHECKOUT_ELIGIBLE_STATUSES = ATTENDANCE_POINT_STATUSES

/** Statuses that indicate the student physically attended (includes checked_out). */
export const ATTENDED_CHECKIN_STATUSES: string[] = [
  ATTENDANCE_STATUS.CHECKED_IN,
  ATTENDANCE_STATUS.CHECKED_IN_NO_PACKAGE,
  ATTENDANCE_STATUS.CHECKED_OUT,
]

/** Statuses relevant for "today" board views (attended + scheduled). */
export const TODAY_CHECKIN_STATUSES: string[] = [
  ATTENDANCE_STATUS.CHECKED_IN,
  ATTENDANCE_STATUS.CHECKED_IN_NO_PACKAGE,
  ATTENDANCE_STATUS.CHECKED_OUT,
  ATTENDANCE_STATUS.SCHEDULED,
]

/** Bookings considered active (not cancelled / no-show). */
export const ACTIVE_BOOKING_STATUSES: string[] = [
  ATTENDANCE_STATUS.SCHEDULED,
  ATTENDANCE_STATUS.CHECKED_IN,
  ATTENDANCE_STATUS.CHECKED_IN_NO_PACKAGE,
]

/** Alias used by schedule routes. */
export const ACTIVE_ATTENDANCE_STATUSES = ACTIVE_BOOKING_STATUSES
