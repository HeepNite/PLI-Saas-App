"use client"

import React from "react"
import Image from "next/image"
import Link from "next/link"
import { SearchIcon } from "lucide-react"
import Form from "next/form"
import { useI18n } from "@/lib/i18n"
import {
  DropDownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropDownMenu"
import { demoCourses } from "@/constants/courses"

const SearchInput = () => {
  const { t } = useI18n()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<typeof demoCourses>([])
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const normalized = query.trim().toLowerCase()
    if (normalized.length < 3) {
      setLoading(false)
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    const id = window.setTimeout(() => {
      const filtered = demoCourses.filter((course) => {
        const haystack = `${course.title} ${course.description} ${course.level} ${course.schedule.day}`.toLowerCase()
        return haystack.includes(normalized)
      })
      setResults(filtered)
      setLoading(false)
      setOpen(true)
    }, 260)
    return () => window.clearTimeout(id)
  }, [query])

  const gridClass =
    results.length <= 1
      ? "grid-cols-1"
      : results.length === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"

  const cardClass =
    results.length <= 1
      ? "min-h-[220px]"
      : results.length === 2
        ? "min-h-[200px]"
        : "min-h-[180px]"

  return (
    <div className="flex gap-4">
      <DropDownMenu
        open={open}
        modal={false}
        onOpenChange={(next) => (query.trim().length >= 3 ? setOpen(next) : setOpen(false))}
      >
        <div ref={wrapperRef} className="relative w-full flex-1">
          <DropdownMenuTrigger asChild>
            <span aria-hidden className="absolute inset-0 pointer-events-none" />
          </DropdownMenuTrigger>
          <Form className="relative w-full flex-1" action="/search">
            <input
              className="w-full rounded-full bg-secondary/80 px-4 py-2 pl-10 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              type="search"
              name="q"
              placeholder={t("searchPlaceholder")}
              aria-label={t("aria_search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (query.trim().length >= 3) setOpen(true)
              }}
            />
            <SearchIcon className="absolute left-3 top-1/4 h-4 w-5 text-[var(--brand)] -translate-0" />
          </Form>
        </div>

        <DropdownMenuContent
          align="center"
          sideOffset={10}
          className="w-[90vw] max-w-[760px] max-h-[80vh] overflow-x-hidden p-0 shadow-2xl border-2 border-border/40"
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            const target = event.target as Node | null
            if (wrapperRef.current && target && wrapperRef.current.contains(target)) {
              event.preventDefault()
            }
          }}
        >
          <DropdownMenuLabel className="px-6 pt-5 pb-2 text-xs uppercase tracking-wider text-muted-foreground">
            {loading ? "Buscando cursos..." : "Resultados"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <div className={`grid ${gridClass} h-full gap-4 p-6`}>
            {loading
              ? Array.from({ length: results.length || 3 }).map((_, idx) => (
                  <div key={`search-s-${idx}`} className={`rounded-xl border border-white/10 bg-white/5 p-4 ${cardClass}`}>
                    <div className="aspect-[16/9] w-full rounded-lg shimmer" />
                    <div className="mt-4 h-4 w-2/3 rounded-full shimmer" />
                    <div className="mt-2 h-3 w-1/2 rounded-full shimmer" />
                    <div className="mt-3 h-8 w-24 rounded-full shimmer" />
                  </div>
                ))
              : results.map((course) => (
                  <Link
                    key={course.slug}
                    href={`/cursos/${course.slug}`}
                    className={`rounded-xl border border-white/10 bg-white/60 dark:bg-black/50 backdrop-blur-md text-card-foreground p-4 hover:bg-white/70 dark:hover:bg-black/60 transition-all ${cardClass}`}
                  >
                    <div className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded-lg">
                      <Image
                        src={course.heroMedia?.image || "/images/hero-menu/live-academy.JPG"}
                        alt={course.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 340px"
                        className="object-cover"
                      />
                    </div>
                    <h3 className="text-sm font-semibold">{course.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{course.description}</p>
                    <div className="mt-3 inline-flex items-center rounded-full border border-[var(--brand,#b61616)]/50 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[var(--brand,#b61616)]">
                      {course.level}
                    </div>
                  </Link>
                ))}
          </div>
          {!loading && query.trim().length >= 3 && results.length === 0 && (
            <div className="border-t px-6 py-6 text-sm text-muted-foreground">
              No encontramos cursos con ese término. Probá con otro.
            </div>
          )}
        </DropdownMenuContent>
      </DropDownMenu>
    </div>
  )
}

export default SearchInput
