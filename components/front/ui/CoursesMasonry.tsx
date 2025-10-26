"use client"

import Image from "next/image"
import React from "react"
import { Users, Filter, Clock, ChevronDown } from "lucide-react"

export type Course = {
  id: string
  title: string
  teacher: string
  image: string
  students?: string
  duration?: string
  badge?: string
  category?: string
  size?: "sm" | "md" | "lg"
  description?: string
}

export type CoursesMasonryProps = {
  title?: string
  categories?: string[]
  courses?: Course[]
}

const fallbackCategories = [
  "Featured",
  "Salsa",
  "Bachata",
  "Afro-Cuban",
  "Percussion",
  "Latin Music",
  "Tango",
  "Reggaeton",
  "Folklore",
  "Latin Art",
]

const sampleCourses: Course[] = [
  {
    id: "1",
    title: "Salsa On2: Fundamentals & Body Movement",
    teacher: "María López",
    image: "/images/carousel/_DSC0998.JPG",
    students: "2,148",
    duration: "2h 40m",
    badge: "Staff Pick",
    category: "Salsa",
    size: "lg",
    description: "Learn basic steps, timing, and body control with Latin musicality."
  },
  {
    id: "2",
    title: "Bachata Sensual: Waves, Turns & Flow",
    teacher: "Carlos & Ana",
    image: "/images/carousel/_DSC1076.JPG",
    students: "4,119",
    duration: "1h 55m",
    category: "Bachata",
    size: "md"
  },
  {
    id: "3",
    title: "Afro‑Cuban Rumba: Guaguancó Essentials",
    teacher: "Yoruba Roots",
    image: "/images/carousel/_DSC1087.JPG",
    students: "993",
    duration: "1h 42m",
    category: "Afro-Cuban",
    size: "sm"
  },
  {
    id: "4",
    title: "Peruvian Cajón: Afro‑Peruvian Rhythms",
    teacher: "Diego Flores",
    image: "/images/carousel/_DSC1090.JPG",
    students: "827",
    duration: "1h 18m",
    category: "Percussion",
    size: "md",
    description: "Festejo, Landó, and Zamacueca from scratch."
  },
  {
    id: "5",
    title: "Tango Musicality: Walking with Elegance",
    teacher: "Milena & Juan",
    image: "/images/carousel/_DSC1079.JPG",
    students: "1,659",
    duration: "1h 25m",
    category: "Tango",
    size: "lg"
  },
  {
    id: "6",
    title: "Piano Latino: Montunos & Tumbaos",
    teacher: "Luis González",
    image: "/images/carousel/_DSC0998.JPG",
    students: "1,213",
    duration: "2h 05m",
    category: "Latin Music",
    size: "md"
  },
  {
    id: "7",
    title: "Reggaetón Foundations: Groove & Attitude",
    teacher: "La Crew Urbano",
    image: "/images/carousel/_DSC1076.JPG",
    students: "1,620",
    duration: "1h 10m",
    category: "Reggaeton",
    size: "sm"
  },
  {
    id: "8",
    title: "Arte Latino: Colores del Caribe en Acrílico",
    teacher: "Sofía Martínez",
    image: "/images/carousel/_DSC1087.JPG",
    students: "1,091",
    duration: "1h 34m",
    category: "Latin Art",
    size: "lg",
    description: "Pintura vibrante inspirada en la música y el baile caribeño."
  },
]

export default function CoursesMasonry({
  title = "Latin Dance, Music, and Art Courses",
  categories = fallbackCategories,
  courses = sampleCourses,
}: CoursesMasonryProps) {
  const [active, setActive] = React.useState<string>(
    categories.length > 0 ? categories[0] : "Featured"
  )
  const filtered = React.useMemo(() => {
    if (!active || active === "Featured") return courses
    return courses.filter((c) => c.category === active)
  }, [active, courses])

  const aspectFor = (s?: "sm" | "md" | "lg") => {
    switch (s) {
      case "lg":
        return "3 / 4" // taller
      case "sm":
        return "16 / 9" // shorter
      default:
        return "4 / 3" // medium
    }
  }

  return (
    <section className="w-full mt-[200px]">
      <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <header className="text-center mb-6 sm:mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h2>
        </header>

        {/* Filter/menu bar */}
        <div className="mb-6 sm:mb-8 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                  active === cat
                    ? "bg-[var(--brand)] text-white border-transparent"
                    : "bg-background/40 border-border/50 hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4 text-[var(--brand)]" />
              <span>
                {active === "Featured" ? "All categories" : active} · {filtered.length} courses
              </span>
            </div>

            <label className="inline-flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Sort</span>
              <span className="relative">
                <select className="appearance-none rounded-md border bg-background/60 px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
                  <option>Most Popular</option>
                  <option>Newest</option>
                  <option>Shortest</option>
                  <option>Longest</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </span>
            </label>
          </div>
        </div>

        {/* Masonry grid using CSS columns */}
        <div className="[&>*]:mb-6 columns-1 md:columns-2 lg:columns-3 gap-6 overflow-x-clip">
          {filtered.map((c) => (
            <article
              key={c.id}
              className="break-inside-avoid rounded-xl border bg-white/60 dark:bg-neutral-900/60 backdrop-blur-md backdrop-saturate-150 border-white/10 dark:border-white/10 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="relative w-full overflow-hidden" style={{ aspectRatio: aspectFor(c.size) }}>
                <Image src={c.image} alt={c.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
                {c.badge && (
                  <span className="absolute left-3 top-3 rounded-md bg-black/60 text-white text-[11px] px-2 py-1">{c.badge}</span>
                )}
              </div>

              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Users className="size-3 text-[var(--brand)]" />{c.students} students</span>
                  <span className="inline-flex items-center gap-1"><Clock className="size-3 text-[var(--brand)]" />{c.duration}</span>
                </div>
                <h3 className="text-sm font-semibold leading-snug">{c.title}</h3>
                <p className="text-xs text-muted-foreground">{c.teacher}</p>
                {c.description && (
                  <p className="text-xs text-muted-foreground/90 pt-1">{c.description}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
