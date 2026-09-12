import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { parseRaffleEntryInput } from "@/lib/raffle/entry-validation"
import { createRaffleEntry } from "@/lib/raffle/entry"
import { isRaffleSlug } from "@/lib/raffle/slug"

export const runtime = "nodejs"

const rateLimited = (retryAfterSec: number) =>
  NextResponse.json(
    { status: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  )

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!isRaffleSlug(slug)) {
    return NextResponse.json({ status: "event_not_found" }, { status: 404 })
  }

  const ipRateLimit = consumeRateLimit({
    key: buildRateLimitKey("raffle:entry:ip", getClientIp(req)),
    limit: 10,
    windowMs: 60_000,
  })
  if (!ipRateLimit.ok) return rateLimited(ipRateLimit.retryAfterSec)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ status: "invalid_body" }, { status: 400 })
  }

  const parsed = parseRaffleEntryInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ status: parsed.status }, { status: 400 })
  }

  const phoneRateLimit = consumeRateLimit({
    key: buildRateLimitKey("raffle:entry:phone", parsed.value.phoneE164),
    limit: 5,
    windowMs: 300_000,
  })
  if (!phoneRateLimit.ok) return rateLimited(phoneRateLimit.retryAfterSec)

  const result = await createRaffleEntry(prisma, { slug, ...parsed.value })

  if (result.status === "entered") {
    return NextResponse.json({ status: "entered" }, { status: 201 })
  }
  if (result.status === "already_entered") {
    return NextResponse.json({ status: "already_entered" }, { status: 200 })
  }
  if (result.status === "event_not_found") {
    return NextResponse.json({ status: "event_not_found" }, { status: 404 })
  }
  return NextResponse.json({ status: "event_closed" }, { status: 410 })
}
