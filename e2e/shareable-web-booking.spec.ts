import { expect, test } from "@playwright/test"

const getNewYorkDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const getNextMonthKey = (dateKey: string) => {
  const [year, month] = dateKey.split("-").map(Number)
  const date = new Date(Date.UTC(year, month, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

const everyDayRules = (time: string) => ({
  rules: Array.from({ length: 7 }, (_, weekday) => ({ weekday, times: [time] })),
  recurrenceMode: "indefinite",
  recurrenceEndsAt: null,
})

const makeCourse = ({ slug, title, category, time }: { slug: string; title: string; category: string; time: string }) => ({
  slug,
  title,
  category,
  description: "Public booking class",
  level: "Beginner",
  duration: "60 min",
  schedule: {
    day: "Daily",
    time,
    starts: "Ongoing",
    availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
    availableTimes: [time],
  },
  location: { address: "PLI" },
  instructors: [{ name: "PLI Team" }],
  heroMedia: { image: "/images/carousel/_DSC1076.JPG" },
  enrollment: { services: [], packages: [] },
  scheduleRules: everyDayRules(time),
})

test.beforeEach(async ({ page }) => {
  await page.route("**/api/catalog/courses", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        courses: [
          makeCourse({ slug: "salsa-timba", title: "Salsa Timba", category: "Salsa", time: "17:00" }),
          makeCourse({ slug: "bachata", title: "Beginner Bachata", category: "Bachata", time: "18:00" }),
          makeCourse({ slug: "mambo-on2", title: "Mambo On2", category: "On2", time: "19:00" }),
        ],
      }),
    })
  })
})

test("filters the 90-day schedule and hands a future class to QR booking", async ({ page }) => {
  const campaignNow = new Date("2026-10-15T16:00:00.000Z")
  await page.clock.setFixedTime(campaignNow)
  const currentDate = getNewYorkDateKey(campaignNow)
  const nextMonth = getNextMonthKey(currentDate)
  await page.goto("/booking", { waitUntil: "domcontentloaded" })

  await expect(page.getByRole("img", { name: "Palladium Latin Art" })).toBeVisible()
  await expect(page.locator("header").getByText("BOOK", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Upcoming classes" })).toBeVisible()
  await expect(page.getByRole("button", { name: /Home|Back to top/ })).toHaveCount(0)
  await expect(page.locator('a[href="/chat"]')).toHaveCount(0)

  const search = page.getByRole("searchbox", { name: "Search classes" })
  const monthFilter = page.getByRole("combobox", { name: "Filter by month" })
  const typeFilter = page.getByRole("combobox", { name: "Filter by class type" })
  await expect(monthFilter).toHaveValue(currentDate.slice(0, 7))
  await expect(typeFilter).toHaveValue("all")

  await search.fill("Mambo On2")
  await expect(page.locator("article").first()).toContainText("Mambo On2")
  await expect(page.getByText("Salsa Timba")).toHaveCount(0)
  await search.clear()

  await typeFilter.selectOption("bachata")
  await expect(page.locator("article").first()).toContainText("Beginner Bachata")
  await expect(page.getByText("Salsa Timba")).toHaveCount(0)

  await monthFilter.selectOption(nextMonth)
  const nextMonthCards = page.locator("article")
  await expect(nextMonthCards.first()).toContainText("Beginner Bachata")

  await nextMonthCards.first().getByRole("button", { name: /Book Beginner Bachata/ }).click()
  await expect(page.getByRole("dialog", { name: /Which country do you represent/ })).toBeVisible()
  await page.getByRole("searchbox", { name: "Search countries" }).fill("Mexico")
  await page.getByRole("option", { name: /Mexico/ }).click()
  await page.getByRole("button", { name: "CONTINUE TO BOOK" }).click()
  await expect(page).toHaveURL(new RegExp(`/courses/bachata\\?enroll=1&qrBooking=1&date=${nextMonth}-\\d{2}&time=18%3A00&durationMinutes=60&bookingSource=public_booking&heritagePinCountryCode=MX`))
})
