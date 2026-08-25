import { randomUUID } from "crypto"
import path from "path"
import { mkdir, writeFile } from "fs/promises"
import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { extractStaffRoleFromUserMetadata } from "@/lib/security/staff-role"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"])

const safeExtension = (filename: string) => {
  const ext = path.extname(filename || "").toLowerCase()
  if (ALLOWED_EXTENSIONS.has(ext)) return ext
  return ".jpg"
}

export async function POST(req: Request, context: { params: Promise<{ userId: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:users:gallery-upload:post", getClientIp(req)),
    limit: 80,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  const client = await clerkClient()
  const targetUser = await client.users.getUser(userId)
  const targetRole = extractStaffRoleFromUserMetadata(targetUser)
  if (authResult.role !== "owner" && targetRole === "owner") {
    return NextResponse.json({ error: "Admins cannot upload gallery for Owner user." }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required." }, { status: 400 })
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 })
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image too large. Max 8MB." }, { status: 400 })
  }

  const extension = safeExtension(file.name)
  const folder = path.join(process.cwd(), "public", "uploads", "staff-gallery")
  await mkdir(folder, { recursive: true })

  const filename = `${userId}-${Date.now()}-${randomUUID()}${extension}`
  const absoluteFilePath = path.join(folder, filename)
  const bytes = Buffer.from(await file.arrayBuffer())
  await writeFile(absoluteFilePath, bytes)

  return NextResponse.json({
    ok: true,
    url: `/uploads/staff-gallery/${filename}`,
  })
}
