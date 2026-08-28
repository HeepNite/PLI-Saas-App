// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import InternationalPhoneField, {
  createInternationalPhoneFieldValue,
  type InternationalPhoneFieldValue,
} from "@/components/front/checkin/InternationalPhoneField"
import * as phoneDomain from "@/lib/phone"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type RenderedField = { container: HTMLDivElement; root: Root; onChange: ReturnType<typeof vi.fn> }

const setInput = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}

const renderField = async (prefill = "", busy = false): Promise<RenderedField> => {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const onChange = vi.fn()

  function Harness() {
    const [value, setValue] = React.useState<InternationalPhoneFieldValue>(() =>
      createInternationalPhoneFieldValue(prefill),
    )
    return <InternationalPhoneField value={value} busy={busy} onChange={(next) => {
      onChange(next)
      setValue(next)
    }} />
  }

  await act(async () => root.render(<Harness />))
  return { container, root, onChange }
}

const openCountries = async (container: HTMLElement) => {
  const trigger = container.querySelector("[data-country-trigger]") as HTMLButtonElement
  await act(async () => trigger.click())
  return {
    trigger,
    search: container.querySelector('input[role="combobox"]') as HTMLInputElement,
  }
}

const findOption = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]'))
    .find((option) => option.textContent?.includes(text)) as HTMLButtonElement

const expectCountryLabel = (trigger: HTMLButtonElement) => {
  const [labelId] = trigger.getAttribute("aria-labelledby")?.split(" ") || []
  expect(document.getElementById(labelId)?.textContent).toBe("Country")
  return labelId
}

afterEach(() => {
  document.body.innerHTML = ""
  vi.restoreAllMocks()
})

describe("InternationalPhoneField", () => {
  it("defaults only an empty value to US and resolves canonical prefills", async () => {
    const empty = await renderField()
    const emptyCountry = empty.container.querySelector("[data-country-trigger]") as HTMLButtonElement
    expect(emptyCountry.textContent).toContain("United States")
    const countryLabelId = expectCountryLabel(emptyCountry)
    expect(empty.container.querySelector('label[for="international-phone-number"]')).not.toBeNull()
    await act(async () => empty.root.unmount())

    const mexico = await renderField("+525512345678")
    const mexicoCountry = mexico.container.querySelector("[data-country-trigger]") as HTMLButtonElement
    expect(mexicoCountry.textContent).toContain("Mexico")
    expect(expectCountryLabel(mexicoCountry)).toBe(countryLabelId)
    expect((mexico.container.querySelector("#international-phone-number") as HTMLInputElement).value).toBe("55 1234 5678")
    await act(async () => mexico.root.unmount())

    const unresolved = await renderField("+12005550123")
    expect(unresolved.container.querySelector("[data-country-trigger]")?.textContent).toContain("Select country")
    expect(unresolved.container.textContent).toContain("Select a country and re-enter the phone number.")
    expect(unresolved.container.querySelector("#international-phone-number")?.getAttribute("aria-invalid")).toBe("true")
    await act(async () => unresolved.root.unmount())
  })

  it("searches by name, ISO, and calling code with an unchanged no-results state", async () => {
    const view = await renderField()
    const { trigger, search } = await openCountries(view.container)
    expect(document.activeElement).toBe(search)

    await setInput(search, "méxico")
    expect(view.container.querySelector('[role="option"]')?.textContent).toContain("Mexico MX +52")
    await setInput(search, "AR")
    expect(findOption(view.container, "Argentina AR +54")).toBeTruthy()
    await setInput(search, "+54")
    expect(view.container.querySelector('[role="option"]')?.textContent).toContain("Argentina")
    await setInput(search, "not-a-country")
    expect(view.container.textContent).toContain("No countries match your search.")
    expect(trigger.textContent).toContain("United States")
    await setInput(search, "+54")
    await act(async () => search.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
    expect(trigger.textContent).toContain("Argentina")
    expect(document.activeElement).toBe(trigger)
    await act(async () => view.root.unmount())
  })

  it("keeps an explicit shared-code country and preserves digits across country changes", async () => {
    const view = await renderField()
    let picker = await openCountries(view.container)
    await setInput(picker.search, "CA")
    await act(async () => findOption(view.container, "Canada CA +1").click())
    const number = view.container.querySelector("#international-phone-number") as HTMLInputElement
    await setInput(number, "4165550123")
    expect(view.onChange.mock.lastCall?.[0]).toMatchObject({ country: "CA", canonicalPhone: "+14165550123" })

    picker = await openCountries(view.container)
    await setInput(picker.search, "MX")
    await act(async () => findOption(view.container, "Mexico MX +52").click())
    expect(number.value.replace(/\D/g, "")).toBe("4165550123")
    expect(view.onChange.mock.lastCall?.[0]).toMatchObject({ country: "MX", canonicalPhone: null })
    await act(async () => view.root.unmount())
  })

  it("handles canonical paste, keypad digits beyond ten, backspace, clear, and parser failure", async () => {
    const view = await renderField()
    const number = view.container.querySelector("#international-phone-number") as HTMLInputElement
    await setInput(number, "+525512345678")
    expect(view.onChange.mock.lastCall?.[0]).toMatchObject({ country: "MX", canonicalPhone: "+525512345678" })
    await setInput(number, "Call me at +52 55 1234 5678")
    expect(number.value).toBe("Call me at +52 55 1234 5678")
    expect(view.onChange.mock.lastCall?.[0]).toMatchObject({ canonicalPhone: null, validation: "invalid" })

    const buttons = () => Array.from(view.container.querySelectorAll("button")) as HTMLButtonElement[]
    await act(async () => buttons().find((button) => button.textContent === "Clear")?.click())
    for (const digit of "91123456789") {
      await act(async () => buttons().find((button) => button.textContent === digit)?.click())
    }
    expect(number.value.replace(/\D/g, "")).toBe("91123456789")
    expect(view.onChange.mock.lastCall?.[0]).toMatchObject({ canonicalPhone: null })
    await act(async () => buttons().find((button) => button.getAttribute("aria-label") === "Delete last digit")?.click())
    expect(number.value.replace(/\D/g, "")).toBe("9112345678")
    await act(async () => buttons().find((button) => button.textContent === "Clear")?.click())
    expect(number.value).toBe("")

    vi.spyOn(phoneDomain, "parseNationalPhone").mockImplementation(() => { throw new Error("metadata unavailable") })
    await setInput(number, "2025550123")
    expect(view.container.textContent).toContain("Phone validation is temporarily unavailable. Try again.")
    expect(view.onChange.mock.lastCall?.[0]).toMatchObject({ canonicalPhone: null, validation: "error" })
    await act(async () => view.root.unmount())
  })

  it("blocks country changes while busy and exposes tablet-safe targets", async () => {
    const view = await renderField("+12025550123", true)
    const trigger = view.container.querySelector("[data-country-trigger]") as HTMLButtonElement
    trigger.click()
    trigger.click()
    expect(trigger.disabled).toBe(true)
    expect(view.container.querySelector('[role="listbox"]')).toBeNull()
    expect((view.container.querySelector("#international-phone-number") as HTMLInputElement).value).toBe("(202) 555-0123")
    expect(view.onChange).not.toHaveBeenCalled()
    expect(trigger.className).toContain("min-h-11")
    expect(trigger.parentElement?.className).toContain("gap-2")
    await act(async () => view.root.unmount())
  })
})
