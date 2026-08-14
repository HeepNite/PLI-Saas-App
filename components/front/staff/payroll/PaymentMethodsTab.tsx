"use client"

import React from "react"
import { CircleDollarSign, Info, Loader2, Plus } from "lucide-react"
import {
  type CurrencyRecord,
  type StaffPaymentMethodRecord,
  PAYMENT_METHOD_OPTIONS,
  type PaymentAdapterType,
} from "./types"
import type { MaskedSecret } from "@/lib/payroll/mask-payment-method-config"
import { createEmptyMethodForm } from "./payrollUtils"
import { useFormSubmit } from "./useFormSubmit"

const CONFIG_FIELD_LABELS: Record<string, string> = {
  bankName: "Bank Name",
  routingNumber: "Routing Number",
  accountNumber: "Account Number",
  accountType: "Account Type",
  secretKey: "Secret Key",
  accountId: "Account ID",
  zelleId: "Zelle ID",
  venmoUser: "Venmo Username",
  publicKey: "Public Key",
  accessToken: "Access Token",
}

const isMaskedSecret = (value: unknown): value is MaskedSecret =>
  typeof value === "object" &&
  value !== null &&
  Object.hasOwn(value, "configured") &&
  Object.hasOwn(value, "preview")

type MethodFormState = ReturnType<typeof createEmptyMethodForm>

type Props = {
  methods: StaffPaymentMethodRecord[]
  currencies: CurrencyRecord[]
  loading: boolean
  setError: (msg: string | null) => void
  setSuccess: (msg: string | null) => void
  getLinkedModelNames: (methodId: string) => string[]
  onRefresh: () => Promise<void>
}

