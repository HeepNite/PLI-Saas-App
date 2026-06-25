import React from "react"
import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { ProfileRightRail } from "@/components/front/profile/sections/ProfileRightRail"

describe("ProfileRightRail", () => {
  it("renders booking actions and recent request labels without check-in card", () => {
    const html = renderToStaticMarkup(
      <ProfileRightRail
        rightRailRef={React.createRef<HTMLDivElement>()}
        onOpenCoursePicker={vi.fn()}
        bookingsLoading={false}
        selectedBooking={{ id: "booking-1", status: "BOOKED", startsAt: "2026-10-12T09:00:00.000Z", courseSlug: "salsa-1", courseTitle: "Salsa 1", sessionId: "session-1", packagePurchaseId: null, packageLabel: null }}
        bookingsError={null}
        onOpenChangeClassModal={vi.fn()}
        onOpenRequestModal={vi.fn()}
        requestSubmitError={null}
        requestSubmitSuccess={null}
        requestModalType={null}
        actionRequestsError={null}
        actionRequestsLoading={false}
        latestActionRequests={[
          { id: "request-1", type: "CANCEL", status: "PENDING", createdAt: "2026-10-10T08:00:00.000Z", message: "Need to cancel", meta: null, resolvedAt: null },
        ]}
      />
    )

    expect(html).toContain("Book new class")
    expect(html).toContain("Change class")
    expect(html).not.toContain("Check-in")
    expect(html).toContain("Suspend / Cancel")
    expect(html).toContain("Recent requests")
    expect(html).toContain("Cancel class")
    expect(html).toContain("Need to cancel")
  })
})
