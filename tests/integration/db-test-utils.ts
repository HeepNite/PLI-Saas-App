import { randomUUID } from "node:crypto"
import { execSync } from "node:child_process"
import { cpSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"
import { PrismaClient } from "@prisma/client"
import dotenv from "dotenv"

type IntegrationDbContext = {
  prisma: PrismaClient
  schema: string
  databaseUrl: string
  cleanup: () => Promise<void>
}

const loadEnvForDb = () => {
  dotenv.config({ path: ".env" })
  dotenv.config({ path: ".env.local", override: true })
}

const withSchema = (databaseUrl: string, schema: string) => {
  const url = new URL(databaseUrl)
  url.searchParams.set("schema", schema)
  return url.toString()
}

const withoutSchema = (databaseUrl: string) => {
  const url = new URL(databaseUrl)
  url.searchParams.delete("schema")
  return url.toString()
}

const setupDb = async (provisionCommand: string): Promise<IntegrationDbContext> => {
  loadEnvForDb()
  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) {
    throw new Error("Missing DATABASE_URL for integration tests.")
  }

  const schema = `it_${Date.now()}_${randomUUID().slice(0, 8)}`
  const databaseUrl = withSchema(baseUrl, schema)
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })
  const cleanup = async () => {
    let disconnectError: unknown
    try { await prisma.$disconnect() } catch (error) { disconnectError = error }
    if (!/^it_\d+_[0-9a-f]{8}$/.test(schema)) throw new Error("Refusing to drop a non-integration schema.")
    const admin = new PrismaClient({
      datasources: {
        db: {
          url: withoutSchema(baseUrl),
        },
      },
    })
    try {
      await admin.$connect()
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    } finally {
      await admin.$disconnect()
    }
    if (disconnectError) throw disconnectError
  }

  let ready = false
  try {
    execSync(provisionCommand, { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" })
    await prisma.$connect()
    ready = true
  } finally {
    if (!ready) await cleanup()
  }

  return {
    prisma,
    schema,
    databaseUrl,
    cleanup,
  }
}

export const setupIntegrationDb = () => setupDb("npx prisma db push --skip-generate")
export const setupMigratedIntegrationDb = () => setupDb("npx prisma migrate deploy")

export const setupMigrationRehearsalDb = async (latestMigration: string) => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "pli-prisma-"))
  const temporaryPrisma = join(temporaryRoot, "prisma")
  try {
    cpSync(resolve("prisma"), temporaryPrisma, {
      recursive: true,
      filter: (source) => basename(source) !== latestMigration,
    })
    const context = await setupDb(`npx prisma migrate deploy --schema "${join(temporaryPrisma, "schema.prisma")}"`)
    return {
      ...context,
      deployLatest: () => execSync("npx prisma migrate deploy", {
        env: { ...process.env, DATABASE_URL: context.databaseUrl },
        stdio: "pipe",
      }),
      cleanup: async () => {
        try { await context.cleanup() } finally { rmSync(temporaryRoot, { recursive: true, force: true }) }
      },
    }
  } catch (error) {
    rmSync(temporaryRoot, { recursive: true, force: true })
    throw error
  }
}
