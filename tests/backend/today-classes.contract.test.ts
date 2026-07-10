import { describe, expect, it } from "vitest"
import { TodayClassesController } from "@/apps/backend/src/checkin/today-classes.controller"
import { TodayClassesService } from "@/apps/backend/src/checkin/today-classes.service"
import { createBackendRequestHandler } from "@/apps/backend/src/main"
import { INTERNAL_AUTH_HEADER } from "@/lib/nest-gateway/auth"

const createCourse = (overrides: Partial<Record<string, unknown>> = {}) => ({
  slug: "bachata-nocturna",
  title: "Bachata Nocturna",
  category: "bachata",
  level: "intermediate",
  durationMinutes: 90,
  availableWeekdays: [2, 4],
  availableTimes: ["20:00", "21:00"],
  scheduleRules: null,
  dropInPriceCents: 2500,
  firstClassPriceCents: 1200,
  coverImageUrl: "https://example.com/bachata.jpg",
  ...overrides,
})

describe("backend today-classes contract", () => {
  it("builds the public today-classes response from active course data", async () => {
    const service = new TodayClassesService(async () => [createCourse()])

    await expect(service.getTodayClasses(new Date("2026-03-24T16:00:00.000Z"))).resolves.toEqual({
      date: "2026-03-24",
      weekday: 1,
      dayLabel: "Tue",
      classes: [
        {
          slug: "bachata-nocturna",
          title: "Bachata Nocturna",
          category: "bachata",
          level: "intermediate",
          durationMinutes: 90,
          availableTimes: ["20:00", "21:00"],
          dayLabel: "Tue",
          dropInPriceCents: 2500,
          firstClassPriceCents: 1200,
          coverImageUrl: "https://example.com/bachata.jpg",
        },
      ],
    })
  })

  it("serves GET /internal/checkin/today-classes through the backend request handler", async () => {
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    const controller = new TodayClassesController({
      getTodayClasses: async () => ({
        date: "2026-03-24",
        weekday: 1,
        dayLabel: "Tue",
        classes: [],
      }),
    })

    const handleRequest = createBackendRequestHandler({ todayClassesController: controller })
    const response = await handleRequest(
      new Request("http://backend.internal/internal/checkin/today-classes", {
        headers: { [INTERNAL_AUTH_HEADER]: "shared-secret" },
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      date: "2026-03-24",
      weekday: 1,
      dayLabel: "Tue",
      classes: [],
    })

    delete process.env.NEST_GATEWAY_SHARED_SECRET
  })

  it("rejects GET /internal/checkin/today-classes when the shared secret is missing", async () => {
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(new Request("http://backend.internal/internal/checkin/today-classes"))

    expect(response.status).toBe(401)

    delete process.env.NEST_GATEWAY_SHARED_SECRET
  })

  it("rejects GET /internal/checkin/today-classes when the shared secret is invalid", async () => {
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    const handleRequest = createBackendRequestHandler()
    const response = await handleRequest(
      new Request("http://backend.internal/internal/checkin/today-classes", {
        headers: { [INTERNAL_AUTH_HEADER]: "wrong-secret" },
      })
    )

    expect(response.status).toBe(401)

    delete process.env.NEST_GATEWAY_SHARED_SECRET
  })
})
