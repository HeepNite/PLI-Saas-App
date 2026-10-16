// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ProfileFormCard } from "@/components/front/profile/sections/ProfileFormCard"
import type { ProfileFormState } from "@/components/front/profile/profile-utils"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const completeForm: ProfileFormState = {
  firstName: "Jane", lastName: "Doe", birthDate: "2000-01-01",
  emergencyContactName: "John Doe", emergencyContactRelation: "Father",
  emergencyContactPhone: "+12025550123", billingLine1: "", billingLine2: "",
  billingCity: "", billingState: "", billingPostalCode: "", billingCountry: "",
}

let container: HTMLDivElement
let root: Root

const click = async (button: HTMLButtonElement) => {
  await act(async () => button.click())
}

const setInput = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}

function Harness({ initialForm = completeForm, onSave = vi.fn() }: {
  initialForm?: ProfileFormState
  onSave?: () => void
}) {
  const [profileForm, setProfileForm] = React.useState(initialForm)
  const [visible, setVisible] = React.useState(true)

  return (
    <>
      <ProfileFormCard
        profileFormMounted profileFormVisible={visible} pointsBalance={120}
        profileForm={profileForm} profileComplete={false} profileSaving={false}
        profileLoading={false} profileError={null} profileSaved={false}
        userEmail="jane@example.com" userPhone="+12025550123"
        onClose={() => setVisible(false)} onSave={onSave}
        onProfileFieldChange={(field, value) =>
          setProfileForm((current) => ({ ...current, [field]: value }))}
      />
      <button type="button" onClick={() => setVisible(true)}>Reopen profile</button>
    </>
  )
}

const buttonNamed = (name: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((button) => button.textContent?.trim() === name)!
const currentStep = () => container.querySelector("[data-current-step]")?.textContent

beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe("ProfileFormCard wizard", () => {
  it("uses linear Personal, Emergency, and Billing steps with one final save", async () => {
    const onSave = vi.fn()
    await act(async () => root.render(<Harness onSave={onSave} />))

    expect(currentStep()).toBe("Personal information")
    expect(container.querySelector("[data-profile-wizard]")).not.toBeNull()
    expect((container.querySelector("#profile-email") as HTMLInputElement).readOnly).toBe(true)
    expect(container.querySelector("#profile-first-name")?.parentElement?.parentElement?.className)
      .toContain("sm:grid-cols-2")
    expect(onSave).not.toHaveBeenCalled()

    await click(buttonNamed("Next"))
    expect(currentStep()).toBe("Emergency contact")
    expect(onSave).not.toHaveBeenCalled()
    await click(buttonNamed("Next"))
    expect(currentStep()).toBe("Billing address")
    await click(buttonNamed("Save profile"))
    expect(onSave).toHaveBeenCalledTimes(1)
    await click(buttonNamed("Back"))
    expect(currentStep()).toBe("Emergency contact")
  })

  it("blocks linear progress until the current required fields are complete", async () => {
    await act(async () => root.render(
      <Harness initialForm={{ ...completeForm, firstName: "", emergencyContactPhone: "" }} />
    ))

    expect(buttonNamed("Next").disabled).toBe(true)
    await setInput(container.querySelector("#profile-first-name") as HTMLInputElement, "Jane")
    expect(buttonNamed("Next").disabled).toBe(false)
    await click(buttonNamed("Next"))
    expect(buttonNamed("Next").disabled).toBe(true)
    expect(container.textContent).toContain("Complete the required fields to continue.")
  })

  it("requires a started billing address to be complete before final save", async () => {
    await act(async () => root.render(
      <Harness initialForm={{ ...completeForm, billingLine1: "123 Main St" }} />
    ))
    await click(buttonNamed("Next"))
    await click(buttonNamed("Next"))

    expect(buttonNamed("Save profile").disabled).toBe(true)
    expect(container.textContent).toContain("Complete the billing address or leave every billing field empty.")
  })

  it("resets to Personal on reopen while retaining unsaved form values", async () => {
    await act(async () => root.render(<Harness />))
    await setInput(container.querySelector("#profile-first-name") as HTMLInputElement, "Janet")
    await click(buttonNamed("Next"))
    await click(container.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!)
    await click(buttonNamed("Reopen profile"))

    expect(currentStep()).toBe("Personal information")
    expect((container.querySelector("#profile-first-name") as HTMLInputElement).value).toBe("Janet")
  })
})
