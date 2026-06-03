/**
 * Demo setup script — cross-platform (Windows, Mac, Linux).
 *
 * 1. Starts a Docker Postgres container
 * 2. Waits for it to be ready
 * 3. Pushes the Prisma schema
 * 4. Seeds demo data
 *
 * Usage: node scripts/demo-setup.mjs
 */

import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

const ENV_FILE = ".env.demo"
const CONTAINER_NAME = "pli-demo"
const DOCKER_IMAGE = "postgres:16"
const PG_PASSWORD = "demo"
const PG_DB = "pli_demo"
const PG_PORT = "5433"

function log(msg) {
  console.log(`\n📦 ${msg}`)
}

function error(msg) {
  console.error(`\n❌ ${msg}`)
}

function run(cmd, opts = {}) {
  console.log(`  → ${cmd}`)
  execSync(cmd, { stdio: "inherit", ...opts })
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Check if a command exists */
function commandExists(cmd) {
  try {
    execSync(
      process.platform === "win32" ? `where ${cmd}` : `which ${cmd}`,
      { stdio: "ignore" }
    )
    return true
  } catch {
    return false
  }
}

/** Check if Docker container already exists */
function containerExists(name) {
  try {
    const result = execSync(`docker ps -a --filter name=^/${name}$ --format "{{.Names}}"`, {
      encoding: "utf8",
    }).trim()
    return result === name
  } catch {
    return false
  }
}

/** Check if Docker container is running */
function containerRunning(name) {
  try {
    const result = execSync(`docker ps --filter name=^/${name}$ --format "{{.Names}}"`, {
      encoding: "utf8",
    }).trim()
    return result === name
  } catch {
    return false
  }
}

/** Wait for Postgres to accept connections */
async function waitForPostgres(maxRetries = 15) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      execSync(
        `docker exec ${CONTAINER_NAME} pg_isready -U postgres -d ${PG_DB}`,
        { stdio: "ignore" }
      )
      return true
    } catch {
      process.stdout.write(".")
      await sleep(1000)
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🎭 PLI Demo — Setup\n")

  // 1. Check prerequisites
  if (!existsSync(ENV_FILE)) {
    error(
      `No se encontró ${ENV_FILE}.\n` +
      `Copiá el archivo de ejemplo primero:\n\n` +
      `  cp .env.demo.example .env.demo\n\n` +
      `Después completá las keys de Clerk y volvé a correr este comando.`
    )
    process.exit(1)
  }

  if (!commandExists("docker")) {
    error(
      "Docker no está instalado.\n" +
      "Descargalo desde: https://www.docker.com/products/docker-desktop/\n" +
      "Instalalo, abrí Docker Desktop, y volvé a correr este comando."
    )
    process.exit(1)
  }

  // 2. Docker container
  if (containerRunning(CONTAINER_NAME)) {
    log(`Contenedor '${CONTAINER_NAME}' ya está corriendo ✓`)
  } else if (containerExists(CONTAINER_NAME)) {
    log(`Contenedor '${CONTAINER_NAME}' existe pero está apagado. Encendiendo...`)
    run(`docker start ${CONTAINER_NAME}`)
  } else {
    log("Creando contenedor de PostgreSQL...")
    run(
      `docker run -d --name ${CONTAINER_NAME} ` +
      `-e POSTGRES_PASSWORD=${PG_PASSWORD} ` +
      `-e POSTGRES_DB=${PG_DB} ` +
      `-p ${PG_PORT}:5432 ` +
      DOCKER_IMAGE
    )
  }

  // 3. Wait for Postgres
  log("Esperando a que Postgres esté listo...")
  const ready = await waitForPostgres()
  if (!ready) {
    error(
      "Postgres no respondió después de 15 segundos.\n" +
      "Verificá que Docker Desktop esté corriendo y volvé a intentar."
    )
    process.exit(1)
  }
  console.log(" ✓")

  // 4. Resolve binary paths (cross-platform)
  const isWin = process.platform === "win32"
  const binDir = resolve("node_modules", ".bin")
  const prismaCmd = resolve(binDir, isWin ? "prisma.cmd" : "prisma")
  const tsxCmd = resolve(binDir, isWin ? "tsx.cmd" : "tsx")

  // 5. Push schema
  log("Creando tablas en la base de datos...")
  run(`node --env-file=${ENV_FILE} "${prismaCmd}" db push --force-reset`)

  // 6. Seed
  log("Seedeando datos de demostración...")
  run(`node --env-file=${ENV_FILE} "${tsxCmd}" prisma/seed-demo.ts`)

  console.log("\n" + "=".repeat(50))
  console.log("🎉 ¡Setup completo!")
  console.log("=".repeat(50))
  console.log("\nPara iniciar el demo corré:\n")
  console.log("  npm run demo\n")
  console.log("Y abrí http://localhost:3000 en el navegador.\n")
}

main().catch((err) => {
  error(`Setup falló: ${err.message}`)
  process.exit(1)
})
