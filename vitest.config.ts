import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  // Match Next.js: transform JSX with the automatic runtime so components that
  // rely on it (no explicit `import React`) render under the test runner.
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    allowOnly: false,
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
