import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const source = readFileSync(
  join(process.cwd(), "components/front/profile/ProfilePageClient.tsx"),
  "utf8"
)

describe("profile composition", () => {
  it("mounts the mobile completion modal through the existing profile form state", () => {
    expect(source).toContain('import { ProfileCompletionModal } from "./modals/ProfileCompletionModal"')
    expect(source).toContain("isOpen={!profileLoading && isMobileProfile && !profileComplete && showProfileCompletionModal}")
    expect(source).toContain("setShowProfileForm(true)")
  })

  it("does not compose deferred social, analytics, or gear sections", () => {
    expect(source).not.toContain("<StudentMomentsCard")
    expect(source).not.toContain("<AnalyticsCard")
    expect(source).not.toContain("<GearCard")
    expect(source).not.toContain("useAnalyticsChartData(")
  })
})
