declare namespace NodeJS {
  interface ProcessEnv {
    STRIPE_SECRET_KEY?: string
    STRIPE_WEBHOOK_SECRET?: string
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string
    NEXT_PUBLIC_SITE_URL?: string
    VERCEL_URL?: string
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string
    CLERK_SECRET_KEY?: string
    CLERK_WEBHOOK_SIGNING_SECRET?: string
    DATABASE_URL?: string
    STAFF_CHECKIN_TOKEN?: string
    STAFF_TERMINAL_SECRET?: string
    STAFF_PIN_PEPPER?: string
    STUDENT_PIN_PEPPER?: string
    // CLERK_SOURCE_SECRET_KEY / CLERK_TARGET_SECRET_KEY are consumed ONLY by
    // the local, non-deployed scripts/migrate-clerk-instance.ts script via
    // dotenv on the operator's machine. They MUST NEVER be set in Vercel
    // (any environment) — declared here purely for local script type-checking.
    CLERK_SOURCE_SECRET_KEY?: string
    CLERK_TARGET_SECRET_KEY?: string
    NEXT_PUBLIC_SENTRY_DSN?: string
    SENTRY_AUTH_TOKEN?: string
    SENTRY_ORG?: string
    SENTRY_PROJECT?: string
  }
}
