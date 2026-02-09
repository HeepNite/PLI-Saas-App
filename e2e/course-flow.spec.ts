import { test, expect } from "@playwright/test"

const slug = "salsa-femenina-matutina"

const getNextAllowedDate = () => {
  const allowed = new Set([1, 3, 4]) // Mon, Wed, Thu in JS getDay
  const d = new Date()
  for (let i = 0; i < 30; i += 1) {
    if (allowed.has(d.getDay())) break
    d.setDate(d.getDate() + 1)
  }
  return d.toISOString().slice(0, 10)
}

test("course page renders", async ({ page }) => {
  await page.goto(`/cursos/${slug}?lang=en`)
  await expect(
    page.getByRole("heading", { name: "Salsa feminine style (morning)", exact: true })
  ).toBeVisible()
})

test("full enrollment opens Stripe modal", async ({ page }) => {
  const date = getNextAllowedDate()
  const draftKey = `pli-enroll:${slug}`
  const draft = {
    service: "dropin",
    pkg: "",
    addons: [],
    participants: 1,
    date,
    time: "11:00",
    contact: {
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      phone: "+1 (646) 229-6664",
      note: "",
    },
    couponInput: "",
    appliedCoupon: null,
    paymentMethod: "",
    step: 0,
  }

  await page.addInitScript(({ key, value }) => {
    sessionStorage.setItem(key, JSON.stringify(value))
  }, { key: draftKey, value: draft })

  await page.route("**/api/checkout/intent", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ clientSecret: "pi_test_secret" }),
    })
  })

  await page.goto(`/cursos/${slug}?enroll=1&lang=en`)
  const booking = page.getByRole("region", { name: /Booking for/i })
  await expect(booking).toBeVisible()
  await booking.scrollIntoViewIfNeeded()

  const clickContinue = async () => {
    const skipPackages = page.getByRole("button", { name: /Skip packages and continue/i })
    if (await skipPackages.isVisible()) {
      await skipPackages.scrollIntoViewIfNeeded()
      await skipPackages.click()
      return
    }
    const submitBtn = booking.locator('button[type="submit"]', { hasText: /Continue|Continuar/i }).first()
    await submitBtn.scrollIntoViewIfNeeded()
    await submitBtn.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }))
    await submitBtn.evaluate((el: HTMLButtonElement) => el.click())
  }

  await clickContinue()
  await clickContinue()
  await clickContinue()

  const stripeBtn = booking.getByRole("button", { name: /Stripe/i })
  await stripeBtn.scrollIntoViewIfNeeded()
  await stripeBtn.evaluate((el: HTMLButtonElement) => el.click())
  await clickContinue()

  const intentWaiter = page.waitForResponse("**/api/checkout/intent")
  const confirmEn = page.getByRole("button", { name: "Confirm", exact: true })
  if (await confirmEn.isVisible()) {
    await confirmEn.click()
  } else {
    await page.getByRole("button", { name: "Confirmar", exact: true }).click()
  }

  await intentWaiter
  await expect(page.getByRole("button", { name: "Cerrar" })).toBeVisible()
})
