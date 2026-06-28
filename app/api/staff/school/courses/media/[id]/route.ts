import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalSectionRequest } from "@/lib/security/staff-portal-auth"

export const runtime = "nodejs"

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const authResult = await authorizeStaffPortalSectionRequest("schedule")
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  const { id } = await context.params
  const mediaId = typeof id === "string" ? id.trim() : ""
  if (!mediaId) {
    return NextResponse.json({ error: "Media id is required." }, { status: 400 })
  }

  const media = await prisma.courseMedia.findUnique({
    where: { id: mediaId },
    select: {
      data: true,
      mimeType: true,
      sizeBytes: true,
      updatedAt: true,
    },
  })

  if (!media) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 })
  }

  const etag = `W/\"course-media-${mediaId}-${media.updatedAt.getTime()}\"`

  return new Response(media.data, {
    status: 200,
    headers: {
      "Content-Type": media.mimeType,
      "Content-Length": String(media.sizeBytes),
      "Cache-Control": `public, max-age=${MAX_AGE_SECONDS}, stale-while-revalidate=86400`,
      ETag: etag,
    },
  })
}
