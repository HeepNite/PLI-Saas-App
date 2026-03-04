declare namespace NodeJS {
  interface ProcessEnv {
    STRIPE_SECRET_KEY?: string
    STRIPE_WEBHOOK_SECRET?: string
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string
    NEXT_PUBLIC_SITE_URL?: string
    VERCEL_URL?: string
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string
    CLERK_SECRET_KEY?: string
    DATABASE_URL?: string
    STAFF_CHECKIN_TOKEN?: string
    STAFF_TERMINAL_SECRET?: string
  }
}
