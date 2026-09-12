import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { isRaffleEventClosed } from "@/lib/raffle/event-window"

export type CreateRaffleEntryInput = {
  slug: string
  name: string
  phoneE164: string
  phoneCountry: string
}

export type RaffleEntryOutcome = "entered" | "already_entered" | "event_closed" | "event_not_found"

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"

export const createRaffleEntry = async (
  db: typeof prisma,
  input: CreateRaffleEntryInput,
  now: Date = new Date()
): Promise<{ status: RaffleEntryOutcome }> => {
  const event = await db.raffleEvent.findUnique({ where: { slug: input.slug } })
  if (!event) return { status: "event_not_found" }

  if (isRaffleEventClosed(event.eventDate, now)) return { status: "event_closed" }

  try {
    await db.raffleEntry.create({
      data: {
        eventId: event.id,
        name: input.name,
        phoneE164: input.phoneE164,
        phoneCountry: input.phoneCountry,
      },
    })
    return { status: "entered" }
  } catch (error) {
    if (isUniqueConstraintError(error)) return { status: "already_entered" }
    throw error
  }
}