export function PaymentMethodsTab({
  methods,
  currencies,
  loading,
  setError,
  setSuccess,
  getLinkedModelNames,
  onRefresh,
}: Props) {
  const [showMethodForm, setShowMethodForm] = React.useState(false)
  const [methodForm, setMethodForm] = React.useState<MethodFormState>(() =>
    createEmptyMethodForm(),
  )

  const { saving: savingMethod, submit: submitMethodForm } = useFormSubmit(
    setError,
    setSuccess,
  )

  const submitMethod = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      let finalConfig: Record<string, unknown> = {}

      if (methodForm.adapterType === "direct_deposit") {
        finalConfig = {
          bankName: methodForm.bankName.trim(),
          routingNumber: methodForm.routingNumber.trim(),
          accountNumber: methodForm.accountNumber.trim(),
          accountType: methodForm.accountType,
        }
      } else if (methodForm.adapterType === "mercadopago") {
        finalConfig = {
          publicKey: methodForm.mpPublicKey.trim(),
          accessToken: methodForm.mpAccessToken.trim(),
        }
      } else if (methodForm.adapterType === "stripe") {
        finalConfig = {
          secretKey: methodForm.stripeSecretKey.trim(),
          accountId: methodForm.stripeAccountId.trim(),
        }
      } else if (methodForm.adapterType === "zelle") {
        finalConfig = {
          zelleId: methodForm.zelleId.trim(),
          venmoUser: methodForm.venmoUser.trim(),
        }
      } else if (
        methodForm.adapterType !== "cash" &&
        methodForm.adapterType !== "credits"
      ) {
        try {
          finalConfig = JSON.parse(methodForm.configJson) as Record<
            string,
            unknown
          >
        } catch {
          setError("Config JSON must be valid JSON.")
          return
        }
      }

      // Payload cleanliness: an empty-string field is a no-op server-side
      // (the write-only merge treats it identically to an absent key), but
      // omitting it here keeps the POST body free of noise fields.
      finalConfig = Object.fromEntries(
        Object.entries(finalConfig).filter(([, value]) => value !== ""),
      )

      await submitMethodForm(
        event,
        async () => {
          try {
            const res = await fetch("/api/staff/payroll/payment-methods", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: methodForm.name.trim(),
                adapterType: methodForm.adapterType,
                currency: methodForm.currency.trim().toUpperCase(),
                config: finalConfig,
              }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
              return {
                ok: false,
                error:
                  typeof data?.error === "string"
                    ? data.error
                    : "Unable to create payment method.",
              }
            }
            return { ok: true }
          } catch {
            return {
              ok: false,
              error: "Network error while creating payment method.",
            }
          }
        },
        async () => {
          setMethodForm(createEmptyMethodForm(currencies[0]?.code || "USD"))
          setShowMethodForm(false)
          await onRefresh()
        },
        "Payment method created.",
      )
    },
    [methodForm, currencies, submitMethodForm, setError, onRefresh],
  )

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)]">
      <div className="space-y-3">
        {loading ? (
          <div className="flex min-h-40 items-center justify-center rounded-xl border border-black/10 bg-white/65 text-sm text-black/60 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/60">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading payment
            methods...
          </div>
        ) : methods.length === 0 ? (
          <p className="rounded-xl border border-black/10 bg-white/65 px-4 py-6 text-sm text-black/60 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/60">
            No payment methods configured yet.
          </p>
        ) : (
          methods.map((method) => (
            <article
              key={method.id}
              className="rounded-xl border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-sm font-semibold text-black dark:text-white">
                      {method.name}
                    </h5>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${method.active ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300" : "border-zinc-500/35 bg-zinc-500/10 text-zinc-300"}`}
                    >
                      {method.active ? "Active" : "Inactive"}
                    </span>
                    {getLinkedModelNames(method.id).length > 0 ? (
                      <span className="rounded-full border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--brand,#ff4b4b)]">
                        Configured in payroll
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-black/60 dark:text-white/60">
                    Type:{" "}
                    <span className="font-semibold uppercase">
                      {method.adapterType.replace("_", " ")}
                    </span>{" "}
                    · Currency:{" "}
                    <span className="font-semibold">{method.currency}</span>
                  </p>
                  <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                    {getLinkedModelNames(method.id).length > 0
                      ? `Used by: ${getLinkedModelNames(method.id).join(", ")}`
                      : "Not assigned to any payment model yet."}
                  </p>
                </div>
                <CircleDollarSign className="h-4 w-4 text-[var(--brand,#ff4b4b)]" />
              </div>

              {method.adapterType !== "cash" &&
              method.adapterType !== "credits" ? (
                <div className="mt-3 grid gap-2 rounded-lg border border-black/10 bg-black/[0.03] p-3 text-[11px] text-black/70 dark:border-white/10 dark:bg-black/20 dark:text-white/70">
                  {Object.entries(method.configJson ?? {}).map(
                    ([key, value]) => {
                      const label = CONFIG_FIELD_LABELS[key] || key
                      const displayValue = isMaskedSecret(value)
                        ? value.configured
                          ? value.preview
                          : "Not configured"
                        : value === null || value === undefined
                          ? "—"
                          : String(value)

                      return (
                        <div
                          key={key}
                          className="flex min-w-0 items-start justify-between gap-3 border-b border-black/5 pb-1 last:border-0 last:pb-0 dark:border-white/5"
                        >
                          <span className="shrink-0 font-bold uppercase tracking-wider text-black/40 dark:text-white/40">
                            {label}
                          </span>
                          <span className="min-w-0 break-all text-right font-mono">
                            {displayValue}
                          </span>
                        </div>
                      )
                    },
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs italic text-black/40 dark:text-white/40">
                  No configuration required.
                </p>
              )}
            </article>
          ))
        )}
      </div>

      <div className="rounded-xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">
              Add method
            </p>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              Create a reusable dispatch adapter config.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMethodForm((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-md border border-black/15 px-3 py-2 text-sm font-semibold text-black/80 transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#ff4b4b)] dark:border-white/15 dark:text-white/80"
          >
            <Plus className="h-4 w-4" />
            {showMethodForm ? "Hide form" : "Add payment method"}
          </button>
        </div>

        {showMethodForm ? (
          <form onSubmit={submitMethod} className="mt-4 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                Method Name
              </label>
              <input
                value={methodForm.name}
                onChange={(event) =>
                  setMethodForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                placeholder="Method name (e.g. Chase ACH, Business MP)"
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                  Type
                </label>
                <select
                  value={methodForm.adapterType}
                  onChange={(event) =>
                    setMethodForm((prev) => ({
                      ...prev,
                      adapterType: event.target.value as PaymentAdapterType,
                    }))
                  }
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                >
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                  Currency
                </label>
                <select
                  value={methodForm.currency}
                  onChange={(event) =>
                    setMethodForm((prev) => ({
                      ...prev,
                      currency: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                  required
                >
                  {currencies.filter((c) => c.active).length > 0 ? (
                    currencies
                      .filter((c) => c.active)
                      .map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} ({c.symbol})
                        </option>
                      ))
                  ) : (
                    <>
                      <option value="USD">USD ($)</option>
                      <option value="ARS">ARS (ARS)</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {methodForm.adapterType === "direct_deposit" && (
              <div className="space-y-3 rounded-lg border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">
                  ACH Banking Details
                </p>
                <div className="space-y-1">
                  <label className="text-xs text-black/60 dark:text-white/60">
                    Bank Name
                  </label>
                  <input
                    value={methodForm.bankName}
                    onChange={(e) =>
                      setMethodForm((p) => ({ ...p, bankName: e.target.value }))
                    }
                    placeholder="e.g. Chase, TD Bank"
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-black/60 dark:text-white/60">
                      Routing Number
                    </label>
                    <input
                      value={methodForm.routingNumber}
                      onChange={(e) =>
                        setMethodForm((p) => ({
                          ...p,
                          routingNumber: e.target.value,
                        }))
                      }
                      placeholder="9 digits"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-black/60 dark:text-white/60">
                      Account Number
                    </label>
                    <input
                      value={methodForm.accountNumber}
                      onChange={(e) =>
                        setMethodForm((p) => ({
                          ...p,
                          accountNumber: e.target.value,
                        }))
                      }
                      placeholder="Account #"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {methodForm.adapterType === "stripe" && (
              <div className="space-y-3 rounded-lg border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">
                  Stripe Credentials
                </p>
                <div className="space-y-1">
                  <label className="text-xs text-black/60 dark:text-white/60">
                    Stripe Secret Key
                  </label>
                  <input
                    type="password"
                    value={methodForm.stripeSecretKey}
                    onChange={(e) =>
                      setMethodForm((p) => ({
                        ...p,
                        stripeSecretKey: e.target.value,
                      }))
                    }
                    placeholder="sk_live_..."
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-black/60 dark:text-white/60">
                    Account ID (Optional)
                  </label>
                  <input
                    value={methodForm.stripeAccountId}
                    onChange={(e) =>
                      setMethodForm((p) => ({
                        ...p,
                        stripeAccountId: e.target.value,
                      }))
                    }
                    placeholder="acct_..."
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                  />
                </div>
              </div>
            )}

            {methodForm.adapterType === "zelle" && (
              <div className="space-y-3 rounded-lg border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">
                  Zelle / Venmo Details
                </p>
                <div className="space-y-1">
                  <label className="text-xs text-black/60 dark:text-white/60">
                    Zelle ID (Email/Phone)
                  </label>
                  <input
                    value={methodForm.zelleId}
                    onChange={(e) =>
                      setMethodForm((p) => ({
                        ...p,
                        zelleId: e.target.value,
                      }))
                    }
                    placeholder="e.g. email@provider.com"
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-black/60 dark:text-white/60">
                    Venmo Username (Optional)
                  </label>
                  <input
                    value={methodForm.venmoUser}
                    onChange={(e) =>
                      setMethodForm((p) => ({
                        ...p,
                        venmoUser: e.target.value,
                      }))
                    }
                    placeholder="@username"
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                  />
                </div>
              </div>
            )}

            {methodForm.adapterType === "mercadopago" && (
              <div className="space-y-3 rounded-lg border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">
                  Mercado Pago Credentials
                </p>
                <div className="space-y-1">
                  <label className="text-xs text-black/60 dark:text-white/60">
                    Public Key
                  </label>
                  <input
                    value={methodForm.mpPublicKey}
                    onChange={(e) =>
                      setMethodForm((p) => ({
                        ...p,
                        mpPublicKey: e.target.value,
                      }))
                    }
                    placeholder="APP_USR-..."
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-black/60 dark:text-white/60">
                    Access Token
                  </label>
                  <input
                    type="password"
                    value={methodForm.mpAccessToken}
                    onChange={(e) =>
                      setMethodForm((p) => ({
                        ...p,
                        mpAccessToken: e.target.value,
                      }))
                    }
                    placeholder="APP_USR-..."
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    required
                  />
                </div>
              </div>
            )}

            {methodForm.adapterType !== "cash" &&
              methodForm.adapterType !== "credits" &&
              methodForm.adapterType !== "direct_deposit" &&
              methodForm.adapterType !== "stripe" &&
              methodForm.adapterType !== "zelle" &&
              methodForm.adapterType !== "mercadopago" && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                    Configuration JSON
                  </label>
                  <textarea
                    value={methodForm.configJson}
                    onChange={(event) =>
                      setMethodForm((prev) => ({
                        ...prev,
                        configJson: event.target.value,
                      }))
                    }
                    placeholder='{"key": "value"}'
                    className="min-h-32 w-full rounded-md border border-black/15 bg-white px-3 py-2 font-mono text-xs text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    required
                  />
                </div>
              )}

            {methodForm.adapterType === "cash" ||
            methodForm.adapterType === "credits" ? (
              <p className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-400">
                <Info className="h-4 w-4" /> No technical configuration
                required for this method.
              </p>
            ) : null}

            <button
              type="submit"
              disabled={savingMethod}
              className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
            >
              {savingMethod ? "Creating..." : "Create payment method"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  )
}
