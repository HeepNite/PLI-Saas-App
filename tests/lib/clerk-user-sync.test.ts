import { beforeEach, describe, expect, it, vi } from "vitest"

const mockUpsertUserByIdentifiers = vi.fn()

vi.mock("@/lib/users", () => ({
  upsertUserByIdentifiers: (...args: unknown[]) => mockUpsertUserByIdentifiers(...args),
}))

import { syncDbUserFromClerkUser } from "@/lib/clerk-user-sync"

describe("syncDbUserFromClerkUser", () => {
  beforeEach(() => {
    mockUpsertUserByIdentifiers.mockReset()
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_1" })
  })

  it("maps webhook snake_case payload to canonical upsert input", async () => {
    await syncDbUserFromClerkUser({
      id: "clerk_snake_1",
      first_name: "Rai",
      last_name: "Mendez",
      email_addresses: [
        { id: "em_1", email_address: "fallback@example.com" },
        { id: "em_2", email_address: "primary@example.com" },
      ],
      primary_email_address_id: "em_2",
      phone_numbers: [
        { id: "ph_1", phone_number: "+5491100001111" },
        { id: "ph_2", phone_number: "+5491199992222" },
      ],
      primary_phone_number_id: "ph_2",
    })

    expect(mockUpsertUserByIdentifiers).toHaveBeenCalledWith({
      clerkId: "clerk_snake_1",
      email: "primary@example.com",
      name: "Rai Mendez",
      phone: "+5491199992222",
      nameIsCanonical: true,
    })
  })

  it("falls back to first available webhook email and phone when primary ids are missing", async () => {
    await syncDbUserFromClerkUser({
      id: "clerk_snake_2",
      full_name: "Fallback Name",
      email_addresses: [{ id: "em_1", email_address: "first@example.com" }],
      phone_numbers: [{ id: "ph_1", phone_number: "+5491133334444" }],
    })

    expect(mockUpsertUserByIdentifiers).toHaveBeenCalledWith({
      clerkId: "clerk_snake_2",
      email: "first@example.com",
      name: "Fallback Name",
      phone: "+5491133334444",
      nameIsCanonical: true,
    })
  })
})
