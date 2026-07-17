import { describe, expect, it } from "vitest"

import { buildHistoryClassOptions } from "@/app/api/staff/payments/payments-loader-purchase"

describe("buildHistoryClassOptions", () => {
  it("returns deduped class options for real course slugs", () => {
    const options = buildHistoryClassOptions([
      { purchase: { courseSlug: "yoga-101", courseTitle: "Yoga 101" } },
      { purchase: { courseSlug: "yoga-101", courseTitle: "Yoga 101" } },
      { purchase: { courseSlug: "pilates-201", courseTitle: "Pilates 201" } },
    ])

    expect(options).toEqual([
      { slug: "yoga-101", title: "Yoga 101" },
      { slug: "pilates-201", title: "Pilates 201" },
    ])
  })

  it("excludes sentinel non-class slugs like _staff_package_grant and _staff_registration", () => {
    const options = buildHistoryClassOptions([
      { purchase: { courseSlug: "_staff_package_grant", courseTitle: null } },
      { purchase: { courseSlug: "_staff_registration", courseTitle: null } },
      { purchase: { courseSlug: "yoga-101", courseTitle: "Yoga 101" } },
    ])

    expect(options).toEqual([{ slug: "yoga-101", title: "Yoga 101" }])
    expect(options.some((option) => option.slug?.startsWith("_"))).toBe(false)
  })

  it("excludes null/empty courseSlug entries", () => {
    const options = buildHistoryClassOptions([
      { purchase: { courseSlug: null, courseTitle: "No slug" } },
      { purchase: { courseSlug: "", courseTitle: "Empty slug" } },
    ])

    expect(options).toEqual([])
  })
})
