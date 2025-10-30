"use client"

import Image from "next/image"
import React, {useMemo, useRef, useState} from "react"
import {ChevronLeft, ChevronRight} from "lucide-react"

// Inspiration showcase placed above the footer on the home page.
// Tries to mimic the provided reference: big heading, category pills,
// horizontal card rail with arrows and dots, and a centered CTA.
// Important: we apply a HORIZONTAL vignette mask over the cards rail,
// reusing the same idea we used for the header slider shadow but rotated.

export type ShowcaseCard = {
    image: string
    title: string
    subtitle: string
    details?: string
    categories: string[]
}

const cards: ShowcaseCard[] = [
    {
        image: "/images/carousel/_DSC1079.JPG",
        title: "Aaron Sorkin",
        subtitle: "Teaches Screenwriting",
        details: "8 hours 1 minute",
        categories: ["Trending", "Writing", "Film & TV"]
    },
    {
        image: "/images/carousel/_DSC1087.JPG",
        title: "Steve Martin",
        subtitle: "Teaches Comedy",
        details: "4 hours 40 minutes",
        categories: ["Trending", "Acting & Performing Arts", "Film & TV"]
    },
    {
        image: "/images/carousel/_DSC1076.JPG",
        title: "Shonda Rhimes",
        subtitle: "Teaches Writing for TV",
        details: "6 hours 25 minutes",
        categories: ["Writing", "Film & TV"]
    },
    {
        image: "/images/carousel/_DSC0998.JPG",
        title: "Ken Burns",
        subtitle: "Teaches Documentary Filmmaking",
        details: "4 hours 56 minutes",
        categories: ["Film & TV", "Art & Design"]
    },
    {
        image: "/images/carousel/_DSC1090.JPG",
        title: "Andrea Nevins",
        subtitle: "A Documentary",
        details: "1 hour 24 minutes",
        categories: ["Film & TV", "Community & Government"]
    },
    {
        image: "/images/carousel/_DSC1090.JPG",
        title: "Andrea Nevins",
        subtitle: "A Documentary",
        details: "1 hour 24 minutes",
        categories: ["Film & TV", "Community & Government"]
    },
    {
        image: "/images/carousel/_DSC0998.JPG",
        title: "Ken Burns",
        subtitle: "Teaches Documentary Filmmaking",
        details: "4 hours 56 minutes",
        categories: ["Film & TV", "Art & Design"]
    },
    {
        image: "/images/carousel/_DSC1090.JPG",
        title: "Andrea Nevins",
        subtitle: "A Documentary",
        details: "1 hour 24 minutes",
        categories: ["Film & TV", "Community & Government"]
    },
    {
        image: "/images/carousel/_DSC1090.JPG",
        title: "Andrea Nevins",
        subtitle: "A Documentary",
        details: "1 hour 24 minutes",
        categories: ["Film & TV", "Community & Government"]
    },
    {
        image: "/images/carousel/_DSC0998.JPG",
        title: "Ken Burns",
        subtitle: "Teaches Documentary Filmmaking",
        details: "4 hours 56 minutes",
        categories: ["Film & TV", "Art & Design"]
    },
    {
        image: "/images/carousel/_DSC1090.JPG",
        title: "Andrea Nevins",
        subtitle: "A Documentary",
        details: "1 hour 24 minutes",
        categories: ["Film & TV", "Community & Government"]
    },
    {
        image: "/images/carousel/_DSC0998.JPG",
        title: "Ken Burns",
        subtitle: "Teaches Documentary Filmmaking",
        details: "4 hours 56 minutes",
        categories: ["Film & TV", "Art & Design"]
    },
    {
        image: "/images/carousel/_DSC1087.JPG",
        title: "Steve Martin",
        subtitle: "Teaches Comedy",
        details: "4 hours 40 minutes",
        categories: ["Trending", "Acting & Performing Arts", "Film & TV"],
    },
    {
        image: "/images/carousel/_DSC1090.JPG",
        title: "Andrea Nevins",
        subtitle: "A Documentary",
        details: "1 hour 24 minutes",
        categories: ["Film & TV", "Community & Government"]
    },
    {
        image: "/images/carousel/_DSC0998.JPG",
        title: "Ken Burns",
        subtitle: "Teaches Documentary Filmmaking",
        details: "4 hours 56 minutes",
        categories: ["Film & TV", "Art & Design"]
    },
    {
        image: "/images/carousel/_DSC1090.JPG",
        title: "Andrea Nevins",
        subtitle: "A Documentary",
        details: "1 hour 24 minutes",
        categories: ["Film & TV", "Community & Government"]
    },
    {
        image: "/images/carousel/_DSC0998.JPG",
        title: "Ken Burns",
        subtitle: "Teaches Documentary Filmmaking",
        details: "4 hours 56 minutes",
        categories: ["Film & TV", "Art & Design"]
    },
    {
        image: "/images/carousel/_DSC1087.JPG",
        title: "Steve Martin",
        subtitle: "Teaches Comedy",
        details: "4 hours 40 minutes",
        categories: ["Trending", "Acting & Performing Arts", "Film & TV"]
    }
]

