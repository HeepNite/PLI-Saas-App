// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useEnrollPaymentActions } from "@/components/front/courses/enroll/hooks/useEnrollPaymentActions"
import type { UseEnrollPaymentActionsInput } from "@/components/front/courses/enroll/hooks/useEnrollPaymentActions"
import type { EnrollmentContact, Coupon } from "@/components/front/courses/types"
import type { ConsecutiveOfferData } from "@/components/front/checkin/ConsecutiveClassOffer"

type HookResult = ReturnType<typeof useEnrollPaymentActions>

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const defaultContact = (): EnrollmentContact => ({
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  phone: "+1 5551234567",
  note: "",
})

const noCoupon = (): Coupon => null as unknown as Coupon

const defaultCourse = () => ({
  slug: "bjj-fundamentals",
  title: "BJJ Fundamentals",
  enrollment: { services: [], packages: [], addons: [] },
})

// jsonResponse builds a Response-like object matching what checkout-api.ts expects:
// it inspects res.ok / res.status directly, and calls res.json() (via fetchImpl override,
// requestNewStudentOutcomeApi additionally reads res.headers.get("content-type")).
const jsonResponse = (body: unknown, init: { status?: number; ok?: boolean; contentType?: string } = {}) => {
  const status = init.status ?? 200
  const ok = init.ok ?? (status >= 200 && status < 300)
  return {
    ok,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? (init.contentType ?? "application/json") : null) },
    json: async () => body,
  } as unknown as Response
}

const defaultInput = (override: Partial<UseEnrollPaymentActionsInput> = {}): UseEnrollPaymentActionsInput => ({
  course: defaultCourse(),
  service: "regular",
  pkg: "",
  addons: [],
  participants: 1,
  date: "2026-07-10",
  time: "18:00",
  contact: defaultContact(),
  appliedCoupon: noCoupon(),
  paymentMethod: "stripe",
  total: 25,
  photoFlowContext: "external_web",
  kioskSessionToken: undefined,
  checkInContextDate: "",
  checkInContextTime: "",
  checkInContextDuration: 60,
  consecutiveAccepted: false,
  consecutiveAddedCents: 0,
  effectiveConsecutiveOffer: null,
  isCheckInFlow: false,
  isKioskTerminalFlow: false,
  isProfileBookingFlow: false,
  isSignedIn: false,
  processing: false,
  step: 2,
  paymentsStepIndex: 2,
  infoStepIndex: 0,
  regularServiceId: "regular",
  regularServicePrice: 25,
  pendingAutoPay: false,
  getToken: vi.fn(async () => null),
  setService: vi.fn(),
  setStep: vi.fn(),
  setSuccess: vi.fn(),
  setSuccessMessage: vi.fn(),
  setProcessing: vi.fn(),
  setFormError: vi.fn(),
  setRequiresSignIn: vi.fn(),
  setExistingAccountDetected: vi.fn(),
  setResumeAfterSignInStep: vi.fn(),
  setPendingAutoPay: vi.fn(),
  setKioskQrCheckout: vi.fn(),
  setSignInPurpose: vi.fn(),
  setStripeClientSecret: vi.fn(),
  setShowStripeModal: vi.fn(),
  setPreparedAccount: vi.fn(),
  setNewStudentFallbackPhoneKey: vi.fn(),
  setFlowPopup: vi.fn(),
  setResumeContactFlowAfterSignIn: vi.fn(),
  t: (key: string) => key,
  ...override,
})

