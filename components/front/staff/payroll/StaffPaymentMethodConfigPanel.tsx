"use client"

import React from "react"
import { CheckCircle2, CircleDollarSign, Coins, Info, Loader2, Plus, RefreshCw } from "lucide-react"

type CurrencyRecord = {
  id: string
  code: string
  symbol: string
  decimals: number
  active: boolean
}

type StaffPaymentMethodRecord = {
  id: string
  name: string
  adapterType: string
  currency: string
  active: boolean
  configJson: unknown
}

type StaffPaymentModelRecord = {
  id: string
  name: string
  hourlyRate: number
  currency: string
  paydayWeekday: number
  creditCapCents: number
  defaultPaymentMethodId: string | null
  isDefault: boolean
  active: boolean
  defaultPaymentMethod?: StaffPaymentMethodRecord | null
}

const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "direct_deposit", label: "Direct Deposit (ACH)" },
  { value: "mercadopago", label: "Mercado Pago" },
  { value: "stripe", label: "Stripe Payouts" },
  { value: "zelle", label: "Zelle / Venmo" },
  { value: "credits", label: "Internal Credits" },
] as const

type PaymentAdapterType = (typeof PAYMENT_METHOD_OPTIONS)[number]["value"]

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const

const formatMoney = (amountCents: number, currency: string) => {
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

const formatHourlyRate = (hourlyRate: number, currency: string) => {
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

const createEmptyMethodForm = (defaultCurrency = "USD") => ({
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

export default function StaffPaymentMethodConfigPanel() {
  const [activeTab, setActiveTab] = React.useState<"methods" | "models" | "currencies">("methods")
  const [methods, setMethods] = React.useState<StaffPaymentMethodRecord[]>([])
  const [models, setModels] = React.useState<StaffPaymentModelRecord[]>([])
  const [currencies, setCurrencies] = React.useState<CurrencyRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  
  const [showMethodForm, setShowMethodForm] = React.useState(false)
  const [showModelForm, setShowModelForm] = React.useState(false)
  const [showCurrencyForm, setShowCurrencyForm] = React.useState(false)
  
  const [savingMethod, setSavingMethod] = React.useState(false)
  const [savingModel, setSavingModel] = React.useState(false)
  const [savingCurrency, setSavingCurrency] = React.useState(false)
  
  const [defaultBusyId, setDefaultBusyId] = React.useState<string | null>(null)
  
  const [methodForm, setMethodForm] = React.useState(() => createEmptyMethodForm())
  
  const [modelForm, setModelForm] = React.useState({
    name: "",
    type: "per_hour" as "per_hour" | "per_percentage" | "hybrid",
    hourlyRate: "",
    percentageRate: "",
    currency: "USD",
    paydayWeekday: "5",
    creditCapCents: "0",
    defaultPaymentMethodId: "",
    isDefault: false,
  })

  const [currencyForm, setCurrencyForm] = React.useState({
    code: "",
    symbol: "",
    decimals: "2",
  })
  const isHybridModel = modelForm.type === "hybrid"
  const methodsById = React.useMemo(
    () => new Map(methods.map((method) => [method.id, method] as const)),
    [methods]
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
    [modelNamesByMethodId]
  )
  const getDefaultMethodName = React.useCallback(
    (model: StaffPaymentModelRecord) =>
      model.defaultPaymentMethod?.name ??
      (model.defaultPaymentMethodId ? methodsById.get(model.defaultPaymentMethodId)?.name : undefined) ??
      "Not set",
    [methodsById]
  )

  const fetchConfigData = React.useCallback(async (options?: { showLoader?: boolean }) => {
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
        options?: { toleratedStatuses?: number[]; fallbackItems?: T[] }
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

      const [methodsResult, modelsResult, currenciesResult] = await Promise.all([
        loadSlice<StaffPaymentMethodRecord>("/api/staff/payroll/payment-methods"),
        loadSlice<StaffPaymentModelRecord>("/api/staff/payroll/payment-models"),
        loadSlice<CurrencyRecord>("/api/staff/payroll/currencies"),
      ])

      if (methodsResult.ok && methodsResult.items) setMethods(methodsResult.items)
      if (modelsResult.ok && modelsResult.items) setModels(modelsResult.items)
      if (currenciesResult.ok && currenciesResult.items) setCurrencies(currenciesResult.items)

      const nextError = [methodsResult, modelsResult, currenciesResult].find(
        (result) => !result.ok
      )

      if (nextError && !nextError.ok) {
        setError(nextError.error)
      }
    } catch {
      setError("Network error while loading payroll configuration.")
    } finally {
      if (showLoader) setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchConfigData()
  }, [fetchConfigData])

  const submitMethod = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingMethod(true)
    setError(null)
    setSuccess(null)

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
    } else if (methodForm.adapterType !== "cash" && methodForm.adapterType !== "credits") {
      try {
        finalConfig = JSON.parse(methodForm.configJson) as Record<string, unknown>
      } catch {
        setError("Config JSON must be valid JSON.")
        setSavingMethod(false)
        return
      }
    }

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
        setError(typeof data?.error === "string" ? data.error : "Unable to create payment method.")
        return
      }

      setMethodForm(createEmptyMethodForm(currencies[0]?.code || "USD"))
      setShowMethodForm(false)
      setSuccess("Payment method created.")
      await fetchConfigData({ showLoader: false })
    } catch {
      setError("Network error while creating payment method.")
    } finally {
      setSavingMethod(false)
    }
  }, [fetchConfigData, methodForm, currencies])

  const submitModel = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingModel(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/staff/payroll/payment-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: modelForm.name.trim(),
          type: modelForm.type,
          hourlyRate: modelForm.type === "per_percentage" ? 0 : Number(modelForm.hourlyRate),
          ...(modelForm.type !== "per_hour" && modelForm.percentageRate !== "" && {
            percentageRate: Number(modelForm.percentageRate),
          }),
          currency: modelForm.currency.trim().toUpperCase(),
          paydayWeekday: Number(modelForm.paydayWeekday),
          creditCapCents: Number(modelForm.creditCapCents),
          defaultPaymentMethodId: modelForm.defaultPaymentMethodId || null,
          isDefault: modelForm.isDefault,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Unable to create payment model.")
        return
      }

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
      setSuccess("Payment model created.")
      await fetchConfigData({ showLoader: false })
    } catch {
      setError("Network error while creating payment model.")
    } finally {
      setSavingModel(false)
    }
  }, [fetchConfigData, modelForm])

  const submitCurrency = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingCurrency(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/staff/payroll/currencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: currencyForm.code.trim().toUpperCase(),
          symbol: currencyForm.symbol.trim() || currencyForm.code.trim().toUpperCase(),
          decimals: Number(currencyForm.decimals),
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Unable to create currency.")
        return
      }

      setCurrencyForm({
        code: "",
        symbol: "",
        decimals: "2",
      })
      setShowCurrencyForm(false)
      setSuccess("Currency created.")
      await fetchConfigData({ showLoader: false })
    } catch {
      setError("Network error while creating currency.")
    } finally {
      setSavingCurrency(false)
    }
  }, [fetchConfigData, currencyForm])

  const setModelAsDefault = React.useCallback(async (modelId: string) => {
    setDefaultBusyId(modelId)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/staff/payroll/payment-models/${modelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Unable to update default payment model.")
        return
      }

      setSuccess("Default payment model updated.")
      await fetchConfigData({ showLoader: false })
    } catch {
      setError("Network error while updating the default payment model.")
    } finally {
      setDefaultBusyId(null)
    }
  }, [fetchConfigData])

  return (
    <section className="mt-5 rounded-xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand,#b61616)]">Payroll config</p>
          <h4 className="mt-1 text-lg font-semibold text-black dark:text-white">Payment methods & models</h4>
          <p className="text-sm text-black/60 dark:text-white/60">
            Configure school-level payroll defaults before assigning models to staff.
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
        {([
          ["methods", "Payment Methods"],
          ["models", "Payment Models"],
          ["currencies", "Currencies"],
        ] as const).map(([key, label]) => (
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
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)]">
          <div className="space-y-3">
            {loading ? (
              <div className="flex min-h-40 items-center justify-center rounded-xl border border-black/10 bg-white/65 text-sm text-black/60 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/60">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading payment methods...
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
                        <h5 className="text-sm font-semibold text-black dark:text-white">{method.name}</h5>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${method.active ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300" : "border-zinc-500/35 bg-zinc-500/10 text-zinc-300"}`}>
                          {method.active ? "Active" : "Inactive"}
                        </span>
                        {getLinkedModelNames(method.id).length > 0 ? (
                          <span className="rounded-full border border-[var(--brand,#b61616)]/35 bg-[var(--brand,#b61616)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--brand,#ff4b4b)]">
                            Configured in payroll
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-black/60 dark:text-white/60">
                        Type: <span className="font-semibold uppercase">{method.adapterType.replace("_", " ")}</span> · Currency: <span className="font-semibold">{method.currency}</span>
                      </p>
                      <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                        {getLinkedModelNames(method.id).length > 0
                          ? `Used by: ${getLinkedModelNames(method.id).join(", ")}`
                          : "Not assigned to any payment model yet."}
                      </p>
                    </div>
                    <CircleDollarSign className="h-4 w-4 text-[var(--brand,#ff4b4b)]" />
                  </div>

                  {method.adapterType !== "cash" && method.adapterType !== "credits" ? (
                    <div className="mt-3 grid gap-2 rounded-lg border border-black/10 bg-black/[0.03] p-3 text-[11px] text-black/70 dark:border-white/10 dark:bg-black/20 dark:text-white/70">
                      {Object.entries((method.configJson as Record<string, string>) ?? {}).map(([key, value]) => {
                        const label = {
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
                        }[key] || key

                        const lowKey = key.toLowerCase()
                        let displayValue = String(value)

                        if (lowKey.includes("secret") || lowKey.includes("token")) {
                          displayValue = "••••••••••••••••"
                        } else if (lowKey.includes("number") || lowKey === "cbu") {
                          const str = String(value)
                          displayValue = str.length > 3 ? `•••• ${str.slice(-3)}` : str
                        }

                        return (
                          <div key={key} className="flex min-w-0 items-start justify-between gap-3 border-b border-black/5 pb-1 last:border-0 last:pb-0 dark:border-white/5">
                            <span className="shrink-0 font-bold uppercase tracking-wider text-black/40 dark:text-white/40">{label}</span>
                            <span className="min-w-0 break-all text-right font-mono">{displayValue}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs italic text-black/40 dark:text-white/40">No configuration required.</p>
                  )}
                </article>
              ))
            )}
          </div>

          <div className="rounded-xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Add method</p>
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">Create a reusable dispatch adapter config.</p>
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
                  <label className="text-xs font-semibold text-black/60 dark:text-white/60">Method Name</label>
                  <input
                    value={methodForm.name}
                    onChange={(event) => setMethodForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Method name (e.g. Chase ACH, Business MP)"
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    required
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-black/60 dark:text-white/60">Type</label>
                    <select
                      value={methodForm.adapterType}
                      onChange={(event) =>
                        setMethodForm((prev) => ({ ...prev, adapterType: event.target.value as PaymentAdapterType }))
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
                    <label className="text-xs font-semibold text-black/60 dark:text-white/60">Currency</label>
                    <select
                      value={methodForm.currency}
                      onChange={(event) => setMethodForm((prev) => ({ ...prev, currency: event.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    >
                      {currencies.filter(c => c.active).length > 0 ? (
                        currencies.filter(c => c.active).map((c) => (
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
                    <p className="text-[11px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">ACH Banking Details</p>
                    <div className="space-y-1">
                      <label className="text-xs text-black/60 dark:text-white/60">Bank Name</label>
                      <input
                        value={methodForm.bankName}
                        onChange={(e) => setMethodForm(p => ({ ...p, bankName: e.target.value }))}
                        placeholder="e.g. Chase, TD Bank"
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        required
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-black/60 dark:text-white/60">Routing Number</label>
                        <input
                          value={methodForm.routingNumber}
                          onChange={(e) => setMethodForm(p => ({ ...p, routingNumber: e.target.value }))}
                          placeholder="9 digits"
                          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-black/60 dark:text-white/60">Account Number</label>
                        <input
                          value={methodForm.accountNumber}
                          onChange={(e) => setMethodForm(p => ({ ...p, accountNumber: e.target.value }))}
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
                    <p className="text-[11px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">Stripe Credentials</p>
                    <div className="space-y-1">
                      <label className="text-xs text-black/60 dark:text-white/60">Stripe Secret Key</label>
                      <input
                        type="password"
                        value={methodForm.stripeSecretKey}
                        onChange={(e) => setMethodForm(p => ({ ...p, stripeSecretKey: e.target.value }))}
                        placeholder="sk_live_..."
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-black/60 dark:text-white/60">Account ID (Optional)</label>
                      <input
                        value={methodForm.stripeAccountId}
                        onChange={(e) => setMethodForm(p => ({ ...p, stripeAccountId: e.target.value }))}
                        placeholder="acct_..."
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {methodForm.adapterType === "zelle" && (
                  <div className="space-y-3 rounded-lg border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">Zelle / Venmo Details</p>
                    <div className="space-y-1">
                      <label className="text-xs text-black/60 dark:text-white/60">Zelle ID (Email/Phone)</label>
                      <input
                        value={methodForm.zelleId}
                        onChange={(e) => setMethodForm(p => ({ ...p, zelleId: e.target.value }))}
                        placeholder="e.g. email@provider.com"
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-black/60 dark:text-white/60">Venmo Username (Optional)</label>
                      <input
                        value={methodForm.venmoUser}
                        onChange={(e) => setMethodForm(p => ({ ...p, venmoUser: e.target.value }))}
                        placeholder="@username"
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {methodForm.adapterType === "mercadopago" && (
                  <div className="space-y-3 rounded-lg border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">Mercado Pago Credentials</p>
                    <div className="space-y-1">
                      <label className="text-xs text-black/60 dark:text-white/60">Public Key</label>
                      <input
                        value={methodForm.mpPublicKey}
                        onChange={(e) => setMethodForm(p => ({ ...p, mpPublicKey: e.target.value }))}
                        placeholder="APP_USR-..."
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-black/60 dark:text-white/60">Access Token</label>
                      <input
                        type="password"
                        value={methodForm.mpAccessToken}
                        onChange={(e) => setMethodForm(p => ({ ...p, mpAccessToken: e.target.value }))}
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
                      onChange={(event) => setMethodForm((prev) => ({ ...prev, configJson: event.target.value }))}
                      placeholder='{"key": "value"}'
                      className="min-h-32 w-full rounded-md border border-black/15 bg-white px-3 py-2 font-mono text-xs text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    />
                  </div>
                )}

                {methodForm.adapterType === "cash" || methodForm.adapterType === "credits" ? (
                  <p className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-400">
                    <Info className="h-4 w-4" /> No technical configuration required for this method.
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
      ) : activeTab === "models" ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)]">
          <div className="space-y-3">
            {loading ? (
              <div className="flex min-h-40 items-center justify-center rounded-xl border border-black/10 bg-white/65 text-sm text-black/60 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/60">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading payment models...
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
                        <h5 className="text-sm font-semibold text-black dark:text-white">{model.name}</h5>
                        {model.isDefault ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Default
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-black/60 dark:text-white/60">
                        Hourly rate: <span className="font-semibold">{formatHourlyRate(model.hourlyRate, model.currency)}</span> · Payday: <span className="font-semibold">{WEEKDAY_OPTIONS.find((item) => item.value === model.paydayWeekday)?.label ?? "—"}</span>
                      </p>
                      <p className="mt-1 text-xs text-black/60 dark:text-white/60">
                        Credit cap: <span className="font-semibold">{formatMoney(model.creditCapCents, model.currency)}</span> · Default method: <span className="font-semibold">{getDefaultMethodName(model)}</span>
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
                <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Add model</p>
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">Define rate, cadence, cap, and default method.</p>
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
                    <label className="text-xs font-semibold text-black/60 dark:text-white/60">Model Name</label>
                    <input
                      value={modelForm.name}
                      onChange={(event) => setModelForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Model name (e.g. Standard Teacher)"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-black/60 dark:text-white/60">Payment Type</label>
                    <select
                      value={modelForm.type}
                      onChange={(event) => {
                        const nextType = event.target.value as "per_hour" | "per_percentage" | "hybrid"
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

                <div className={`grid gap-3 ${isHybridModel ? "sm:grid-cols-3" : "sm:grid-cols-2"} lg:grid-cols-3`}>
                  {modelForm.type !== "per_percentage" ? (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-black/60 dark:text-white/60">Hourly Rate</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={modelForm.hourlyRate}
                        onChange={(event) => setModelForm((prev) => ({ ...prev, hourlyRate: event.target.value }))}
                        placeholder="e.g. 1500"
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        required
                      />
                    </div>
                  ) : null}

                  {modelForm.type !== "per_hour" && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-black/60 dark:text-white/60">Percentage Rate (0-1)</label>
                      <input
                        type="number"
                        min="0.01"
                        max="1"
                        step="0.01"
                        value={modelForm.percentageRate}
                        onChange={(event) => setModelForm((prev) => ({ ...prev, percentageRate: event.target.value }))}
                        placeholder="e.g. 0.40 for 40%"
                        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                        required
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-black/60 dark:text-white/60">Currency</label>
                    <select
                      value={modelForm.currency}
                      onChange={(event) => setModelForm((prev) => ({ ...prev, currency: event.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    >
                      {currencies.filter(c => c.active).length > 0 ? (
                        currencies.filter(c => c.active).map((c) => (
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
                    <label className="text-xs font-semibold text-black/60 dark:text-white/60">Payday (Weekly cadence)</label>
                    <select
                      value={modelForm.paydayWeekday}
                      onChange={(event) => setModelForm((prev) => ({ ...prev, paydayWeekday: event.target.value }))}
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
                    <label className="text-xs font-semibold text-black/60 dark:text-white/60">Credit Cap (Cents)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={modelForm.creditCapCents}
                      onChange={(event) => setModelForm((prev) => ({ ...prev, creditCapCents: event.target.value }))}
                      placeholder="e.g. 5000"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-black/60 dark:text-white/60">Default Payment Method</label>
                    <select
                      value={modelForm.defaultPaymentMethodId}
                      onChange={(event) => setModelForm((prev) => ({ ...prev, defaultPaymentMethodId: event.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    >
                      <option value="">No default payment method</option>
                      {methods.filter((method) => method.active).map((method) => (
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
                      onChange={(event) => setModelForm((prev) => ({ ...prev, isDefault: event.target.checked }))}
                    />
                    Set as default on create
                  </label>
                  <p className="text-[10px] text-black/50 dark:text-white/50">
                    <Info className="h-3 w-3 inline mr-1" /> Only one model can be the default for the school.
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
      ) : activeTab === "currencies" ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)]">
          <div className="space-y-3">
            {loading ? (
              <div className="flex min-h-40 items-center justify-center rounded-xl border border-black/10 bg-white/65 text-sm text-black/60 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/60">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading currencies...
              </div>
            ) : currencies.length === 0 ? (
              <p className="rounded-xl border border-black/10 bg-white/65 px-4 py-6 text-sm text-black/60 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/60">
                No currencies configured yet.
              </p>
            ) : (
              currencies.map((currency) => (
                <article
                  key={currency.id}
                  className="rounded-xl border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand,#b61616)]/10 text-[var(--brand,#ff4b4b)]">
                        <Coins className="h-5 w-5" />
                      </div>
                      <div>
                        <h5 className="text-sm font-semibold text-black dark:text-white">
                          {currency.code} ({currency.symbol})
                        </h5>
                        <p className="text-xs text-black/60 dark:text-white/60">
                          Decimals: {currency.decimals} · Status: {currency.active ? "Active" : "Inactive"}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="rounded-xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">Add Currency</p>
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">Register a new currency for the school.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCurrencyForm((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-md border border-black/15 px-3 py-2 text-sm font-semibold text-black/80 transition hover:border-[var(--brand,#b61616)] hover:text-[var(--brand,#ff4b4b)] dark:border-white/15 dark:text-white/80"
              >
                <Plus className="h-4 w-4" />
                {showCurrencyForm ? "Hide form" : "Add currency"}
              </button>
            </div>

            {showCurrencyForm ? (
              <form onSubmit={submitCurrency} className="mt-4 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-black/60 dark:text-white/60">Currency Code</label>
                  <input
                    value={currencyForm.code}
                    onChange={(event) => setCurrencyForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                    placeholder="e.g. USD, ARS, EUR"
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black uppercase outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                    required
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-black/60 dark:text-white/60">Symbol</label>
                    <input
                      value={currencyForm.symbol}
                      onChange={(event) => setCurrencyForm((prev) => ({ ...prev, symbol: event.target.value }))}
                      placeholder="e.g. $, U$S"
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-black/60 dark:text-white/60">Decimals</label>
                    <input
                      type="number"
                      min="0"
                      max="4"
                      value={currencyForm.decimals}
                      onChange={(event) => setCurrencyForm((prev) => ({ ...prev, decimals: event.target.value }))}
                      className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingCurrency}
                  className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
                >
                  {savingCurrency ? "Creating..." : "Create currency"}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
