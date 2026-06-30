import React from "react"

export const STAFF_ASSISTANT_RAIL_EXIT_DURATION_MS = 350
export const STAFF_ASSISTANT_RAIL_EXIT_DURATION_CLASS = "duration-[350ms]"
export const STAFF_ASSISTANT_RAIL_EXIT_LAYOUT_DELAY_MS = 360
export const STAFF_ASSISTANT_LAYOUT_SETTLE_DURATION_MS = 180

type StaffAssistantRailLayoutState = {
  shouldReserveAssistantColumn: boolean
  isAssistantLayoutSettling: boolean
}

export function resolveStaffAssistantColumnReservation(isRailCollapsed: boolean, delayedReservationHeld: boolean) {
  return !isRailCollapsed || delayedReservationHeld
}

export function useStaffAssistantRailLayout(isRailCollapsed: boolean) {
  const [shouldReserveAssistantColumn, setShouldReserveAssistantColumn] = React.useState(() => !isRailCollapsed)
  const [isAssistantLayoutSettling, setIsAssistantLayoutSettling] = React.useState(false)
  const previousRailCollapsedRef = React.useRef(isRailCollapsed)

  React.useEffect(() => {
    let releaseColumnTimer: number | undefined
    let clearSettlingTimer: number | undefined
    const railCollapseChanged = previousRailCollapsedRef.current !== isRailCollapsed
    previousRailCollapsedRef.current = isRailCollapsed

    if (!railCollapseChanged) return

    if (!isRailCollapsed) {
      setShouldReserveAssistantColumn(true)
      setIsAssistantLayoutSettling(true)
      clearSettlingTimer = window.setTimeout(() => {
        setIsAssistantLayoutSettling(false)
      }, STAFF_ASSISTANT_LAYOUT_SETTLE_DURATION_MS)

      return () => {
        window.clearTimeout(clearSettlingTimer)
      }
    }

    setIsAssistantLayoutSettling(true)
    releaseColumnTimer = window.setTimeout(() => {
      setShouldReserveAssistantColumn(false)
      clearSettlingTimer = window.setTimeout(() => {
        setIsAssistantLayoutSettling(false)
      }, STAFF_ASSISTANT_LAYOUT_SETTLE_DURATION_MS)
    }, STAFF_ASSISTANT_RAIL_EXIT_LAYOUT_DELAY_MS)

    return () => {
      window.clearTimeout(releaseColumnTimer)
      window.clearTimeout(clearSettlingTimer)
    }
  }, [isRailCollapsed])

  return React.useMemo<StaffAssistantRailLayoutState>(
    () => ({
      shouldReserveAssistantColumn: resolveStaffAssistantColumnReservation(isRailCollapsed, shouldReserveAssistantColumn),
      isAssistantLayoutSettling,
    }),
    [isAssistantLayoutSettling, isRailCollapsed, shouldReserveAssistantColumn]
  )
}
