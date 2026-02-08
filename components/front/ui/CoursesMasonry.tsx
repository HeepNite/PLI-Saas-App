"use client"

import Image from "next/image"
import Link from "next/link"
import React from "react"
import { Users, Filter, Clock, ChevronDown, Star, Play } from "lucide-react"
import type { HomeCourse } from "@/types/home"

export type CoursesMasonryProps = {
  title?: string
  categories?: string[]
  courses?: HomeCourse[]
  renderCard?: (course: HomeCourse) => React.ReactNode
  skeletonDelayMs?: number
  onBook?: (slug: string) => void
}

const DEFAULT_CATEGORY = "Featured"
const BRAND = "var(--brand,#b61616)"
const BRAND_DARK = "var(--brand-dark,#7d0000)"
const BRAND_SOFT = "rgba(182,22,22,0.35)"
const BRAND_STRONG = "rgba(182,22,22,0.65)"

export default function CoursesMasonry({
  title = "Latin Dance, Music, and Art Courses",
  categories = [],
  courses = [],
  renderCard,
  skeletonDelayMs = 600,
  onBook,
}: CoursesMasonryProps) {
  const safeCategories = React.useMemo(() => (categories.length ? categories : [DEFAULT_CATEGORY]), [categories])
  const [active, setActive] = React.useState<string>(safeCategories[0])
  const [loading, setLoading] = React.useState(true)

  const filtered = React.useMemo(() => {
    if (!active || active === DEFAULT_CATEGORY || !categories.length) return courses
    return courses.filter((c) => c.category === active)
  }, [active, courses, categories.length])

  React.useEffect(() => {
    setActive((prev) => (safeCategories.includes(prev) ? prev : safeCategories[0]))
  }, [safeCategories])

  React.useEffect(() => {
    setLoading(true)
    const id = window.setTimeout(() => setLoading(false), skeletonDelayMs)
    return () => window.clearTimeout(id)
  }, [active, courses, skeletonDelayMs])

  const isSingle = filtered.length === 1
  const skeletonCount = filtered.length || courses.length || 1

  const ratingStars = (
    <div className="flex items-center gap-1 text-[var(--brand,#b61616)]">
      {Array.from({ length: 5 }).map((_, idx) => (
        <Star
          key={`star-${idx}`}
          className="h-3.5 w-3.5 text-[var(--brand,#b61616)]"
          style={{ fill: BRAND_SOFT }}
          strokeWidth={1.5}
        />
      ))}
      <span className="ml-1 text-[11px] text-white/70">4.8</span>
    </div>
  )

  const SkeletonCard = () => (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl ${isSingle ? "xl:col-span-2" : ""}`}
      style={{ minHeight: "400px" }}
    >
      <div className="grid h-full grid-cols-1 md:grid-cols-5">
        <div className="md:col-span-2">
          <div className="h-full min-h-[340px] bg-white/10 shimmer" />
        </div>
        <div className="md:col-span-3 flex h-full flex-col justify-center space-y-3 p-5">
          <div className="h-3 w-28 rounded-full bg-white/10 shimmer" />
          <div className="h-4 w-3/4 rounded-full bg-white/10 shimmer" />
          <div className="h-3 w-1/2 rounded-full bg-white/5 shimmer" />
          <div className="h-3 w-2/3 rounded-full bg-white/5 shimmer" />
          <div className="flex gap-2 pt-2">
            <div className="h-8 w-28 rounded-lg bg-white/10 shimmer" />
            <div className="h-8 w-24 rounded-lg bg-white/10 shimmer" />
          </div>
        </div>
      </div>
    </div>
  )

  const defaultCard = (c: HomeCourse) => {
    const studentsLabel = c.students ?? "Grupos reducidos"
    const durationLabel = c.duration ?? "55 min"
    const teacherLabel = c.teacher ?? "Instructor invitado"
    const categoryLabel = c.category ?? "Programa"
    const comingSoon = c.badge?.toLowerCase().includes("coming")

    return (
      <article
        key={c.id}
        className={`group relative isolate overflow-hidden rounded-2xl border border-white/10 bg-[#0b0a0f]/80 backdrop-blur-xl shadow-[0_25px_120px_-60px_rgba(0,0,0,0.9)] ${isSingle ? "xl:col-span-2" : ""}`}
        style={{ minHeight: "400px" }}
        onMouseEnter={
          c.previewVideo
            ? (e) => {
                const video = e.currentTarget.querySelector("video")
                if (video) {
                  video.currentTime = 0
                  video.play().catch(() => {})
                }
              }
            : undefined
        }
        onMouseLeave={
          c.previewVideo
            ? (e) => {
                const video = e.currentTarget.querySelector("video") as HTMLVideoElement | null
                video?.pause()
              }
            : undefined
        }
      >
        <div className="pointer-events-none absolute inset-px rounded-2xl border border-white/5" />
        <div className="absolute -left-24 top-0 h-72 w-72 rotate-12 bg-[radial-gradient(circle_at_center,rgba(182,22,22,0.22),transparent_55%)] blur-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-5 relative z-[1] h-full">
          <div className="relative md:col-span-2">
            <div className="relative h-full min-h-[340px] overflow-hidden">
              <Image
                src={c.image}
                alt={c.title}
                fill
                sizes="(max-width: 768px) 100vw, 40vw"
                className="object-cover transition duration-300 group-hover:scale-[1.02] group-hover:opacity-90"
              />
              {c.previewVideo && (
                <video
                  muted
                  playsInline
                  preload="auto"
                  autoPlay
                  loop
                  poster={c.image}
                  className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  src={c.previewVideo}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />

              <div className="absolute top-3 left-3 max-w-[60%]">
                {c.badge && (
                  <span
                    className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_15px_45px_-25px_rgba(182,22,22,0.65)] whitespace-normal break-words leading-tight text-center max-w-[240px]"
                    style={{
                      borderColor: BRAND_STRONG,
                      background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)`,
                    }}
                  >
                    {c.badge}
                  </span>
                )}
              </div>
              <div className="absolute top-3 right-3">
                <span className="rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white">
                  {categoryLabel}
                </span>
              </div>

              {c.previewVideo && (
                <>
                  <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/80 group-hover:opacity-0 transition-opacity duration-200">
                    <Play className="h-3.5 w-3.5" />
                    Preview
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center text-white/80 opacity-90 transition-opacity duration-200 group-hover:opacity-0 pointer-events-none">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/40 backdrop-blur-sm">
                      <Play className="h-6 w-6" />
                    </span>
                  </span>
                </>
              )}

              <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 text-[11px] text-white">
                <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1">
                  <Clock className="h-3.5 w-3.5 text-[var(--brand,#b61616)]" />
                  {durationLabel}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1">
                  <Users className="h-3.5 w-3.5 text-[var(--brand,#b61616)]" />
                  {studentsLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="md:col-span-3 space-y-3 p-6 lg:p-7">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[var(--brand,#b61616)]">
                <span className="h-2 w-2 rounded-full bg-gradient-to-br from-[color:var(--brand,#b61616)] to-[color:var(--brand-dark,#7d0000)] shadow-[0_0_0.45rem_rgba(182,22,22,0.55)]" />
                {categoryLabel}
              </span>
              {ratingStars}
            </div>

            <h3 className="text-lg sm:text-xl font-semibold leading-snug text-white">{c.title}</h3>
            <p className="text-sm leading-relaxed text-white/70">
              {c.description ?? `Guided class by ${teacherLabel}. Live practice and corrections.`}
            </p>

            <div className="flex flex-wrap gap-2 text-xs text-white/70">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Instructor: {teacherLabel}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Duration {durationLabel}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Group size {studentsLabel}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {c.slug && !comingSoon ? (
                <button
                  type="button"
                  onClick={() => onBook && onBook(c.slug)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--brand,#b61616)] to-[var(--brand-dark,#7d0000)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_15px_55px_-28px_rgba(182,22,22,0.65)] transition hover:-translate-y-[1px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand,#b61616)]"
                  aria-label={`Book class for ${c.title}`}
                >
                  Book class
                </button>
              ) : (
                <span className="inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/30 px-4 py-2.5 text-sm font-semibold text-white/70">
                  Coming soon
                </span>
              )}

              <Link
                href={c.slug ? `/cursos/${c.slug}` : "#"}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3.5 py-2 text-[12px] uppercase tracking-[0.14em] text-white/75 transition hover:border-[rgba(182,22,22,0.5)]"
                aria-label={`View details for ${c.title}`}
              >
                View details
              </Link>
            </div>
          </div>
        </div>
      </article>
    )
  }

  return (
    <section className="relative mt-24 w-full overflow-hidden bg-[#050505] py-16 text-white sm:py-20">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_10%_0%,rgba(182,22,22,0.24),transparent_35%),radial-gradient(circle_at_80%_15%,rgba(125,0,0,0.22),transparent_35%),linear-gradient(180deg,#040404,#050505_40%,#040404)]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-28 bg-gradient-to-b from-white/10 via-transparent to-transparent" />
      <div className="absolute -left-28 top-[12%] -z-10 h-80 w-80 rotate-12 bg-[radial-gradient(circle_at_center,rgba(182,22,22,0.32),transparent_55%)] blur-[120px]" />
      <div className="absolute right-[-12%] top-1/3 -z-10 h-80 w-80 bg-[radial-gradient(circle_at_center,rgba(125,0,0,0.3),transparent_60%)] blur-[120px]" />

        <div className="relative mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8 2xl:max-w-[2500px] scroll-smooth">
        <header className="flex flex-col items-center gap-2 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--brand,#b61616)] opacity-90">PLI Courses</span>
          <h2 className="text-3xl font-bold leading-tight sm:text-4xl text-white">{title}</h2>
          <p className="max-w-2xl text-sm text-white/70 sm:text-base">
            Curated night-inspired tracks with the brand red accents from the reference design.
            Pick your program and book instantly.
          </p>
        </header>

        <div className="mt-7 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {safeCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] transition ${
                  active === cat
                    ? "border-transparent bg-gradient-to-r from-[var(--brand,#b61616)] to-[var(--brand-dark,#7d0000)] text-white shadow-[0_15px_55px_-32px_rgba(182,22,22,0.65)]"
                    : "border-white/15 bg-white/5 text-white/80 hover:border-[rgba(182,22,22,0.5)] hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
            <div className="inline-flex items-center gap-2 text-xs text-white/70 sm:text-sm">
              <Filter className="h-4 w-4 text-[var(--brand,#b61616)]" />
              <span>{active === DEFAULT_CATEGORY ? "All styles" : active} • {filtered.length} courses</span>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-white/70 sm:text-sm">
              <span>Sort</span>
              <span className="relative">
                <select className="appearance-none rounded-lg border border-white/15 bg-black/40 px-3 py-2 pr-9 text-xs text-white/80 sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand,#b61616)]">
                  <option>Most popular</option>
                  <option>Newest</option>
                  <option>Shortest</option>
                  <option>Longest</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
              </span>
            </label>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2">
          {loading
            ? Array.from({ length: skeletonCount }).map((_, idx) => <SkeletonCard key={`skeleton-${idx}`} />)
            : filtered.map((c) => (
                <React.Fragment key={c.id}>{renderCard ? renderCard(c) : defaultCard(c)}</React.Fragment>
              ))}
        </div>

        <style jsx>{`
          .shimmer {
            position: relative;
            overflow: hidden;
            background-color: rgba(255, 255, 255, 0.07);
            background-image: linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.04) 0%,
              rgba(255, 255, 255, 0.12) 20%,
              rgba(255, 255, 255, 0.35) 45%,
              rgba(255, 255, 255, 0.12) 70%,
              rgba(255, 255, 255, 0.04) 100%
            );
            background-size: 280% 100%;
            animation: shimmer 1.1s ease-in-out infinite;
            will-change: background-position;
          }
          @keyframes shimmer {
            0% {
              background-position: -220% 0;
            }
            100% {
              background-position: 220% 0;
            }
          }
        `}</style>
      </div>
    </section>
  )
}
