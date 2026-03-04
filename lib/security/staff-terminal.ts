import { createHash, randomBytes, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"
import type { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const TERMINAL_COOKIE_NAME = "pli_terminal_session"
const TERMINAL_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

const getTerminalSecret = () => {
  const secret =
    process.env.STAFF_TERMINAL_SECRET ||
    process.env.STAFF_CHECKIN_TOKEN ||
    process.env.CLERK_SECRET_KEY
  if (secret) return secret
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing STAFF_TERMINAL_SECRET (or STAFF_CHECKIN_TOKEN/CLERK_SECRET_KEY) for staff terminal security."
    )
  }
  return "dev-terminal-secret-local-only"
}

const timingSafeStringEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left, "utf8")
  const rightBuffer = Buffer.from(right, "utf8")
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

const hashWithSecret = (value: string) =>
  createHash("sha256")
    .update(`${value}:${getTerminalSecret()}`)
    .digest("hex")

export const toTerminalSlug = (value: unknown, max = 80) =>
  (typeof value === "string" ? value.trim().slice(0, max) : "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")

export const hashStaffTerminalPin = (pin: string) => {
  const salt = randomBytes(16).toString("hex")
  const hash = createHash("sha256")
    .update(`${pin}:${salt}:${getTerminalSecret()}`)
    .digest("hex")
  return `${salt}:${hash}`
}

export const verifyStaffTerminalPin = (pin: string, pinHash: string) => {
  const parts = pinHash.split(":")
  if (parts.length !== 2) return false
  const [salt, expectedHash] = parts
  if (!salt || !expectedHash) return false
  const nextHash = createHash("sha256")
    .update(`${pin}:${salt}:${getTerminalSecret()}`)
    .digest("hex")
  return timingSafeStringEqual(nextHash, expectedHash)
}

export const createStaffTerminalSessionToken = () => randomBytes(32).toString("base64url")

export const hashStaffTerminalSessionToken = (token: string) => hashWithSecret(token)

export const setStaffTerminalSessionCookie = (response: NextResponse, token: string) => {
  response.cookies.set({
    name: TERMINAL_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TERMINAL_SESSION_TTL_SECONDS,
    priority: "high",
  })
}

export const clearStaffTerminalSessionCookie = (response: NextResponse) => {
  response.cookies.set({
    name: TERMINAL_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    priority: "high",
  })
}

export const readStaffTerminalCookie = async () => (await cookies()).get(TERMINAL_COOKIE_NAME)?.value?.trim() || ""

export const deleteStaffTerminalSessionByToken = async (token: string) => {
  if (!token) return
  await prisma.staffTerminalSession.deleteMany({
    where: { tokenHash: hashStaffTerminalSessionToken(token) },
  })
}

export type StaffTerminalSessionAuthResult =
  | {
      ok: true
      sessionId: string
      terminal: {
        id: string
        slug: string
        name: string
        location: string | null
        defaultCourseSlug: string | null
        active: boolean
      }
    }
  | {
      ok: false
      reason: "missing" | "expired" | "inactive"
    }

export const authorizeStaffTerminalSession = async (): Promise<StaffTerminalSessionAuthResult> => {
  const token = await readStaffTerminalCookie()
  if (!token) {
    return { ok: false, reason: "missing" }
  }

  const now = new Date()
  const session = await prisma.staffTerminalSession.findFirst({
    where: {
      tokenHash: hashStaffTerminalSessionToken(token),
      expiresAt: { gt: now },
    },
    include: {
      terminal: {
        select: {
          id: true,
          slug: true,
          name: true,
          location: true,
          defaultCourseSlug: true,
          active: true,
        },
      },
    },
  })

  if (!session) {
    return { ok: false, reason: "expired" }
  }

  if (!session.terminal.active) {
    return { ok: false, reason: "inactive" }
  }

  await prisma.staffTerminalSession.update({
    where: { id: session.id },
    data: {
      lastSeenAt: now,
      terminal: {
        update: {
          lastSeenAt: now,
        },
      },
    },
  })

  return {
    ok: true,
    sessionId: session.id,
    terminal: session.terminal,
  }
}
