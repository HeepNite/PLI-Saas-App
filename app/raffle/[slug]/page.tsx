import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { isRaffleEventClosed } from "@/lib/raffle/event-window"
import { isRaffleSlug } from "@/lib/raffle/slug"
import RaffleEntryForm from "@/components/front/raffle/RaffleEntryForm"
import RaffleBackdrop from "@/components/front/raffle/RaffleBackdrop"

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
    <main>
      <RaffleBackdrop className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-8">
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-neutral-950/95 sm:p-6">
          <RaffleEntryForm slug={slug} eventTitle={event.title} initiallyClosed={closed} />
        </div>
      </RaffleBackdrop>
    </main>
  )
}
