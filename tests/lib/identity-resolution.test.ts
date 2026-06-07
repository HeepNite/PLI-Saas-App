import { describe, expect, it } from "vitest"

import { resolveStudentIdentity } from "@/app/api/staff/students/search/shared"

describe("resolveStudentIdentity", () => {
  const baseUser = {
    name: "Jon Doe",
    email: "jon@example.com",
    phone: "+1 555 0100",
    purchases: [{ name: "Legacy Jon" }],
  }

  // Case 1: Clerk data wins over User data for all fields
  it("prefers Clerk data over DB data for all fields when Clerk is fully populated", () => {
    expect(
      resolveStudentIdentity(baseUser, {
        firstName: "Jonathan",
        lastName: "Doe",
        primaryEmailAddress: { emailAddress: "jonathan@example.com" },
        primaryPhoneNumber: { phoneNumber: "+1 555 0199" },
        imageUrl: "https://img.example/jon.png",
        hasImage: true,
      })
    ).toEqual({
      displayName: "Jonathan Doe",
      email: "jonathan@example.com",
      phone: "+1 555 0199",
      avatarUrl: "https://img.example/jon.png",
    })
  })

  // Case 2: User.name wins when Clerk firstName+lastName is empty/whitespace
  it("falls back to user.name when Clerk first+last name are whitespace-only", () => {
    expect(
      resolveStudentIdentity(baseUser, {
        firstName: "  ",
        lastName: "  ",
        primaryEmailAddress: { emailAddress: "clerk@example.com" },
        primaryPhoneNumber: null,
        imageUrl: null,
        hasImage: false,
      })
    ).toMatchObject({ displayName: "Jon Doe" })
  })

  it("falls back to user.name when Clerk firstName and lastName are null", () => {
    expect(
      resolveStudentIdentity(baseUser, {
        firstName: null,
        lastName: null,
        primaryEmailAddress: null,
        primaryPhoneNumber: null,
        imageUrl: null,
        hasImage: false,
      })
    ).toMatchObject({ displayName: "Jon Doe" })
  })

  // Case 3: user.email as last-resort displayName (no Clerk, no User.name, no purchase name)
  it("uses user.email as last-resort displayName when no Clerk, no name, and no purchase name", () => {
    expect(
      resolveStudentIdentity(
        {
          name: null,
          email: "email-only@example.com",
          phone: null,
          purchases: [{ name: " " }],
        },
        null
      ).displayName
    ).toBe("email-only@example.com")
  })

  it("uses user.email as last-resort displayName when purchases array is empty", () => {
    expect(
      resolveStudentIdentity(
        {
          name: null,
          email: "fallback@example.com",
          phone: null,
          purchases: [],
        },
        null
      ).displayName
    ).toBe("fallback@example.com")
  })

  // Case 4: clerkData is null → full DB fallback, avatarUrl null
  it("uses full DB fallback and returns avatarUrl null when clerkData is null", () => {
    expect(
      resolveStudentIdentity(baseUser, null)
    ).toEqual({
      displayName: "Jon Doe",
      email: "jon@example.com",
      phone: "+1 555 0100",
      avatarUrl: null,
    })
  })

  // Case 5: Clerk hasImage false → avatarUrl null even with imageUrl present
  it("returns avatarUrl null when Clerk hasImage is false even if imageUrl is set", () => {
    expect(
      resolveStudentIdentity(baseUser, {
        firstName: "Jonathan",
        lastName: "Doe",
        primaryEmailAddress: { emailAddress: "jonathan@example.com" },
        primaryPhoneNumber: null,
        imageUrl: "https://img.example/jon.png",
        hasImage: false,
      }).avatarUrl
    ).toBeNull()
  })

  // Case 6: Clerk has no primaryEmailAddress → falls back to user.email
  it("falls back to user.email when Clerk primaryEmailAddress is null", () => {
    expect(
      resolveStudentIdentity(baseUser, {
        firstName: "Jonathan",
        lastName: "Doe",
        primaryEmailAddress: null,
        primaryPhoneNumber: { phoneNumber: "+1 555 0199" },
        imageUrl: null,
        hasImage: false,
      }).email
    ).toBe("jon@example.com")
  })

  // Case 7a: Clerk has no primaryPhoneNumber → falls back to user.phone
  it("falls back to user.phone when Clerk primaryPhoneNumber is null", () => {
    expect(
      resolveStudentIdentity(baseUser, {
        firstName: "Jonathan",
        lastName: "Doe",
        primaryEmailAddress: { emailAddress: "jonathan@example.com" },
        primaryPhoneNumber: null,
        imageUrl: null,
        hasImage: false,
      }).phone
    ).toBe("+1 555 0100")
  })

  // Case 7b: Clerk has no primaryPhoneNumber AND user.phone is also null → returns null
  it("returns phone null when neither Clerk nor user has a phone", () => {
    expect(
      resolveStudentIdentity(
        { ...baseUser, phone: null },
        {
          firstName: "Jonathan",
          lastName: "Doe",
          primaryEmailAddress: { emailAddress: "jonathan@example.com" },
          primaryPhoneNumber: null,
          imageUrl: null,
          hasImage: false,
        }
      ).phone
    ).toBeNull()
  })

  // Case 8: User.name is empty string → treated as falsy, falls through to purchase name
  it("treats user.name empty string as falsy and falls through to purchase snapshot", () => {
    expect(
      resolveStudentIdentity(
        {
          name: "",
          email: "empty-name@example.com",
          phone: null,
          purchases: [{ name: "Purchase Snapshot" }],
        },
        null
      ).displayName
    ).toBe("Purchase Snapshot")
  })

  it("treats user.name empty string as falsy and falls through to email when purchases are also empty", () => {
    expect(
      resolveStudentIdentity(
        {
          name: "",
          email: "empty-name@example.com",
          phone: null,
          purchases: [],
        },
        null
      ).displayName
    ).toBe("empty-name@example.com")
  })
})