describe("useEnrollPaymentActions", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let result: HookResult | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    result = null
    vi.unstubAllGlobals()
  })

  const renderHook = async (input: UseEnrollPaymentActionsInput) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)

    function Harness(nextInput: UseEnrollPaymentActionsInput) {
      result = useEnrollPaymentActions(nextInput)
      return null
    }

    await act(async () => root!.render(<Harness {...input} />))
    return {
      getResult: () => result!,
      rerender: async (nextInput: UseEnrollPaymentActionsInput) => {
        await act(async () => root!.render(<Harness {...nextInput} />))
      },
    }
  }

  // ---------------------------------------------------------------------
  // buildCheckoutPayload — cents/amount/flags must be byte-for-byte exact
  // ---------------------------------------------------------------------
  describe("buildCheckoutPayload", () => {
    it("computes amount in cents via Math.round(total * 100) and carries core fields", async () => {
      const { getResult } = await renderHook(defaultInput({ total: 25.5 }))
      const payload = getResult().buildCheckoutPayload() as Record<string, unknown>

      expect(payload.amount).toBe(2550)
      expect(payload.currency).toBe("usd")
      expect(payload.courseSlug).toBe("bjj-fundamentals")
      expect(payload.serviceId).toBe("regular")
      expect(payload.phone).toBe("+1 5551234567")
      expect(payload.name).toBe("Jane Doe")
    })

    it("merges extra fields passed in (e.g. prepareOnly, cashNote)", async () => {
      const { getResult } = await renderHook(defaultInput())
      const payload = getResult().buildCheckoutPayload({ prepareOnly: true }) as Record<string, unknown>
      expect(payload.prepareOnly).toBe(true)

      const cashPayload = getResult().buildCheckoutPayload({ cashNote: "leave at front desk" }) as Record<string, unknown>
      expect(cashPayload.cashNote).toBe("leave at front desk")
    })

    it("includes consecutive fields only when consecutiveAccepted is true and an offer is present", async () => {
      const offer: ConsecutiveOfferData = {
        linkedCourseSlug: "bjj-advanced",
        linkedCourseTitle: "BJJ Advanced",
        linkedCourseTime: "19:00",
      } as ConsecutiveOfferData

      const { getResult: withoutAccept } = await renderHook(
        defaultInput({ consecutiveAccepted: false, consecutiveAddedCents: 500, effectiveConsecutiveOffer: offer })
      )
      const payloadWithoutAccept = withoutAccept().buildCheckoutPayload() as Record<string, unknown>
      expect(payloadWithoutAccept.consecutivePriceCents).toBeUndefined()

      const { getResult: withAccept } = await renderHook(
        defaultInput({ consecutiveAccepted: true, consecutiveAddedCents: 500, effectiveConsecutiveOffer: offer })
      )
      const payloadWithAccept = withAccept().buildCheckoutPayload() as Record<string, unknown>
      expect(payloadWithAccept.consecutivePriceCents).toBe(500)
      expect(payloadWithAccept.consecutiveLinkedCourseSlug).toBe("bjj-advanced")
    })

    it("passes kioskSessionToken through kioskSessionFields when present", async () => {
      const { getResult } = await renderHook(defaultInput({ kioskSessionToken: "kiosk-tok-123" }))
      const payload = getResult().buildCheckoutPayload() as Record<string, unknown>
      // createKioskSessionCheckoutPayloadFields spreads kiosk-session-specific keys when a token is present.
      expect(JSON.stringify(payload)).toContain("kiosk-tok-123")
    })
  })

  // ---------------------------------------------------------------------
  // requestNewStudentOutcome
  // ---------------------------------------------------------------------
  describe("requestNewStudentOutcome", () => {
    it("returns parsed data on success", async () => {
      const fetchMock = vi.fn(async () => jsonResponse({ outcome: "eligible" }))
      vi.stubGlobal("fetch", fetchMock)
      const setFormError = vi.fn()
      const { getResult } = await renderHook(defaultInput({ setFormError }))

      const outcome = await getResult().requestNewStudentOutcome()

      expect(outcome).toEqual({ outcome: "eligible" })
      expect(setFormError).not.toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/checkin/qr/new-student/verify",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ phone: "+1 5551234567" }) })
      )
    })

    it("sets a form error and returns null when response is not ok", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "phone not found" }, { status: 404, ok: false })))
      const setFormError = vi.fn()
      const { getResult } = await renderHook(defaultInput({ setFormError }))

      const outcome = await getResult().requestNewStudentOutcome()

      expect(outcome).toBeNull()
      expect(setFormError).toHaveBeenCalledWith("phone not found")
    })

    it("falls back to a generic error message when API returns no error string", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, { status: 500, ok: false })))
      const setFormError = vi.fn()
      const { getResult } = await renderHook(defaultInput({ setFormError }))

      const outcome = await getResult().requestNewStudentOutcome()

      expect(outcome).toBeNull()
      expect(setFormError).toHaveBeenCalledWith("We couldn't verify the customer's phone.")
    })
  })

  // ---------------------------------------------------------------------
  // requestAccountPreparation
  // ---------------------------------------------------------------------
  describe("requestAccountPreparation", () => {
    it("stores and returns the prepared account on success", async () => {
      const account = { hasAvatar: true, requiresSignIn: false }
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ account })))
      const setPreparedAccount = vi.fn()
      const setFormError = vi.fn()
      const { getResult } = await renderHook(defaultInput({ setPreparedAccount, setFormError }))

      const returned = await getResult().requestAccountPreparation()

      expect(returned).toEqual(account)
      expect(setPreparedAccount).toHaveBeenCalledWith(account)
      expect(setFormError).not.toHaveBeenCalled()
    })

    it("sends prepareOnly:true in the checkout payload", async () => {
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async () => jsonResponse({ account: { hasAvatar: false } }))
      vi.stubGlobal("fetch", fetchMock)
      const { getResult } = await renderHook(defaultInput())

      await getResult().requestAccountPreparation()

      const call = fetchMock.mock.calls[0]
      expect(call[0]).toBe("/api/checkout/intent")
      const body = JSON.parse(call[1].body as string)
      expect(body.prepareOnly).toBe(true)
    })

    it("sets a form error and returns null when account data is missing/invalid", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, { status: 200 })))
      const setFormError = vi.fn()
      const setPreparedAccount = vi.fn()
      const { getResult } = await renderHook(defaultInput({ setFormError, setPreparedAccount }))

      const returned = await getResult().requestAccountPreparation()

      expect(returned).toBeNull()
      expect(setPreparedAccount).not.toHaveBeenCalled()
      expect(setFormError).toHaveBeenCalledWith("We couldn't prepare the customer account.")
    })
  })

  // ---------------------------------------------------------------------
  // showRegularFallbackPopup
  // ---------------------------------------------------------------------
  describe("showRegularFallbackPopup", () => {
    it("stores the fallback phone key, switches to the regular service, and opens the popup with the given message", async () => {
      const setNewStudentFallbackPhoneKey = vi.fn()
      const setService = vi.fn()
      const setFlowPopup = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          service: "new-student",
          regularServiceId: "regular",
          setNewStudentFallbackPhoneKey,
          setService,
          setFlowPopup,
        })
      )

      getResult().showRegularFallbackPopup("Custom message")

      expect(setNewStudentFallbackPhoneKey).toHaveBeenCalled()
      expect(setService).toHaveBeenCalledWith("regular")
      expect(setFlowPopup).toHaveBeenCalledWith({ title: "Regular price applied", message: "Custom message" })
    })

    it("falls back to the default message with the formatted regular price when none is given", async () => {
      const setFlowPopup = vi.fn()
      const { getResult } = await renderHook(defaultInput({ regularServicePrice: 30, setFlowPopup }))

      getResult().showRegularFallbackPopup()

      expect(setFlowPopup).toHaveBeenCalledWith({
        title: "Regular price applied",
        message: "We switched this booking to the regular $30 price. Continue without restarting the flow.",
      })
    })

    it("does not call setService when already on the regular service", async () => {
      const setService = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({ service: "regular", regularServiceId: "regular", setService })
      )

      getResult().showRegularFallbackPopup()

      expect(setService).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------
  // requestKioskCheckoutSession
  // ---------------------------------------------------------------------
  describe("requestKioskCheckoutSession", () => {
    it("posts to /api/checkout/session with the built payload and optional token", async () => {
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async () => jsonResponse({ sessionId: "s1", url: "https://pay" }))
      vi.stubGlobal("fetch", fetchMock)
      const { getResult } = await renderHook(defaultInput())

      const { res, data } = await getResult().requestKioskCheckoutSession("tok-abc")

      expect(res.ok).toBe(true)
      expect(data).toEqual({ sessionId: "s1", url: "https://pay" })
      const call = fetchMock.mock.calls[0]
      expect(call[0]).toBe("/api/checkout/session")
      expect((call[1].headers as Record<string, string>).Authorization).toBe("Bearer tok-abc")
    })
  })

  // ---------------------------------------------------------------------
  // completeDropInCheckInAfterCardPayment
  // ---------------------------------------------------------------------
  describe("completeDropInCheckInAfterCardPayment", () => {
    it("returns null immediately when not a check-in flow", async () => {
      const { getResult } = await renderHook(defaultInput({ isCheckInFlow: false }))
      const message = await getResult().completeDropInCheckInAfterCardPayment({ paymentIntentId: "pi_1" })
      expect(message).toBeNull()
    })

    it("returns a generic success message without calling the API when a package purchase (pkg set)", async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)
      const { getResult } = await renderHook(defaultInput({ isCheckInFlow: true, pkg: "10-class-pack" }))
      const message = await getResult().completeDropInCheckInAfterCardPayment({ paymentIntentId: "pi_1" })
      expect(message).toBe("Purchase recorded successfully.")
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("returns a pending-sync message when neither paymentIntentId nor purchaseId is provided", async () => {
      const { getResult } = await renderHook(
        defaultInput({ isCheckInFlow: true, pkg: "", date: "2026-07-10", time: "18:00" })
      )
      const message = await getResult().completeDropInCheckInAfterCardPayment({})
      expect(message).toBe("Payment was completed, but check-in sync is still pending.")
    })

    it("calls the drop-in API with paymentIntentId and returns success message on ok", async () => {
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async () => jsonResponse({}))
      vi.stubGlobal("fetch", fetchMock)
      const { getResult } = await renderHook(
        defaultInput({ isCheckInFlow: true, pkg: "", date: "2026-07-10", time: "18:00", checkInContextDuration: 45 })
      )
      const message = await getResult().completeDropInCheckInAfterCardPayment({ paymentIntentId: "pi_42" })

      expect(message).toBe("Purchase and check-in recorded successfully.")
      const call = fetchMock.mock.calls[0]
      expect(call[0]).toBe("/api/checkin/qr/dropin")
      const body = JSON.parse(call[1].body as string)
      expect(body).toEqual({
        paymentIntentId: "pi_42",
        courseSlug: "bjj-fundamentals",
        date: "2026-07-10",
        time: "18:00",
        durationMinutes: 45,
      })
    })

    it("returns a partial-failure message when the drop-in API responds not-ok with an error", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "slot full" }, { status: 409, ok: false })))
      const { getResult } = await renderHook(
        defaultInput({ isCheckInFlow: true, pkg: "", date: "2026-07-10", time: "18:00" })
      )
      const message = await getResult().completeDropInCheckInAfterCardPayment({ purchaseId: "pur_1" })
      expect(message).toBe("Purchase recorded. Automatic check-in could not be completed: slot full")
    })

    it("swallows thrown errors and returns a soft-failure message", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down") }))
      const { getResult } = await renderHook(
        defaultInput({ isCheckInFlow: true, pkg: "", date: "2026-07-10", time: "18:00" })
      )
      const message = await getResult().completeDropInCheckInAfterCardPayment({ purchaseId: "pur_1" })
      expect(message).toBe("Payment was completed, but we couldn't confirm automatic check-in.")
    })
  })

  // ---------------------------------------------------------------------
  // startKioskQrCheckout
  // ---------------------------------------------------------------------
  describe("startKioskQrCheckout", () => {
    it("creates a qr_ready checkout state on success", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse({ sessionId: "sess_1", url: "https://pay/1", expiresAt: "2026-07-10T18:30:00Z" }))
      )
      const setKioskQrCheckout = vi.fn()
      const setFormError = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({ isKioskTerminalFlow: true, isSignedIn: false, setKioskQrCheckout, setFormError })
      )

      const success = await getResult().startKioskQrCheckout()

      expect(success).toBe(true)
      expect(setFormError).toHaveBeenCalledWith(null)
      const finalCall = setKioskQrCheckout.mock.calls.at(-1)![0]
      expect(finalCall).toEqual({
        phase: "qr_ready",
        sessionId: "sess_1",
        url: "https://pay/1",
        expiresAt: "2026-07-10T18:30:00Z",
        awaitingWebhook: false,
        purchaseId: null,
        paymentStatus: null,
        error: null,
      })
    })

    it("does not fetch a token when not signed in", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ sessionId: "s", url: "https://pay" })))
      const getToken = vi.fn(async () => "should-not-be-used")
      const { getResult } = await renderHook(defaultInput({ isSignedIn: false, getToken }))

      await getResult().startKioskQrCheckout()

      expect(getToken).not.toHaveBeenCalled()
    })

    it("retries once on 409 ACCOUNT_EXISTS while signed in, using a refreshed token", async () => {
      let call = 0
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          call += 1
          if (call === 1) return jsonResponse({ code: "ACCOUNT_EXISTS" }, { status: 409, ok: false })
          return jsonResponse({ sessionId: "sess_retry", url: "https://pay/retry" })
        })
      )
      const getToken = vi.fn(async () => "tok")
      const { getResult } = await renderHook(defaultInput({ isSignedIn: true, getToken }))

      const success = await getResult().startKioskQrCheckout()

      expect(success).toBe(true)
      expect(getToken).toHaveBeenCalledTimes(2)
      expect(call).toBe(2)
    })

    it("sets an error state and returns false when the API responds not-ok", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "boom" }, { status: 500, ok: false })))
      const setKioskQrCheckout = vi.fn()
      const setFormError = vi.fn()
      const { getResult } = await renderHook(defaultInput({ setKioskQrCheckout, setFormError }))

      const success = await getResult().startKioskQrCheckout()

      expect(success).toBe(false)
      expect(setFormError).toHaveBeenCalledWith("boom")
      const finalCall = setKioskQrCheckout.mock.calls.at(-1)![0]
      expect(finalCall.phase).toBe("error")
      expect(finalCall.error).toBe("boom")
    })

    it("sets an error state and returns false when the response is missing url/sessionId", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({})))
      const setFormError = vi.fn()
      const { getResult } = await renderHook(defaultInput({ setFormError }))

      const success = await getResult().startKioskQrCheckout()

      expect(success).toBe(false)
      expect(setFormError).toHaveBeenCalledWith("Checkout session is missing required data.")
    })
  })

  // ---------------------------------------------------------------------
  // resetKioskQrCheckout
  // ---------------------------------------------------------------------
  describe("resetKioskQrCheckout", () => {
    it("resets kiosk qr checkout state to the empty/idle state", async () => {
      const setKioskQrCheckout = vi.fn()
      const { getResult } = await renderHook(defaultInput({ setKioskQrCheckout }))

      getResult().resetKioskQrCheckout()

      expect(setKioskQrCheckout).toHaveBeenCalledWith(
        expect.objectContaining({ phase: "idle" })
      )
    })
  })

  // ---------------------------------------------------------------------
  // handleSubmit — kiosk terminal QR/card path
  // ---------------------------------------------------------------------
  describe("handleSubmit — kiosk terminal stripe (QR) path", () => {
    it("starts kiosk QR checkout and does not call the regular stripe intent endpoint", async () => {
      const fetchMock = vi.fn(async () => jsonResponse({ sessionId: "s", url: "https://pay" }))
      vi.stubGlobal("fetch", fetchMock)
      const setProcessing = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({ paymentMethod: "stripe", isKioskTerminalFlow: true, setProcessing })
      )

      await getResult().handleSubmit()

      expect(fetchMock).toHaveBeenCalledWith("/api/checkout/session", expect.anything())
      expect(fetchMock).not.toHaveBeenCalledWith("/api/checkout/intent", expect.anything())
      expect(setProcessing).toHaveBeenCalledWith(true)
      expect(setProcessing).toHaveBeenLastCalledWith(false)
    })

    it("does nothing when already processing", async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)
      const setProcessing = vi.fn()
      const { getResult } = await renderHook(defaultInput({ processing: true, setProcessing }))

      await getResult().handleSubmit()

      expect(fetchMock).not.toHaveBeenCalled()
      expect(setProcessing).not.toHaveBeenCalled()
    })

    it("runs the optional validateBeforeSubmit dep and aborts on a validation issue", async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)
      const setFormError = vi.fn()
      const setStep = vi.fn()
      const setProcessing = vi.fn()
      const { getResult } = await renderHook(defaultInput({ setFormError, setStep, setProcessing }))

      await getResult().handleSubmit(undefined, {
        validateBeforeSubmit: () => ({ message: "Missing contact info", step: 0 }),
      })

      expect(setFormError).toHaveBeenCalledWith("Missing contact info")
      expect(setStep).toHaveBeenCalledWith(0)
      expect(fetchMock).not.toHaveBeenCalled()
      // setProcessing(true) must never be set once validation blocks submission
      expect(setProcessing).not.toHaveBeenCalled()
    })

    it("proceeds when the optional validateBeforeSubmit dep returns no issue", async () => {
      const fetchMock = vi.fn(async () => jsonResponse({ sessionId: "s", url: "https://pay" }))
      vi.stubGlobal("fetch", fetchMock)
      const { getResult } = await renderHook(defaultInput({ isKioskTerminalFlow: true }))

      await getResult().handleSubmit(undefined, { validateBeforeSubmit: () => null })

      expect(fetchMock).toHaveBeenCalledWith("/api/checkout/session", expect.anything())
    })

    it("shows an alert and stops processing when the QR checkout throws", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down") }))
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})
      const setProcessing = vi.fn()
      const setKioskQrCheckout = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({ isKioskTerminalFlow: true, setProcessing, setKioskQrCheckout })
      )

      await getResult().handleSubmit()

      expect(alertSpy).toHaveBeenCalledWith("We couldn't start the QR payment. Please try again.")
      expect(setProcessing).toHaveBeenLastCalledWith(false)
      alertSpy.mockRestore()
    })
  })

  // ---------------------------------------------------------------------
  // handleSubmit — regular stripe (card intent) path
  // ---------------------------------------------------------------------
  describe("handleSubmit — regular stripe intent path", () => {
    it("requests a checkout intent and opens the stripe modal with the client secret on success", async () => {
      const fetchMock = vi.fn(async () => jsonResponse({ clientSecret: "secret_abc" }))
      vi.stubGlobal("fetch", fetchMock)
      const setStripeClientSecret = vi.fn()
      const setShowStripeModal = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({ paymentMethod: "stripe", isKioskTerminalFlow: false, setStripeClientSecret, setShowStripeModal })
      )

      await getResult().handleSubmit()

      expect(fetchMock).toHaveBeenCalledWith("/api/checkout/intent", expect.anything())
      expect(setStripeClientSecret).toHaveBeenCalledWith("secret_abc")
      expect(setShowStripeModal).toHaveBeenCalledWith(true)
    })

    it("sends the exact cents amount and service/package ids in the intent payload", async () => {
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async () => jsonResponse({ clientSecret: "sk" }))
      vi.stubGlobal("fetch", fetchMock)
      const { getResult } = await renderHook(
        defaultInput({ total: 49.99, service: "regular", pkg: "" })
      )

      await getResult().handleSubmit()

      const call = fetchMock.mock.calls[0]
      const body = JSON.parse(call[1].body as string)
      expect(body.amount).toBe(4999)
      expect(body.serviceId).toBe("regular")
      expect(body.packageId).toBe("")
    })

    it("retries once with a refreshed token on 409 ACCOUNT_EXISTS while signed in", async () => {
      let call = 0
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          call += 1
          if (call === 1) return jsonResponse({ code: "ACCOUNT_EXISTS" }, { status: 409, ok: false })
          return jsonResponse({ clientSecret: "secret_retry" })
        })
      )
      const getToken = vi.fn(async () => "tok")
      const setStripeClientSecret = vi.fn()
      const { getResult } = await renderHook(defaultInput({ isSignedIn: true, getToken, setStripeClientSecret }))

      await getResult().handleSubmit()

      expect(getToken).toHaveBeenCalledTimes(2)
      expect(setStripeClientSecret).toHaveBeenCalledWith("secret_retry")
    })

    it("blocks submission with account_exists_signed_in error when signed in and still ACCOUNT_EXISTS after retry", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ code: "ACCOUNT_EXISTS" }, { status: 409, ok: false })))
      const setFormError = vi.fn()
      const setRequiresSignIn = vi.fn()
      const setProcessing = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          isSignedIn: true,
          isCheckInFlow: false,
          setFormError,
          setRequiresSignIn,
          setProcessing,
          t: (key) => key,
        })
      )

      await getResult().handleSubmit()

      expect(setFormError).toHaveBeenCalledWith("account_exists_signed_in")
      expect(setRequiresSignIn).toHaveBeenCalledWith(false)
      expect(setProcessing).toHaveBeenLastCalledWith(false)
    })

    it("requires sign-in (does not set a form error) when ACCOUNT_EXISTS and not signed in and not a check-in flow", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ code: "ACCOUNT_EXISTS" }, { status: 409, ok: false })))
      const setFormError = vi.fn()
      const setRequiresSignIn = vi.fn()
      const setExistingAccountDetected = vi.fn()
      const setResumeAfterSignInStep = vi.fn()
      const setPendingAutoPay = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          isSignedIn: false,
          isCheckInFlow: false,
          paymentsStepIndex: 3,
          step: 3,
          setFormError,
          setRequiresSignIn,
          setExistingAccountDetected,
          setResumeAfterSignInStep,
          setPendingAutoPay,
        })
      )

      await getResult().handleSubmit()

      expect(setFormError).toHaveBeenCalledWith(null)
      expect(setRequiresSignIn).toHaveBeenCalledWith(true)
      expect(setExistingAccountDetected).toHaveBeenCalledWith(true)
      expect(setResumeAfterSignInStep).toHaveBeenCalledWith(3)
      expect(setPendingAutoPay).toHaveBeenCalledWith(true)
    })

    it("falls back to the regular price and shows the popup when NEW_STUDENT_ALREADY is returned", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ code: "NEW_STUDENT_ALREADY" }, { status: 400, ok: false })))
      const setFlowPopup = vi.fn()
      const setService = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({ service: "new-student", regularServiceId: "regular", setFlowPopup, setService })
      )

      await getResult().handleSubmit()

      expect(setService).toHaveBeenCalledWith("regular")
      expect(setFlowPopup).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Regular price applied" })
      )
    })

    it("falls back to the regular price when phone-verification-required error is returned during check-in flow", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse({ error: "Phone verification is required" }, { status: 400, ok: false }))
      )
      const setFlowPopup = vi.fn()
      const { getResult } = await renderHook(defaultInput({ isCheckInFlow: true, setFlowPopup }))

      await getResult().handleSubmit()

      expect(setFlowPopup).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("Phone verification was not completed") })
      )
    })

    it("shows a generic error message for a non-account-exists, non-fallback failure", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "Card declined" }, { status: 402, ok: false })))
      const setFormError = vi.fn()
      const setRequiresSignIn = vi.fn()
      const { getResult } = await renderHook(defaultInput({ setFormError, setRequiresSignIn }))

      await getResult().handleSubmit()

      expect(setFormError).toHaveBeenCalledWith("Card declined")
      expect(setRequiresSignIn).toHaveBeenCalledWith(false)
    })

    it("throws-and-alerts when clientSecret is missing on an ok response", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({})))
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})
      const setProcessing = vi.fn()
      const { getResult } = await renderHook(defaultInput({ setProcessing }))

      await getResult().handleSubmit()

      expect(alertSpy).toHaveBeenCalledWith("We couldn't start the payment. Please try again.")
      expect(setProcessing).toHaveBeenLastCalledWith(false)
      alertSpy.mockRestore()
    })
  })

  // ---------------------------------------------------------------------
  // handleSubmit — cash path
  // ---------------------------------------------------------------------
  describe("handleSubmit — cash path", () => {
    it("posts to /api/checkout/cash with cashNote from contact.note and marks success", async () => {
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async () => jsonResponse({ paymentStatus: "paid" }))
      vi.stubGlobal("fetch", fetchMock)
      const setSuccess = vi.fn()
      const setSuccessMessage = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          paymentMethod: "onsite",
          contact: { ...defaultContact(), note: "handle with care" },
          setSuccess,
          setSuccessMessage,
        })
      )

      await getResult().handleSubmit()

      const call = fetchMock.mock.calls[0]
      expect(call[0]).toBe("/api/checkout/cash")
      const body = JSON.parse(call[1].body as string)
      expect(body.cashNote).toBe("handle with care")
      expect(setSuccess).toHaveBeenCalledWith(true)
      expect(setSuccessMessage).toHaveBeenCalledWith("Cash request saved as pending confirmation.")
    })

    it("uses the migration.message from the API response when present", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse({ migration: { message: "Card on file used automatically." } }))
      )
      const setSuccessMessage = vi.fn()
      const { getResult } = await renderHook(defaultInput({ paymentMethod: "onsite", setSuccessMessage }))

      await getResult().handleSubmit()

      expect(setSuccessMessage).toHaveBeenCalledWith("Card on file used automatically.")
    })

    it("attempts automatic drop-in check-in for check-in flows with a confirmed (non-pending) payment", async () => {
      const fetchMock = vi.fn(async (url: string) => {
        if (url === "/api/checkout/cash") {
          return jsonResponse({ purchaseId: "pur_9", paymentStatus: "paid" })
        }
        if (url === "/api/checkin/qr/dropin") {
          return jsonResponse({})
        }
        throw new Error(`unexpected url ${url}`)
      })
      vi.stubGlobal("fetch", fetchMock)
      const setSuccessMessage = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          paymentMethod: "onsite",
          isCheckInFlow: true,
          pkg: "",
          date: "2026-07-10",
          time: "18:00",
          setSuccessMessage,
        })
      )

      await getResult().handleSubmit()

      expect(fetchMock).toHaveBeenCalledWith("/api/checkin/qr/dropin", expect.anything())
      expect(setSuccessMessage).toHaveBeenCalledWith("Cash payment recorded and check-in completed successfully.")
    })

    it("does NOT attempt automatic drop-in check-in when the cash payment is pending", async () => {
      const fetchMock = vi.fn(async () => jsonResponse({ purchaseId: "pur_9", paymentStatus: "pending" }))
      vi.stubGlobal("fetch", fetchMock)
      const { getResult } = await renderHook(
        defaultInput({ paymentMethod: "onsite", isCheckInFlow: true, pkg: "", date: "2026-07-10", time: "18:00" })
      )

      await getResult().handleSubmit()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).not.toHaveBeenCalledWith("/api/checkin/qr/dropin", expect.anything())
    })

    it("shows a pending-confirmation + sign-in-later message for signed-out non-check-in cash with requiresSignIn account", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse({ account: { requiresSignIn: true } }))
      )
      const setSuccessMessage = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({ paymentMethod: "onsite", isCheckInFlow: false, isSignedIn: false, setSuccessMessage })
      )

      await getResult().handleSubmit()

      expect(setSuccessMessage).toHaveBeenCalledWith(
        "Cash request saved as pending confirmation. Sign in later to save your card and speed up future checkouts."
      )
    })

    it("shows a staff-confirmation-pending message for non-check-in cash with pending paymentStatus", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ paymentStatus: "pending" })))
      const setSuccessMessage = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({ paymentMethod: "onsite", isCheckInFlow: false, setSuccessMessage })
      )

      await getResult().handleSubmit()

      expect(setSuccessMessage).toHaveBeenCalledWith(
        "Cash request saved. Staff must confirm the payment in admin before class access."
      )
    })

    it("falls back to the regular price on NEW_STUDENT_ALREADY for cash", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ code: "NEW_STUDENT_ALREADY" }, { status: 400, ok: false })))
      const setFlowPopup = vi.fn()
      const { getResult } = await renderHook(defaultInput({ paymentMethod: "onsite", setFlowPopup }))

      await getResult().handleSubmit()

      expect(setFlowPopup).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("not eligible for the new-student price") })
      )
    })

    it("requires sign-in for cash ACCOUNT_EXISTS on a non-check-in flow", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ code: "ACCOUNT_EXISTS" }, { status: 409, ok: false })))
      const setRequiresSignIn = vi.fn()
      const setExistingAccountDetected = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          paymentMethod: "onsite",
          isCheckInFlow: false,
          isSignedIn: false,
          setRequiresSignIn,
          setExistingAccountDetected,
        })
      )

      await getResult().handleSubmit()

      expect(setRequiresSignIn).toHaveBeenCalledWith(true)
      expect(setExistingAccountDetected).toHaveBeenCalledWith(true)
    })

    it("shows an alert and stops processing when the cash request throws", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down") }))
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})
      const setProcessing = vi.fn()
      const { getResult } = await renderHook(defaultInput({ paymentMethod: "onsite", setProcessing }))

      await getResult().handleSubmit()

      expect(alertSpy).toHaveBeenCalledWith("We couldn't register the cash payment. Please try again.")
      expect(setProcessing).toHaveBeenLastCalledWith(false)
      alertSpy.mockRestore()
    })
  })
})
