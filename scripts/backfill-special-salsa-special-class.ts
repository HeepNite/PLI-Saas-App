import { prisma } from "@/lib/prisma"
import { backfillSpecialSalsa } from "@/lib/special-classes/backfill-special-salsa"

backfillSpecialSalsa(prisma, { dryRun: process.argv.includes("--dry-run") })
  .then((report) => console.info("special-class-backfill", report))
  .catch((error) => { console.error("special-class-backfill-failed", { message: error instanceof Error ? error.message : "unknown" }); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
