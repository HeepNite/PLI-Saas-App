"use client"
import React, {createContext, useContext, useMemo} from "react"
import {useSearchParams} from "next/navigation"
import { translations, type Locale } from "@/lib/i18n-dict"

type I18nContextValue = {
  locale: Locale
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  t: (k) => k,
})

export function I18nProvider({children}: {children: React.ReactNode}) {
  const sp = useSearchParams()
  const param = (sp?.get("lang") as Locale | null) || null
  let initial: Locale = "en"
  if (typeof document !== "undefined") {
    const fromCookie = document.cookie.split("; ").find((c) => c.startsWith("lang="))?.split("=")?.[1] as Locale | undefined
    if (fromCookie === "en" || fromCookie === "es") initial = fromCookie
  }
  const locale: Locale = param === "en" || param === "es" ? param : initial
  // persist cookie if param provided
  if (typeof document !== "undefined" && param && param !== initial) {
    document.cookie = `lang=${param}; path=/; max-age=${60 * 60 * 24 * 365}`
  }

  const t = useMemo(() => {
    const dict = translations[locale]
    return (key: string, vars?: Record<string, string | number>) => {
      let val = dict[key] ?? translations.en[key] ?? key
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          // Support both {var} and ${var} placeholders in templates
          const sv = String(v)
          val = val.replace(new RegExp(`\\{${k}\\}`, "g"), sv)
          val = val.replace(new RegExp(`\\$\\{${k}\\}`, "g"), sv)
        })
      }
      return val
    }
  }, [locale])

  return (
    <I18nContext.Provider value={{locale, t}}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