const categories = [
    "All",
    "Trending",
    "Acting & Performing Arts",
    "Art & Design",
    "Business & Entrepreneurship",
    "Community & Government",
    "Film & TV",
    "Food & Drink",
    "Games & Digital Media",
    "Health & Wellness",
    "Music",
    "Outdoor Adventures",
    "Science & Technology",
    "Sports & Athletics",
    "Writing",
]

// UI helpers and small subcomponents to remove duplication
const cls = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ")

const CategoryPill = React.memo(function CategoryPill({
    label,
    active,
    onClick,
}: {
    label: string
    active: boolean
    onClick: () => void
}) {
    return (
        <button
            key={label}
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={cls(
                "whitespace-nowrap rounded-full border px-3.5 py-2 text-xs sm:text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/70",
                active
                    ? "bg-neutral-800 text-white border-white/20 ring-1 ring-[var(--brand)]/60"
                    : "bg-neutral-900 text-white/90 border-white/10 hover:text-white hover:border-white/20",
            )}
        >
            {label}
        </button>
    )
})

const NavArrow = React.memo(function NavArrow({
    side,
    onClick,
    label,
}: {
    side: "left" | "right"
    onClick: () => void
    label: string
}) {
    const Icon = side === "left" ? ChevronLeft : ChevronRight
    const posClass = side === "left" ? "left-1" : "right-1"
    return (
        <button
            aria-label={label}
            onClick={onClick}
            className={cls(
                "hidden md:flex absolute top-1/2 -translate-y-1/2 z-20 size-10 items-center justify-center rounded-full bg-white/80 text-black hover:bg-white shadow dark:bg-neutral-800/80 dark:text-white",
                posClass,
            )}
        >
            <Icon className="size-5" />
        </button>
    )
})

const SideFade = React.memo(function SideFade({ side }: { side: "left" | "right" }) {
    const isLeft = side === "left"
    const style: React.CSSProperties = {
        width: "8%",
        backgroundColor: "rgba(0,0,0,0.25)",
        WebkitMaskImage: isLeft
            ? "linear-gradient(to right, black 0%, black 70%, transparent 100%)"
            : "linear-gradient(to left, black 0%, black 70%, transparent 100%)",
        maskImage: isLeft
            ? "linear-gradient(to right, black 0%, black 70%, transparent 100%)"
            : "linear-gradient(to left, black 0%, black 70%, transparent 100%)",
    }
    return (
        <div aria-hidden className={cls("pointer-events-none absolute inset-y-0 z-[6] hidden md:block", isLeft ? "left-0" : "right-0")} style={style} />
    )
})

type CardVariant = "single" | "grid" | "rail"

