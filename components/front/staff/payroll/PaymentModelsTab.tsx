"use client"

import React from "react"
import { CheckCircle2, Info, Loader2, Plus } from "lucide-react"
import {
  type CurrencyRecord,
  type StaffPaymentMethodRecord,
  type StaffPaymentModelRecord,
  WEEKDAY_OPTIONS,
} from "./types"
import { formatMoney, formatHourlyRate } from "./payrollUtils"
import { useFormSubmit } from "./useFormSubmit"

type ModelFormState = {
  name: string
  type: "per_hour" | "per_percentage" | "hybrid"
  hourlyRate: string
  percentageRate: string
  currency: string
  paydayWeekday: string
  creditCapCents: string
  defaultPaymentMethodId: string
  isDefault: boolean
}

type Props = {
  models: StaffPaymentModelRecord[]
  methods: StaffPaymentMethodRecord[]
  currencies: CurrencyRecord[]
  loading: boolean
  setError: (msg: string | null) => void
  setSuccess: (msg: string | null) => void
  getDefaultMethodName: (model: StaffPaymentModelRecord) => string
  onRefresh: () => Promise<void>
}

export function PaymentModelsTab({
  models,
  methods,
  currencies,
  loading,
  setError,
  setSuccess,
  getDefaultMethodName,
  onRefresh,
}: Props) {
  const [showModelForm, setShowModelForm] = React.useState(false)
  const [defaultBusyId, setDefaultBusyId] = React.useState<string | null>(null)
  const [modelForm, setModelForm] = React.useState<ModelFormState>({
    name: "",
    type: "per_hour",
    hourlyRate: "",
    percentageRate: "",
    currency: "USD",
    paydayWeekday: "5",
    creditCapCents: "0",
    defaultPaymentMethodId: "",
    isDefault: false,
  })

  const { saving: savingModel, submit: submitModelForm } = useFormSubmit(
    setError,
    setSuccess,
  )

  const isHybridModel = modelForm.type === "hybrid"

  const submitModel = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      await submitModelForm(
        event,
        async () => {
          try {
            const res = await fetch("/api/staff/payroll/payment-models", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: modelForm.name.trim(),
                type: modelForm.type,
                hourlyRate:
                  modelForm.type === "per_percentage"
                    ? 0
                    : Number(modelForm.hourlyRate),
                ...(modelForm.type !== "per_hour" &&
                  modelForm.percentageRate !== "" && {
                    percentageRate: Number(modelForm.percentageRate),
                  }),
                currency: modelForm.currency.trim().toUpperCase(),
                paydayWeekday: Number(modelForm.paydayWeekday),
                creditCapCents: Number(modelForm.creditCapCents),
                defaultPaymentMethodId:
                  modelForm.defaultPaymentMethodId || null,
                isDefault: modelForm.isDefault,
              }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
              return {
                ok: false,
                error:
                  typeof data?.error === "string"
                    ? data.error
                    : "Unable to create payment model.",
              }
            }
            return { ok: true }
          } catch {
            return {
              ok: false,
              error: "Network error while creating payment model.",
            }
          }
        },
        async () => {
          setModelForm((prev) => ({
            ...prev,
            name: "",
            type: "per_hour" as const,
            hourlyRate: "",
            percentageRate: "",
            creditCapCents: "0",
            isDefault: false,
          }))
          setShowModelForm(false)
          await onRefresh()
        },
        "Payment model created.",
      )
    },
    [modelForm, submitModelForm, onRefresh],
  )

  const setModelAsDefault = React.useCallback(
    async (modelId: string) => {
      setDefaultBusyId(modelId)
      setError(null)
      setSuccess(null)

      try {
        const res = await fetch(
          `/api/staff/payroll/payment-models/${modelId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isDefault: true }),
          },
        )
        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          setError(
            typeof data?.error === "string"
              ? data.error
              : "Unable to update default payment model.",
          )
          return
        }

        setSuccess("Default payment model updated.")
        await onRefresh()
      } catch {
        setError("Network error while updating the default payment model.")
      } finally {
        setDefaultBusyId(null)
      }
    },
    [onRefresh, setError, setSuccess],
  )

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)]">
      <div className="space-y-3">
        {loading ? (
          <div className="flex min-h-40 items-center justify-center rounded-xl border border-black/10 bg-white/65 text-sm text-black/60 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/60">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading payment
            models...
          </div>
        ) : models.length === 0 ? (
          <p className="rounded-xl border border-black/10 bg-white/65 px-4 py-6 text-sm text-black/60 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/60">
            No payment models configured yet.
          </p>
        ) : (
          models.map((model) => (
            <article
              key={model.id}
              className="rounded-xl border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-sm font-semibold text-black dark:text-white">
                      {model.name}
                    </h5>
                    {model.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> Default
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-black/60 dark:text-white/60">
                    Hourly rate:{" "}
                    <span className="font-semibold">
                      {formatHourlyRate(model.hourlyRate, model.currency)}
                    </span>{" "}
                    · Payday:{" "}
                    <span className="font-semibold">
                      {WEEKDAY_OPTIONS.find(
                        (item) => item.value === model.paydayWeekday,
                      )?.label ?? "—"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-black/60 dark:text-white/60">
                    Credit cap:{" "}
                    <span className="font-semibold">
                      {formatMoney(model.creditCapCents, model.currency)}
                    </span>{" "}
                    · Default method:{" "}
                    <span className="font-semibold">
                      {getDefaultMethodName(model)}
                    </span>
                  </p>
                </div>

                {model.isDefault ? null : (
                  <button
                    type="button"
                    disabled={defaultBusyId === model.id}
                    onClick={() => void setModelAsDefault(model.id)}
                    className="inline-flex items-center gap-2 rounded-md border border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-xs font-semibold text-[var(--brand,#ff4b4b)] transition disabled:opacity-60"
                  >
                    {defaultBusyId === model.id ? "Updating..." : "Set as Default"}
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      <div className="rounded-xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">
              Add model
            </p>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              Define rate, cadence, cap, and default method.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowModelForm((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-md border border-black/15 px-3 py-2 text-sm font-semibold text-black/80 transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#ff4b4b)] dark:border-white/15 dark:text-white/80"
          >
            <Plus className="h-4 w-4" />
            {showModelForm ? "Hide form" : "Add payment model"}
          </button>
        </div>

        {showModelForm ? (
          <form onSubmit={submitModel} className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                  Model Name
                </label>
                <input
                  value={modelForm.name}
                  onChange={(event) =>
                    setModelForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Model name (e.g. Standard Teacher)"
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                  Payment Type
                </label>
                <select
                  value={modelForm.type}
                  onChange={(event) => {
                    const nextType = event.target.value as
                      | "per_hour"
                      | "per_percentage"
                      | "hybrid"
                    setModelForm((prev) => {
                      const nextState = { ...prev, type: nextType }
                      if (nextType === "per_percentage") {
                        return { ...nextState, hourlyRate: "0" }
                      }
                      if (
                        prev.type === "per_percentage" &&
                        (prev.hourlyRate === "0" || prev.hourlyRate === "")
                      ) {
                        return { ...nextState, hourlyRate: "" }
                      }
                      return nextState
                    })
                  }}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                >
                  <option value="per_hour">Per Hour</option>
                  <option value="per_percentage">Percentage of Revenue</option>
                  <option value="hybrid">Hybrid (Hours + Percentage)</option>
                </select>
              </div>
            </div>

            <div
              className={`grid gap-3 ${isHybridModel ? "sm:grid-cols-3" : "sm:grid-cols-2"} lg:grid-cols-3`}
            >
              {modelForm.type !== "per_percentage" ? (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                    Hourly Rate
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={modelForm.hourlyRate}
                    onChange={(event) =>
                      setModelForm((prev) => ({
                        ...prev,
                        hourlyRate: event.target.value,
                      }))
                    }
                    placeholder="e.g. 1500"
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    required
                  />
                </div>
              ) : null}

              {modelForm.type !== "per_hour" && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                    Percentage Rate (0-1)
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    max="1"
                    step="0.01"
                    value={modelForm.percentageRate}
                    onChange={(event) =>
                      setModelForm((prev) => ({
                        ...prev,
                        percentageRate: event.target.value,
                      }))
                    }
                    placeholder="e.g. 0.40 for 40%"
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    required
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                  Currency
                </label>
                <select
                  value={modelForm.currency}
                  onChange={(event) =>
                    setModelForm((prev) => ({
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

            <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.3fr] lg:grid-cols-[1fr_1fr_1.5fr]">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                  Payday (Weekly cadence)
                </label>
                <select
                  value={modelForm.paydayWeekday}
                  onChange={(event) =>
                    setModelForm((prev) => ({
                      ...prev,
                      paydayWeekday: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                >
                  {WEEKDAY_OPTIONS.map((option) => (
                    <option key={option.value} value={String(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                  Credit Cap (Cents)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={modelForm.creditCapCents}
                  onChange={(event) =>
                    setModelForm((prev) => ({
                      ...prev,
                      creditCapCents: event.target.value,
                    }))
                  }
                  placeholder="e.g. 5000"
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                  Default Payment Method
                </label>
                <select
                  value={modelForm.defaultPaymentMethodId}
                  onChange={(event) =>
                    setModelForm((prev) => ({
                      ...prev,
                      defaultPaymentMethodId: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                >
                  <option value="">No default payment method</option>
                  {methods
                    .filter((method) => method.active)
                    .map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name} · {method.currency}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white/60 px-3 py-2 text-xs text-black/75 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/75">
                <input
                  type="checkbox"
                  checked={modelForm.isDefault}
                  onChange={(event) =>
                    setModelForm((prev) => ({
                      ...prev,
                      isDefault: event.target.checked,
                    }))
                  }
                />
                Set as default on create
              </label>
              <p className="text-[10px] text-black/50 dark:text-white/50">
                <Info className="mr-1 inline h-3 w-3" /> Only one model can be
                the default for the school.
              </p>
            </div>

            <button
              type="submit"
              disabled={savingModel}
              className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
            >
              {savingModel ? "Creating..." : "Create payment model"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  )
}
