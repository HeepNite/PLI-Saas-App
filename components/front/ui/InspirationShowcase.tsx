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
        let stride = children.length > 1 ? (children[1].offsetLeft - children[0].offsetLeft) : children[0].clientWidth
        if (stride <= 0) stride = children[0].clientWidth || rail.clientWidth
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
        let stride = children.length > 1 ? (children[1].offsetLeft - children[0].offsetLeft) : children[0].clientWidth
        if (stride <= 0) stride = children[0].clientWidth
        const pageStride = stride * Math.max(1, visibleCount)
        const maxLeft = Math.max(0, rail.scrollWidth - rail.clientWidth)
        const targetLeft = Math.max(0, Math.min(pageIdx * pageStride, maxLeft))
        rail.scrollTo({ left: targetLeft, behavior: "smooth" })
        setActivePage(Math.max(0, Math.min(pageIdx, Math.max(0, totalPages - 1))))
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
            let stride = children.length > 1 ? (children[1].offsetLeft - children[0].offsetLeft) : children[0].clientWidth
            if (stride <= 0) stride = children[0].clientWidth
            const pageStride = stride * Math.max(1, visibleCount)
            const page = pageStride > 0 ? Math.round(el.scrollLeft / pageStride) : 0
            const clamped = Math.max(0, Math.min(page, Math.max(0, totalPages - 1)))
            setActivePage(clamped)
            // Keep an approximate active card index for aria/debug (left-most)
            //const idx = pageStride > 0 ? Math.round((el.scrollLeft % pageStride) / stride) + clamped * Math.max(1, visibleCount) : 0
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
                                <button
                                    key={c}
                                    type="button"
                                    aria-pressed={isActive}
                                    onClick={() => setSelectedCategory(c)}
                                    className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-xs sm:text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/70 ${
                                        isActive
                                            ? "bg-neutral-800 text-white border-white/20 ring-1 ring-[var(--brand)]/60"
                                            : "bg-neutral-900 text-white/90 border-white/10 hover:text-white hover:border-white/20"
                                    }`}
                                >
                                    {c}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Cards rail */}
                <div className="relative mt-6 md:mt-8">
                    {/* arrows — shown only when there is more than 1 page in scroll mode */}
                    {!singleMode && totalPages > 1 && (
                        <>
                            <button aria-label="Previous" onClick={prev}
                                    className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-20 size-10 items-center justify-center rounded-full bg-white/80 text-black hover:bg-white shadow dark:bg-neutral-800/80 dark:text-white">
                                <ChevronLeft className="size-5"/>
                            </button>
                            <button aria-label="Next" onClick={next}
                                    className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-20 size-10 items-center justify-center rounded-full bg-white/80 text-black hover:bg-white shadow dark:bg-neutral-800/80 dark:text-white">
                                <ChevronRight className="size-5"/>
                            </button>
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
                                <div
                                    aria-hidden
                                    className="pointer-events-none absolute inset-y-0 left-0 z-[6] hidden md:block"
                                    style={{
                                        width: "8%",
                                        backgroundColor: "rgba(0,0,0,0.25)",
                                        WebkitMaskImage: "linear-gradient(to right, black 0%, black 70%, transparent 100%)",
                                        maskImage: "linear-gradient(to right, black 0%, black 70%, transparent 100%)",
                                    }}
                                />
                                {/* Right subtle side fade (masked) */}
                                <div
                                    aria-hidden
                                    className="pointer-events-none absolute inset-y-0 right-0 z-[6] hidden md:block"
                                    style={{
                                        width: "8%",
                                        backgroundColor: "rgba(0,0,0,0.25)",
                                        WebkitMaskImage: "linear-gradient(to left, black 0%, black 70%, transparent 100%)",
                                        maskImage: "linear-gradient(to left, black 0%, black 70%, transparent 100%)",
                                    }}
                                />
                            </>
                        )}
                        {/* SHADOW/VIGNETTE — end */}

                        {singleMode ? (
                            // Single-card mode: full-bleed, non-scrolling
                            <figure
                                className="relative w-full rounded-2xl overflow-hidden bg-neutral-900 aspect-[16/7] sm:aspect-[16/6] md:aspect-[21/8] min-h-[320px] sm:min-h-[360px] md:min-h-[420px]">
                                <Image
                                    src={filteredCards[0].image}
                                    alt={filteredCards[0].title}
                                    fill
                                    sizes="100vw"
                                    className="object-cover"
                                    priority
                                />
                                <figcaption
                                    className="absolute inset-0 p-5 sm:p-6 md:p-8 flex flex-col justify-end text-white">
                                    <div className="max-w-xl">
                                        <p className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] leading-tight">{filteredCards[0].title}</p>
                                        <div className="my-3 h-[2px] w-8 bg-white/80"/>
                                        <p className="text-sm sm:text-base text-white/90">{filteredCards[0].subtitle}</p>
                                        {filteredCards[0].details &&
                                            <p className="mt-2 text-xs sm:text-sm text-white/70">{filteredCards[0].details}</p>}
                                    </div>
                                </figcaption>
                            </figure>
                        ) : gridMode ? (
                            // GRID MODE — 2–4 items: distribute evenly across the full width (no scrolling)
                            <div
                                className="grid gap-4 md:gap-6"
                                style={{ gridTemplateColumns: `repeat(${filteredCards.length}, minmax(0, 1fr))` }}
                            >
                                {filteredCards.map((c, i) => (
                                    <figure
                                        key={`${c.title}-${i}`}
                                        role="group"
                                        className="relative rounded-2xl overflow-hidden bg-neutral-900 aspect-[3/4] sm:aspect-[4/5] md:aspect-[3/4] min-h-[260px] sm:min-h-[300px] md:min-h-[340px]"
                                    >
                                        <Image
                                            src={c.image}
                                            alt={c.title}
                                            fill
                                            sizes="(max-width:768px) 100vw, 25vw"
                                            className="object-cover"
                                            priority={i < 2}
                                        />
                                        <figcaption className="absolute inset-0 p-4 sm:p-5 md:p-6 flex flex-col justify-end text-white">
                                            <div className="text-left">
                                                <p className="text-3xl sm:text-4xl font-extrabold tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] leading-none">{c.title}</p>
                                                <div className="my-2 h-[2px] w-6 bg-white/80"/>
                                                <p className="text-xs sm:text-sm text-white/90">{c.subtitle}</p>
                                                {c.details && <p className="mt-2 text-[10px] sm:text-xs text-white/70">{c.details}</p>}
                                            </div>
                                        </figcaption>
                                    </figure>
                                ))}
                            </div>
                        ) : (
                            // SCROLL MODE — 5+ items: scrollable rail with snap
                            <div ref={railRef}
                                 className="relative flex snap-x snap-mandatory overflow-x-auto no-scrollbar gap-4 md:gap-6 scroll-pl-2 md:scroll-pl-4 pr-2 md:pr-4">
                                {filteredCards.map((c, i) => (
                                    // Each card uses Next/Image with `fill`, so the parent needs intrinsic height.
                                    // We enforce it via aspect-ratio plus a small min-height to avoid 0px containers.
                                    <figure
                                        key={`${c.title}-${i}`}
                                        id={ids[i]}
                                        role="group"
                                        data-card
                                        className="snap-start shrink-0 w-[68%] sm:w-[46%] md:w-[32%] lg:w-[22%] xl:w-[18%] relative rounded-2xl overflow-hidden bg-neutral-900 aspect-[3/4] sm:aspect-[4/5] md:aspect-[3/4] min-h-[260px] sm:min-h-[300px] md:min-h-[340px]"
                                    >
                                        <Image
                                            src={c.image}
                                            alt={c.title}
                                            fill
                                            sizes="(max-width:768px) 60vw, 20vw"
                                            className="object-cover"
                                            priority={i < 2}
                                        />
                                        {/* Text overlay */}
                                        <figcaption
                                            className="absolute inset-0 p-4 sm:p-5 md:p-6 flex flex-col justify-end text-white">
                                            <div className="text-left">
                                                <p className="text-3xl sm:text-4xl font-extrabold tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] leading-none">{c.title}</p>
                                                <div className="my-2 h-[2px] w-6 bg-white/80"/>
                                                <p className="text-xs sm:text-sm text-white/90">{c.subtitle}</p>
                                                {c.details &&
                                                    <p className="mt-2 text-[10px] sm:text-xs text-white/70">{c.details}</p>}
                                            </div>
                                        </figcaption>
                                    </figure>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* dots — page-based (each dot = one full viewport of cards) */}
                    {!singleMode && !gridMode && totalPages > 1 && (
                        <div className="mt-3 flex items-center justify-center gap-2">
                            {Array.from({ length: totalPages }).map((_, i) => (
                                <button
                                    key={`dot-${i}`}
                                    type="button"
                                    aria-label={`Go to page ${i + 1}`}
                                    aria-current={activePage === i ? "true" : undefined}
                                    onClick={() => scrollToPage(i)}
                                    className={`size-2.5 rounded-full transition-colors ${activePage === i ? "bg-[var(--brand)]" : "bg-neutral-500/50"}`}
                                />
                            ))}
                        </div>
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
