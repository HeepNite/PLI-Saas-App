/**
 * Demo dev server — Loads .env.demo and starts Next.js dev.
 * Cross-platform (Windows, Mac, Linux).
 *
 * Usage: node scripts/demo-dev.mjs
 */

import { spawn } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

const ENV_FILE = ".env.demo"

if (!existsSync(ENV_FILE)) {
  console.error(
    `❌ No se encontró ${ENV_FILE}.\n` +
    `Copiá el archivo de ejemplo primero:\n\n` +
    `  cp .env.demo.example .env.demo\n\n` +
    `Después completá las keys de Clerk y volvé a correr este comando.`
  )
  process.exit(1)
}

// Parse .env.demo and inject into process.env
const envContent = readFileSync(ENV_FILE, "utf8")
const envVars = {}
for (const line of envContent.split("\n")) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) continue
  const eqIndex = trimmed.indexOf("=")
  if (eqIndex === -1) continue
  const key = trimmed.slice(0, eqIndex).trim()
  const value = trimmed.slice(eqIndex + 1).trim()
  envVars[key] = value
}

const isWin = process.platform === "win32"
const nextCmd = resolve("node_modules", ".bin", isWin ? "next.cmd" : "next")

const child = spawn(nextCmd, ["dev"], {
  stdio: "inherit",
  env: { ...process.env, ...envVars },
  shell: isWin,
})

child.on("exit", (code) => process.exit(code ?? 0))
