import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { screenCookieName, screenTokenMatches } from "@/lib/raffle/screen-token"
import RaffleBackdrop from "@/components/front/raffle/RaffleBackdrop"
import RaffleAccessForm from "@/components/front/raffle/RaffleAccessForm"

export const dynamic = "force-dynamic"
export const metadata = { title: "Raffle tablet access", robots: { index: false, follow: false } }

const TEST_EVENT_SLUG = "raffle-tablet-test-20260912t234420593z"

export default async function RifaPage() {
  const rawToken = (await cookies()).get(screenCookieName(TEST_EVENT_SLUG))?.value
  if (rawToken) {
    const event = await prisma.raffleEvent.findUnique({
      where: { slug: TEST_EVENT_SLUG },
      select: { screenTokenHash: true },
    })
    if (event && screenTokenMatches(rawToken, event.screenTokenHash)) {
      redirect(`/staff/raffle/${TEST_EVENT_SLUG}/screen`)
    }
  }

  return (
    <RaffleBackdrop className="min-h-screen flex flex-col items-center justify-center gap-8 p-6 text-white">
      <main className="w-full max-w-md space-y-5 rounded-2xl border border-white/20 bg-black/70 p-6">
        <p className="text-sm text-white/70">Tablet test event</p>
        <h1 className="text-2xl font-semibold">Raffle tablet access</h1>
        <p>Open the original private link once in this browser, or enter your private access key below.</p>
        <p className="text-sm text-white/70">Then use /rifa to return for up to 36 hours. A different browser, a cleared cookie, or an expired session needs authorization again.</p>
        <RaffleAccessForm slug={TEST_EVENT_SLUG} />
      </main>
    </RaffleBackdrop>
  )
}
