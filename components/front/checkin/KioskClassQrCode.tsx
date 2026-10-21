"use client"

import React from "react"
import { QRCodeSVG } from "qrcode.react"
import { cn } from "@/lib/utils"

type Props = {
  url: string
  size: number
  className?: string
  ariaLabel?: string
}

type GrantState = {
  url: string
  grant: string
}

export function KioskClassQrCode({ url, size, className, ariaLabel = "Check-in QR code" }: Props) {
  const [grantState, setGrantState] = React.useState<GrantState>({ url: "", grant: "" })
  const context = React.useMemo(() => {
    try {
      const parsed = new URL(url, window.location.origin)
      const courseSlug = parsed.searchParams.get("courseSlug") || ""
      const date = parsed.searchParams.get("date") || ""
      const time = parsed.searchParams.get("time") || ""
      return courseSlug && date && time ? { courseSlug, date, time } : null
    } catch {
      return null
    }
  }, [url])

  React.useEffect(() => {
    setGrantState({ url, grant: "" })
    if (!context) return
    let active = true
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    let expiryTimer: ReturnType<typeof setTimeout> | undefined
    const loadGrant = async () => {
      try {
        const response = await fetch("/api/checkin/qr/cash-grant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(context),
        })
        const data = response.ok ? await response.json() : null
        if (!active) return
        const grant = typeof data?.grant === "string" ? data.grant : ""
        setGrantState({ url, grant })
        if (grant && typeof data?.expiresAt === "string") {
          if (expiryTimer) clearTimeout(expiryTimer)
          const expiresAt = new Date(data.expiresAt).getTime()
          const refreshInMs = Math.min(2_147_000_000, Math.max(5_000, expiresAt - Date.now() - 30_000))
          const expireInMs = Math.min(2_147_000_000, Math.max(0, expiresAt - Date.now()))
          refreshTimer = setTimeout(loadGrant, refreshInMs)
          expiryTimer = setTimeout(() => {
            if (active) setGrantState((current) => current.url === url && current.grant === grant ? { url, grant: "" } : current)
          }, expireInMs)
        }
      } catch {
        if (active) setGrantState({ url, grant: "" })
      }
    }
    void loadGrant()
    return () => {
      active = false
      if (refreshTimer) clearTimeout(refreshTimer)
      if (expiryTimer) clearTimeout(expiryTimer)
    }
  }, [context, url])

  const signedUrl = React.useMemo(() => {
    if (!url || grantState.url !== url || !grantState.grant) return ""
    const parsed = new URL(url, window.location.origin)
    parsed.searchParams.set("kioskQrCashGrant", grantState.grant)
    return parsed.toString()
  }, [grantState, url])

  return (
    <div
      aria-label={ariaLabel}
      className={cn("flex items-center justify-center rounded-2xl border border-white/15 bg-white", className)}
      style={{ width: size, height: size }}
    >
      {signedUrl ? <QRCodeSVG value={signedUrl} size={size - 16} level="M" /> : <span className="text-xs text-neutral-500">Preparing QR…</span>}
    </div>
  )
}
