"use client"
import React from "react"
import type { CourseSectionsData } from "./types"

const faqs = [
  {
    q: "Do I need a partner?",
    a: "No. We rotate and organize the class so everyone can practice comfortably.",
  },
  {
    q: "What should I bring?",
    a: "Comfortable clothing, water, and good energy. Soft-soled shoes help with turns.",
  },
  {
    q: "Can I start from scratch?",
    a: "Yes. The class is designed for beginners and we go step by step.",
  },
]

const reviewAvatars = [
  "/images/carousel/_DSC1079.JPG",
  "/images/carousel/_DSC1087.JPG",
  "/images/carousel/_DSC1076.JPG",
]

const reviews = [
  {
    name: "Camila R.",
    role: "Student",
    quote:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. In just a few classes I improved my technique and confidence.",
  },
  {
    name: "Lucas M.",
    role: "Student",
    quote:
      "Rhythm, musicality, and clear structure. I liked the constant feedback and how it adapts to each level.",
  },
  {
    name: "Sofia G.",
    role: "Student",
    quote:
      "Great class energy. The instructor explains step by step and progress is noticeable very quickly.",
  },
  {
    name: "Nico P.",
    role: "Student",
    quote:
      "Practical, straightforward content. You leave each class with something concrete to apply.",
  },
]

const formatPrice = (value?: number) => (typeof value === "number" ? `$${value}` : "—")
const dayMap: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
}

const formatDays = (raw: string) => {
  if (!raw) return raw
  if (!/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(raw)) return raw
  const normalized = raw.replace(/and/gi, ",")
  const parts = normalized.split(/[,/]/).map((p) => p.trim()).filter(Boolean)
  if (!parts.length) return raw
  return parts.map((p) => dayMap[p] || p).join(", ")
}

const to12h = (time: string) => {
  const match = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return time
  let hours = Number(match[1])
  const minutes = match[2]
  const ampm = hours >= 12 ? "PM" : "AM"
  hours = hours % 12
  if (hours === 0) hours = 12
  return `${hours}:${minutes} ${ampm}`
}

const stripAgeNotes = (value: string) => value.replace(/\([^)]*\)/g, "").replace(/\s{2,}/g, " ").trim()

const extractAgeNotes = (value: string) => {
  const matches = value.match(/\(([^)]+)\)/g)
  if (!matches) return []
  return matches.map((m) => m.replace(/[()]/g, "").trim()).filter(Boolean)
}

const formatTimeRange = (raw: string) => {
  if (!raw) return raw
  const matches = raw.match(/\d{1,2}:\d{2}/g)
  if (!matches || matches.length === 0) return raw
  if (matches.length === 1) return to12h(matches[0])
  return `${to12h(matches[0])} – ${to12h(matches[1])}`
}

const formatScheduleTime = (raw: string) => {
  if (!raw) return raw
  const cleaned = stripAgeNotes(raw)
  const matches = cleaned.match(/\d{1,2}:\d{2}/g)
  if (!matches?.length) return cleaned
  if (matches.length === 2 && !/[/•]/.test(cleaned)) return formatTimeRange(cleaned)
  return cleaned.replace(/\d{1,2}:\d{2}/g, (m) => to12h(m))
}

const toEmbedVideoUrl = (input: string) => {
  const value = input.trim()
  if (!value) return ""
  if (value.includes("youtube.com/watch?v=")) {
    const id = value.split("watch?v=")[1]?.split("&")[0]
    return id ? `https://www.youtube.com/embed/${id}` : value
  }
  if (value.includes("youtu.be/")) {
    const id = value.split("youtu.be/")[1]?.split("?")[0]
    return id ? `https://www.youtube.com/embed/${id}` : value
  }
  if (value.includes("vimeo.com/")) {
    const id = value.split("vimeo.com/")[1]?.split("?")[0]
    return id ? `https://player.vimeo.com/video/${id}` : value
  }
  return value
}

const isEmbedVideoUrl = (value: string) =>
  value.includes("youtube.com/embed/") || value.includes("player.vimeo.com/video/")

const toAutoplayEmbedUrl = (value: string) => {
  const base = value.trim()
  if (!base) return ""
  const hasQuery = base.includes("?")
  if (base.includes("youtube.com/embed/")) {
    return `${base}${hasQuery ? "&" : "?"}autoplay=1&mute=1&controls=1&rel=0&playsinline=1`
  }
  if (base.includes("player.vimeo.com/video/")) {
    return `${base}${hasQuery ? "&" : "?"}autoplay=1&muted=1`
  }
  return base
}

