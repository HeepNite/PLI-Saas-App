import type { PayrollEntrySnapshot } from "@/lib/payroll/types"

export type DispatchResult = {
  ok: boolean
  reference?: string
  error?: string
}

export interface IPaymentAdapter {
  dispatch(entry: PayrollEntrySnapshot, amount: number, actor: string): Promise<DispatchResult>
}
