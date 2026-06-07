export const KIOSK_INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000

type TimerHandle = ReturnType<typeof setTimeout> | null

type CreateKioskInactivityControllerInput = {
  timeoutMs?: number
  onTimeout: () => void | Promise<void>
  schedule?: typeof setTimeout
  cancel?: typeof clearTimeout
}

export const createKioskInactivityController = (input: CreateKioskInactivityControllerInput) => {
  const schedule = input.schedule ?? setTimeout
  const cancel = input.cancel ?? clearTimeout
  const timeoutMs = input.timeoutMs ?? KIOSK_INACTIVITY_TIMEOUT_MS
  let handle: TimerHandle = null

  const clear = () => {
    if (handle !== null) {
      cancel(handle)
      handle = null
    }
  }

  const arm = () => {
    clear()
    handle = schedule(() => {
      handle = null
      void input.onTimeout()
    }, timeoutMs)
  }

  const dispose = () => {
    clear()
  }

  return {
    arm,
    dispose,
  }
}
