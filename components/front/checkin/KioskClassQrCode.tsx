"use client"

import React from "react"
import { cn } from "@/lib/utils"

type Props = {
  url: string
  size: number
  className?: string
  ariaLabel?: string
}

type GrantState = { url: string; grant: string }

/**
 * The terminal, not a scanned phone, mints the signed cash capability. The
 * image is deliberately blank until that capability is available so an
 * ordinary public QR can never be mistaken for a kiosk-authorized one.
 */
const GRANT_RETRY_DELAY_MS = 5_000
const MAX_GRANT_RETRY_ATTEMPTS = 3
export function KioskClassQrCode({ url, size, className, ariaLabel = "Check-in QR code" }: Props) {
  const [grantState, setGrantState] = React.useState<GrantState>({ url: "", grant: "" })
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const { context, publicQrUrl } = React.useMemo(() => {
    try {
      const parsed = new URL(url, window.location.origin)
      const courseSlug = parsed.searchParams.get("courseSlug") || ""
      const date = parsed.searchParams.get("date") || ""
      const time = parsed.searchParams.get("time") || ""
      if (courseSlug && date && time) {
        return { context: { courseSlug, date, time }, publicQrUrl: "" }
      }
      return {
        context: null,
        publicQrUrl:
          parsed.origin === window.location.origin && parsed.pathname.startsWith("/special-classes/")
            ? url
            : "",
      }
    } catch {
      return { context: null, publicQrUrl: "" }
    }
  }, [url])

  React.useEffect(() => {
    setGrantState({ url, grant: "" })
    if (!context) return
    let active = true
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    let expiryTimer: ReturnType<typeof setTimeout> | undefined
    let retryAttempts = 0
    const cancelTimers = () => {
      if (refreshTimer !== undefined) clearTimeout(refreshTimer)
      if (expiryTimer !== undefined) clearTimeout(expiryTimer)
      refreshTimer = undefined
      expiryTimer = undefined
    }
    const scheduleRetry = () => {
      if (refreshTimer !== undefined) clearTimeout(refreshTimer)
      refreshTimer = undefined
      if (!active || retryAttempts >= MAX_GRANT_RETRY_ATTEMPTS) return
      retryAttempts += 1
      refreshTimer = setTimeout(loadGrant, GRANT_RETRY_DELAY_MS)
    }
    async function loadGrant() {
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
        const expiresAt = typeof data?.expiresAt === "string" ? new Date(data.expiresAt).getTime() : Number.NaN
        if (!grant || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
          scheduleRetry()
          return
        }
        retryAttempts = 0
        cancelTimers()
        setGrantState({ url, grant })
        const refreshInMs = Math.min(2_147_000_000, Math.max(5_000, expiresAt - Date.now() - 30_000))
        const expireInMs = Math.min(2_147_000_000, Math.max(0, expiresAt - Date.now()))
        refreshTimer = setTimeout(loadGrant, refreshInMs)
        expiryTimer = setTimeout(() => {
          if (active) setGrantState((current) => current.url === url && current.grant === grant ? { url, grant: "" } : current)
        }, expireInMs)
      } catch {
        scheduleRetry()
      }
    }
    void loadGrant()
    return () => {
      active = false
      cancelTimers()
    }
  }, [context, url])

  const qrValue = React.useMemo(() => {
    if (publicQrUrl) return publicQrUrl
    if (!url || grantState.url !== url || !grantState.grant) return ""
    const parsed = new URL(url, window.location.origin)
    parsed.searchParams.set("kioskQrCashGrant", grantState.grant)
    return parsed.toString()
  }, [grantState, publicQrUrl, url])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !qrValue) return
    let active = true
    void import("qrcode").then((QRCode) => QRCode.toCanvas(canvas, qrValue, { width: size - 16, margin: 1 })).catch(() => {
      if (active) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height)
    })
    return () => { active = false }
  }, [qrValue, size])

  return (
    <div aria-label={ariaLabel} className={cn("flex items-center justify-center rounded-2xl border border-white/15 bg-white", className)} style={{ width: size, height: size }}>
      {qrValue ? <canvas ref={canvasRef} width={size - 16} height={size - 16} aria-label={ariaLabel} data-qr-value={qrValue} /> : <span className="text-xs text-neutral-500">Preparing QR…</span>}
    </div>
  )
}
