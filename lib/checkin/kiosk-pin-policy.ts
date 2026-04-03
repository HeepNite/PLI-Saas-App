import type {
  KioskPinField,
  KioskPinIdentifySuccess,
  KioskPinRotationMode,
} from "@/components/front/checkin/checkin-kiosk.types"

type ResolveKioskPinPanelCopyInput = {
  hasKioskPinSession: boolean
  rotationMode: KioskPinRotationMode | null
}

type ResolveKioskPinIdentifySuccessMessageInput = {
  requiresPinRotation: boolean
  rotationMode: KioskPinRotationMode | null
}

export const resolveKioskPinRotationMode = (
  input: Pick<KioskPinIdentifySuccess, "credentialKind" | "regenerationReason" | "requiresPinRegeneration" | "requiresPinRotation">
): KioskPinRotationMode | null => {
  if (!input.requiresPinRotation) return null
  if (input.requiresPinRegeneration || input.regenerationReason === "obsolete" || input.credentialKind === "permanent") {
    return "regeneration"
  }
  return "provisional"
}

export const resolveActiveKioskPinField = (input: {
  hasKioskPinSession: boolean
  nextPin: string
}): KioskPinField => {
  if (!input.hasKioskPinSession) return "entry"
  return input.nextPin.length < 4 ? "next" : "confirm"
}

export const getActivePinSlotIndex = (value: string) => Math.min(value.length, 3)

export const getKioskPinPanelCopy = (input: ResolveKioskPinPanelCopyInput) => {
  if (!input.hasKioskPinSession) {
    return {
      title: "Enter your 4-digit PIN",
      description: "We'll identify your account here and continue on this terminal.",
    }
  }

  if (input.rotationMode === "regeneration") {
    return {
      title: "Regenerate your 4-digit PIN",
      description:
        "This PIN expired after inactivity. Set a new permanent PIN now before continuing to purchase. Keep it easy to remember for future check-ins on this terminal, then confirm it once below.",
    }
  }

  return {
    title: "Create your new 4-digit PIN",
    description:
      "This provisional PIN only works once. Set a permanent PIN now before continuing to purchase. Keep it easy to remember for future check-ins on this terminal, then confirm it once below.",
  }
}

export const getKioskPinIdentifySuccessMessage = (input: ResolveKioskPinIdentifySuccessMessageInput) => {
  if (!input.requiresPinRotation) return "Identity confirmed. Loading your current class options..."
  if (input.rotationMode === "regeneration") return "Identity confirmed. Regenerate your PIN to continue."
  return "Identity confirmed. Create your permanent PIN to continue."
}
