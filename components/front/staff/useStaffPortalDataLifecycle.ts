import React from "react"

import type { StaffRequestStatus } from "@/lib/security/staff-request"

type StaffRequestFilter = StaffRequestStatus | "all"
type FetchStaffRequests = (status: StaffRequestFilter, options: { scope: "all" | "mine" }) => void | Promise<void>

type UseStaffPortalDataLifecycleOptions = {
  checkoutMenuPaymentId: string | null
  setCheckoutMenuPaymentId: (paymentId: string | null) => void
  canAccessUsersNav: boolean
  showStaffOps: boolean
  isProfileView: boolean
  canAccessProfileNav: boolean
  requestStatusFilter: StaffRequestFilter
  profileRequestStatusFilter: StaffRequestFilter
  fetchStaffRequests: FetchStaffRequests
  fetchPaymentChangeRequests: () => void | Promise<void>
  fetchSelfProfile: () => void | Promise<void>
}

export function useStaffPortalDataLifecycle({
  checkoutMenuPaymentId,
  setCheckoutMenuPaymentId,
  canAccessUsersNav,
  showStaffOps,
  isProfileView,
  canAccessProfileNav,
  requestStatusFilter,
  profileRequestStatusFilter,
  fetchStaffRequests,
  fetchPaymentChangeRequests,
  fetchSelfProfile,
}: UseStaffPortalDataLifecycleOptions) {
  React.useEffect(() => {
    if (!checkoutMenuPaymentId) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest("[data-checkout-menu]")) return
      setCheckoutMenuPaymentId(null)
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [checkoutMenuPaymentId, setCheckoutMenuPaymentId])

  React.useEffect(() => {
    if (!canAccessUsersNav) return
    void fetchStaffRequests(requestStatusFilter, { scope: "all" })
  }, [canAccessUsersNav, fetchStaffRequests, requestStatusFilter])

  React.useEffect(() => {
    if (!showStaffOps) return
    void fetchPaymentChangeRequests()
  }, [fetchPaymentChangeRequests, showStaffOps])

  React.useEffect(() => {
    if (!isProfileView || !canAccessProfileNav) return
    void fetchSelfProfile()
  }, [canAccessProfileNav, fetchSelfProfile, isProfileView])

  React.useEffect(() => {
    if (!isProfileView || !canAccessProfileNav) return
    void fetchStaffRequests(profileRequestStatusFilter, { scope: "mine" })
  }, [canAccessProfileNav, fetchStaffRequests, isProfileView, profileRequestStatusFilter])
}
