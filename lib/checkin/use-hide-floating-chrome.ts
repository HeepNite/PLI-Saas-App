"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { detectQrFlow } from "./qr-flow"

/**
 * True while global floating chrome (the chat/assistant widget and the
 * back-to-top button) should be hidden to keep checkout distraction-free.
 *
 * Two triggers, OR-ed:
 * - `detectQrFlow()` — the URL is part of the QR-mobile flow (`?fromQr` / `?qrBooking`).
 * - A full-screen modal has locked body scroll (`document.body.style.overflow === "hidden"`).
 *   The EnrollModal booking sets this while open, so it reliably covers every step
 *   (info, SMS verify, packages, payment) regardless of route or query param — which
 *   URL detection alone missed for the in-modal screens.
 *
 * Reactive via a MutationObserver on `body`'s style attribute + route changes.
 */
export function useHideFloatingChrome(): boolean {
  const pathname = usePathname()
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const check = () => {
      const bodyScrollLocked = document.body.style.overflow === "hidden"
      setHidden(detectQrFlow() || bodyScrollLocked)
    }
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] })
    window.addEventListener("popstate", check)
    return () => {
      observer.disconnect()
      window.removeEventListener("popstate", check)
    }
  }, [pathname])

  return hidden
}
