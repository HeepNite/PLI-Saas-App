// Minimal in-memory Prisma double supporting only the query shapes the terminal-charge code uses.
import { vi } from "vitest"

type Row = Record<string, unknown>

const isPlainObject = (value: unknown): value is Row =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)
const comparable = (value: unknown) => (value instanceof Date ? value.getTime() : value) as number

const matchesCondition = (actual: unknown, condition: unknown): boolean => {
  if (condition === null) return actual === null || actual === undefined
  if (!isPlainObject(condition)) return comparable(actual) === comparable(condition)
  if ("path" in condition) return true // JSON path filters are not modelled
  return Object.entries(condition).every(([op, expected]) => {
    if (op === "in") return (expected as unknown[]).includes(actual)
    if (op === "not") return !matchesCondition(actual, expected)
    if (op === "lte") return comparable(actual) <= comparable(expected)
    if (op === "gt") return comparable(actual) > comparable(expected)
    if (op === "gte") return comparable(actual) >= comparable(expected)
    if (op === "lt") return comparable(actual) < comparable(expected)
    return true
  })
}

export const matchesWhere = (row: Row, where: Row | undefined): boolean =>
  Object.entries(where ?? {}).every(([key, condition]) => {
    if (key === "OR") return (condition as Row[]).some((clause) => matchesWhere(row, clause))
    if (key === "AND") return (condition as Row[]).every((clause) => matchesWhere(row, clause))
    if (key === "NOT") return !matchesWhere(row, condition as Row)
    return condition === undefined || matchesCondition(row[key], condition)
  })

let idCounter = 0

export const createFakeDb = () => {
  const tables: Record<string, Row[]> = { staffTerminalCharge: [], staffTerminalChargeItem: [], purchase: [], user: [], staffTerminal: [], attendance: [], courseCatalog: [], stripeWebhookEvent: [], packagePlan: [] }

  const withRelations = (table: string, row: Row, include?: Row): Row => {
    const out = { ...row }
    if (table === "staffTerminalCharge" && include) {
      if (include.items) out.items = tables.staffTerminalChargeItem.filter((item) => item.chargeId === row.id).map((item) => ({ ...item }))
      if (include.terminal) out.terminal = tables.staffTerminal.find((terminal) => terminal.id === row.terminalId)
      if (include.payer) out.payer = tables.user.find((user) => user.id === row.payerUserId)
    }
    return out
  }
  const touch = (row: Row, data: Row) => Object.assign(row, data, { updatedAt: new Date(Date.now() + ++idCounter) })
  const insert = (table: string, data: Row) => {
    const now = new Date(Date.now() + ++idCounter)
    const row: Row = { createdAt: now, updatedAt: now, ...data, id: data.id || `${table}_${idCounter}` }
    if (table === "purchase") {
      if (tables.purchase.some((existing) => existing.idempotencyKey && existing.idempotencyKey === row.idempotencyKey)) {
        throw Object.assign(new Error("Unique constraint"), { code: "P2002" })
      }
      row.stripePaymentIntentId ??= null
    }
    tables[table].push(row)
    return row
  }

  const model = (table: string) => ({
    findUnique: vi.fn(async ({ where, include }: { where: Row; include?: Row }) => {
      const row = tables[table].find((candidate) => matchesWhere(candidate, where))
      return row ? withRelations(table, row, include) : null
    }),
    findFirst: vi.fn(async ({ where, include }: { where?: Row; include?: Row } = {}) => {
      const row = tables[table].find((candidate) => matchesWhere(candidate, where))
      return row ? withRelations(table, row, include) : null
    }),
    findMany: vi.fn(async ({ where }: { where?: Row } = {}) => tables[table].filter((row) => matchesWhere(row, where)).map((row) => ({ ...row }))),
    create: vi.fn(async ({ data, include }: { data: Row & { items?: { create: Row[] } }; include?: Row }) => {
      const { items, ...rest } = data
      const row = insert(table, rest)
      for (const item of items?.create ?? []) insert("staffTerminalChargeItem", { resultPurchaseId: null, ...item, chargeId: row.id })
      return withRelations(table, row, include)
    }),
    update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
      const row = tables[table].find((candidate) => matchesWhere(candidate, where))
      if (!row) throw Object.assign(new Error("Record not found"), { code: "P2025" })
      return { ...touch(row, data) }
    }),
    upsert: vi.fn(async ({ create }: { create: Row }) => ({ ...insert(table, create) })),
    updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
      const rows = tables[table].filter((candidate) => matchesWhere(candidate, where))
      rows.forEach((row) => touch(row, data))
      return { count: rows.length }
    }),
  })

  const db: Record<string, unknown> & { tables: typeof tables; $transaction: ReturnType<typeof vi.fn> } = {
    tables,
    ...Object.fromEntries(Object.keys(tables).map((table) => [table, model(table)])),
    classSession: { upsert: vi.fn(async () => ({ id: "session_x" })) },
    $executeRaw: vi.fn(async () => 1),
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
  }
  return db
}

export type FakeDb = ReturnType<typeof createFakeDb>

export const seedBasics = (db: FakeDb) => {
  db.tables.user.push({ id: "payer_1", name: "Pat Payer", email: "pat@example.com", phone: "+15550000001" }, { id: "other_1", name: "Other" })
  db.tables.staffTerminal.push({ id: "terminal_a", name: "Samsung", active: true }, { id: "terminal_b", name: "iPad", active: true })
  db.tables.courseCatalog.push({ slug: "salsa", dropInPriceCents: 2000 })
}
