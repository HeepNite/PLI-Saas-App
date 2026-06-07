import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function cleanup() {
  console.log("=== DATABASE CLEANUP (PRODUCTION) ===\n")

  // 1. Fix typos in user names
  console.log("--- 1. FIX USER NAME TYPOS ---")

  const fix1 = await prisma.$executeRaw`
    UPDATE "User" SET "name" = 'Elvira Gutierrez'
    WHERE "id" = 'cmmy14oqi0002ih04b3k7jy7x' AND "name" = 'elvria guittierrez'
  `
  console.log(`  elvria guittierrez → Elvira Gutierrez: ${fix1} row(s) updated`)

  const fix2 = await prisma.$executeRaw`
    UPDATE "User" SET "name" = 'Luis Calderon'
    WHERE "id" = 'cmn3x5d1y0002ic04bxvrn5zt' AND "name" = 'Luis  Calderon'
  `
  console.log(`  "Luis  Calderon" → "Luis Calderon": ${fix2} row(s) updated`)

  // 2. Fix Omer Melendez pin: rotation_required → active
  console.log("\n--- 2. FIX OMER MELENDEZ PIN ---")

  const fix3 = await prisma.$executeRaw`
    UPDATE "StudentPinCredential" SET "status" = 'active'
    WHERE "id" = 'cmn9ktttk0008la04m6jdxcp3'
      AND "userId" = 'cmn87epz40000l504o1mc6mwh'
      AND "status" = 'rotation_required'
  `
  console.log(`  Pin cmn9ktttk → rotation_required → active: ${fix3} row(s) updated`)

  // 3. Mark 3 pending purchases as paid
  console.log("\n--- 3. MARK PENDING PURCHASES AS PAID ---")

  const pendingIds = [
    'cmn9kxwla000aky04z5zst632',  // Fernando Sares
    'cmn87eq000002l504xc9p55ke',  // Omer Melendez
    'cmn6u7dya0003ih04e0g3ha4q',  // Elvira Gutierrez
  ]

  for (const id of pendingIds) {
    const updated = await prisma.$executeRaw`
      UPDATE "Purchase" SET "status" = 'paid', "updatedAt" = NOW()
      WHERE "id" = ${id} AND "status" = 'pending'
    `
    console.log(`  Purchase ${id}: ${updated} row(s) → paid`)
  }

  // 4. VACUUM ANALYZE
  console.log("\n--- 4. VACUUM ANALYZE ---")
  const tables = [
    "ClassSession",
    "Purchase",
    "KioskIdentificationSession",
    "PackagePurchase",
    "Attendance",
    "StaffTerminalSession",
    "StudentPinCredential",
    "StaffTerminal",
    "User",
    "StaffAccount",
  ]

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`VACUUM ANALYZE "${table}"`)
      console.log(`  VACUUM ANALYZE "${table}" ✓`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`  VACUUM ANALYZE "${table}" ✗ — ${msg}`)
    }
  }

  // 5. Verify final state
  console.log("\n--- VERIFICATION ---")

  const verifyUser1 = await prisma.$queryRaw<{ name: string }[]>`
    SELECT "name" FROM "User" WHERE "id" = 'cmmy14oqi0002ih04b3k7jy7x'
  `
  console.log(`  Elvira name: "${verifyUser1[0]?.name}"`)

  const verifyUser2 = await prisma.$queryRaw<{ name: string }[]>`
    SELECT "name" FROM "User" WHERE "id" = 'cmn3x5d1y0002ic04bxvrn5zt'
  `
  console.log(`  Luis name: "${verifyUser2[0]?.name}"`)

  const verifyPin = await prisma.$queryRaw<{ status: string }[]>`
    SELECT "status" FROM "StudentPinCredential" WHERE "id" = 'cmn9ktttk0008la04m6jdxcp3'
  `
  console.log(`  Omer pin status: "${verifyPin[0]?.status}"`)

  const verifyPurchases = await prisma.$queryRaw<{ status: string; cnt: bigint }[]>`
    SELECT "status", COUNT(*) as cnt FROM "Purchase" GROUP BY "status" ORDER BY cnt DESC
  `
  console.log("  Purchase statuses:")
  for (const row of verifyPurchases) {
    console.log(`    ${row.status}: ${row.cnt}`)
  }

  const verifyBloat = await prisma.$queryRaw<{ table_name: string; dead: bigint }[]>`
    SELECT relname AS table_name, n_dead_tup AS dead
    FROM pg_stat_user_tables
    WHERE schemaname = 'public' AND n_dead_tup > 5
    ORDER BY n_dead_tup DESC LIMIT 5
  `
  console.log("  Remaining bloat (top 5):")
  for (const row of verifyBloat) {
    console.log(`    ${row.table_name}: ${row.dead} dead tuples`)
  }

  await prisma.$disconnect()
  console.log("\n=== CLEANUP COMPLETE ===")
}

cleanup().catch((e) => {
  console.error("Cleanup failed:", e)
  prisma.$disconnect()
  process.exit(1)
})
