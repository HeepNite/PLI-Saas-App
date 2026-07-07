"use client"

import React from "react"

import { formatIsoDate } from "./staffAdminFormatters"

type TrustedDevice = {
  id: string
  createdAt: string
  lastUsedAt: string | null
}

type ChallengePhase = "idle" | "sending" | "codeSent" | "verifying" | "enrolled"

async function parseJsonSafely(res: Response): Promise<Record<string, unknown>> {
  return res.json().catch(() => ({})) as Promise<Record<string, unknown>>
}

function readServerError(data: Record<string, unknown>, fallback: string): string {
  return typeof data.error === "string" ? data.error : fallback
}

/**
 * Trusted-device enrollment for the OUT-OF-BAND SMS OTP flow (design v5 ADR
 * 13 fallback, adopted directly for this apply batch — see
 * lib/security/staff-enrollment-challenge.ts). Assumes it renders inside an
 * already-authenticated staff portal (Clerk session required by the
 * endpoints it calls):
 *   1. POST /api/staff/device/enroll/challenge — mints and SMS's a 6-digit
 *      code to the staff member's on-file phone.
 *   2. POST /api/staff/device/enroll { code } — consumes the code and marks
 *      this device trusted.
 * Both endpoints always resolve (never hang) even when the SMS provider is
 * unconfigured (lib/sms/send-sms.ts is inert-safe in that case) — this
 * component never blocks on SMS delivery, it only reacts to the HTTP
 * response.
 */
