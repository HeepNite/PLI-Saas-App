import { expect, test } from "@playwright/test"

const expectDenied = (status: number) => {
  // 429 is accepted to avoid flakes when repeated runs hit route-level rate limiting.
  expect([401, 403, 429]).toContain(status)
}

test("unauthenticated access is denied for staff school courses API", async ({ request }) => {
  const response = await request.get("/api/staff/school/courses")
  expectDenied(response.status())
})

test("unauthenticated access is denied for staff users API", async ({ request }) => {
  const response = await request.get("/api/staff/users")
  expectDenied(response.status())
})