const CardFigure = React.memo(function CardFigure({
    card,
    variant,
    index = 0,
    wrapperProps,
}: {
    card: ShowcaseCard
    variant: CardVariant
    index?: number
    wrapperProps?: React.HTMLAttributes<HTMLElement>
}) {
    const baseCaptionCommon = (
        <div className="text-left">
            {variant === "single" ? (
                <p className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] leading-tight">{card.title}</p>
            ) : (
                <p className="text-3xl sm:text-4xl font-extrabold tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] leading-none">{card.title}</p>
            )}
            {variant === "single" ? (
                <div className="my-3 h-[2px] w-8 bg-white/80" />
            ) : (
                <div className="my-2 h-[2px] w-6 bg-white/80" />
            )}
            <p className={variant === "single" ? "text-sm sm:text-base text-white/90" : "text-xs sm:text-sm text-white/90"}>{card.subtitle}</p>
            {card.details && (
                <p className={variant === "single" ? "mt-2 text-xs sm:text-sm text-white/70" : "mt-2 text-[10px] sm:text-xs text-white/70"}>{card.details}</p>
            )}
        </div>
    )

    if (variant === "single") {
        return (
            <figure
                {...wrapperProps}
                className={cls(
                    "relative w-full rounded-2xl overflow-hidden bg-neutral-900 aspect-[16/7] sm:aspect-[16/6] md:aspect-[21/8] min-h-[320px] sm:min-h-[360px] md:min-h-[420px]",
                    wrapperProps?.className,
                )}
            >
                <Image src={card.image} alt={card.title} fill sizes="100vw" className="object-cover" priority />
                <figcaption className="absolute inset-0 p-5 sm:p-6 md:p-8 flex flex-col justify-end text-white">
                    <div className="max-w-xl">{baseCaptionCommon}</div>
                </figcaption>
            </figure>
        )
    }

    if (variant === "grid") {
        return (
            <figure
                {...wrapperProps}
                role="group"
                className={cls(
                    "relative rounded-2xl overflow-hidden bg-neutral-900 aspect-[3/4] sm:aspect-[4/5] md:aspect-[3/4] min-h-[260px] sm:min-h-[300px] md:min-h-[340px]",
                    wrapperProps?.className,
                )}
            >
                <Image
                    src={card.image}
                    alt={card.title}
                    fill
                    sizes="(max-width:768px) 100vw, 25vw"
                    className="object-cover"
                    priority={index < 2}
                />
                <figcaption className="absolute inset-0 p-4 sm:p-5 md:p-6 flex flex-col justify-end text-white">{baseCaptionCommon}</figcaption>
            </figure>
        )
    }

    // rail
    return (
        <figure
            {...wrapperProps}
            role="group"
            data-card
            className={cls(
                "snap-start shrink-0 w-[68%] sm:w-[46%] md:w-[32%] lg:w-[22%] xl:w-[18%] relative rounded-2xl overflow-hidden bg-neutral-900 aspect-[3/4] sm:aspect-[4/5] md:aspect-[3/4] min-h-[260px] sm:min-h-[300px] md:min-h-[340px]",
                wrapperProps?.className,
            )}
        >
            <Image
                src={card.image}
                alt={card.title}
                fill
                sizes="(max-width:768px) 60vw, 20vw"
                className="object-cover"
                priority={index < 2}
            />
            <figcaption className="absolute inset-0 p-4 sm:p-5 md:p-6 flex flex-col justify-end text-white">{baseCaptionCommon}</figcaption>
        </figure>
    )
})

const PageDots = React.memo(function PageDots({
    count,
    active,
    onSelect,
}: {
    count: number
    active: number
    onSelect: (idx: number) => void
}) {
    return (
        <div className="mt-3 flex items-center justify-center gap-2">
            {Array.from({ length: count }).map((_, i) => (
                <button
                    key={`dot-${i}`}
                    type="button"
                    aria-label={`Go to page ${i + 1}`}
                    aria-current={active === i ? "true" : undefined}
                    onClick={() => onSelect(i)}
                    className={cls("size-2.5 rounded-full transition-colors", active === i ? "bg-[var(--brand)]" : "bg-neutral-500/50")}
                />
            ))}
        </div>
    )
})

