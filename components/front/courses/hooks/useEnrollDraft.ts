import React from "react"
import type { Coupon, EnrollDraftState, EnrollmentContact, PaymentMethod } from "../types"

type DraftSetters = {
  setService: (value: string) => void
  setPkg: (value: string) => void
  setAddons: React.Dispatch<React.SetStateAction<string[]>>
  setParticipants: (value: number) => void
  setDate: (value: string) => void
  setTime: (value: string) => void
  setContact: React.Dispatch<React.SetStateAction<EnrollmentContact>>
  setCouponInput: (value: string) => void
  setAppliedCoupon: (value: Coupon) => void
  setPaymentMethod: (value: PaymentMethod) => void
  setStep: (value: number) => void
}

type UseEnrollDraftParams = {
  open: boolean
  success: boolean
  draftKey: string
  stepsCount: number
  state: EnrollDraftState
  setters: DraftSetters
}

export const useEnrollDraft = ({ open, success, draftKey, stepsCount, state, setters }: UseEnrollDraftParams) => {
  const hasRestoredDraft = React.useRef(false)

  React.useEffect(() => {
    if (!success) return
    sessionStorage.removeItem(draftKey)
  }, [success, draftKey])

  React.useEffect(() => {
    if (!open || hasRestoredDraft.current) return
    const raw = sessionStorage.getItem(draftKey)
    if (raw) {
      try {
        const draft = JSON.parse(raw) as Partial<EnrollDraftState>
        if (draft.service) setters.setService(draft.service)
        if (draft.pkg !== undefined) setters.setPkg(draft.pkg)
        if (draft.addons) setters.setAddons(draft.addons)
        if (typeof draft.participants === "number") setters.setParticipants(draft.participants)
        if (draft.date) setters.setDate(draft.date)
        if (draft.time) setters.setTime(draft.time)
        if (draft.contact) {
          setters.setContact((prev) => ({
            ...prev,
            ...draft.contact,
          }))
        }
        if (typeof draft.couponInput === "string") setters.setCouponInput(draft.couponInput)
        if (draft.appliedCoupon !== undefined) setters.setAppliedCoupon(draft.appliedCoupon ?? null)
        if (draft.paymentMethod !== undefined) setters.setPaymentMethod(draft.paymentMethod)
        if (typeof draft.step === "number") {
          setters.setStep(Math.max(0, Math.min(stepsCount - 1, Math.floor(draft.step))))
        }
      } catch {
        // ignore draft parse errors
      }
    }
    hasRestoredDraft.current = true
  }, [open, draftKey, stepsCount, setters])

  React.useEffect(() => {
    if (!open) return
    sessionStorage.setItem(draftKey, JSON.stringify(state))
  }, [open, draftKey, state])
}
