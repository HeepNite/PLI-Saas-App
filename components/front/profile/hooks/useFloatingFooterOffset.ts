import React from "react"

export function useFloatingFooterOffset(footerId = "site-footer", baseOffset = 24) {
  React.useEffect(() => {
    const footer = document.getElementById(footerId)
    if (!footer) return

    const updateOffset = () => {
      const rect = footer.getBoundingClientRect()
      const overlap = Math.max(0, window.innerHeight - rect.top)
      const next = overlap > 0 ? overlap + baseOffset : baseOffset
      document.documentElement.style.setProperty("--floating-offset", `${next}px`)
    }

    updateOffset()
    window.addEventListener("scroll", updateOffset, { passive: true })
    window.addEventListener("resize", updateOffset)

    return () => {
      document.documentElement.style.removeProperty("--floating-offset")
      window.removeEventListener("scroll", updateOffset)
      window.removeEventListener("resize", updateOffset)
    }
  }, [baseOffset, footerId])
}
