import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getSpecialClassAvailability } from "@/lib/checkout/special-class-reservation"
import PublicSpecialClass from "@/components/front/special-classes/PublicSpecialClass"
import { SPECIAL_SALSA_CLASS, resolveSpecialClassPricing } from "@/lib/special-salsa-class/config"

export const dynamic = "force-dynamic"

export default async function SpecialClassPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const now = new Date()
  const specialClass = await prisma.specialClass.findFirst({ where: { slug, status: "published", classSession: { startsAt: { gt: now } } }, include: { classSession: true } })
  if (!specialClass) notFound()
  const availability = await getSpecialClassAvailability(slug, now)
  return <PublicSpecialClass item={{
    slug, title: specialClass.title, description: specialClass.description, coverImageUrl: specialClass.coverImageUrl,
    priceCents: slug === SPECIAL_SALSA_CLASS.key ? resolveSpecialClassPricing(now).amountCents : specialClass.priceCents, currency: specialClass.currency,
    session: { startsAt: specialClass.classSession.startsAt.toISOString(), durationMinutes: specialClass.classSession.durationMinutes, location: specialClass.classSession.location, capacity: specialClass.classSession.capacity },
    availability,
  }} />
}
