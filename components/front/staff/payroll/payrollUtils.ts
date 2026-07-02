import type { PaymentAdapterType } from "./types"

export const formatMoney = (amountCents: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountCents / 100)
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`
  }
}

export const formatHourlyRate = (hourlyRate: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(hourlyRate)
  } catch {
    return `${currency} ${hourlyRate.toFixed(2)}`
  }
}

export const createEmptyMethodForm = (defaultCurrency = "USD") => ({
  name: "",
  adapterType: "cash" as PaymentAdapterType,
  currency: defaultCurrency,
  bankName: "",
  routingNumber: "",
  accountNumber: "",
  accountType: "checking" as "checking" | "savings",
  stripeSecretKey: "",
  stripeAccountId: "",
  zelleId: "",
  venmoUser: "",
  mpPublicKey: "",
  mpAccessToken: "",
  configJson: "{}",
})
