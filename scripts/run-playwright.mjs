import { spawn } from "node:child_process"

if (process.platform === "darwin" && process.arch === "arm64") {
  process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE = "mac-arm64"
}

const args = ["playwright", "test", ...process.argv.slice(2)]
const cmd = process.platform === "win32" ? "npx.cmd" : "npx"

const child = spawn(cmd, args, { stdio: "inherit", env: process.env })
child.on("exit", (code) => {
  process.exit(code ?? 0)
})
