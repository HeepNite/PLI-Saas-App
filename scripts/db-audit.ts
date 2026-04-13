import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function audit() {
  console.log("=== DATABASE AUDIT (READ-ONLY) ===\n")

  // 1. Table row counts
  console.log("--- TABLE ROW COUNTS ---")
  const counts = await prisma.$queryRaw<{ table_name: string; row_count: bigint }[]>`
    SELECT relname AS table_name, n_live_tup AS row_count
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY n_live_tup DESC
  `
  for (const row of counts) {
    console.log(`  ${row.table_name}: ${row.row_count}`)
  }

  // 2. Duplicate purchases (same user, same course, same day)
  console.log("\n--- POTENTIAL DUPLICATE PURCHASES ---")
  const dupPurchases = await prisma.$queryRaw<{ user_id: string; course: string; date: string; cnt: bigint }[]>`
    SELECT "userId" as user_id, "courseSlug" as course, DATE("createdAt")::text as date, COUNT(*) as cnt
    FROM "Purchase"
    GROUP BY "userId", "courseSlug", DATE("createdAt")
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 20
  `
  if (dupPurchases.length === 0) {
    console.log("  No same-day duplicate purchases found")
  } else {
    console.log(`  Found ${dupPurchases.length} user-course-day combos with multiple purchases:`)
    for (const row of dupPurchases) {
      console.log(`    userId=${row.user_id}, course=${row.course}, date=${row.date}, count=${row.cnt}`)
    }
  }

  // 2b. All purchases detail (only 12 rows, let's see them all)
  console.log("\n--- ALL PURCHASES (detail) ---")
  const allPurchases = await prisma.$queryRaw<{ id: string; user_id: string; course: string; amount: number; status: string; stripe_pi: string | null; created: Date }[]>`
    SELECT "id", "userId" as user_id, "courseSlug" as course, "amount", "status",
           "stripePaymentIntentId" as stripe_pi, "createdAt" as created
    FROM "Purchase"
    ORDER BY "createdAt" DESC
  `
  for (const row of allPurchases) {
    console.log(`  ${row.id} | user=${row.user_id} | ${row.course} | $${row.amount} | ${row.status} | stripe=${row.stripe_pi || 'null'} | ${row.created}`)
  }

  // 3. StudentPinAudit count and breakdown
  console.log("\n--- STUDENT PIN AUDIT ---")
  const pinAuditCount = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) as cnt FROM "StudentPinAudit"
  `
  console.log(`  Total entries: ${pinAuditCount[0]?.cnt}`)

  const pinAuditByAction = await prisma.$queryRaw<{ action: string; cnt: bigint }[]>`
    SELECT "action", COUNT(*) as cnt
    FROM "StudentPinAudit"
    GROUP BY "action"
    ORDER BY cnt DESC
  `
  for (const row of pinAuditByAction) {
    console.log(`    ${row.action}: ${row.cnt}`)
  }

  // 3b. Pin audit per student breakdown
  const pinAuditPerStudent = await prisma.$queryRaw<{ student_id: string; cnt: bigint }[]>`
    SELECT "userId" as student_id, COUNT(*) as cnt
    FROM "StudentPinAudit"
    GROUP BY "userId"
    ORDER BY cnt DESC
    LIMIT 10
  `
  console.log("  Per student (top 10):")
  for (const row of pinAuditPerStudent) {
    console.log(`    ${row.student_id}: ${row.cnt} entries`)
  }

  // 4. Check for orphaned records
  console.log("\n--- ORPHAN CHECKS ---")

  // Purchases without valid user
  const orphanPurchases = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) as cnt FROM "Purchase" p
    LEFT JOIN "User" u ON p."userId" = u."id"
    WHERE u."id" IS NULL
  `
  console.log(`  Purchases without valid user: ${orphanPurchases[0]?.cnt}`)

  // 5. Duplicate users (same email)
  console.log("\n--- POTENTIAL DUPLICATE USERS ---")
  const dupUsersByEmail = await prisma.$queryRaw<{ email: string; cnt: bigint }[]>`
    SELECT LOWER(TRIM("email")) as email, COUNT(*) as cnt
    FROM "User"
    WHERE "email" IS NOT NULL AND "email" != ''
    GROUP BY LOWER(TRIM("email"))
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 15
  `
  if (dupUsersByEmail.length === 0) {
    console.log("  No duplicate user emails found")
  } else {
    console.log(`  ${dupUsersByEmail.length} emails appearing more than once:`)
    for (const row of dupUsersByEmail) {
      console.log(`    "${row.email}" appears ${row.cnt} times`)
    }
  }

  // 5b. All users overview
  console.log("\n--- ALL USERS ---")
  const allUsers = await prisma.$queryRaw<{ id: string; email: string; name: string | null; created: Date }[]>`
    SELECT "id", "email", "name", "createdAt" as created
    FROM "User"
    ORDER BY "createdAt" DESC
  `
  for (const row of allUsers) {
    console.log(`  ${row.id} | ${row.email} | ${row.name || '(no name)'} | ${row.created}`)
  }

  // 6. Purchase status breakdown
  console.log("\n--- PURCHASE STATUS BREAKDOWN ---")
  const purchaseStatuses = await prisma.$queryRaw<{ status: string; cnt: bigint }[]>`
    SELECT "status", COUNT(*) as cnt
    FROM "Purchase"
    GROUP BY "status"
    ORDER BY cnt DESC
  `
  for (const row of purchaseStatuses) {
    console.log(`  ${row.status}: ${row.cnt}`)
  }

  // 7. Exact duplicate purchases (same user+amount within 5 min)
  console.log("\n--- EXACT DUPLICATE PURCHASES (same user+amount within 5 min) ---")
  const exactDups = await prisma.$queryRaw<{ user_id: string; amount: number; cnt: bigint; first_at: Date; last_at: Date }[]>`
    SELECT p1."userId" as user_id, p1."amount" as amount, COUNT(*) as cnt,
           MIN(p1."createdAt") as first_at, MAX(p1."createdAt") as last_at
    FROM "Purchase" p1
    JOIN "Purchase" p2 ON p1."userId" = p2."userId"
      AND p1."amount" = p2."amount"
      AND p1."id" != p2."id"
      AND ABS(EXTRACT(EPOCH FROM (p1."createdAt" - p2."createdAt"))) < 300
    GROUP BY p1."userId", p1."amount"
    ORDER BY cnt DESC
    LIMIT 20
  `
  if (exactDups.length === 0) {
    console.log("  No exact duplicates found")
  } else {
    console.log(`  ${exactDups.length} suspicious duplicate groups:`)
    for (const row of exactDups) {
      console.log(`    userId=${row.user_id}, amount=${row.amount}, count=${row.cnt}, range=${row.first_at}→${row.last_at}`)
    }
  }

  // 8. StudentProfile and StudentPinCredential health
  console.log("\n--- STUDENT PROFILES ---")
  const profiles = await prisma.$queryRaw<{ id: string; user_id: string }[]>`
    SELECT "id", "userId" as user_id FROM "StudentProfile"
  `
  for (const row of profiles) {
    console.log(`  ${row.id} | userId=${row.user_id}`)
  }

  const pins = await prisma.$queryRaw<{ id: string; user_id: string; status: string; kind: string }[]>`
    SELECT "id", "userId" as user_id, "status", "kind" FROM "StudentPinCredential"
  `
  console.log(`\n  Pin credentials (${pins.length}):`)
  for (const row of pins) {
    console.log(`    ${row.id} | user=${row.user_id} | ${row.kind} | ${row.status}`)
  }

  // 9. PackageUsageLedger - check for anomalies
  console.log("\n--- PACKAGE USAGE LEDGER ---")
  const ledgerEntries = await prisma.$queryRaw<{ id: string; delta: number; reason: string; created: Date }[]>`
    SELECT "id", "delta", "reason", "createdAt" as created FROM "PackageUsageLedger" ORDER BY "createdAt" DESC
  `
  for (const row of ledgerEntries) {
    console.log(`  ${row.id} | ${row.reason} | delta=${row.delta} | ${row.created}`)
  }

  // 10. ClassSessions overview
  console.log("\n--- CLASS SESSIONS ---")
  const sessions = await prisma.$queryRaw<{ id: string; slug: string; starts: Date }[]>`
    SELECT "id", "courseSlug" as slug, "startsAt" as starts FROM "ClassSession" ORDER BY "startsAt" DESC
  `
  for (const row of sessions) {
    console.log(`  ${row.id} | ${row.slug} | ${row.starts}`)
  }

  // 11. Empty tables that probably shouldn't be empty
  console.log("\n--- EMPTY TABLES REVIEW ---")
  const emptyTables = counts.filter(t => t.row_count === BigInt(0) && !t.table_name.startsWith("_"))
  console.log(`  ${emptyTables.length} empty tables: ${emptyTables.map(t => t.table_name).join(", ")}`)

  // 8. Staff accounts health
  console.log("\n--- STAFF ACCOUNTS ---")
  const staffCounts = await prisma.$queryRaw<{ cnt: bigint }[]>`SELECT COUNT(*) as cnt FROM "StaffAccount"`
  console.log(`  Total: ${staffCounts[0]?.cnt}`)

  const dupStaff = await prisma.$queryRaw<{ clerk_id: string; cnt: bigint }[]>`
    SELECT "clerkUserId" as clerk_id, COUNT(*) as cnt
    FROM "StaffAccount"
    GROUP BY "clerkUserId"
    HAVING COUNT(*) > 1
  `
  if (dupStaff.length > 0) {
    console.log(`  DUPLICATE clerk user IDs in StaffAccount:`)
    for (const row of dupStaff) {
      console.log(`    ${row.clerk_id}: ${row.cnt} entries`)
    }
  } else {
    console.log("  No duplicate staff accounts")
  }

  // 9. Indexes health - unused indexes
  console.log("\n--- UNUSED INDEXES (0 scans) ---")
  const unusedIdx = await prisma.$queryRaw<{ table: string; index: string; size: string }[]>`
    SELECT relname AS table, indexrelname AS index,
           pg_size_pretty(pg_relation_size(indexrelid)) AS size
    FROM pg_stat_user_indexes
    WHERE idx_scan = 0 AND schemaname = 'public'
    ORDER BY pg_relation_size(indexrelid) DESC
    LIMIT 15
  `
  for (const row of unusedIdx) {
    console.log(`  ${row.table}.${row.index} (${row.size})`)
  }

  // 10. Table bloat estimate
  console.log("\n--- TABLES WITH HIGH DEAD TUPLES ---")
  const bloat = await prisma.$queryRaw<{ table_name: string; live: bigint; dead: bigint; ratio: number }[]>`
    SELECT relname AS table_name, n_live_tup AS live, n_dead_tup AS dead,
           CASE WHEN n_live_tup > 0 THEN ROUND(n_dead_tup::numeric / n_live_tup * 100, 1) ELSE 0 END AS ratio
    FROM pg_stat_user_tables
    WHERE n_dead_tup > 10
    ORDER BY n_dead_tup DESC
    LIMIT 10
  `
  for (const row of bloat) {
    console.log(`  ${row.table_name}: ${row.live} live, ${row.dead} dead (${row.ratio}% bloat)`)
  }

  await prisma.$disconnect()
  console.log("\n=== AUDIT COMPLETE ===")
}

audit().catch((e) => {
  console.error("Audit failed:", e)
  prisma.$disconnect()
  process.exit(1)
})
