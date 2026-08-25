"use client"

import React from "react"
import Link from "next/link"

// Footer inspired by the provided reference image.
// - Big centered quote in a warm cream tone over deep black.
// - Signature in brand color below the quote.
// - Bottom row with left-aligned links (with small brand underlines) and right-aligned copyright.
// - Uses Tailwind and existing CSS variable `var(--brand)` for accents.

const footerLinks: { label: string; href: string }[] = [
  { label: "Classes", href: "#classes" },
  { label: "Schedule", href: "#schedule" },
  { label: "Instructors", href: "#instructors" },
  { label: "Contact", href: "#contact" },
]

type FooterQuoteProps = {
  compactMobileTopSpacing?: boolean
}

export default function FooterQuote({ compactMobileTopSpacing = false }: FooterQuoteProps) {
  const year = new Date().getFullYear()
  const footerSpacing = compactMobileTopSpacing ? "mt-0 md:mt-10 lg:mt-12" : "mt-8 sm:mt-10 lg:mt-12"
  const quoteSpacing = compactMobileTopSpacing ? "pb-20 pt-0 md:py-24 lg:py-28" : "py-20 sm:py-24 lg:py-28"

  return (
    <footer id="site-footer" aria-label="Site footer" className={`w-full bg-black text-white ${footerSpacing}`}>
      <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8 min-h-[420px]">
        {/* Quote block */}
        <div className={quoteSpacing}>
          <div className="relative rounded-3xl bg-white/[0.04] backdrop-blur-xl shadow-[0_25px_120px_-60px_rgba(0,0,0,0.8)] overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--brand,#b61616)]/70 to-transparent" />
            <blockquote className="text-center space-y-8 px-6 sm:px-12 lg:px-16 py-14 sm:py-18">
              <p className="text-[30px] sm:text-[38px] md:text-[46px] lg:text-[56px] leading-tight font-extrabold tracking-tight text-white drop-shadow-[0_10px_35px_rgba(0,0,0,0.45)]">
                “Choreograph the experience — let rhythm lead and design follow.”
              </p>
              {/* Signature */}
              <figcaption className="flex flex-col items-center gap-2 text-sm uppercase tracking-[0.3em] text-white/60">
                <span className="inline-flex h-px w-16 bg-white/30" />
                <span className="text-[var(--brand,#e31b1b)] text-xl md:text-2xl font-semibold italic tracking-wide drop-shadow-[0_6px_20px_rgba(227,27,27,0.45)]">
                  Palladium Latin Institute
                </span>
              </figcaption>
            </blockquote>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10" />
        <div className="py-8 sm:py-10 flex flex-col md:flex-row md:items-center gap-8 md:gap-10 md:divide-x md:divide-white/10">
          {/* Links */}
          <nav aria-label="Footer navigation" className="md:flex-1">
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-md:max-w-lg">
              {footerLinks.map((l) => (
                <li key={l.href} className="space-y-1">
                  <a
                    href={l.href}
                    className="group inline-flex items-center gap-1.5 text-[var(--brand,#e31b1b)] font-semibold drop-shadow-[0_10px_30px_rgba(227,27,27,0.35)]"
                  >
                    {l.label}
                    <svg
                      aria-hidden
                      className="size-4 text-[var(--brand,#e31b1b)]"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M8 5v14l11-7L8 5z" />
                    </svg>
                  </a>
                  <div className="h-[2px] w-12 bg-[var(--brand,#e31b1b)]/90 group-hover:w-16 transition-[width] duration-200" />
                </li>
              ))}
            </ul>
          </nav>

          {/* Divider for mobile */}
          <div className="md:hidden h-px bg-white/10" />

          {/* Contact / copyright */}
          <div className="md:pl-8 flex flex-col gap-3 text-sm text-white/80">
            <p className="text-white font-semibold">Stay in rhythm</p>
            <a href="mailto:hello@pli.studio" className="text-white hover:text-[var(--brand,#e31b1b)] transition drop-shadow-[0_8px_25px_rgba(227,27,27,0.35)]">
              hello@pli.studio
            </a>
            <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs md:text-sm">
              <Link
                href="/privacy"
                className="text-white/80 hover:text-[var(--brand,#e31b1b)] underline underline-offset-4 transition"
              >
                Privacy Policy
              </Link>
              <Link
                href="/sms-terms"
                className="text-white/80 hover:text-[var(--brand,#e31b1b)] underline underline-offset-4 transition"
              >
                SMS Terms
              </Link>
            </nav>
            <p className="text-xs md:text-sm text-neutral-300">
              ©{year} Palladium Latin Institute. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
