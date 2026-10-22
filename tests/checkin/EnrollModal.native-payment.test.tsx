// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mocked = vi.hoisted(() => ({
  resetForm: vi.fn(),
  paymentInput: null as { onNativePaymentApproved?: () => void } | null,
  submitInput: null as null | {
    setProcessing: (value: boolean) => void
    setSuccess: (value: boolean) => void
    setSuccessMessage: (value: string | null) => void
  },
  resetFormAction: null as null | (() => void),
  triggerNativePaid: null as null | (() => void),
  getToken: vi.fn(async () => null),
  setActive: vi.fn(async () => {}),
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  catalogCourses: [] as unknown[],
  paymentActions: {
    requestNewStudentOutcome: vi.fn(),
    requestAccountPreparation: vi.fn(),
    showRegularFallbackPopup: vi.fn(),
    completeDropInCheckInAfterCardPayment: vi.fn(),
    handleSubmit: vi.fn(),
    resetKioskQrCheckout: vi.fn(),
    publicQuote: null,
    publicQuoteLoading: false,
    publicQuoteError: null,
  },
}))

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: mocked.getToken }),
  useClerk: () => ({ setActive: mocked.setActive }),
  useUser: () => ({ isLoaded: false, isSignedIn: false, user: null }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocked.routerPush, replace: mocked.routerReplace }),
}))

vi.mock("@/components/front/hooks/useCatalogCourses", () => ({
  useCatalogCourses: () => ({ courses: mocked.catalogCourses }),
}))

vi.mock("@/components/front/courses/enroll/hooks/useEnrollPaymentActions", async () => {
  const { completeNativePaymentLifecycle } = await import("@/components/front/courses/enroll/native-payment-completion")

  return {
    useEnrollPaymentActions: (input: typeof mocked.paymentInput & {
      setProcessing: (value: boolean) => void
      setSuccess: (value: boolean) => void
      setSuccessMessage: (value: string | null) => void
    }) => {
      mocked.paymentInput = input
      mocked.triggerNativePaid = () => {
        completeNativePaymentLifecycle({
          total: 1,
          setProcessing: input.setProcessing,
          setSuccess: input.setSuccess,
          setSuccessMessage: input.setSuccessMessage,
          onComplete: input.onNativePaymentApproved,
        })
      }
      return mocked.paymentActions
    },
  }
})

vi.mock("@/components/front/courses/enroll/hooks/useEnrollSubmitActions", () => ({
  useEnrollSubmitActions: (input: NonNullable<typeof mocked.submitInput>) => {
    mocked.submitInput = input
    mocked.resetFormAction ??= () => {
      mocked.resetForm()
      mocked.submitInput?.setProcessing(false)
      mocked.submitInput?.setSuccess(false)
      mocked.submitInput?.setSuccessMessage(null)
    }
    return {
      resetForm: mocked.resetFormAction,
      handleClose: vi.fn(),
      handleSignInDismiss: vi.fn(),
    }
  },
}))

import EnrollModal from "@/components/front/courses/EnrollModal"

const course = {
  slug: "intro-salsa",
  title: "Intro Salsa",
  enrollment: { services: [], packages: [], addons: [] },
  schedule: { availableWeekdays: [] },
  location: {},
  instructors: [],
} as unknown as Parameters<typeof EnrollModal>[0]["course"]

describe("EnrollModal native payment completion", () => {
  let root: ReturnType<typeof createRoot> | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    mocked.resetForm.mockReset()
    mocked.paymentInput = null
    mocked.submitInput = null
    mocked.triggerNativePaid = null
    vi.useRealTimers()
  })

  it("routes native approval completion to the shared kiosk form reset", async () => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root!.render(<EnrollModal course={course} open={false} onCloseAction={vi.fn()} photoFlowContext="kiosk_terminal" />)
    })

    expect(mocked.paymentInput?.onNativePaymentApproved).toBeTypeOf("function")
    mocked.resetForm.mockClear()
    await act(async () => mocked.paymentInput?.onNativePaymentApproved?.())
    expect(mocked.resetForm).toHaveBeenCalledTimes(1)
  })

  it("renders the exact native approval for five seconds before resetting the station", async () => {
    vi.useFakeTimers()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root!.render(<EnrollModal course={course} open onCloseAction={vi.fn()} photoFlowContext="kiosk_terminal" />)
    })

    expect(mocked.triggerNativePaid).toBeTypeOf("function")
    await act(async () => mocked.triggerNativePaid?.())
    expect(container.textContent).toContain("Payment approved — $1.00")
    expect(mocked.resetForm).not.toHaveBeenCalled()

    await act(async () => vi.advanceTimersByTimeAsync(4_999))
    expect(container.textContent).toContain("Payment approved — $1.00")
    expect(mocked.resetForm).not.toHaveBeenCalled()

    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(mocked.resetForm).toHaveBeenCalledTimes(1)
    expect(container.textContent).not.toContain("Payment approved — $1.00")
  })

  it("returns the kiosk station to its landing screen after native approval instead of reopening the form", async () => {
    vi.useFakeTimers()
    const onCompletedAction = vi.fn()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root!.render(
        <EnrollModal
          course={course}
          open
          onCloseAction={vi.fn()}
          onCompletedAction={onCompletedAction}
          flowVariant="checkin-existing"
          completionMode="station"
          photoFlowContext="kiosk_terminal"
        />,
      )
    })

    await act(async () => mocked.triggerNativePaid?.())
    await act(async () => vi.advanceTimersByTimeAsync(5_000))

    expect(onCompletedAction).toHaveBeenCalledTimes(1)
    expect(mocked.resetForm).not.toHaveBeenCalled()

    await act(async () => vi.advanceTimersByTimeAsync(10_000))
    expect(onCompletedAction).toHaveBeenCalledTimes(1)
  })
})
