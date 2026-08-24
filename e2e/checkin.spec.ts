import { expect, test, type Page } from "@playwright/test"

const CHECKIN_URL =
  "/checkin?courseSlug=salsa-femenina-matutina&date=2026-02-26&time=11:00&durationMinutes=60&flowContext=kiosk_terminal&e2eAuth=1"
const CLERK_KEYLESS_COOKIE_PREFIX = "__clerk_keys_"
const NEW_ENTRY_NAME = /I am new|I(?:'|’)m new/i
const EXPECTED_CHECKIN_CONTEXT = {
  courseSlug: "salsa-femenina-matutina",
  date: "2026-02-26",
  time: "11:00",
  durationMinutes: "60",
  flowContext: "kiosk_terminal",
  e2eAuth: "1",
} as const
const EXPECTED_CHECKIN_URL_STATE = {
  pathname: "/checkin",
  params: Object.fromEntries(
    Object.entries(EXPECTED_CHECKIN_CONTEXT).map(([key, value]) => [key, [value]])
  ),
}

const getSemanticCheckInUrlState = async (page: Page) => {
  const url = new URL(page.url())
  const searchParams = new URLSearchParams(url.search)

  return {
    pathname: url.pathname,
    params: Object.fromEntries(
      Object.keys(EXPECTED_CHECKIN_CONTEXT).map((key) => [key, searchParams.getAll(key)])
    ),
  }
}

const expectSemanticCheckInUrl = async (page: Page) => {
  await expect.poll(() => getSemanticCheckInUrlState(page)).toEqual(EXPECTED_CHECKIN_URL_STATE)
}

const gotoQrCheckIn = async (page: Page) => {
  await page.goto("/", { waitUntil: "domcontentloaded" })

  await expect
    .poll(async () => {
      const cookies = await page.context().cookies()
      return cookies.some(({ name }) => name.startsWith(CLERK_KEYLESS_COOKIE_PREFIX))
    })
    .toBeTruthy()

  await page.goto(CHECKIN_URL, { waitUntil: "domcontentloaded" })
  await expectSemanticCheckInUrl(page)
}

test("checkin page renders qr block and entry options", async ({ page }) => {
  await gotoQrCheckIn(page)

  await expect(page.getByRole("heading", { name: "Student check-in", exact: true })).toBeVisible()
  await expect(page.getByText(/QR Code/i)).toBeVisible()
  await expect(page.getByRole("button", { name: /I am already a customer/i }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: NEW_ENTRY_NAME }).first()).toBeVisible()
  await expect(page.getByText("Sign in and repurchase the current course.")).toBeVisible()
  await expect(page.getByText("Open regular purchase with account creation included.")).toBeVisible()
  await expect(page.getByRole("button", { name: /Open login/i })).toHaveCount(0)
})

test("existing customer entry opens the auth path with QR context preserved", async ({ page }) => {
  await gotoQrCheckIn(page)

  await page.getByRole("button", { name: /I am already a customer/i }).first().click()

  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" })
  await expect(breadcrumb.getByText("Existing customer")).toBeVisible()
  await expect(breadcrumb.getByText("Sign in")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Sign in with your account", exact: true })).toBeVisible()
  await expectSemanticCheckInUrl(page)
})

test("new customer entry routes into the QR booking path", async ({ page }) => {
  await gotoQrCheckIn(page)
  await page.getByRole("button", { name: NEW_ENTRY_NAME }).first().click()

  await expectSemanticCheckInUrl(page)
  await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByText("Purchase")).toBeVisible()
})

test("new customer booking route preserves QR class context on the current page", async ({ page }) => {
  await gotoQrCheckIn(page)
  await page.getByRole("button", { name: NEW_ENTRY_NAME }).first().click()

  await expectSemanticCheckInUrl(page)
  await expect(page.getByRole("heading", { name: "Current course", exact: true })).toBeVisible()
})
