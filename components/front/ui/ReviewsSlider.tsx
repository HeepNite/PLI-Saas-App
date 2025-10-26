"use client"

import Image from "next/image"
import React, {useMemo, useRef, useState} from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

// Simple, dependency-free slider to showcase school reviews.
// Design reference: left image, right dark card with headline, copy and CTAs.
// Colors: uses CSS variables and Tailwind tokens already present in the project.
// Content language: English as requested.

export type ReviewSlide = {
  image: string
  text: string
  author: string
  role?: string
}

const defaultSlides: ReviewSlide[] = [
  {
    image: "/images/carousel/_DSC1079.JPG",
    text: "The instructors break down every move so clearly. I improved my timing and confidence in just a few classes!",
    author: "Julia M.",
    role: "Beginner to Intermediate",
  },
  {
    image: "/images/carousel/_DSC1087.JPG",
    text: "Amazing community vibe. Practice nights are the highlight of my week and helped me level up fast.",
    author: "Carlos R.",
    role: "On2 Enthusiast",
  },
  {
    image: "/images/carousel/_DSC1076.JPG",
    text: "Professional teaching with a friendly atmosphere. The video reviews after class are a game changer.",
    author: "Stephanie K.",
    role: "Advanced Dancer",
  },
]

export default function ReviewsSlider({
  slides = defaultSlides,
  className,
}: { slides?: ReviewSlide[]; className?: string }) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(0)

  const ids = useMemo(() => slides.map((_, i) => `review-slide-${i}`), [slides])

  const scrollTo = (idx: number) => {
    const el = document.getElementById(ids[idx])
    if (el && listRef.current) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
      setActive(idx)
    }
  }

  const next = () => scrollTo((active + 1) % slides.length)
  const prev = () => scrollTo((active - 1 + slides.length) % slides.length)

  return (
    <section className={`w-full mt-[200px] mb-[200px] ${className ?? ""}`} aria-label="Student reviews slider">
      <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8 overflow-x-clip">
        {/* Heading */}
        <header className="text-center mb-6 sm:mb-8">
          <p className="text-3xl sm:text-4xl font-extrabold leading-tight">What our students say</p>
          <p className="text-sm text-muted-foreground">Real experiences from classes, workshops and practice nights.</p>
        </header>

        {/* Slider viewport */}
        <div className="relative">
          {/* arrows */}
          <button aria-label="Previous review" onClick={prev} className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 size-10 items-center justify-center rounded-full bg-white/80 text-black hover:bg-white shadow dark:bg-neutral-800/80 dark:text-white" >
            <ChevronLeft className="size-5" />
          </button>
          <button aria-label="Next review" onClick={next} className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 size-10 items-center justify-center rounded-full bg-white/80 text-black hover:bg-white shadow dark:bg-neutral-800/80 dark:text-white" >
            <ChevronRight className="size-5" />
          </button>

          <div ref={listRef} className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar gap-6 scroll-pl-4 pr-4" role="list">
            {slides.map((s, i) => (
              <figure
                key={i}
                id={ids[i]}
                className="snap-center shrink-0 w-[100%] md:w-[92%] lg:w-[86%] relative"
                role="listitem"
              >
                <div className="relative overflow-hidden rounded-xl dark:rounded-none border bg-white/30 backdrop-blur-md backdrop-saturate-150 border-white/15 shadow-sm dark:bg-transparent dark:border-transparent dark:backdrop-blur-0">
                  {/* media + content layout */}
                  <div className="relative w-full grid grid-cols-1 md:grid-cols-[1.15fr_1fr]">
                    {/* image */}
                    <div className="relative h-72 md:h-[360px] lg:h-[420px]">
                      <Image src={s.image} alt="Dance class" fill className="object-cover" sizes="(max-width:768px) 100vw, 60vw" />
                    </div>
                    {/* content (right dark card) */}
                    <div className="relative bg-neutral-900 text-white flex items-center">
                      <div className="ml-auto max-w-lg w-full p-6 sm:p-8 md:p-10 text-right space-y-4">
                        <span className="inline-flex items-center gap-2 self-end">
                          <span className="inline-flex items-center rounded-full bg-[var(--brand)] text-white text-[13px] px-3 py-1">Review</span>
                        </span>
                        <div className="space-y-2">
                          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">Level up your salsa</h3>
                          <p className="text-sm sm:text-base text-white/90">{s.text}</p>
                        </div>
                        <hr className="border-2 border-[var(--brand)]/80" />
                        <div className="text-sm">
                          <p className="font-semibold">{s.author}</p>
                          {s.role && <p className="text-white/80">{s.role}</p>}
                        </div>
                        <div className="pt-1">
                          <a href="#" className="inline-flex items-center gap-2 rounded-lg bg-white text-black hover:bg-[var(--brand)] hover:text-white px-4 py-2 transition-colors">
                            Contact us
                          </a>
                        </div>
                      </div>
                      {/* gradient edge over image area for readability on medium+ */}
                      <div aria-hidden className="hidden md:block pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-black/40 to-transparent" />
                    </div>
                  </div>
                </div>
              </figure>
            ))}
          </div>

          {/* dots */}
          <div className="mt-4 flex items-center justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to review ${i + 1}`}
                onClick={() => scrollTo(i)}
                className={`size-2.5 rounded-full ${active === i ? "bg-[var(--brand)]" : "bg-neutral-400/50 dark:bg-neutral-600"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
