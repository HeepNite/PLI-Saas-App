import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getOctober2026RaffleEvent } from "@/lib/raffle/october-2026-events"
import { screenCookieName, screenTokenMatches } from "@/lib/raffle/screen-token"
import RaffleBackdrop from "@/components/front/raffle/RaffleBackdrop"
import RaffleAccessForm from "@/components/front/raffle/RaffleAccessForm"

export const dynamic = "force-dynamic"
export const metadata = { title: "Raffle tablet access", robots: { index: false, follow: false } }

export default async function RifaDayPage({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params
  const event = getOctober2026RaffleEvent(day)
  if (!event) notFound()

  const rawToken = (await cookies()).get(screenCookieName(event.slug))?.value
  if (rawToken) {
    const storedEvent = await prisma.raffleEvent.findUnique({
      where: { slug: event.slug },
      select: { screenTokenHash: true },
    })
    if (storedEvent && screenTokenMatches(rawToken, storedEvent.screenTokenHash)) {
      redirect(`/staff/raffle/${event.slug}/screen`)
    }
  }

  return (
    <RaffleBackdrop className="min-h-screen flex flex-col items-center justify-center gap-8 p-6 text-white">
      <main className="w-full max-w-md space-y-5 rounded-2xl border border-white/20 bg-black/70 p-6">
        <p className="text-sm text-white/70">{event.title}</p>
        <h1 className="text-2xl font-semibold">Raffle tablet access</h1>
        <p>Open the original private link once in this browser, or enter your private access key below.</p>
        <p className="text-sm text-white/70">Then use {event.tabletPath} to return for up to 36 hours. A different browser, a cleared cookie, or an expired session needs authorization again.</p>
        <RaffleAccessForm slug={event.slug} />
      </main>
    </RaffleBackdrop>
  )
}
