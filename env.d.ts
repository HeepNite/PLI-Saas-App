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
    NEXT_PUBLIC_SENTRY_DSN?: string
    SENTRY_AUTH_TOKEN?: string
    SENTRY_ORG?: string
    SENTRY_PROJECT?: string
  }
}
