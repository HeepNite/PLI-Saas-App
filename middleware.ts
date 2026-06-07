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
