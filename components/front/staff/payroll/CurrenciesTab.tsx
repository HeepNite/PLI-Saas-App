"use client"

import React from "react"
import { Coins, Loader2, Plus } from "lucide-react"
import { type CurrencyRecord } from "./types"
import { useFormSubmit } from "./useFormSubmit"

type Props = {
  currencies: CurrencyRecord[]
  loading: boolean
  setError: (msg: string | null) => void
  setSuccess: (msg: string | null) => void
  onRefresh: () => Promise<void>
}

export function CurrenciesTab({
  currencies,
  loading,
  setError,
  setSuccess,
  onRefresh,
}: Props) {
  const [showCurrencyForm, setShowCurrencyForm] = React.useState(false)
  const [currencyForm, setCurrencyForm] = React.useState({
    code: "",
    symbol: "",
    decimals: "2",
  })

  const { saving: savingCurrency, submit: submitCurrencyForm } = useFormSubmit(
    setError,
    setSuccess,
  )

  const submitCurrency = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      await submitCurrencyForm(
        event,
        async () => {
          try {
            const res = await fetch("/api/staff/payroll/currencies", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                code: currencyForm.code.trim().toUpperCase(),
                symbol:
                  currencyForm.symbol.trim() ||
                  currencyForm.code.trim().toUpperCase(),
                decimals: Number(currencyForm.decimals),
              }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
              return {
                ok: false,
                error:
                  typeof data?.error === "string"
                    ? data.error
                    : "Unable to create currency.",
              }
            }
            return { ok: true }
          } catch {
            return {
              ok: false,
              error: "Network error while creating currency.",
            }
          }
        },
        async () => {
          setCurrencyForm({ code: "", symbol: "", decimals: "2" })
          setShowCurrencyForm(false)
          await onRefresh()
        },
        "Currency created.",
      )
    },
    [currencyForm, submitCurrencyForm, onRefresh],
  )

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)]">
      <div className="space-y-3">
        {loading ? (
          <div className="flex min-h-40 items-center justify-center rounded-xl border border-black/10 bg-white/65 text-sm text-black/60 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/60">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
            currencies...
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
                      Decimals: {currency.decimals} · Status:{" "}
                      {currency.active ? "Active" : "Inactive"}
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
            <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-white/60">
              Add Currency
            </p>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              Register a new currency for the school.
            </p>
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
              <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                Currency Code
              </label>
              <input
                value={currencyForm.code}
                onChange={(event) =>
                  setCurrencyForm((prev) => ({
                    ...prev,
                    code: event.target.value.toUpperCase(),
                  }))
                }
                placeholder="e.g. USD, ARS, EUR"
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm uppercase text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                  Symbol
                </label>
                <input
                  value={currencyForm.symbol}
                  onChange={(event) =>
                    setCurrencyForm((prev) => ({
                      ...prev,
                      symbol: event.target.value,
                    }))
                  }
                  placeholder="e.g. $, U$S"
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-black/60 dark:text-white/60">
                  Decimals
                </label>
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={currencyForm.decimals}
                  onChange={(event) =>
                    setCurrencyForm((prev) => ({
                      ...prev,
                      decimals: event.target.value,
                    }))
                  }
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
  )
}
