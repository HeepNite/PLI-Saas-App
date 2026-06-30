import React from "react"

export const STAFF_ASSISTANT_RAIL_EXIT_DURATION_MS = 160
export const STAFF_ASSISTANT_RAIL_EXIT_DURATION_CLASS = "duration-[160ms]"
export const STAFF_ASSISTANT_LAYOUT_RELEASE_DELAY_MS = 140

type StaffAssistantRailLayoutState = {
  shouldReserveAssistantColumn: boolean
}

export function resolveStaffAssistantColumnReservation(isRailCollapsed: boolean, delayedReservationHeld: boolean) {
  return !isRailCollapsed || delayedReservationHeld
}

export function useStaffAssistantRailLayout(isRailCollapsed: boolean) {
  const [delayedReservationHeld, setDelayedReservationHeld] = React.useState(!isRailCollapsed)

  React.useEffect(() => {
    if (!isRailCollapsed) {
      setDelayedReservationHeld(true)
      return
    }

    const releaseReservation = window.setTimeout(() => {
      setDelayedReservationHeld(false)
    }, STAFF_ASSISTANT_LAYOUT_RELEASE_DELAY_MS)

    return () => {
      window.clearTimeout(releaseReservation)
    }
  }, [isRailCollapsed])

  return React.useMemo<StaffAssistantRailLayoutState>(
    () => ({
      shouldReserveAssistantColumn: resolveStaffAssistantColumnReservation(isRailCollapsed, delayedReservationHeld),
    }),
    [delayedReservationHeld, isRailCollapsed]
  )
}
