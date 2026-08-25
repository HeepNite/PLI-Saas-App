"use client"

import React from "react"
import type { StudentsBoardTerminalAlertsProps } from "@/components/front/staff/studentsBoardTypes"
import {
  formatTerminalAlertDateTime,
  formatTerminalAlertRelative,
} from "@/components/front/staff/staffAdminFormatters"

export function TerminalPinAlertsStrip({
  prioritizedTerminalPinAlerts,
  hasAnyTerminalPinAlerts,
  nowTs,
}: StudentsBoardTerminalAlertsProps) {
  if (prioritizedTerminalPinAlerts.length === 0) return null
  const refreshIntervalSeconds = hasAnyTerminalPinAlerts ? 5 : 10

  return (
    <div className="mb-4 rounded-2xl border border-[var(--brand,#b61616)]/18 bg-[linear-gradient(145deg,rgba(182,22,22,0.08),rgba(17,20,31,0.92))] p-3 shadow-[0_14px_28px_-20px_rgba(0,0,0,0.65)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand,#b61616)]">
            Terminal alerts
          </span>
          <p className="text-sm text-black/70 dark:text-white/70">
            PIN issues needing attention from terminal flow.
          </p>
        </div>
        <p className="text-xs text-black/55 dark:text-white/55">
          Auto-refresh every {refreshIntervalSeconds}s
        </p>
      </div>
      <div className="mt-3 grid gap-2 xl:grid-cols-2">
        {prioritizedTerminalPinAlerts.map((alert) => (
          <div
            key={`${alert.terminalId}-${alert.severity}-${alert.blockedUntil || "open"}`}
            className={`rounded-xl border px-3 py-2 text-sm dark:bg-white/[0.04] ${
              alert.severity === "emergency"
                ? "border-[var(--brand,#b61616)]/30 bg-[var(--brand,#b61616)]/8"
                : alert.severity === "cooldown"
                  ? "border-amber-500/25 bg-amber-500/8"
                  : "border-yellow-500/20 bg-yellow-500/8"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-black dark:text-white">{alert.terminalName}</span>
                {alert.terminalLocation ? (
                  <span className="text-[11px] uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
                    {alert.terminalLocation}
                  </span>
                ) : null}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                  alert.severity === "emergency"
                    ? "bg-[var(--brand,#b61616)]/15 text-[var(--brand,#b61616)]"
                    : alert.severity === "cooldown"
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                      : "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300"
                }`}
              >
                {alert.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-black/60 dark:text-white/60">
              Misses: {alert.missCount}
              {alert.blockedUntil
                ? ` · ${formatTerminalAlertRelative(alert.blockedUntil, nowTs)}`
                : ""}
            </p>
            <p className="mt-1 text-sm text-black/75 dark:text-white/75">{alert.message}</p>
            {alert.blockedUntil ? (
              <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                Until {formatTerminalAlertDateTime(alert.blockedUntil)}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
