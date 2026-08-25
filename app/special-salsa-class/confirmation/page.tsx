import type { Metadata } from "next"
import PublicLayout from "@/components/layouts/PublicLayout"
import { SpecialSalsaClassConfirmation } from "@/components/front/special-salsa-class/SpecialSalsaClassConfirmation"
import { resolveSpecialClassConfirmation } from "@/lib/checkout/special-class-confirmation"
import type { SpecialClassConfirmationState } from "@/lib/checkout/special-class-confirmation"

export const metadata: Metadata = {
  title: "Special Salsa Class Confirmation | PLI",
  robots: { index: false, follow: false },
}

const TEST_CONFIRMATION_STATES: ReadonlySet<SpecialClassConfirmationState> = new Set([
  "confirmed",
  "finalizing",
])

export default async function SpecialSalsaClassConfirmationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const sessionId = typeof params?.session_id === "string" ? params.session_id : undefined
  const requestedTestState = typeof params?.test_state === "string" ? params.test_state : ""
  const testState = process.env.PLAYWRIGHT_SPECIAL_CLASS_MOCKS === "1" && TEST_CONFIRMATION_STATES.has(requestedTestState as SpecialClassConfirmationState)
    ? requestedTestState as SpecialClassConfirmationState
    : null
  const { state } = testState
    ? { state: testState }
    : await resolveSpecialClassConfirmation(sessionId)

  return (
    <PublicLayout headerVariant="compact" floatingChrome="hidden">
      <SpecialSalsaClassConfirmation state={state} />
    </PublicLayout>
  )
}
