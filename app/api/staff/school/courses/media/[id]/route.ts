import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

// Course media is public marketing content: the public catalog API embeds
// these URLs and the response is served with `Cache-Control: public`.
// Reads are intentionally unauthenticated; uploads/mutations stay guarded
// in app/api/staff/school/courses/upload/route.ts.
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
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
