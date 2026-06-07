import React from "react"
import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import ProfilePhotoCapture from "@/components/front/checkin/ProfilePhotoCapture"
import { getPhotoPolicy } from "@/lib/checkin/photo-context-policy"
import { resolveCheckInServiceSelection } from "@/lib/checkin/new-student-flow"

describe("profile photo gating", () => {
  it("shows consent screen with Continue and Skip on mount", () => {
    const html = renderToStaticMarkup(
      <ProfilePhotoCapture
        policy={getPhotoPolicy("qr_phone")}
        onSaved={() => undefined}
      />
    )

    expect(html).toContain("We&#x27;ll take a quick photo")
    expect(html).toContain("Continue")
    expect(html).toContain("Skip")
    expect(html).not.toContain("Upload from gallery")
    expect(html).not.toContain("Capture photo")
  })

  it("blocks gallery upload for kiosk_terminal", () => {
    const html = renderToStaticMarkup(
      <ProfilePhotoCapture
        policy={getPhotoPolicy("kiosk_terminal")}
        targetUserId="user_customer"
        onSaved={() => undefined}
      />
    )

    // Still shows consent screen, not camera controls
    expect(html).toContain("Continue")
    expect(html).not.toContain("Upload from gallery")
  })

  it("keeps the regular service selected when new-student fallback is locked", () => {
    const nextService = resolveCheckInServiceSelection({
      previousService: "dropin",
      availableServiceIds: ["dropin", "new-student"],
      isCheckInNewFlow: true,
      hasNewStudentService: true,
      regularFallbackLocked: true,
    })

    expect(nextService).toBe("dropin")
  })
})
