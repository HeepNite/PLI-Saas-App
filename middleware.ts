import { clerkMiddleware, getAuth } from "@clerk/nextjs/server"
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server"

const clerk = clerkMiddleware()

export default function middleware(req: NextRequest, evt: NextFetchEvent) {
  const allowE2eBypass =
    process.env.NODE_ENV !== "production" && req.nextUrl.searchParams.get("e2eAuth") === "1"

  if (allowE2eBypass) {
    return NextResponse.next()
  }

  const { pathname } = req.nextUrl

  // Protected staff routes — check auth before Clerk middleware
  if (pathname.startsWith("/staff/portal") || pathname.startsWith("/staff/panel")) {
    const auth = getAuth(req)
    if (!auth.userId) {
      const nav = req.nextUrl.searchParams.get("nav")
      const redirectUrl = nav
        ? `/staff/checkin?nav=${encodeURIComponent(nav)}`
        : "/staff/checkin"
      return NextResponse.redirect(new URL(redirectUrl, req.url))
    }
  }

  return clerk(req, evt)
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
