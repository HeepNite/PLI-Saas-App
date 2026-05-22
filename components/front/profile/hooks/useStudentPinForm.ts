import React from "react"

export type StudentPinFormState = {
  pinCurrentValue: string
  setPinCurrentValue: React.Dispatch<React.SetStateAction<string>>
  pinNextValue: string
  setPinNextValue: React.Dispatch<React.SetStateAction<string>>
  pinConfirmValue: string
  setPinConfirmValue: React.Dispatch<React.SetStateAction<string>>
  pinRecoveryMode: boolean
  setPinRecoveryMode: React.Dispatch<React.SetStateAction<boolean>>
  pinSaving: boolean
  pinFormError: string | null
  setPinFormError: React.Dispatch<React.SetStateAction<string | null>>
  pinFormSuccess: string | null
  setPinFormSuccess: React.Dispatch<React.SetStateAction<string | null>>
  submitStudentPin: () => Promise<void>
}

export function useStudentPinForm(
  pinStatus: { enrolled: boolean },
  refreshPinStatus: () => Promise<void>
): StudentPinFormState {
  const [pinCurrentValue, setPinCurrentValue] = React.useState("")
  const [pinNextValue, setPinNextValue] = React.useState("")
  const [pinConfirmValue, setPinConfirmValue] = React.useState("")
  const [pinRecoveryMode, setPinRecoveryMode] = React.useState(false)
  const [pinSaving, setPinSaving] = React.useState(false)
  const [pinFormError, setPinFormError] = React.useState<string | null>(null)
  const [pinFormSuccess, setPinFormSuccess] = React.useState<string | null>(null)

  const submitStudentPin = React.useCallback(async () => {
    if (!pinRecoveryMode && pinStatus.enrolled && !/^\d{4}$/.test(pinCurrentValue)) {
      setPinFormError("Enter your current 4-digit PIN.")
      return
    }
    if (!/^\d{4}$/.test(pinNextValue)) {
      setPinFormError("New PIN must be exactly 4 digits.")
      return
    }
    if (pinNextValue !== pinConfirmValue) {
      setPinFormError("PIN confirmation does not match.")
      return
    }

    setPinSaving(true)
    setPinFormError(null)
    setPinFormSuccess(null)
    try {
      const res = await fetch("/api/profile/pin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPin: pinRecoveryMode ? undefined : pinCurrentValue,
          nextPin: pinNextValue,
          confirmPin: pinConfirmValue,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setPinFormError(data?.error || "Could not update your PIN.")
        return
      }
      setPinCurrentValue("")
      setPinNextValue("")
      setPinConfirmValue("")
      setPinFormSuccess(pinRecoveryMode ? "PIN recovered successfully." : "PIN updated successfully.")
      await refreshPinStatus()
    } catch {
      setPinFormError("Could not update your PIN.")
    } finally {
      setPinSaving(false)
    }
  }, [pinConfirmValue, pinCurrentValue, pinNextValue, pinRecoveryMode, pinStatus.enrolled, refreshPinStatus])

  return {
    pinCurrentValue,
    setPinCurrentValue,
    pinNextValue,
    setPinNextValue,
    pinConfirmValue,
    setPinConfirmValue,
    pinRecoveryMode,
    setPinRecoveryMode,
    pinSaving,
    pinFormError,
    setPinFormError,
    pinFormSuccess,
    setPinFormSuccess,
    submitStudentPin,
  }
}
