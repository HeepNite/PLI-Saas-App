import type { BootstrapResponse, PackageOfferScenario } from "@/components/front/checkin/checkin.types"

type FetchPreviousPackage = (input: {
  userId: string
  courseSlug: string
}) => Promise<string | null>

type ResolveInput = {
  isKioskTerminalFlow: boolean
  bootstrap: BootstrapResponse
  availablePackages: Array<{ id: string }>
  fetchPreviousPackage: FetchPreviousPackage
}

type ResolveResult = {
  scenario: PackageOfferScenario
  previousPackageId: string | null
} | null

/**
 * Determines the package offer scenario from bootstrap data.
 * For "expired-rebuy" when quickCheckoutPackageId is missing,
 * calls the lazy endpoint to look up previous package history.
 * Falls back gracefully if the endpoint fails.
 */
export async function resolvePackageOfferScenario(input: ResolveInput): Promise<ResolveResult> {
  const { isKioskTerminalFlow, bootstrap, availablePackages, fetchPreviousPackage } = input

  if (!isKioskTerminalFlow) return null
  if (bootstrap.package !== null) return null
  if (availablePackages.length === 0) return null

  const quickCheckoutServiceId = bootstrap.quickCheckout?.serviceId ?? null
  const quickCheckoutPackageId = bootstrap.quickCheckout?.packageId ?? null

  // quickCheckoutPackageId present → expired-rebuy, no fetch needed
  if (quickCheckoutPackageId) {
    return { scenario: "expired-rebuy", previousPackageId: quickCheckoutPackageId }
  }

  // dropin service → upsell, no previous package needed
  if (quickCheckoutServiceId === "dropin") {
    return { scenario: "dropin-upsell", previousPackageId: null }
  }

  // Non-dropin service without quickCheckoutPackageId → check for expired history
  if (quickCheckoutServiceId !== null) {
    try {
      const userId = bootstrap.customer.userId
      const courseSlug = bootstrap.context.courseSlug
      const previousPackageId = await fetchPreviousPackage({ userId, courseSlug })

      if (previousPackageId) {
        return { scenario: "expired-rebuy", previousPackageId }
      }
      // No history — no upsell signal
      return null
    } catch {
      // Fetch failed — no upsell signal
      return null
    }
  }

  return null
}

type BuildContextInput = {
  scenario: PackageOfferScenario
  previousPackageId: string | null
  courseSlug: string
  date: string
  time: string
}

/**
 * Builds a PackageOfferContext from resolved scenario data and bootstrap context.
 */
export function buildPackageOfferContext(input: BuildContextInput) {
  return {
    scenario: input.scenario,
    previousPackageId: input.previousPackageId,
    courseSlug: input.courseSlug,
    date: input.date,
    time: input.time,
  }
}

type PrefillInput = {
  quickCheckout: {
    serviceId: string
    packageId: string | null
    addons: string[]
    participants: number
    coupon: string
    amountCents: number
    currency: string
    sourcePurchaseId: string | null
    sourcePurchaseAt: string | null
  } | null
  selectedPackageId: string | null
}

type EnrollPrefillSelection = {
  service: string
  packageId: string
  addons: string[]
  participants: number
  paymentMethod: "stripe"
}

/**
 * Picks the EnrollModal prefillSelection.
 * Priority: packageOfferPrefill (selectedPackageId) > quickCheckout.
 * Returns undefined when no quickCheckout data exists.
 */
export function pickEnrollPrefill(input: PrefillInput): EnrollPrefillSelection | undefined {
  const { quickCheckout, selectedPackageId } = input

  // Scenario 3 (new-user-upsell): selectedPackageId is set but quickCheckout is null
  // Build a minimal prefill so the EnrollModal can proceed
  if (!quickCheckout && selectedPackageId) {
    return {
      service: "dropin",
      packageId: selectedPackageId,
      addons: [],
      participants: 1,
      paymentMethod: "stripe" as const,
    }
  }

  if (!quickCheckout) return undefined

  return {
    service: quickCheckout.serviceId,
    packageId: selectedPackageId ?? quickCheckout.packageId ?? "",
    addons: quickCheckout.addons,
    participants: quickCheckout.participants,
    paymentMethod: "stripe" as const,
  }
}
