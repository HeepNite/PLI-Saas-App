import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import EnrollSidebar from "@/components/front/courses/enroll/steps/EnrollSidebar"
import type { EnrollSidebarProps } from "@/components/front/courses/enroll/steps/EnrollSidebar"

const makeStepValidCtx = (): EnrollSidebarProps["stepValidCtx"] => ({
  steps: [
    { key: "party" },
    { key: "datetime" },
    { key: "info" },
  ],
  participants: 1,
  availableServices: [{ id: "dropin", label: "Drop-in", price: 20 }],
  service: "dropin",
  date: "2026-07-01",
  time: "19:00",
  consecutiveOfferLoading: false,
  contact: { firstName: "Jane", lastName: "Doe", email: "jane@example.com", phone: "+1 555 555 5555", note: "" },
  requiresPhotoStep: false,
  photoSaved: false,
  consecutiveChoiceMade: false,
  paymentMethod: "stripe",
})

const baseCourse = {
  title: "Salsa Nocturno",
  slug: "salsa-nocturno",
  enrollment: {
    services: [{ id: "dropin", label: "Drop-in" }],
    packages: [],
    addons: [],
  },
}

const baseSteps = [
  { key: "party" as const, label: "Party" },
  { key: "datetime" as const, label: "Date & Time" },
  { key: "info" as const, label: "Info" },
]

const baseProps: EnrollSidebarProps = {
  isInline: false,
  success: false,
  isQrMobileCompactFlow: false,
  isKioskTerminalFlow: false,
  activeStepKey: "party",
  step: 0,
  steps: baseSteps,
  course: baseCourse,
  service: "dropin",
  pkg: "",
  addons: [],
  participants: 1,
  contact: { firstName: "Jane", lastName: "Doe", email: "jane@example.com", phone: "+1 555 555 5555", note: "" },
  summaryDateTimeValue: "2026-07-01 7:00 PM",
  summaryGridClass: "grid gap-3 sm:grid-cols-2 sm:gap-4",
  total: 20,
  googleCalHref: "https://calendar.google.com",
  icsDataUri: "data:text/calendar;base64,abc",
  eventDates: false,
  courseSlug: "salsa-nocturno",
  date: "2026-07-01",
  time: "19:00",
  stepValidCtx: makeStepValidCtx(),
  onStepClick: () => {},
  t: (key: string) => key,
}

describe("EnrollSidebar — breadcrumb nav", () => {
  it("renders the active step with active styling in modal (non-inline) mode", () => {
    const html = renderToStaticMarkup(<EnrollSidebar {...baseProps} step={1} activeStepKey="datetime" />)
    expect(html).toContain("Date &amp; Time")
    expect(html).toContain("border-white/40 bg-white/10")
  })

  it("marks a completed valid step with green dot in modal mode", () => {
    const html = renderToStaticMarkup(<EnrollSidebar {...baseProps} step={2} activeStepKey="info" />)
    expect(html).toContain("bg-green-400")
  })

  it("renders inactive steps with dimmed styling in modal mode", () => {
    const html = renderToStaticMarkup(<EnrollSidebar {...baseProps} step={0} activeStepKey="party" />)
    expect(html).toContain("bg-white/30")
  })

  it("renders inline breadcrumb with progress bar", () => {
    const html = renderToStaticMarkup(<EnrollSidebar {...baseProps} isInline step={1} activeStepKey="datetime" />)
    expect(html).toContain("Breadcrumb")
    expect(html).toContain("border-[color:var(--brand)]")
  })

  it("renders active step with brand ring in inline mode", () => {
    const html = renderToStaticMarkup(<EnrollSidebar {...baseProps} isInline step={0} activeStepKey="party" />)
    expect(html).toContain("bg-[color:var(--brand)]/25")
  })

  it("marks a valid done step green in inline mode", () => {
    const html = renderToStaticMarkup(<EnrollSidebar {...baseProps} isInline step={2} activeStepKey="info" />)
    expect(html).toContain("bg-green-500/20")
  })
})

describe("EnrollSidebar — booking summary", () => {
  it("renders booking summary when not on payments step", () => {
    const html = renderToStaticMarkup(<EnrollSidebar {...baseProps} activeStepKey="party" />)
    expect(html).toContain("summary")
  })

  it("hides summary grid on payments step and shows calendar hint instead", () => {
    const html = renderToStaticMarkup(<EnrollSidebar {...baseProps} activeStepKey="payments" />)
    expect(html).toContain("add it to your calendar")
    expect(html).not.toContain("sm:grid-cols-2 sm:gap-4")
  })
})

describe("EnrollSidebar — success / calendar links", () => {
  it("renders calendar link buttons when success=true and eventDates=true", () => {
    const html = renderToStaticMarkup(
      <EnrollSidebar {...baseProps} success eventDates googleCalHref="https://calendar.google.com/event?abc" />
    )
    expect(html).toContain("Google")
    expect(html).toContain("Outlook")
    expect(html).toContain("Apple")
    expect(html).toContain("Yahoo")
    expect(html).toContain("https://calendar.google.com/event?abc")
  })

  it("renders fallback text when success=true but eventDates=false", () => {
    const html = renderToStaticMarkup(<EnrollSidebar {...baseProps} success eventDates={false} />)
    expect(html).toContain("calendarsHint")
  })
})
