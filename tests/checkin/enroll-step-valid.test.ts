import { describe, expect, it } from "vitest"
import type { EnrollmentOption } from "@/constants/courses"
import { resolveStepValid, type StepValidContext } from "@/components/front/courses/enroll/model/enroll-step-valid"

const serviceOptions: EnrollmentOption[] = [{ id: "regular", label: "Regular" }]

const createContext = (overrides: Partial<StepValidContext> = {}): StepValidContext => ({
  steps: [
    { key: "party" },
    { key: "datetime" },
    { key: "info" },
    { key: "photo" },
    { key: "packages" },
    { key: "consecutive" },
    { key: "payments" },
    { key: "review" },
  ],
  participants: 1,
  availableServices: serviceOptions,
  service: "regular",
  date: "2026-06-12",
  time: "10:00",
  consecutiveOfferLoading: false,
  contact: {
    firstName: "Ana",
    lastName: "Diaz",
    email: "ana@example.com",
    phone: "+1 917 555 1212",
    note: "",
  },
  studentPin: "1234",
  studentPinConfirm: "1234",
  requiresPhotoStep: false,
  photoSaved: false,
  consecutiveChoiceMade: true,
  paymentMethod: "stripe",
  ...overrides,
})

describe("resolveStepValid", () => {
  it("validates the party step with participants and a known service", () => {
    expect(resolveStepValid(0, createContext())).toBe(true)
    expect(resolveStepValid(0, createContext({ participants: 0 }))).toBe(false)
    expect(resolveStepValid(0, createContext({ service: "missing" }))).toBe(false)
  })

  it("validates datetime only when date, time, and offer loading are settled", () => {
    expect(resolveStepValid(1, createContext())).toBe(true)
    expect(resolveStepValid(1, createContext({ date: "" }))).toBe(false)
    expect(resolveStepValid(1, createContext({ time: "" }))).toBe(false)
    expect(resolveStepValid(1, createContext({ consecutiveOfferLoading: true }))).toBe(false)
  })

  it("validates contact info and new-student PIN confirmation", () => {
    expect(resolveStepValid(2, createContext())).toBe(true)
    expect(resolveStepValid(2, createContext({ contact: { ...createContext().contact, firstName: "A" } }))).toBe(false)
    expect(resolveStepValid(2, createContext({ contact: { ...createContext().contact, email: "a@b" } }))).toBe(false)
    expect(resolveStepValid(2, createContext({ contact: { ...createContext().contact, phone: "+1 917" } }))).toBe(false)
    expect(resolveStepValid(2, createContext({ service: "new-student" }))).toBe(true)
    expect(resolveStepValid(2, createContext({ service: "new-student", studentPinConfirm: "9999" }))).toBe(false)
    expect(resolveStepValid(2, createContext({ service: "new-student", studentPin: "123" }))).toBe(false)
  })

  it("validates the photo step only when required photo is saved", () => {
    expect(resolveStepValid(3, createContext({ requiresPhotoStep: false, photoSaved: false }))).toBe(true)
    expect(resolveStepValid(3, createContext({ requiresPhotoStep: true, photoSaved: false }))).toBe(false)
    expect(resolveStepValid(3, createContext({ requiresPhotoStep: true, photoSaved: true }))).toBe(true)
  })

  it("keeps packages and review steps always valid", () => {
    expect(resolveStepValid(4, createContext())).toBe(true)
    expect(resolveStepValid(7, createContext())).toBe(true)
  })

  it("validates consecutive choice", () => {
    expect(resolveStepValid(5, createContext({ consecutiveChoiceMade: true }))).toBe(true)
    expect(resolveStepValid(5, createContext({ consecutiveChoiceMade: false }))).toBe(false)
  })

  it("validates payments with a selected payment method and settled offer loading", () => {
    expect(resolveStepValid(6, createContext({ paymentMethod: "stripe" }))).toBe(true)
    expect(resolveStepValid(6, createContext({ paymentMethod: "" }))).toBe(false)
    expect(resolveStepValid(6, createContext({ consecutiveOfferLoading: true }))).toBe(false)
  })

  it("rejects unknown step indexes", () => {
    expect(resolveStepValid(99, createContext())).toBe(false)
  })
})
