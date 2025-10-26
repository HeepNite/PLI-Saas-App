import React from "react"
import {Check, X, Users, Flame, Crown} from "lucide-react"

// Pricing plans oriented to classes (3 plans only)
// Includes a small notification banner above the cards indicating
// the drop-in/check-in price and the first-class promo.
// Light theme uses a subtle glass look; dark theme keeps minimal style.

const features = {
    FirstGroove: [
        "4 classes per month",
        "Access to recorded and edited class videos",
        "15% off workshops",
        "10% off special events",
        "30% off practice nights",
        "No private coaching sessions",
        "No discount for private classes",
    ],
    EssentialMoves: [
        "8 classes per month",
        "Access to recorded and edited class videos",
        "25% off workshops",
        "15% off special events",
        "10% off private classes",
        "45% off practice nights",
        "Unlimited coffee bar & bakery gift",
        "No private coaching sessions",

    ],
    MasterRhythm: [
        "Unlimited classes per month",
        "Unlimited access to recorded and edited class videos",
        "35% off workshops",
        "25% off events",
        "15% off private classes",
        "65% off practice nights",
        "1-hour private coaching session per month",
    ],
}

function PlanCard({
                      title,
                      price,
                      period = "/month",
                      icon,
                      highlight = false,
                      bullets,
                      cta = "Buy",
                  }: {
    title: string
    price: string
    period?: string
    icon: React.ReactNode
    highlight?: boolean
    bullets: string[]
    cta?: string
}) {
    return (
        <article
            className={`relative flex flex-col rounded-xl border bg-white/40 backdrop-blur-md backdrop-saturate-150 border-white/15 shadow-sm dark:bg-neutral-900/60 dark:border-white/10 dark:backdrop-blur-0 ${
                highlight ? "ring-1 ring-[var(--brand)]/40 shadow-md" : ""
            }`}
        >
            {/* header */}
            <div className="flex items-center gap-3 p-5 border-b border-white/10 dark:border-white/10">
                <div className={`inline-flex items-center justify-center rounded-lg p-2 ${
                    highlight ? "bg-[var(--brand)] text-white" : "bg-white text-[var(--brand)] dark:bg-neutral-800"
                }`}>
                    {icon}
                </div>
                <div className="ml-auto text-right">
                    <h3 className="text-base font-semibold tracking-tight">{title}</h3>
                    <div className="mt-1">
                        <span className="text-3xl font-extrabold">{price}</span>
                        <span className="ml-1 text-xs text-muted-foreground">{period}</span>
                    </div>
                </div>
            </div>

            {/* features */}
            <ul className="flex-1 space-y-2 p-5 text-sm">
                {bullets.map((f) => {
                    const isNegative = f.trim().toLowerCase().startsWith("no");
                    return (
                        <li key={f} className="flex items-start gap-2">
                            {isNegative ? (
                                <X className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
                            ) : (
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-black dark:text-white" />
                            )}
                            <span>{f.trim()}</span>
                        </li>
                    );
                })}
            </ul>

            {/* cta */}
            <div className="p-5 pt-0">
                <button className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    highlight
                        ? "bg-[var(--brand)] text-white hover:opacity-95"
                        : "bg-white text-black hover:bg-[var(--brand)] hover:text-white dark:bg-neutral-800 dark:text-white"
                }`}>
                    {cta}
                </button>
            </div>

            {highlight && (
                <div
                    className="absolute -top-2 right-3 rounded-full bg-[var(--brand)] text-white text-[10px] px-2 py-1 shadow">Most
                    popular</div>
            )}
        </article>
    )
}

export default function ClassPricing() {
    return (
        <section className="w-full mt-[200px] mb-[200px]">
            <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8 overflow-x-clip">
                {/* Notification banner above pricing */}


                {/* Heading */}
                <header className="text-center mb-6 sm:mb-10">
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Class Plans & Pricing</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Choose the plan that fits your salsa journey.</p>
                    <p className="mt-1 text-sm text-muted-foreground">Any open class • Any level</p>

                </header>

                {/* Grid of 3 plans */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                    <PlanCard
                        title="First Groove"
                        price="$80.00"
                        period="/per class"
                        icon={<Users className="size-5"/>}
                        bullets={features.FirstGroove}
                        cta="Check in"
                    />
                    <PlanCard
                        title="Essential Moves"
                        price="$150.00"
                        period="/month"
                        icon={<Flame className="size-5"/>}
                        highlight
                        bullets={features.EssentialMoves}
                        cta="Buy"
                    />
                    <PlanCard
                        title="Master Rhythm"
                        price="$280.00"
                        period="/month"
                        icon={<Crown className="size-5"/>}
                        bullets={features.MasterRhythm}
                        cta="Buy"
                    />
                </div>

                {/* Disclaimer */}
                <p className="mt-4 text-center text-xs text-muted-foreground">
                    Prices in USD. Taxes may apply depending on your location. Promotions and availability may change.
                </p>
            </div>
            <div className="m-6 w-2/4 mx-auto">
                <div
                    className="relative overflow-hidden rounded-lg border bg-white/40 backdrop-blur-md backdrop-saturate-150 border-white/15 shadow-sm dark:bg-neutral-900/60 dark:border-white/10 dark:backdrop-blur-0">
                    <div className="px-5 py-5 text-sm flex items-center justify-center gap-3">
              <span className="inline-flex items-center gap-2 font-medium">
                <span className="inline-flex size-2 rounded-full bg-[var(--brand)]"/>
                Check‑in costs $20
              </span>
                        <span className="hidden sm:inline text-muted-foreground">•</span>
                        <span className="font-semibold">First class is $10</span>
                    </div>
                    {/* subtle fades */}
                    <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-gradient-to-b from-black/5 to-transparent dark:from-white/5"/>
                    <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-black/5 to-transparent dark:from-white/5"/>
                </div>
            </div>
        </section>
    )
}
