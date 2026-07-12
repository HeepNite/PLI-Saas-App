import type { AdapterType } from "@/lib/payroll/types"
import { ADAPTER_TYPES } from "@/lib/payroll/types"

/**
 * Declares which `configJson` keys are secret-bearing for a given adapter
 * type. This is the single source of truth for masking/merge decisions —
 * secret-ness is derived from this table, never from a substring heuristic
 * on arbitrary keys.
 */
export type ConfigFieldSchema = {
  key: string
  secret: boolean
  previewTail?: number
}

/**
 * Per-adapter secret-field declarations. MUST cover every `AdapterType`
 * union member so this record compiles without a missing-key error.
 *
 * Any stored key NOT declared here for the resolved adapter type is masked
 * on read as if it were secret (fail-closed, mask-all-undeclared).
 */
export const ADAPTER_CONFIG_SCHEMAS: Record<AdapterType, ConfigFieldSchema[]> = {
  [ADAPTER_TYPES.STRIPE]: [
    { key: "secretKey", secret: true },
    { key: "accountId", secret: true },
  ],
  [ADAPTER_TYPES.MERCADOPAGO]: [
    { key: "accessToken", secret: true },
    { key: "publicKey", secret: true },
  ],
  [ADAPTER_TYPES.DIRECT_DEPOSIT]: [
    { key: "routingNumber", secret: true, previewTail: 4 },
    { key: "accountNumber", secret: true, previewTail: 4 },
    { key: "bankName", secret: false },
    { key: "accountType", secret: false },
  ],
  [ADAPTER_TYPES.ZELLE]: [
    { key: "zelleId", secret: true },
    { key: "venmoUser", secret: true },
  ],
  [ADAPTER_TYPES.BANK_TRANSFER]: [{ key: "accountAlias", secret: false }],
  [ADAPTER_TYPES.CASH]: [],
  [ADAPTER_TYPES.CREDITS]: [],
}

export function getAdapterConfigSchema(adapterType: AdapterType): ConfigFieldSchema[] {
  return ADAPTER_CONFIG_SCHEMAS[adapterType]
}
