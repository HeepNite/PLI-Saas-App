import type { IPaymentAdapter, DispatchResult } from "@/lib/payroll/adapters/IPaymentAdapter"
import type { PayrollEntrySnapshot } from "@/lib/payroll/types"

export class ManualDispatchAdapter implements IPaymentAdapter {
  dispatch(entry: PayrollEntrySnapshot, amount: number, actor: string): Promise<DispatchResult> {
    void entry
    void amount
    void actor

    return Promise.resolve({ ok: true, reference: "manual" })
  }
}