export default function EnrollDeviceFlow() {
  const [devices, setDevices] = React.useState<TrustedDevice[]>([])
  const [devicesLoading, setDevicesLoading] = React.useState(true)
  const [devicesError, setDevicesError] = React.useState<string | null>(null)
  const [revokingId, setRevokingId] = React.useState<string | null>(null)

  const [phase, setPhase] = React.useState<ChallengePhase>("idle")
  const [code, setCode] = React.useState("")
  const [enrollError, setEnrollError] = React.useState<string | null>(null)

  const fetchDevices = React.useCallback(async () => {
    setDevicesLoading(true)
    setDevicesError(null)
    try {
      const res = await fetch("/api/staff/devices", { headers: { "Content-Type": "application/json" } })
      const data = await parseJsonSafely(res)
      if (!res.ok) {
        setDevicesError(readServerError(data, "Unable to load your devices."))
        setDevices([])
        return
      }
      setDevices(Array.isArray(data.devices) ? (data.devices as TrustedDevice[]) : [])
    } catch {
      setDevicesError("Network error while loading your devices.")
      setDevices([])
    } finally {
      setDevicesLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchDevices()
  }, [fetchDevices])

  const sendChallenge = React.useCallback(async () => {
    setEnrollError(null)
    setPhase("sending")
    try {
      const res = await fetch("/api/staff/device/enroll/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await parseJsonSafely(res)
      if (!res.ok) {
        setEnrollError(readServerError(data, "Unable to send the verification code."))
        setPhase("idle")
        return
      }
      setCode("")
      setPhase("codeSent")
    } catch {
      setEnrollError("Network error while sending the verification code.")
      setPhase("idle")
    }
  }, [])

  const verifyCode = React.useCallback(async () => {
    if (!/^\d{6}$/.test(code)) {
      setEnrollError("Enter the 6-digit code sent to your phone.")
      return
    }
    setEnrollError(null)
    setPhase("verifying")
    try {
      const res = await fetch("/api/staff/device/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = await parseJsonSafely(res)
      if (!res.ok) {
        setEnrollError(readServerError(data, "Unable to verify the code."))
        setPhase("codeSent")
        return
      }
      setPhase("enrolled")
      setCode("")
      await fetchDevices()
    } catch {
      setEnrollError("Network error while verifying the code.")
      setPhase("codeSent")
    }
  }, [code, fetchDevices])

  const revokeDevice = React.useCallback(async (deviceId: string) => {
    setRevokingId(deviceId)
    setDevicesError(null)
    try {
      const res = await fetch(`/api/staff/devices/${encodeURIComponent(deviceId)}`, { method: "DELETE" })
      const data = await parseJsonSafely(res)
      if (!res.ok) {
        setDevicesError(readServerError(data, "Unable to revoke this device."))
        return
      }
      await fetchDevices()
    } catch {
      setDevicesError("Network error while revoking this device.")
    } finally {
      setRevokingId(null)
    }
  }, [fetchDevices])

  return (
    <section
      aria-labelledby="enroll-device-heading"
      className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5"
    >
      <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Device security</p>
      <h3 id="enroll-device-heading" className="mt-2 text-xl font-semibold text-black dark:text-white">
        Trusted device enrollment
      </h3>
      <p className="mt-1 text-sm text-black/65 dark:text-white/65">
        Enroll this device for PIN sign-in by verifying a 6-digit code we text to your phone on file.
      </p>

      <DeviceList
        devices={devices}
        loading={devicesLoading}
        error={devicesError}
        revokingId={revokingId}
        onRevoke={(id) => void revokeDevice(id)}
      />

      <div className="mt-4 space-y-3 border-t border-black/10 pt-4 dark:border-white/10">
        {phase === "enrolled" ? (
          <p className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-950 dark:text-emerald-100">
            Device enrolled. This device is now trusted for PIN sign-in.
          </p>
        ) : phase === "idle" || phase === "sending" ? (
          <PrimaryButton onClick={() => void sendChallenge()} disabled={phase === "sending"}>
            {phase === "sending" ? "Sending..." : "Send verification code"}
          </PrimaryButton>
        ) : (
          <CodeEntryForm
            code={code}
            submitting={phase === "verifying"}
            onCodeChange={setCode}
            onSubmit={() => void verifyCode()}
            onResend={() => void sendChallenge()}
          />
        )}
        {enrollError ? <p className="text-sm text-[var(--brand,#ff4b4b)]">{enrollError}</p> : null}
      </div>
    </section>
  )
}

function DeviceList({
  devices,
  loading,
  error,
  revokingId,
  onRevoke,
}: {
  devices: TrustedDevice[]
  loading: boolean
  error: string | null
  revokingId: string | null
  onRevoke: (id: string) => void
}) {
  return (
    <div className="mt-4 space-y-2">
      <h4 className="text-sm font-medium text-black dark:text-white">Your trusted devices</h4>
      {loading ? (
        <p className="text-sm text-black/65 dark:text-white/65">Loading your devices...</p>
      ) : devices.length === 0 ? (
        <p className="text-sm text-black/65 dark:text-white/65">No trusted devices yet.</p>
      ) : (
        <ul className="space-y-2">
          {devices.map((device) => (
            <li
              key={device.id}
              data-testid="trusted-device-item"
              className="flex items-center justify-between rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black dark:border-white/15 dark:bg-white/5 dark:text-white"
            >
              <span>
                Enrolled {formatIsoDate(device.createdAt)} · Last used{" "}
                {device.lastUsedAt ? formatIsoDate(device.lastUsedAt) : "Never"}
              </span>
              <SecondaryMiniButton onClick={() => onRevoke(device.id)} disabled={revokingId === device.id}>
                {revokingId === device.id ? "Revoking..." : "Revoke"}
              </SecondaryMiniButton>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="text-sm text-[var(--brand,#ff4b4b)]">{error}</p> : null}
    </div>
  )
}

function CodeEntryForm({
  code,
  submitting,
  onCodeChange,
  onSubmit,
  onResend,
}: {
  code: string
  submitting: boolean
  onCodeChange: (value: string) => void
  onSubmit: () => void
  onResend: () => void
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className="space-y-2"
    >
      <p className="text-sm text-black/65 dark:text-white/65">
        Enter the 6-digit code we sent to your phone on file. It expires in 5 minutes.
      </p>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-black dark:text-white">Verification code</span>
        <input
          name="enrollCode"
          value={code}
          onChange={(event) => onCodeChange(event.target.value.replace(/\D+/g, "").slice(0, 6))}
          inputMode="numeric"
          maxLength={6}
          placeholder="123456"
          className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm tracking-[0.3em] text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton onClick={onSubmit} disabled={submitting}>
          {submitting ? "Verifying..." : "Verify & enroll"}
        </PrimaryButton>
        <SecondaryMiniButton onClick={onResend} disabled={submitting}>
          Resend code
        </SecondaryMiniButton>
      </div>
    </form>
  )
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  )
}

function SecondaryMiniButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/15 dark:text-white"
    >
      {children}
    </button>
  )
}
