import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse, type NextRequest } from "next/server"

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const allowE2eBypass =
    process.env.NODE_ENV !== "production" && req.nextUrl.searchParams.get("e2eAuth") === "1"

  if (allowE2eBypass) {
    return NextResponse.next()
  }

  const { pathname } = req.nextUrl

  // Protected staff routes — auth is already populated by clerkMiddleware callback
  if (pathname.startsWith("/staff/portal") || pathname.startsWith("/staff/panel")) {
    const { userId } = await auth()
    if (!userId) {
      const nav = req.nextUrl.searchParams.get("nav")
      const redirectUrl = nav
        ? `/staff/checkin?nav=${encodeURIComponent(nav)}`
        : "/staff/checkin"
      return NextResponse.redirect(new URL(redirectUrl, req.url))
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
