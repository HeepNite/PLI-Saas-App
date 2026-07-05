import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server"

const clerkProtectedMiddleware = clerkMiddleware(async (auth, req: NextRequest) => {
  const allowE2eBypass =
    process.env.NODE_ENV !== "production" && req.nextUrl.searchParams.get("e2eAuth") === "1"

  if (allowE2eBypass) {
    return NextResponse.next()
  }

  const { pathname } = req.nextUrl

  const publicStaffApiPaths = new Set([
    "/api/staff/login/pin",
    "/api/staff/checkin/pin",
  ])

  // Terminal and checkin routes use STAFF_CHECKIN_TOKEN, not Clerk auth
  const tokenAuthPrefixes = [
    "/api/staff/terminal",
    "/api/staff/terminals",
    "/api/staff/checkin",
  ]

  if (
    publicStaffApiPaths.has(pathname) ||
    tokenAuthPrefixes.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next()
  }

  // Defense-in-depth: reject unauthenticated requests to staff API routes.
  // Individual routes still run their own authorizeStaffPortalRequest() checks,
  // but this catches any route that forgets to add one.
  if (pathname.startsWith("/api/staff")) {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  return NextResponse.next()
})

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  // Let CORS preflight requests through before Clerk auth processing.
  // Vercel Preview Toolbar (feedback.js) sends OPTIONS requests that Clerk
  // cannot handle, causing 400 responses and a client-side retry loop.
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204 })
  }

  return clerkProtectedMiddleware(req, event)
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
