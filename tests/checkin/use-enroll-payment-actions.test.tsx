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

const flushEffects = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

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
  isCheckInExistingFlow: false,
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
    delete (window as unknown as { pliNativeAttemptState?: unknown }).pliNativeAttemptState
    vi.unstubAllGlobals()
    vi.useRealTimers()
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

    it("propagates the kiosk QR cash grant into checkout payloads", async () => {
      const { getResult } = await renderHook(defaultInput({ kioskQrCashGrant: "signed.grant" }))

      expect(getResult().buildCheckoutPayload()).toMatchObject({ kioskQrCashGrant: "signed.grant" })
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

    it("sends ordinary prepareOnly without a native context refresh", async () => {
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async () => jsonResponse({ account: { hasAvatar: false } }))
      vi.stubGlobal("fetch", fetchMock)
      const { getResult } = await renderHook(defaultInput())

      await getResult().requestAccountPreparation()

      const call = fetchMock.mock.calls[0]
      expect(call[0]).toBe("/api/checkout/intent")
      const body = JSON.parse(call[1].body as string)
      expect(body.prepareOnly).toBe(true)
      expect(body.refreshKioskPreparedContext).toBeUndefined()
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

    it("preserves the selected Heritage country in hosted checkout payloads", async () => {
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async () => jsonResponse({ sessionId: "s1", url: "https://pay" }))
      vi.stubGlobal("fetch", fetchMock)
      const { getResult } = await renderHook(defaultInput({
        bookingSource: "public_booking",
        heritagePinCountryCode: "CO",
      }))

      await getResult().requestKioskCheckoutSession()

      const payload = JSON.parse(String(fetchMock.mock.calls[0][1].body))
      expect(payload).toMatchObject({ bookingSource: "public_booking", heritagePinCountryCode: "CO" })
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
  // authoritative public quote
  // ---------------------------------------------------------------------
  describe("authoritative public quote", () => {
    it("does not request a quote off the payments step or for non-public bookings", async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)

      await renderHook(defaultInput({ bookingSource: "public_booking", step: 0 }))
      await flushEffects()
      expect(fetchMock).not.toHaveBeenCalled()

      await renderHook(defaultInput())
      await flushEffects()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("quotes anonymously, then refreshes with a signed-in Clerk token", async () => {
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async () => jsonResponse({ amountCents: 1500, currency: "usd" }))
      vi.stubGlobal("fetch", fetchMock)
      const getToken = vi.fn(async () => "fresh-clerk-token")
      const { getResult, rerender } = await renderHook(defaultInput({ bookingSource: "public_booking", getToken }))
      await flushEffects()

      expect(fetchMock.mock.calls[0][0]).toBe("/api/public/checkout/quote")
      expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBeUndefined()
      expect(getResult().publicQuote).toEqual({ amountCents: 1500, currency: "usd" })

      await rerender(defaultInput({ bookingSource: "public_booking", isSignedIn: true, getToken }))
      await flushEffects()
      expect(getToken).toHaveBeenCalledWith({ skipCache: true })
      expect((fetchMock.mock.calls[1][1].headers as Record<string, string>).Authorization).toBe("Bearer fresh-clerk-token")
    })

    it("clears and refetches the quote when checkout payload inputs change", async () => {
      const nextQuote = deferred<Response>()
      let quoteRequests = 0
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(() => {
        quoteRequests += 1
        return quoteRequests === 1
          ? Promise.resolve(jsonResponse({ amountCents: 1500, currency: "usd" }))
          : nextQuote.promise
      })
      vi.stubGlobal("fetch", fetchMock)
      const input = defaultInput({ bookingSource: "public_booking", service: "regular" })
      const { getResult, rerender } = await renderHook(input)
      await flushEffects()
      expect(getResult().publicQuoteLoading).toBe(false)

      await rerender({ ...input, service: "new-student" })
      expect(getResult().publicQuote).toBeNull()
      expect(getResult().publicQuoteLoading).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toMatchObject({ serviceId: "new-student" })
      await act(async () => nextQuote.resolve(jsonResponse({ amountCents: 1500, currency: "usd" })))
    })

    it("keeps the latest quote when an earlier request resolves last", async () => {
      const first = deferred<Response>()
      const second = deferred<Response>()
      const fetchMock = vi.fn(() => fetchMock.mock.calls.length === 1 ? first.promise : second.promise)
      vi.stubGlobal("fetch", fetchMock)
      const input = defaultInput({ bookingSource: "public_booking", date: "2026-07-10" })
      const { getResult, rerender } = await renderHook(input)

      await rerender({ ...input, date: "2026-07-11" })
      await act(async () => second.resolve(jsonResponse({ amountCents: 1700, currency: "usd" })))
      expect(getResult().publicQuote).toEqual({ amountCents: 1700, currency: "usd" })

      await act(async () => first.resolve(jsonResponse({ amountCents: 1500, currency: "usd" })))
      expect(getResult().publicQuote).toEqual({ amountCents: 1700, currency: "usd" })
    })

    it("exposes a generic quote error and blocks public card submission while loading or errored", async () => {
      const pending = deferred<Response>()
      const fetchMock = vi.fn(() => pending.promise)
      vi.stubGlobal("fetch", fetchMock)
      const setFormError = vi.fn()
      const { getResult } = await renderHook(defaultInput({ bookingSource: "public_booking", setFormError }))

      await getResult().handleSubmit()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(setFormError).toHaveBeenCalled()

      await act(async () => pending.resolve(jsonResponse({ error: "sensitive server failure" }, { status: 400, ok: false })))
      expect(getResult().publicQuoteError).toBe("We couldn't refresh the current price. Please try again.")
      await getResult().handleSubmit()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("submits only after a successful quote, retaining local amount and the public intent endpoint", async () => {
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async (url) => (
        url === "/api/public/checkout/quote"
          ? jsonResponse({ amountCents: 1500, currency: "usd" })
          : jsonResponse({ clientSecret: "secret_abc" })
      ))
      vi.stubGlobal("fetch", fetchMock)
      const { getResult } = await renderHook(defaultInput({ bookingSource: "public_booking", total: 49.99 }))
      await flushEffects()

      await getResult().handleSubmit()
      const [url, request] = fetchMock.mock.calls[1]
      expect(url).toBe("/api/public/checkout/intent")
      expect(JSON.parse(request.body as string)).toMatchObject({ amount: 4999, bookingSource: "public_booking" })
    })
  })

  // ---------------------------------------------------------------------
  // authenticated profile quote
  // ---------------------------------------------------------------------
  describe("authenticated profile quote", () => {
    it("loads a profile quote before the Payments step with a fresh Clerk token", async () => {
      const fetchMock = vi.fn(async () => jsonResponse({ amountCents: 1500, currency: "usd" }))
      vi.stubGlobal("fetch", fetchMock)
      const getToken = vi.fn(async () => "fresh-clerk-token")
      const { getResult } = await renderHook(defaultInput({
        isProfileBookingFlow: true,
        isSignedIn: true,
        service: "dropin",
        step: 1,
        getToken,
      }))
      await flushEffects()

      expect(getToken).toHaveBeenCalledWith({ skipCache: true })
      expect(fetchMock).toHaveBeenCalledWith("/api/profile/checkout/quote", expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer fresh-clerk-token" }),
      }))
      expect(getResult().isProfileQuoteRequired).toBe(true)
      expect(getResult().profileQuote).toEqual({ amountCents: 1500, currency: "usd" })
    })

    it("does not request a profile quote for a non-ordinary Drop-in shape", async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)
      const { getResult } = await renderHook(defaultInput({
        isProfileBookingFlow: true,
        isSignedIn: true,
        service: "dropin",
        participants: 2,
        getToken: vi.fn(async () => "token"),
      }))
      await flushEffects()

      expect(fetchMock).not.toHaveBeenCalled()
      expect(getResult().isProfileQuoteRequired).toBe(false)
      expect(getResult().profileQuote).toBeNull()
    })

    it("clears for a package without requesting, then refreshes when returning to Drop-in", async () => {
      const fetchMock = vi.fn(async () => jsonResponse({ amountCents: 1500, currency: "usd" }))
      vi.stubGlobal("fetch", fetchMock)
      const input = defaultInput({ isProfileBookingFlow: true, isSignedIn: true, service: "dropin", getToken: vi.fn(async () => "token") })
      const { getResult, rerender } = await renderHook(input)
      await flushEffects()
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await rerender({ ...input, pkg: "ten-class-package" })
      await flushEffects()
      expect(getResult().isProfileQuoteRequired).toBe(false)
      expect(getResult().profileQuote).toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await rerender({ ...input, pkg: "" })
      await flushEffects()
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(getResult().isProfileQuoteRequired).toBe(true)
      expect(getResult().profileQuote).toEqual({ amountCents: 1500, currency: "usd" })
    })

    it("makes a resolved quote unavailable until the current request subject resolves", async () => {
      const first = deferred<Response>()
      const second = deferred<Response>()
      const third = deferred<Response>()
      const fourth = deferred<Response>()
      const fetchMock = vi.fn(() => [first, second, third, fourth][fetchMock.mock.calls.length - 1].promise)
      vi.stubGlobal("fetch", fetchMock)
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
      const input = defaultInput({ isProfileBookingFlow: true, isSignedIn: true, service: "dropin", getToken: vi.fn(async () => "token") })
      const { getResult, rerender } = await renderHook(input)

      await act(async () => first.resolve(jsonResponse({ amountCents: 1500, currency: "usd" })))
      expect(getResult().isProfileQuoteReady).toBe(true)
      expect(getResult().profileQuote).toEqual({ amountCents: 1500, currency: "usd" })

      await rerender({ ...input, date: "2026-07-11", time: "19:00" })
      expect(getResult().isProfileQuoteReady).toBe(false)
      expect(getResult().profileQuote).toBeNull()

      await rerender({ ...input, date: "2026-07-12", time: "19:00" })
      await act(async () => second.resolve(jsonResponse({ amountCents: 1700, currency: "usd" })))
      expect(getResult().isProfileQuoteReady).toBe(false)
      expect(getResult().profileQuote).toBeNull()

      await act(async () => third.resolve(jsonResponse({ amountCents: 1600, currency: "usd" })))
      expect(getResult().isProfileQuoteReady).toBe(true)
      expect(getResult().profileQuote).toEqual({ amountCents: 1600, currency: "usd" })

      await rerender({ ...input, date: "2026-07-13", time: "19:00" })
      await act(async () => root?.unmount())
      root = null
      await act(async () => fourth.resolve(jsonResponse({ amountCents: 1800, currency: "usd" })))
      expect(consoleError).not.toHaveBeenCalled()
      consoleError.mockRestore()
    })

    it("retries a failed profile quote once and ignores retry attempts while loading", async () => {
      const first = deferred<Response>()
      const second = deferred<Response>()
      const fetchMock = vi.fn(() => fetchMock.mock.calls.length === 1 ? first.promise : second.promise)
      vi.stubGlobal("fetch", fetchMock)
      const { getResult } = await renderHook(defaultInput({
        isProfileBookingFlow: true,
        isSignedIn: true,
        service: "dropin",
        getToken: vi.fn(async () => "token"),
      }))

      await act(async () => first.resolve(jsonResponse({ error: "unavailable" }, { status: 503, ok: false })))
      expect(getResult().profileQuoteError).toBe("We couldn't refresh the current price. Please try again.")

      await act(async () => {
        getResult().retryProfileQuote()
        getResult().retryProfileQuote()
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(getResult().profileQuoteLoading).toBe(true)
      expect(getResult().profileQuoteError).toBeNull()

      getResult().retryProfileQuote()
      expect(fetchMock).toHaveBeenCalledTimes(2)

      await act(async () => second.resolve(jsonResponse({ amountCents: 1500, currency: "usd" })))
      expect(getResult().profileQuote).toEqual({ amountCents: 1500, currency: "usd" })
      expect(getResult().profileQuoteLoading).toBe(false)
    })

    it("keeps the quote out of the final profile checkout-session payload", async () => {
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async (url) => (
        url === "/api/profile/checkout/quote"
          ? jsonResponse({ amountCents: 1500, currency: "usd" })
          : jsonResponse({ error: "declined" }, { status: 400, ok: false })
      ))
      vi.stubGlobal("fetch", fetchMock)
      const { getResult } = await renderHook(defaultInput({
        isProfileBookingFlow: true,
        isSignedIn: true,
        service: "dropin",
        total: 20,
        getToken: vi.fn(async () => "token"),
      }))
      await flushEffects()
      expect(getResult().profileQuote).toEqual({ amountCents: 1500, currency: "usd" })

      await getResult().handleSubmit()

      const sessionCall = fetchMock.mock.calls.find(([url]) => url === "/api/profile/checkout/session")
      expect(sessionCall).toBeDefined()
      const body = JSON.parse(String(sessionCall![1].body))
      expect(body.amount).toBe(2000)
      expect(body.profileQuote).toBeUndefined()
      expect(body.amountCents).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------
  // handleSubmit — public existing-customer package path
  // ---------------------------------------------------------------------
  describe("handleSubmit — public package reservation", () => {
    it("reserves an applicable package and skips paid checkout", async () => {
      const fetchMock = vi.fn(async () => jsonResponse({ ok: true, kind: "reserved", attendanceId: "attendance_1" }))
      vi.stubGlobal("fetch", fetchMock)
      const setSuccess = vi.fn()
      const setSuccessMessage = vi.fn()
      const getToken = vi.fn(async () => "session-token")
      const { getResult } = await renderHook(defaultInput({
        bookingSource: "public_booking",
        isCheckInFlow: true,
        isCheckInExistingFlow: true,
        isSignedIn: true,
        getToken,
        setSuccess,
        setSuccessMessage,
      }))

      await getResult().handleSubmit()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/profile/bookings/reserve-package",
        expect.objectContaining({ method: "POST" })
      )
      expect(setSuccess).toHaveBeenCalledWith(true)
      expect(setSuccessMessage).toHaveBeenCalledWith(expect.stringContaining("reserved with your package"))
    })
  })

  // ---------------------------------------------------------------------
  // handleSubmit — kiosk terminal QR/card fallback path
  // ---------------------------------------------------------------------
  describe("handleSubmit — kiosk terminal stripe (QR) path", () => {
    it("starts kiosk QR checkout when the native bridge is unavailable", async () => {
      const fetchMock = vi.fn(async () => jsonResponse({ sessionId: "s", url: "https://pay" }))
      vi.stubGlobal("fetch", fetchMock)
      const setProcessing = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          bookingSource: "public_booking",
          paymentMethod: "stripe",
          isKioskTerminalFlow: true,
          setProcessing,
        })
      )

      await getResult().handleSubmit()

      expect(fetchMock).toHaveBeenCalledWith("/api/checkout/session", expect.anything())
      expect(fetchMock).not.toHaveBeenCalledWith("/api/checkout/intent", expect.anything())
      expect(setProcessing).toHaveBeenCalledWith(true)
      expect(setProcessing).toHaveBeenLastCalledWith(false)
    })

    it("fails closed without creating QR or embedded checkout when the Android WebView bridge is unavailable", async () => {
      vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 11; SM-T500; wv) Version/4.0 Chrome/131" })
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)
      const setProcessing = vi.fn()
      const setFormError = vi.fn()
      const { getResult } = await renderHook(defaultInput({
        paymentMethod: "stripe",
        isKioskTerminalFlow: true,
        setProcessing,
        setFormError,
      }))

      await getResult().handleSubmit()

      expect(fetchMock).not.toHaveBeenCalled()
      expect(setFormError).toHaveBeenLastCalledWith("Card reader connection is unavailable. Reopen the PLI app and try again.")
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

    it("does not open the modal when the terminal checkout intent fails", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "Card declined" }, { status: 402, ok: false })))
      const setShowStripeModal = vi.fn()
      const setStripeClientSecret = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({ isKioskTerminalFlow: true, setShowStripeModal, setStripeClientSecret })
      )

      await getResult().handleSubmit()

      expect(setStripeClientSecret).not.toHaveBeenCalled()
      expect(setShowStripeModal).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------
  // handleSubmit — hosted Stripe session paths
  // ---------------------------------------------------------------------
  describe("handleSubmit — hosted Stripe session paths", () => {
    it("admits one rapid hosted checkout, releases after a recoverable failure, and stays processing for redirect", async () => {
      const firstResponse = deferred<Response>()
      const redirectResponse = deferred<Response>()
      const fetchMock = vi.fn(() => fetchMock.mock.calls.length === 1 ? firstResponse.promise : redirectResponse.promise)
      vi.stubGlobal("fetch", fetchMock)
      const setProcessing = vi.fn()
      const { getResult } = await renderHook(defaultInput({ isCheckInFlow: true, setProcessing }))

      const failedCheckout = getResult().handleSubmit()
      void getResult().handleSubmit()
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await act(async () => firstResponse.resolve(jsonResponse({ error: "declined" }, { status: 400, ok: false })))
      await failedCheckout
      expect(setProcessing).toHaveBeenLastCalledWith(false)

      const hostedCheckout = getResult().handleSubmit()
      expect(fetchMock).toHaveBeenCalledTimes(2)
      await act(async () => redirectResponse.resolve(jsonResponse({ url: "https://checkout.stripe.test/session" })))
      await hostedCheckout

      expect(setProcessing).toHaveBeenCalledTimes(3)
      expect(setProcessing).toHaveBeenNthCalledWith(1, true)
      expect(setProcessing).toHaveBeenNthCalledWith(2, false)
      expect(setProcessing).toHaveBeenNthCalledWith(3, true)
    })

    it("admits another hosted checkout after bfcache restoration renders processing false", async () => {
      const fetchMock = vi.fn(async () => jsonResponse({ url: "https://checkout.stripe.test/session" }))
      vi.stubGlobal("fetch", fetchMock)
      const input = defaultInput({ isCheckInFlow: true, processing: false })
      const { getResult, rerender } = await renderHook(input)

      await getResult().handleSubmit()
      expect(fetchMock).toHaveBeenCalledTimes(1)

      // The hosted handoff keeps its rendered lock, then resetForm/bfcache releases
      // the UI state after returning from Stripe while this hook instance remains mounted.
      await rerender({ ...input, processing: true })
      await rerender({ ...input, processing: false })
      await getResult().handleSubmit()

      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("uses the public session endpoint for public mobile/check-in bookings", async () => {
      const fetchMock = vi.fn(async (url: string) => (
        url === "/api/public/checkout/quote"
          ? jsonResponse({ amountCents: 1500, currency: "usd" })
          : jsonResponse({ error: "declined" }, { status: 400, ok: false })
      ))
      vi.stubGlobal("fetch", fetchMock)
      const { getResult } = await renderHook(defaultInput({
        bookingSource: "public_booking",
        isCheckInFlow: true,
      }))
      await flushEffects()

      await getResult().handleSubmit()

      expect(fetchMock).toHaveBeenCalledWith("/api/public/checkout/session", expect.anything())
    })

    it("keeps non-public mobile/check-in bookings on the default session endpoint", async () => {
      const fetchMock = vi.fn(async () => jsonResponse({ error: "declined" }, { status: 400, ok: false }))
      vi.stubGlobal("fetch", fetchMock)
      const { getResult } = await renderHook(defaultInput({ isCheckInFlow: true }))

      await getResult().handleSubmit()

      expect(fetchMock).toHaveBeenCalledWith("/api/checkout/session", expect.anything())
    })

    it("retries public mobile/check-in bookings through the public session endpoint", async () => {
      let sessionRequests = 0
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async (url) => {
        if (url === "/api/public/checkout/quote") return jsonResponse({ amountCents: 1500, currency: "usd" })
        sessionRequests += 1
        return sessionRequests === 1
          ? jsonResponse({ code: "ACCOUNT_EXISTS" }, { status: 409, ok: false })
          : jsonResponse({ error: "declined" }, { status: 400, ok: false })
      })
      vi.stubGlobal("fetch", fetchMock)
      const getToken = vi.fn(async () => "refreshed-token")
      const { getResult } = await renderHook(defaultInput({
        bookingSource: "public_booking",
        isCheckInFlow: true,
        isSignedIn: true,
        getToken,
      }))
      await flushEffects()

      await getResult().handleSubmit()

      expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
        "/api/public/checkout/quote",
        "/api/public/checkout/session",
        "/api/public/checkout/session",
      ])
      expect(getToken).toHaveBeenCalledTimes(3)
    })

    it("keeps profile bookings on the profile session endpoint", async () => {
      const fetchMock = vi.fn(async () => jsonResponse({ error: "declined" }, { status: 400, ok: false }))
      vi.stubGlobal("fetch", fetchMock)
      const { getResult } = await renderHook(defaultInput({ isProfileBookingFlow: true }))

      await getResult().handleSubmit()

      expect(fetchMock).toHaveBeenCalledWith("/api/profile/checkout/session", expect.anything())
    })
  })

  // ---------------------------------------------------------------------
  // handleSubmit — regular stripe (card intent) path
  // ---------------------------------------------------------------------
  describe("handleSubmit — regular stripe intent path", () => {
    it("uses the public intent endpoint while retaining the regular client amount in its payload", async () => {
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async (url) => (
        url === "/api/public/checkout/quote"
          ? jsonResponse({ amountCents: 1500, currency: "usd" })
          : jsonResponse({ clientSecret: "secret_abc" })
      ))
      vi.stubGlobal("fetch", fetchMock)
      const { getResult } = await renderHook(defaultInput({
        bookingSource: "public_booking",
        total: 49.99,
      }))
      await flushEffects()

      await getResult().handleSubmit()

      const [url, request] = fetchMock.mock.calls[1]
      expect(url).toBe("/api/public/checkout/intent")
      expect(JSON.parse(request.body as string)).toMatchObject({ amount: 4999, bookingSource: "public_booking" })
    })

    it("requests the default checkout intent and opens the stripe modal with the client secret on success", async () => {
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

    it("keeps QR-phone check-in on hosted checkout with its payload and redirect attempt", async () => {
      const hostedUrl = "https://checkout.stripe.test/session"
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async () => jsonResponse({ url: hostedUrl }))
      vi.stubGlobal("fetch", fetchMock)
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})
      const setProcessing = vi.fn()
      const { getResult } = await renderHook(
        defaultInput({
          isCheckInFlow: true,
          isKioskTerminalFlow: false,
          photoFlowContext: "qr_phone",
          setProcessing,
        })
      )

      await getResult().handleSubmit()

      expect(fetchMock).toHaveBeenCalledWith("/api/checkout/session", expect.anything())
      expect(fetchMock).not.toHaveBeenCalledWith("/api/checkout/intent", expect.anything())
      const sessionInit = fetchMock.mock.calls[0]?.[1]
      expect(sessionInit).toBeDefined()
      if (!sessionInit) throw new Error("Expected checkout-session request options")
      expect(JSON.parse(sessionInit.body as string)).toMatchObject({
        photoContext: "qr_phone",
        checkInBooking: true,
      })
      // jsdom does not expose cross-origin Location writes. A returned hosted URL
      // must therefore leave submission in its redirect state without alerting.
      expect(alertSpy).not.toHaveBeenCalled()
      expect(setProcessing).toHaveBeenCalledWith(true)
      expect(setProcessing).not.toHaveBeenCalledWith(false)
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

    it("retries public card bookings through the public intent endpoint with a refreshed token", async () => {
      let intentRequests = 0
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async (url) => {
        if (url === "/api/public/checkout/quote") return jsonResponse({ amountCents: 1500, currency: "usd" })
        intentRequests += 1
        return intentRequests === 1
          ? jsonResponse({ code: "ACCOUNT_EXISTS" }, { status: 409, ok: false })
          : jsonResponse({ clientSecret: "secret_retry" })
      })
      vi.stubGlobal("fetch", fetchMock)
      const getToken = vi.fn(async () => "tok")
      const setStripeClientSecret = vi.fn()
      const { getResult } = await renderHook(defaultInput({
        bookingSource: "public_booking",
        isSignedIn: true,
        getToken,
        setStripeClientSecret,
      }))
      await flushEffects()

      await getResult().handleSubmit()

      expect(getToken).toHaveBeenCalledTimes(3)
      expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
        "/api/public/checkout/quote",
        "/api/public/checkout/intent",
        "/api/public/checkout/intent",
      ])
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

  describe("native prepared kiosk handoff", () => {
    const reference = "A".repeat(43)
    const NATIVE_READER_UNRESPONSIVE = "The card reader did not respond. Please try again or choose another payment method."
    const installBridge = (postMessage: (message: string) => void) => {
      ;(window as unknown as { pliNativeBridge?: { postMessage: (message: string) => void; onmessage?: (event: { data: unknown }) => void } }).pliNativeBridge = { postMessage }
    }

    it("refreshes account context before native preparation, hands off once, and keeps the action locked", async () => {
      vi.useFakeTimers()
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async (_url, init) => {
        const payload = JSON.parse(init.body as string)
        return payload.prepareOnly
          ? jsonResponse({ account: { hasAvatar: false } })
          : jsonResponse({ preparedPurchaseReference: reference, state: "prepared" })
      })
      vi.stubGlobal("fetch", fetchMock)
      // The admitted operation stays in flight: native never answers the state poll here.
      const postMessage = vi.fn((raw: string) => {
        const request = JSON.parse(raw)
        if (request.operation !== "startPreparedPurchase") return
        ;(window as unknown as { pliNativeBridge: { onmessage?: (event: { data: unknown }) => void } }).pliNativeBridge.onmessage?.({ data: JSON.stringify({ version: 1, operation: "startPreparedPurchase", requestId: request.requestId, payload: { operationReference: "op_1", state: "accepted" } }) })
      })
      installBridge(postMessage)
      const setProcessing = vi.fn()
      const { getResult } = await renderHook(defaultInput({ isKioskTerminalFlow: true, setProcessing }))

      const first = getResult().handleSubmit()
      await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2))
      await getResult().handleSubmit()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body as string))).toMatchObject([
        { prepareOnly: true, paymentSurface: "embedded", refreshKioskPreparedContext: true, kioskCurrentCourseDuration: 60 },
        { paymentSurface: "native_m2_prepare", amount: 2500, serviceId: "regular" },
      ])
      expect(setProcessing).toHaveBeenCalledWith(true)
      expect(setProcessing).not.toHaveBeenLastCalledWith(false)
      await vi.advanceTimersByTimeAsync(5_000)
      await first
    })

    it("stops before native preparation or embedded checkout when account refresh fails", async () => {
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async () => jsonResponse({ error: "Account refresh failed" }, { status: 500, ok: false }))
      vi.stubGlobal("fetch", fetchMock)
      const postMessage = vi.fn()
      installBridge(postMessage)
      const setFormError = vi.fn()
      const setProcessing = vi.fn()
      const setShowStripeModal = vi.fn()
      const { getResult } = await renderHook(defaultInput({ isKioskTerminalFlow: true, setFormError, setProcessing, setShowStripeModal }))

      await getResult().handleSubmit()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject({
        prepareOnly: true, paymentSurface: "embedded", refreshKioskPreparedContext: true,
      })
      expect(postMessage).not.toHaveBeenCalled()
      expect(setFormError).toHaveBeenCalledWith("Account refresh failed")
      expect(setShowStripeModal).not.toHaveBeenCalled()
      expect(setProcessing).toHaveBeenLastCalledWith(false)
    })

    it("uses a kiosk session token minted mid-flow for refresh, native prepare, and attempt state", async () => {
      vi.useFakeTimers()
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async (url, init) => {
        if (url === "/api/checkout/native-attempt-state") return jsonResponse({ state: "absent" })
        const payload = JSON.parse(init.body as string)
        return payload.prepareOnly
          ? jsonResponse({ account: { hasAvatar: false } })
          : jsonResponse({ preparedPurchaseReference: reference, state: "prepared" })
      })
      vi.stubGlobal("fetch", fetchMock)
      const postMessage = vi.fn((raw: string) => {
        const request = JSON.parse(raw)
        if (request.operation !== "startPreparedPurchase") return
        ;(window as unknown as { pliNativeBridge: { onmessage?: (event: { data: unknown }) => void } }).pliNativeBridge.onmessage?.({ data: JSON.stringify({ version: 1, operation: "startPreparedPurchase", requestId: request.requestId, payload: { operationReference: "op_1", state: "accepted" } }) })
      })
      installBridge(postMessage)
      const { getResult, rerender } = await renderHook(defaultInput({ isKioskTerminalFlow: true }))

      await rerender(defaultInput({ isKioskTerminalFlow: true, kioskSessionToken: "kiosk_new_1" }))
      const first = getResult().handleSubmit()
      await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2))
      const reader = (window as unknown as { pliNativeAttemptState: () => Promise<unknown> }).pliNativeAttemptState
      await reader()

      expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body as string))).toMatchObject([
        { refreshKioskPreparedContext: true, kioskSessionToken: "kiosk_new_1" },
        { paymentSurface: "native_m2_prepare", kioskSessionToken: "kiosk_new_1" },
        { kioskSessionToken: "kiosk_new_1" },
      ])
      await vi.advanceTimersByTimeAsync(5_000)
      await first
    })

    it.each(["non-ok", "malformed"] as const)("does not fall back to embedded checkout when native preparation is %s", async (mode) => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(jsonResponse({ account: { hasAvatar: false } }))
        .mockResolvedValueOnce(
          mode === "non-ok"
            ? jsonResponse({ error: "Native reader unavailable" }, { status: 409, ok: false })
            : jsonResponse({ preparedPurchaseReference: reference, state: "prepared", extra: true })
        )
      vi.stubGlobal("fetch", fetchMock)
      const postMessage = vi.fn()
      installBridge(postMessage)
      const setFormError = vi.fn()
      const setProcessing = vi.fn()
      const setShowStripeModal = vi.fn()
      const { getResult } = await renderHook(defaultInput({ isKioskTerminalFlow: true, setFormError, setProcessing, setShowStripeModal }))

      await getResult().handleSubmit()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body as string).paymentSurface)).toEqual(["embedded", "native_m2_prepare"])
      expect(fetchMock.mock.calls.filter(([, init]) => {
        const payload = JSON.parse(init.body as string)
        return payload.paymentSurface === "embedded" && !payload.prepareOnly
      })).toHaveLength(0)
      expect(postMessage).not.toHaveBeenCalled()
      expect(setFormError).toHaveBeenCalledWith("We couldn't prepare native payment. Please try again.")
      expect(setShowStripeModal).not.toHaveBeenCalled()
      expect(setProcessing).toHaveBeenLastCalledWith(false)
    })

    it("serializes preparation before native admission", async () => {
      vi.useFakeTimers()
      let resolvePreparation!: (response: Response) => void
      let calls = 0
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(() => {
        calls += 1
        return calls === 1
          ? new Promise<Response>((resolve) => { resolvePreparation = resolve })
          : Promise.resolve(jsonResponse({ preparedPurchaseReference: reference, state: "prepared" }))
      })
      const postMessage = vi.fn((raw: string) => {
        const request = JSON.parse(raw)
        if (request.operation !== "startPreparedPurchase") return
        ;(window as unknown as { pliNativeBridge: { onmessage?: (event: { data: unknown }) => void } }).pliNativeBridge.onmessage?.({ data: JSON.stringify({ version: 1, operation: "startPreparedPurchase", requestId: request.requestId, payload: { operationReference: "op_1", state: "accepted" } }) })
      })
      vi.stubGlobal("fetch", fetchMock)
      installBridge(postMessage)
      const { getResult } = await renderHook(defaultInput({ isKioskTerminalFlow: true }))

      const first = getResult().handleSubmit()
      void getResult().handleSubmit()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      resolvePreparation(jsonResponse({ account: { hasAvatar: false } }))
      await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2))
      await getResult().handleSubmit()

      expect(postMessage).toHaveBeenCalledTimes(2)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls.filter(([, init]) => {
        const payload = JSON.parse(init.body as string)
        return payload.paymentSurface === "embedded" && !payload.prepareOnly
      })).toHaveLength(0)
      await vi.advanceTimersByTimeAsync(5_000)
      await first
    })

    it("shows the exact amount only after exact-operation PAID, then uses the shared reset after five seconds", async () => {
      vi.useFakeTimers()
      const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
        const payload = JSON.parse(init.body as string)
        return payload.prepareOnly
          ? jsonResponse({ account: { hasAvatar: false } })
          : jsonResponse({ preparedPurchaseReference: reference, state: "prepared" })
      })
      vi.stubGlobal("fetch", fetchMock)
      installBridge((raw) => {
        const request = JSON.parse(raw)
        const response = request.operation === "startPreparedPurchase"
          ? { operationReference: "op_1", state: "accepted" }
          : { operationReference: "op_1", state: "paid" }
        ;(window as unknown as { pliNativeBridge: { onmessage?: (event: { data: unknown }) => void } }).pliNativeBridge.onmessage?.({ data: JSON.stringify({ version: 1, operation: request.operation, requestId: request.requestId, payload: response }) })
      })
      const setSuccess = vi.fn()
      const setSuccessMessage = vi.fn()
      const resetCompletedKiosk = vi.fn()
      const input = defaultInput({ isKioskTerminalFlow: true, total: 25, setSuccess, setSuccessMessage })
      ;(input as typeof input & { onNativePaymentApproved?: () => void }).onNativePaymentApproved = resetCompletedKiosk
      const { getResult } = await renderHook(input)

      await getResult().handleSubmit()

      expect(setSuccessMessage).toHaveBeenCalledWith("Payment approved — $25.00")
      expect(setSuccess).toHaveBeenCalledWith(true)
      expect(resetCompletedKiosk).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(4_999)
      expect(resetCompletedKiosk).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(resetCompletedKiosk).toHaveBeenCalledTimes(1)
    })

    it.each(["rejected", "malformed", "unknown", "unresolved", "timeout"] as const)("releases admitted %s state with a visible error and no success, reset, fallback, or automatic re-preparation", async (mode) => {
      if (mode === "timeout") vi.useFakeTimers()
      const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
        const payload = JSON.parse(init.body as string)
        return payload.prepareOnly
          ? jsonResponse({ account: { hasAvatar: false } })
          : jsonResponse({ preparedPurchaseReference: reference, state: "prepared" })
      })
      vi.stubGlobal("fetch", fetchMock)
      const postMessage = vi.fn((raw: string) => {
        const request = JSON.parse(raw)
        if (request.operation === "startPreparedPurchase") {
          ;(window as unknown as { pliNativeBridge: { onmessage?: (event: { data: unknown }) => void } }).pliNativeBridge.onmessage?.({ data: JSON.stringify({ version: 1, operation: request.operation, requestId: request.requestId, payload: { operationReference: "op_1", state: "accepted" } }) })
          return
        }
        if (mode === "timeout") return
        const payload = mode === "malformed"
          ? {}
          : { operationReference: "op_1", state: mode === "unknown" ? "accepted" : "rejected", ...(mode === "unresolved" ? { error: "UNRESOLVED" } : {}) }
        ;(window as unknown as { pliNativeBridge: { onmessage?: (event: { data: unknown }) => void } }).pliNativeBridge.onmessage?.({ data: JSON.stringify({ version: 1, operation: request.operation, requestId: request.requestId, payload }) })
      })
      installBridge(postMessage)
      const setSuccess = vi.fn()
      const setShowStripeModal = vi.fn()
      const setProcessing = vi.fn()
      const setFormError = vi.fn()
      const resetCompletedKiosk = vi.fn()
      const input = defaultInput({ isKioskTerminalFlow: true, setSuccess, setShowStripeModal, setProcessing, setFormError })
      ;(input as typeof input & { onNativePaymentApproved?: () => void }).onNativePaymentApproved = resetCompletedKiosk
      const { getResult } = await renderHook(input)

      const submitted = getResult().handleSubmit()
      if (mode === "timeout") await vi.advanceTimersByTimeAsync(5_000)
      await submitted

      expect(postMessage).toHaveBeenCalledTimes(2)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(setSuccess).not.toHaveBeenCalled()
      expect(resetCompletedKiosk).not.toHaveBeenCalled()
      expect(setShowStripeModal).not.toHaveBeenCalled()
      expect(setFormError).toHaveBeenLastCalledWith(NATIVE_READER_UNRESPONSIVE)
      expect(setProcessing).toHaveBeenLastCalledWith(false)
    })

    it.each(["throws", "timeout", "malformed", "rejected"])("never requests an embedded intent after post-dispatch %s and releases processing with an error", async (mode) => {
      if (mode === "timeout") vi.useFakeTimers()
      const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
        const payload = JSON.parse(init.body as string)
        return payload.prepareOnly
          ? jsonResponse({ account: { hasAvatar: false } })
          : jsonResponse({ preparedPurchaseReference: reference, state: "prepared" })
      })
      vi.stubGlobal("fetch", fetchMock)
      installBridge((raw) => {
        if (mode === "throws") throw new Error("ambiguous")
        if (mode === "timeout") return
        const request = JSON.parse(raw)
        ;(window as unknown as { pliNativeBridge: { onmessage?: (event: { data: unknown }) => void } }).pliNativeBridge.onmessage?.({ data: JSON.stringify(mode === "malformed" ? {} : { version: 1, operation: "startPreparedPurchase", requestId: request.requestId, payload: { operationReference: "op_1", state: "rejected" } }) })
      })
      const setProcessing = vi.fn()
      const setFormError = vi.fn()
      const { getResult } = await renderHook(defaultInput({ isKioskTerminalFlow: true, setProcessing, setFormError }))

      const submission = getResult().handleSubmit()
      if (mode === "timeout") await vi.advanceTimersByTimeAsync(5_000)
      await submission

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(setFormError).toHaveBeenLastCalledWith(NATIVE_READER_UNRESPONSIVE)
      expect(setProcessing).toHaveBeenLastCalledWith(false)
    })
  })

  describe("native attempt-state global", () => {
    it("installs an input-free kiosk-only closed-state reader without payment side effects", async () => {
      const fetchMock = vi.fn<(...args: [string, RequestInit]) => Promise<Response>>(async () => jsonResponse({ state: "pending_without_payment" }))
      const postMessage = vi.fn()
      vi.stubGlobal("fetch", fetchMock)
      ;(window as unknown as { pliNativeBridge?: { postMessage: (message: string) => void } }).pliNativeBridge = { postMessage }
      await renderHook(defaultInput({ isKioskTerminalFlow: true, kioskSessionToken: "kiosk-token" }))
      const reader = (window as unknown as { pliNativeAttemptState?: () => Promise<unknown> }).pliNativeAttemptState
      expect(reader).toBeTypeOf("function")
      await expect(reader!()).resolves.toEqual({ state: "pending_without_payment" })
      expect(fetchMock).toHaveBeenCalledWith("/api/checkout/native-attempt-state", expect.objectContaining({ method: "POST", credentials: "include" }))
      const [, init] = fetchMock.mock.calls[0]!
      expect(JSON.parse(init.body as string)).toMatchObject({ kioskSessionToken: "kiosk-token" })
      expect(postMessage).not.toHaveBeenCalled()
    })

    it("returns only PAYMENT_UNRESOLVED for malformed or failed responses", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ state: "paid", extra: true })))
      await renderHook(defaultInput({ isKioskTerminalFlow: true }))
      const reader = (window as unknown as { pliNativeAttemptState: () => Promise<unknown> }).pliNativeAttemptState
      await expect(reader()).resolves.toEqual({ state: "payment_unresolved" })
    })

    it("does not install outside kiosk flow, does not clobber, and cleans up its own global", async () => {
      await renderHook(defaultInput())
      expect((window as unknown as { pliNativeAttemptState?: unknown }).pliNativeAttemptState).toBeUndefined()
      const existing = () => Promise.resolve({ state: "paid" })
      ;(window as unknown as { pliNativeAttemptState?: unknown }).pliNativeAttemptState = existing
      await renderHook(defaultInput({ isKioskTerminalFlow: true }))
      expect((window as unknown as { pliNativeAttemptState?: unknown }).pliNativeAttemptState).toBe(existing)
      delete (window as unknown as { pliNativeAttemptState?: unknown }).pliNativeAttemptState
      await act(async () => root?.unmount())
      root = null
      await renderHook(defaultInput({ isKioskTerminalFlow: true }))
      expect((window as unknown as { pliNativeAttemptState?: unknown }).pliNativeAttemptState).toBeTypeOf("function")
      await act(async () => root?.unmount())
      root = null
      expect((window as unknown as { pliNativeAttemptState?: unknown }).pliNativeAttemptState).toBeUndefined()
    })
  })
})