export default function InspirationShowcase() {
    // STATE — refs and UI state
    const railRef = useRef<HTMLDivElement | null>(null)
    // const [active, setActive] = useState(0) // index of the closest card to the rail's left edge (for debug/ARIA)
    const [selectedCategory, setSelectedCategory] = useState<string>("All") // current category filter
    // PAGE MODEL — how many cards are visible per viewport and how many pages exist
    const [visibleCount, setVisibleCount] = useState(1) // number of cards visible at once in scroll mode
    const [totalPages, setTotalPages] = useState(1) // total pages based on visibleCount
    const [activePage, setActivePage] = useState(0) // current page (dots/arrows navigate pages)

    const filteredCards = useMemo(() => {
        if (!selectedCategory || selectedCategory === "All") return cards
        if (selectedCategory === "Trending") return cards.filter((c) => c.categories.includes("Trending"))
        const list = cards.filter((c) => c.categories.includes(selectedCategory))
        return list.length ? list : cards
    }, [selectedCategory])

    const ids = useMemo(() => filteredCards.map((_, i) => `showcase-card-${i}`), [filteredCards])
    const singleMode = filteredCards.length === 1
    // Grid mode: when there are 2–4 items, distribute them across the full width (no scrolling)
    const gridMode = filteredCards.length > 1 && filteredCards.length <= 4

    // Small logic helpers
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max))
    const computeStride = (children: HTMLElement[], rail: HTMLElement) => {
        if (!children.length) return rail.clientWidth || 0
        let s = children.length > 1 ? (children[1].offsetLeft - children[0].offsetLeft) : children[0].clientWidth
        if (s <= 0) s = children[0].clientWidth || rail.clientWidth
        return s
    }

    // Compute visibleCount and pages based on actual DOM measurements
    const recomputePages = React.useCallback(() => {
        const rail = railRef.current
        if (singleMode) {
            setVisibleCount(1)
            setTotalPages(1)
            setActivePage(0)
            return
        }
        if (gridMode) {
            const vc = Math.max(1, filteredCards.length)
            setVisibleCount(vc)
            setTotalPages(1)
            // setActivePage(0)
            return
        }
        if (!rail) return
        const children = Array.from(rail.querySelectorAll('[data-card]')) as HTMLElement[]
        if (!children.length) {
            setVisibleCount(1)
            setTotalPages(1)
            setActivePage(0)
            return
        }
        const stride = computeStride(children, rail)
        const vc = Math.max(1, Math.round(rail.clientWidth / stride))
        const total = Math.max(1, Math.ceil(children.length / vc))
        setVisibleCount(vc)
        setTotalPages(total)
        setActivePage((p) => Math.min(p, total - 1))
    }, [filteredCards.length, gridMode, singleMode])

    // PAGE NAVIGATION — scroll by full page (visibleCount cards)
    const scrollToPage = React.useCallback((pageIdx: number) => {
        if (singleMode) return
        const rail = railRef.current
        if (!rail) return
        // In grid mode we don't scroll; keep page at 0
        if (gridMode) {
            setActivePage(0)
            return
        }
        const children = Array.from(rail.querySelectorAll('[data-card]')) as HTMLElement[]
        if (!children.length) return
        const stride = computeStride(children, rail)
        const pageStride = stride * Math.max(1, visibleCount)
        const maxLeft = Math.max(0, rail.scrollWidth - rail.clientWidth)
        const targetLeft = clamp(pageIdx * pageStride, 0, maxLeft)
        rail.scrollTo({ left: targetLeft, behavior: "smooth" })
        setActivePage(clamp(pageIdx, 0, Math.max(0, totalPages - 1)))
    }, [gridMode, singleMode, visibleCount, totalPages])

    const next = () => {
        if (singleMode || totalPages <= 1) return
        scrollToPage(Math.min(activePage + 1, totalPages - 1))
    }
    const prev = () => {
        if (singleMode || totalPages <= 1) return
        scrollToPage(Math.max(activePage - 1, 0))
    }

    // Recompute pages when cards/filter change; align to page 0
    React.useEffect(() => {
        // setActive(0)
        setActivePage(0)
        const t = setTimeout(() => {
            recomputePages()
            if (!singleMode && !gridMode) {
                scrollToPage(0)
            }
        }, 50)
        return () => clearTimeout(t)
    }, [filteredCards, singleMode, gridMode, recomputePages, scrollToPage])

    // On resize, recompute and keep the current page
    React.useEffect(() => {
        const onResize = () => {
            recomputePages()
            if (!singleMode && !gridMode) {
                // realign to current page after new measurements
                requestAnimationFrame(() => scrollToPage(activePage))
            }
        }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [activePage, recomputePages, scrollToPage, singleMode, gridMode])

    // SCROLL SYNC — update activePage on manual scroll (scroll mode only)
    React.useEffect(() => {
        if (singleMode || gridMode) return
        const el = railRef.current
        if (!el) return
        const onScroll = () => {
            const children = Array.from(el.querySelectorAll('[data-card]')) as HTMLElement[]
            if (!children.length) return
            const stride = computeStride(children, el)
            const pageStride = stride * Math.max(1, visibleCount)
            const page = pageStride > 0 ? Math.round(el.scrollLeft / pageStride) : 0
            const clampedPage = clamp(page, 0, Math.max(0, totalPages - 1))
            setActivePage(clampedPage)
            // Keep an approximate active card index for aria/debug (left-most)
            //const idx = pageStride > 0 ? Math.round((el.scrollLeft % pageStride) / stride) + clampedPage * Math.max(1, visibleCount) : 0
            // setActive(Math.max(0, Math.min(idx, filteredCards.length - 1)))
        }
        el.addEventListener("scroll", onScroll, {passive: true} as never)
        onScroll()
        return () => el.removeEventListener("scroll", onScroll as never)
    }, [filteredCards.length, singleMode, gridMode, visibleCount, totalPages])

    return (
        <section className="w-full mt-[160px] mb-[160px]" aria-label="Inspiration showcase">
            <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8 overflow-x-clip">
                {/* Heading */}
                <header className="text-center">
                    <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight">A dose of inspiration,</h2>
                    <h3 className="text-4xl sm:text-5xl font-extrabold leading-tight">whenever you need it.</h3>
                </header>

                {/* Category pills */}
                <div className="mt-6 md:mt-8">
                    <div
                        className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-3 py-2 px-1">
                        {categories.map((c) => {
                            const isActive = selectedCategory === c || (c === "Trending" && selectedCategory === "Trending")
                            return (
                                <CategoryPill
                                    key={c}
                                    label={c}
                                    active={isActive}
                                    onClick={() => setSelectedCategory(c)}
                                />
                            )
                        })}
                    </div>
                </div>

                {/* Cards rail */}
                <div className="relative mt-6 md:mt-8">
                    {/* arrows — shown only when there is more than 1 page in scroll mode */}
                    {!singleMode && totalPages > 1 && (
                        <>
                            <NavArrow side="left" onClick={prev} label="Previous" />
                            <NavArrow side="right" onClick={next} label="Next" />
                        </>
                    )}

                    {/* Rail container with horizontal vignette mask; rounded + overflow-hidden to clip fades */}
                    <div className="relative rounded-2xl overflow-hidden">
                        {/*
              SHADOW/VIGNETTE — start
              Side-only subtle fades to guide the eye; NO center shadow over images.
              Tweak widths (w%) and opacity below to make the shadows smaller/softer.
            */}
                        {/* Left subtle side fade (masked) */}
                        {!singleMode && !gridMode && totalPages > 1 && (
                            <>
                                <SideFade side="left" />
                                {/* Right subtle side fade (masked) */}
                                <SideFade side="right" />
                            </>
                        )}
                        {/* SHADOW/VIGNETTE — end */}

                        {singleMode ? (
                            // Single-card mode: full-bleed, non-scrolling
                            <CardFigure card={filteredCards[0]} variant="single" />
                        ) : gridMode ? (
                            // GRID MODE — 2–4 items: distribute evenly across the full width (no scrolling)
                            <div
                                className="grid gap-4 md:gap-6"
                                style={{ gridTemplateColumns: `repeat(${filteredCards.length}, minmax(0, 1fr))` }}
                            >
                                {filteredCards.map((c, i) => (
                                    <CardFigure key={`${c.title}-${i}`} card={c} variant="grid" index={i} />
                                ))}
                            </div>
                        ) : (
                            // SCROLL MODE — 5+ items: scrollable rail with snap
                            <div ref={railRef}
                                 className="relative flex snap-x snap-mandatory overflow-x-auto no-scrollbar gap-4 md:gap-6 scroll-pl-2 md:scroll-pl-4 pr-2 md:pr-4">
                                {filteredCards.map((c, i) => (
                                    <CardFigure
                                        key={`${c.title}-${i}`}
                                        card={c}
                                        variant="rail"
                                        index={i}
                                        wrapperProps={{ id: ids[i] }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* dots — page-based (each dot = one full viewport of cards) */}
                    {!singleMode && !gridMode && totalPages > 1 && (
                        <PageDots count={totalPages} active={activePage} onSelect={scrollToPage} />
                    )}
                </div>

                {/* CTA */}
                <div className="mt-8 flex items-center justify-center">
                    <a href="#"
                       className="inline-flex items-center gap-2 rounded-full bg-white text-black hover:bg-[var(--brand)] hover:text-white px-6 py-3 font-semibold transition-colors">
                        Explore Classes
                    </a>
                </div>
            </div>
        </section>
    )
}
