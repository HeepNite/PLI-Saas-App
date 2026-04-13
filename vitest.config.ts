import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: [
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
      "components/**/*.test.ts",
      "components/**/*.test.tsx",
    ],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
    },
  },
})
