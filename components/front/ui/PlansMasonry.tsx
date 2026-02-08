"use client"

import React from "react"
import { Check, ChevronDown, Filter, Moon, Sun, Users } from "lucide-react"

type Plan = {
  id: string
  title: string
  category: "Morning Programs" | "Night Programs" | "Social Programs"
  price: string
  period: string
  perks: string[]
  badge?: string
  note?: string
}

const PLAN_CATEGORIES: Plan["category"][] = ["Morning Programs", "Night Programs", "Social Programs"]

const plans: Plan[] = [
  // Morning programs
  {
    id: "morning-3-week",
    title: "Morning 3-week pack",
    category: "Morning Programs",
    price: "$145",
    period: "/3 weeks",
    perks: ["3 weeks", "8 classes", "8 make-up classes"],
    badge: "Zumba",
  },
  {
    id: "morning-2-week",
    title: "Morning 2-week pack",
    category: "Morning Programs",
    price: "$125",
    period: "/2 weeks",
    perks: ["2 weeks", "5 classes", "5 make-up classes"],
  },
  {
    id: "morning-1-week",
    title: "Morning 1-week pack",
    category: "Morning Programs",
    price: "$90",
    period: "/1 week",
    perks: ["1 week", "3 classes", "3 make-up classes"],
  },
  {
    id: "morning-6-month",
    title: "Morning 6-month pack",
    category: "Morning Programs",
    price: "$480",
    period: "/6 months",
    perks: ["6 months", "1 daily class", "No make-ups included"],
    badge: "Musical stimulation for babies",
  },
  {
    id: "morning-single",
    title: "Morning Single",
    category: "Morning Programs",
    price: "$25",
    period: "/class",
    perks: ["Single class", "Perfect trial", "Morning only"],
  },
  {
    id: "morning-monthly",
    title: "Morning Monthly Pack",
    category: "Morning Programs",
    price: "$200",
    period: "/month",
    perks: ["1 daily class", "Make-up classes included"],
  },
  // Night programs
  {
    id: "night-dropin",
    title: "Night Drop-in",
    category: "Night Programs",
    price: "$20",
    period: "/class",
    perks: ["Access any night", "Open level", "Flexible payment"],
    badge: "Drop-in",
  },
  {
    id: "night-flex",
    title: "Night Flex",
    category: "Night Programs",
    price: "$140",
    period: "/month",
    perks: ["8 night classes", "Video recap", "15% off socials"],
  },
  {
    id: "night-pro",
    title: "Night Pro",
    category: "Night Programs",
    price: "$220",
    period: "/month",
    perks: ["Unlimited", "Monthly 1:1 coaching", "35% off workshops"],
    badge: "Top pick",
  },
  // Social programs
  {
    id: "social-basic",
    title: "Social Basic",
    category: "Social Programs",
    price: "$80",
    period: "/month",
    perks: ["4 social events", "Curated playlist", "Bring a friend"],
  },
  {
    id: "social-plus",
    title: "Social Plus",
    category: "Social Programs",
    price: "$130",
    period: "/month",
    perks: ["8 social events", "Photos and videos", "20% off regular classes"],
    badge: "Community",
  },
  {
    id: "social-team",
    title: "Social Team",
    category: "Social Programs",
    price: "$200",
    period: "/month",
    perks: ["Unlimited socials", "Guided rehearsals", "Show coaching"],
  },
]

