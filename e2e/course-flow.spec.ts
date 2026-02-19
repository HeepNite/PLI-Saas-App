import { test, expect } from "@playwright/test"

const slug = "salsa-femenina-matutina"
const COURSE_PAGE_TIMEOUT_MS = 90_000

test.describe.configure({ timeout: 90_000 })

test("course page renders", async ({ page }) => {
  await page.goto(`/cursos/${slug}?lang=en`, {
    waitUntil: "domcontentloaded",
    timeout: COURSE_PAGE_TIMEOUT_MS,
  })
  await expect(
    page.getByRole("heading", { name: "Salsa feminine style (morning)", exact: true })
  ).toBeVisible()
})

test("full enrollment opens Stripe modal", async ({ page }) => {
  await page.route("**/api/checkout/intent", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ clientSecret: "pi_test_secret" }),
    })
  })

  await page.goto(`/cursos/${slug}?enroll=1&lang=en`, {
    waitUntil: "domcontentloaded",
    timeout: COURSE_PAGE_TIMEOUT_MS,
  })
  const booking = page.getByRole("region", { name: /Booking for/i })
  await expect(booking).toBeVisible()
  await booking.scrollIntoViewIfNeeded()

  const clickButtonByName = async (pattern: RegExp, onlyEnabled = true) => {
    const buttons = booking.getByRole("button")
    const count = await buttons.count()
    for (let i = 0; i < count; i += 1) {
      const btn = buttons.nth(i)
      if (!(await btn.isVisible())) continue
      const text = (await btn.innerText()).replace(/\s+/g, " ").trim()
      if (!pattern.test(text)) continue
      if (onlyEnabled && !(await btn.isEnabled())) continue
      await btn.evaluate((el) => {
        el.scrollIntoView({ block: "center", inline: "center" })
        ;(el as HTMLButtonElement).click()
      })
      return true
    }
    return false
  }

  const clickContinue = async () => {
    const skipClicked = await clickButtonByName(/Skip packages and continue/i)
    if (skipClicked) return

    await expect
      .poll(async () => {
        const buttons = booking.locator('button[type="submit"]')
        const count = await buttons.count()
        for (let i = 0; i < count; i += 1) {
          const button = buttons.nth(i)
          if (!(await button.isVisible())) continue
          const text = (await button.innerText()).trim()
          if (!/Continue|Continuar/i.test(text)) continue
          return await button.isEnabled()
        }
        return false
      }, { timeout: 10_000 })
      .toBeTruthy()

    const clicked = await clickButtonByName(/Continue|Continuar/i)
    if (!clicked) {
      throw new Error("Could not find enabled Continue button")
    }
  }

  const ensureStepOneConfigured = async () => {
    const selects = booking.locator("select")
    const count = await selects.count()
    for (let i = 0; i < count; i += 1) {
      const select = selects.nth(i)
      if (!(await select.isVisible())) continue
      const values = await select.evaluate((el) =>
        Array.from(el.querySelectorAll("option"))
          .map((option) => option.getAttribute("value") || "")
          .filter((value) => value.trim().length > 0)
      )
      if (values.length > 0) {
        await select.selectOption(values[0])
      }
    }
  }

  const findEnabledButtonByText = async (pattern: RegExp) => {
    const buttons = booking.getByRole("button")
    const count = await buttons.count()
    for (let i = 0; i < count; i += 1) {
      const btn = buttons.nth(i)
      const text = (await btn.innerText()).replace(/\s+/g, " ").trim()
      if (!pattern.test(text)) continue
      if (!(await btn.isEnabled())) continue
      return btn
    }
    return null
  }

  const pickFirstAvailableSlot = async () => {
    await expect
      .poll(async () => {
        const buttons = booking.getByRole("button")
        const count = await buttons.count()
        let enabledDayCount = 0
        for (let i = 0; i < count; i += 1) {
          const btn = buttons.nth(i)
          const text = (await btn.innerText()).trim()
          if (!/^\d{1,2}$/.test(text)) continue
          if (await btn.isEnabled()) enabledDayCount += 1
        }
        return enabledDayCount
      }, { timeout: 10_000 })
      .toBeGreaterThan(0)

    const buttons = booking.getByRole("button")
    const count = await buttons.count()
    for (let i = 0; i < count; i += 1) {
      const dayBtn = buttons.nth(i)
      const dayText = (await dayBtn.innerText()).trim()
      if (!/^\d{1,2}$/.test(dayText)) continue
      if (!(await dayBtn.isEnabled())) continue

      await dayBtn.scrollIntoViewIfNeeded()
      await dayBtn.evaluate((el: HTMLButtonElement) => el.click())
      await page.waitForTimeout(500)

      await expect
        .poll(async () => {
          const found = await findEnabledButtonByText(/\d{1,2}:\d{2}\s?(AM|PM)/i)
          return Boolean(found)
        }, { timeout: 4_000 })
        .toBeTruthy()

      const timeBtn = await findEnabledButtonByText(/\d{1,2}:\d{2}\s?(AM|PM)/i)
      if (!timeBtn) continue
      await timeBtn.scrollIntoViewIfNeeded()
      await timeBtn.evaluate((el: HTMLButtonElement) => el.click())
      return
    }

    throw new Error("No available slot found in booking calendar")
  }

  await ensureStepOneConfigured()
  await clickContinue() // Step 1 -> Step 2
  await clickButtonByName(/Date & Time/i, false)
  await pickFirstAvailableSlot()
  await clickContinue() // Step 2 -> Step 3

  await expect(booking.getByRole("heading", { name: /Your Information|Tu información/i })).toBeVisible({
    timeout: 15_000,
  })

  const firstName = booking.getByPlaceholder(/Enter first name|Tu nombre/i).first()
  if (await firstName.isVisible()) await firstName.fill("Test")
  const lastName = booking.getByPlaceholder(/Enter last name|Tu apellido/i).first()
  if (await lastName.isVisible()) await lastName.fill("User")
  const email = booking.getByPlaceholder(/Enter email|Tu email/i).first()
  const uniqueEmail = `e2e+${Date.now()}@example.com`
  if (await email.isVisible()) await email.fill(uniqueEmail)
  const phone = booking.locator('input[type="tel"]').first()
  if (await phone.isVisible()) await phone.fill("9293876584")

  await clickContinue() // Step 3 -> Step 4

  await expect(booking.getByRole("heading", { name: /Payments|Pagos/i })).toBeVisible({ timeout: 15_000 })
  const stripeBtn = booking.getByRole("button", { name: /Stripe/i })
  await expect(stripeBtn).toBeVisible({ timeout: 15_000 })
  await stripeBtn.evaluate((el: HTMLButtonElement) => {
    el.scrollIntoView({ block: "center", inline: "center" })
    el.click()
  })
  await clickContinue() // Step 4 -> Step 5

  const confirmEn = booking.getByRole("button", { name: "Confirm", exact: true })
  if (await confirmEn.isVisible()) {
    await confirmEn.scrollIntoViewIfNeeded()
    await confirmEn.evaluate((el: HTMLButtonElement) => el.click())
  } else {
    const confirmEs = booking.getByRole("button", { name: "Confirmar", exact: true })
    await confirmEs.scrollIntoViewIfNeeded()
    await confirmEs.evaluate((el: HTMLButtonElement) => el.click())
  }
  await expect(page.getByRole("button", { name: "Cerrar" })).toBeVisible()
})
