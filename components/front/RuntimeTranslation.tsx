"use client"

import { useEffect } from "react"
import { useI18n } from "@/lib/i18n"
import { startRuntimeTranslation } from "@/lib/i18n-runtime-es"

/**
 * Activates runtime DOM translation when the locale is "es".
 * Mount this once in the root layout — it self-cleans on unmount.
 *
 * Zero impact when locale is "en" (no observer, no DOM walks).
 */
export default function RuntimeTranslation() {
  const { locale } = useI18n()

  useEffect(() => {
    if (locale !== "es") return

    const cleanup = startRuntimeTranslation()
    return cleanup
  }, [locale])

  return null
}
