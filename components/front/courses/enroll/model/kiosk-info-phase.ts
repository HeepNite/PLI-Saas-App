export type KioskInfoPhase = "name-email" | "phone"

/**
 * For the standard QR mobile compact flow: name-email → phone → done.
 * For the kiosk terminal 3-step flow (phone-first): phone → name-email → done.
 */
export function nextKioskInfoPhase(
  current: KioskInfoPhase,
  _service: string,
  options?: { phoneFirst?: boolean }
): KioskInfoPhase | "done" {
  if (options?.phoneFirst) {
    if (current === "phone") return "name-email"
    return "done"
  }

  if (current === "name-email") return "phone"
  return "done"
}

/** Returns the initial KioskInfoPhase for the given flow context. */
export function initialKioskInfoPhase(options?: { phoneFirst?: boolean }): KioskInfoPhase {
  return options?.phoneFirst ? "phone" : "name-email"
}
