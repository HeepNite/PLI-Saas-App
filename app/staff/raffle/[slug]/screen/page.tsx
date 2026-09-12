import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { isRaffleSlug, screenCookieName, screenTokenMatches } from "@/lib/raffle/screen-token"
import RaffleScreen from "@/components/front/raffle/RaffleScreen"

export const dynamic = "force-dynamic"

type RaffleScreenPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ key?: string }>
}

/**
 * `GET /staff/raffle/[slug]/screen[?key=]` — tablet screen entry point
 * (design.md D2). No Clerk: authorization is the per-event screen cookie,
 * exchanged for a `?key=` by `/api/raffle/[slug]/screen-session`, which is
 * the only place allowed to set a cookie (a server component may not set
 * one during render). A request carrying `?key=` is redirected there
 * immediately; the exchange route sets the cookie and 302s back here
 * without `key`. With neither a valid cookie nor a valid key, 404 — never
 * 401, so an unauthenticated probe learns nothing about the event.
 */
export default async function RaffleScreenPage({ params, searchParams }: RaffleScreenPageProps) {
  const { slug } = await params
  if (!isRaffleSlug(slug)) notFound()

  const { key } = await searchParams
  if (key) {
    redirect(`/api/raffle/${encodeURIComponent(slug)}/screen-session?key=${encodeURIComponent(key)}`)
  }

  const event = await prisma.raffleEvent.findUnique({ where: { slug }, select: { screenTokenHash: true } })
  if (!event) notFound()

  const rawToken = (await cookies()).get(screenCookieName(slug))?.value
  if (!rawToken || !screenTokenMatches(rawToken, event.screenTokenHash)) notFound()

  return <RaffleScreen slug={slug} />
}
