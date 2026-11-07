import "server-only"

export const TERMINAL_CHARGE_NOT_ENABLED = "Charging is not enabled on this tablet"

/**
 * Rollout gate: only tablets whose slug is listed in TERMINAL_CHARGE_TERMINALS (comma-separated)
 * can receive staff charges. Unset or empty enables none, so every other kiosk runs unchanged.
 */
export const isTerminalChargeEnabled = (slug: string | null | undefined) =>
  Boolean(slug) && (process.env.TERMINAL_CHARGE_TERMINALS || "").split(",").map((entry) => entry.trim()).includes(slug as string)
