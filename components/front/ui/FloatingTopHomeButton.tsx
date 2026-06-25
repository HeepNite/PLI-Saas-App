"use client"

import React from "react"
import { ArrowUp, Home } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

export default function FloatingTopHomeButton() {
  const router = useRouter()
  const pathname = usePathname()
  const isStaffRoute = pathname?.startsWith("/staff")
  const isCheckInRoute = pathname?.startsWith("/checkin")
  const isAuthRoute = pathname?.startsWith("/sign-in") || pathname?.startsWith("/sign-up")
  const [showTop, setShowTop] = React.useState(false)
  const [showButton, setShowButton] = React.useState(pathname !== "/")
  const [isCourseMobile, setIsCourseMobile] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY
      const scrollRange = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
      const showAfterHalf = scrollY > scrollRange * 0.5

      setShowTop(scrollY > 200)
      setShowButton((!isStaffRoute && !isCheckInRoute && !isAuthRoute && pathname !== "/") || (!isStaffRoute && !isCheckInRoute && !isAuthRoute && showAfterHalf))
      const isCourse = typeof document !== "undefined" && document.body.dataset.coursePage === "true"
      const isProfile = typeof document !== "undefined" && document.body.dataset.profilePage === "true"
      setIsCourseMobile((Boolean(isCourse) || Boolean(isProfile)) && window.innerWidth < 1024)
    }
    onScroll()
    window.addEventListener("scroll", onScroll)
    window.addEventListener("resize", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [pathname, isAuthRoute, isCheckInRoute, isStaffRoute])

  if (isStaffRoute || isCheckInRoute || isAuthRoute) return null

  const isHome = pathname === "/"
  const label = isHome ? "Back to top" : showTop ? "Back to top" : "Home"

  const handleClick = () => {
    if (showTop || isHome) {
      window.scrollTo({ top: 0, behavior: "smooth" })
    } else {
      router.push("/")
    }
  }

  return (
    <div className="pointer-events-none floating-top fixed bottom-6 right-6 z-50">
      <div
        className={`transition duration-300 ${showButton ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}
      >
        <button
          type="button"
          onClick={handleClick}
          className={`pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[var(--brand,#b61616)] bg-black/80 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_35px_-18px_rgba(182,22,22,0.65)] backdrop-blur-md transition hover:translate-y-[-1px] hover:border-[var(--brand,#e31b1b)] ${
            isCourseMobile ? "h-11 w-11 justify-center px-0 text-[0px]" : ""
          }`}
          aria-label={label}
        >
          {isCourseMobile ? (
            showTop || isHome ? <ArrowUp className="h-4 w-4" /> : <Home className="h-4 w-4" />
          ) : (
            <span className="relative flex items-center">
              <span
                className={`absolute inset-0 flex items-center gap-2 transition duration-200 ${
                  showTop || isHome ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
                }`}
                aria-hidden={!showTop && !isHome}
              >
                <ArrowUp className="h-4 w-4" />
                <span>Back to top</span>
              </span>
              <span
                className={`flex items-center gap-2 transition duration-200 ${
                  showTop || isHome ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
                }`}
                aria-hidden={showTop || isHome}
              >
                <Home className="h-4 w-4" />
                <span>Home</span>
              </span>
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
