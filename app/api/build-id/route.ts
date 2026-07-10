import { NextResponse } from "next/server"

import { UNKNOWN_BUILD_ID } from "@/lib/checkin/kiosk-deploy-refresh"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/build-id
 *
 * Public, dependency-free endpoint (no prisma, no auth) that reports the
 * currently deployed build id. The kiosk terminal polls it to detect new
 * Vercel deployments and reload itself when idle. It must never 401: the
 * middleware only guards /api/staff/* paths, so this route passes through.
 */
export function GET() {
  const buildId =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    UNKNOWN_BUILD_ID

  return NextResponse.json(
    { buildId },
    { headers: { "Cache-Control": "no-store" } }
  )
}
