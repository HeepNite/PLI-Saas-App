import { randomUUID } from "node:crypto"
import { execSync } from "node:child_process"
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

  execSync(provisionCommand, {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: "pipe",
  })

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })

  await prisma.$connect()

  const cleanup = async () => {
    await prisma.$disconnect()
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
