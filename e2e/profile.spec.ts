import { test, expect } from "@playwright/test"

const setupProfileApiMocks = async (page: import("@playwright/test").Page) => {
  let bookingStartsAt = "2027-02-19T15:00:00.000Z"
  const capturedRequests: Array<Record<string, unknown>> = []
  let actionRequests: Array<Record<string, unknown>> = []

  const profilePayload = {
    user: {
      firstName: "Test",
      lastName: "Student",
      email: "test.student@example.com",
      phone: "+16462296664",
      status: "ACTIVE",
    },
    profile: {
      firstName: "Test",
      lastName: "Student",
      birthDate: "1995-06-10",
      emergencyContactName: "Contact Test",
      emergencyContactRelation: "Friend",
      emergencyContactPhone: "+16462291111",
      billingAddress: {
        line1: "54 Coles St",
        city: "Jersey City",
        state: "NJ",
        postalCode: "07302",
        country: "US",
      },
    },
    profileComplete: true,
    pointsBalance: 50,
  }

  const packagesPayload = {
    packages: [
      {
        id: "pkgpur-1",
        packageId: "morning-3-week",
        label: "Morning 3-week pack",
        courseSlug: "salsa-femenina-matutina",
        status: "active",
        isUnlimited: false,
        totalCredits: 10,
        remainingCredits: 8,
        purchasedAt: "2026-02-01T15:00:00.000Z",
        expiresAt: "2026-08-14T04:00:00.000Z",
        source: "stripe",
      },
    ],
    summary: {
      activePackages: 1,
      unlimitedPackages: 0,
      totalRemainingCredits: 8,
      nextExpiration: "2026-08-14T04:00:00.000Z",
    },
  }

  const activityPayload = {
    stats: {
      classesTaken: 12,
      weeklyAverage: 3,
      streakWeeks: 4,
      recurringLabel: "Martes 7:00 PM",
      lastClassLabel: "Martes 11:00 AM",
    },
    monthlyAttendance: [
      { label: "Oct", value: 4 },
      { label: "Nov", value: 5 },
      { label: "Dic", value: 6 },
      { label: "Ene", value: 4 },
    ],
  }

  await page.route(/\/api\/profile(?:\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(profilePayload) })
  })

  await page.route(/\/api\/profile\/packages(?:\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(packagesPayload) })
  })

  await page.route(/\/api\/profile\/activity(?:\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(activityPayload) })
  })

  await page.route(/\/api\/profile\/points(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ balance: 50, entries: [] }),
    })
  })

  await page.route(/\/api\/profile\/bookings(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        bookings: [
          {
            id: "attendance-1",
            status: "scheduled",
            startsAt: bookingStartsAt,
            courseSlug: "salsa-femenina-matutina",
            courseTitle: "Salsa feminine style (morning)",
            sessionId: "session-1",
            packagePurchaseId: "pkgpur-1",
            packageLabel: "Morning 3-week pack",
          },
        ],
        packages: [
          {
            id: "pkgpur-1",
            packageId: "morning-3-week",
            label: "Morning 3-week pack",
            courseSlug: "salsa-femenina-matutina",
            remainingCredits: 8,
            totalCredits: 10,
            isUnlimited: false,
            expiresAt: "2026-08-14T04:00:00.000Z",
          },
        ],
      }),
    })
  })

  await page.route(/\/api\/profile\/bookings\/availability(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        slots: [
          { time: "10:00", label: "10:00 AM", isFull: false, spotsLeft: 12, capacity: 12, isPast: false },
          { time: "11:00", label: "11:00 AM", isFull: false, spotsLeft: 11, capacity: 12, isPast: false },
        ],
      }),
    })
  })

  await page.route(/\/api\/profile\/bookings\/reschedule(?:\?.*)?$/, async (route) => {
    const body = JSON.parse(route.request().postData() || "{}")
    capturedRequests.push(body)
    bookingStartsAt = "2027-02-19T16:00:00.000Z"
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) })
  })

  await page.route(/\/api\/profile\/requests(?:\?.*)?$/, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ requests: actionRequests }),
      })
      return
    }

    const body = JSON.parse(route.request().postData() || "{}") as Record<string, unknown>
    capturedRequests.push(body)

    if (body.type === "CANCEL") {
      actionRequests = [
        {
          id: "request-cancel-1",
          type: "CANCEL",
          status: "PENDING",
          message: body.message || "",
          meta: {
            attendanceId: "attendance-1",
            effectiveDate: "2026-02-19",
            refundRequested: true,
          },
          createdAt: "2026-02-18T15:00:00.000Z",
          resolvedAt: null,
        },
      ]
    }

    if (body.type === "SUSPEND") {
      actionRequests = [
        {
          id: "request-suspend-1",
          type: "SUSPEND",
          status: "PENDING",
          message: body.message || "",
          meta: {
            packagePurchaseId: "pkgpur-1",
            packageLabel: "Morning 3-week pack",
            startDate: "2026-02-19",
            endDate: "2026-03-05",
          },
          createdAt: "2026-02-18T15:00:00.000Z",
          resolvedAt: null,
        },
      ]
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) })
  })

  return {
    getCapturedRequests: () => capturedRequests,
  }
}

