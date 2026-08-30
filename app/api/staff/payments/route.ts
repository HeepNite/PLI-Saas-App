import { NextResponse } from "next/server"
import { authorizeStaffPortalSectionRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { parseStaffPaymentsRequest } from "@/app/api/staff/payments/payments-request"
import { buildStaffPaymentResponseRow } from "@/app/api/staff/payments/payments-row"
import { getStaffPaymentsTodayWindow } from "@/app/api/staff/payments/payments-time"
import { loadStaffPaymentsData } from "@/app/api/staff/payments/payments-loader"
import { isCompletedPaymentStatus, isTerminalUnpaidCardAttempt } from "@/app/api/staff/payments/shared"
import { PAYMENT_CHANNEL, SETTLEMENT_STATUS } from "@/lib/payment-constants"

export const runtime = "nodejs"

const buildPaymentsSummary = <TItem extends {
  amount: number
  paymentStatus: string
  paymentChannel: string
  settlementStatus: string
  classPaid: boolean
}>(items: TItem[]) => ({
  totalItems: items.length,
  totalCollected: items
    .filter((item) => isCompletedPaymentStatus(item.paymentStatus))
    .reduce((sum, item) => sum + item.amount, 0),
  pendingSettlement: items.filter((item) => item.paymentChannel === PAYMENT_CHANNEL.CASH && item.settlementStatus === SETTLEMENT_STATUS.PENDING).length,
  paidSettlement: items.filter((item) => item.paymentChannel === PAYMENT_CHANNEL.CASH && item.settlementStatus === SETTLEMENT_STATUS.PAID).length,
  pendingStripe: items.filter((item) => item.paymentChannel === PAYMENT_CHANNEL.CARD && !item.classPaid).length,
  paidStripe: items.filter((item) => item.paymentChannel === PAYMENT_CHANNEL.CARD && item.classPaid).length,
})

export async function GET(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:payments:get", limit: 90, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalSectionRequest("students"),
  })
  if (!guard.ok) return guard.response

  const paymentsRequest = parseStaffPaymentsRequest(req)
  if (!paymentsRequest.ok) {
    return NextResponse.json(
      { error: paymentsRequest.error },
      { status: paymentsRequest.status }
    )
  }

  const todayWindow = getStaffPaymentsTodayWindow()

  const { scopedPurchases, historyTruncated, classOptions, rowContext } =
    await loadStaffPaymentsData(paymentsRequest, todayWindow)

  const boardPurchases = paymentsRequest.mode === "userHistory"
    ? scopedPurchases
    : scopedPurchases.filter((item) => !isTerminalUnpaidCardAttempt({
        userId: item.userId,
        amount: item.purchase.amount,
        metadata: item.metadata,
        status: item.purchase.status,
        stripePaymentIntentId: item.purchase.stripePaymentIntentId,
        stripeCheckoutSessionId: item.purchase.stripeCheckoutSessionId,
      }))

  const mapped = boardPurchases.map((item) => buildStaffPaymentResponseRow(item, {
    mode: paymentsRequest.mode,
    ...rowContext,
  }))

  const { settlementFilter } = paymentsRequest
  const filtered = settlementFilter === "all" ? mapped : mapped.filter((item) => item.settlementStatus === settlementFilter)

  const summary = buildPaymentsSummary(filtered)

  if (paymentsRequest.mode === "history") {
    return NextResponse.json({
      items: filtered,
      summary,
      classOptions,
      meta: {
        mode: paymentsRequest.mode,
        from: paymentsRequest.historyRange.from,
        to: paymentsRequest.historyRange.to,
        truncated: historyTruncated,
      },
    })
  }

  return NextResponse.json({ items: filtered, summary })
}
