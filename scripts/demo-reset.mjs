/**
 * Demo reset — Drops and re-seeds the demo database.
 * Cross-platform (Windows, Mac, Linux).
 *
 * Usage: node scripts/demo-reset.mjs
 */

import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

const ENV_FILE = ".env.demo"

function log(msg) {
  console.log(`\n📦 ${msg}`)
}

function run(cmd) {
  console.log(`  → ${cmd}`)
  execSync(cmd, { stdio: "inherit" })
}

async function main() {
  console.log("🎭 PLI Demo — Reset\n")

  if (!existsSync(ENV_FILE)) {
    console.error(`❌ No se encontró ${ENV_FILE}. Corré 'npm run demo:setup' primero.`)
    process.exit(1)
  }

  const isWin = process.platform === "win32"
  const binDir = resolve("node_modules", ".bin")
  const prismaCmd = resolve(binDir, isWin ? "prisma.cmd" : "prisma")
  const tsxCmd = resolve(binDir, isWin ? "tsx.cmd" : "tsx")

  log("Reseteando tablas...")
  run(`node --env-file=${ENV_FILE} "${prismaCmd}" db push --force-reset`)

  log("Seedeando datos de demostración...")
  run(`node --env-file=${ENV_FILE} "${tsxCmd}" prisma/seed-demo.ts`)

  console.log("\n✅ ¡Base de datos reseteada con datos frescos!\n")
}

main().catch((err) => {
  console.error(`❌ Reset falló: ${err.message}`)
  process.exit(1)
})
