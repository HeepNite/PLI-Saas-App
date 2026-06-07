export const PAYROLL_ENTRY_STATUSES = {
  PENDING: "pending",
  PROCESSING: "processing",
  PARTIAL_PROPOSED: "partial_proposed",
  PAID: "paid",
  CANCELLED: "cancelled",
  REVERSED: "reversed",
} as const

export type PayrollEntryStatus = (typeof PAYROLL_ENTRY_STATUSES)[keyof typeof PAYROLL_ENTRY_STATUSES]

export const AUDIT_ENTRY_TYPES = {
  PAID: "PAID",
  HOURS_OVERRIDE: "HOURS_OVERRIDE",
  AMOUNT_OVERRIDE: "AMOUNT_OVERRIDE",
  PARTIAL_PROPOSED: "PARTIAL_PROPOSED",
  PARTIAL_ACCEPTED: "PARTIAL_ACCEPTED",
  PARTIAL_REJECTED: "PARTIAL_REJECTED",
  REVERSAL: "REVERSAL",
  MODEL_ASSIGNED: "MODEL_ASSIGNED",
} as const

export type AuditEntryType = (typeof AUDIT_ENTRY_TYPES)[keyof typeof AUDIT_ENTRY_TYPES]

export const CREDIT_LEDGER_ENTRY_TYPES = {
  MANUAL_AWARD: "MANUAL_AWARD",
  REVERSAL: "REVERSAL",
  FORFEITURE: "FORFEITURE",
} as const

export type CreditLedgerEntryType = (typeof CREDIT_LEDGER_ENTRY_TYPES)[keyof typeof CREDIT_LEDGER_ENTRY_TYPES]

export const BONUS_TYPES = {
  ONE_OFF: "one_off",
  RECURRING: "recurring",
} as const

export type BonusType = (typeof BONUS_TYPES)[keyof typeof BONUS_TYPES]

export const ADAPTER_TYPES = {
  CASH: "cash",
  BANK_TRANSFER: "bank_transfer",
  MERCADOPAGO: "mercadopago",
  CREDITS: "credits",
  DIRECT_DEPOSIT: "direct_deposit",
  STRIPE: "stripe",
  ZELLE: "zelle",
} as const

export type AdapterType = (typeof ADAPTER_TYPES)[keyof typeof ADAPTER_TYPES]

export type PayrollEntrySnapshot = {
  id: string
  staffAccountId: string
  periodStart: Date
  periodEnd: Date
  hoursWorked: number
  hourlyRate: number
  grossAmount: number
  bonusAmount: number
  totalAmount: number
  currency: string
  status: PayrollEntryStatus
  paymentMethodId?: string | null
  paymentModelId?: string | null
  idempotencyKey?: string | null
  proposedAmount?: number | null
}

export const UNAVAILABILITY_TYPES = {
  DAY_OFF: "day_off",
  SICK_LEAVE: "sick_leave",
  SUSPENSION: "suspension",
  OTHER: "other",
} as const

export type UnavailabilityType = (typeof UNAVAILABILITY_TYPES)[keyof typeof UNAVAILABILITY_TYPES]

export const UNAVAILABILITY_STATUSES = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
} as const

export type UnavailabilityStatus = (typeof UNAVAILABILITY_STATUSES)[keyof typeof UNAVAILABILITY_STATUSES]
