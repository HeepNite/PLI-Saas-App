import { expect, test } from "@playwright/test"

const STAFF_CHECKIN_URL = "/staff/checkin"

const enterPin = async (
  page: import("@playwright/test").Page,
  submit: import("@playwright/test").Locator,
  pin: string
) => {
  await page.waitForTimeout(150)
  await page.locator("body").click({ position: { x: 10, y: 10 } })
  const clear = page.getByRole("button", { name: "Clear", exact: true })
  const typeByKeyboard = async () => {
    await clear.click({ force: true })
    await page.keyboard.type(pin, { delay: 30 })
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await typeByKeyboard()
    if (!(await submit.isEnabled())) {
      await clear.click({ force: true })
      for (const digit of pin.split("")) {
        const digitButton = page.getByRole("button", { name: digit, exact: true }).first()
        await digitButton.click({ force: true })
      }
    }
    if (await submit.isEnabled()) return
    await page.waitForTimeout(120)
  }
  throw new Error("Unable to enter PIN in keypad.")
}

test("staff checkin terminal renders keypad and submit state", async ({ page }) => {
  await page.goto(STAFF_CHECKIN_URL, { waitUntil: "commit" })

  await expect(page.getByRole("heading", { name: "PIN check-in", exact: true })).toBeVisible()
  const submit = page.getByRole("button", { name: "Check in", exact: true })
  await expect(submit).toBeDisabled()

  await enterPin(page, submit, "1234")
  await expect(submit).toBeEnabled({ timeout: 10_000 })
})

test("staff checkin shows error for invalid pin response", async ({ page }) => {
  await page.route("**/api/staff/checkin/pin", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Invalid PIN." }),
    })
  })

  await page.goto(STAFF_CHECKIN_URL, { waitUntil: "commit" })
  const submit = page.getByRole("button", { name: "Check in", exact: true })
  await enterPin(page, submit, "1234")
  await expect(submit).toBeEnabled({ timeout: 10_000 })
  await submit.click()

  await expect(page.getByText(/Invalid PIN/i)).toBeVisible({ timeout: 15_000 })
  await expect(page).toHaveURL(/\/staff\/checkin/)
})

test("staff checkin redirects when pin is accepted", async ({ page }) => {
  await page.route("**/api/staff/checkin/pin", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        signInUrl: "/staff/checkin?e2eSuccess=1",
        checkedInAt: "2026-02-26T15:00:00.000Z",
        staff: {
          id: "staff_1",
          name: "Test Staff",
          role: "staff",
          category: "front_desk",
        },
      }),
    })
  })

  await page.goto(STAFF_CHECKIN_URL, { waitUntil: "commit" })
  const submit = page.getByRole("button", { name: "Check in", exact: true })
  await enterPin(page, submit, "1234")
  await expect(submit).toBeEnabled({ timeout: 10_000 })
  await submit.click()

  await page.waitForURL(/\/staff\/checkin\?e2eSuccess=1/, { timeout: 15_000 })
})
