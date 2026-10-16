// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import EnrollInfoStep from "@/components/front/courses/enroll/steps/EnrollInfoStep"
import type { EnrollmentContact } from "@/components/front/courses/types"
import type { I18nKey } from "@/lib/i18n-dict"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement

const setInput = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}

function Harness() {
  const [contact, setContact] = React.useState<EnrollmentContact>({
    firstName: "Test",
    lastName: "Student",
    email: "test@example.com",
    phone: "",
    note: "",
  })
  const [phoneTouched, setPhoneTouched] = React.useState(false)

  return (
    <>
      <EnrollInfoStep
        activeNumericField={null}
        contact={contact}
        handleNumpadBackspace={vi.fn()}
        handleNumpadClear={vi.fn()}
        handleNumpadDigit={vi.fn()}
        isCheckInFlow={false}
        isKioskTerminalFlow={false}
        kioskInfoPhase="name-email"
        phoneTouched={phoneTouched}
        service="dropin"
        setActiveNumericField={vi.fn()}
        setContact={setContact}
        setExistingAccountDetected={vi.fn()}
        setPendingAutoPay={vi.fn()}
        setPhoneTouched={setPhoneTouched}
        setRequiresSignIn={vi.fn()}
        setResumeAfterSignInStep={vi.fn()}
        setKioskInfoPhase={vi.fn()}
        shouldMaskKioskInfoContent={false}
        t={(key: I18nKey) => key}
      />
      <output data-testid="canonical-phone">{contact.phone}</output>
    </>
  )
}

beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

it("stores an approved international booking phone as E.164", async () => {
  await act(async () => root.render(<Harness />))
  const countryTrigger = container.querySelector<HTMLButtonElement>("[data-country-trigger]")!
  await act(async () => countryTrigger.click())
  const search = container.querySelector<HTMLInputElement>('input[role="combobox"]')!
  await setInput(search, "Mexico")
  const mexico = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]'))
    .find((option) => option.textContent?.includes("Mexico MX +52"))!
  await act(async () => mexico.click())

  const phone = container.querySelector<HTMLInputElement>("#enrollment-phone-number")!
  await setInput(phone, "5512345678")

  expect(container.querySelector("[data-testid='canonical-phone']")?.textContent).toBe("+525512345678")
  expect(container.querySelector("[data-country-trigger]")?.textContent).toContain("Mexico")
  expect(container.querySelector("[aria-label='Phone keypad']")).toBeNull()
})
