import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSpecialClassAvailability } from "@/lib/checkout/special-class-reservation"
import { SPECIAL_SALSA_CLASS, resolveSpecialClassPricing } from "@/lib/special-salsa-class/config"

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const now = new Date()
  const specialClass = await prisma.specialClass.findFirst({
    where: { slug, status: "published", classSession: { startsAt: { gt: now } } },
    include: { classSession: true },
  })
  if (!specialClass) return NextResponse.json({ error: "Special class not found" }, { status: 404 })
  const availability = await getSpecialClassAvailability(slug, now)
  return NextResponse.json({
    item: {
      slug: specialClass.slug,
      title: specialClass.title,
      description: specialClass.description,
      coverImageUrl: specialClass.coverImageUrl,
      priceCents: slug === SPECIAL_SALSA_CLASS.key ? resolveSpecialClassPricing(now).amountCents : specialClass.priceCents,
      currency: specialClass.currency,
      session: {
        startsAt: specialClass.classSession.startsAt,
        durationMinutes: specialClass.classSession.durationMinutes,
        location: specialClass.classSession.location,
        capacity: specialClass.classSession.capacity,
      },
      availability: availability ? { capacity: availability.capacity, remaining: availability.remaining } : null,
    },
  })
}
