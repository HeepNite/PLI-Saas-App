import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse, type NextRequest } from "next/server"

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Let CORS preflight requests through without auth processing.
  // Vercel Preview Toolbar (feedback.js) sends OPTIONS requests that Clerk
  // cannot handle, causing 400 responses and a client-side retry loop.
  if (req.method === "OPTIONS") {
    return NextResponse.next()
  }

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

  if (publicStaffApiPaths.has(pathname)) {
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

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
