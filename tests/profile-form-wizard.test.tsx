// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vitest"
import { ProfileFormCard } from "@/components/front/profile/sections/ProfileFormCard"
import type { ProfileFormState } from "@/components/front/profile/profile-utils"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const completeForm: ProfileFormState = {
  firstName: "Jane", lastName: "Doe", birthDate: "2000-01-01",
  emergencyContactName: "John", emergencyContactRelation: "Father",
  emergencyContactPhone: "+12025550123", billingLine1: "", billingLine2: "",
  billingCity: "", billingState: "", billingPostalCode: "", billingCountry: "",
}

it("navigates linearly and saves only from the final profile step", async () => {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const onSave = vi.fn()
  function Harness() {
    const [form, setForm] = React.useState(completeForm)
    return <ProfileFormCard
      profileFormMounted profileFormVisible pointsBalance={120} profileForm={form}
      profileComplete={false} profileSaving={false} profileLoading={false}
      profileError={null} profileSaved={false} userEmail="jane@example.com"
      userPhone="+12025550123" onClose={vi.fn()} onSave={onSave}
      onProfileFieldChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
    />
  }
  const button = (name: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent?.trim() === name)!

  await act(async () => root.render(<Harness />))
  expect(container.querySelector("[data-current-step]")?.textContent).toBe("Personal information")
  expect((container.querySelector("#profile-email") as HTMLInputElement).readOnly).toBe(true)
  expect(onSave).not.toHaveBeenCalled()
  await act(async () => button("Next").click())
  expect(container.querySelector("[data-current-step]")?.textContent).toBe("Emergency contact")
  await act(async () => button("Next").click())
  expect(container.querySelector("[data-current-step]")?.textContent).toBe("Billing address")
  await act(async () => button("Save profile").click())
  expect(onSave).toHaveBeenCalledTimes(1)

  await act(async () => root.unmount())
  container.remove()
})
