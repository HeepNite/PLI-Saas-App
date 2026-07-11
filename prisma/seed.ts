// This seed script is intentionally CommonJS (run directly via node), so it
// uses require()/module.exports rather than ESM imports.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const CURRENCIES = [
  {
    code: "ARS",
    symbol: "$",
    decimals: 2,
    active: true,
  },
  {
    code: "USD",
    symbol: "USD",
    decimals: 2,
    active: true,
  },
]

async function seedCurrencies(client = prisma) {
  await Promise.all(
    CURRENCIES.map((currency) =>
      client.currency.upsert({
        where: { code: currency.code },
        update: {
          symbol: currency.symbol,
          decimals: currency.decimals,
          active: currency.active,
        },
        create: currency,
      })
    )
  )
}

async function main() {
  try {
    await seedCurrencies()
    console.log(`Seeded currencies: ${CURRENCIES.map((currency) => currency.code).join(", ")}`)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Currency seed failed", error)
    process.exitCode = 1
  })
}

module.exports = {
  CURRENCIES,
  seedCurrencies,
}
