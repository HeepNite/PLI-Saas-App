import { cookies } from "next/headers"
import { translations, type I18nKey, type Locale } from "@/lib/i18n-dict"

export async function getLocaleFromRequest(): Promise<Locale> {
  const c = await cookies()
  const lang = c.get("lang")?.value
  return lang === "es" ? "es" : "en"
}

export async function tServer(key: I18nKey, vars?: Record<string, string | number>, locale?: Locale): Promise<string> {
  const loc = locale ?? (await getLocaleFromRequest())
  const dict = translations[loc] as Record<string, string>
  const fallback = translations.en as Record<string, string>
  let val = dict[key] ?? fallback[key] ?? key
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      const sv = String(v)
      val = val.replace(new RegExp(`\\{${k}\\}`, "g"), sv)
      val = val.replace(new RegExp(`\\$\\{${k}\\}`, "g"), sv)
    })
  }
  return val
}
