import { createHmac, timingSafeEqual } from "crypto"

export const KIOSK_QR_CASH_GRANT_TTL_SECONDS = 5 * 60

const PURPOSE = "kiosk_qr_cash"

type KioskQrCashContext = {
  terminalId: string
  courseSlug: string
  date: string
  time: string
}

type GrantPayload = KioskQrCashContext & {
  v: 1
  purpose: typeof PURPOSE
  issuedAt: number
  expiresAt: number
}

type GrantOptions = {
  secret?: string
  now?: Date
  ttlSeconds?: number
}

const resolveSecret = () => {
  const secret = process.env.STAFF_TERMINAL_SECRET || process.env.STAFF_CHECKIN_TOKEN || process.env.CLERK_SECRET_KEY
  if (secret) return secret
  if (process.env.NODE_ENV === "production") throw new Error("Missing terminal secret for kiosk QR cash grants.")
  return "dev-terminal-secret-local-only"
}

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url")

const equalSignatures = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export const createKioskQrCashGrant = (context: KioskQrCashContext, options: GrantOptions = {}) => {
  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000)
  const payload: GrantPayload = {
    v: 1,
    purpose: PURPOSE,
    ...context,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + (options.ttlSeconds ?? KIOSK_QR_CASH_GRANT_TTL_SECONDS),
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${encoded}.${sign(encoded, options.secret ?? resolveSecret())}`
}

export const verifyKioskQrCashGrant = (
  grant: unknown,
  expected: Omit<KioskQrCashContext, "terminalId">,
  options: Pick<GrantOptions, "secret" | "now"> = {}
): { ok: true; terminalId: string } | { ok: false } => {
  if (typeof grant !== "string" || grant.length > 2_000) return { ok: false }
  const [encoded, signature, extra] = grant.split(".")
  if (!encoded || !signature || extra) return { ok: false }
  if (!equalSignatures(signature, sign(encoded, options.secret ?? resolveSecret()))) return { ok: false }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<GrantPayload>
    const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000)
    if (
      payload.v !== 1 ||
      payload.purpose !== PURPOSE ||
      typeof payload.terminalId !== "string" ||
      !payload.terminalId ||
      payload.courseSlug !== expected.courseSlug ||
      payload.date !== expected.date ||
      payload.time !== expected.time ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number" ||
      payload.issuedAt > nowSeconds + 30 ||
      payload.expiresAt <= nowSeconds
    ) {
      return { ok: false }
    }
    return { ok: true, terminalId: payload.terminalId }
  } catch {
    return { ok: false }
  }
}
