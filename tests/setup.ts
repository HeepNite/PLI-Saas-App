import { vi } from "vitest"

// `server-only` is a runtime guard for Next.js modules and should be a no-op in node test runs.
vi.mock("server-only", () => ({}))
