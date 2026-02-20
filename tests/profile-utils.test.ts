import { describe, it, expect } from "vitest"
import {
  toDateInput,
  buildProfileFormState,
  getProfileCompletionPercent,
  buildBookingPrefillContact,
  getPackageAssignmentSummary,
} from "@/components/front/profile/profile-utils"

describe("profile utils", () => {
  it("normalizes dates for date inputs", () => {
    expect(toDateInput("2026-02-10")).toBe("2026-02-10")
    expect(toDateInput(new Date("2026-02-10T00:00:00Z"))).toBe("2026-02-10")
    expect(toDateInput("not-a-date")).toBe("")
  })

  it("builds profile form state with fallbacks", () => {
    const profile = {
      firstName: "Ana",
      lastName: "Gomez",
      birthDate: "2026-01-01",
      emergencyContactName: "Luis",
      emergencyContactRelation: "Hermano",
      emergencyContactPhone: "123",
    }
    const user = { firstName: "Fallback", lastName: "User" }
    expect(buildProfileFormState(profile, user)).toEqual({
      firstName: "Ana",
      lastName: "Gomez",
      birthDate: "2026-01-01",
      emergencyContactName: "Luis",
      emergencyContactRelation: "Hermano",
      emergencyContactPhone: "123",
      billingLine1: "",
      billingLine2: "",
      billingCity: "",
      billingState: "",
      billingPostalCode: "",
      billingCountry: "",
    })
  })

  it("computes completion percent", () => {
    const form = buildProfileFormState({}, {})
    expect(getProfileCompletionPercent(form)).toBe(0)
    const filled = {
      ...form,
      firstName: "A",
      lastName: "B",
      birthDate: "2026-01-01",
      emergencyContactName: "C",
      emergencyContactRelation: "D",
      emergencyContactPhone: "E",
    }
    expect(getProfileCompletionPercent(filled)).toBe(100)
  })

  it("builds booking prefill contact with priorities", () => {
    const form = {
      firstName: "Ana",
      lastName: "Gomez",
      birthDate: "",
      emergencyContactName: "",
      emergencyContactRelation: "",
      emergencyContactPhone: "",
      billingLine1: "",
      billingLine2: "",
      billingCity: "",
      billingState: "",
      billingPostalCode: "",
      billingCountry: "",
    }
    const profileUser = { email: "ana@pli.com", phone: "+1 2222222222" }
    const clerkUser = {
      firstName: "Clerk",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "clerk@pli.com" },
      primaryPhoneNumber: { phoneNumber: "+1 1111111111" },
    }
    expect(buildBookingPrefillContact(form, profileUser, clerkUser)).toEqual({
      firstName: "Ana",
      lastName: "Gomez",
      email: "ana@pli.com",
      phone: "+1 2222222222",
    })
  })

  it("builds package assignment summary for limited plans", () => {
    expect(
      getPackageAssignmentSummary({
        isUnlimited: false,
        totalCredits: 10,
        remainingCredits: 6,
        queuedCount: 2,
        assignedBookingsCount: 0,
      })
    ).toEqual({
      assigned: 6,
      remaining: 4,
      queued: 2,
      isUnlimited: false,
    })
  })

  it("builds package assignment summary for unlimited plans", () => {
    expect(
      getPackageAssignmentSummary({
        isUnlimited: true,
        totalCredits: null,
        remainingCredits: null,
        queuedCount: 3,
        assignedBookingsCount: 7,
      })
    ).toEqual({
      assigned: 10,
      remaining: null,
      queued: 3,
      isUnlimited: true,
    })
  })
})
