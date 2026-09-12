import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { isRaffleEventClosed } from "@/lib/raffle/event-window"
import { isRaffleSlug } from "@/lib/raffle/slug"
import RaffleEntryForm from "@/components/front/raffle/RaffleEntryForm"

export const dynamic = "force-dynamic"

export default async function RaffleEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!isRaffleSlug(slug)) notFound()

  const event = await prisma.raffleEvent.findUnique({
    where: { slug },
    select: { title: true, eventDate: true },
  })
  if (!event) notFound()

  const closed = isRaffleEventClosed(event.eventDate, new Date())

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10 dark:bg-neutral-950">
      <div className="w-full max-w-sm">
        <RaffleEntryForm slug={slug} eventTitle={event.title} initiallyClosed={closed} />
      </div>
    </main>
  )
}
