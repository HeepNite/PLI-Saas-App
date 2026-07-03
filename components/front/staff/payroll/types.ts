export type CurrencyRecord = {
  id: string
  code: string
  symbol: string
  decimals: number
  active: boolean
}

export type StaffPaymentMethodRecord = {
  id: string
  name: string
  adapterType: string
  currency: string
  active: boolean
  configJson: unknown
}

export type StaffPaymentModelRecord = {
  id: string
  name: string
  hourlyRate: number
  currency: string
  paydayWeekday: number
  creditCapCents: number
  defaultPaymentMethodId: string | null
  isDefault: boolean
  active: boolean
  defaultPaymentMethod?: StaffPaymentMethodRecord | null
}

export const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "direct_deposit", label: "Direct Deposit (ACH)" },
  { value: "mercadopago", label: "Mercado Pago" },
  { value: "stripe", label: "Stripe Payouts" },
  { value: "zelle", label: "Zelle / Venmo" },
  { value: "credits", label: "Internal Credits" },
] as const

export type PaymentAdapterType = (typeof PAYMENT_METHOD_OPTIONS)[number]["value"]

export const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const
