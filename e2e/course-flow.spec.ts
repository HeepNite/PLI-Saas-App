import { test, expect } from "@playwright/test"

const missingSlug = "salsa-femenina-matutina"
const COURSE_PAGE_TIMEOUT_MS = 90_000

test.describe.configure({ timeout: 90_000 })

test("missing course page renders fallback", async ({ page }) => {
  await page.goto(`/courses/${missingSlug}?lang=en`, {
    waitUntil: "domcontentloaded",
    timeout: COURSE_PAGE_TIMEOUT_MS,
  })
  await expect(page.getByRole("heading", { name: "Course not found", exact: true })).toBeVisible()
  await expect(page.getByText("Check the link or return to the catalog.")).toBeVisible()
})

test("missing course page does not render booking form", async ({ page }) => {
  await page.route("**/api/checkout/intent", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ clientSecret: "pi_test_secret" }),
    })
  })

  await page.goto(`/courses/${missingSlug}?enroll=1&step=0&lang=en`, {
    waitUntil: "domcontentloaded",
    timeout: COURSE_PAGE_TIMEOUT_MS,
  })
  await expect(page.getByRole("heading", { name: "Course not found", exact: true })).toBeVisible()
  await expect(page.getByRole("region", { name: /Booking for/i })).toHaveCount(0)
  await expect(page.locator("#booking-service")).toHaveCount(0)
})
