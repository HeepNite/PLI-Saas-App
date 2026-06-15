export type KioskInfoPhase = "name-email" | "phone" | "pin"

export function nextKioskInfoPhase(current: KioskInfoPhase, service: string): KioskInfoPhase | "done" {
  if (current === "name-email") return "phone"
  if (current === "phone") return service === "new-student" ? "pin" : "done"

  return "done"
}
