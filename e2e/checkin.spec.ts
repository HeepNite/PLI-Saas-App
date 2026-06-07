import { expect, test } from "@playwright/test"

const CHECKIN_URL =
  "/checkin?courseSlug=salsa-femenina-matutina&date=2026-02-26&time=11:00&durationMinutes=60&e2eAuth=1"

test("checkin page renders qr block and entry options", async ({ page }) => {
  await page.goto(CHECKIN_URL, { waitUntil: "domcontentloaded" })

  await expect(page.getByRole("heading", { name: "Student check-in", exact: true })).toBeVisible()
  await expect(page.getByText(/QR Code/i)).toBeVisible()
  await expect(page.getByRole("button", { name: /I am already a customer/i }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: /I am new/i }).first()).toBeVisible()
  await expect(page.getByText("Sign in and repurchase the current course.")).toBeVisible()
  await expect(page.getByText("Open regular purchase with account creation included.")).toBeVisible()
  await expect(page.getByRole("button", { name: /Open login/i })).toHaveCount(0)
})

test("existing customer entry activates existing flow", async ({ page }) => {
  await page.goto(CHECKIN_URL, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(250)
  const existingButton = page.getByRole("button", { name: /I am already a customer/i }).first()
  await existingButton.scrollIntoViewIfNeeded()
  await existingButton.evaluate((el) => {
    ;(el as HTMLButtonElement).click()
  })

  await expect
    .poll(async () => {
      const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" })
      const existingCount = await breadcrumb.getByText("Existing customer").count()
      const signInCount = await breadcrumb.getByText("Sign in").count()
      return existingCount + signInCount
    }, { timeout: 15_000 })
    .toBe(2)
})

test("new customer entry activates new flow breadcrumb", async ({ page }) => {
  await page.goto(CHECKIN_URL, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(250)
  const newButton = page.getByRole("button", { name: /I am new/i }).first()
  await newButton.scrollIntoViewIfNeeded()
  await newButton.click({ force: true })

  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" })
  await expect(breadcrumb.getByText("I am new")).toBeVisible({ timeout: 15_000 })
  await expect(page.locator("#booking-service")).toHaveCount(0)
})

test("kiosk flow keeps entry cards visible after new customer selection", async ({ page }) => {
  await page.addInitScript({
    content: `
      (() => {
        const originalSetTimeout = window.setTimeout;
        window.setTimeout = function(handler, timeout, ...args) {
          const nextTimeout = timeout === 120000 ? 50 : timeout;
          return originalSetTimeout.call(window, handler, nextTimeout, ...args);
        };
      })();
    `,
  })

  await page.goto(CHECKIN_URL, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(250)

  const newButton = page.getByRole("button", { name: /I am new/i }).first()
  await newButton.scrollIntoViewIfNeeded()
  await newButton.click({ force: true })

  await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByText("I am new")).toBeVisible()
  await expect(page.locator("#booking-service")).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Student check-in", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: /I am new/i }).first()).toBeVisible()
})
