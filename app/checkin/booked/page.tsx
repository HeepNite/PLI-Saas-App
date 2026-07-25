"use client"

import React, { Suspense } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"

const REDIRECT_MS = 8000

function BookedContent() {
  const router = useRouter()
  const params = useSearchParams()

  const course = params.get("course") || ""
  const name = params.get("name") || ""

  React.useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/client-profile")
    }, REDIRECT_MS)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[1.75rem] border border-emerald-500/30 bg-[radial-gradient(circle_at_top_left,rgba(191,30,30,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(18,20,29,0.98),rgba(11,13,20,0.99))] p-6 text-center shadow-[0_28px_60px_-36px_rgba(0,0,0,0.92)] ring-1 ring-white/5">
        <div className="mx-auto mb-4 flex justify-center">
          <Image
            src="/logo/logo-white.png"
            alt="Palladium Latin Art"
            width={120}
            height={48}
            className="h-auto w-[calc(var(--spacing)*30)] object-contain"
          />
        </div>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/20">
          <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-white">
          You&apos;re in{name ? `, ${name}` : ""}!
        </h1>
        {course && (
          <p className="mt-3 text-sm text-white/70">
            You&apos;re booked for <span className="font-medium text-white">{course}</span>.
          </p>
        )}
        <p className="mt-4 text-xs text-white/50">Redirecting to your profile shortly.</p>
      </div>
    </div>
  )
}

export default function BookedPage() {
  return (
    <Suspense fallback={null}>
      <BookedContent />
    </Suspense>
  )
}
