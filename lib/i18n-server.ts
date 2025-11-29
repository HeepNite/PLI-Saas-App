import { cookies } from "next/headers"
import { translations, type Locale } from "@/lib/i18n-dict"

export function getLocaleFromRequest(): Locale {
  const c = cookies()
  const lang = c.get("lang")?.value
  return lang === "es" ? "es" : "en"
}

export function tServer(key: string, vars?: Record<string, string | number>, locale?: Locale): string {
  const loc = locale ?? getLocaleFromRequest()
  const dict = translations[loc]
  let val = dict[key] ?? translations.en[key] ?? key
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      const sv = String(v)
      val = val.replace(new RegExp(`\\{${k}\\}`, "g"), sv)
      val = val.replace(new RegExp(`\\$\\{${k}\\}`, "g"), sv)
    })
  }
  return val
}
