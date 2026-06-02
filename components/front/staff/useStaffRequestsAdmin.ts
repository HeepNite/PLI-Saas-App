import React from "react"

import type { StaffRequestStatus } from "@/lib/security/staff-request"

import type {
  PaymentChangeRequestStatus,
  StaffPaymentChangeRequestRow,
  StaffRequestRow,
  StaffRequestSummary,
} from "./staffAdminTypes"
import {
  buildStaffApprovalsFeed,
  buildStaffApprovalsSummary,
  isVisiblePaymentChangeRequest,
} from "./staffApprovals"

type StaffRequestsScope = "all" | "mine"

type StaffRequestsAdminInput = {
  ensureMinimumLoadingTime: (startedAt: number) => Promise<void>
  handleStaffAuthFailure: (status: number) => boolean
  setError: (error: string | null) => void
}

const createEmptyRequestsSummary = (): StaffRequestSummary => ({
  total: 0,
  pending: 0,
  inReview: 0,
  approved: 0,
  rejected: 0,
})

export const useStaffRequestsAdmin = ({
  ensureMinimumLoadingTime,
  handleStaffAuthFailure,
  setError,
}: StaffRequestsAdminInput) => {
  const [staffRequests, setStaffRequests] = React.useState<StaffRequestRow[]>([])
  const [requestsSummary, setRequestsSummary] = React.useState<StaffRequestSummary>(createEmptyRequestsSummary)
  const [requestsLoading, setRequestsLoading] = React.useState(false)
  const [requestStatusFilter, setRequestStatusFilter] = React.useState<StaffRequestStatus | "all">("PENDING")
  const [requestBusyId, setRequestBusyId] = React.useState<string | null>(null)
  const [paymentChangeRequests, setPaymentChangeRequests] = React.useState<StaffPaymentChangeRequestRow[]>([])
  const [paymentChangeRequestsLoading, setPaymentChangeRequestsLoading] = React.useState(false)
  const [paymentChangeRequestBusyId, setPaymentChangeRequestBusyId] = React.useState<string | null>(null)

  const fetchStaffRequests = React.useCallback(
    async (
      status: StaffRequestStatus | "all" = "PENDING",
      options?: { scope?: StaffRequestsScope }
    ) => {
      const startedAt = Date.now()
      setRequestsLoading(true)
      try {
        const url = new URL("/api/staff/requests", window.location.origin)
        const scope = options?.scope || "all"
        if (status !== "all") {
          url.searchParams.set("status", status)
        }
        if (scope === "mine") {
          url.searchParams.set("scope", "mine")
        }
        const res = await fetch(url.toString(), { headers: { "Content-Type": "application/json" } })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (handleStaffAuthFailure(res.status)) return
          setError(typeof data?.error === "string" ? data.error : "Failed to load staff requests")
          setStaffRequests([])
          return
        }
        setStaffRequests(Array.isArray(data?.items) ? data.items : [])
        setRequestsSummary(data?.summary || createEmptyRequestsSummary())
      } catch {
        setError("Network error while loading staff requests")
        setStaffRequests([])
      } finally {
        await ensureMinimumLoadingTime(startedAt)
        setRequestsLoading(false)
      }
    },
    [ensureMinimumLoadingTime, handleStaffAuthFailure, setError]
  )

  const fetchPaymentChangeRequests = React.useCallback(async () => {
    const startedAt = Date.now()
    setPaymentChangeRequestsLoading(true)
    try {
      const res = await fetch("/api/staff/payroll/change-requests", {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setError(typeof data?.error === "string" ? data.error : "Failed to load payment change requests")
        setPaymentChangeRequests([])
        return
      }

      setPaymentChangeRequests(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setError("Network error while loading payment change requests")
      setPaymentChangeRequests([])
    } finally {
      await ensureMinimumLoadingTime(startedAt)
      setPaymentChangeRequestsLoading(false)
    }
  }, [ensureMinimumLoadingTime, handleStaffAuthFailure, setError])

  const updateRequestStatus = React.useCallback(async (requestId: string, status: StaffRequestStatus) => {
    setRequestBusyId(requestId)
    setError(null)
    try {
      const res = await fetch(`/api/staff/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to update request")
        return
      }
      await fetchStaffRequests(requestStatusFilter, { scope: "all" })
    } catch {
      setError("Network error while updating request")
    } finally {
      setRequestBusyId(null)
    }
  }, [fetchStaffRequests, requestStatusFilter, setError])

  const updatePaymentChangeRequestStatus = React.useCallback(async (
    requestId: string,
    status: Extract<PaymentChangeRequestStatus, "approved" | "rejected">
  ) => {
    setPaymentChangeRequestBusyId(requestId)
    setError(null)
    try {
      const res = await fetch(`/api/staff/payroll/change-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (handleStaffAuthFailure(res.status)) return
        setError(typeof data?.error === "string" ? data.error : "Failed to update payment change request")
        return
      }
      await fetchPaymentChangeRequests()
    } catch {
      setError("Network error while updating payment change request")
    } finally {
      setPaymentChangeRequestBusyId(null)
    }
  }, [fetchPaymentChangeRequests, handleStaffAuthFailure, setError])

  const approvalsSummary = React.useMemo(
    () => buildStaffApprovalsSummary(requestsSummary, paymentChangeRequests),
    [paymentChangeRequests, requestsSummary]
  )
  const approvalFeed = React.useMemo(
    () =>
      buildStaffApprovalsFeed(
        staffRequests,
        paymentChangeRequests.filter((request) => isVisiblePaymentChangeRequest(request, requestStatusFilter))
      ),
    [paymentChangeRequests, requestStatusFilter, staffRequests]
  )
  const approvalsLoading = requestsLoading || paymentChangeRequestsLoading

  return {
    staffRequests,
    requestsSummary,
    requestsLoading,
    requestStatusFilter,
    setRequestStatusFilter,
    requestBusyId,
    paymentChangeRequests,
    paymentChangeRequestsLoading,
    paymentChangeRequestBusyId,
    fetchStaffRequests,
    fetchPaymentChangeRequests,
    updateRequestStatus,
    updatePaymentChangeRequestStatus,
    approvalsSummary,
    approvalFeed,
    approvalsLoading,
  }
}