const extractScheduleSlots = (raw: string) => {
  if (!raw) return [] as string[]
  const segments = raw.split(/[\/•]/).map((s) => s.trim()).filter(Boolean)
  const slots: string[] = []
  segments.forEach((segment) => {
    const cleaned = stripAgeNotes(segment)
    const matches = cleaned.match(/\d{1,2}:\d{2}/g) ?? []
    if (matches.length >= 2) {
      const start = matches[0]
      const end = matches[1]
      if (start && end) {
        slots.push(`${to12h(start)} – ${to12h(end)}`)
      }
    } else if (matches.length === 1) {
      const only = matches[0]
      if (only) slots.push(to12h(only))
    }
  })
  if (!slots.length) {
    const cleaned = stripAgeNotes(raw)
    return cleaned ? [formatScheduleTime(cleaned)] : []
  }
  return slots
}


export default function CourseSections({ course }: { course: CourseSectionsData }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const carouselRef = React.useRef<HTMLDivElement | null>(null)
  const bookingAddress = "54 Coles St, Jersey City, NJ"
  const bookingMapLink = "https://maps.google.com/?q=54+Coles+St+Jersey+City+NJ"
  const bookingMapImage = "/images/maps-pli.png"

  const focusBooking = React.useCallback(() => {
    const target = document.getElementById("booking-service") as HTMLElement | null
    const anchor = document.getElementById("enroll-cta") as HTMLElement | null
    if (anchor) anchor.scrollIntoView({ behavior: "smooth", block: "start" })
    if (target) target.focus()
  }, [])

  const openBooking = React.useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      window.dispatchEvent(new CustomEvent("pli:open-booking"))
      return
    }
    focusBooking()
  }, [focusBooking])

  React.useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"))
    if (!targets.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible")
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.18, rootMargin: "0px 0px -10% 0px" }
    )

    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const scrollCarousel = (direction: number) => {
    if (!carouselRef.current) return
    carouselRef.current.scrollBy({ left: direction * 280, behavior: "smooth" })
  }

  const services = course.enrollment.services ?? []
  const packages = course.enrollment.packages ?? []
  const addons = course.enrollment.addons ?? []
  const benefits = course.benefits ?? []
  const syllabus = course.syllabus ?? []
  const heroImage = course.heroMedia?.image
  const heroVideoRaw = course.heroMedia?.video?.trim() || ""
  const heroEmbedVideo = toEmbedVideoUrl(heroVideoRaw)
  const isHeroEmbedVideo = isEmbedVideoUrl(heroEmbedVideo)
  const heroVideo = isHeroEmbedVideo ? toAutoplayEmbedUrl(heroEmbedVideo) : heroVideoRaw
  const ageNotes = extractAgeNotes(course.schedule.time || "")
  const scheduleSlots = extractScheduleSlots(course.schedule.time || "")

  const stats = [
    { label: "Level", value: course.level },
    { label: "Duration", value: course.duration },
    { label: "Frequency", value: course.schedule.frequency || formatDays(course.schedule.day) },
  ]

  const highlights = (benefits.length ? benefits : syllabus).slice(0, 3)
  const focusAreas = (benefits.length ? benefits : syllabus).slice(0, 8)
  const processSteps = syllabus.slice(0, 5)
  const practiceImage = heroImage || reviewAvatars[0]

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0b0b0b] text-white shadow-[0_30px_90px_-50px_rgba(0,0,0,0.9)]"
    >
      <div className="pointer-events-none absolute -top-24 -right-20 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_50%)]" />

      <div className="relative z-10 space-y-12 px-5 py-10 sm:px-10">
        {/* Hero */}
        <section data-reveal className="reveal">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={focusBooking}
              className="text-xs uppercase tracking-[0.35em] text-white hover:text-white"
            >
              Book your class →
            </button>
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-[color:var(--brand)]">Course experience</p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-semibold leading-tight">{course.title}</h2>
              <p className="mt-3 text-sm sm:text-base text-white/70">{course.description}</p>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"
                  >
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">{stat.label}</p>
                    <p className="mt-2 text-sm font-semibold">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#2b0c0c] via-[#0f0f0f] to-[#070707] p-5 backdrop-blur">
              <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--brand)]">Schedules</div>
              <div className="relative mt-4 overflow-hidden rounded-3xl border border-white/10 bg-black/40">
                <div
                  className="absolute top-0 h-full"
                  style={{ right: "calc(var(--spacing) * 0)", width: "100%" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bookingMapImage} alt="" className="h-full w-full object-cover object-center" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-[#100606] via-[lab(0_0_0_/_0.5)] to-transparent" />
                <div className="relative z-10 p-4 md:max-w-[42%] lg:max-w-[69%]">
                  <div className="rounded-2xl border border-white/10 bg-black/50 px-4 py-4 space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/50">Days</p>
                      <p className="mt-1 text-base font-semibold text-white">{formatDays(course.schedule.day)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/50">Schedule completo</p>
                      {ageNotes.length > 0 && scheduleSlots.length > 1 ? (
                        <div className="mt-2 space-y-2 text-left">
                          {scheduleSlots.slice(0, 2).map((slot, idx) => (
                            <p key={`${slot}-${idx}`} className="text-sm font-semibold text-white">
                              <span className="text-[color:var(--brand)]">Group {idx === 0 ? "A" : "B"}</span> · {slot}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-base font-semibold text-white">{formatScheduleTime(course.schedule.time)}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/50">Address</p>
                      <a
                        href={bookingMapLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 text-sm font-semibold text-white underline underline-offset-4 decoration-red-400/70"
                      >
                        {bookingAddress}
                      </a>
                    </div>
                    {ageNotes.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-[color:var(--brand)]">Age groups</p>
                        <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/90">
                          {ageNotes.slice(0, 2).map((note, idx) => (
                            <p key={`${note}-${idx}`} className={idx === 0 ? "pb-2" : ""}>
                              <span className="mr-2 text-[color:var(--brand)]">Group {idx === 0 ? "A" : "B"}:</span>
                              {note}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-sm font-semibold leading-snug text-[color:var(--brand)]">
                      Note: entry to the room is at the scheduled time.
                      <span className="block">Not earlier, because there are other classes in progress.</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-black/60">
            <div className="aspect-video w-full">
              {heroVideo ? (
                isHeroEmbedVideo ? (
                  <iframe
                    src={heroVideo}
                    title={`${course.title} preview`}
                    className="h-full w-full"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={heroVideo}
                    poster={heroImage}
                    className="h-full w-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                  />
                )
              ) : heroImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-neutral-800 via-neutral-900 to-black" />
              )}
            </div>
          </div>
        </section>

        {/* What you get */}
        <section data-reveal className="reveal">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--brand)]">What you will achieve</p>
            <h3 className="mt-3 text-2xl font-semibold">Real results from the first week</h3>
            <p className="mt-3 text-sm text-white/70">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
              dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip
              ex ea commodo consequat.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(benefits.length ? benefits : syllabus).slice(0, 6).map((item) => (
                <span key={item} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="services" data-reveal className="reveal">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--brand)]">Services</p>
              <h3 className="mt-3 text-2xl font-semibold">How booking works</h3>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">1. Servicio</p>
              <p className="mt-2 text-sm text-white/70">
                Choose the format that best fits your week.
              </p>
              <div className="mt-4 space-y-2">
                {services.map((service) => (
                  <div key={service.id} className="flex items-center justify-between text-sm">
                    <span>{service.label}</span>
                    <span className="font-semibold">{formatPrice(service.price)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">2. Packages</p>
              <p className="mt-2 text-sm text-white/70">
                If you want continuity, choose a pack with a preferred price.
              </p>
              <div className="mt-4 space-y-2">
                {packages.length ? (
                  packages.map((pkg) => (
                    <div key={pkg.id} className="flex items-center justify-between text-sm">
                      <span>{pkg.label}</span>
                      <span className="font-semibold">{formatPrice(pkg.price)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-white/50">No packs available for this course.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">3. Extras</p>
              <p className="mt-2 text-sm text-white/70">
                Add optional extras to enhance your experience.
              </p>
              <div className="mt-4 space-y-2">
                {addons.length ? (
                  addons.map((addon) => (
                    <div key={addon.id} className="flex items-center justify-between text-sm">
                      <span>{addon.label}</span>
                      <span className="font-semibold">{formatPrice(addon.price)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-white/50">No extras for this course.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Highlights */}
        <section data-reveal className="reveal">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--brand)]">Key moments</p>
              <h3 className="mt-3 text-2xl font-semibold">What you will experience in class</h3>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {highlights.map((item, idx) => (
              <div key={`${item}-${idx}`} className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="aspect-[4/3] overflow-hidden rounded-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={reviewAvatars[idx % reviewAvatars.length]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="mt-4 text-sm font-semibold">{item}</p>
                <p className="mt-1 text-xs text-[color:var(--brand)]">Precision · Rhythm · Flow</p>
              </div>
            ))}
          </div>
        </section>

        {/* Reviews carousel */}
        <section data-reveal className="reveal">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--brand)]">Reviews</p>
              <h3 className="mt-3 text-2xl font-semibold">Real feedback</h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-full border border-white/20 px-4 py-2 text-xs"
              >
                Leave feedback
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollCarousel(-1)}
                  className="h-9 w-9 rounded-full border border-white/20 text-white/80"
                  aria-label="Previous"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => scrollCarousel(1)}
                  className="h-9 w-9 rounded-full border border-white/20 text-white/80"
                  aria-label="Next"
                >
                  →
                </button>
              </div>
            </div>
          </div>
          <div
            ref={carouselRef}
            className="mt-6 flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2"
          >
            {reviews.map((review, idx) => (
              <article
                key={review.name}
                className="min-w-[260px] max-w-[260px] snap-start rounded-3xl border border-white/10 bg-white/5 p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-full border border-white/20 bg-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={reviewAvatars[idx % reviewAvatars.length]} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <p className="text-xs text-[color:var(--brand)]">{review.role}</p>
                    <h4 className="text-sm font-semibold">{review.name}</h4>
                  </div>
                </div>
                <p className="mt-3 text-xs text-white/70">{review.quote}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Work + practice */}
        <section data-reveal className="reveal">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--brand)]">Class flow</p>
              <h3 className="mt-3 text-2xl font-semibold">How it unfolds and what you practice</h3>
            </div>
            <span className="text-xs text-white/50">{course.schedule.time}</span>
          </div>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row">
            <div className="flex-1 grid gap-3">
              {processSteps.map((step, idx) => (
                <div key={`${step}-${idx}`} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-xs font-semibold">
                    0{idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{step}</p>
                    <p className="text-xs text-[color:var(--brand)]">Guided practice with corrections and repetition.</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex-1 rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">You will practice</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {focusAreas.map((area, idx) => (
                  <span key={`${area}-${idx}`} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs">
                    {area}
                  </span>
                ))}
              </div>
              <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={practiceImage} alt="" className="h-56 w-full object-cover object-[center_32%]" />
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section data-reveal className="reveal">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--brand)]">Pricing</p>
              <h3 className="mt-3 text-2xl font-semibold">Choose your pack</h3>
            </div>
            <span className="text-xs text-white/50">New student option available</span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {packages.slice(0, 4).map((pkg) => (
              <div key={pkg.id} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <p className="text-sm font-semibold">{pkg.label}</p>
                {pkg.description && <p className="mt-1 text-xs text-[color:var(--brand)]">{pkg.description}</p>}
                <p className="mt-6 text-3xl font-semibold">{formatPrice(pkg.price)}</p>
                <a
                  href="#enroll-cta"
                  className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs text-white/80"
                >
                  Book this pack
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section data-reveal className="reveal">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--brand)]">FAQ</p>
              <h3 className="mt-3 text-2xl font-semibold">Quick answers</h3>
            </div>
            <span className="text-xs text-white/50">{bookingAddress}</span>
          </div>

          <div className="mt-6 space-y-3">
            {faqs.map((item) => (
              <div key={item.q} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <p className="text-sm font-semibold">{item.q}</p>
                <p className="mt-2 text-xs text-[color:var(--brand)]">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact / CTA */}
        <section data-reveal className="reveal">
          <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-8">
            <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--brand)]">Contact</p>
            <h3 className="mt-3 text-2xl font-semibold">Ready to book your spot?</h3>
            <p className="mt-3 text-sm text-white/70">
              Secure your class and preferred time slot. We will confirm everything after checkout.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <div id="booking-dock" className="relative w-full">
                <button
                  type="button"
                  onClick={openBooking}
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[var(--brand,#b61616)] bg-white/10 px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_35px_-18px_rgba(182,22,22,0.65)] backdrop-blur-md transition hover:translate-y-[-1px] hover:border-[var(--brand,#e31b1b)]"
                >
                  Book your class
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
