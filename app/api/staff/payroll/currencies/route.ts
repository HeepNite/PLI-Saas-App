import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeOwnerRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:payroll:currencies:get", getClientIp(req)),
    limit: 120,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeOwnerRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const items = await prisma.currency.findMany({
      orderBy: { code: "asc" },
    })
    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ error: "Failed to load currencies." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:payroll:currencies:post", getClientIp(req)),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeOwnerRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { code, symbol, decimals, active } = body as {
    code: string
    symbol?: string
    decimals?: number
    active?: boolean
  }

  if (!code || typeof code !== "string" || code.length < 2 || code.length > 5) {
    return NextResponse.json({ error: "Invalid currency code (2-5 characters)." }, { status: 400 })
  }

  const normalizedCode = code.trim().toUpperCase()

  try {
    const existing = await prisma.currency.findUnique({
      where: { code: normalizedCode },
    })
    if (existing) {
      return NextResponse.json({ error: "Currency already exists." }, { status: 409 })
    }

    const item = await prisma.currency.create({
      data: {
        code: normalizedCode,
        symbol: symbol?.trim() || normalizedCode,
        decimals: typeof decimals === "number" ? decimals : 2,
        active: active ?? true,
      },
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Failed to create currency." }, { status: 500 })
  }
}
