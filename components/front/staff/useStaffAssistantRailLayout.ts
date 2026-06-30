import React from "react"

export const STAFF_ASSISTANT_RAIL_EXIT_DURATION_MS = 350
export const STAFF_ASSISTANT_RAIL_EXIT_DURATION_CLASS = "duration-[350ms]"
export const STAFF_ASSISTANT_RAIL_EXIT_LAYOUT_DELAY_MS = 360

export function resolveStaffAssistantColumnReservation(isRailCollapsed: boolean, delayedReservationHeld: boolean) {
  return !isRailCollapsed || delayedReservationHeld
}

export function useStaffAssistantRailLayout(isRailCollapsed: boolean) {
  const [shouldReserveAssistantColumn, setShouldReserveAssistantColumn] = React.useState(() => !isRailCollapsed)

  React.useEffect(() => {
    if (!isRailCollapsed) {
      setShouldReserveAssistantColumn(true)
      return
    }

    const releaseColumnTimer = window.setTimeout(() => {
      setShouldReserveAssistantColumn(false)
    }, STAFF_ASSISTANT_RAIL_EXIT_LAYOUT_DELAY_MS)

    return () => {
      window.clearTimeout(releaseColumnTimer)
    }
  }, [isRailCollapsed])

  return resolveStaffAssistantColumnReservation(isRailCollapsed, shouldReserveAssistantColumn)
}
