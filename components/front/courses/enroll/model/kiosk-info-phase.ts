export type KioskInfoPhase = "name-email" | "phone"

export function nextKioskInfoPhase(current: KioskInfoPhase, _service: string): KioskInfoPhase | "done" {
  if (current === "name-email") return "phone"

  return "done"
}
