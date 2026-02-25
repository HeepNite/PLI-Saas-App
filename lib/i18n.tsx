"use client"
import React, {createContext, useContext, useMemo} from "react"
import {useSearchParams} from "next/navigation"
import { translations, type I18nKey, type Locale } from "@/lib/i18n-dict"
type I18nVars = Record<string, string | number>

type I18nContextValue = {
  locale: Locale
  t: (key: I18nKey, vars?: I18nVars) => string
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  t: (k) => k,
})

export function I18nProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode
  initialLocale?: Locale
}) {
  const sp = useSearchParams()
  const paramLocale = (sp?.get("lang") as Locale | null) || null
  const initial = paramLocale === "en" || paramLocale === "es" ? paramLocale : initialLocale
  const [locale, setLocale] = React.useState<Locale>(initial)

  React.useEffect(() => {
    const param = (sp?.get("lang") as Locale | null) || null
    const cookieLocale = (() => {
      const fromCookie = document.cookie.split("; ").find((c) => c.startsWith("lang="))?.split("=")?.[1] as Locale | undefined
      return fromCookie === "en" || fromCookie === "es" ? fromCookie : null
    })()
    const next: Locale = param === "en" || param === "es"
      ? param
      : cookieLocale || initialLocale

    if (param && param !== cookieLocale) {
      document.cookie = `lang=${param}; path=/; max-age=${60 * 60 * 24 * 365}`
    }
    if (next !== locale) {
      setLocale(next)
    }
  }, [sp, initialLocale, locale])

  const t = useMemo(() => {
    const dict = translations[locale]
    return (key: I18nKey, vars?: I18nVars) => {
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
