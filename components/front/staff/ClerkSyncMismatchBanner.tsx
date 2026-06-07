"use client"

import React from "react"
import { RefreshCw, AlertTriangle } from "lucide-react"

type ClerkSyncMismatch = {
  userId: string
  clerkId: string
  email: string | null
  fields: Array<"name" | "email" | "phone">
  clerk: { name: string | null; email: string | null; phone: string | null }
  db: { name: string | null; email: string | null; phone: string | null }
}

type Props = {
  mismatch: ClerkSyncMismatch
  busy: boolean
  onSync: () => void
}

const fieldLabel: Record<"name" | "email" | "phone", string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
}

export function ClerkSyncMismatchBanner({ mismatch, busy, onSync }: Props) {
  const phoneOnly = mismatch.fields.length === 1 && mismatch.fields[0] === "phone"
  const syncableFields = mismatch.fields.filter((f) => f !== "phone")
  const hasPhoneMismatch = mismatch.fields.includes("phone")

  return (
    <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[12px] text-amber-100">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-200">Identity mismatch with Clerk</p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-amber-100/85">
            {mismatch.fields.map((f) => (
              <li key={f} className="truncate">
                <span className="font-semibold">{fieldLabel[f]}</span>: DB <span className="text-white/80">{mismatch.db[f] || "—"}</span> → Clerk <span className="text-white/80">{mismatch.clerk[f] || "—"}</span>
              </li>
            ))}
          </ul>
          {hasPhoneMismatch ? (
            <p className="mt-1 text-[10px] text-amber-200/70 italic">
              Phone is locked by policy — it will not be synced from Clerk.
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end">
        <button
          type="button"
          onClick={onSync}
          disabled={busy || phoneOnly}
          title={phoneOnly ? "Only phone differs — phone sync is disabled by policy" : "Sync name and email from Clerk"}
          className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-400/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Syncing..." : phoneOnly ? "No sync available" : syncableFields.length > 0 ? `Sync ${syncableFields.map((f) => fieldLabel[f].toLowerCase()).join(" + ")}` : "Sync from Clerk"}
        </button>
      </div>
    </div>
  )
}
