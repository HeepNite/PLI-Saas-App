"use client"

import React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useI18n } from "@/lib/i18n"

/**
 * Small EN/ES toggle that updates ?lang= and persists the cookie.
 * Keeps existing query params and replaces the current URL (no navigation stack push).
 */
export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const next = locale === "en" ? "es" : "en"
  const label = next.toUpperCase()

  const onToggle = React.useCallback(() => {
    const params = new URLSearchParams(sp?.toString() || "")
    params.set("lang", next)
    // Persist cookie for a year
    if (typeof document !== "undefined") {
      document.cookie = `lang=${next}; path=/; max-age=${60 * 60 * 24 * 365}`
    }
    router.replace(`${pathname}?${params.toString()}`)
  }, [sp, pathname, router, next])

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={t("aria_switchLanguage")}
      className={`inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10 ${className}`}
      title={t("aria_switchLanguage")}
    >
      {label}
    </button>
  )
}
