import { randomUUID } from "crypto"
import path from "path"
import { mkdir, writeFile } from "fs/promises"
import { NextResponse } from "next/server"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

const IMAGE_MAX_BYTES = 8 * 1024 * 1024
const VIDEO_MAX_BYTES = 180 * 1024 * 1024
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"])
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".m4v"])

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

const resolveExtension = (filename: string, kind: MediaKind) => {
  const ext = path.extname(filename || "").toLowerCase()
  if (kind === "image" && IMAGE_EXTENSIONS.has(ext)) return ext
  if (kind === "video" && VIDEO_EXTENSIONS.has(ext)) return ext
  return kind === "image" ? ".jpg" : ".mp4"
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

  if (kind === "image" && !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed for image uploads." }, { status: 400 })
  }
  if (kind === "video" && !file.type.startsWith("video/")) {
    return NextResponse.json({ error: "Only video files are allowed for video uploads." }, { status: 400 })
  }

  const maxBytes = kind === "image" ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES
  if (file.size > maxBytes) {
    const maxMb = kind === "image" ? 8 : 180
    return NextResponse.json({ error: `File too large. Max ${maxMb}MB for ${kind}.` }, { status: 400 })
  }

  const extension = resolveExtension(file.name, kind)
  const folder = path.join(process.cwd(), "public", "uploads", "course-media")
  await mkdir(folder, { recursive: true })

  const filename = `${kind}-${Date.now()}-${randomUUID()}${extension}`
  const absoluteFilePath = path.join(folder, filename)
  const bytes = Buffer.from(await file.arrayBuffer())
  await writeFile(absoluteFilePath, bytes)

  return NextResponse.json({
    ok: true,
    kind,
    url: `/uploads/course-media/${filename}`,
  })
}
