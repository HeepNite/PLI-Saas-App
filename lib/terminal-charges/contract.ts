// Shared contract for staff-initiated charges collected on a tablet's M2 reader.
// Spec: docs/specs/staff-panel-m2-charge (requirements.md D1-D7). D1 drop-in credits are phase 2.

export const TERMINAL_CHARGE_STATUSES = ["pending", "collecting", "paid", "declined", "cancelled", "expired"] as const
export type TerminalChargeStatus = (typeof TERMINAL_CHARGE_STATUSES)[number]

export const TERMINAL_CHARGE_ITEM_KINDS = ["package", "guest_class", "outstanding", "free_amount"] as const
export type TerminalChargeItemKind = (typeof TERMINAL_CHARGE_ITEM_KINDS)[number]

export const TERMINAL_CHARGE_TTL_MS = 10 * 60 * 1000
export const TERMINAL_CHARGE_POLL_MS = 3_000
export const TERMINAL_CHARGE_MAX_ITEMS = 20
export const TERMINAL_CHARGE_FREE_AMOUNT_MAX_CENTS = 200_000
export const TERMINAL_CHARGE_DESCRIPTION_MAX_LENGTH = 200
export const TERMINAL_CHARGE_GUEST_NAME_MAX_LENGTH = 80

// One carrier Purchase transports the card payment; its line-item children hold the revenue.
export const TERMINAL_CHARGE_CARRIER_COURSE_SLUG = "staff-terminal-charge"
export const TERMINAL_CHARGE_FREE_AMOUNT_COURSE_SLUG = "staff-charge-free-amount"
export const TERMINAL_CHARGE_METADATA = { chargeId: "staffChargeId", lineKind: "lineKind" } as const

// Items sent by the panel. Only free_amount carries an amount; the server prices the rest.
// guest_class (D2): a friend's drop-in, recorded under the payer; the friend gets no account.
export type TerminalChargeItemInput =
  | { kind: "package"; beneficiaryUserId: string; courseSlug: string; packageId: string }
  | { kind: "guest_class"; courseSlug: string; guestName?: string }
  | { kind: "outstanding"; outstandingPurchaseId?: string; outstandingAttendanceId?: string }
  | { kind: "free_amount"; amountCents: number; description: string }

export type TerminalChargeView = {
  id: string
  terminalId: string
  terminalName: string
  payerUserId: string
  payerName: string
  status: TerminalChargeStatus
  totalCents: number
  currency: string
  expiresAt: string
  createdAt: string
  resolvedAt: string | null
  failureReason: string | null
  items: Array<{ id: string; kind: TerminalChargeItemKind; label: string; amountCents: number }>
}

// Staff (Clerk session, canCreateTerminalCharge):
//   POST /api/staff/terminal-charges { terminalId, payerUserId, items } -> 201 { charge }
//   GET  /api/staff/terminal-charges/[id] -> { charge }
//   POST /api/staff/terminal-charges/[id]/cancel -> { charge } | 409 { error } (money received or card processing)
// Tablet (terminal session cookie):
//   GET  /api/staff/terminal/charges/pending -> { charge | null }
//   POST /api/staff/terminal/charges/[id]/prepare -> { preparedPurchaseReference, state: "prepared" }
//   POST /api/staff/terminal/charges/[id]/result { outcome: "declined" | "cancelled" } -> { charge }
//   (`paid` is set only by the Stripe webhook.)

export const isTerminalChargeFinal = (status: TerminalChargeStatus) =>
  status !== "pending" && status !== "collecting"
