import { beforeAll, afterAll, describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { setupIntegrationDb } from "./db-test-utils"

let prisma: PrismaClient
let cleanupDb: (() => Promise<void>) | null = null

beforeAll(async () => {
  const ctx = await setupIntegrationDb()
  prisma = ctx.prisma
  cleanupDb = ctx.cleanup
}, 120_000)

afterAll(async () => {
  if (cleanupDb) await cleanupDb()
}, 120_000)

describe("prisma integration security constraints", () => {
  it("enforces unique user email and unique points event key", async () => {
    const user = await prisma.user.create({
      data: {
        email: "integration.user@example.com",
        name: "Integration User",
      },
    })

    await expect(
      prisma.user.create({
        data: {
          email: "integration.user@example.com",
          name: "Duplicate Email",
        },
      })
    ).rejects.toMatchObject({ code: "P2002" })

    await prisma.pointsLedger.create({
      data: {
        userId: user.id,
        type: "MANUAL_STAFF_ASSIGNMENT",
        points: 10,
        eventKey: "event-dup-001",
      },
    })

    await expect(
      prisma.pointsLedger.create({
        data: {
          userId: user.id,
          type: "MANUAL_STAFF_ASSIGNMENT",
          points: 8,
          eventKey: "event-dup-001",
        },
      })
    ).rejects.toMatchObject({ code: "P2002" })
  })

  it("enforces unique attendance by user and class session", async () => {
    const user = await prisma.user.create({
      data: {
        email: `attendance.${Date.now()}@example.com`,
      },
    })

    const session = await prisma.classSession.create({
      data: {
        courseSlug: "integration-security-course",
        startsAt: new Date("2026-03-08T19:00:00.000Z"),
        durationMinutes: 55,
      },
    })

    await prisma.attendance.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        status: "checked_in",
      },
    })

    await expect(
      prisma.attendance.create({
        data: {
          userId: user.id,
          sessionId: session.id,
          status: "checked_in",
        },
      })
    ).rejects.toMatchObject({ code: "P2002" })
  })

  it("cascades terminal session deletion when terminal is deleted", async () => {
    const terminal = await prisma.staffTerminal.create({
      data: {
        slug: `it-terminal-${Date.now()}`,
        name: "Integration Terminal",
        pinHash: "hash-value",
      },
    })

    await prisma.staffTerminalSession.create({
      data: {
        terminalId: terminal.id,
        tokenHash: `token-${Date.now()}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })

    const before = await prisma.staffTerminalSession.count({
      where: { terminalId: terminal.id },
    })
    expect(before).toBe(1)

    await prisma.staffTerminal.delete({
      where: { id: terminal.id },
    })

    const after = await prisma.staffTerminalSession.count({
      where: { terminalId: terminal.id },
    })
    expect(after).toBe(0)
  })

  it("cascades package usage entries when package purchase is deleted", async () => {
    const user = await prisma.user.create({
      data: {
        email: `package.${Date.now()}@example.com`,
      },
    })

    const purchase = await prisma.packagePurchase.create({
      data: {
        userId: user.id,
        packageId: `pkg-${Date.now()}`,
        status: "active",
      },
    })

    await prisma.packageUsageLedger.create({
      data: {
        packagePurchaseId: purchase.id,
        userId: user.id,
        delta: -1,
        reason: "CHECKIN_CONSUME",
      },
    })

    const before = await prisma.packageUsageLedger.count({
      where: { packagePurchaseId: purchase.id },
    })
    expect(before).toBe(1)

    await prisma.packagePurchase.delete({
      where: { id: purchase.id },
    })

    const after = await prisma.packageUsageLedger.count({
      where: { packagePurchaseId: purchase.id },
    })
    expect(after).toBe(0)
  })
})
