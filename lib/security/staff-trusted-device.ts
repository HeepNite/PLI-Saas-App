import { createHash, randomBytes } from "crypto"
import { cookies } from "next/headers"
import type { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Personal trusted-device cookie + `StaffTrustedDevice` DB row (design v5,
 * PR2's `resolvePersonalDeviceContext()` stub in `staff-pin-gate.ts` now
 * calls into this module — see PR3 wiring).
 *
 * Row lifecycle owned here: enroll (mints token, sets cookie), validate
 * (cookie -> non-revoked row -> staffUserId), revoke (own-user scoped).
 */

const TRUSTED_DEVICE_COOKIE_NAME = "pli_staff_trusted_device"
const TRUSTED_DEVICE_TTL_SECONDS = 60 * 60 * 24 * 365

// Per-user active-device cap (design v5 Enrollment Data Flow step 5:
// "enforce max active StaffTrustedDevice rows per staffUserId (default 5;
// evict oldest or 409)"). Chosen behavior: evict oldest — keeps device
// swaps (new phone, etc.) simple without a manual revoke step first.
export const STAFF_TRUSTED_DEVICE_MAX_ACTIVE = 5

/**
 * Deterministic pepper for the device-token hash. Mirrors staff-pin-auth's
 * pepper-first secret selection (STAFF_PIN_PEPPER decouples from CLERK_SECRET_KEY
 * so tokens survive a Clerk key/instance swap; CLERK_SECRET_KEY stays as a legacy
 * fallback) but stays self-contained on purpose: the device-token hash is
 * deterministic + unsalted for an O(1) findUnique lookup, unlike the salted PIN
 * hash in staff-pin-auth. Fail-closed: at least one secret must be set.
 */
const getDeviceHashSecret = (): string => {
  const secret = process.env.STAFF_PIN_PEPPER || process.env.CLERK_SECRET_KEY
  if (!secret) {
    throw new Error("STAFF_PIN_PEPPER or CLERK_SECRET_KEY must be set to hash staff trusted-device tokens.")
  }
  return secret
}

const hashDeviceToken = (token: string): string =>
  createHash("sha256").update(`${token}:${getDeviceHashSecret()}`).digest("hex")

export const createTrustedDeviceToken = (): string => randomBytes(32).toString("base64url")

export const setTrustedDeviceCookie = (response: NextResponse, token: string): void => {
  response.cookies.set({
    name: TRUSTED_DEVICE_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TRUSTED_DEVICE_TTL_SECONDS,
    priority: "high",
  })
}

export const clearTrustedDeviceCookie = (response: NextResponse): void => {
  response.cookies.set({
    name: TRUSTED_DEVICE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    priority: "high",
  })
}

export const readTrustedDeviceCookie = async (): Promise<string> =>
  (await cookies()).get(TRUSTED_DEVICE_COOKIE_NAME)?.value?.trim() || ""

export type ValidatedTrustedDevice = { id: string; staffUserId: string }

/** Validates the cookie's token against a non-revoked `StaffTrustedDevice` row. */
export const validateTrustedDeviceToken = async (token: string): Promise<ValidatedTrustedDevice | null> => {
  if (!token) return null

  const tokenHash = hashDeviceToken(token)
  const device = await prisma.staffTrustedDevice.findUnique({ where: { tokenHash } })
  if (!device || device.revokedAt) return null

  // Best-effort last-used touch — never blocks or fails validation.
  void prisma.staffTrustedDevice.update({ where: { id: device.id }, data: { lastUsedAt: new Date() } }).catch(() => {})

  return { id: device.id, staffUserId: device.staffUserId }
}

/**
 * Enrolls a new trusted device for `staffUserId`. When the per-user active
 * cap is already reached, evicts (revokes) the oldest active device first.
 */
export const enrollTrustedDevice = async (staffUserId: string): Promise<{ token: string }> => {
  const activeDevices = await prisma.staffTrustedDevice.findMany({
    where: { staffUserId, revokedAt: null },
    orderBy: { createdAt: "asc" },
  })

  if (activeDevices.length >= STAFF_TRUSTED_DEVICE_MAX_ACTIVE) {
    const oldest = activeDevices[0]!
    await prisma.staffTrustedDevice.update({
      where: { id: oldest.id },
      data: { revokedAt: new Date() },
    })
  }

  const token = createTrustedDeviceToken()
  const tokenHash = hashDeviceToken(token)
  await prisma.staffTrustedDevice.create({ data: { staffUserId, tokenHash } })

  return { token }
}

export type OwnedTrustedDevice = {
  id: string
  createdAt: Date
  lastUsedAt: Date | null
}

/** Lists the caller's own ACTIVE (non-revoked) devices — never cross-user. */
export const listOwnTrustedDevices = async (staffUserId: string): Promise<OwnedTrustedDevice[]> => {
  const devices = await prisma.staffTrustedDevice.findMany({
    where: { staffUserId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  })
  return devices.map((device) => ({ id: device.id, createdAt: device.createdAt, lastUsedAt: device.lastUsedAt }))
}

export type RevokeDeviceResult = { ok: true } | { ok: false; status: number; error: string }

/** Revokes a device — scoped to the caller's own staffUserId, never cross-user. */
export const revokeOwnTrustedDevice = async (staffUserId: string, deviceId: string): Promise<RevokeDeviceResult> => {
  const device = await prisma.staffTrustedDevice.findUnique({ where: { id: deviceId } })
  if (!device || device.staffUserId !== staffUserId) {
    return { ok: false, status: 404, error: "Device not found." }
  }
  if (device.revokedAt) {
    return { ok: true }
  }
  await prisma.staffTrustedDevice.update({ where: { id: deviceId }, data: { revokedAt: new Date() } })
  return { ok: true }
}
