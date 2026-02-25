import { expect, test } from "@playwright/test"

const STAFF_CHECKIN_URL = "/staff/checkin"

const enterPin = async (page: import("@playwright/test").Page, pin: string) => {
  await page.waitForTimeout(150)
  for (const digit of pin.split("")) {
    const digitButton = page.getByRole("button", { name: digit, exact: true }).first()
    await digitButton.scrollIntoViewIfNeeded()
    await digitButton.evaluate((el) => {
      ;(el as HTMLButtonElement).click()
    })
  }
}

test("staff checkin terminal renders keypad and submit state", async ({ page }) => {
  await page.goto(STAFF_CHECKIN_URL, { waitUntil: "domcontentloaded" })

  await expect(page.getByRole("heading", { name: "Ingreso por PIN", exact: true })).toBeVisible()
  const submit = page.getByRole("button", { name: "Marcar entrada", exact: true })
  await expect(submit).toBeDisabled()

  await enterPin(page, "1234")
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

  await page.goto(STAFF_CHECKIN_URL, { waitUntil: "domcontentloaded" })
  await enterPin(page, "1234")
  const submit = page.getByRole("button", { name: "Marcar entrada", exact: true })
  await expect(submit).toBeEnabled({ timeout: 10_000 })
  await submit.click()

  await expect(page.getByText(/Invalid PIN|PIN inválido/i)).toBeVisible({ timeout: 15_000 })
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

  await page.goto(STAFF_CHECKIN_URL, { waitUntil: "domcontentloaded" })
  await enterPin(page, "1234")
  const submit = page.getByRole("button", { name: "Marcar entrada", exact: true })
  await expect(submit).toBeEnabled({ timeout: 10_000 })
  await submit.click()

  await page.waitForURL(/\/staff\/checkin\?e2eSuccess=1/, { timeout: 15_000 })
})
