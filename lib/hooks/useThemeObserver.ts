"use client"

import React from "react"

export function useThemeObserver() {
  const [isDark, setIsDark] = React.useState(false)

  React.useEffect(() => {
    if (typeof document === "undefined") return
    const root = document.documentElement
    const update = () => setIsDark(root.classList.contains("dark"))
    update()

    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return isDark
}
