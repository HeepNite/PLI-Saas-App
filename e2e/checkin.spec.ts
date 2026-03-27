import { expect, test } from "@playwright/test"

const CHECKIN_URL =
  "/checkin?courseSlug=salsa-femenina-matutina&date=2026-02-26&time=11:00&durationMinutes=60&e2eAuth=1"

test("checkin page renders qr block and entry options", async ({ page }) => {
  await page.goto(CHECKIN_URL, { waitUntil: "domcontentloaded" })

  await expect(page.getByRole("heading", { name: "Student check-in", exact: true })).toBeVisible()
  await expect(page.getByText(/QR Code/i)).toBeVisible()
  await expect(page.getByRole("button", { name: /I am already a customer/i }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: /I am new/i }).first()).toBeVisible()
  await expect(page.getByText("or complete the process right here")).toBeVisible()
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
      const breadcrumbCount = await page.getByRole("navigation", { name: "Breadcrumb" }).getByText("I am already a customer").count()
      const loginPopupCount = await page.getByText(/Sign in with your account/i).count()
      const signedFlowCount = await page.getByText(/Active session for fast flow/i).count()
      return breadcrumbCount + loginPopupCount + signedFlowCount
    }, { timeout: 15_000 })
    .toBeGreaterThan(0)
})

test("new customer opens booking modal from checkin", async ({ page }) => {
  await page.goto(CHECKIN_URL, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(250)
  const newButton = page.getByRole("button", { name: /I am new/i }).first()
  await newButton.scrollIntoViewIfNeeded()
  await newButton.click({ force: true })

  await expect(page.locator("#booking-service").first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole("button", { name: /Continue/i }).first()).toBeVisible({
    timeout: 15_000,
  })
})

test("kiosk flow returns to ready state after inactivity timeout", async ({ page }) => {
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

  const bookingService = page.locator("#booking-service").first()
  await expect(bookingService).toBeVisible({ timeout: 15_000 })

  await expect
    .poll(async () => await bookingService.count(), { timeout: 5_000 })
    .toBe(0)

  await expect(page.getByRole("heading", { name: "Student check-in", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: /I am new/i }).first()).toBeVisible()
})
