"use client"
import React from "react"
import type { CourseSectionsData } from "./types"

const faqs = [
  {
    q: "¿Necesito pareja?",
    a: "No. Rotamos y organizamos la clase para que todos practiquen cómodos.",
  },
  {
    q: "¿Qué debo traer?",
    a: "Ropa cómoda, agua y buena energía. Calzado con suela suave ayuda a girar.",
  },
  {
    q: "¿Puedo empezar de cero?",
    a: "Sí. La clase está pensada para principiantes y vamos paso a paso.",
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
    role: "Alumno",
    quote:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. En pocas clases mejoré la técnica y la seguridad.",
  },
  {
    name: "Lucas M.",
    role: "Alumno",
    quote:
      "Ritmo, musicalidad y estructura clara. Me gustó el feedback constante y cómo se adapta al nivel.",
  },
  {
    name: "Sofía G.",
    role: "Alumno",
    quote:
      "Excelente energía en clase. El instructor explica paso a paso y se nota el progreso muy rápido.",
  },
  {
    name: "Nico P.",
    role: "Alumno",
    quote:
      "Contenido práctico y directo. Salís de cada clase con algo concreto para aplicar.",
  },
]

const formatPrice = (value?: number) => (typeof value === "number" ? `$${value}` : "—")
const dayMap: Record<string, string> = {
  Mon: "Lunes",
  Tue: "Martes",
  Wed: "Miércoles",
  Thu: "Jueves",
  Fri: "Viernes",
  Sat: "Sábado",
  Sun: "Domingo",
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

const extractScheduleSlots = (raw: string) => {
  if (!raw) return [] as string[]
  const segments = raw.split(/[\/•]/).map((s) => s.trim()).filter(Boolean)
  const slots: string[] = []
  segments.forEach((segment) => {
    const cleaned = stripAgeNotes(segment)
    const matches = cleaned.match(/\d{1,2}:\d{2}/g) ?? []
    if (matches.length >= 2) {
      slots.push(`${to12h(matches[0])} – ${to12h(matches[1])}`)
    } else if (matches.length === 1) {
      slots.push(to12h(matches[0]))
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
  const heroVideo = course.heroMedia?.video
  const ageNotes = extractAgeNotes(course.schedule.time || "")
  const scheduleSlots = extractScheduleSlots(course.schedule.time || "")

  const stats = [
    { label: "Nivel", value: course.level },
    { label: "Duración", value: course.duration },
    { label: "Frecuencia", value: course.schedule.frequency || formatDays(course.schedule.day) },
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
              Reserva tu clase →
            </button>
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-[color:var(--brand)]">Experiencia del curso</p>
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
              <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--brand)]">Horarios</div>
              <div className="relative mt-4 overflow-hidden rounded-3xl border border-white/10 bg-black/40">
                <div
                  className="absolute top-0 h-full"
                  style={{ right: "calc(var(--spacing) * -146)", width: "130%" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bookingMapImage} alt="" className="h-full w-full object-cover object-center" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-[#100606] via-[lab(0_0_0_/_0.7)] to-transparent" />
                <div className="relative z-10 p-5 md:max-w-[45%]">
                  <div className="rounded-2xl border border-white/10 bg-black/50 px-4 py-4 space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/50">Días</p>
                      <p className="mt-1 text-lg font-semibold text-white">{formatDays(course.schedule.day)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/50">Horario completo</p>
                      {ageNotes.length > 0 && scheduleSlots.length > 1 ? (
                        <div className="mt-2 space-y-2 text-left">
                          {scheduleSlots.slice(0, 2).map((slot, idx) => (
                            <p key={`${slot}-${idx}`} className="text-base font-semibold text-white">
                              <span className="text-[color:var(--brand)]">Grupo {idx === 0 ? "A" : "B"}</span> · {slot}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-lg font-semibold text-white">{formatScheduleTime(course.schedule.time)}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/50">Dirección</p>
                      <a
                        href={bookingMapLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 text-base font-semibold text-white underline underline-offset-4 decoration-red-400/70"
                      >
                        {bookingAddress}
                      </a>
                    </div>
                    {ageNotes.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-[color:var(--brand)]">Grupos por edad</p>
                        <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/90">
                          {ageNotes.slice(0, 2).map((note, idx) => (
                            <p key={`${note}-${idx}`} className={idx === 0 ? "pb-2" : ""}>
                              <span className="mr-2 text-[color:var(--brand)]">Grupo {idx === 0 ? "A" : "B"}:</span>
                              {note}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-base font-semibold leading-snug text-[color:var(--brand)]">
                      Nota: el ingreso al salón es a la hora indicada.
                      <span className="block">No antes, porque hay otras clases en curso.</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-black/60">
            <div className="aspect-video w-full">
              {heroVideo ? (
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
            <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--brand)]">Qué vas a lograr</p>
            <h3 className="mt-3 text-2xl font-semibold">Resultados reales desde la primera semana</h3>
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
              <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--brand)]">Servicios</p>
              <h3 className="mt-3 text-2xl font-semibold">Cómo funciona tu reserva</h3>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">1. Servicio</p>
              <p className="mt-2 text-sm text-white/70">
                Elegí la modalidad que mejor se adapte a tu semana.
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
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">2. Paquetes</p>
              <p className="mt-2 text-sm text-white/70">
                Si querés continuidad, elegí un pack con precio preferencial.
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
                  <p className="text-xs text-white/50">No hay packs disponibles para este curso.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">3. Extras</p>
              <p className="mt-2 text-sm text-white/70">
                Sumá extras opcionales para potenciar tu experiencia.
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
                  <p className="text-xs text-white/50">No hay extras para este curso.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Highlights */}
        <section data-reveal className="reveal">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--brand)]">Momentos clave</p>
              <h3 className="mt-3 text-2xl font-semibold">Lo que vas a vivir en clase</h3>
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
                <p className="mt-1 text-xs text-[color:var(--brand)]">Precisión · Ritmo · Flujo</p>
              </div>
            ))}
          </div>
        </section>

        {/* Reviews carousel */}
        <section data-reveal className="reveal">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--brand)]">Reseñas</p>
              <h3 className="mt-3 text-2xl font-semibold">Comentarios reales</h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-full border border-white/20 px-4 py-2 text-xs"
              >
                Dejar comentario
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollCarousel(-1)}
                  className="h-9 w-9 rounded-full border border-white/20 text-white/80"
                  aria-label="Anterior"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => scrollCarousel(1)}
                  className="h-9 w-9 rounded-full border border-white/20 text-white/80"
                  aria-label="Siguiente"
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
              <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--brand)]">Desarrollo de la clase</p>
              <h3 className="mt-3 text-2xl font-semibold">Cómo se desarrolla y qué practicás</h3>
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
                    <p className="text-xs text-[color:var(--brand)]">Práctica guiada con correcciones y repetición.</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex-1 rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Vas a practicar</p>
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
              <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--brand)]">Precios</p>
              <h3 className="mt-3 text-2xl font-semibold">Elige tu pack</h3>
            </div>
            <span className="text-xs text-white/50">Alumno nuevo disponible</span>
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
                  Reservar este pack
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
              <h3 className="mt-3 text-2xl font-semibold">Respuestas rápidas</h3>
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
            <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--brand)]">Contacto</p>
            <h3 className="mt-3 text-2xl font-semibold">¿Listo para reservar tu lugar?</h3>
            <p className="mt-3 text-sm text-white/70">
              Asegura tu clase y tu horario preferido. Confirmamos todo luego del checkout.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={focusBooking}
                className="text-sm uppercase tracking-[0.25em] text-white/70 hover:text-white"
              >
                Reserva la clase →
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
