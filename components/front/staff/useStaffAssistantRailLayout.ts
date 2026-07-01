import React from "react"

export const STAFF_ASSISTANT_RAIL_EXIT_DURATION_MS = 240
export const STAFF_ASSISTANT_RAIL_EXIT_DURATION_CLASS = "duration-[240ms]"

type StaffAssistantRailLayoutState = {
  shouldReserveAssistantColumn: boolean
}

export function resolveStaffAssistantColumnReservation(isRailCollapsed: boolean, delayedReservationHeld: boolean) {
  return !isRailCollapsed || delayedReservationHeld
}

export function useStaffAssistantRailLayout(isRailCollapsed: boolean) {
  return React.useMemo<StaffAssistantRailLayoutState>(
    () => ({
      shouldReserveAssistantColumn: resolveStaffAssistantColumnReservation(isRailCollapsed, false),
    }),
    [isRailCollapsed]
  )
}
