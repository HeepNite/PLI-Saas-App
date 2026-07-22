type TerminalPaymentIntentMetadata = Record<string, string>

export type TerminalPaymentIntentGatewayRequest = {
  amount: number
  currency: string
  receiptEmail: string
  idempotencyKey: string
  metadata: TerminalPaymentIntentMetadata
}

export type TerminalPaymentIntentGatewayResponse = {
  clientSecret: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
const isString = (value: unknown): value is string => typeof value === "string"
const isNonEmptyString = (value: unknown): value is string => isString(value) && value.trim().length > 0
const isPositiveInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0

const isMetadataRecord = (value: unknown): value is TerminalPaymentIntentMetadata =>
  isRecord(value) && Object.values(value).every((entry) => isNonEmptyString(entry))

export const parseTerminalPaymentIntentGatewayRequest = (value: unknown): TerminalPaymentIntentGatewayRequest | null => {
  if (!isRecord(value)) {
    return null
  }

  if (
    !isPositiveInteger(value.amount) ||
    !isNonEmptyString(value.currency) ||
    !isNonEmptyString(value.receiptEmail) ||
    !isNonEmptyString(value.idempotencyKey) ||
    !isMetadataRecord(value.metadata)
  ) {
    return null
  }

  return {
    amount: value.amount,
    currency: value.currency,
    receiptEmail: value.receiptEmail,
    idempotencyKey: value.idempotencyKey,
    metadata: value.metadata,
  }
}

export const parseTerminalPaymentIntentGatewayResponse = (value: unknown): TerminalPaymentIntentGatewayResponse | null => {
  if (!isRecord(value) || !isNonEmptyString(value.clientSecret)) {
    return null
  }

  return { clientSecret: value.clientSecret }
}
