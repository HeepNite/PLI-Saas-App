import React from "react"
import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { StudentPinCard } from "@/components/front/profile/sections/StudentPinCard"
import type { StudentPinClientStatus } from "@/components/front/hooks/useStudentPinStatus"

describe("StudentPinCard", () => {
  const baseStatus: StudentPinClientStatus = {
    enabled: true,
    enrolled: true,
    needsEnrollment: false,
    locked: false,
    permanent: {
      failedAttempts: 1,
      status: "ACTIVE",
      lockedAt: null,
      lastVerifiedAt: null,
    },
    provisional: {
      active: false,
      expiresAt: null,
    },
  }

  it("renders the student pin management header and status rows", () => {
    const html = renderToStaticMarkup(
      <StudentPinCard
        pinStatus={baseStatus}
        pinLoading={false}
        pinStatusError={null}
        pinRecoveryMode={false}
        pinCurrentValue="1234"
        pinNextValue="4321"
        pinConfirmValue="4321"
        pinSaving={false}
        pinFormError={null}
        pinFormSuccess={null}
        onPinCurrentChange={vi.fn()}
        onPinNextChange={vi.fn()}
        onPinConfirmChange={vi.fn()}
        onToggleRecoveryMode={vi.fn()}
        onSubmit={vi.fn()}
      />
    )

    expect(html).toContain("Student PIN")
    expect(html).toContain("Manage your kiosk PIN")
    expect(html).toContain("Ready for kiosk use")
    expect(html).toContain("Account recovery available")
    expect(html).toContain("1 / 5 failed attempts")
  })

  it("renders enrollment variant and success message", () => {
    const html = renderToStaticMarkup(
      <StudentPinCard
        pinStatus={{ ...baseStatus, enrolled: false, needsEnrollment: true }}
        pinLoading={false}
        pinStatusError={null}
        pinRecoveryMode={false}
        pinCurrentValue=""
        pinNextValue="1111"
        pinConfirmValue="1111"
        pinSaving={false}
        pinFormError={null}
        pinFormSuccess="PIN updated"
        onPinCurrentChange={vi.fn()}
        onPinNextChange={vi.fn()}
        onPinConfirmChange={vi.fn()}
        onToggleRecoveryMode={vi.fn()}
        onSubmit={vi.fn()}
      />
    )

    expect(html).toContain("Set your kiosk PIN")
    expect(html).toContain("Enrollment required")
    expect(html).toContain("Enroll PIN")
    expect(html).toContain("PIN updated")
  })
})
