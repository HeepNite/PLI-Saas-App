import React from "react"
import { createKioskInactivityController } from "@/lib/checkin/kiosk-inactivity"
import { resolveStationTimeoutAction } from "@/lib/checkin/enroll-flow"
import { shouldPauseKioskInactivityForQrPhase, type KioskQrCheckoutPhase } from "@/lib/checkin/kiosk-qr-payment"

type UseKioskInactivityProps = {
  open: boolean
  isStationCompletion: boolean
  success: boolean
  qrPhase: KioskQrCheckoutPhase
  onCompletedAction?: () => void | Promise<void>
  onTimeoutAction?: () => void
}

export function useKioskInactivity({
  open,
  isStationCompletion,
  success,
  qrPhase,
  onCompletedAction,
  onTimeoutAction,
}: UseKioskInactivityProps): void {
  React.useEffect(() => {
    if (
      !open ||
      !isStationCompletion ||
      (!onCompletedAction && !onTimeoutAction) ||
      success ||
      shouldPauseKioskInactivityForQrPhase(qrPhase)
    ) {
      return
    }

    const timeoutAction = resolveStationTimeoutAction(onTimeoutAction, onCompletedAction)
    const controller = createKioskInactivityController({
      onTimeout: () => {
        void timeoutAction?.()
      },
    })
    const handleActivity = () => controller.arm()
    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"]

    controller.arm()
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, handleActivity, { passive: true })
    }

    return () => {
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, handleActivity)
      }
      controller.dispose()
    }
  }, [isStationCompletion, onCompletedAction, onTimeoutAction, open, qrPhase, success])
}
