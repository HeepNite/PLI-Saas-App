"use client"

import React from "react"
import { RefreshCw } from "lucide-react"
import {
  type CurrencyRecord,
  type StaffPaymentMethodRecord,
  type StaffPaymentModelRecord,
} from "./types"
import { PaymentMethodsTab } from "./PaymentMethodsTab"
import { PaymentModelsTab } from "./PaymentModelsTab"
import { CurrenciesTab } from "./CurrenciesTab"

export default function StaffPaymentMethodConfigPanel() {
  const [activeTab, setActiveTab] = React.useState<
    "methods" | "models" | "currencies"
  >("methods")
  const [methods, setMethods] = React.useState<StaffPaymentMethodRecord[]>([])
  const [models, setModels] = React.useState<StaffPaymentModelRecord[]>([])
  const [currencies, setCurrencies] = React.useState<CurrencyRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const methodsById = React.useMemo(
    () => new Map(methods.map((method) => [method.id, method] as const)),
    [methods],
  )

  const modelNamesByMethodId = React.useMemo(() => {
    const nextMap = new Map<string, string[]>()
    for (const model of models) {
      if (!model.defaultPaymentMethodId) continue
      const modelNames = nextMap.get(model.defaultPaymentMethodId) ?? []
      modelNames.push(model.name)
      nextMap.set(model.defaultPaymentMethodId, modelNames)
    }
    return nextMap
  }, [models])

  const getLinkedModelNames = React.useCallback(
    (methodId: string) => modelNamesByMethodId.get(methodId) ?? [],
    [modelNamesByMethodId],
  )

  const getDefaultMethodName = React.useCallback(
    (model: StaffPaymentModelRecord) =>
      model.defaultPaymentMethod?.name ??
      (model.defaultPaymentMethodId
        ? methodsById.get(model.defaultPaymentMethodId)?.name
        : undefined) ??
      "Not set",
    [methodsById],
  )

  const fetchConfigData = React.useCallback(
    async (options?: { showLoader?: boolean }) => {
      const showLoader = options?.showLoader ?? true
      if (showLoader) setLoading(true)
      setError(null)

      try {
        const requestOptions = {
          headers: { "Content-Type": "application/json" },
          cache: "no-store" as const,
        }

        const loadSlice = async <T,>(
          url: string,
          options?: { toleratedStatuses?: number[]; fallbackItems?: T[] },
        ) => {
          try {
            const response = await fetch(url, requestOptions)
            const data = await response.json().catch(() => ({}))

            if (!response.ok) {
              if (options?.toleratedStatuses?.includes(response.status)) {
                return {
                  ok: true as const,
                  items: options.fallbackItems ?? [],
                }
              }
              return {
                ok: false as const,
                error:
                  typeof data?.error === "string" && data.error
                    ? data.error
                    : "Unable to load payroll configuration.",
              }
            }

            return {
              ok: true as const,
              items: Array.isArray(data?.items) ? (data.items as T[]) : null,
            }
          } catch {
            return {
              ok: false as const,
              error: "Network error while loading payroll configuration.",
            }
          }
        }

        const [methodsResult, modelsResult, currenciesResult] =
          await Promise.all([
            loadSlice<StaffPaymentMethodRecord>(
              "/api/staff/payroll/payment-methods",
            ),
            loadSlice<StaffPaymentModelRecord>(
              "/api/staff/payroll/payment-models",
            ),
            loadSlice<CurrencyRecord>("/api/staff/payroll/currencies"),
          ])

        if (methodsResult.ok && methodsResult.items)
          setMethods(methodsResult.items)
        if (modelsResult.ok && modelsResult.items)
          setModels(modelsResult.items)
        if (currenciesResult.ok && currenciesResult.items)
          setCurrencies(currenciesResult.items)

        const nextError = [methodsResult, modelsResult, currenciesResult].find(
          (result) => !result.ok,
        )
        if (nextError && !nextError.ok) {
          setError(nextError.error)
        }
      } catch {
        setError("Network error while loading payroll configuration.")
      } finally {
        if (showLoader) setLoading(false)
      }
    },
    [],
  )

  React.useEffect(() => {
    void fetchConfigData()
  }, [fetchConfigData])

  const handleRefresh = React.useCallback(async () => {
    await fetchConfigData({ showLoader: false })
  }, [fetchConfigData])

  return (
    <section className="mt-5 rounded-xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand,#b61616)]">
            Payroll config
          </p>
          <h4 className="mt-1 text-lg font-semibold text-black dark:text-white">
            Payment methods &amp; models
          </h4>
          <p className="text-sm text-black/60 dark:text-white/60">
            Configure school-level payroll defaults before assigning models to
            staff.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchConfigData({ showLoader: true })}
          className="inline-flex items-center gap-2 rounded-md border border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm font-semibold text-[var(--brand,#ff4b4b)] transition hover:bg-[var(--brand,#b61616)]/15"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing..." : "Refresh config"}
        </button>
      </header>

      <div className="mt-4 inline-flex flex-wrap rounded-xl border border-black/10 bg-white/70 p-1 dark:border-white/10 dark:bg-white/[0.03]">
        {(
          [
            ["methods", "Payment Methods"],
            ["models", "Payment Models"],
            ["currencies", "Currencies"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setActiveTab(key)
              setError(null)
              setSuccess(null)
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              activeTab === key
                ? "bg-[var(--brand,#b61616)] text-white"
                : "text-black/70 hover:text-[var(--brand,#b61616)] dark:text-white/70 dark:hover:text-[var(--brand,#ff4b4b)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-3 py-2 text-sm text-[var(--brand,#ff4b4b)]">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-4 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {success}
        </p>
      ) : null}

      {activeTab === "methods" ? (
        <PaymentMethodsTab
          methods={methods}
          currencies={currencies}
          loading={loading}
          setError={setError}
          setSuccess={setSuccess}
          getLinkedModelNames={getLinkedModelNames}
          onRefresh={handleRefresh}
        />
      ) : activeTab === "models" ? (
        <PaymentModelsTab
          models={models}
          methods={methods}
          currencies={currencies}
          loading={loading}
          setError={setError}
          setSuccess={setSuccess}
          getDefaultMethodName={getDefaultMethodName}
          onRefresh={handleRefresh}
        />
      ) : activeTab === "currencies" ? (
        <CurrenciesTab
          currencies={currencies}
          loading={loading}
          setError={setError}
          setSuccess={setSuccess}
          onRefresh={handleRefresh}
        />
      ) : null}
    </section>
  )
}
