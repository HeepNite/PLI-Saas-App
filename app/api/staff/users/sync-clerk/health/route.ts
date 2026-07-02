import { NextResponse } from "next/server"
import { authorizeOwnerOrAdminRequest } from "@/lib/security/staff-portal-auth"
import { getClerkCoverage, listAllClerkUsers } from "../shared"

export const runtime = "nodejs"

const isClerkRateLimitError = (error: unknown) => {
  if (!error || typeof error !== "object") return false
  return (error as { status?: unknown }).status === 429
}

const retryAfterSecFrom = (error: unknown) => {
  if (!error || typeof error !== "object") return 30
  const retryAfter = (error as { headers?: Record<string, string> }).headers?.["retry-after"]
  const parsed = retryAfter ? Number(retryAfter) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : 30
}

const degradedHealth = (retryAfterSec?: number) =>
  NextResponse.json(
    {
      status: "degraded",
      error: "User sync status is temporarily unavailable. Try checking again shortly.",
    },
    {
      status: 200,
      headers: {
        "X-Staff-Service-Status": "degraded",
        ...(retryAfterSec ? { "Retry-After": String(retryAfterSec) } : {}),
      },
    }
  )

export async function GET() {
  const authResult = await authorizeOwnerOrAdminRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const clerkUsers = await listAllClerkUsers()
    const coverage = await getClerkCoverage(clerkUsers)

    return NextResponse.json({
      clerkUsers: clerkUsers.length,
      dbUsersWithClerkId: coverage.dbUsersWithClerkId,
      missingCount: coverage.missingUsers.length,
      missingUsers: coverage.missingUsers,
      mismatchedCount: coverage.mismatchedUsers.length,
      mismatchedUsers: coverage.mismatchedUsers,
    })
  } catch (error) {
    console.warn("Clerk sync health check degraded", error)
    if (isClerkRateLimitError(error)) return degradedHealth(retryAfterSecFrom(error))
    const status = error && typeof error === "object" ? (error as { status?: unknown }).status : null
    if (typeof status === "number" && status >= 500) return degradedHealth(30)
    return degradedHealth()
  }
}
