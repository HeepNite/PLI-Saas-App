export const STAFF_ASSISTANT_RAIL_EXIT_DURATION_MS = 240
export const STAFF_ASSISTANT_RAIL_EXIT_DURATION_CLASS = "duration-[240ms]"

export function shouldReserveStaffAssistantColumn(isRailCollapsed: boolean) {
  return !isRailCollapsed
}
