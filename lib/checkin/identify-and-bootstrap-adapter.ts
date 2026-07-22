import type { BootstrapResponse } from "@/components/front/checkin/checkin.types"
import type {
  FastPathResponse,
  FullPathResponse,
} from "@/lib/checkin/types/identify-and-bootstrap"

/**
 * Adapts the `/api/checkin/phone/identify-and-bootstrap` discriminated-union
 * response into the `BootstrapResponse` shape the check-in UI already
 * consumes from the QR bootstrap flow (`useCheckInBootstrap`).
 *
 * `packages` (plural active-package list), `purchaseHistory`,
 * `hasPreviousPurchase`, and `hasAnyCompletedPurchase` are not returned by
 * this endpoint (it optimizes for kiosk latency) and are not read anywhere
 * in the check-in UI today — they default to empty/false here rather than
 * being fetched, keeping this a pure, cheap client-side mapping.
 */
export const adaptIdentifyAndBootstrapResponse = (
  data: FastPathResponse | FullPathResponse
): BootstrapResponse => {
  const isFullPath = data.path === "full"

  return {
    context: data.context,
    customer: isFullPath
      ? data.customer
      : {
          userId: data.customer.userId,
          clerkUserId: "",
          firstName: "",
          lastName: "",
          name: data.customer.name,
          email: data.customer.email,
          phone: data.customer.phone,
          hasAvatar: false,
        },
    package: data.package,
    packages: [],
    quickCheckout: data.quickCheckout,
    purchaseHistory: [],
    hasPreviousPurchase: false,
    hasAnyCompletedPurchase: false,
    hasExistingPurchaseForSession: data.hasExistingPurchaseForSession,
    hasAnyActivePackage: data.hasAnyActivePackage,
    consecutiveOffer: data.consecutiveOffer,
  }
}
