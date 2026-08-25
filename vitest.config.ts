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
    // The app operates entirely in America/New_York (CHECKIN_TIME_ZONE). Pin the
    // test timezone so date/weekday-sensitive suites (e.g. staff student sessions)
    // are deterministic regardless of the CI runner's timezone (CI runs UTC).
    env: {
      TZ: "America/New_York",
    },
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
