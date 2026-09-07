import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { SpecialClassAuthoringError, synchronizeSpecialClassAuthoring } from "@/lib/special-classes/authoring-sync"
import { setupIntegrationDb } from "./db-test-utils"

let prisma: PrismaClient
let cleanup: (() => Promise<void>) | null = null

const course = (suffix: string) => ({
  slug: `studio-${suffix}`, title: "Studio Special", kind: "workshop", category: null,
  description: "A complete special class", coverImageUrl: null, previewVideoUrl: null,
  dropInPriceCents: 4500, firstClassPriceCents: 1200, level: null, durationMinutes: 60,
  location: "Main studio", defaultRoomId: null, availableWeekdays: [1], availableTimes: ["09:00"],
  scheduleRules: { mode: "regular", weeklyDaysTarget: 1, repeatAllMonth: true, recurrenceMode: "indefinite", recurrenceEndsAt: null, rules: [{ weekday: 1, times: ["09:00"] }], specialEvents: [], publication: { mode: "launch_date", launchDate: "2030-01-01" } },
  active: true, specialClassOperationsEnabled: true, specialClassCapacity: 12,
})

const command = (suffix: string, overrides: Record<string, unknown> = {}) => ({
  operationId: randomUUID(), intent: "save_draft" as const, course: course(suffix),
  concreteSlots: [{ date: "2030-06-01", time: "10:00" }, { date: "2030-06-02", time: "11:00" }],
  actorClerkUserId: "owner_1", actorRole: "owner", ...overrides,
})

const mutationCounts = () => Promise.all([
  prisma.courseCatalog.count(),
  prisma.courseCatalogSpecialClassSlot.count(),
  prisma.classSession.count(),
  prisma.specialClass.count(),
  prisma.specialClassAuditLog.count(),
  prisma.courseCatalogAuthoringOperation.count(),
])

