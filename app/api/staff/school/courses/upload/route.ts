import { NextResponse } from "next/server"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const IMAGE_MAX_BYTES = 2 * 1024 * 1024
const VIDEO_MAX_BYTES = 15 * 1024 * 1024
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const ALLOWED_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"])

type MediaKind = "image" | "video"

const normalizeKind = (value: unknown): MediaKind | null => {
  if (value === "image" || value === "video") return value
  return null
}

const inferKindFromMime = (mime: string): MediaKind | null => {
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  return null
}

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:school:courses:upload:post", getClientIp(req)),
    limit: 40,
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

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Media file is required." }, { status: 400 })
  }

  const requestedKind = normalizeKind(formData.get("kind"))
  const inferredKind = inferKindFromMime(file.type)
  const kind = requestedKind || inferredKind
  if (!kind) {
    return NextResponse.json({ error: "Unsupported media type." }, { status: 400 })
  }

  if (kind === "image" && !ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only jpeg/png/webp images are allowed." }, { status: 400 })
  }
  if (kind === "video" && !ALLOWED_VIDEO_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only mp4/webm videos are allowed." }, { status: 400 })
  }

  const maxBytes = kind === "image" ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES
  if (file.size > maxBytes) {
    const maxMb = kind === "image" ? 2 : 15
    return NextResponse.json({ error: `File too large. Max ${maxMb}MB for ${kind}.` }, { status: 400 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const created = await prisma.courseMedia.create({
    data: {
      kind,
      mimeType: file.type,
      sizeBytes: file.size,
      data: bytes,
    },
    select: { id: true },
  })

  return NextResponse.json({
    ok: true,
    kind,
    mediaId: created.id,
    url: `/api/staff/school/courses/media/${created.id}`,
  })
}
