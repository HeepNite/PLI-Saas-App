import React from "react"
import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { ProfileFormCard } from "@/components/front/profile/sections/ProfileFormCard"
import type { ProfileFormState } from "@/components/front/profile/profile-utils"

describe("ProfileFormCard", () => {
  const profileForm: ProfileFormState = {
    firstName: "Jane",
    lastName: "Doe",
    birthDate: "2000-01-01",
    emergencyContactName: "John Doe",
    emergencyContactRelation: "Father",
    emergencyContactPhone: "123456789",
    billingLine1: "Main St 123",
    billingLine2: "",
    billingCity: "Miami",
    billingState: "FL",
    billingPostalCode: "33101",
    billingCountry: "USA",
  }

  it("renders the profile header and current points", () => {
    const html = renderToStaticMarkup(
      <ProfileFormCard
        profileFormMounted
        profileFormVisible
        pointsBalance={120}
        profileForm={profileForm}
        profileComplete={false}
        profileSaving={false}
        profileLoading={false}
        profileError={null}
        profileSaved={false}
        userEmail="jane@example.com"
        userPhone="+1 555 000"
        onClose={vi.fn()}
        onSave={vi.fn()}
        onProfileFieldChange={vi.fn()}
      />
    )

    expect(html).toContain("Complete your profile and earn points")
    expect(html).toContain("PLI Coins: ")
    expect(html).toContain("120")
  })

  it("shows complete-profile hint when profile is incomplete", () => {
    const html = renderToStaticMarkup(
      <ProfileFormCard
        profileFormMounted
        profileFormVisible
        pointsBalance={0}
        profileForm={profileForm}
        profileComplete={false}
        profileSaving={false}
        profileLoading={false}
        profileError={null}
        profileSaved={false}
        userEmail=""
        userPhone=""
        onClose={vi.fn()}
        onSave={vi.fn()}
        onProfileFieldChange={vi.fn()}
      />
    )

    expect(html).toContain("Complete your profile to earn 10 points.")
  })
})
