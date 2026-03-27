import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { authorizeStaffTerminalSession } from "@/lib/security/staff-terminal"

export const KIOSK_IDENTIFICATION_SESSION_TTL_MS = 15 * 60 * 1000

type KioskSessionDbClient = Prisma.TransactionClient | typeof prisma

type ActiveKioskSession = {
  id: string
  terminalId: string
  userId: string
  credentialKind: string
  requiresPinRotation: boolean
  rotationBypassed: boolean
  expiresAt: Date
  user?: {
    id: string
    clerkId: string | null
    email: string
    name: string | null
    phone: string | null
  }
}

type ResolvedKioskSession = ActiveKioskSession & {
  user: NonNullable<ActiveKioskSession["user"]>
}

export const createKioskIdentificationSession = async (
  tx: KioskSessionDbClient,
  input: {
    terminalId: string
    userId: string
    credentialKind: string
    requiresPinRotation: boolean
  }
) => {
  const now = new Date()
  await tx.kioskIdentificationSession.deleteMany({
    where: { terminalId: input.terminalId },
  })

  return tx.kioskIdentificationSession.create({
    data: {
      terminalId: input.terminalId,
      userId: input.userId,
      credentialKind: input.credentialKind,
      requiresPinRotation: input.requiresPinRotation,
      expiresAt: new Date(now.getTime() + KIOSK_IDENTIFICATION_SESSION_TTL_MS),
      lastActivityAt: now,
    },
  })
}

export const getActiveKioskIdentificationSession = async (
  db: KioskSessionDbClient,
  input: { sessionToken: string; terminalId: string; includeUser?: boolean }
) => {
  const now = new Date()
  return db.kioskIdentificationSession.findFirst({
    where: {
      id: input.sessionToken,
      terminalId: input.terminalId,
      expiresAt: { gt: now },
    },
    include: input.includeUser
      ? {
          user: {
            select: {
              id: true,
              clerkId: true,
              email: true,
              name: true,
              phone: true,
            },
          },
        }
      : undefined,
  }) as Promise<ActiveKioskSession | null>
}

export const touchKioskIdentificationSession = async (db: KioskSessionDbClient, sessionId: string) => {
  const now = new Date()
  return db.kioskIdentificationSession.update({
    where: { id: sessionId },
    data: {
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + KIOSK_IDENTIFICATION_SESSION_TTL_MS),
    },
  })
}

export const resolveTerminalKioskSession = async (
  sessionToken: unknown,
  options: { allowRotationRequired?: boolean } = {}
) => {
  const normalizedToken = typeof sessionToken === "string" ? sessionToken.trim() : ""
  if (!normalizedToken) {
    return {
      ok: false as const,
      status: 400,
      error: "Missing kiosk session token.",
    }
  }

  const terminalAuth = await authorizeStaffTerminalSession()
  if (!terminalAuth.ok) {
    return {
      ok: false as const,
      status: 401,
      error: "Terminal session required for kiosk checkout.",
    }
  }

  const session = await getActiveKioskIdentificationSession(prisma, {
    sessionToken: normalizedToken,
    terminalId: terminalAuth.terminal.id,
    includeUser: true,
  })
  if (!session?.user) {
    return {
      ok: false as const,
      status: 401,
      error: "Kiosk identification session expired.",
    }
  }

  const resolvedSession = session as ResolvedKioskSession

  if (resolvedSession.requiresPinRotation && !options.allowRotationRequired && !resolvedSession.rotationBypassed) {
    return {
      ok: false as const,
      status: 409,
      error: "PIN rotation is required before continuing.",
      code: "PIN_ROTATION_REQUIRED",
    }
  }

  await touchKioskIdentificationSession(prisma, resolvedSession.id)

  return {
    ok: true as const,
    terminalAuth,
    session: resolvedSession,
  }
}
