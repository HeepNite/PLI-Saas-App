import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server"

const clerk = clerkMiddleware()

export default function middleware(req: NextRequest, evt: NextFetchEvent) {
  const allowE2eBypass =
    process.env.NODE_ENV !== "production" && req.nextUrl.searchParams.get("e2eAuth") === "1"

  if (allowE2eBypass) {
    return NextResponse.next()
  }

  return clerk(req, evt)
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