test("profile page renders", async ({ page }) => {
  await page.goto("/client-profile?lang=es&e2eAuth=1")
  await expect(
    page.getByRole("heading", { name: "Completa tu perfil y gana puntos", exact: true })
  ).toBeVisible()
})

test("profile form can be closed and reopened", async ({ page }) => {
  await page.goto("/client-profile?lang=es&e2eAuth=1")

  const closeBtn = page.getByRole("button", { name: "Cerrar" })
  await expect(closeBtn).toBeVisible()
  await closeBtn.click()

  await expect(
    page.getByRole("heading", { name: "Completa tu perfil y gana puntos", exact: true })
  ).toBeHidden()

  await page.getByRole("button", { name: "Editar perfil" }).click()
  await expect(
    page.getByRole("heading", { name: "Completa tu perfil y gana puntos", exact: true })
  ).toBeVisible()
})

test("profile booking opens course picker", async ({ page }) => {
  await page.goto("/client-profile?lang=es&e2eAuth=1")
  await page.getByRole("button", { name: "Reservar", exact: true }).click()
  await expect(page.getByText("Elegí la clase que querés reservar")).toBeVisible()
})

test("avatar overlay appears on hover", async ({ page }) => {
  await page.goto("/client-profile?lang=es&e2eAuth=1")

  const trigger = page.getByTestId("avatar-upload-trigger")
  const overlay = page.getByTestId("avatar-edit-overlay")

  await expect(trigger).toBeVisible()
  await expect(overlay).toHaveCSS("opacity", "0")

  await trigger.hover()
  await expect.poll(async () => overlay.evaluate((el) => getComputedStyle(el).opacity)).toBe("1")
})

test("cancel action shows missing bookings message", async ({ page }) => {
  await page.goto("/client-profile?lang=es&e2eAuth=1")

  await page.getByRole("button", { name: "Cancelar clase", exact: true }).click()
  await expect(page.getByText("No tenés clases asignadas disponibles para cancelar.")).toBeVisible()
})

test("suspend action shows missing packages message", async ({ page }) => {
  await page.goto("/client-profile?lang=es&e2eAuth=1")

  const suspendBtn = page.getByRole("button", { name: "Suspender paquete", exact: true }).first()
  await suspendBtn.scrollIntoViewIfNeeded()
  await suspendBtn.evaluate((el) => {
    ;(el as HTMLButtonElement).click()
  })
  await expect(page.getByText("No tenés paquetes activos para suspender.")).toBeVisible()
})

