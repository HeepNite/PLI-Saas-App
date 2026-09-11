import "dotenv/config"

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { prisma } from "@/lib/prisma"
import {
  generateRaffleScreenToken,
  nyMidnightUtc,
  parseRaffleSeedConfig,
  planDrawUpserts,
  resolveRaffleBaseUrl,
  type RaffleSeedConfig,
} from "@/lib/raffle/seed-plan"

/**
 * `npx tsx scripts/raffle-seed.ts <config.json> [--base-url <url>] [--rotate-token]`
 * See openspec/changes/event-raffle/design.md D8.
 */

export type SeedArgs = { configPath: string; baseUrlArg?: string; rotateToken: boolean }

export function parseSeedArgs(argv: string[]): SeedArgs {
  const positional = argv.filter((arg, index) => !arg.startsWith("--") && argv[index - 1] !== "--base-url")
  const configPath = positional[0]
  if (!configPath) {
    throw new Error("Usage: raffle:seed <config.json> [--base-url <url>] [--rotate-token]")
  }

  const baseUrlFlagIndex = argv.indexOf("--base-url")
  const baseUrlArg = baseUrlFlagIndex >= 0 ? argv[baseUrlFlagIndex + 1] : undefined
  const rotateToken = argv.includes("--rotate-token")

  return { configPath, baseUrlArg, rotateToken }
}

export type SeedLogger = Pick<Console, "log" | "warn" | "error">

export type SeedPrismaClient = {
  raffleEvent: {
    findUnique(args: { where: { slug: string } }): Promise<{ id: string; screenTokenHash: string } | null>
    upsert(args: unknown): Promise<{ id: string; slug: string }>
  }
  raffleDraw: {
    findMany(args: unknown): Promise<{ id: string; order: number; status: string }[]>
    create(args: unknown): Promise<unknown>
    update(args: unknown): Promise<unknown>
  }
}

export type RunRaffleSeedDeps = {
  prisma: SeedPrismaClient
  logger: SeedLogger
  rotateToken: boolean
  baseUrl: string
}

/**
 * Thin orchestration over the pure planning helpers in `lib/raffle/seed-plan.ts`.
 * Idempotent: re-running with the same slug never duplicates the event, never
 * generates a new token unless `rotateToken`, and never mutates a draw whose
 * status is not `open`.
 */
export async function runRaffleSeed(config: RaffleSeedConfig, deps: RunRaffleSeedDeps): Promise<void> {
  const { prisma: db, logger, rotateToken, baseUrl } = deps

  const existingEvent = await db.raffleEvent.findUnique({ where: { slug: config.slug } })
  // Empty string counts as "no usable token" — never mistaken for "already set" forever.
  const shouldGenerateToken = rotateToken || !existingEvent?.screenTokenHash
  const tokenPlan = shouldGenerateToken ? generateRaffleScreenToken() : null

  const eventDate = nyMidnightUtc(config.eventDate)

  const event = await db.raffleEvent.upsert({
    where: { slug: config.slug },
    create: {
      slug: config.slug,
      title: config.title,
      brand: config.brand,
      eventDate,
      excludePreviousWinners: config.excludePreviousWinners,
      videoUrl: config.videoUrl,
      // Guard on `existingEvent`, not just `tokenPlan` — this object is built eagerly either way.
      screenTokenHash:
        !existingEvent && !tokenPlan
          ? (() => {
              throw new Error("[raffle-seed] refusing to create an event without a screen token")
            })()
          : (tokenPlan?.hash ?? ""),
    },
    update: {
      title: config.title,
      brand: config.brand,
      eventDate,
      excludePreviousWinners: config.excludePreviousWinners,
      videoUrl: config.videoUrl,
      ...(tokenPlan ? { screenTokenHash: tokenPlan.hash } : {}),
    },
  })

  // Print the raw token now, before a draw write can interrupt the run — never re-printable.
  if (tokenPlan) {
    logger.log(
      `[raffle-seed] tablet URL (raw token shown once, never re-printable): ${baseUrl}/api/raffle/${event.slug}/screen-session?key=${tokenPlan.raw}`
    )
  }

  const existingDraws = await db.raffleDraw.findMany({ where: { eventId: event.id } })
  const plan = planDrawUpserts(config.draws, existingDraws)

  for (const draw of plan.toCreate) {
    await db.raffleDraw.create({
      data: {
        eventId: event.id,
        order: draw.order,
        prizeLabel: draw.prizeLabel,
        drawAt: draw.drawAt ? new Date(draw.drawAt) : null,
      },
    })
  }

  for (const draw of plan.toUpdate) {
    await db.raffleDraw.update({
      where: { id: draw.id },
      data: { prizeLabel: draw.prizeLabel, drawAt: draw.drawAt },
    })
  }

  for (const skipped of plan.toSkip) {
    logger.warn(`[raffle-seed] draw order ${skipped.order} skipped — status is "${skipped.status}", not "open"`)
  }

  logger.log(`[raffle-seed] event "${event.slug}" ready.`)
  logger.log(`[raffle-seed] public URL: ${baseUrl}/raffle/${event.slug}`)

  if (tokenPlan) {
    logger.log(
      `[raffle-seed] tablet URL (raw token shown once, never re-printable): ${baseUrl}/api/raffle/${event.slug}/screen-session?key=${tokenPlan.raw}`
    )
  } else {
    logger.log(
      "[raffle-seed] screen token already set — re-run with --rotate-token to issue a new tablet URL (the raw token cannot be re-printed once generated)."
    )
  }
}

async function main() {
  const args = parseSeedArgs(process.argv.slice(2))
  const rawConfig = readFileSync(resolve(process.cwd(), args.configPath), "utf-8")

  const parsed = parseRaffleSeedConfig(JSON.parse(rawConfig))
  if (!parsed.ok) {
    console.error("[raffle-seed] invalid config:")
    parsed.errors.forEach((error) => console.error(`  - ${error}`))
    process.exitCode = 1
    return
  }

  const baseUrl = resolveRaffleBaseUrl({
    baseUrlArg: args.baseUrlArg,
    siteUrlEnv: process.env.NEXT_PUBLIC_SITE_URL,
    vercelUrlEnv: process.env.VERCEL_URL,
  })

  await runRaffleSeed(parsed.value, {
    prisma: prisma as unknown as SeedPrismaClient,
    logger: console,
    rotateToken: args.rotateToken,
    baseUrl,
  })
}

const isDirectExecution = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false

if (isDirectExecution) {
  main().catch((error) => {
    console.error("[raffle-seed] fatal error", error)
    process.exitCode = 1
  })
}
