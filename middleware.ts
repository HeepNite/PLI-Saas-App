import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse, type NextRequest } from "next/server"

const IS_DEMO = process.env.DEMO_MODE === "true"

/**
 * Routes allowed in demo mode.
 * Everything else (public landing, courses, programs, search, etc.) gets
 * redirected to /staff so the demo only exposes the CRM / kiosk / client profile.
 */
const DEMO_ALLOWED_PREFIXES = [
  "/staff",
  "/client-profile",
  "/checkin",
  "/api",
  "/sign-in",
  "/sign-up",
  "/_next",
  "/favicon.ico",
]

function isDemoAllowed(pathname: string): boolean {
  return DEMO_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const allowE2eBypass =
    process.env.NODE_ENV !== "production" && req.nextUrl.searchParams.get("e2eAuth") === "1"

  if (allowE2eBypass) {
    return NextResponse.next()
  }

  const { pathname } = req.nextUrl

  // --- Demo mode: block public website, force Spanish locale ---
  if (IS_DEMO) {
    // Redirect public routes to staff entry point
    if (!isDemoAllowed(pathname)) {
      const staffUrl = req.nextUrl.clone()
      staffUrl.pathname = "/staff"
      return NextResponse.redirect(staffUrl)
    }

    // Force Spanish locale cookie if not already set
    const langCookie = req.cookies.get("lang")?.value
    if (langCookie !== "es") {
      const response = NextResponse.next()
      response.cookies.set("lang", "es", {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      })
      return response
    }
  }

  // Protected staff routes — auth is already populated by clerkMiddleware callback
  // Let pages handle their own auth to avoid redirect loops
  // The pages will redirect to log-in if needed

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
