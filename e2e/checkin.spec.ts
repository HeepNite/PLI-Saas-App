import { expect, test } from "@playwright/test"

const CHECKIN_URL =
  "/checkin?courseSlug=salsa-femenina-matutina&date=2026-02-26&time=11:00&durationMinutes=60"

test("checkin page renders qr block and entry options", async ({ page }) => {
  await page.goto(CHECKIN_URL, { waitUntil: "domcontentloaded" })

  await expect(page.getByRole("heading", { name: "Ingreso de alumnos", exact: true })).toBeVisible()
  await expect(page.getByText(/Código QR/i)).toBeVisible()
  await expect(page.getByRole("button", { name: /Ya soy cliente/i }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: /Soy nuevo/i }).first()).toBeVisible()
  await expect(page.getByText("o completa el proceso desde aqui mismo")).toBeVisible()
  await expect(page.getByRole("button", { name: "Abrir login", exact: true })).toHaveCount(0)
})

test("existing customer entry activates existing flow", async ({ page }) => {
  await page.goto(CHECKIN_URL, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(250)
  const existingButton = page.getByRole("button", { name: /Ya soy cliente/i }).first()
  await existingButton.scrollIntoViewIfNeeded()
  await existingButton.evaluate((el) => {
    ;(el as HTMLButtonElement).click()
  })

  await expect
    .poll(async () => {
      const breadcrumbCount = await page.getByRole("navigation", { name: "Breadcrumb" }).getByText("Ya soy cliente").count()
      const loginPopupCount = await page.getByText(/Ingresa con tu cuenta|Login rápido/i).count()
      const signedFlowCount = await page.getByText(/Sesión activa para flujo rápido/i).count()
      return breadcrumbCount + loginPopupCount + signedFlowCount
    }, { timeout: 15_000 })
    .toBeGreaterThan(0)
})

test("new customer opens booking modal from checkin", async ({ page }) => {
  await page.goto(CHECKIN_URL, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(250)
  const newButton = page.getByRole("button", { name: /Soy nuevo/i }).first()
  await newButton.scrollIntoViewIfNeeded()
  await newButton.evaluate((el) => {
    ;(el as HTMLButtonElement).click()
  })

  await expect(page.getByText("Booking").first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Date & Time|Fecha y hora/i).first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole("button", { name: /Continue|Continuar/i }).first()).toBeVisible({
    timeout: 15_000,
  })
})
