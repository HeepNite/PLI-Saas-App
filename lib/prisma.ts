import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })

// In production (serverless), each function instance gets its own PrismaClient.
// Cache on globalThis in dev to avoid exhausting connections during hot reload.
// In production, Prisma uses DATABASE_URL's ?connection_limit= param if present.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