export default function PlansMasonry() {
  const [active, setActive] = React.useState<Plan["category"]>(PLAN_CATEGORIES[0])
  const [loading, setLoading] = React.useState(true)

  const filtered = React.useMemo(() => plans.filter((p) => p.category === active), [active])

  React.useEffect(() => {
    setLoading(true)
    const id = window.setTimeout(() => setLoading(false), 300)
    return () => window.clearTimeout(id)
  }, [active])

  const SkeletonCard = () => (
    <div
      className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#0c0b10] p-5"
      style={{ minHeight: "360px" }}
      aria-hidden
    >
      <div className="flex items-start justify-between gap-3">
        <span className="h-8 w-32 rounded-full shimmer" />
        <span className="h-8 w-24 rounded-full shimmer" />
      </div>

      <div className="mt-4 space-y-2">
        <div className="h-5 w-3/4 rounded-full shimmer" />
        <div className="h-3 w-1/2 rounded-full shimmer" />
        <div className="h-3 w-1/3 rounded-full shimmer" />
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <div className="h-8 w-24 rounded-full shimmer" />
        <div className="h-4 w-16 rounded-full shimmer" />
      </div>

      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded-full shimmer" />
        <div className="h-3 w-11/12 rounded-full shimmer" />
        <div className="h-3 w-9/12 rounded-full shimmer" />
        <div className="h-3 w-7/12 rounded-full shimmer" />
        <div className="h-3 w-5/12 rounded-full shimmer" />
      </div>

      <div className="mt-5 flex items-center gap-2">
        <div className="h-10 flex-1 rounded-lg shimmer" />
        <div className="h-10 w-24 rounded-lg shimmer" />
      </div>
    </div>
  )

  const iconFor = (category: Plan["category"]) => {
    if (category === "Morning Programs") return <Sun className="h-4 w-4" />
    if (category === "Night Programs") return <Moon className="h-4 w-4" />
    return <Users className="h-4 w-4" />
  }

  return (
    <section className="relative mt-20 w-full overflow-hidden bg-[#050505] py-14 text-white">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_10%_0%,rgba(182,22,22,0.18),transparent_35%),radial-gradient(circle_at_80%_15%,rgba(90,0,0,0.14),transparent_35%),linear-gradient(180deg,#050505,#040404_40%,#050505)]" />
      <div className="relative mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8 2xl:max-w-[2500px] scroll-smooth">
        <header className="mb-6 flex flex-col items-center gap-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/70">Plans</p>
          <h2 className="text-3xl font-bold sm:text-4xl">Choose your plan</h2>
          <p className="text-sm text-white/65">Morning, night and social programs. Tweak pricing later.</p>
        </header>

        <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
          {PLAN_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] transition ${
                active === cat
                  ? "border-transparent bg-gradient-to-r from-[var(--brand,#b61616)] to-[var(--brand-dark,#7d0000)] text-white shadow-[0_15px_55px_-32px_rgba(182,22,22,0.65)]"
                  : "border-white/20 bg-white/5 text-white/80 hover:border-[rgba(182,22,22,0.5)] hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="inline-flex items-center gap-2 text-xs text-white/70 sm:text-sm">
            <Filter className="h-4 w-4 text-[var(--brand,#b61616)]" />
            <span>{active} • {loading ? "Loading..." : `${filtered.length} plans`}</span>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-white/70 sm:text-sm">
            <span>Sort</span>
            <span className="relative">
              <select className="appearance-none rounded-lg border border-white/15 bg-black/40 px-3 py-2 pr-9 text-xs text-white/80 sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand,#b61616)]">
                <option>Most popular</option>
                <option>Lowest price</option>
                <option>Highest price</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {loading
            ? Array.from({ length: filtered.length || 3 }).map((_, idx) => <SkeletonCard key={`s-${idx}`} />)
            : filtered.map((plan) => (
                <article
                  key={plan.id}
                  className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d0c12] via-[#0b0b0f] to-[#0c0b10] p-5 shadow-[0_25px_120px_-60px_rgba(0,0,0,0.85)]"
                >
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[radial-gradient(circle_at_center,rgba(182,22,22,0.18),transparent_60%)] blur-xl" />

                  <div className="flex items-start justify-between gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white">
                      {iconFor(plan.category)}
                      {plan.category}
                    </div>
                    {plan.badge && (
                      <span className="rounded-full border border-[var(--brand,#b61616)] bg-[var(--brand,#b61616)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white text-center max-w-[180px] leading-tight">
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 space-y-1">
                    <h3 className="text-xl font-semibold">{plan.title}</h3>
                    <p className="text-sm text-white/70">{plan.note ?? "Plan ready to edit prices and perks."}</p>
                  </div>

                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-sm text-white/70">{plan.period}</span>
                  </div>

                  <ul className="mt-4 space-y-2 text-sm text-white/80">
                    {plan.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 text-[var(--brand,#b61616)]" />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 flex items-center gap-2">
                    <button className="inline-flex flex-1 items-center justify-center rounded-lg bg-gradient-to-r from-[var(--brand,#b61616)] to-[var(--brand-dark,#7d0000)] px-4 py-2 text-sm font-semibold text-white shadow-[0_15px_55px_-28px_rgba(182,22,22,0.65)] transition hover:opacity-95">
                      Choose plan
                    </button>
                    <button className="inline-flex items-center justify-center rounded-lg border border-white/15 px-3 py-2 text-xs uppercase tracking-[0.14em] text-white/80 hover:border-[rgba(182,22,22,0.5)]">
                      Details
                    </button>
                  </div>
                </article>
              ))}
        </div>

        <style jsx>{`
          .shimmer {
            position: relative;
            overflow: hidden;
            background-color: rgba(255, 255, 255, 0.08);
            background-image: linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.05) 0%,
              rgba(255, 255, 255, 0.2) 20%,
              rgba(255, 255, 255, 0.4) 50%,
              rgba(255, 255, 255, 0.2) 80%,
              rgba(255, 255, 255, 0.05) 100%
            );
            background-size: 250% 100%;
            animation: shimmer 1.1s ease-in-out infinite;
            border-radius: 999px;
          }
          @keyframes shimmer {
            0% {
              background-position: -200% 0;
            }
            100% {
              background-position: 200% 0;
            }
          }
        `}</style>
      </div>
    </section>
  )
}
