/**
 * Canonical payment / purchase constants.
 *
 * Replaces magic strings scattered across route handlers, normalizers,
 * and UI components with a single source of truth.
 */

export const PAYMENT_CHANNEL = {
  CASH: "cash",
  CARD: "card",
  PACKAGE_CREDIT: "package_credit",
  UNKNOWN: "unknown",
} as const

export const SETTLEMENT_STATUS = {
  PENDING: "pending",
  PAID: "paid",
} as const

export const PURCHASE_SOURCE = {
  WEB: "web",
  KIOSK: "kiosk",
  FRONT_DESK: "front_desk",
  ADMIN: "admin",
  UNKNOWN: "unknown",
} as const

export const PURCHASE_STATUS = {
  PAID: "paid",
  SUCCEEDED: "succeeded",
  COMPLETED: "completed",
  FAILED: "failed",
  REFUNDED: "refunded",
  PENDING: "pending",
} as const

export const FLOW_CONTEXT = {
  KIOSK_TERMINAL: "kiosk_terminal",
  QR_PHONE: "qr_phone",
  HOSTED_CHECKOUT: "hosted_checkout",
  WEB_CHECKOUT: "web_checkout",
} as const

/** Resolve purchase source from photo/flow context. QR phone and kiosk terminal both originate at the kiosk. */
export const resolveKioskPurchaseSource = (photoContext?: string | null) =>
  photoContext === FLOW_CONTEXT.KIOSK_TERMINAL || photoContext === FLOW_CONTEXT.QR_PHONE
    ? PURCHASE_SOURCE.KIOSK
    : PURCHASE_SOURCE.WEB

export const VALID_PAYMENT_METHODS = [
  PAYMENT_CHANNEL.CASH,
  PAYMENT_CHANNEL.CARD,
  "transfer",
  "other",
] as const

export const CLOCK_STATUS = {
  CLOCKED_IN: "clocked_in",
  CLOCKED_OUT: "clocked_out",
} as const
