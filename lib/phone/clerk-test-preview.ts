// Clerk's reserved test phones (+1 555-555-01xx) are accepted only on the
// codex/develop preview, which runs against the Clerk test instance.
// This module must stay dependency-free: next.config.ts imports it at build time.
export const isCodexDevelopClerkTestEnv = (env: NodeJS.ProcessEnv): boolean =>
  env.VERCEL_ENV === "preview" &&
  env.VERCEL_GIT_COMMIT_REF === "codex/develop" &&
  env.CLERK_SECRET_KEY?.startsWith("sk_test_") === true

// next.config.ts evaluates isCodexDevelopClerkTestEnv on the build server and
// inlines only the resulting "true"/"false" for browser code.
export const CLERK_TEST_PHONES_PUBLIC_FLAG = "NEXT_PUBLIC_CLERK_TEST_PHONES_ENABLED"
