import type { AdapterType } from "@/lib/payroll/types"
import { ADAPTER_TYPES } from "@/lib/payroll/types"
import type { IPaymentAdapter } from "@/lib/payroll/adapters/IPaymentAdapter"
import { ManualDispatchAdapter } from "@/lib/payroll/adapters/ManualDispatchAdapter"

export class UnknownAdapterTypeError extends Error {
  constructor(adapterType: string) {
    super(`Unknown adapter type: ${adapterType}`)
    this.name = "UnknownAdapterTypeError"
  }
}

const manualDispatchAdapter = new ManualDispatchAdapter()

const adapterRegistry: Record<AdapterType, IPaymentAdapter> = {
  [ADAPTER_TYPES.CASH]: manualDispatchAdapter,
  [ADAPTER_TYPES.BANK_TRANSFER]: manualDispatchAdapter,
  [ADAPTER_TYPES.MERCADOPAGO]: manualDispatchAdapter,
  [ADAPTER_TYPES.CREDITS]: manualDispatchAdapter,
  [ADAPTER_TYPES.DIRECT_DEPOSIT]: manualDispatchAdapter,
  [ADAPTER_TYPES.STRIPE]: manualDispatchAdapter,
  [ADAPTER_TYPES.ZELLE]: manualDispatchAdapter,
}

export const VALID_ADAPTER_TYPES = Object.values(ADAPTER_TYPES) as readonly AdapterType[]

export function getAdapter(adapterType: AdapterType): IPaymentAdapter {
  const adapter = adapterRegistry[adapterType]

  if (!adapter) {
    throw new UnknownAdapterTypeError(adapterType)
  }

  return adapter
}