test("reschedule flow submits booking change", async ({ page }) => {
  const api = await setupProfileApiMocks(page)
  await page.goto("/client-profile?lang=es&e2eAuth=1")

  await page.getByRole("button", { name: "Cambiar", exact: true }).click()
  const modal = page.locator("div[data-lenis-prevent]").filter({ hasText: "Reprogramación por pasos" }).first()
  await expect(modal.getByRole("heading", { name: "Reprogramación por pasos", exact: true })).toBeVisible()

  const modalButtons = modal.getByRole("button")
  const modalButtonCount = await modalButtons.count()
  let pickedDay = false
  for (let i = 0; i < modalButtonCount; i += 1) {
    const button = modalButtons.nth(i)
    const text = (await button.innerText()).trim()
    if (!/^\d{1,2}$/.test(text)) continue
    if (!(await button.isEnabled())) continue
    await button.click()
    pickedDay = true
    break
  }

  const preferredTime = modal.getByRole("button", { name: /11:00 AM|11:00\s?a\.?\s?m\.?/i })
  if ((await preferredTime.count()) > 0 && (await preferredTime.first().isEnabled())) {
    await preferredTime.first().click()
  } else {
    let pickedTime = false
    for (let i = 0; i < modalButtonCount; i += 1) {
      const button = modalButtons.nth(i)
      const text = (await button.innerText()).trim()
      if (!/\d{1,2}:\d{2}\s?(AM|PM)/i.test(text)) continue
      if (!(await button.isEnabled())) continue
      await button.click()
      pickedTime = true
      break
    }
    expect(pickedTime).toBeTruthy()
  }

  await modal.getByRole("button", { name: "Continuar", exact: true }).click()
  await modal.getByRole("button", { name: "Confirmar clase principal", exact: true }).click()

  await expect(page.getByText("Clase reprogramada correctamente.")).toBeVisible()

  const rescheduleRequest = api.getCapturedRequests().find((request) => "attendanceId" in request)
  expect(rescheduleRequest).toBeTruthy()
  expect(rescheduleRequest).toMatchObject({ attendanceId: "attendance-1" })
  expect((rescheduleRequest as Record<string, unknown>).date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(["10:00", "11:00"]).toContain((rescheduleRequest as Record<string, unknown>).time as string)
})

test("cancel with refund creates pending process state", async ({ page }) => {
  const api = await setupProfileApiMocks(page)
  await page.goto("/client-profile?lang=es&e2eAuth=1")

  await expect(page.getByText("Salsa feminine style (morning)").first()).toBeVisible()
  await page.getByRole("button", { name: "Cancelar clase", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Cancelar clase", exact: true })).toBeVisible()

  await page.getByRole("button", { name: "No, reembolso", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()

  await expect(page.getByText("Procesos sobre clases asignadas")).toBeVisible()
  await expect(page.getByText(/Cancelación \(pendiente\)/).first()).toBeVisible()

  const cancelRequest = api.getCapturedRequests().find((request) => request.type === "CANCEL")
  expect(cancelRequest).toBeTruthy()
  expect(cancelRequest).toMatchObject({
    type: "CANCEL",
    meta: {
      attendanceId: "attendance-1",
      refundRequested: true,
    },
  })
})

test("suspend package request appears in recent requests", async ({ page }) => {
  const api = await setupProfileApiMocks(page)
  await page.goto("/client-profile?lang=es&e2eAuth=1")

  const suspendBtn = page.getByRole("button", { name: "Suspender paquete", exact: true }).first()
  await suspendBtn.scrollIntoViewIfNeeded()
  await suspendBtn.evaluate((el) => {
    ;(el as HTMLButtonElement).click()
  })
  await expect(page.getByRole("heading", { name: "Suspender paquete", exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page.getByText("Solicitud de suspensión enviada.")).toBeVisible()

  const suspendRequest = api.getCapturedRequests().find((request) => request.type === "SUSPEND")
  expect(suspendRequest).toBeTruthy()
  expect(suspendRequest).toMatchObject({
    type: "SUSPEND",
    meta: {
      packagePurchaseId: "pkgpur-1",
    },
  })
})
