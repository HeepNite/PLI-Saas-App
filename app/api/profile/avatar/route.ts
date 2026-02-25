import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_AVATAR_SIZE = 5 * 1024 * 1024

export async function POST(req: Request) {
  try {
    const rateLimit = consumeRateLimit({
      key: buildRateLimitKey("profile:avatar:post", getClientIp(req)),
      limit: 12,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
      )
    }

    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Archivo inválido." }, { status: 400 })
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Formato de imagen no permitido." }, { status: 400 })
    }
    if (file.size > MAX_AVATAR_SIZE) {
      return NextResponse.json({ error: "La imagen supera el tamaño permitido (5MB)." }, { status: 400 })
    }

    const client = await clerkClient()
    const updated = await client.users.updateUserProfileImage(authResult.userId, { file })

    return NextResponse.json({ imageUrl: updated.imageUrl })
  } catch (error) {
    console.error("Avatar update failed", error)
    return NextResponse.json({ error: "No se pudo actualizar el avatar." }, { status: 500 })
  }
}