describe("Course Studio special-class synchronization", () => {
  beforeAll(async () => { const context = await setupIntegrationDb(); prisma = context.prisma; cleanup = context.cleanup }, 120_000)
  afterAll(async () => { if (cleanup) await cleanup() }, 120_000)

  it("atomically creates only concrete slots and replays the same operation", async () => {
    const input = command("create")
    const first = await synchronizeSpecialClassAuthoring(prisma, input)
    const replay = await synchronizeSpecialClassAuthoring(prisma, input)

    expect(replay).toEqual(first)
    expect(first.projections).toHaveLength(2)
    await expect(prisma.courseCatalogSpecialClassSlot.count()).resolves.toBe(2)
    await expect(prisma.specialClass.count()).resolves.toBe(2)
    await expect(prisma.classSession.count()).resolves.toBe(2)
    await expect(prisma.specialClassAuditLog.count()).resolves.toBe(2)
    await expect(prisma.courseCatalogAuthoringOperation.count()).resolves.toBe(1)
    const projected = await prisma.specialClass.findFirstOrThrow({ include: { classSession: true } })
    expect(projected).toMatchObject({ priceCents: 4500, currency: "usd", status: "draft" })
    expect(projected.classSession).toMatchObject({ capacity: 12, durationMinutes: 60 })
    const revision = await prisma.courseCatalog.findUniqueOrThrow({ where: { id: first.courseCatalogId } })
    const published = await synchronizeSpecialClassAuthoring(prisma, command("create", {
      intent: "publish", courseCatalogId: first.courseCatalogId, expectedUpdatedAt: revision.updatedAt.toISOString(),
      concreteSlots: first.projections.map(({ slotId }, index) => ({ id: slotId, date: `2030-06-0${index + 1}`, time: index ? "11:00" : "10:00" })),
    }))
    expect(published.projections.every(({ status }) => status === "published")).toBe(true)
  }, 120_000)

  it("preserves stable identity on a move and rejects committed removal without mutation", async () => {
    const created = await synchronizeSpecialClassAuthoring(prisma, command("move", { concreteSlots: [{ date: "2030-07-01", time: "10:00" }, { date: "2030-07-02", time: "10:00" }] }))
    const original = created.projections[0]
    const source = await prisma.courseCatalog.findUniqueOrThrow({ where: { id: created.courseCatalogId } })
    const moved = await synchronizeSpecialClassAuthoring(prisma, command("move", {
      courseCatalogId: source.id, expectedUpdatedAt: source.updatedAt.toISOString(),
      concreteSlots: [{ id: original.slotId, date: "2030-07-03", time: "12:00" }, { id: created.projections[1].slotId, date: "2030-07-02", time: "10:00" }],
    }))
    expect(moved.projections.find(({ slotId }) => slotId === original.slotId)).toMatchObject(original)

    const removalInput = command("move", {
      courseCatalogId: source.id, expectedUpdatedAt: moved.revision,
      concreteSlots: [{ id: original.slotId, date: "2030-07-04", time: "12:00" }],
    })
    const removed = await synchronizeSpecialClassAuthoring(prisma, removalInput)
    expect(removed.removalOutcomes).toEqual([expect.objectContaining({ action: "authoring_removed", courseCatalogId: source.id, slotId: created.projections[1].slotId, specialClassId: created.projections[1].specialClassId, classSessionId: created.projections[1].classSessionId, actorClerkUserId: "owner_1", actorRole: "owner", operationId: removalInput.operationId, correlationId: removalInput.operationId, beforeState: expect.any(Object), afterState: { status: "removed" } })])
    const receipt = await prisma.courseCatalogAuthoringOperation.findUniqueOrThrow({ where: { operationId: removalInput.operationId } })
    expect(receipt.resultSummary).toMatchObject({ removalOutcomes: removed.removalOutcomes })

    const user = await prisma.user.create({ data: { email: "authoring-commitment@example.com" } })
    await prisma.purchase.create({ data: { userId: user.id, courseSlug: "studio-move", amount: 4500, status: "pending", specialClassId: original.specialClassId, classSessionId: original.classSessionId } })
    const revision = await prisma.courseCatalog.findUniqueOrThrow({ where: { id: source.id } })
    await expect(synchronizeSpecialClassAuthoring(prisma, command("move", {
      courseCatalogId: source.id, expectedUpdatedAt: revision.updatedAt.toISOString(), concreteSlots: [],
      course: { ...course("move"), specialClassOperationsEnabled: false },
    }))).rejects.toMatchObject({ code: "SLOT_COMMITTED" } satisfies Partial<SpecialClassAuthoringError>)
    await expect(synchronizeSpecialClassAuthoring(prisma, command("move", {
      courseCatalogId: source.id, expectedUpdatedAt: revision.updatedAt.toISOString(),
      concreteSlots: [{ id: original.slotId, date: "2030-07-03", time: "12:00" }],
    }))).rejects.toMatchObject({ code: "SLOT_COMMITTED" } satisfies Partial<SpecialClassAuthoringError>)
    await expect(prisma.courseCatalogSpecialClassSlot.count({ where: { courseCatalogId: source.id } })).resolves.toBe(1)
  }, 120_000)

  it("records an uncommitted disable in its durable operation receipt", async () => {
    const created = await synchronizeSpecialClassAuthoring(prisma, command("disable", { concreteSlots: [{ date: "2030-07-10", time: "10:00" }] }))
    const input = command("disable", { courseCatalogId: created.courseCatalogId, expectedUpdatedAt: created.revision, course: { ...course("disable"), specialClassOperationsEnabled: false }, concreteSlots: [{ id: created.projections[0].slotId, date: "2030-07-10", time: "10:00" }] })
    const disabled = await synchronizeSpecialClassAuthoring(prisma, input)
    expect(disabled.removalOutcomes).toEqual([expect.objectContaining({ action: "authoring_disabled", courseCatalogId: created.courseCatalogId, slotId: created.projections[0].slotId, classSessionId: created.projections[0].classSessionId, operationId: input.operationId, correlationId: input.operationId, afterState: { status: "disabled" } })])
    const receipt = await prisma.courseCatalogAuthoringOperation.findUniqueOrThrow({ where: { operationId: input.operationId } })
    expect(receipt.resultSummary).toMatchObject({ removalOutcomes: disabled.removalOutcomes })
  }, 120_000)

  it.each(["closed", "cancelled"])("keeps %s projections immutable and rejects authoring removal", async (status) => {
    const created = await synchronizeSpecialClassAuthoring(prisma, command(`terminal-${status}`, { concreteSlots: [{ date: "2030-07-20", time: "10:00" }] }))
    const projection = created.projections[0]
    const room = await prisma.room.create({ data: { name: `Terminal room ${randomUUID()}`, capacity: 20 } })
    await prisma.specialClass.update({ where: { id: projection.specialClassId }, data: { status, title: "Terminal title", description: "Terminal description", coverImageUrl: "/terminal.jpg", priceCents: 7777 } })
    await prisma.classSession.update({ where: { id: projection.classSessionId }, data: { title: "Terminal title", durationMinutes: 45, location: "Terminal location", roomId: room.id, capacity: 7 } })
    const before = await prisma.specialClass.findUniqueOrThrow({ where: { id: projection.specialClassId }, include: { classSession: true } })
    const source = await prisma.courseCatalog.findUniqueOrThrow({ where: { id: created.courseCatalogId } })
    const synced = await synchronizeSpecialClassAuthoring(prisma, command(`terminal-${status}`, { courseCatalogId: source.id, expectedUpdatedAt: source.updatedAt.toISOString(), course: { ...course(`terminal-${status}`), title: "Changed", description: "Changed", coverImageUrl: "/changed.jpg", durationMinutes: 90, location: "Changed", dropInPriceCents: 9999, specialClassCapacity: 99 }, concreteSlots: [{ id: projection.slotId, date: "2030-07-20", time: "10:00" }] }))
    const after = await prisma.specialClass.findUniqueOrThrow({ where: { id: projection.specialClassId }, include: { classSession: true } })
    expect(after).toEqual(before)
    await expect(synchronizeSpecialClassAuthoring(prisma, command(`terminal-${status}`, { courseCatalogId: source.id, expectedUpdatedAt: synced.revision, course: { ...course(`terminal-${status}`), specialClassOperationsEnabled: false }, concreteSlots: [] }))).rejects.toMatchObject({ code: "SLOT_LIFECYCLE_CONFLICT" })
    await expect(prisma.specialClass.findUniqueOrThrow({ where: { id: projection.specialClassId }, include: { classSession: true } })).resolves.toEqual(before)
  }, 120_000)

  it("detects stale commands and operation-key reuse", async () => {
    const input = command("conflict", { concreteSlots: [{ date: "2030-08-01", time: "10:00" }] })
    const created = await synchronizeSpecialClassAuthoring(prisma, input)
    await expect(synchronizeSpecialClassAuthoring(prisma, { ...input, course: { ...input.course, title: "Different" } }))
      .rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" } satisfies Partial<SpecialClassAuthoringError>)
    await expect(synchronizeSpecialClassAuthoring(prisma, command("conflict", {
      courseCatalogId: created.courseCatalogId, expectedUpdatedAt: new Date(0).toISOString(),
      concreteSlots: created.projections.map(({ slotId }) => ({ id: slotId, date: "2030-08-01", time: "10:00" })),
    }))).rejects.toMatchObject({ code: "AUTHORING_CONFLICT" } satisfies Partial<SpecialClassAuthoringError>)
    const current = await prisma.courseCatalog.findUniqueOrThrow({ where: { id: created.courseCatalogId } })
    await expect(synchronizeSpecialClassAuthoring(prisma, command("conflict", {
      courseCatalogId: created.courseCatalogId, expectedUpdatedAt: current.updatedAt.toISOString(),
      concreteSlots: [{ id: randomUUID(), date: "2030-08-01", time: "10:00" }],
    }))).rejects.toMatchObject({ code: "SLOT_ID_MISMATCH" } satisfies Partial<SpecialClassAuthoringError>)
  }, 120_000)

  it("rolls back the aggregate when a canonical room interval conflicts", async () => {
    const room = await prisma.room.create({ data: { name: `Authoring room ${randomUUID()}`, capacity: 20 } })
    await prisma.classSession.create({ data: { courseSlug: "other-course", startsAt: new Date("2030-09-01T14:00:00.000Z"), durationMinutes: 60, capacity: 10, roomId: room.id } })
    const before = await prisma.courseCatalog.count()
    await expect(synchronizeSpecialClassAuthoring(prisma, command("room-conflict", {
      course: { ...course("room-conflict"), defaultRoomId: room.id },
      concreteSlots: [{ date: "2030-09-01", time: "10:30" }],
    }))).rejects.toMatchObject({ code: "ROOM_CONFLICT" } satisfies Partial<SpecialClassAuthoringError>)
    await expect(prisma.courseCatalog.count()).resolves.toBe(before)
    await expect(prisma.courseCatalogAuthoringOperation.count({ where: { courseCatalog: { slug: "studio-room-conflict" } } })).resolves.toBe(0)
  }, 120_000)

  it("serializes concurrent retries of one operation", async () => {
    const input = command("concurrent", { concreteSlots: [{ date: "2030-10-01", time: "10:00" }] })
    const [left, right] = await Promise.all([
      synchronizeSpecialClassAuthoring(prisma, input), synchronizeSpecialClassAuthoring(prisma, input),
    ])
    expect(right).toEqual(left)
    await expect(prisma.courseCatalogAuthoringOperation.count({ where: { operationId: input.operationId } })).resolves.toBe(1)
  }, 120_000)

  it.each(["course", "slot", "projection", "audit", "receipt"] as const)(
    "rolls back every aggregate write when failure follows the %s stage",
    async (failedStage) => {
      const before = await mutationCounts()
      await expect(synchronizeSpecialClassAuthoring(
        prisma,
        command(`failure-${failedStage}`, { concreteSlots: [{ date: "2030-11-01", time: "10:00" }] }),
        { afterWrite: (stage) => { if (stage === failedStage) throw new Error(`injected-${stage}`) } },
      )).rejects.toThrow(`injected-${failedStage}`)
      await expect(mutationCounts()).resolves.toEqual(before)
    },
    120_000,
  )
})
